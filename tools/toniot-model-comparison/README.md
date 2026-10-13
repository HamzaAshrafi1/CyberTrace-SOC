# Five-model TON_IoT comparison

Offline report experiment, not a deployment patch. Resume the incident lifecycle work after this experiment.

## Data and scope

Uses prepared partitions-20261006-192038, its audited raw Bro connection features, and the training_sample.csv from baseline-20261006-205121. It does NOT train on the separate train_test_network.csv, re-extracted Zeek 8 logs, or all TON_IoT attack types. Task: provisional normal versus scanning. Nine collection features are followed by train-fitted median imputation and nine missingness indicators (18 transformed inputs). Labels/addresses/timestamps/capture IDs are not model features.

Each candidate input file is SHA-256 checked against the original baseline metadata. The original deterministic reservoir sample (50,000 scanning records per training scanning capture plus all eligible normal rows) is reproduced and its CSV hash must match the original training manifest. All five models receive those exact rows. Known production run counts: 120,191 training rows (20,191 normal, 100,000 scanning), 684,423 validation and 505,339 primary test rows. normal_scanning4 stays excluded. Identical evaluated identities across training/validation/test cause failure. Every split must contain the original expected captures.

## Fixed models

- Logistic Regression: lbfgs, C=1, 3,000 iterations, balanced class weights; StandardScaler after imputation, fitted only on training. Convergence warnings are recorded.
- Decision Tree: depth 16, leaf minimum 5, balanced weights.
- Random Forest: 200 trees, depth 16, leaf minimum 5, sqrt feature selection, balanced_subsample; same fixed settings as existing baseline.
- Extra Trees: 200 trees, depth 16, leaf minimum 5, sqrt selection, balanced weights.
- XGBoost 3.0.5: 200 trees, depth 6, learning rate 0.1, histogram CPU training, L2 regularization 1; negative/positive class ratio is training-derived scale_pos_weight. No early stopping.

Seed 42, CPU thread budget 4 and decision threshold 0.5. No tuning or winner selection. Models use their standard documented class-balancing approaches, rather than identical numerical weight implementation. These are fixed baseline configurations, not equally optimized models. The previously examined test partition must be described as a retrospective comparison holdout. It is not a new untouched test.

## Run on Windows

Extract to D:\CAPSTONE\tools, then run run_comparison.ps1. A separate Python 3.10 comparison virtual environment is created; the deployed worker environment, artifacts, credentials and application files are untouched. Pinned binary dependencies include XGBoost. It runs four tests before training. Windows XGBoost needs the Visual C++ runtime; if a DLL error appears, send that exact error. Do not switch model versions mid-experiment without recording it.

Output: D:\CAPSTONE\datasets\TON_IoT\model_comparisons\five-models-<timestamp>.

- comparison.json: complete metrics, per-capture reports, class counts, confusion matrices, fit warnings, model parameters, file hashes, sample policy, software versions and limitations. status must equal complete.
- comparison.csv: 10 report rows (five models x validation/test), accuracy, balanced accuracy, macro F1, class precision/recall/F1, FPR/FNR, ROC AUC, PR AUC, fit/inference timings and convergence status.
- training_sample.csv and evaluated_identities.sqlite: reproducibility and overlap checks.
- five joblib artifacts: offline comparison only. Never put them into the worker's model directory.

Inference time excludes loading/parsing and metrics; includes fitted preprocessing and classifier in 20,000-row batches, after warm-up. Single-pass timing is hardware-dependent, not an online latency benchmark. Progress is printed while input CSVs are read and when each model is fitted/evaluated. No full dataset is available to this packaging environment; do not interpret the fixture tests as actual TON_IoT performance. On your machine, the full run may take substantial time. Partial reports carry running/failed status, not complete.

## Report interpretation

Prioritize macro F1 and both classes' precision/recall, alongside false positive and false negative rates. Accuracy is strongly affected by scanning-majority prevalence. Keep quality exclusions and provisional normal-label assumptions visible. Per-capture results matter because normal and scanning capture dates/campaigns differ. Scores are uncalibrated; no model score establishes maliciousness or safety. Do not tune from the observed test or claim fresh independent validation. Broader attacks and live traffic require separate future studies.

## Package validation

Four checks exercise imbalance-sensitive metrics, overlap rejection, training-only preprocessing across all models, and a complete five-model run on a generated fixture including manifests, metrics, saved artifacts and CSV outputs. Actual dataset training must be executed on the Windows installation.
