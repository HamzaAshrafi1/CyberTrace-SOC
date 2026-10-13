import pytest
from unittest.mock import MagicMock, patch
import json
from app.services.automation_service import evaluate_condition_node, execute_playbooks

def test_evaluate_condition_node():
    # Scenario A: Condition matches ThreatEvent severity
    node_match = {
        "id": "node-cond-1",
        "type": "condition",
        "data": {
            "field": "severity",
            "value": "CRITICAL"
        }
    }
    threat_crit = {"severity": "CRITICAL"}
    assert evaluate_condition_node(node_match, threat_crit) is True

    # Scenario B: Condition does not match
    threat_low = {"severity": "LOW"}
    assert evaluate_condition_node(node_match, threat_low) is False

@patch("app.services.automation_service.requests.post")
def test_execute_playbooks_incident_and_slack(mock_post):
    # Mock Slack API response
    mock_post.return_value.status_code = 200

    # 1. Setup mock cursor
    mock_cursor = MagicMock()
    
    # 2. Setup mock playbook registry data from database
    playbook_id = "pb-uuid-123"
    playbook_name = "Critical SQLi Automation"
    playbook_conditions = {"severity": ["CRITICAL"]}
    
    # React Flow Actions config containing Trigger -> Condition -> Action:CREATE_INCIDENT & SEND_SLACK_WEBHOOK
    playbook_actions = {
        "nodes": [
            {
                "id": "n1",
                "type": "trigger",
                "data": {"label": "Trigger"}
            },
            {
                "id": "n2",
                "type": "condition",
                "data": {"field": "severity", "value": "CRITICAL"}
            },
            {
                "id": "n3",
                "type": "action",
                "data": {"actionType": "CREATE_INCIDENT"}
            },
            {
                "id": "n4",
                "type": "action",
                "data": {"actionType": "SEND_SLACK_WEBHOOK"}
            }
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3", "sourceHandle": "true"},
            {"source": "n2", "target": "n4", "sourceHandle": "true"}
        ]
    }

    mock_cursor.fetchall.return_value = [
        (
            playbook_id,
            playbook_name,
            "Critical threat play",
            True,
            "threat_detected",
            json.dumps(playbook_conditions),
            json.dumps(playbook_actions)
        )
    ]

    # Setup organization slack webhook lookup query
    mock_cursor.fetchone.return_value = ("https://mock-slack.local/webhook",)

    # 3. Create sample ThreatEvent
    threat_event = {
        "id": "threat-uuid-999",
        "organizationId": "org-uuid-888",
        "sourceIp": "198.51.100.42",
        "target": "k8s-ingress-prod",
        "severity": "CRITICAL",
        "description": "SQL_INJECTION",
        "rawPayload": "SELECT * FROM admin",
        "status": "New",
        "assignedTo": "Unassigned",
        "incidentId": None
    }

    # 4. Trigger SOAR execution
    execute_playbooks(threat_event, mock_cursor)

    # 5. Assertions:
    # A. Verifies playbooks fetch was queried
    mock_cursor.execute.assert_any_call(
        'SELECT id, name, description, enabled, "triggerType", conditions, actions FROM "Playbook" WHERE "organizationId" = %s AND enabled = TRUE',
        ("org-uuid-888",)
    )

    # B. Verifies CREATE_INCIDENT action ran insert query
    inserted_incident = False
    for call in mock_cursor.execute.call_args_list:
        args = call[0]
        query = args[0]
        if 'INSERT INTO "Incident"' in query:
            inserted_incident = True
            # Check tenant isolation org id parameter
            assert args[1][1] == "org-uuid-888"
            # Check title containing threat description
            assert "SQL_INJECTION" in args[1][2]

    assert inserted_incident is True

    # External actions remain disabled until approvals/outbox exist.
    mock_post.assert_not_called()

    # D. Verifies execution logs were saved
    logged_execution = False
    for call in mock_cursor.execute.call_args_list:
        args = call[0]
        query = args[0]
        if 'INSERT INTO "AutomationExecution"' in query:
            logged_execution = True
            # Verifies success status parameter
            assert args[1][4] == "failed"
            # Verifies message logs lists actions
            assert "Running action: CREATE_INCIDENT" in args[1][5]
            assert "External action disabled" in args[1][5]

    assert logged_execution is True
