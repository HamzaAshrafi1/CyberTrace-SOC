import re
import time
import threading
import logging
from typing import List, Dict, Any, Optional, Tuple
from app.database import get_db_connection

logger = logging.getLogger("aegis-hunt-engine")

# --- In-Memory Thread-Safe Cache ---
class TTLCache:
    def __init__(self, ttl_seconds: int = 30):
        self.ttl = ttl_seconds
        self.cache = {}
        self.lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self.lock:
            if key in self.cache:
                val, expires = self.cache[key]
                if time.time() < expires:
                    return val
                else:
                    del self.cache[key]
            return None

    def set(self, key: str, value: Any):
        with self.lock:
            self.cache[key] = (value, time.time() + self.ttl)

hunt_cache = TTLCache(ttl_seconds=10) # 10 seconds cache for rapid consecutive dashboard updates

# --- AQL Abstract Syntax Tree (AST) Nodes ---
class ASTNode:
    pass

class FieldCondition(ASTNode):
    def __init__(self, field: str, value: str):
        self.field = field.lower()
        self.value = value.strip('"').strip("'")

class AndCondition(ASTNode):
    def __init__(self, left: ASTNode, right: ASTNode):
        self.left = left
        self.right = right

class OrCondition(ASTNode):
    def __init__(self, left: ASTNode, right: ASTNode):
        self.left = left
        self.right = right

class NotCondition(ASTNode):
    def __init__(self, operand: ASTNode):
        self.operand = operand

class TextCondition(ASTNode):
    def __init__(self, value: str):
        self.value = value.strip('"').strip("'")

# --- AQL Tokenizer and Parser ---
def tokenize(query_str: str) -> List[str]:
    # Match: parentheses, AND/OR/NOT keywords, key:value fields, or standalone text
    pattern = re.compile(r'(\(|\)|AND|OR|NOT|\w+:(?:"[^"]+"|\'[^\']+\'|[^\s()]+)|[^\s()]+)', re.IGNORECASE)
    tokens = pattern.findall(query_str)
    return [t.strip() for t in tokens if t.strip()]

class AQLParser:
    def __init__(self, tokens: List[str]):
        self.tokens = tokens
        self.pos = 0

    def peek(self) -> Optional[str]:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def consume(self) -> Optional[str]:
        tok = self.peek()
        self.pos += 1
        return tok

    def parse(self) -> ASTNode:
        if not self.tokens:
            return TextCondition("")
        try:
            return self.parse_or()
        except Exception as e:
            logger.error(f"Failed to parse AQL tokens: {e}")
            return TextCondition("")

    def parse_or(self) -> ASTNode:
        node = self.parse_and()
        while True:
            tok = self.peek()
            if tok and tok.upper() == 'OR':
                self.consume()
                right = self.parse_and()
                node = OrCondition(node, right)
            else:
                break
        return node

    def parse_and(self) -> ASTNode:
        node = self.parse_not()
        while True:
            tok = self.peek()
            if tok and tok.upper() == 'AND':
                self.consume()
                right = self.parse_not()
                node = AndCondition(node, right)
            elif tok and tok not in (')', 'OR'):
                # Implicit AND (e.g., severity:HIGH attack:SQLI)
                right = self.parse_not()
                node = AndCondition(node, right)
            else:
                break
        return node

    def parse_not(self) -> ASTNode:
        tok = self.peek()
        if tok and tok.upper() == 'NOT':
            self.consume()
            operand = self.parse_primary()
            return NotCondition(operand)
        return self.parse_primary()

    def parse_primary(self) -> ASTNode:
        tok = self.peek()
        if not tok:
            return TextCondition("")

        if tok == '(':
            self.consume()
            node = self.parse_or()
            next_tok = self.peek()
            if next_tok == ')':
                self.consume()
            return node

        self.consume()
        if ':' in tok:
            field, val = tok.split(':', 1)
            return FieldCondition(field, val)
        return TextCondition(tok)

