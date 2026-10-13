import pytest
import uuid
from app.services.simulation_engine import (
    run_attack_simulation, get_simulation_runs, ATTACK_CATALOG
)
from app.database import get_db_connection

# 1. Test Attack Catalog Integrity
def test_attack_catalog_integrity():
    assert "SQL_INJECTION" in ATTACK_CATALOG
    assert "XSS" in ATTACK_CATALOG
    assert "DDOS" in ATTACK_CATALOG
    assert "SSH_BRUTE_FORCE" in ATTACK_CATALOG
    
    sqli = ATTACK_CATALOG["SQL_INJECTION"]
    assert sqli["severity"] == "CRITICAL"
    assert len(sqli["payloads"]) > 0
    assert sqli["source_ip"] == "198.51.100.15"

# 2. Test Invalid Attack Type
def test_invalid_attack_type():
    with pytest.raises(ValueError):
        run_attack_simulation("dummy-org-id", "DUMMY_UNKNOWN_ATTACK")

# 3. Test Simulation Run DB Integration & Tenant Isolation
def test_simulation_run_execution():
    # To run this successfully, we create a test organization
    org_id = str(uuid.uuid4())
    org_name = f"Lab Test Org - {org_id[:8]}"
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Create a mock organization
            cursor.execute(
                'INSERT INTO "Organization" (id, "clerkOrgId", name, "createdAt", "updatedAt") '
                'VALUES (%s, %s, %s, NOW(), NOW())',
                (org_id, f"org_clerk_{org_id[:8]}", org_name)
            )
            # Create a mock API key LogSource
            api_key = f"ls_key_sim_test_{org_id[:6]}"
            cursor.execute(
                'INSERT INTO "LogSource" (id, "organizationId", name, "apiKey", "createdAt") '
                'VALUES (%s, %s, %s, %s, NOW())',
                (str(uuid.uuid4()), org_id, "Simulation Engine", api_key)
            )
            conn.commit()

        # Run attack simulation
        run_data = run_attack_simulation(org_id, "XSS")
        
        # Verify run returned output
        assert run_data["id"] is not None
        assert run_data["attackType"] == "XSS"
        assert run_data["status"] == "Completed"
        assert run_data["eventsGenerated"] == len(ATTACK_CATALOG["XSS"]["payloads"])
        
        # Verify it was inserted in Postgres
        runs = get_simulation_runs(org_id, limit=5)
        assert len(runs) == 1
        assert runs[0]["id"] == run_data["id"]
        assert runs[0]["attackType"] == "XSS"

        # Verify Tenant Isolation: Another organization must NOT see these runs
        other_org_id = str(uuid.uuid4())
        other_runs = get_simulation_runs(other_org_id, limit=5)
        assert len(other_runs) == 0

    finally:
        # Clean up database records
        with conn.cursor() as cursor:
            cursor.execute('DELETE FROM "SimulationRun" WHERE "organizationId" = %s', (org_id,))
            cursor.execute('DELETE FROM "ThreatEvent" WHERE "organizationId" = %s', (org_id,))
            cursor.execute('DELETE FROM "Incident" WHERE "organizationId" = %s', (org_id,))
            cursor.execute('DELETE FROM "LogSource" WHERE "organizationId" = %s', (org_id,))
            cursor.execute('DELETE FROM "Organization" WHERE id = %s', (org_id,))
            conn.commit()
        conn.close()
