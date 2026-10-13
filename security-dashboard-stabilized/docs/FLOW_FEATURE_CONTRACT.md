# Zeek flow collection contract v1

Status: implemented collector adapter and persistence; compatibility with a trained model and CSE-CIC-IDS2018 remains unvalidated. No model is loaded and no threat/clean verdict is produced.

## Architecture

Zeek JSON conn.log → replay/offline adapter → POST /api/v1/flows/ingest with a registered source key → FlowRecord → /flows.

The same normalize_zeek function extracts features during offline replay and server ingestion. This removes separate calculation implementations within this Zeek path. It does not establish equivalence with another extractor.

The adapter preserves originator/responder direction as Zeek reports it. It never assumes originator means internal host, victim or attacker. Endpoints, ports, timestamps, UIDs and capture identity remain investigation context, not model inputs.

## Ordered feature vector

Version: zeek-conn-v1. Order must be retained with every model artifact.

| Position | Name | Source/calculation | Unit/type |
|---|---|---|---|
| 0 | duration_s | conn duration | seconds, nonnegative numeric |
| 1 | orig_pkts | orig_pkts | nonnegative integer count |
| 2 | resp_pkts | resp_pkts | nonnegative integer count |
| 3 | orig_ip_bytes | orig_ip_bytes | nonnegative IP-level byte count |
| 4 | resp_ip_bytes | resp_ip_bytes | nonnegative IP-level byte count |
| 5 | total_pkts | orig_pkts + resp_pkts | packet count |
| 6 | total_ip_bytes | orig_ip_bytes + resp_ip_bytes | byte count |
| 7 | orig_packet_share | orig_pkts / total_pkts | ratio; null when total is zero |
| 8 | protocol_code | tcp=6, udp=17, icmp=1 | versioned categorical encoding |

protocol_code is a contract category encoding, not a claim that it equals the ip_proto field for every address family. In v1 both IPv4/IPv6 ICMP normalize to category 1. Other protocol categories are retained as context but have a null feature code and a quality flag. Do not treat this categorical encoding as a naturally ordered measurement in preprocessing.

IP-level bytes are deliberately distinct from orig_bytes/resp_bytes, which are not used by v1. Duration follows Zeek's connection summary semantics; it is not automatically the same boundary as a CICFlowMeter flow.

No packet/byte rates are included: a valid zero-duration observation must not lead to divide-by-zero or an invented duration. Total counts and packet share are mathematically dependent on directional counts; account for this in model selection, ablations and SHAP interpretation.

## Validation and quality

Required identity/context: ts, uid, id.orig_h, id.resp_h, id.orig_p, id.resp_p and proto. IPv4 and IPv6 addresses are supported. Ports must be integers 0..65535. ts is a finite nonnegative Unix timestamp, converted to UTC.

Missing duration or count features remain null and create missing-field flags; they are never filled with zero. Negative/nonfinite measurements, numeric strings, boolean numbers, fractional packet counts, oversized integers, duplicate JSON keys and oversized raw records are rejected. Counter sums must remain within 2^53-1 for cross-language exactness.

missed_bytes is quality metadata, not a model feature. Missing missed_bytes is flagged; a nonzero value adds reported_content_gap. This indicates Zeek-reported content gaps, not an independent proof of capture completeness. Zero packets or inconsistent packet/byte counters create quality flags.

feature_valid=true means the adapter produced a complete vector without its configured quality flags. It does not mean benign, malicious, fit for every model, accurate capture, or experimentally validated. model_compatibility remains unvalidated. analysis_status remains collected.

## Persistence and retries

FlowRecord stores tenant/source, capture ID, Zeek UID, trace ID, original raw record text excluding the JSONL line separator, SHA-256, feature schema, features, quality flags, UTC event time, simulation flag and ingestion time.

