# Pre-ML stabilization — setup and status

This package is a separate updated copy of the uploaded project. The original ZIP is unchanged. No ML training has been performed.

## Implemented in this batch

- Node 22 container/CI configuration and explicit Prisma generation.
- Local PostgreSQL, Redis and pinned Chroma server image in Compose; loopback-only published ports; persistent evidence/log volumes.
- Short-lived HMAC-signed backend tenant/permission claims. Secrets remain server-side. Python rejects unauthenticated service calls and mismatched organization IDs.
- Same-origin authenticated SSE proxy and tenant-filtered, bounded Python subscriber queues. System logs are not broadcast across tenants.
- Signed headers on chat/document/hunt/lab/summary server calls. Browser simulation now uses the authenticated lab action instead of a hardcoded API key.
- Production rejects the Playwright authentication bypass. Dashboard route coverage expanded; default public logging secret removed.
- Tenant ownership verification when linking cases and uploading evidence. Decoded upload size checked; evidence SHA-256 recorded.
- Original log messages preserved through ingestion. ThreatEvent records gain trace IDs, raw hashes, source event IDs, optional original timestamps and simulation flags.
- Retry deduplication under a PostgreSQL advisory transaction lock and unique index. Identical source/event ID returns the existing record; conflicting payload/IP/simulation flag is rejected. Events without a source event ID remain distinct.
- Unsupported playbook actions report failure. External actions are disabled pending approval and post-commit delivery; in-app notifications and supported database actions remain available. Existing incidents are reused by CREATE_INCIDENT.
- Fake embeddings removed, embeddings now fail explicitly if unconfigured; Chroma provider initialization deferred until needed.
- Random fallback RAG diagnostics removed. Decorative maps/counters and actor/CVE examples explicitly labeled. Synthetic country/IOC filters rejected; country enrichment remains unavailable.
- Compliance requests store an unverified checklist rather than invented passing scores. Existing historical compliance records are not automatically rewritten.

## Windows PowerShell setup

Use a new project directory or back up your existing checkout before copying these files. Keep existing databases; these migrations add nullable provenance/hash columns and a simulation default. Historical events/evidence will retain null hashes/trace fields.

Requirements: Node 22, Python 3.10+ and Docker Desktop. Clerk publishable/secret keys are required for real login. OpenAI embeddings and OpenRouter keys are optional for initial ingestion, but required for their respective AI functions.

From the extracted project root:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate two separate secrets: set AEGIS_SERVICE_SECRET and AEGIS_INTERNAL_KEY in .env. Set a strong POSTGRES_PASSWORD and the matching password in DATABASE_URL. Replace the Clerk placeholders. Do not commit .env. For the provided DATABASE_URL format use a generated hex password, or URL-encode special characters.

Start infrastructure and install dependencies:

```powershell
docker compose up -d postgres redis chromadb
npm ci --legacy-peer-deps
npm run prisma:generate
npx prisma migrate deploy
python -m venv python-service/.venv
python-service/.venv/Scripts/python.exe -m pip install -r python-service/requirements.txt
```

For local development run these in two terminals:

```powershell
npm run dev
```

