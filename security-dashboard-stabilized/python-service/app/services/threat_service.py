import uuid
import hashlib
from typing import Optional
from datetime import datetime
import os
from app.database import get_db_connection
from app.detection import detect_threat

def trigger_system_alerts(org_id: str, alert_type: str, message: str, cursor) -> None:
    # 1. Create In-App NotificationLog
    cursor.execute(
        'INSERT INTO "NotificationLog" (id, "organizationId", type, channel, message, status, read, "createdAt") '
        'VALUES (%s, %s, %s, %s, %s, %s, FALSE, NOW())',
        (str(uuid.uuid4()), org_id, alert_type, "in_app", message, "sent")
    )
    
    # External channels are deliberately unavailable until an outbox worker
    # provides retry-safe delivery after commit.
    for channel in ("email", "slack"):
        cursor.execute(
            'INSERT INTO "NotificationLog" (id, "organizationId", type, channel, message, status, read, "createdAt") '
            'VALUES (%s, %s, %s, %s, %s, %s, FALSE, NOW())',
            (str(uuid.uuid4()), org_id, alert_type, channel, message, "unavailable"))

def _publish_event(event_type: str, data: dict):
    try:
        from app.realtime import event_publisher
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(event_publisher.publish(event_type, data))
        else:
            asyncio.run(event_publisher.publish(event_type, data))
    except Exception as e:
        print(f"Failed to publish realtime event {event_type}: {str(e)}")

