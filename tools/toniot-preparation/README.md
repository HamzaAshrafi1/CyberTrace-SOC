# TON_IoT offline preparation
Extract this folder under D:\CAPSTONE\tools. Run run_prepare.ps1 with PowerShell using the project Python 3.10 virtual environment. Standard library only; no service, API key, Docker or package install required.

Outputs two JSONL files and audit.json into a new timestamped directory under the dataset root. This does not ingest dashboard data, train a model or create train/test splits. Output can take several hundred MB because original evidence and derived data are both retained.

Original TSV lines, line numbers, file SHA-256 hashes, original decimal timestamps and converted Zeek records are retained separately. normalized.raw_sha256 identifies the converted JSON string, NOT the source TSV; source_line_sha256 identifies the original bytes including the line ending. Preserve the input files alongside outputs. Feature extraction uses the project's zeek-conn-v1 implementation bundled in flow_features.py; missing numbers stay null.

Ground-truth matching uses the directional endpoints, ports, protocol and decimal timestamp rounded half-up to the nearest second. This convention was inferred from this capture and must be checked on additional captures. Shared flow keys, repeated ground-truth keys and conflicting labels are flagged and excluded from label_eligible. Unmatched flows are unlabelled. Label eligibility does not imply feature validity or model compatibility.

normal_13 labels are provisional capture-directory labels, not row-level ground-truth matches; label_eligible remains false pending documentation and contamination review. Do not use these outputs as a validated benchmark. Several independent captures per class are needed for capture-disjoint evaluation; avoid random row splits, endpoint leakage and silently dropping missing-duration traffic. Any imputation must be fit on training data only, with an explicit revised model feature contract.
