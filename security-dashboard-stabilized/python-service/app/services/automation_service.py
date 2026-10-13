import os
import json
import uuid
import logging
import requests
from typing import Dict, Any, List

logger = logging.getLogger("aegis-soar")

def evaluate_condition_node(node: dict, threat_event: dict) -> bool:
    """Evaluates simple conditions on a ThreatEvent (e.g. severity match)."""
    data = node.get("data", {})
    field = data.get("field", "severity")
    value = data.get("value", "CRITICAL")
    
    actual_value = threat_event.get(field, "")
    if isinstance(actual_value, str):
        return actual_value.upper() == str(value).upper()
    return str(actual_value) == str(value)

def execute_playbooks(threat_event: dict, cursor) -> None:
    """
    Locates matching Playbooks for the ThreatEvent, executes their workflow graphs,
    performs automated SOAR actions (tenant-isolated), and logs executions.
    """
    org_id = threat_event.get("organizationId")
    if not org_id:
        logger.warning("SOAR execution skipped: ThreatEvent missing organizationId.")
        return

    # 1. Fetch active playbooks for organization
    try:
        cursor.execute(
            'SELECT id, name, description, enabled, "triggerType", conditions, actions '
            'FROM "Playbook" WHERE "organizationId" = %s AND enabled = TRUE',
            (org_id,)
        )
        playbook_rows = cursor.fetchall()
    except Exception as e:
        logger.error(f"Failed to query playbooks: {str(e)}")
        return

    for p_id, p_name, p_desc, p_enabled, p_trigger_type, p_conditions, p_actions in playbook_rows:
        # 2. Check trigger type matching
        if p_trigger_type != "threat_detected":
            continue

        # Parse conditions and actions JSON if returned as string
        conditions = json.loads(p_conditions) if isinstance(p_conditions, str) else (p_conditions or {})
        actions = json.loads(p_actions) if isinstance(p_actions, str) else (p_actions or {})

        # 3. Check simple trigger conditions
        matched = True
        for key, val_list in conditions.items():
            actual = threat_event.get(key)
            if not actual:
                matched = False
                break
            # Handle list or singular value matching
            if isinstance(val_list, list):
                if actual not in val_list:
                    matched = False
                    break
            else:
                if str(actual).upper() != str(val_list).upper():
                    matched = False
                    break

        if not matched:
            continue

        # 4. Initialize Execution Log
        execution_id = str(uuid.uuid4())
        logger.info(f"Triggered SOAR Playbook '{p_name}' ({p_id}) for event {threat_event['id']}.")
        
        # Parse graph actions & evaluate flow
        actions_to_run = []
        
        if isinstance(actions, dict) and "nodes" in actions:
            # Graph-based execution from React Flow JSON
            nodes_map = {n["id"]: n for n in actions.get("nodes", [])}
            edges = actions.get("edges", [])
            
            # Find trigger node(s)
            current_nodes = [n for n in actions.get("nodes", []) if n.get("type") == "trigger"]
            if not current_nodes:
                # If no trigger node, process all action nodes
                current_nodes = [n for n in actions.get("nodes", []) if n.get("type") == "action"]
                
            visited = set()
            while current_nodes:
                node = current_nodes.pop(0)
                node_id = node["id"]
                if node_id in visited:
                    continue
                visited.add(node_id)
                
                if node.get("type") == "action":
                    action_type = node.get("data", {}).get("actionType")
                    config = node.get("data", {}).get("config", {})
                    if action_type:
                        actions_to_run.append((action_type, config))
                    
                    # Traverse next nodes
                    next_ids = [e["target"] for e in edges if e["source"] == node_id]
                    for nid in next_ids:
                        if nid in nodes_map:
                            current_nodes.append(nodes_map[nid])
                elif node.get("type") == "condition":
                    cond_eval = evaluate_condition_node(node, threat_event)
                    handle = "true" if cond_eval else "false"
                    next_ids = [e["target"] for e in edges if e["source"] == node_id and e.get("sourceHandle") == handle]
                    for nid in next_ids:
                        if nid in nodes_map:
                            current_nodes.append(nodes_map[nid])
                else: # trigger node
                    next_ids = [e["target"] for e in edges if e["source"] == node_id]
                    for nid in next_ids:
                        if nid in nodes_map:
                            current_nodes.append(nodes_map[nid])
        elif isinstance(actions, list):
            # Sequential actions list fallback
            for act in actions:
                action_type = act.get("type")
                config = act.get("config", {})
                if action_type:
                    actions_to_run.append((action_type, config))

        # 5. Run Actions sequentially with safety limits and try/catch blocks
        exec_logs = []
        exec_status = "success"
        
        for action_type, config in actions_to_run:
            cursor.execute("SAVEPOINT soar_action")
            try:
                exec_logs.append(f"Running action: {action_type}")
                
                if action_type in {"SEND_EMAIL", "SEND_SLACK_WEBHOOK", "BLOCK_IP"}:
                    raise ValueError("External action disabled until approval and outbox are implemented")

                if action_type == "CREATE_INCIDENT":
                    if threat_event.get("incidentId"):
                        exec_logs.append("Existing incident reused.")
                        continue
                    incident_id = str(uuid.uuid4())
                    title = f"SOAR: {threat_event['description']} detection"
                    desc = f"Auto-generated by playbook '{p_name}' for threat event {threat_event['id']}."
                    cursor.execute(
                        'INSERT INTO "Incident" (id, "organizationId", title, description, severity, status, "assignedTo", "createdAt", "updatedAt") '
                        'VALUES (%s, %s, %s, %s, %s, \'open\', \'Unassigned\', NOW(), NOW())',
                        (incident_id, org_id, title, desc, threat_event["severity"])
                    )
                    # Bind incident back to threat event
                    cursor.execute(
                        'UPDATE "ThreatEvent" SET "incidentId" = %s WHERE id = %s',
                        (incident_id, threat_event["id"])
                    )
                    threat_event["incidentId"] = incident_id
                    
                    cursor.execute(
                        'INSERT INTO "IncidentActivityLog" (id, "organizationId", "incidentId", "activityType", description, "createdAt") '
                        'VALUES (%s, %s, %s, \'created\', \'Incident automatically created by SOAR playbook.\', NOW())',
                        (str(uuid.uuid4()), org_id, incident_id)
                    )
                    exec_logs.append(f"Incident {incident_id} created.")
                    
                elif action_type == "CREATE_CASE":
                    case_id = str(uuid.uuid4())
                    title = f"SOAR Case: {threat_event['description']}"
                    desc = f"Investigate clustered threat events. Created by playbook '{p_name}'."
                    cursor.execute(
                        'INSERT INTO "Case" (id, "organizationId", title, description, status, severity, "assignedTo", "createdAt", "updatedAt") '
                        'VALUES (%s, %s, %s, %s, \'open\', %s, \'Unassigned\', NOW(), NOW())',
                        (case_id, org_id, title, desc, threat_event["severity"])
                    )
                    
                    # If threat has an incident linked, link it to the case
                    if threat_event.get("incidentId"):
                        cursor.execute(
                            'UPDATE "Incident" SET "caseId" = %s WHERE id = %s',
                            (case_id, threat_event["incidentId"])
                        )
                    exec_logs.append(f"Case {case_id} created.")
                    
                elif action_type == "ASSIGN_ANALYST":
                    analyst = config.get("analystName", "SOAR Automation Bot")
                    if threat_event.get("incidentId"):
                        cursor.execute(
                            'UPDATE "Incident" SET "assignedTo" = %s WHERE id = %s',
                            (analyst, threat_event["incidentId"])
                        )
                        cursor.execute(
                            'INSERT INTO "IncidentActivityLog" (id, "organizationId", "incidentId", "activityType", description, "createdAt") '
                            'VALUES (%s, %s, %s, \'assigned\', %s, NOW())',
                            (str(uuid.uuid4()), org_id, threat_event["incidentId"], f"Assigned to {analyst} by playbook.")
                        )
                        exec_logs.append(f"Incident assigned to {analyst}.")
                    else:
                        exec_logs.append("No active incident linked to assign analyst to.")
                        
                elif action_type == "SEND_NOTIFICATION":
                    msg = f"SOAR: '{p_name}' match - {threat_event['description']}"
                    cursor.execute(
                        'INSERT INTO "NotificationLog" (id, "organizationId", type, channel, message, status, read, "createdAt") '
                        'VALUES (%s, %s, \'critical_threat\', \'in_app\', %s, \'sent\', FALSE, NOW())',
                        (str(uuid.uuid4()), org_id, msg)
                    )
                    exec_logs.append("In-app notification sent.")
                    
                elif action_type == "SEND_EMAIL":
                    msg = f"[EMAIL] SOAR Security Advisory: playbook '{p_name}' triggered by {threat_event['sourceIp']}."
                    cursor.execute(
                        'INSERT INTO "NotificationLog" (id, "organizationId", type, channel, message, status, read, "createdAt") '
                        'VALUES (%s, %s, \'critical_threat\', \'email\', %s, \'sent\', FALSE, NOW())',
                        (str(uuid.uuid4()), org_id, msg)
                    )
                    exec_logs.append("Email notification sent to queue.")
                    
                elif action_type == "SEND_SLACK_WEBHOOK":
                    cursor.execute('SELECT "slackWebhookUrl" FROM "Organization" WHERE id = %s', (org_id,))
                    org_row = cursor.fetchone()
                    slack_url = org_row[0] if org_row else None
                    
                    if slack_url:
                        payload = {"text": f"🚨 *SOAR PLAYBOOK TRIGGERED*: `{p_name}`\n*Threat Details*: {threat_event['description']}\n*Source IP*: {threat_event['sourceIp']}\n*Severity*: {threat_event['severity']}"}
                        try:
                            response = requests.post(slack_url, json=payload, timeout=2.0)
                            if response.status_code == 200:
                                exec_logs.append("Slack message dispatched successfully.")
                            else:
                                exec_logs.append(f"Slack webhook returned status code {response.status_code}.")
                        except Exception as se:
                            exec_logs.append(f"Slack webhook HTTP failure: {str(se)}")
                    else:
                        exec_logs.append("Slack Webhook not configured in settings. Skipping.")
                        
                elif action_type == "CHANGE_SEVERITY":
                    new_sev = config.get("severity", "CRITICAL")
                    cursor.execute(
                        'UPDATE "ThreatEvent" SET severity = %s WHERE id = %s',
                        (new_sev, threat_event["id"])
                    )
                    threat_event["severity"] = new_sev
                    exec_logs.append(f"ThreatEvent severity changed to {new_sev}.")
                    
                elif action_type == "ADD_COMMENT":
                    comment = config.get("commentText", "Automated SOAR playbook assessment completed.")
                    if threat_event.get("incidentId"):
                        cursor.execute(
                            'INSERT INTO "IncidentComment" (id, "organizationId", "incidentId", "userName", content, "createdAt") '
                            'VALUES (%s, %s, %s, \'SOAR Bot\', %s, NOW())',
                            (str(uuid.uuid4()), org_id, threat_event["incidentId"], comment)
                        )
                        exec_logs.append("Incident comment added.")
                    else:
                        exec_logs.append("No active incident linked to attach comment.")
                        
                elif action_type == "CREATE_AUDIT_LOG":
                    metadata = {"threatEventId": threat_event["id"], "playbookId": p_id}
                    cursor.execute(
                        'INSERT INTO "AuditLog" (id, "organizationId", "userEmail", action, metadata, "createdAt") '
                        'VALUES (%s, %s, \'soar-automation@aegis-soc.local\', \'SOAR_PLAYBOOK_EXECUTED\', %s, NOW())',
                        (str(uuid.uuid4()), org_id, json.dumps(metadata))
                    )
                    exec_logs.append("Audit log saved.")
                    
                else:
                    raise ValueError(f"Unsupported action: {action_type}")

            except Exception as action_err:
                cursor.execute("ROLLBACK TO SAVEPOINT soar_action")
                exec_status = "partial" if exec_status == "success" else exec_status
                exec_logs.append(f"Action '{action_type}' failed: {str(action_err)}")
                logger.error(f"Action '{action_type}' failed in playbook '{p_name}': {str(action_err)}")

        # Write execution completion log
        try:
            status_text = "success" if exec_status == "success" else "failed"
            cursor.execute(
                'INSERT INTO "AutomationExecution" (id, "organizationId", "playbookId", "eventId", status, message, "startedAt", "completedAt", "createdAt") '
                'VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW(), NOW())',
                (execution_id, org_id, p_id, threat_event["id"], status_text, "\n".join(exec_logs))
            )
        except Exception as log_err:
            logger.error(f"Failed to record playbook execution log in DB: {str(log_err)}")
