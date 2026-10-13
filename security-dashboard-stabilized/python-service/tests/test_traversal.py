from app.detection import detect_threat

def test_traversal_examples():
    # Example patterns from instructions
    assert detect_threat("../")["detected"] is True
    assert detect_threat("../../")["detected"] is True
    assert detect_threat("/etc/passwd")["detected"] is True
    
    # Result detail validation
    res = detect_threat("GET /v1/download?file=../../../etc/passwd HTTP/1.1")
    assert res["detected"] is True
    assert res["attack_type"] == "DIRECTORY_TRAVERSAL"
    assert res["severity"] == "HIGH"
