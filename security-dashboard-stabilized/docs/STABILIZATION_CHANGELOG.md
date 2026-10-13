# Stabilization changelog — 4 October 2026

## Validation

- 19 new unittest regression checks passed.
- 15 existing/updated pure test functions passed by direct invocation, with provider imports stubbed (includes the five regex tests). This is not the full pytest suite.
- Python compileall passed.
- Node-generated HMAC service claims verified by Python.
- npm ci --offline could not complete because required packages are not cached. No TypeScript build/typecheck or lint success is claimed.
- Docker is unavailable. No actual migration, signed HTTP middleware, Clerk, Chroma, LLM, browser, or database concurrency verification was possible.

See PRE_ML_SETUP.md for instructions, operational changes and remaining prerequisites. Full dependency locking, live flow extraction and training/live feature parity are not complete. This batch is not a claim that the platform is ML-ready or production-ready.

## Changed/added files

- .dockerignore
- .env.example
- .github/workflows/ci-cd.yml
- Dockerfile
- README.md
- docker-compose.yml
- docs/PRE_ML_SETUP.md
- next.config.ts
- prisma/migrations/20261004143000_evidence_integrity/migration.sql
- prisma/migrations/20261004143100_ingestion_provenance/migration.sql
- prisma/schema.prisma
- python-service/app/event_bus.py
- python-service/app/main.py
- python-service/app/realtime.py
- python-service/app/schemas.py
- python-service/app/service_auth.py
- python-service/app/services/automation_service.py
- python-service/app/services/hunt_engine.py
- python-service/app/services/rag_service.py
- python-service/app/services/simulation_engine.py
- python-service/app/services/threat_service.py
- python-service/tests/test_hunt_engine.py
- python-service/tests/test_soar_automation.py
- python-service/tests/test_stabilization.py
- src/app/(dashboard)/cases/actions.ts
- src/app/(dashboard)/chat/ChatClient.tsx
- src/app/(dashboard)/chat/actions.ts
- src/app/(dashboard)/compliance/actions.ts
- src/app/(dashboard)/hunt/actions.ts
- src/app/(dashboard)/hunt/page.tsx
- src/app/(dashboard)/incidents/[id]/actions.ts
- src/app/(dashboard)/ingestion/actions.ts
- src/app/(dashboard)/lab/actions.ts
- src/app/(dashboard)/layout.tsx
- src/app/(dashboard)/soc/SOCClient.tsx
- src/app/(dashboard)/threat-map/ThreatMapClient.tsx
- src/app/(dashboard)/threats/ThreatsClient.tsx
- src/app/(dashboard)/threats/actions.ts
- src/app/(dashboard)/vault/actions.ts
- src/app/api/hunt-summary/route.ts
- src/app/api/realtime/route.ts
- src/app/api/security-log/route.ts
- src/hooks/useRealtimeEvents.ts
- src/lib/dashboard/security-logger.ts
- src/lib/dashboard/service-auth.ts
- src/lib/dashboard/verify-permission.ts
- src/middleware.ts

## Flow collection update

- Added the versioned Zeek JSON normalizer and nine-feature contract.
- Added source-key-authenticated flow collection, FlowRecord schema/migration, replay CLI and /flows viewer/navigation.
- Added read-only local startup checker; actual local checks returned unreachable services here.
- 37 new flow/CLI tests passed; with the preceding 19 stabilization checks, 56 unittest checks passed.
- Offline replay of three explicitly synthetic fixtures passed; this is not cyber-range or ML validation.
- No live database migration, FastAPI HTTP middleware, frontend build, real Zeek capture or model-feature compatibility validation was executed.
- Feature definitions reviewed against official Zeek documentation; see FLOW_FEATURE_CONTRACT.md for references and dataset compatibility gate.
