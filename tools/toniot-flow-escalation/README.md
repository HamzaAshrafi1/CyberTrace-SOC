# Explicit analyst flow escalation

Requires the installed ton iot flow review patch. A current 'Confirmed suspicious by analyst' review enables an explicit creation form on /flows. Admin/Analyst need write:threats; incident creation additionally checks write:incidents. The reviewer may differ from the creator; both identities remain recorded. Model predictions alone do not enable creation. Rejected/unavailable ML does not forbid a human evidence-based review.

The user selects Threat or Incident, severity, title, reason, and checks an explicit creation confirmation. Exactly one initial escalation is supported per flow, to either a threat or a standalone incident. Creating an incident does not also create a threat. Subsequent review decisions remain separate and do not automatically close or remove a linked record.

The transaction uses the same tenant/flow advisory lock as review saves. It checks the tenant-scoped latest review, its evidence hash and confirmed-suspicious decision. Target record, escalation link, audit record and incident activity (when applicable) commit together. Repeated submissions return the existing link. Unique and composite foreign keys bind organization, flow, review and target records. Linked rows cannot be deleted until the referencing link is handled; this protects investigation provenance. No automatic response actions or external messages run.

Threats preserve original raw JSON, hash, trace ID, event time and synthetic flag. Incidents preserve flow/review/hash references in their description and structured link; synthetic incidents carry an explicit [SYNTHETIC] title and evidence label. The Incident table has no synthetic flag, so these are textual markings. Historical replay is not live traffic. Initial source-event IDs are flow-escalation:<flowId>.

## Install

Stop only Next.js. Extract to D:\CAPSTONE\tools and run install_escalation.ps1. The installer checks the current flow page before replacing it, backs up existing files and schema, adds the model/relations/indices, deploys migration, generates Prisma, runs TypeScript and action tests. No package versions, credentials, ML settings or Python services are changed. If local edits are detected, nothing is written; provide the current flow page for reconciliation. Do not reset the database.

## Browser verification

Use a synthetic flow to exercise record creation without representing the exercise as a real detection. Save a confirmed suspicious review with a reason explicitly stating it is a workflow test using synthetic evidence. Review the creation form, select one record type, enter a test title/reason, and confirm creation. The new record should be marked synthetic, and the flow should show its link, review reference, creator and reason. Refresh: the same link must persist. Repeating a submission must not add another target record. Test the other type using a DIFFERENT synthetic flow because one flow supports one initial escalation. Other organization flows must remain inaccessible; Viewer must not see creation controls or succeed through a direct server-action call.

## Validation and limits

Local Prisma schema validation/generation and TypeScript checks passed. Executable mocked action tests cover permissions, incident permission, explicit confirmation, input validation, tenant scope, missing flow, stale/unconfirmed reviews, hash mismatch, repeated submission, conflicting escalation type, synthetic marking, incident activity and rollback on audit failure. Installer tested for clean application and repeat application. The real PostgreSQL migration and browser creation/duplicate behavior still need verification on Windows. No live database integration claim is made by these mocked tests.

## Project milestone

The first ML phase is complete: provisional normal-versus-scanning baseline, offline parity, shadow worker, historical ingestion, duplicate preservation, outage handling, PCAP extraction and dashboard observations. Broader attack coverage and production/live accuracy are outside that verified milestone. Overall project completion estimate: about 65%, scope-dependent and not measured against a complete acceptance checklist.
