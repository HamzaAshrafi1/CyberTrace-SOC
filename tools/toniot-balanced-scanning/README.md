# Balanced normal versus scanning training checkpoint

This experiment finishes the balanced-training step for the existing nine-feature flow contract. It is not an all-attack model or fresh independent benchmark. Old results and deployed model remain unchanged.

## Protocol frozen before this run
- Existing audited capture partitions: train normal1–5 and scanning_1/2; validation normal6–9 and scanning3; primary test normal10–12 and scanning5/6. Scanning4 remains held aside due to incomplete label coverage. Normal13 remains separate.
- Keep all 20,191 eligible normal training rows. Select 20,191 scanning rows with deterministic reservoir sampling: 10,095 scanning_1 and 10,096 scanning2 (capture names sorted lexically). Total expected training rows: 40,382. The per-capture distribution balances contribution, not independent campaign coverage.
- Only missing duration is supported. Any other missing input stops the run for investigation; malformed/unsupported quality is excluded by earlier audited preparation.
- Nine features plus nine fixed missingness indicators. Training-only median imputation. No IP/port/time/UID/capture/label inputs.
- Fixed Random Forest: 200 trees, depth16, min leaf5, sqrt feature selection, seed42, CPU4. Class weight None because the training sample is already balanced. No tuning, calibration or threshold search. Threshold0.5 is prespecified.
- Evaluate all eligible validation and primary-test rows unchanged. Additionally select equal normal/scanning subsets with seed42 as diagnostics only, not new independent test sets.
- Fail on changed input hashes and repeated exact flow identities. Report exact raw numeric feature-vector overlap with training by class; equality is diagnostic and does not prove that distinct flows are duplicates. Per-capture metrics remain available.
- Save pipeline and preprocessing together, model hash, training manifest/hash, dependency versions, class counts, medians, metrics and limitations. Saved/reloaded prediction parity is checked.

## Run
Expand package into D:\CAPSTONE\tools, then run run_balanced.ps1 in PowerShell. Backend/frontend need not be stopped; training uses an isolated virtual environment and does not load or update the worker. With limited RAM/CPU, stop the stack while training if desired.

## Read outputs
balanced_metrics.json is authoritative; summary.md is a compact review summary. Confusion matrix rows and columns are [normal, scanning]. normal_false_positive_rate measures provisionally normal flows flagged scanning. scanning_false_negative_rate measures scanning flows predicted normal. Read normal F1 and scanning F1 separately. Report rejected/excluded counts from the preparation audit alongside evaluation results; the candidate CSV cannot reconstruct full collection coverage alone.

Do not call 99% accuracy production accuracy. The test set was previously examined and normal labels are provisional. Strong metrics can persist after balancing if captures are distinguishable. Fresh independent captures are still needed for a stronger final performance claim.

## Before integration
Inspect actual metrics, feature overlap, false positives, misses and per-capture results. Offline/runtime parity must be verified for the new artifact and model contract before deployment. Do not manually replace the old baseline.joblib or pinned worker hash. No automated promotion is performed.

## Tests
Three tests cover deterministic equal-class quotas, training-only preprocessing, a complete experiment fixture, overlap reporting, balanced diagnostics and changed-input refusal. Local packaging tests use the available Linux runtime; Windows runner reruns them under the exact pinned package versions before actual training.