# --- SQL Compiler for AQL AST ---
def compile_node_to_sql(node: ASTNode, table: str, params: List[Any]) -> str:
    if isinstance(node, FieldCondition):
        field = node.field
        val = node.value

        if field == 'severity':
            if table in ('ThreatEvent', 'Incident', 'Case'):
                params.append(val.upper())
                return "severity = %s"
            else:
                return "1=0"

        elif field == 'sourceip':
            if table == 'ThreatEvent':
                params.append(val)
                return '"sourceIp" = %s'
            elif table == 'SecurityLog':
                params.append(val)
                return '"ipAddress" = %s'
            else:
                return "1=0"

        elif field == 'attack':
            params.append(f"%{val}%")
            if table == 'ThreatEvent':
                return "description ILIKE %s"
            elif table == 'Incident':
                return "title ILIKE %s"
            elif table == 'Case':
                return "title ILIKE %s"
            elif table == 'AuditLog':
                return "action ILIKE %s"
            elif table == 'SecurityLog':
                return '"eventType" ILIKE %s'
            elif table == 'ComplianceCheck':
                return "framework ILIKE %s"
            elif table == 'Evidence':
                return '"fileName" ILIKE %s'
            elif table == 'ChatSession':
                return "title ILIKE %s"
            else:
                return "1=0"

        elif field == 'status':
            params.append(val.lower())
            if table in ('ThreatEvent', 'Incident', 'Case', 'ComplianceCheck'):
                return "LOWER(status) = %s"
            else:
                return "1=0"

        elif field == 'mitre':
            params.append(f"%{val}%")
            if table == 'ThreatEvent':
                params.append(f"%{val}%")
                return '("rawPayload" ILIKE %s OR description ILIKE %s)'
            elif table in ('Incident', 'Case'):
                params.append(f"%{val}%")
                return '(title ILIKE %s OR description ILIKE %s)'
            else:
                return "1=0"

        elif field in ('country', 'ioc'):
            raise ValueError("Country and IOC enrichment filters unavailable until real providers are integrated")

        elif field == 'date':
            match_num = re.search(r'\d+', val)
            num = int(match_num.group(0)) if match_num else 7
            if 'h' in val.lower():
                return f'"createdAt" >= NOW() - INTERVAL \'{num} hours\''
            else:
                return f'"createdAt" >= NOW() - INTERVAL \'{num} days\''

        else:
            return "1=0"

    elif isinstance(node, TextCondition):
        val = node.value
        if not val:
            return "1=1"
        params.append(f"%{val}%")
        if table == 'ThreatEvent':
            params.append(f"%{val}%")
            return '(description ILIKE %s OR "rawPayload" ILIKE %s)'
        elif table == 'Incident':
            params.append(f"%{val}%")
            return '(title ILIKE %s OR description ILIKE %s)'
        elif table == 'Case':
            params.append(f"%{val}%")
            return '(title ILIKE %s OR description ILIKE %s)'
        elif table == 'AuditLog':
            return "action ILIKE %s"
        elif table == 'SecurityLog':
            return '"eventType" ILIKE %s'
        elif table == 'ComplianceCheck':
            return "framework ILIKE %s"
        elif table == 'Evidence':
            return '"fileName" ILIKE %s'
        elif table == 'ChatSession':
            return "title ILIKE %s"
        else:
            return "1=0"

    elif isinstance(node, AndCondition):
        left_sql = compile_node_to_sql(node.left, table, params)
        right_sql = compile_node_to_sql(node.right, table, params)
        return f"({left_sql} AND {right_sql})"

    elif isinstance(node, OrCondition):
        left_sql = compile_node_to_sql(node.left, table, params)
        right_sql = compile_node_to_sql(node.right, table, params)
        return f"({left_sql} OR {right_sql})"

    elif isinstance(node, NotCondition):
        operand_sql = compile_node_to_sql(node.operand, table, params)
        return f"(NOT ({operand_sql}))"

    return "1=1"

# --- Deterministic Country Geolocator for Python UI mapping ---
def get_ip_country(ip: str) -> str:
    from ipaddress import ip_address
    try:
        address = ip_address(ip)
        return "Internal" if address.is_private else "Unknown"
    except ValueError:
        return "Unknown"

