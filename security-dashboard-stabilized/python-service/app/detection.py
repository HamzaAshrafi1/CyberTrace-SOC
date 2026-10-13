import re

# Regex patterns (case-insensitive for most keywords)
SQLI_PATTERN = re.compile(r"(?i)('\s*or\s*'1'\s*=\s*'1)|(union\s+select)|(drop\s+table)|(information_schema)")
BRUTE_FORCE_PATTERN = re.compile(r"(?i)(failed\s+login)|(invalid\s+password)|(authentication\s+failed)|(login\s+attempt\s+failed)")
DIR_TRAVERSAL_PATTERN = re.compile(r"(\.\./)|(/etc/passwd)")
XSS_PATTERN = re.compile(r"(?i)(<script>)|(javascript:)|(onerror\s*=)")
CMD_INJECTION_PATTERN = re.compile(r"(&&\s*whoami)|(;\s*cat\s+/etc/passwd)|(\|\s*bash)")

def detect_threat(message: str) -> dict:
    """
    Scans a log message for threat patterns using regex.
    Returns:
        dict: {
            "detected": bool,
            "attack_type": Optional[str],
            "severity": Optional[str],
            "matched_pattern": Optional[str]
        }
    """
    # Check Command Injection first (Critical severity)
    match = CMD_INJECTION_PATTERN.search(message)
    if match:
        return {
            "detected": True,
            "attack_type": "COMMAND_INJECTION",
            "severity": "CRITICAL",
            "matched_pattern": match.group(0)
        }

    # Check SQL Injection (High severity)
    match = SQLI_PATTERN.search(message)
    if match:
        return {
            "detected": True,
            "attack_type": "SQL_INJECTION",
            "severity": "HIGH",
            "matched_pattern": match.group(0)
        }

    # Check Directory Traversal (High severity)
    match = DIR_TRAVERSAL_PATTERN.search(message)
    if match:
        return {
            "detected": True,
            "attack_type": "DIRECTORY_TRAVERSAL",
            "severity": "HIGH",
            "matched_pattern": match.group(0)
        }

    # Check XSS (High severity)
    match = XSS_PATTERN.search(message)
    if match:
        return {
            "detected": True,
            "attack_type": "XSS",
            "severity": "HIGH",
            "matched_pattern": match.group(0)
        }

    # Check Brute Force (Medium severity)
    match = BRUTE_FORCE_PATTERN.search(message)
    if match:
        return {
            "detected": True,
            "attack_type": "BRUTE_FORCE",
            "severity": "MEDIUM",
            "matched_pattern": match.group(0)
        }

    return {
        "detected": False,
        "attack_type": None,
        "severity": None,
        "matched_pattern": None
    }
