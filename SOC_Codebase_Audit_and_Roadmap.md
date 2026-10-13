# SOC Platform v0 — Codebase Audit and Development Roadmap

Date: 4 October 2026  
Source: security-dashboard-master.zip; archive comment d7dbcd2bc60b3f4df582a96abdb7effc41596125.  
Target: Evidence-Aware Adaptive AI-SOC.

## Decision

Reuse this repository as the application foundation. Preserve its frontend, incident/case workflows, database foundation, document processing and playbook editor. Repair service security and misleading demo results before integrating the research pipeline.

This is a source-code audit, not certification that the application runs correctly. “Implemented” below means code exists; it does not mean deployment, integration or security checks have passed. The supplied architecture conversation is the comparison baseline; the original complete handoff document was not re-read for this audit.

## Architecture actually present

Next.js 16.2.7 / React 19.2.4 / TypeScript → server actions → PostgreSQL through Prisma. Python FastAPI uses direct psycopg2 SQL against the same database. Document retrieval uses ChromaDB, LangChain chunking and optional OpenAI embeddings; generation uses OpenRouter. Python publishes in-process SSE events. Redis is referenced for frontend rate limiting, not a durable detection queue.

Current detection path:

Log source API key → source/tenant lookup → raw message regex → optional high/critical incident → ThreatEvent → playbook execution inside the database transaction → commit → SSE.

It has no structured network-flow ML inference, SHAP evidence, calibrated alert confidence or adaptive trust scoring in this path. A single failed-login string is classified as brute force; repeated-attempt/time-window validation is absent from that detector.

## Module map

Paths are relative to the extracted repository root.

| Module | Code evidence | Current state | Decision |
|---|---|---|---|
| Dashboard/navigation | src/app/(dashboard), src/components | Extensive frontend; mixed real and decorative data | Keep UI; replace unsupported operational claims |
| Authentication/RBAC | src/middleware.ts; src/lib/dashboard/verify-permission.ts | Clerk and server-action permissions implemented; test bypass exists | Keep; enforce at every boundary |
| Multi-tenancy | prisma/schema.prisma; server actions | Organization fields and many scoped queries exist; Python callers can choose tenant IDs | Repair before exposure |
| Ingestion | python-service/app/main.py; schemas.py; ingestion/actions.ts | API-key log ingestion and text UI exist | Extend with normalized structured events, timestamps, provenance and retries |
| Rule detection | python-service/app/detection.py | Five regex attack categories; first match wins | Keep as independent rule evidence |
| ML IDS | Detection and requirements inspection | No trained flow model in core pipeline | Build |
| Flow collection/features | Ingestion/detection inspection | Message-oriented inputs, no collector-to-model feature contract | Build |
| XAI | Detection pipeline inspection | No SHAP inference/evidence implementation | Build |
| Alert Trust Score | Detection pipeline/schema inspection | No evidence aggregation or score versioning | Build; central contribution |
| Correlation | threat_service.py; cases/actions.ts | Per-event incident creation and manual case linking | Build temporal/entity correlation and deduplication |
| Threat intelligence | hunt_engine.py; ThreatsClient.tsx | IOC filters map severity; actors/CVEs include mocks | Build provider enrichment with provenance |
| MITRE | mitre UI; hunt_engine.py; simulation_engine.py | Catalog/UI and text search, not evidence-backed stored mappings | Extend with reviewed mapping rules and versioned technique IDs |
| Incident management | incidents actions; Incident models | Persistent tickets, assignment, comments, activity | Keep and connect evidence lifecycle |
| Cases/evidence | cases/actions.ts; vault/actions.ts | Real file write and DB metadata; weak integrity/ownership validation | Extend with hashes, trusted size checks and tenant ownership |
| RAG/Copilot | rag_service.py; vector_provider.py; chat actions | Real extraction/chunking/retrieval and optional LLM; fake embeddings fallback | Upgrade to grounded, fail-explicit behavior |
| SOAR | automation_service.py; playbooks UI | Workflow conditions and DB actions implemented | Keep editor; redesign execution and approval lifecycle |
| Response verification | Executor inspection | No verified network containment state | Build |
| Realtime | realtime.py; useRealtimeEvents.ts | Real in-memory SSE, no server-side tenant isolation or replay | Repair; later add durable transport |
| Threat hunting | hunt_engine.py; hunt/actions.ts | AST/query-to-SQL engine and search code; synthetic enrichment | Keep parser/query layer; verify supported fields |
| Compliance | compliance/actions.ts | DB-derived counts mixed with fixed scores and invalid proxies | Defer; label as checklist until verified |
| Reports | reports actions/ReportPreview.tsx | Stored report/UI rendering foundation | Keep; restrict reports to traceable evidence |
| Cyber range | simulation_engine.py; lab routes | Predefined payload/log injection, not real attack traffic | Keep as functional fixtures; build isolated telemetry lab |
| Analyst feedback | Schema/detection inspection | No dedicated reviewed feedback-to-model workflow | Build |
| Model/drift monitoring | Core pipeline inspection | No model registry, drift or performance monitoring | Build after baseline |
| Tests/operations | tests; Dockerfiles; compose; CI | Tests and packaging exist; runtime configuration has blockers | Repair and establish reproducible baseline |

