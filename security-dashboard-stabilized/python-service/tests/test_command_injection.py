from app.detection import detect_threat

def test_command_injection_examples():
    # Example patterns from instructions
    assert detect_threat("&& whoami")["detected"] is True
    assert detect_threat("; cat /etc/passwd")["detected"] is True
    assert detect_threat("| bash")["detected"] is True
    
    # Result detail validation
    res = detect_threat("ping 127.0.0.1 && whoami")
    assert res["detected"] is True
    assert res["attack_type"] == "COMMAND_INJECTION"
    assert res["severity"] == "CRITICAL"
