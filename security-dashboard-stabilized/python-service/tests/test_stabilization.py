import asyncio
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import MagicMock, patch
from app.service_auth import verify_context, assert_tenant
from app.event_bus import EventPublisher
SECRET = "test-only-" + "x" * 40

def token(permission="read:hunts", exp=1060):
    encoded = base64.urlsafe_b64encode(json.dumps({"tenant": "a", "permission": permission, "exp": exp}).encode()).decode().rstrip("=")
    return encoded, hmac.new(SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()

class ServiceAuthTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"AEGIS_SERVICE_SECRET": SECRET})
        env.start(); self.addCleanup(env.stop)
    def test_valid(self):
        self.assertEqual(verify_context(*token(), "/api/v1/hunt/search", now=1000)["tenant"], "a")
    def test_missing_secret(self):
        with patch.dict(os.environ, {"AEGIS_SERVICE_SECRET": ""}):
            with self.assertRaises(ValueError): verify_context(*token(), "/api/v1/hunt/search", now=1000)
    def test_missing_credentials(self):
        with self.assertRaises(ValueError): verify_context(None, None, "/api/v1/hunt/search", now=1000)
    def test_tamper(self):
        encoded, signature = token()
        with self.assertRaises(ValueError): verify_context(encoded + "A", signature, "/api/v1/hunt/search", now=1000)
    def test_expiry(self):
        with self.assertRaises(ValueError): verify_context(*token(exp=1000), "/api/v1/hunt/search", now=1000)
    def test_lifetime(self):
        with self.assertRaises(ValueError): verify_context(*token(exp=1200), "/api/v1/hunt/search", now=1000)
    def test_permission(self):
        with self.assertRaises(ValueError): verify_context(*token(), "/api/v1/lab/simulate", now=1000)
    def test_tenant(self):
        with self.assertRaises(ValueError): assert_tenant({"tenant": "a"}, "b")
    def test_unknown_route(self):
        with self.assertRaises(ValueError): verify_context(*token(), "/api/v1/unknown", now=1000)

class EventIsolationTests(unittest.IsolatedAsyncioTestCase):
    async def test_isolation(self):
        bus = EventPublisher(); a = bus.subscribe("a"); b = bus.subscribe("b")
        await bus.publish("threat", {"organizationId": "a", "secret": "a-only"})
        self.assertEqual(a.get_nowait()["data"]["secret"], "a-only"); self.assertTrue(b.empty())
    async def test_system_event(self):
        bus = EventPublisher(); queue = bus.subscribe("a")
        await bus.publish("security_log", {"organizationId": None}); self.assertTrue(queue.empty())
    async def test_slow_client(self):
        bus = EventPublisher(); full = bus.subscribe("a"); other = bus.subscribe("b")
        for i in range(256): full.put_nowait(i)
        await asyncio.wait_for(bus.publish("threat", {"organizationId": "a"}), .2)
        await bus.publish("threat", {"organizationId": "b"}); self.assertFalse(other.empty())
    async def test_unsubscribe(self):
        bus = EventPublisher(); queue = bus.subscribe("a"); bus.unsubscribe(queue); self.assertEqual(len(bus.listeners), 0)

class IngestionTests(unittest.TestCase):
    def load_service(self):
        db = types.ModuleType("app.database"); db.get_db_connection = MagicMock()
        path = Path(__file__).parents[1] / "app/services/threat_service.py"
        with patch.dict(sys.modules, {"app.database": db}):
            spec = importlib.util.spec_from_file_location("isolated_threat_service", path)
            service = importlib.util.module_from_spec(spec); spec.loader.exec_module(service)
        return service
    def connection(self, service, rows):
        conn = MagicMock(); cursor = conn.cursor.return_value.__enter__.return_value
        cursor.fetchone.side_effect = rows; service.get_db_connection = MagicMock(return_value=conn)
        return conn, cursor
    def test_retry_without_insert(self):
        service = self.load_service(); message = "<script>alert(1)</script>"
        digest = hashlib.sha256(message.encode()).hexdigest()
        conn, cursor = self.connection(service, [("a", "source"), ("source-id",),
            ("event-1", "trace-1", digest, "HIGH", "XSS", "incident-1", "127.0.0.1", False)])
        result = service.process_threat_log("source", "127.0.0.1", message, "key", source_event_id="id-1")
        self.assertTrue(result["duplicate"]); self.assertEqual(result["trace_id"], "trace-1")
        self.assertFalse(result["incident_created"])
        self.assertFalse(any("INSERT" in call.args[0] for call in cursor.execute.call_args_list))
    def test_conflicting_retry(self):
        service = self.load_service(); conn, cursor = self.connection(service, [("a", "source"), ("source-id",),
            ("event-1", "trace-1", "different", "HIGH", "XSS", None, "127.0.0.1", False)])
        with self.assertRaises(ValueError): service.process_threat_log("source", "127.0.0.1", "new", "key", source_event_id="id-1")
        conn.rollback.assert_called_once()
    def test_unknown_source(self):
        service = self.load_service(); conn, cursor = self.connection(service, [None])
        with self.assertRaises(ValueError): service.process_threat_log("source", "127.0.0.1", "hello", "bad")
        self.assertFalse(any("INSERT" in call.args[0] for call in cursor.execute.call_args_list))
    def test_raw_xss_preserved(self):
        service = self.load_service(); conn, cursor = self.connection(service, [("a", "source"), ("source-id",)])
        service._publish_event = MagicMock()
        automation = types.ModuleType("app.services.automation_service"); automation.execute_playbooks = MagicMock()
        message = "<script>alert(1)</script>"
        with patch.dict(sys.modules, {"app.services.automation_service": automation}):
            result = service.process_threat_log("source", "127.0.0.1", message, "key")
        insert = next(c for c in cursor.execute.call_args_list if 'INSERT INTO "ThreatEvent"' in c.args[0])
        self.assertEqual(insert.args[1][6], message); self.assertTrue(result["detected"])
        self.assertIsNotNone(result["trace_id"]); conn.commit.assert_called_once()

class AutomationTests(unittest.TestCase):
    def load_service(self):
        requests = types.ModuleType("requests"); requests.post = MagicMock()
        path = Path(__file__).parents[1] / "app/services/automation_service.py"
        with patch.dict(sys.modules, {"requests": requests}):
            spec = importlib.util.spec_from_file_location("isolated_automation", path)
            service = importlib.util.module_from_spec(spec); spec.loader.exec_module(service)
        return service
    def test_unsupported_action_is_failure(self):
        service = self.load_service(); cursor = MagicMock()
        cursor.fetchall.return_value = [("p", "test", "", True, "threat_detected", {}, [{"type": "UNKNOWN"}])]
        service.execute_playbooks({"organizationId": "a", "id": "e", "severity": "HIGH"}, cursor)
        log = next(c for c in cursor.execute.call_args_list if 'INSERT INTO "AutomationExecution"' in c.args[0])
        self.assertEqual(log.args[1][4], "failed")
    def test_external_action_disabled(self):
        service = self.load_service(); cursor = MagicMock()
        cursor.fetchall.return_value = [("p", "test", "", True, "threat_detected", {}, [{"type": "SEND_SLACK_WEBHOOK"}])]
        service.execute_playbooks({"organizationId": "a", "id": "e", "severity": "HIGH"}, cursor)
        service.requests.post.assert_not_called()
        log = next(c for c in cursor.execute.call_args_list if 'INSERT INTO "AutomationExecution"' in c.args[0])
        self.assertEqual(log.args[1][4], "failed")

if __name__ == "__main__": unittest.main()
