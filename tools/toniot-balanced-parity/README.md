# Balanced candidate evidence parity

This read-only check loads the reviewed balanced candidate only after its pinned SHA-256, feature order, bundle contract and exact Python/package versions match. It checks 100 deterministic sampled eligible records per primary-test capture (500 total), preserving raw original Bro line hashes and comparing prepared CSV, installed backend extraction and guarded adapter feature vectors exactly. It compares direct pipeline and adapter scores, prediction handling and quality flags. Guard cases cover missing duration, zero duration, content gaps, missing packet counts, unsupported protocol, negative duration, invalid IP, missing gap metadata and malformed JSON.

This is an OFFLINE runtime-feature adapter check, not HTTP worker deployment or new accuracy evidence. No backend writes, model promotion or worker changes are performed. A passed sample check is not universal Zeek-version compatibility. Existing overlap/label limitations remain.

Run run_parity.ps1 in PowerShell after extraction to D:\CAPSTONE\tools. It uses the existing pinned balanced-venv and reads installed backend feature code and original dataset files. Services may keep running. Expected output inference_check.json, predictions.jsonl. Treat only a complete report as success; report absence or failure is not success. Packaging tests passed on the available Linux runtime; Windows script reruns fixture tests in the exact training environment.

After a pass, review the evidence before any model-selection decision. The balanced candidate has more scanning misses than the earlier baseline on the examined test set; parity does not establish superiority or justify automatic deployment.
