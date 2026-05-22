import re
import logging

logger = logging.getLogger(__name__)

class SecurityService:
    def __init__(self):
        # Regex patterns for hardcoded secrets
        self.secret_patterns = [
            {"name": "AWS Access Key", "pattern": r"AKIA[0-9A-Z]{16}", "severity": "critical"},
            {"name": "AWS Secret Key", "pattern": r"(?i)aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}", "severity": "critical"},
            {"name": "GitHub Token", "pattern": r"ghp_[0-9a-zA-Z]{36}", "severity": "critical"},
            {"name": "Slack Token", "pattern": r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[0-9a-zA-Z]{24,34}", "severity": "critical"},
            {"name": "Generic Secret", "pattern": r"(?i)(password|secret|api_key|apikey|token)\s*=\s*['\"][^'\"]{8,}['\"]", "severity": "high"},
        ]
        
        # Regex patterns for dangerous code practices
        self.vulnerability_patterns = [
            {"name": "Dangerous eval()", "pattern": r"eval\s*\(", "severity": "high"},
            {"name": "Shell Injection", "pattern": r"subprocess\.(call|run|Popen)\(.*shell\s*=\s*True", "severity": "high"},
            {"name": "SQL Injection risk", "pattern": r"execute\s*\(\s*f[\"']", "severity": "medium"},
            {"name": "Pickle Deserialization", "pattern": r"pickle\.loads?\s*\(", "severity": "high"},
        ]

    def scan_code(self, code: str) -> dict:
        """Scans code string for secrets and vulnerabilities"""
        findings = []
        
        # Scan for secrets
        for pattern in self.secret_patterns:
            matches = re.finditer(pattern["pattern"], code)
            for match in matches:
                findings.append({
                    "type": "Secret Leak",
                    "name": pattern["name"],
                    "severity": pattern["severity"],
                    "line": code[:match.start()].count('\n') + 1,
                    "snippet": match.group(0)[:20] + "..." # Truncate to avoid logging the whole secret
                })
                
        # Scan for vulnerabilities
        for pattern in self.vulnerability_patterns:
            matches = re.finditer(pattern["pattern"], code)
            for match in matches:
                findings.append({
                    "type": "Security Anti-Pattern",
                    "name": pattern["name"],
                    "severity": pattern["severity"],
                    "line": code[:match.start()].count('\n') + 1,
                    "snippet": match.group(0)
                })

        critical_count = len([f for f in findings if f["severity"] == "critical"])
        high_count = len([f for f in findings if f["severity"] == "high"])
        
        return {
            "is_secure": critical_count == 0 and high_count == 0,
            "findings": findings,
            "summary": f"Found {len(findings)} issues ({critical_count} Critical, {high_count} High)."
        }

# Singleton
security_service = SecurityService()