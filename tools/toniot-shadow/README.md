# Shadow-mode flow prediction integration

## Windows steps
1. Stop existing frontend and Python backend terminals with Ctrl+C. Extract this folder under D:\CAPSTONE\tools.
2. Run install_shadow.ps1 with PowerShell -NoProfile -ExecutionPolicy Bypass -File. It checks targeted file hashes, backs up existing changed files/schema/config outside the repository, installs the patch, adds nullable FlowRecord.shadowAnalysis, deploys one additive migration, generates Prisma Client, typechecks and runs regression/new backend and worker tests.
3. Run start_stack.ps1. It opens three PowerShell windows: private model worker on 127.0.0.1:8002 using the separate ML environment; existing FastAPI on 127.0.0.1:8000; existing Next.js development server on port 3000. Wait for readiness in all three windows.
4. Run replay_shadow_demo.ps1. Paste only the existing source API key when prompted (hidden input). Refresh /flows. Re-run the same replay to check duplicate IDs, trace IDs and assessments remain unchanged.

The reviewed model hash is aa9177b528f70c75e45a584afd31983f232267eb1fb3dfa8a64d8e7155f27fd6. Local model baseline-20261006-205121 and the existing ML environment are required. Worker startup verifies the artifact and versions before loading. No additional dataset download or Python dependency change is needed.

## Changed files
- Backend flow_service.py stores one optional shadow assessment with each new authenticated flow, in the same transaction as raw evidence. Collection status remains collected.
- New app/services/ml_shadow.py sends authenticated loopback-only scoring requests and verifies signed responses, expected model hash, contract, evidence hash, score and label mapping. Timeout is three seconds; proxies and redirects are disabled.
- New standard-library HTTP worker runs the fitted pipeline in the existing isolated ML environment. Bound only to 127.0.0.1; request body limits, timed HMAC signatures, replayed nonce rejection and bounded scoring slots apply. It has no database credentials or threat/incident/action integration. It reads only AEGIS_SERVICE_SECRET from the supplied project env file for authentication.
- Additive migration: FlowRecord.shadowAnalysis JSONB nullable. The installer adds only that field inside the existing FlowRecord Prisma declaration.
- /flows displays provisional binary predictions, uncalibrated score, assessment reason/model hash/contract and source evidence under existing organization/permission checks. Raw records remain escaped React text.
- Replay CLI correctly reports shadow states instead of claiming no model ran. shadow_demo.jsonl is explicitly simulated: original three fixtures plus a distinct missing-duration record.

The installer leaves npm dependency versions, existing ML/backend environments, middleware/authentication configuration and unrelated application files untouched. It preserves existing env settings, adding/updating AEGIS_ML_SHADOW_ENABLED=true, AEGIS_ML_WORKER_URL=http://127.0.0.1:8002 and the reviewed AEGIS_ML_MODEL_SHA256. AEGIS_SERVICE_SECRET must already be a real generated secret. Target file hashes account for CRLF/LF and protect local edits; a mismatch stops before writes so a manual merge can preserve local changes.

## Semantics
- predicted_shadow: normal/scanning model observation; never a confirmed threat, incident or safety claim. Score is uncalibrated, threshold 0.5. Scope is the provisional binary TON_IoT baseline.
- rejected: unsupported quality/missingness, prediction null. Only missing duration is supported; original feature_valid remains false in that case. Content gaps/other missing counts/unsupported protocols do not receive a model verdict.
- unavailable: scoring/authentication/configuration/response/timeout failure, prediction null, raw flow still collected.
- disabled: explicitly disabled shadow mode, prediction null.
- historical null assessment: collected before patch; no retroactive prediction.

Source authorization and scoped identity checks precede scoring. Duplicate replay returns original stored assessment without reclassification, including prior unavailable/disabled states. A changed record still returns conflict. Use a new capture ID only for a genuinely distinct demo/session; do not silently relabel old evidence.

No Threat or Incident inserts, alert promotion, automatic SOAR actions, AI API calls or raw-evidence changes are introduced. Scores are synchronous lab shadow observations, not a production throughput guarantee. A busy/unavailable worker records unavailable. This version has no background rescoring/backfill. Do not replay the multi-million-row dataset into this lab API as an ingestion load test.

## Demo expectations
With all services ready and a correctly configured secret, four new simulated flows are stored. Three receive predicted_shadow (including missing duration); one with content gaps and missing counters receives rejected. Specific normal/scanning labels are determined by the model; fixture names are not ground truth. Repeat replay must return duplicate=true with identical IDs/traces/assessments. If the worker stops, a new eligible flow is still collected with unavailable and no prediction. Threat/incident totals must not increase from this flow replay.

## Verification and rollback
Local checks: existing 19 stabilization +37 flow regressions; eight shadow client/storage tests; three worker tests including real backend-client/worker HTTP integration; TypeScript after regenerated Prisma Client. The installer runs corresponding checks on Windows. Mocked storage tests verify authorization/tenant evidence, no Threat/Incident inserts, worker failure persistence and retry immutability. PostgreSQL migration and signed real-model end-to-end dashboard verification require the user's local run; they are not claimed completed remotely.

To disable future scoring, set AEGIS_ML_SHADOW_ENABLED=false in the project .env and restart backend; stored assessments remain. For file rollback, stop the stack and restore targeted files/schema/env from the timestamped shadow-backups folder. Keep the applied additive database column/migration; restoring files does not undo a migration. No database reset or destructive rollback is supplied.
