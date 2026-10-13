from app.detection import detect_threat

def test_sql_injection_examples():
    # Example patterns from instructions
    assert detect_threat("' OR '1'='1")["detected"] is True
    assert detect_threat("UNION SELECT")["detected"] is True
    assert detect_threat("DROP TABLE")["detected"] is True
    assert detect_threat("information_schema")["detected"] is True
    
    # Case insensitivity checks
    assert detect_threat("union select")["detected"] is True
    assert detect_threat("drop table")["detected"] is True
    assert detect_threat("' or '1'='1")["detected"] is True

    # Result detail validation
    res = detect_threat("admin' OR '1'='1")
    assert res["detected"] is True
    assert res["attack_type"] == "SQL_INJECTION"
    assert res["severity"] == "HIGH"
