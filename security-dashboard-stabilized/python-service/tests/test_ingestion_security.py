import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ingest_missing_api_key():
    # Test request with missing API key in both header and body payload
    response = client.post(
        "/api/v1/ingest",
        json={
            "source": "firewall-1",
            "ip": "192.168.1.1",
            "message": "Normal traffic log"
        }
    )
    assert response.status_code == 401
    assert "Unauthorized" in response.json()["detail"]

@patch("app.main.get_db_connection")
def test_ingest_invalid_api_key(mock_get_db):
    # Mock database to return no matching LogSource for the API key
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_get_db.return_value = mock_conn

    response = client.post(
        "/api/v1/ingest",
        headers={"Authorization": "Bearer invalid_key_123"},
        json={
            "source": "firewall-1",
            "ip": "192.168.1.1",
            "message": "Normal traffic log"
        }
    )
    assert response.status_code == 401
    assert "Unauthorized" in response.json()["detail"]
    # Verify lookup SQL query was executed
    mock_cursor.execute.assert_any_call('SELECT 1 FROM "LogSource" WHERE "apiKey" = %s LIMIT 1', ("invalid_key_123",))

@patch("app.main.get_db_connection")
@patch("app.main.process_threat_log")
def test_ingest_valid_api_key(mock_process, mock_get_db):
    # Mock database to return a match for the API key
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = (1,)  # Represents finding the api key
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_get_db.return_value = mock_conn

    # Mock process_threat_log result
    mock_process.return_value = {
        "detected": False,
        "attack_type": "CLEAN",
        "severity": "INFO",
        "incident_created": False
    }

    response = client.post(
        "/api/v1/ingest",
        headers={"Authorization": "Bearer valid_key_123"},
        json={
            "source": "firewall-1",
            "ip": "192.168.1.1",
            "message": "Normal traffic log"
        }
    )
    assert response.status_code == 200
    assert response.json()["detected"] is False
    assert response.json()["attack_type"] == "CLEAN"

@patch("app.services.threat_service.get_db_connection")
def test_process_threat_log_invalid_mapping(mock_get_db):
    # Mock DB connection for process_threat_log
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    # fetchone returns None, meaning no organizationId is resolved
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_get_db.return_value = mock_conn

    from app.services.threat_service import process_threat_log
    with pytest.raises(ValueError) as excinfo:
        process_threat_log(
            source="firewall-1",
            ip="192.168.1.1",
            message="SQL_INJECTION attempt: SELECT * FROM users",
            api_key="non_existent_key"
        )
    assert "Unauthorized: Invalid log source API key mapping" in str(excinfo.value)
    
    # Ensure insert was never called on the cursor because of early ValueError
    for call in mock_cursor.execute.call_args_list:
        query_str = call[0][0]
        assert "INSERT INTO" not in query_str
