from app.detection import detect_threat

def test_bruteforce_examples():
    # Example patterns from instructions
    assert detect_threat("Failed login")["detected"] is True
    assert detect_threat("Invalid password")["detected"] is True
    assert detect_threat("Authentication failed")["detected"] is True
    assert detect_threat("Login attempt failed")["detected"] is True
    
    # Case insensitivity checks
    assert detect_threat("failed login")["detected"] is True
    assert detect_threat("invalid password")["detected"] is True

    # Result detail validation
    res = detect_threat("Authentication failed for user user1")
    assert res["detected"] is True
    assert res["attack_type"] == "BRUTE_FORCE"
    assert res["severity"] == "MEDIUM"
