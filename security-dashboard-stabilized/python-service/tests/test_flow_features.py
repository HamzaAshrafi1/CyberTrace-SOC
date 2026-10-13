import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import MagicMock, patch
from app.flow_features import normalize_zeek, FlowValidationError, FEATURE_NAMES

BASE = {"ts": 1791120600.5, "uid": "flow1", "id.orig_h": "192.0.2.10", "id.orig_p": 52000,
        "id.resp_h": "198.51.100.20", "id.resp_p": 443, "proto": "tcp", "duration": 2.5,
        "orig_pkts": 10, "resp_pkts": 8, "orig_ip_bytes": 1000, "resp_ip_bytes": 2400, "missed_bytes": 0}

def raw(**changes):
    return json.dumps({**BASE, **changes})

class FlowFeatureTests(unittest.TestCase):
    def test_expected_features_and_order(self):
        flow = normalize_zeek(raw())
        self.assertEqual(flow["feature_names"], list(FEATURE_NAMES))
        self.assertEqual(flow["feature_vector"], [2.5, 10, 8, 1000, 2400, 18, 3400, 10/18, 6])
        self.assertTrue(flow["feature_valid"])
        self.assertEqual(flow["analysis_status"], "collected")
        self.assertEqual(flow["model_compatibility"], "unvalidated")
    def test_ipv6(self):
        flow = normalize_zeek(raw(**{"id.orig_h": "2001:db8::1", "id.resp_h": "2001:db8::2"}))
        self.assertEqual(flow["orig_ip"], "2001:db8::1")
    def test_zero_duration_retained(self):
        self.assertEqual(normalize_zeek(raw(duration=0))["features"]["duration_s"], 0)
    def test_missing_is_not_zero(self):
        flow = normalize_zeek(raw(resp_pkts=None))
        self.assertIsNone(flow["features"]["resp_pkts"])
        self.assertIsNone(flow["features"]["total_pkts"])
        self.assertFalse(flow["feature_valid"])
        self.assertIn("missing:resp_pkts", flow["quality_flags"])
    def test_content_gap(self):
        self.assertIn("reported_content_gap", normalize_zeek(raw(missed_bytes=4))["quality_flags"])
    def test_missing_gap_metadata(self):
        self.assertIn("missing:missed_bytes", normalize_zeek(raw(missed_bytes=None))["quality_flags"])
    def test_zero_packets_share_undefined(self):
        flow = normalize_zeek(raw(orig_pkts=0, resp_pkts=0))
        self.assertIsNone(flow["features"]["orig_packet_share"])
        self.assertFalse(flow["feature_valid"])
    def test_inconsistent_packet_byte_counts(self):
        flow = normalize_zeek(raw(orig_pkts=0, orig_ip_bytes=100))
        self.assertIn("inconsistent:orig_zero_packets_with_bytes", flow["quality_flags"])
        self.assertFalse(flow["feature_valid"])
    def test_unsupported_protocol(self):
        self.assertFalse(normalize_zeek(raw(proto="unknown"))["feature_valid"])
    def test_negative_number(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(orig_pkts=-1))
    def test_boolean_number(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(orig_pkts=True))
    def test_fractional_count(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(orig_pkts=1.5))
    def test_string_number(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(duration="2.5"))
    def test_nan(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(duration=float("nan")))
    def test_infinity(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(duration=float("inf")))
    def test_invalid_ip(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(**{"id.orig_h": "evil.example"}))
    def test_numeric_ip_rejected(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(**{"id.orig_h": 1234}))
    def test_huge_duration_rejected(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(duration=10**400))
    def test_invalid_port(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(**{"id.orig_p": 70000}))
    def test_duplicate_json_fields(self):
        with self.assertRaises(FlowValidationError): normalize_zeek('{"uid":"a","uid":"b"}')
    def test_non_object(self):
        with self.assertRaises(FlowValidationError): normalize_zeek('[]')
    def test_large_raw_record(self):
        with self.assertRaises(FlowValidationError): normalize_zeek('x'*65537)
    def test_raw_hash_preserves_spaces(self):
        line = raw() + '  '
        self.assertEqual(normalize_zeek(line)["raw_sha256"], hashlib.sha256(line.encode()).hexdigest())
    def test_zero_epoch_and_utc(self):
        self.assertEqual(normalize_zeek(raw(ts=0))["event_time"], "1970-01-01T00:00:00+00:00")
    def test_unknown_fields_not_features(self):
        flow = normalize_zeek(raw(label="attack", organization_id="attacker-choice"))
        self.assertNotIn("label", flow["features"])
        self.assertNotIn("organization_id", flow)
    def test_exact_integer_overflow(self):
        with self.assertRaises(FlowValidationError): normalize_zeek(raw(orig_pkts=2**53))

