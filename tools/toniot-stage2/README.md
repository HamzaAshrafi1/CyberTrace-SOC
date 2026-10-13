# TON_IoT stage 2: provisional binary benchmark partitions

Extract to D:\CAPSTONE\tools and run run_partitions.ps1. Uses the project Python 3.10 virtual environment and standard library only. No Docker, database server, network, keys or package installation needed. It writes a new timestamped directory in the dataset's prepared folder; previous audits are preserved.

## Fixed capture plan
Train: normal_1 to normal_5; normal_scanning_1, normal_scanning2.
Validation: normal_6 to normal_9; normal_scanning3.
Test: normal_10 to normal_12; normal_scanning4, normal_scanning5, normal_scanning6.
normal_13 and both normal_IoT captures are held aside due to overlapping periods. scanning5 and scanning6 overlap but both remain in test. This is a chronological split within each class, not a common chronological boundary across classes: normal and scanning were captured on different dates.

## Operation and outputs
Processes all selected conn.log files, then every CSV in SecurityEvents_Network_datasets. There are over eight million selected scanning flows. Expect a sustained disk-intensive run and several GB of output. Progress is printed as records are processed. The script refuses an existing output folder and stops on malformed input.

- audit.sqlite: flow features, source line references/hashes, labels lookup, duplicate identity and ambiguous-key tables; excluded records are retained here.
- train_candidates.csv, validation_candidates.csv, test_candidates.csv: filtered candidates only; original schema's nine ordered features, labels, label provenance, quality flags and evidence references. Blank numeric fields mean missing, never zero.
- audit.json: status complete, input paths/SHA-256 hashes, ground-truth row counts, capture plan, exclusion counts and limitations.

These are CANDIDATES, not a validated benchmark or model. Normal labels are explicit provisional directory-level assumptions. Any matching attack ground truth in a normal capture excludes that flow. Absence of a match is not proof of benign traffic. No automatic verification claim is made for normal labels.

Scanning candidates require one scanning label at the directional five-tuple and decimal timestamp rounded half-up to nearest second. This convention was empirically inferred from scanning6, not established for every capture. Duplicate ground-truth keys, conflicting labels, and multiple flows sharing the capture's rounded key are excluded. Other attack types and unmatched flows are excluded from this binary benchmark.

Exact timestamp plus directional endpoint/port/protocol identifies repeated flow observations independently of Zeek UID, which may change on regeneration. All repeated identities are excluded, within or across splits. This conservative rule does not establish independence of related attack campaigns. Identical feature vectors alone are not treated as duplicate evidence, since separate flows can naturally have the same features.

Missing features remain missing. Non-missing quality flags (e.g. content gaps, zero packets, inconsistent counts, unsupported protocol) exclude a candidate. Missing duration does not exclude it. Consequently candidate rows can be feature_valid=false under zeek-conn-v1. Model preprocessing and a compatible inference contract must be explicitly designed before training; preprocessing must fit on train only. Endpoints and timestamps are evidence, not model features.

Preserve source conn.log/GT files: audit.sqlite records hashes and line locations, not complete original raw lines. The hashes can be used to verify originals. The GT lookup retains label/count by key; original GT row evidence is reproducible from the hashed input CSV files.

## Local validation
Run: python-service\.venv\Scripts\python.exe D:\CAPSTONE\tools\toniot-stage2\test_partitions.py
Synthetic integration checks cover nearest-second joins, missing versus zero duration, conflicting/duplicate GT keys, shared flow keys, UID-independent cross-split repeats, unmatched flows and provisional normal labels. The uploaded scanning6/normal13 sample was also processed with GT7/GT8; the full Windows dataset must finish successfully before any training.
