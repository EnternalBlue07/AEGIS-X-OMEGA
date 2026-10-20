import hmac
import hashlib
import base64
import json
import time
from typing import Optional, Dict, Any

SECRET_KEY = "AEGIS-X-SUPER-SECURE-KEY-2026-DONOTSHARE-OR-LEAK-THIS"

# Valid Personas
USERS_DB = {
    "priya@aegisx.io": {"name": "Priya", "role": "ANALYST", "password": "analyst_priya"},
    "rahul@aegisx.io": {"name": "Rahul", "role": "COMPLIANCE", "password": "compliance_rahul"},
    "meera@aegisx.io": {"name": "Meera", "role": "OPERATIONS", "password": "ops_meera"},
    "dev@aegisx.io": {"name": "Dev", "role": "RISK_ENGINEER", "password": "risk_engineer"}
}

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: dict, expires_in: int = 3600) -> str:
    """
    Creates a JWT token signed with HMAC-SHA256.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    
    payload = payload.copy()
    payload["exp"] = int(time.time()) + expires_in
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies the JWT token and returns the payload if valid.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_signature_b64 = base64url_encode(expected_signature)
        
        if not hmac.compare_digest(signature_b64, expected_signature_b64):
            return None
            
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        
        if "exp" in payload and payload["exp"] < time.time():
            return None
            
        return payload
    except Exception:
        return None