def process_threat_log(source: str, ip: str, message: str, api_key: Optional[str] = None, source_event_id: Optional[str] = None,
                       event_time=None, is_simulated: bool = False) -> dict:
    # 1. Run detection
    result = detect_threat(message)
    detected = result["detected"]
    attack_type = result["attack_type"]
    severity = result["severity"]
    
    incident_created = False
    trace_id = str(uuid.uuid4())
    raw_hash = hashlib.sha256(message.encode("utf-8")).hexdigest()
    
    # If not detected, categorise as clean log
    if not detected:
        attack_type = "CLEAN"
        severity = "INFO"
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            org_id = None
            log_source_name = source

            # Step A: Resolve by API Key if provided
            if api_key:
                cursor.execute(
                    'SELECT "organizationId", "name" FROM "LogSource" WHERE "apiKey" = %s LIMIT 1',
                    (api_key,)
                )
                row = cursor.fetchone()


                if row:
                    org_id = row[0]
                    log_source_name = row[1]

            # If org_id is unresolved to enforce isolation
            if not org_id:
                raise ValueError("Unauthorized: Invalid log source API key mapping")

            # Ensure the resolved LogSource is registered under the correct organization, auto-create if missing
            cursor.execute(
                'SELECT "id" FROM "LogSource" WHERE "organizationId" = %s AND "name" = %s LIMIT 1', 
                (org_id, log_source_name)
            )
            ls_row = cursor.fetchone()
            if not ls_row:
                new_ls_id = str(uuid.uuid4())
                new_api_key = api_key if api_key else f"ls_key_auto_{log_source_name}_{uuid.uuid4().hex[:6]}"
                
                # Ensure API key uniqueness in database
                cursor.execute('SELECT "id" FROM "LogSource" WHERE "apiKey" = %s LIMIT 1', (new_api_key,))
                if cursor.fetchone():
                    new_api_key = f"ls_key_auto_{log_source_name}_{uuid.uuid4().hex[:6]}"

                cursor.execute(
                    'INSERT INTO "LogSource" (id, "organizationId", name, "apiKey", "createdAt") VALUES (%s, %s, %s, %s, NOW())',
                    (new_ls_id, org_id, log_source_name, new_api_key)
                )

            # Serialize concurrent retries for this source event ID. Identical logs
            # with different IDs remain distinct observations.
            if source_event_id:
                identity = f"{org_id}:{log_source_name}:{source_event_id}"
                cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (identity,))
                cursor.execute(
                    'SELECT id, "traceId", "rawHash", severity, description, "incidentId", "sourceIp", "isSimulated" '
                    'FROM "ThreatEvent" WHERE "organizationId"=%s AND target=%s AND "sourceEventId"=%s',
                    (org_id, log_source_name, source_event_id))
                previous = cursor.fetchone()
                if previous:
                    if previous[2] != raw_hash or previous[6] != ip or previous[7] != is_simulated:
                        raise ValueError("Event ID already used with a different payload")
                    conn.commit()
                    return {"detected": previous[4] != "CLEAN", "attack_type": previous[4],
                            "severity": previous[3], "incident_created": False,
                            "trace_id": previous[1], "event_id": previous[0], "duplicate": True}

            incident_id = None
            title = ""
            desc = ""
            if detected and severity in ("HIGH", "CRITICAL"):
                incident_id = str(uuid.uuid4())
                title = f"Incident: {attack_type} target {log_source_name} severity {severity}"
                desc = f"Auto-generated incident for detected {attack_type} threat against {log_source_name}."
                cursor.execute(
                    'INSERT INTO "Incident" (id, "organizationId", title, description, severity, status, "assignedTo", "createdAt", "updatedAt") VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())',
                    (incident_id, org_id, title, desc, severity, "open", "Unassigned")
                )
                
                # Create initial activity log entry for the incident
                activity_id = str(uuid.uuid4())
                cursor.execute(
                    'INSERT INTO "IncidentActivityLog" (id, "organizationId", "incidentId", "activityType", description, "createdAt") VALUES (%s, %s, %s, %s, %s, NOW())',
                    (activity_id, org_id, incident_id, "created", "Incident automatically created from threat event.")
                )
                
                # Trigger Slack/Email/In-App alerting center notifications
                trigger_system_alerts(org_id, "incident_created", title, cursor)
                incident_created = True

            # 3. Insert ThreatEvent under correct organizationId (linked to Incident if created)
            threat_id = str(uuid.uuid4())
            cursor.execute(
                'INSERT INTO "ThreatEvent" (id, "organizationId", "sourceIp", target, severity, description, "rawPayload", status, "assignedTo", "aiSummary", "incidentId", "traceId", "rawHash", "sourceEventId", "eventTime", "isSimulated", "createdAt") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())',
                (threat_id, org_id, ip, log_source_name, severity, attack_type, message, "Clean" if not detected else "New", "Unassigned", None, incident_id, trace_id, raw_hash, source_event_id, event_time, is_simulated)
            )
            
            # 3.5 Execute SOAR playbooks inside transaction
            threat_event_obj = {
                "id": threat_id,
                "organizationId": org_id,
                "sourceIp": ip,
                "target": log_source_name,
                "severity": severity,
                "description": attack_type,
                "rawPayload": message,
                "status": "Clean" if not detected else "New",
                "assignedTo": "Unassigned",
                "incidentId": incident_id
            }
            try:
                from app.services.automation_service import execute_playbooks
                execute_playbooks(threat_event_obj, cursor)
            except Exception as soar_err:
                print(f"SOAR execution failure: {str(soar_err)}")

            conn.commit()

            # 4. Stream real-time events upon successful commit
            threat_payload = {
                "id": threat_id,
                "organizationId": org_id,
                "sourceIp": ip,
                "target": log_source_name,
                "severity": threat_event_obj["severity"],
                "description": attack_type,
                "rawPayload": message,
                "status": "Clean" if not detected else "New",
                "assignedTo": "Unassigned",
                "incidentId": threat_event_obj["incidentId"],
                "createdAt": datetime.now().isoformat()
            }
            _publish_event("threat", threat_payload)

            # Check if incident was created heuristically or by SOAR playbook
            final_incident_created = incident_created or (threat_event_obj["incidentId"] is not None and incident_id is None)
            final_incident_id = threat_event_obj["incidentId"]

            if final_incident_created and final_incident_id:
                incident_payload = {
                    "id": final_incident_id,
                    "organizationId": org_id,
                    "title": title if title else f"SOAR: {attack_type} detection",
                    "description": desc if desc else "Incident created automatically.",
                    "severity": threat_event_obj["severity"],
                    "status": "open",
                    "assignedTo": "Unassigned",
                    "createdAt": datetime.now().isoformat(),
                    "updatedAt": datetime.now().isoformat()
                }
                _publish_event("incident", incident_payload)

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    return {
        "detected": detected,
        "attack_type": attack_type,
        "severity": threat_event_obj["severity"],
        "trace_id": trace_id,
        "event_id": threat_id,
        "duplicate": False,
        "incident_created": incident_created or (threat_event_obj["incidentId"] is not None)
    }

