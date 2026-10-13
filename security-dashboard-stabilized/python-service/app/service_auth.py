"""Short-lived server-to-server claims. Never send the shared secret to a browser."""
import base64
import binascii
import hashlib
import hmac
import json
import os
import time

ROUTE_PERMISSIONS = {
    "/api/v1/chat": {"write:chatbot"},
    "/api/v1/document/upload": {"write:chatbot"},
    "/api/v1/summarize": {"write:threats", "write:incidents", "read:hunts"},
    "/api/v1/hunt/search": {"read:hunts"},
    "/api/v1/hunt/ai": {"read:hunts"},
    "/api/v1/lab/runs": {"read:lab"},
    "/api/v1/lab/simulate": {"write:lab"},
    "/api/v1/lab/ai-generate": {"write:lab"},
    "/api/v1/realtime/events": {"read:threats"},
    "/api/v1/realtime/publish": {"internal:publish"},
}

def verify_context(encoded, signature, path, now=None):
    secret = os.getenv("AEGIS_SERVICE_SECRET", "")
    if len(secret) < 32:
        raise ValueError("Service authentication is not configured")
    if not isinstance(encoded, str) or not isinstance(signature, str) or not encoded or not signature or len(encoded) > 2048:
        raise ValueError("Missing service credentials")
    expected = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Invalid service signature")
    try:
        claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        current = time.time() if now is None else now
        if not isinstance(claims, dict):
            raise ValueError("Invalid claims")
        expiry = claims["exp"]
        if not isinstance(expiry, int) or expiry <= current or expiry > current + 65:
            raise ValueError("Expired or invalid service context")
        if not isinstance(claims["tenant"], str) or not claims["tenant"]:
            raise ValueError("Missing tenant")
        if claims["permission"] not in ROUTE_PERMISSIONS.get(path, set()):
            raise ValueError("Permission denied")
        return claims
    except (KeyError, TypeError, json.JSONDecodeError, UnicodeDecodeError, binascii.Error) as exc:
        raise ValueError("Invalid service context") from exc

def assert_tenant(claims, supplied):
    if supplied != claims["tenant"]:
        raise ValueError("Tenant mismatch")