# --- Core Hunt Search execution ---
def execute_aql_hunt(
    organization_id: str,
    query_str: str,
    sources: Optional[List[str]] = None,
    limit: int = 50,
    offset: int = 0
) -> Tuple[List[Dict[str, Any]], int]:
    # Check Cache
    cache_key = f"{organization_id}_{query_str}_{str(sources)}_{limit}_{offset}"
    cached = hunt_cache.get(cache_key)
    if cached:
        return cached

    # Tokenize and parse query
    tokens = tokenize(query_str)
    parser = AQLParser(tokens)
    ast = parser.parse()

    # Determine which sources to query
    all_supported_sources = {
        'ThreatEvent': 'SELECT id, \'ThreatEvent\' AS type, description AS title, "rawPayload" AS info, severity, status, "sourceIp" AS ip, "createdAt" AS created_at FROM "ThreatEvent" WHERE "organizationId" = %s',
        'Incident': 'SELECT id, \'Incident\' AS type, title, description AS info, severity, status, \'\' AS ip, "createdAt" AS created_at FROM "Incident" WHERE "organizationId" = %s',
        'Case': 'SELECT id, \'Case\' AS type, title, description AS info, severity, status, \'\' AS ip, "createdAt" AS created_at FROM "Case" WHERE "organizationId" = %s',
        'AuditLog': 'SELECT id, \'AuditLog\' AS type, action AS title, "userEmail" AS info, \'INFO\' AS severity, \'N/A\' AS status, \'\' AS ip, "createdAt" AS created_at FROM "AuditLog" WHERE "organizationId" = %s',
        'SecurityLog': 'SELECT id, \'SecurityLog\' AS type, "eventType" AS title, COALESCE("userEmail", \'\') AS info, \'INFO\' AS severity, \'N/A\' AS status, COALESCE("ipAddress", \'\') AS ip, "createdAt" AS created_at FROM "SecurityLog" WHERE "organizationId" = %s',
        'ComplianceCheck': 'SELECT id, \'ComplianceCheck\' AS type, framework AS title, description AS info, \'INFO\' AS severity, status, \'\' AS ip, "createdAt" AS created_at FROM "ComplianceCheck" WHERE "organizationId" = %s',
        'Evidence': 'SELECT id, \'Evidence\' AS type, "fileName" AS title, "fileType" AS info, \'INFO\' AS severity, \'N/A\' AS status, \'\' AS ip, "createdAt" AS created_at FROM "Evidence" WHERE "organizationId" = %s',
        'ChatSession': 'SELECT id, \'ChatSession\' AS type, title, \'Chat Session\' AS info, \'INFO\' AS severity, \'N/A\' AS status, \'\' AS ip, "createdAt" AS created_at FROM "ChatSession" WHERE "organizationId" = %s',
        'IOC': 'SELECT id, \'IOC\' AS type, description AS title, "rawPayload" AS info, severity, status, "sourceIp" AS ip, "createdAt" AS created_at FROM "ThreatEvent" WHERE "organizationId" = %s AND severity IN (\'CRITICAL\', \'HIGH\')',
        'ThreatIntelMatch': 'SELECT id, \'ThreatIntelMatch\' AS type, description AS title, "rawPayload" AS info, severity, status, "sourceIp" AS ip, "createdAt" AS created_at FROM "ThreatEvent" WHERE "organizationId" = %s AND severity != \'INFO\''
    }

    active_sources = []
    if sources and 'all' not in [s.lower() for s in sources]:
        for src in sources:
            # Match case-insensitively
            matched_key = None
            for key in all_supported_sources.keys():
                if key.lower() == src.lower() or (src.lower() == 'chat sessions' and key == 'ChatSession') or (src.lower() == 'threat intelligence matches' and key == 'ThreatIntelMatch'):
                    matched_key = key
                    break
            if matched_key:
                active_sources.append(matched_key)
    else:
        active_sources = list(all_supported_sources.keys())

    if not active_sources:
        return [], 0

    # Build UNION subqueries
    subqueries = []
    sql_params = []
    
    for src in active_sources:
        base_query = all_supported_sources[src]
        
        # Inject org ID
        sql_params.append(organization_id)
        
        # Compile filters
        table_params = []
        table_filter_sql = compile_node_to_sql(ast, src, table_params)
        
        full_subquery = f"{base_query} AND ({table_filter_sql})"
        subqueries.append(full_subquery)
        sql_params.extend(table_params)

    # 1. First get total count
    count_query = f"SELECT COUNT(*) FROM ({' UNION ALL '.join(subqueries)}) AS count_union"
    
    # 2. Get paginated results
    results_query = f"""
        SELECT id, type, title, info, severity, status, ip, created_at 
        FROM ({' UNION ALL '.join(subqueries)}) AS union_results 
        ORDER BY created_at DESC 
        LIMIT %s OFFSET %s
    """
    
    # Bind limit and offset
    results_params = list(sql_params)
    results_params.append(limit)
    results_params.append(offset)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Execute Count
            cursor.execute(count_query, sql_params)
            total_count = cursor.fetchone()[0]

            # Execute Paginated Results
            cursor.execute(results_query, results_params)
            rows = cursor.fetchall()
            
            results = []
            for r in rows:
                ip = r[6]
                country = get_ip_country(ip) if ip else "N/A"
                results.append({
                    "id": r[0],
                    "type": r[1],
                    "title": r[2],
                    "info": r[3],
                    "severity": r[4],
                    "status": r[5],
                    "ip": ip or "N/A",
                    "country": country,
                    "createdAt": r[7].isoformat() if r[7] else None
                })
            
            res_tuple = (results, total_count)
            hunt_cache.set(cache_key, res_tuple)
            return res_tuple

    except Exception as e:
        logger.error(f"Database search execution failure: {e}", exc_info=True)
        return [], 0
    finally:
        conn.close()