## Priority defects with concrete evidence

### P0 — Authorization and tenant isolation

1. `python-service/app/main.py`: chat, upload, hunt and lab handlers lack an authentication dependency and accept `organization_id` from the caller. Scoped SQL does not establish authorization to the chosen organization. Compose publishes the Python service port. Authenticate service requests and derive/verify tenant and permissions from trusted identity.
2. `python-service/app/realtime.py`: `/events` subscribes to the global listener set and `/publish` accepts caller data without authentication. Every listener receives every published event. Filter on the server by authenticated tenant; protect publishers separately. Frontend filtering cannot prevent disclosure.
3. `src/app/(dashboard)/cases/actions.ts`: linking scopes the incident but does not verify that the target case belongs to the same organization. `vault/actions.ts` similarly accepts a case ID without an ownership lookup. Validate both sides of every relationship.
4. `threat_service.py` prints received API keys; `main.py` stores submitted keys in rejected-request security logs. Remove secret logging and rotate any keys exposed by prior use.
5. `PLAYWRIGHT_TEST=true` enables cookie-controlled role/organization simulation and Clerk aliases. Make production startup/build reject test bypass settings; test real authorization separately.

### P0 — Reproducible startup

`Dockerfile` and CI select Node 18. The supplied package-lock.json entry for Next requires Node >=20.9.0. Align the image and CI with an appropriate supported runtime, using the lockfile as the immediate compatibility evidence.

Compose includes Chroma, Python and Next.js but no PostgreSQL or Redis service. These may be external dependencies, but the stack is not a complete local setup. Define local development services or document and check external prerequisites. Explicitly generate Prisma, apply migrations and seed deterministic fixtures; establish readiness checks. Python requirements are broadly unpinned and Chroma uses `latest`, so lock a tested combination.

### P1 — Truthfulness of displayed results

- `hunt_engine.py`: country filtering assigns countries through `hashtext(sourceIp)`; returned country also uses a synthetic helper. This is not geolocation. IOC “malicious” is a severity filter, not reputation evidence.
- `threat-map/ThreatMapClient.tsx` and `soc/SOCClient.tsx`: random coordinates/targets cannot support claims about attack origin or affected assets.
- `chat/ChatClient.tsx`: absent diagnostics become random retrieval counts/latencies; provider and quality labels include static values. Use unavailable/error states and measured backend values.
- `compliance/actions.ts`: `...includes("sslmode=require") || true` always passes. MFA and isolation have fixed scores; key-rotation scoring uses unassigned incident count. These checks do not verify the advertised controls.
- `rag_service.py`: FakeEmbeddings returns the same 1536-dimensional vector for every text and query. Retrieval in that mode has no semantic meaning. Expose provider/mode status and disallow this mode for evaluation; reindex with real embeddings.
- `threat_service.py`: email logs are stubs marked sent; Slack can be marked sent with no configured webhook. Executor email behavior is a database log, not verified delivery.
- `automation_service.py`: no BLOCK_IP handler exists. Unsupported actions can fall through without failure, leaving a success execution record. Reject unknown action types and record verified per-action outcomes.

### P1 — Reliability and evidence preservation

Playbooks and outbound webhooks run inside the ingestion transaction. External delivery can occur before commit, while a SQL error can abort the transaction despite a caught exception. Move effects to an outbox/worker after commit; use idempotency, retry limits and explicit action states. Avoid duplicate heuristic and playbook incidents.

Raw telemetry must remain intact. The general sanitizeString helper strips markup; do not use it on original security payloads. Escape payloads at display boundaries instead. Evidence upload checks the caller's declared size, not the decoded byte length, and lacks a content hash. Enforce actual size/type and preserve provenance.

Async routes perform blocking DB/HTTP work. SSE queues and rate limits are process-local. Establish bounded queues, workload limits and observability before calling the service scalable.

## Proposed data contract and schema extensions

Retain current tables and add incrementally:

- **NormalizedEvent / FlowRecord:** tenant, source, event/ingest time, collector version, endpoints, protocol, raw reference/hash, feature schema, simulation flag, trace ID.
- **ModelVersion / Prediction:** artifact hash, training manifest, feature contract, class probabilities, calibration version, latency, supported classes.
- **DetectionEvidence:** type, event/prediction link, producer version, value, quality, timestamp, provenance and failure/unknown status. Rules, XAI, TI and correlation remain separate evidence sources.
- **Alert / TrustAssessment:** linked event set, score and breakdown, available/missing evidence, formula version, decision, separate impact priority and analyst status.
- **CorrelationGroup / TechniqueMapping:** entity/window links; reviewed ATT&CK mapping basis and version.
- **ResponseRequest / Approval / ActionExecution / Verification:** requester, tenant, target, policy, approver, expiry, idempotency key, result and observed post-action state.
- **AnalystFeedback:** reviewed verdict, reason, label changes, reviewer and dataset eligibility. Feedback must not immediately retrain production models.

