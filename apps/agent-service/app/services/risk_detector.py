import re
from typing import Dict, Any, Tuple

CRITICAL_PATTERNS = [
    r"\brm\s+-[rf]{1,2}\b",
    r"\bsudo\b",
    r"\bmkfs\b",
    r"\bformat\s+[a-z]:\b",
    r"\bdrop\s+(database|table|schema)\b",
    r"\btruncate\s+table\b",
    r"\bdelete\s+from\s+[a-zA-Z0-9_]+(\s*;|\s*$)",  # delete without where
    r"\bchmod\s+(-R\s+)?777\b",
    r"\bos\.system\b",
    r"\bsubprocess\.(call|Popen|run)\b",
    r"\b(__import__|eval|exec)\b",
    r"\b(\/etc\/shadow|\/etc\/passwd)\b",
    r"\b(id_rsa|\.aws\/credentials|\.env)\b",
]

HIGH_RISK_PATTERNS = [
    r"\bdrop\b",
    r"\bkill\s+-9\b",
    r"\bdelete\b",
    r"\bwrite_file\b",
    r"\boverwrite\b",
    r"\bdeploy\b",
    r"\bmigrate\b",
    r"\bapi_key\b",
    r"\bsecret\b",
    r"\bproduction\b",
]

def evaluate_risk(action: str, details: Dict[str, Any] = None) -> Tuple[str, bool, str]:
    """
    Evaluates the risk level of an agent action or proposed code/tool call.
    
    Returns:
        (risk_level: str, requires_approval: bool, reason: str)
        risk_level in ['low', 'medium', 'high', 'critical']
    """
    text_to_check = action
    if details:
        text_to_check += " " + str(details)
    
    text_lower = text_to_check.lower()

    # Check Critical
    for pattern in CRITICAL_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return "critical", True, f"Detected critical command/pattern: {pattern}"

    # Check High Risk
    for pattern in HIGH_RISK_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return "high", True, f"Detected high risk operation: {pattern}"

    # Check Medium Risk (e.g. modifications, package installations, external requests)
    if any(k in text_lower for k in ["update", "modify", "patch", "install", "post", "put", "script"]):
        return "medium", True, "Medium risk modification requiring human sign-off"

    return "low", False, "Safe read-only or informational operation"
