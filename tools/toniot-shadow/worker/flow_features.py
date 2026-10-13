"""One feature implementation for both replay/offline extraction and ingestion.
This is a Zeek-specific contract, not a claim of CICFlowMeter equivalence.
"""
from datetime import datetime, timezone
from ipaddress import ip_address
import hashlib
import json
import math

SCHEMA_VERSION = "zeek-conn-v1"
FEATURE_NAMES = (
    "duration_s", "orig_pkts", "resp_pkts", "orig_ip_bytes", "resp_ip_bytes",
    "total_pkts", "total_ip_bytes", "orig_packet_share", "protocol_code",
)
PROTOCOL_CODES = {"tcp": 6, "udp": 17, "icmp": 1}
MAX_RAW_BYTES = 65536
MAX_EXACT_INTEGER = 2**53 - 1

class FlowValidationError(ValueError):
    pass

def number(value, name, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise FlowValidationError(f"{name} must be a number")
    try:
        finite = math.isfinite(value)
    except OverflowError as exc:
        raise FlowValidationError(f"{name} exceeds supported numeric range") from exc
    if not finite or value < 0:
        raise FlowValidationError(f"{name} must be finite and nonnegative")
    if integer and (not isinstance(value, int) or value > MAX_EXACT_INTEGER):
        raise FlowValidationError(f"{name} must be an exact nonnegative integer")
    return value

def reject_constant(value):
    raise FlowValidationError(f"Invalid JSON numeric constant: {value}")

def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise FlowValidationError(f"Duplicate JSON field: {key}")
        result[key] = value
    return result

def normalize_zeek(raw_line):
    if not isinstance(raw_line, str) or len(raw_line.encode("utf-8")) > MAX_RAW_BYTES:
        raise FlowValidationError("Flow line must be at most 64 KiB")
    try:
        record = json.loads(raw_line, parse_constant=reject_constant, object_pairs_hook=unique_object)
    except json.JSONDecodeError as exc:
        raise FlowValidationError("Expected one Zeek JSON conn record") from exc
    if not isinstance(record, dict):
        raise FlowValidationError("Expected a JSON object")
    uid = record.get("uid")
    if not isinstance(uid, str) or not uid or len(uid) > 200:
        raise FlowValidationError("Missing or invalid Zeek uid")
    try:
        if not isinstance(record["id.orig_h"], str) or not isinstance(record["id.resp_h"], str):
            raise ValueError("Addresses must be strings")
        orig_ip = str(ip_address(record["id.orig_h"]))
        resp_ip = str(ip_address(record["id.resp_h"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise FlowValidationError("Invalid originator/responder address") from exc
    ports = {}
    for name in ("id.orig_p", "id.resp_p"):
        value = number(record.get(name), name, integer=True)
        if value > 65535:
            raise FlowValidationError(f"{name} exceeds 65535")
        ports[name] = value
    timestamp = number(record.get("ts"), "ts")
    try:
        event_time = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError) as exc:
        raise FlowValidationError("Timestamp out of supported range") from exc
    proto = record.get("proto")
    if not isinstance(proto, str) or not proto:
        raise FlowValidationError("Missing protocol")
    quality = []
    features = {}
    for name, source in (("duration_s", "duration"), ("orig_pkts", "orig_pkts"),
                         ("resp_pkts", "resp_pkts"), ("orig_ip_bytes", "orig_ip_bytes"),
                         ("resp_ip_bytes", "resp_ip_bytes")):
        value = record.get(source)
        if value is None:
            quality.append(f"missing:{source}")
            features[name] = None
        else:
            features[name] = number(value, source, integer=source != "duration")
    features["total_pkts"] = None
    features["total_ip_bytes"] = None
    features["orig_packet_share"] = None
    if features["orig_pkts"] is not None and features["resp_pkts"] is not None:
        total = features["orig_pkts"] + features["resp_pkts"]
        if total > MAX_EXACT_INTEGER:
            raise FlowValidationError("Total packets exceeds exact numeric range")
        features["total_pkts"] = total
        if total:
            features["orig_packet_share"] = features["orig_pkts"] / total
        else:
            quality.append("zero_packets")
    if features["orig_ip_bytes"] is not None and features["resp_ip_bytes"] is not None:
        total = features["orig_ip_bytes"] + features["resp_ip_bytes"]
        if total > MAX_EXACT_INTEGER:
            raise FlowValidationError("Total IP bytes exceeds exact numeric range")
        features["total_ip_bytes"] = total
    for direction in ("orig", "resp"):
        if features[f"{direction}_pkts"] == 0 and features[f"{direction}_ip_bytes"] not in (None, 0):
            quality.append(f"inconsistent:{direction}_zero_packets_with_bytes")
    features["protocol_code"] = PROTOCOL_CODES.get(proto)
    if proto not in PROTOCOL_CODES:
        quality.append("unsupported_protocol")
    missed = record.get("missed_bytes")
    if missed is None:
        quality.append("missing:missed_bytes")
    elif number(missed, "missed_bytes", integer=True) != 0:
        quality.append("reported_content_gap")
    return {
        "schema_version": SCHEMA_VERSION, "zeek_uid": uid,
        "event_time": event_time, "orig_ip": orig_ip, "resp_ip": resp_ip,
        "orig_port": ports["id.orig_p"], "resp_port": ports["id.resp_p"],
        "protocol": proto, "features": features,
        "feature_names": list(FEATURE_NAMES),
        "feature_vector": [features[name] for name in FEATURE_NAMES],
        "feature_valid": not quality, "quality_flags": quality,
        "model_compatibility": "unvalidated", "analysis_status": "collected",
        "raw_sha256": hashlib.sha256(raw_line.encode("utf-8")).hexdigest(),
    }