```powershell
Set-Location python-service
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The Python process loads ../.env. Visit http://localhost:3000, sign in, select/create an organization and register a log source. Use its API key for ingestion. No default development key is supplied.

For an all-container run, apply migrations first using the host setup above, then run:

```powershell
docker compose up --build -d
```

The build needs a valid Clerk publishable key. Compose environment values inside containers point to postgres, redis and chromadb service names; host-side DATABASE_URL remains localhost. Prisma migrations are an explicit setup step, not implicitly executed by the web server. If using an existing external database, configure a separate deployment override rather than assuming this local Compose stack uses it.

## Smoke test a registered source

PowerShell example (replace the key with a key registered under your current tenant):

```powershell
$sourceKey = 'YOUR_REGISTERED_SOURCE_KEY'
$payload = @{
  source = 'manual-test'
  ip = '127.0.0.1'
  message = '<script>alert(1)</script>'
  eventId = 'smoke-xss-001'
  eventTime = '2026-10-04T14:30:00Z'
  isSimulated = $true
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ingest' -Method Post -Headers @{ Authorization = "Bearer $sourceKey" } -ContentType 'application/json' -Body $payload
```

Repeat exactly: the second response should contain duplicate=true and the same event/trace IDs. Change the message while retaining eventId: it should return 409. Check the threat record contains the original script tags. Use a fresh eventId for a genuinely new observation.

The source name stored in ThreatEvent is resolved from the registered source API key, not trusted from the submitted source label. isSimulated is source-supplied metadata, not independently verified ground truth. A new manual-upload batch currently generates a new batch ID, so re-uploading the same file is not automatically deduplicated. External collectors must persist and reuse source event IDs across retries.

## Flow collection update

This version also includes the Zeek JSON adapter, source-authenticated flow ingestion, FlowRecord migration, replay CLI and /flows viewer. Read [FLOW_FEATURE_CONTRACT.md](FLOW_FEATURE_CONTRACT.md). Flow features remain model-unvalidated.

After startup, from python-service run `.venv/Scripts/python.exe tools/check_local_stack.py` for read-only health and unsigned-request checks. This does not verify real Clerk roles or replace two-tenant integration testing.

## Checks to run locally

```powershell
npm run typecheck
npm run lint
npm run build
Set-Location python-service
.venv/Scripts/python.exe -m unittest discover -s tests -p test_stabilization.py -v
.venv/Scripts/python.exe -m unittest discover -s tests -p test_flow_features.py -v
.venv/Scripts/python.exe -m pytest
```

The existing SOAR and country tests were updated for disabled external actions and unknown geolocation. The supplied Playwright config uses npm run dev, which remains compatible with test auth; production builds intentionally reject PLAYWRIGHT_TEST=true. The new security tests do not bypass real backend authentication, but most are isolated unit tests, not live HTTP/DB integration tests.

Before claiming Phase 0 complete, verify real Clerk roles, two real organizations, unauthorized Python requests, SSE disconnect/reconnect and database migrations. Start without AI keys: ingestion should still work; embeddings must report unavailable. /health/ready currently requires AI configuration as well, so an ingestion-only setup may correctly return 503 under the existing aggregate readiness definition.

## Validation performed in this workspace

- 19 new standard-library unittest regressions: passed.
- Five existing regex-detection test functions: passed by direct invocation.
- Python compileall: passed.
- Cross-runtime Node/Python HMAC verification: recorded in STABILIZATION_CHANGELOG.md after execution.
- Full npm install/build/typecheck: not completed; offline cache lacks dependencies.
- Docker unavailable; no live PostgreSQL/Chroma/Clerk/OpenRouter or browser verification.
- Python dependency lock remains pending a successful full environment installation. Chroma server is pinned to 0.6.3; test and lock a compatible Python client/dependency set before reproducibility claims.

## Remaining work before ML training

1. Run the startup and two-tenant integration checks above, including the original suite with updated expectations.
2. Finalize a flow collector/feature adapter and train/live feature contract. Current ingestion accepts text messages, not trained flow vectors.
3. Collect one real/replayed benign and malicious telemetry sample with provenance; synthetic UI fixtures cannot establish generalization.
4. Audit dataset labels/sources and define attack classes and leakage-resistant evaluation splits.
5. Only then implement a baseline model, calibration and versioned inference.

The full approval/outbox worker, real threat intelligence, SHAP, trust score, cyber range, drift monitoring and reviewed feedback are later phases. Current SSE is process-local, drops events for slow subscribers and has no replay; refresh stored records after reconnect. Shared service claims expire on connection establishment; existing streams do not yet implement immediate role-revocation checks. Local ports and shared-secret service authentication are a development baseline, not a complete public deployment security design.
