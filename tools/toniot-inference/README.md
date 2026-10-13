# Offline inference consistency check

Extract to D:\CAPSTONE\tools and run run_inference_check.ps1. Uses the existing separate ML environment; no new packages, dataset downloads, Docker, API keys or services required. No original dataset, model or application file is modified. A new timestamped folder is written under D:\CAPSTONE\datasets\TON_IoT\inference_checks.

The runner targets the reviewed model baseline-20261006-205121 and prepared partitions-20261006-192038. Its recorded model hash is included in reviewed_model_sha256.txt. The script validates that hash before deserializing the user's locally created model, along with metrics status, feature contract, class mapping, threshold and exact ML dependency versions. Python major/minor must match training. joblib loading is intended only for this locally produced, reviewed artifact.

## What is checked
- A fixed-seed uniform reservoir of 100 primary test candidates per capture: normal_10, normal_11, normal_12, normal_scanning5, normal_scanning6 (500 records). This selection does not tune the model or measure a new independent accuracy score.
- Candidate CSV and stage-2 audit hashes must match the training metrics. Original conn.log file hashes must match the stage-2 manifest. Sample source line hashes must match original bytes including line endings.
- Original TSV conversion uses the prior parser. The application backend's actual app/flow_features.py is imported locally. Its ordered nine features and quality flags must agree with the bundled adapter and the prepared CSV features.
- Saved model predictions on derived feature vectors must match direct pipeline predictions on the corresponding prepared CSV vectors, within 1e-12 for scores.
- Guard cases check missing duration, genuine zero duration, content gap, missing packet counts, unsupported protocol, negative duration, invalid IP, missing gap metadata and malformed JSON.

## Adapter policy
Offline predictions are allowed only for clean records or records with missing duration as their sole quality flag. Other missingness never appeared in fitted input and remains unvalidated. Zero duration is retained as zero; missing duration is passed through the saved training-fitted preprocessing. feature_valid remains false for missing duration: the adapter does not rewrite the original collection contract. Rejected inputs receive prediction=null.

Predictions carry the scope provisional_normal_vs_scanning_only, model contract, ordered vector, quality flags, and an uncalibrated Random Forest scanning score. A normal prediction does not establish benign/safe traffic, and a scanning prediction is not a confirmed incident. Timestamp/IP/UID serve as source metadata, not model features.

## Outputs
- inference_check.json: completed status, sample counts and predictions by capture, guard case results, model/metrics/backend-extractor hashes and limitations.
- predictions.jsonl: offline sample predictions and original source file/line hashes, converted-JSON hash, feature vectors, reference labels and provenance. raw_sha256 refers to derived JSON; source_line_sha256 identifies original TSV bytes.

test_inference.py runs first: missing-versus-zero handling, unsupported quality rejection, malformed JSON rejection, feature contract/hash checks, and an end-to-end synthetic original-evidence parity run. Actual saved model and Windows backend parity are verified only by the user's subsequent run.

No server request, database write, retraining, threshold adjustment, dashboard integration or live compatibility claim is performed. A completed report establishes parity for the sampled records and guards, not generalisation to new networks.
