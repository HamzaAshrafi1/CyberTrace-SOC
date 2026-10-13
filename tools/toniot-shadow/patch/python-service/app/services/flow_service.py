import json
import uuid
from app.database import get_db_connection
from app.flow_features import normalize_zeek, SCHEMA_VERSION
from app.services.ml_shadow import assess_shadow

class FlowUnauthorized(ValueError):
    pass

class FlowConflict(ValueError):
    pass

def ingest_flow(raw_line, capture_id, api_key, is_simulated=False):
    if not isinstance(capture_id, str) or not capture_id.strip() or len(capture_id) > 200:
        raise ValueError("Invalid capture ID")
    if not api_key:
        raise FlowUnauthorized("Missing source API key")
    flow = normalize_zeek(raw_line)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT id, "organizationId" FROM "LogSource" WHERE "apiKey"=%s', (api_key,))
            source = cursor.fetchone()
            if not source:
                raise FlowUnauthorized("Invalid source API key")
            source_id, org_id = source
            identity = json.dumps([org_id, source_id, capture_id, flow["zeek_uid"]])
            cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (identity,))
            cursor.execute(
                'SELECT id, "traceId", "rawHash", "isSimulated", "featureSchema", "shadowAnalysis" FROM "FlowRecord" '
                'WHERE "organizationId"=%s AND "logSourceId"=%s AND "captureId"=%s AND "zeekUid"=%s',
                (org_id, source_id, capture_id, flow["zeek_uid"]))
            previous = cursor.fetchone()
            if previous:
                if previous[2] != flow["raw_sha256"] or previous[3] != is_simulated or previous[4] != SCHEMA_VERSION:
                    raise FlowConflict("Capture/UID identity already used with different evidence")
                shadow = previous[5] if len(previous) > 5 else None
                if isinstance(shadow, str):
                    shadow = json.loads(shadow)
                conn.commit()
                return {"id": previous[0], "trace_id": previous[1], "duplicate": True,
                        "analysis_status": "collected", "feature_valid": flow["feature_valid"],
                        "quality_flags": flow["quality_flags"], "feature_schema": SCHEMA_VERSION,
                        "model_compatibility": "baseline_contract_checked" if shadow and shadow.get("status") == "predicted_shadow" else "unvalidated",
                        "shadow_analysis": shadow}
            # Source authorization and retry identity checks precede any model work.
            # Scoring failures never discard accepted telemetry or create a threat.
            try:
                shadow = assess_shadow(raw_line, flow)
            except Exception:
                shadow = {"mode": "shadow", "status": "unavailable", "reason": "shadow_assessment_failed", "prediction": None}
            flow_id, trace_id = str(uuid.uuid4()), str(uuid.uuid4())
            cursor.execute(
                'INSERT INTO "FlowRecord" (id, "organizationId", "logSourceId", "captureId", "zeekUid", '
                '"traceId", "rawHash", "rawRecord", "featureSchema", features, "qualityFlags", '
                '"featureValid", "eventTime", "isSimulated", "shadowAnalysis", "analysisStatus", "createdAt") '
                'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())',
                (flow_id, org_id, source_id, capture_id, flow["zeek_uid"], trace_id,
                 flow["raw_sha256"], raw_line, SCHEMA_VERSION, json.dumps(flow["features"]),
                 json.dumps(flow["quality_flags"]), flow["feature_valid"], flow["event_time"],
                 is_simulated, json.dumps(shadow, allow_nan=False), "collected"))
            conn.commit()
            return {"id": flow_id, "trace_id": trace_id, "duplicate": False,
                    "analysis_status": "collected", "feature_valid": flow["feature_valid"],
                    "quality_flags": flow["quality_flags"], "feature_schema": SCHEMA_VERSION,
                    "model_compatibility": "baseline_contract_checked" if shadow and shadow.get("status") == "predicted_shadow" else "unvalidated",
                        "shadow_analysis": shadow}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