Tenant/source are resolved from the source key. The caller cannot choose the tenant. A capture ID must be stable across retries and distinct for unrelated capture sessions. Identity is (organization, registered source, capture ID, Zeek UID). A PostgreSQL transaction lock and unique index protect retry races; identical evidence returns the original trace. Changed raw text or simulation metadata under the same identity returns 409. JSON formatting/spacing changes alter the raw hash and count as changed evidence. No canonicalization silently rewrites source evidence.

This adapter expects one finalized record per UID per capture, not repeated cumulative snapshots. If collecting updates, define a snapshot/event sequence and a new contract rather than overwriting the original row.

The simulation flag is source-reported metadata. Synthetic fixture replay must use --simulated; it is not experimental attack ground truth. True labels will require independently recorded lab/dataset ground truth.

## Obtain and replay Zeek JSON

In a configured Zeek environment, process an authorized PCAP:

```bash
zeek -r capture.pcap LogAscii::use_json=T
```

Zeek is not installed or bundled by this project. Select and record a Zeek version and its scripts/configuration when establishing a reproducible capture environment. Preserve PCAP hashes and collection notes with the capture ID; the current FlowRecord schema does not independently verify those notes.

In python-service, extract features offline from an existing JSON conn.log:

```powershell
.venv/Scripts/python.exe tools/replay_zeek.py conn.log --capture-id capture-001 > normalized.jsonl
```

After applying migrations and registering a source, replay into the backend:

```powershell
$env:AEGIS_LOG_SOURCE_KEY = 'YOUR_REGISTERED_SOURCE_KEY'
.venv/Scripts/python.exe tools/replay_zeek.py conn.log --capture-id capture-001 --endpoint http://127.0.0.1:8000/api/v1/flows/ingest
```

Do not pass the source key on the command line. The CLI refuses credential-bearing redirects and requires HTTPS for remote servers. Rerun with the same source/capture ID after a partial failure. Accepted records remain committed, so there is no all-or-nothing batch rollback.

For functional testing only:

```powershell
.venv/Scripts/python.exe tools/replay_zeek.py fixtures/synthetic_conn.jsonl --capture-id synthetic-demo-001 --simulated
```

Append --endpoint to store these fixtures. The fixture includes one complete TCP record, one zero-duration IPv6 UDP record and one partial record with a content gap. These are handwritten fixtures, not real observed benign/malicious traffic.

Visit /flows after signing in. Original JSON is rendered as escaped text. No ThreatEvent or incident is created by this endpoint yet; storage and detection are separate responsibilities.

## CSE-CIC-IDS2018 compatibility gate

Do not train a model on the full CIC CSV feature set and feed it this nine-feature Zeek vector. This contract intentionally makes no direct column equivalence claim.

Before training:

1. Inventory the exact dataset files, labels, units, extractor version and available raw captures.
2. Extract the same traffic with the intended live extractor and compare direction, timeouts, duration boundaries, packet counts and byte semantics.
3. Prefer the same implementation/configuration for training and live feature generation. If only CIC CSV files are available, establish and test an explicit compatible mapping/subset or use an extractor matching those dataset features.
4. Version any revised feature contract. Define training-only preprocessing, missing-feature policy, attack classes, leakage controls and evaluation splits.
5. Require an exact model/feature schema match at inference. Do not silently truncate, reorder or pad inputs.

The nine features are a working collection baseline. Their detection adequacy and final use in the research model are unresolved. They do not replace the agreed dataset or justify accuracy claims.

## Verification status

Adapter/unit tests and offline replay were executed here. SQL persistence/locking, HTTP source auth, schema migrations, frontend build and real capture/replay require a configured stack and remain unverified.

Official semantic references:

- https://docs.zeek.org/en/v7.2.2/scripts/base/protocols/conn/main.zeek.html
- https://docs.zeek.org/en/current/tutorial/logs.html
- https://docs.zeek.org/en/master/reference/logs/conn.html

Accessed 4 October 2026. The collector's actual version still needs to be recorded for your live setup.
