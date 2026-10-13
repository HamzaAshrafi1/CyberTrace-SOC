# Flow analyst review

Adds saved analyst decisions to the existing /flows evidence panel. Admin and Analyst roles use the existing write:threats permission; Viewer can inspect review history. Each save requires a reason of 10–2,000 characters. Decisions: needs investigation, dismissed, confirmed suspicious by analyst. No threat/incident creation is implemented in this stage.

Review revisions are stored separately from raw evidence and shadow assessments. The authenticated reviewer, timestamp, reason and evidence hash are recorded. The latest 10 revisions appear in the panel; older revisions remain stored. Tenant-bound foreign keys prevent a review from linking to another organization's flow. A transaction serializes submissions for a flow, rejects stale review IDs and writes the review and audit record atomically. This is application append-only history, not protection against a database administrator.

## Install

Stop only Next.js (Ctrl+C in its terminal). Extract this zip to D:\CAPSTONE\tools. Run install_review.ps1 from PowerShell. The installer checks the existing flow page, backs up replaced files and the schema, appends the review model and relation, deploys the migration, regenerates Prisma, runs typecheck and mocked server-action tests. Local flow-page edits cause an abort before writes. No dependency versions or environment values are changed. Do not use prisma migrate reset.

Restart npm run dev. Open /flows and expand a flow. Save 'Needs investigation' with a clear reason; refresh and verify the decision, reviewer, timestamp, evidence hash and revision. Save a second decision with a reason; the first remains in history. With two tabs opened before a save, save in one then try the other: the stale submission must be refused. Viewer cannot save. Review does not create any ThreatEvent or Incident records.

## Validation

Local Prisma generation and TypeScript checks passed. The executable tests cover authorization refusal before DB work, invalid input, tenant-filtered lookup, absent flow, stale submissions, revision increments, evidence binding, and rollback when audit insertion fails. These tests mock database transactions. Real PostgreSQL migration, lock behavior and browser review saves still require validation on the Windows installation.
