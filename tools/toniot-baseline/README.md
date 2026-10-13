# Provisional TON_IoT normal-versus-scanning baseline

Extract under D:\CAPSTONE\tools. Run run_baseline.ps1. It creates D:\CAPSTONE\tools\toniot-ml-venv using Python 3.10 and installs pinned ML dependencies there. The application backend virtual environment remains unchanged. First run needs internet for Python wheels; training itself is local, CPU-only and requires no paid API, Docker or GPU.

The prepared directory is fixed to partitions-20261006-192038. Edit the PowerShell variable if yours differs. The script requires audit.json status complete and schema zeek-conn-v1. It checks expected capture names, labels, label provenance, source identity hashes and allowed quality flags.

## Fixed protocol
- All normal training candidates retained. Reservoir-sample up to 50,000 scanning records independently from each of normal_scanning_1 and normal_scanning2. Seed 42; output training_sample.csv records chosen source lines and identity hashes.
- Median imputation fitted only to sampled training records, with fixed missingness indicators for all nine features. Null and zero remain distinct. Entirely missing training columns cause failure instead of a fabricated median.
- Random Forest: 200 trees, max_depth 16, min_samples_leaf 5, max_features sqrt, balanced_subsample class weights, four CPU workers. This fixed baseline is not a hyperparameter search.
- Fixed threshold 0.5. Validation is scored, then primary test is scored once, with no threshold/hyperparameter changes or refitting on validation.
- Full validation candidate proportions retained. Primary test retains every normal_10–12 candidate and every scanning5–6 candidate. All scanning4 candidates held aside because of label coverage, before seeing model performance. Original files are not modified. Held-aside record count is reported.
- Sampled train, full validation and primary test identities are registered in SQLite with a uniqueness constraint; repeated identities abort evaluation. Stage 2 performed a more comprehensive identity exclusion across original partitions.

Input features, in order: duration_s, orig_pkts, resp_pkts, orig_ip_bytes, resp_ip_bytes, total_pkts, total_ip_bytes, orig_packet_share, protocol_code. Labels, endpoint addresses, source paths, timestamps, capture names and hashes never enter the estimator. Preprocessing produces nine imputed values plus nine missingness indicators.

## Outputs
A fresh D:\CAPSTONE\datasets\TON_IoT\models\baseline-<timestamp> directory contains:
- metrics.json: complete status, validation/test and per-capture metrics, confusion matrices, precision/recall, macro F1, balanced accuracy, normal false-positive and scanning false-negative rates, ROC AUC, average precision for both classes, always-scanning baseline, sampling, versions, fitted medians, importance, input/model hashes and limitations.
- baseline.joblib: a dictionary containing the complete fitted pipeline, ordered features, class mapping, threshold and offline provisional status. Saved output is reloaded locally to check prediction equivalence.
- training_sample.csv: sampled training evidence references, not invented labels.
- evaluated_identities.sqlite: evaluated/sampled identity registry, useful for checking overlap.

## Interpretation
Normal labels remain provisional capture-directory assumptions. Normal and scanning were collected on different dates: date/campaign artifacts may influence results even without timestamps as features. This is a within-dataset binary benchmark, not an all-attack detector. Missing-duration traffic is retained, but missingness itself may act as a dataset artifact; review importance and future missingness ablation. ROC AUC and especially accuracy do not establish operational suitability; normal false-positive rate and both class recalls must be examined. Per-capture partitions with one class have null ROC AUC/balanced accuracy; their confusion matrices and class recall are more useful than macro F1.

Forest scores are not calibrated probabilities or real-world attack confidence. Labelled subsets can be biased by excluded unmatched flows. No arbitrary pass/fail claim or dashboard integration is made. No model is trained on this machine on the user's full dataset; run the supplied command locally and review metrics first. Repeatedly tuning against these test results would turn test into validation, requiring a new held-out evaluation.

The inference contract is toniot-binary-rf-median-missing-v1, using zeek-conn-v1 raw features plus trained imputation/indicators. Do not change feature_valid semantics or deploy until the live adapter is tested with the saved model and the same dependency versions. joblib should load only the model you created locally; it is not a safe interchange format for untrusted files.

## Checks
The runner executes test_baseline.py before training: training-only imputer state, fixed missingness dimensions, reproducible capture sampling, duplicate identity rejection, scanning4 exclusion, missing-versus-zero preservation and false-positive metric correctness. A synthetic end-to-end CLI run checks the final output/save path without treating synthetic scores as project results.

Dependencies are pinned for Python 3.10 compatibility: NumPy 2.2.6, SciPy 1.15.3, scikit-learn 1.7.2, joblib 1.5.3, threadpoolctl 3.6.0. Runtime versions are recorded in metrics.json. Keep this environment for later offline inference; do not load its model with a different scikit-learn version.
