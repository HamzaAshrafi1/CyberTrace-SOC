from app.detection import detect_threat

def test_xss_examples():
    # Example patterns from instructions
    assert detect_threat("<script>")["detected"] is True
    assert detect_threat("javascript:")["detected"] is True
    assert detect_threat("onerror=")["detected"] is True
    
    # Case insensitivity checks
    assert detect_threat("<SCRIPT>")["detected"] is True
    assert detect_threat("JAVASCRIPT:")["detected"] is True
    assert detect_threat("ONERROR=")["detected"] is True

    # Result detail validation
    res = detect_threat('<img src="x" onerror="alert(1)">')
    assert res["detected"] is True
    assert res["attack_type"] == "XSS"
    assert res["severity"] == "HIGH"