Use a trace ID across collection, prediction, alert, incident, Copilot retrieval and response. Distinguish event time from processing time and keep simulated fixtures out of research measurements.

## Development sequence and exit criteria

| Phase | Work | Exit criterion |
|---|---|---|
| 0 — Stabilize | Runtime/containers, migrations, auth boundaries, tenant SSE, secret removal, mock labels, unknown-action failures | Repeatable startup; two-tenant negative tests; no unauthorized Python read/write; no fabricated success/metrics |
| 1 — Telemetry contract | Replay fixtures, normalized events, collector/feature adapter, raw evidence and trace IDs | One real/replayed traffic sample travels to stored evidence; live and training features agree by documented calculation |
| 2 — ML baseline | Dataset source/label audit, leakage controls, training-only preprocessing, RF/XGBoost comparison, calibration, versioned inference | Reproducible held-out results with per-class precision/recall/F1, false-positive rate and latency; model rejects incompatible features |
| 3 — Evidence/trust | SHAP, versioned rules, entity/window correlation, cached TI with timeouts, component quality and scoring | Every trust score has reproducible inputs/version; absent evidence is unknown; ablations measure each component's value |
| 4 — Investigation | Evidence-linked incidents, reviewed MITRE mappings, real embeddings, incident-scoped retrieval, citations and abstention | Copilot claims trace to evidence; unanswerable queries abstain; tenant and prompt-injection checks pass |
| 5 — Response | Worker/outbox, analyst approval, policy thresholds, isolated action adapter, idempotency and verification | Approved lab action executes once; rejection/expiry prevents execution; failed containment cannot show verified success |
| 6 — Validation/adaptation | Isolated cyber range, benign controls, analyst feedback, offline retraining review, drift checks and report | End-to-end experiment reproduces detection → investigation → approved response → observed verification; all reported measures come from real runs |

Start with Phase 0, then complete one vertical slice before broadening attack coverage. UI additions are secondary to that slice.

## Research design decisions

Do not choose a final trust weighting from intuition. Start with a documented transparent baseline and evaluate weights/thresholds on validation data, leaving the final test set untouched. Correlated evidence can double-count a signal; an ML output and its SHAP explanation are not independent confirmation. Asset criticality describes impact, not whether an alert is true: maintain confidence and operational priority separately unless experiments justify combining them.

Use suitable day/session/entity splits and duplicate checks rather than assuming a random row split proves generalization. A CIC training feature set must be computable by the live extractor with the same definitions. Zeek conn records alone must not be assumed equivalent to the dataset's complete flow features. Finalize the feature contract before collector/model integration and retrain on the supported subset if needed.

Suggested comparisons: rules only; calibrated ML; ML plus validation evidence; full trust scoring; full scoring without each evidence component. Measure per-class performance, false-positive reduction, alert volume, calibration, scoring overhead and detection delay. Evaluate RAG source relevance, citation support, abstention and latency. Evaluate response approval compliance, execution success and independently observed verification. Measure analyst time only with a documented task/user protocol; never substitute a static percentage.

Feedback should enter a reviewed offline dataset. Track drift and error trends before scheduling retraining; require validation and rollback capability for model promotion.

## Validation completed and limits

Executed the five existing test functions in test_sqli.py, test_xss.py, test_bruteforce.py, test_traversal.py and test_command_injection.py directly: all passed. This confirms those supplied assertions, not comprehensive detection performance.

Pytest is not installed in this runtime, so the pytest suite was not executed. Frontend build/typecheck, DB migrations, Clerk login, Chroma indexing, OpenRouter calls, container startup, webhook delivery and browser E2E tests were not run. Source findings above identify implementation gaps; no live exploit or production verification was performed. Existing integration tests use mocks and browser tests bypass authentication, so their presence is not proof of deployed isolation or response effectiveness.

## Immediate implementation batch

1. Align Docker/CI runtime and make development dependencies explicit.
2. Enforce trusted Python identity and tenant scope, including SSE/publish.
3. Validate related-object ownership and redact keys.
4. Reject production test bypass and unsupported SOAR actions.
5. Remove invented metrics/success states, fail explicitly on missing real embeddings.
6. Establish startup and two-tenant regression checks, then define the flow feature contract.

The repository stays the foundation. The research contribution is the traceable evidence, validated trust decisions, grounded investigation and approved, verified response added to it.
