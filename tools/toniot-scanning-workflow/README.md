# Scanning workflow completion checkpoint

Scope: existing normal-versus-scanning shadow model, evidence collection, analyst review, explicit linked incident and reasoned incident lifecycle. No retraining, threshold change or new attack category. This package does not claim production detection accuracy or continuous live capture.

Changes: tenant-scoped incident mutation with transactional audit and history; active Admin/Analyst assignment; assignment required to advance; explicit reason; allowed status transitions; expected updatedAt freshness guard; linked flow/review/hash display. Old unguarded queue mutation endpoints now direct users to details. AI-service failure is shown as unavailable rather than an invented attack summary. No schema migration or secret change.

## Install
Stop Next.js only. Run install_workflow.ps1. It refuses unexpected local modifications and makes backups under tools/scanning-workflow-backups. Run npm run dev again. Keep backend 8000 and worker 8002 running. The frontend controls disable writes for Viewer users; server authorization is authoritative.

## Supervisor demonstration and acceptance checklist
1. Replay fixtures/shadow_demo.jsonl through python-service/tools/replay_zeek.py with a NEW capture ID such as synthetic-scanning-workflow-001, --simulated and loopback endpoint. Enter the source key locally; remove it afterwards. Show scored, rejected and missing-duration cases. These are synthetic demonstration records, not new accuracy evidence.
2. In /flows choose a synthetic scanning prediction. Expand its original record, quality flags, score, evidence hash and trace ID. Explain that its score is uncalibrated and scanning does not prove malicious intent.
3. Save confirmed suspicious review with reason 'Synthetic supervisor demonstration; verifying workflow, not a real detection.' Create a linked INCIDENT explicitly; title '[SYNTHETIC] Scanning workflow demonstration'. Confirm and open it.
4. In incident details verify flow ID, review revision, evidence SHA-256 and synthetic marker. Assign your active organization analyst account, providing a reason. Mark Investigating and provide the investigation reason.
5. Add a note describing what the test evidence shows and its limitations. Resolve with reason 'Synthetic workflow verified; evidence preserved; no real response action executed.' Contained is optional; it records an analyst decision, not automatic firewall blocking.
6. Refresh. Confirm assignee, note, resolution history and evidence link persist. Reopen as Investigating with reason if needed. Open the flow page and confirm its link remains.
7. Two-tab check: open the same incident twice. Change assignment/status in one tab, then attempt a change in the stale tab. It must request refresh. Notes are append-only and do not overwrite workflow state.
8. Re-run the same capture ID: duplicates should retain the original observation. Stop only model worker, replay one NEW synthetic record: evidence should remain with unavailable scoring. Restart worker afterwards.

Record actual browser results before calling this checkpoint verified. TypeScript and mocked tests passed during package creation; Windows database/browser execution remains pending. Existing historical PCAP replay and offline metrics remain separately documented. Balanced final retraining and independent captures remain ML evaluation work; this patch does not present the old benchmark as a final independent test.

## Rollback
Stop Next.js. Restore the four incident source files from the printed backup location, preserving folder paths. No database rollback is needed.
