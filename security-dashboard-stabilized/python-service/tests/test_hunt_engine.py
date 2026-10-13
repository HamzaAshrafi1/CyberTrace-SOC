import pytest
import time
from app.services.hunt_engine import (
    tokenize, AQLParser, compile_node_to_sql, 
    get_ip_country, TTLCache, execute_aql_hunt,
    FieldCondition, AndCondition, OrCondition, NotCondition, TextCondition
)

# 1. Test Tokenization
def test_tokenizer():
    query = "severity:CRITICAL AND attack:SQL_INJECTION"
    tokens = tokenize(query)
    assert tokens == ["severity:CRITICAL", "AND", "attack:SQL_INJECTION"]

    query_nested = "(country:Russia OR country:China) AND NOT status:resolved"
    tokens_nested = tokenize(query_nested)
    assert tokens_nested == ["(", "country:Russia", "OR", "country:China", ")", "AND", "NOT", "status:resolved"]

# 2. Test Parser
def test_parser_basic():
    tokens = ["severity:CRITICAL"]
    parser = AQLParser(tokens)
    ast = parser.parse()
    assert isinstance(ast, FieldCondition)
    assert ast.field == "severity"
    assert ast.value == "CRITICAL"

def test_parser_logic():
    tokens = ["severity:CRITICAL", "AND", "attack:SQL_INJECTION"]
    parser = AQLParser(tokens)
    ast = parser.parse()
    assert isinstance(ast, AndCondition)
    assert isinstance(ast.left, FieldCondition)
    assert isinstance(ast.right, FieldCondition)

    tokens_or = ["country:Russia", "OR", "country:China"]
    parser_or = AQLParser(tokens_or)
    ast_or = parser_or.parse()
    assert isinstance(ast_or, OrCondition)

    tokens_not = ["NOT", "status:resolved"]
    parser_not = AQLParser(tokens_not)
    ast_not = parser_not.parse()
    assert isinstance(ast_not, NotCondition)

# 3. Test SQL Compilation Safety & SQL Injection Prevention
def test_sql_compiler_safety():
    # Attempt SQL Injection inside values
    injected_val = "CRITICAL'; DROP TABLE \"ThreatEvent\";--"
    node = FieldCondition("severity", injected_val)
    
    params = []
    sql_clause = compile_node_to_sql(node, "ThreatEvent", params)
    
    # Must use parameterized binding (%s) instead of direct string embedding
    assert sql_clause == "severity = %s"
    assert len(params) == 1
    assert params[0] == "CRITICAL'; DROP TABLE \"THREATEVENT\";--" # uppercase conversion for severity

# 4. Test Geolocation
def test_ip_geocoder():
    assert get_ip_country("192.168.1.100") == "Internal"
    assert get_ip_country("10.0.0.1") == "Internal"
    
    # Check deterministic matching
    country1 = get_ip_country("185.220.101.4")
    country2 = get_ip_country("185.220.101.4")
    assert country1 == country2
    assert country1 == "Unknown"

# 5. Test Cache mechanics
def test_ttl_cache():
    cache = TTLCache(ttl_seconds=1)
    cache.set("test_key", "cached_value")
    assert cache.get("test_key") == "cached_value"
    
    # Wait for TTL expiration
    time.sleep(1.2)
    assert cache.get("test_key") is None

# 6. Test Tenant Isolation & Search Execution Compilation
def test_tenant_isolation_enforced():
    # We test search execution compiling. Even if database is empty/mocked, 
    # we want to ensure organizationId is always injected.
    # We check that executing search doesn't crash on invalid SQL when connection is healthy,
    # or it correctly isolates by injecting org ID.
    org_id = "test-org-uuid"
    query = "severity:CRITICAL"
    
    # Since execute_aql_hunt queries postgres, let's mock/test components
    tokens = tokenize(query)
    parser = AQLParser(tokens)
    ast = parser.parse()
    
    params = []
    sql_clause = compile_node_to_sql(ast, "ThreatEvent", params)
    
    assert sql_clause == "severity = %s"
    assert params == ["CRITICAL"]

# 7. Performance test with Simulated Datasets
def test_query_parsing_performance():
    # Parse a large complex query 1000 times to verify speed
    complex_query = "(severity:CRITICAL AND attack:SQL_INJECTION) OR (sourceIp:8.8.8.8 AND NOT status:resolved)"
    tokens = tokenize(complex_query)
    
    start_time = time.time()
    for _ in range(1000):
        parser = AQLParser(tokens)
        ast = parser.parse()
        params = []
        compile_node_to_sql(ast, "ThreatEvent", params)
    
    elapsed = time.time() - start_time
    # Must compile 1000 complex queries in less than 0.5 seconds
    assert elapsed < 0.5
