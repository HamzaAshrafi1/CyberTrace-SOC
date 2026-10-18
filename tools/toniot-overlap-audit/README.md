# Exact feature overlap audit
This package evaluates the balanced Random Forest artifact without retraining or changing the worker. It pins the model SHA-256 supplied in the completed metrics, verifies model/input/manifest hashes before loading, reconstructs selected training feature vectors and reproduces the original validation/test confusion matrices.

For each split it reports all records, exact-feature overlap, non-overlap, and each capture's overlap/non-overlap groups. Each group includes counts, confusion matrix, accuracy, class-specific F1, FPR/FNR, macro F1 and balanced accuracy. Macro F1 and balanced accuracy are null when a group has only one actual class. It also counts training feature vectors with both labels and evaluation overlap with only the opposite training label.

Exact vector equality is common for short connections; it is not proof of duplicated evidence or leakage. Non-overlap of exact vectors is not campaign independence or a fresh benchmark. Keep every group; do not report only the best-performing subset.

Run run_overlap.ps1 in PowerShell after extraction to D:\CAPSTONE\tools. The existing balanced-venv is reused. No stack restart is needed. A new timestamped output preserves the existing results. Report status must be complete; partial failure is not valid evidence. Synthetic metric tests passed; actual dataset execution and artifact prediction reproduction are performed on your Windows machine.