class FlowStorageTests(unittest.TestCase):
    def setUp(self):
        db = types.ModuleType("app.database"); db.get_db_connection = MagicMock()
        path = Path(__file__).parents[1] / "app/services/flow_service.py"
        with patch.dict(sys.modules, {"app.database": db}):
            spec = importlib.util.spec_from_file_location("isolated_flow_service", path)
            self.service = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.service)
        self.conn = MagicMock(); self.cursor = self.conn.cursor.return_value.__enter__.return_value
        self.service.get_db_connection = MagicMock(return_value=self.conn)
    def test_source_resolves_tenant_and_raw_is_preserved(self):
        self.cursor.fetchone.side_effect = [("source-a", "tenant-a"), None]
        line = raw(organization_id="tenant-b")
        result = self.service.ingest_flow(line, "capture-a", "key")
        query = next(c for c in self.cursor.execute.call_args_list if 'INSERT INTO "FlowRecord"' in c.args[0])
        self.assertEqual(query.args[1][1:3], ("tenant-a", "source-a"))
        self.assertEqual(query.args[1][7], line)
        self.assertEqual(query.args[1][-1], "collected")
        self.assertFalse(result["duplicate"])
    def test_missing_key(self):
        with self.assertRaises(self.service.FlowUnauthorized): self.service.ingest_flow(raw(), "capture", None)
        self.service.get_db_connection.assert_not_called()
    def test_invalid_key_no_insert(self):
        self.cursor.fetchone.return_value = None
        with self.assertRaises(self.service.FlowUnauthorized): self.service.ingest_flow(raw(), "capture", "bad")
        self.assertFalse(any("INSERT" in c.args[0] for c in self.cursor.execute.call_args_list))
        self.conn.rollback.assert_called_once(); self.conn.close.assert_called_once()
    def test_duplicate_returns_existing_trace(self):
        digest = normalize_zeek(raw())["raw_sha256"]
        self.cursor.fetchone.side_effect = [("source-a", "tenant-a"), ("id", "trace", digest, False, "zeek-conn-v1")]
        result = self.service.ingest_flow(raw(), "capture", "key")
        self.assertTrue(result["duplicate"]); self.assertEqual(result["trace_id"], "trace")
        self.assertFalse(any("INSERT" in c.args[0] for c in self.cursor.execute.call_args_list))
    def test_conflicting_record(self):
        self.cursor.fetchone.side_effect = [("source-a", "tenant-a"), ("id", "trace", "old-hash", False, "zeek-conn-v1")]
        with self.assertRaises(self.service.FlowConflict): self.service.ingest_flow(raw(), "capture", "key")
        self.conn.rollback.assert_called_once()
    def test_duplicate_with_changed_simulation_flag(self):
        digest = normalize_zeek(raw())["raw_sha256"]
        self.cursor.fetchone.side_effect = [("source-a", "tenant-a"), ("id", "trace", digest, False, "zeek-conn-v1")]
        with self.assertRaises(self.service.FlowConflict): self.service.ingest_flow(raw(), "capture", "key", True)
    def test_storage_failure_closes_connection(self):
        self.cursor.execute.side_effect = RuntimeError("DB failure")
        with self.assertRaises(RuntimeError): self.service.ingest_flow(raw(), "capture", "key")
        self.conn.rollback.assert_called_once(); self.conn.close.assert_called_once()


class ReplayCliTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).parents[1] / "tools/replay_zeek.py"
        spec = importlib.util.spec_from_file_location("replay_cli", path)
        self.cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.cli)
        self.fixture = Path(__file__).parents[1] / "fixtures/synthetic_conn.jsonl"
    def test_offline_replay(self):
        from contextlib import redirect_stdout, redirect_stderr
        from io import StringIO
        output = StringIO()
        with redirect_stdout(output), redirect_stderr(StringIO()):
            self.assertEqual(self.cli.main([str(self.fixture), "--capture-id", "synthetic", "--simulated"]), 0)
        records = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(len(records), 3)
        self.assertTrue(all(r["is_simulated"] for r in records))
        self.assertEqual([r["feature_valid"] for r in records], [True, True, False])
    def test_remote_http_refused(self):
        from contextlib import redirect_stderr
        from io import StringIO
        with redirect_stderr(StringIO()), self.assertRaises(SystemExit):
            self.cli.main([str(self.fixture), "--capture-id", "x", "--endpoint", "http://example.com/api/v1/flows/ingest"])
    def server(self):
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        import threading
        received = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_POST(self):
                data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                received.append((self.path, self.headers.get("Authorization"), data))
                if self.path == "/redirect":
                    self.send_response(307); self.send_header("Location", "/sink"); self.end_headers()
                else:
                    self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
                    self.wfile.write(b'{"id":"mock-flow","analysis_status":"collected"}')
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        self.addCleanup(server.server_close); self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_port}", received
    def test_http_replay_preserves_evidence(self):
        from contextlib import redirect_stdout, redirect_stderr
        from io import StringIO
        url, received = self.server()
        with patch.dict(self.cli.os.environ, {"AEGIS_LOG_SOURCE_KEY": "test-source-key"}), redirect_stdout(StringIO()), redirect_stderr(StringIO()):
            self.assertEqual(self.cli.main([str(self.fixture), "--capture-id", "synthetic", "--simulated", "--endpoint", url + "/ingest"]), 0)
        self.assertEqual(len(received), 3)
        self.assertEqual(received[0][1], "Bearer test-source-key")
        self.assertEqual(received[0][2]["raw_record"], self.fixture.read_text().splitlines()[0])
        self.assertTrue(received[0][2]["is_simulated"])
    def test_redirect_does_not_forward_key(self):
        from contextlib import redirect_stdout, redirect_stderr
        from io import StringIO
        url, received = self.server()
        with patch.dict(self.cli.os.environ, {"AEGIS_LOG_SOURCE_KEY": "test-source-key"}), redirect_stdout(StringIO()), redirect_stderr(StringIO()):
            self.assertEqual(self.cli.main([str(self.fixture), "--capture-id", "synthetic", "--endpoint", url + "/redirect"]), 1)
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0][0], "/redirect")

if __name__ == "__main__": unittest.main()
