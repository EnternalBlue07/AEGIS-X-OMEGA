import random
import json
import time
import re
import hashlib
from fastapi import FastAPI, HTTPException, BackgroundTasks, Response, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

from .data import db, Alert, Transaction, AuditLog
from .graph import l3_scorer
from .timeline import timeline_generator
from .agents import agent_swarm
from .simulator import adversarial_simulator
from .export import generate_pdf, generate_docx, generate_pptx
from .auth import USERS_DB, create_jwt, verify_jwt
from .evidence_vault import build_case_vault
from .red_team import autonomous_red_team
from .sentinel import sentinel_engine
from .chronos import chronos_engine

app = FastAPI(title="AEGIS-X Autonomous Financial Crime OS API")

# Setup CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # react local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security Middlewares (Extreme Security) ---

# 1. Secure HTTP Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 http://127.0.0.1:5173 http://localhost:5173;"
    )
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response

# 2. IP Rate Limiting Middleware
requests_tracker = {}

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Clean older requests from last 60s
        if client_ip in requests_tracker:
            requests_tracker[client_ip] = [t for t in requests_tracker[client_ip] if now - t < 60]
        else:
            requests_tracker[client_ip] = []
            
        # 100 requests per 60 seconds per IP
        if len(requests_tracker[client_ip]) >= 100:
            return Response(
                content=json.dumps({"detail": "Extreme Security Warning: Request rate limit exceeded."}),
                status_code=429,
                media_type="application/json"
            )
        requests_tracker[client_ip].append(now)
        
    return await call_next(request)

# 3. Input Sanitization (XSS & SQL Injection Mitigation)
SQL_XSS_REGEX = re.compile(
    r"(<script>|javascript:|onclick|onload|onerror|<iframe|<embed|DROP TABLE|TRUNCATE TABLE|DELETE FROM|SELECT \*|UNION SELECT|INSERT INTO|OR\s+1\s*=\s*1|--|\bALTER\b)",
    re.IGNORECASE
)

@app.middleware("http")
async def input_sanitization_middleware(request: Request, call_next):
    if request.method in ["POST", "PUT", "PATCH"] and request.url.path.startswith("/api/"):
        body = await request.body()
        # Cache request body back for routing handlers to consume
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}
        request._receive = receive
        
        try:
            body_str = body.decode("utf-8")
            if SQL_XSS_REGEX.search(body_str):
                return Response(
                    content=json.dumps({"detail": "Extreme Security: Malicious script or query input detected."}),
                    status_code=400,
                    media_type="application/json"
                )
        except Exception:
            pass
            
    return await call_next(request)

# --- Dependency: JWT Auth Verification ---
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token missing or invalid")
    token = authorization.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Authentication token expired or invalid")
    return payload

# API Schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class ActionRequest(BaseModel):
    action: str  # FREEZE, DISMISS, FILE_SAR, CLEAR
    notes: Optional[str] = None
    actor: str = "ANALYST_PRIYA"

class SimulationRequest(BaseModel):
    scenario_type: str  # MULE_RING, TRAVEL_SPOOF, BSA_STRUCTURING

class TelemetryRequest(BaseModel):
    cpm: int
    jitter: float

class LogEventRequest(BaseModel):
    case_id: str
    event_type: str
    actor: str
    payload: Dict[str, Any]
    branch: Optional[str] = "main"

class ForkRequest(BaseModel):
    parent_branch: str
    new_branch_name: str

@app.get("/")
def read_root():
    return {"status": "ONLINE", "service": "AEGIS-X Core Engine", "timestamp": datetime.now().isoformat()}

# --- Authentication Endpoint ---
@app.post("/api/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    if email not in USERS_DB or USERS_DB[email]["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_info = USERS_DB[email]
    token = create_jwt({"email": email, "name": user_info["name"], "role": user_info["role"]}, expires_in=3600)
    return {"access_token": token, "token_type": "bearer", "user": {"email": email, "name": user_info["name"], "role": user_info["role"]}}

# --- Alert Endpoints (Protected) ---

@app.get("/api/alerts")
def get_alerts(current_user: dict = Depends(get_current_user)):
    return list(db.alerts.values())

@app.get("/api/alerts/{alert_id}")
def get_alert_detail(alert_id: str, current_user: dict = Depends(get_current_user)):
    if alert_id not in db.alerts:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert = db.alerts[alert_id]
    
    # Resolve transaction and account details
    account_id = None
    txn = None
    if alert.entity_type == "ACCOUNT":
        account_id = alert.entity_id
        txns = [t for t in db.transactions.values() if t.account_id == account_id or t.counterparty_account_id == account_id]
        if txns:
            txn = sorted(txns, key=lambda x: x.timestamp)[-1]
    elif alert.entity_type == "TRANSACTION":
        if alert.entity_id in db.transactions:
            txn = db.transactions[alert.entity_id]
            account_id = txn.account_id
            
    account = db.accounts.get(account_id) if account_id else None
    user = db.users.get(account.user_id) if account and account.user_id in db.users else None
    
    return {
        "alert": alert,
        "account": account,
        "user": user,
        "latest_transaction": txn
    }

@app.post("/api/alerts/{alert_id}/investigate")
def investigate_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    if alert_id not in db.alerts:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Run the multi-agent swarm
    result = agent_swarm.run_investigation(alert_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/api/alerts/{alert_id}/export")
def export_case_report(alert_id: str, format: str = "pdf", current_user: dict = Depends(get_current_user)):
    if alert_id not in db.alerts:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert = db.alerts[alert_id]
    
    # Resolve account & txn context
    account_id = None
    txn = None
    if alert.entity_type == "ACCOUNT":
        account_id = alert.entity_id
        txns = [t for t in db.transactions.values() if t.account_id == account_id or t.counterparty_account_id == account_id]
        if txns:
            txn = sorted(txns, key=lambda x: x.timestamp)[-1]
    elif alert.entity_type == "TRANSACTION":
        if alert.entity_id in db.transactions:
            txn = db.transactions[alert.entity_id]
            account_id = txn.account_id
            
    account = db.accounts.get(account_id) if account_id else None
    user = db.users.get(account.user_id) if account and account.user_id in db.users else None
    
    # Trigger/load investigation swarm
    investigation = agent_swarm.run_investigation(alert_id)
    if "error" in investigation:
        raise HTTPException(status_code=400, detail=investigation["error"])
        
    # Get timeline
    timeline = []
    if account_id:
        timeline = timeline_generator.generate_timeline(account_id, "ACCOUNT")
        
    format = format.lower()
    if format == "pdf":
        file_bytes = generate_pdf(alert, account, user, txn, investigation, timeline)
        media_type = "application/pdf"
        file_name = f"AEGIS-X_Case_{alert_id}.pdf"
    elif format == "docx":
        file_bytes = generate_docx(alert, account, user, txn, investigation, timeline)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        file_name = f"AEGIS-X_Case_{alert_id}.docx"
    elif format == "pptx":
        file_bytes = generate_pptx(alert, account, user, txn, investigation, timeline)
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        file_name = f"AEGIS-X_Case_{alert_id}.pptx"
    else:
        raise HTTPException(status_code=400, detail="Invalid export format. Supported: pdf, docx, pptx")
        
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={file_name}"}
    )

@app.post("/api/alerts/{alert_id}/action")
def execute_alert_action(alert_id: str, req: ActionRequest, current_user: dict = Depends(get_current_user)):
    if alert_id not in db.alerts:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert = db.alerts[alert_id]
    
    # Update alert status
    new_status = "UNDER_INVESTIGATION"
    if req.action == "FREEZE":
        new_status = "UNDER_INVESTIGATION"
        # Freeze target account
        account_id = None
        if alert.entity_type == "ACCOUNT":
            account_id = alert.entity_id
        elif alert.entity_type == "TRANSACTION" and alert.entity_id in db.transactions:
            account_id = db.transactions[alert.entity_id].account_id
            
        if account_id and account_id in db.accounts:
            db.accounts[account_id].status = "FROZEN"
            db.add_audit_log(req.actor, "FREEZE_ACCOUNT", account_id, f"Account status set to FROZEN. Notes: {req.notes}")
            
    elif req.action == "DISMISS":
        new_status = "DISMISSED"
        db.add_audit_log(req.actor, "DISMISS_ALERT", alert_id, f"Alert marked as false positive. Notes: {req.notes}")
    elif req.action == "FILE_SAR":
        new_status = "FILED_SAR"
        db.add_audit_log(req.actor, "FILE_SUSPICIOUS_ACTIVITY_REPORT", alert_id, f"SAR filed with FinCEN regulators. Notes: {req.notes}")

    alert.status = new_status
    return {"status": "SUCCESS", "alert_status": new_status}

# --- Investigation Timeline (Protected) ---

@app.get("/api/accounts/{account_id}/timeline")
def get_account_timeline(account_id: str, current_user: dict = Depends(get_current_user)):
    timeline = timeline_generator.generate_timeline(account_id, "ACCOUNT")
    if not timeline:
        raise HTTPException(status_code=404, detail="Timeline not found or no historical records exist")
    return timeline

# --- Network Graph (Protected) ---

@app.get("/api/network-graph")
def get_network_graph(current_user: dict = Depends(get_current_user)):
    return l3_scorer.get_d3_graph()

# --- Predictions (Layer 6) (Protected) ---

@app.get("/api/predictions")
def get_predictions(current_user: dict = Depends(get_current_user)):
    return db.predictions

# --- Simulation Endpoints (Protected) ---

@app.post("/api/simulation/run")
def run_simulation_scenario(req: SimulationRequest, current_user: dict = Depends(get_current_user)):
    result = adversarial_simulator.run_scenario(req.scenario_type)
    return result

@app.post("/api/simulation/live-traffic")
def trigger_live_traffic(current_user: dict = Depends(get_current_user)):
    txn = adversarial_simulator.generate_random_live_traffic()
    return {
        "status": "SUCCESS", 
        "transaction": txn,
        "message": f"Generated live traffic transaction ending in {txn.id[-6:]}"
    }

# --- System Audit Logs & KPIs (Protected) ---

@app.get("/api/audit-logs")
def get_audit_logs(current_user: dict = Depends(get_current_user)):
    return sorted(db.audit_logs, key=lambda x: x.timestamp, reverse=True)

@app.get("/api/metrics")
def get_system_metrics(current_user: dict = Depends(get_current_user)):
    alerts = list(db.alerts.values())
    total_alerts = len(alerts)
    critical_alerts = len([a for a in alerts if a.severity == "HIGH" and a.status == "OPEN"])
    investigated = len([a for a in alerts if a.status in ["FILED_SAR", "DISMISSED"]])
    active_mules = len([a for a in db.accounts.values() if a.status == "FROZEN"])

    return {
        "kpis": {
            "total_alerts": total_alerts,
            "critical_alerts": critical_alerts,
            "investigated_cases": investigated,
            "active_mule_rings": active_mules
        },
        "model_performance": {
            "p95_latency_ms": 118,
            "p99_latency_ms": 240,
            "psi_drift_score": 0.08,
            "champion_auc": 0.942,   # XGBoost
            "challenger_auc": 0.928, # LightGBM
            "latency_history_ms": [105, 120, 112, 134, 118, 122, 109, 118],
            "drift_history": [0.04, 0.05, 0.05, 0.07, 0.06, 0.08, 0.08, 0.08]
        },
        "quantum_readiness": {
            "rsa_2048_risk": "CRITICAL",
            "ecc_256_risk": "HIGH",
            "pqc_kyber_mitigation": "OPTIMAL (98% deployed)",
            "shors_horizon_years": {
                "2030": 15,
                "2040": 65,
                "2050": 95
            }
        }
    }

# --- AEGIS-X OMEGA: Red-Team & Cryptographic Evidence Vault Endpoints ---

@app.get("/api/red-team/run")
def run_red_team_scan(current_user: dict = Depends(get_current_user)):
    return autonomous_red_team.run_security_scan()

@app.get("/api/alerts/{alert_id}/evidence-proof")
def get_case_evidence_proof(alert_id: str, current_user: dict = Depends(get_current_user)):
    proof = build_case_vault(alert_id)
    if "error" in proof:
        raise HTTPException(status_code=404, detail=proof["error"])
    return proof

@app.post("/api/alerts/{alert_id}/verify-integrity")
def verify_case_evidence_integrity(alert_id: str, payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    if "target_hash" not in payload or "proof" not in payload:
        raise HTTPException(status_code=400, detail="Proof payload incomplete")
    
    target_hash = payload["target_hash"]
    proof = payload["proof"]
    
    current_hash = target_hash
    for step in proof:
        sibling = step["sibling"]
        if step["is_left"]:
            current_hash = hashlib.sha256((sibling + current_hash).encode('utf-8')).hexdigest()
        else:
            current_hash = hashlib.sha256((current_hash + sibling).encode('utf-8')).hexdigest()
            
    vault = build_case_vault(alert_id)
    if "error" in vault:
        raise HTTPException(status_code=404, detail="Alert vault context not resolved")
        
    expected_root = vault["root_hash"]
    is_valid = current_hash == expected_root
    
    return {
        "status": "VERIFIED" if is_valid else "FAILED",
        "verified": is_valid,
        "computed_root": current_hash,
        "expected_root": expected_root
    }

# --- AEGIS-X SENTINEL: Digital Investigator Twin Endpoints ---

@app.get("/api/sentinel/twins")
def get_sentinel_twins(current_user: dict = Depends(get_current_user)):
    return sentinel_engine.get_twins()

@app.post("/api/sentinel/update-telemetry")
def update_sentinel_telemetry(req: TelemetryRequest, current_user: dict = Depends(get_current_user)):
    return sentinel_engine.update_telemetry(req.cpm, req.jitter)

@app.post("/api/sentinel/run-debate/{alert_id}")
def run_sentinel_debate(alert_id: str, current_user: dict = Depends(get_current_user)):
    res = sentinel_engine.run_sentinel_debate(alert_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res

# --- AEGIS-X CHRONOS: Investigation Time Machine Endpoints ---

@app.post("/api/chronos/log-event")
def chronos_log_event(req: LogEventRequest, current_user: dict = Depends(get_current_user)):
    return chronos_engine.log_event(
        case_id=req.case_id,
        event_type=req.event_type,
        actor=req.actor,
        payload=req.payload,
        branch=req.branch
    )

@app.get("/api/chronos/case/{alert_id}/history")
def chronos_get_history(alert_id: str, branch: str = "main", current_user: dict = Depends(get_current_user)):
    history = chronos_engine.get_history(alert_id, branch)
    branches = chronos_engine.get_branches(alert_id)
    return {
        "case_id": alert_id,
        "branch": branch,
        "branches": branches,
        "head_commit": db.chronos_branch_pointers.get(alert_id, {}).get(branch, "GENESIS_ROOT"),
        "history": history
    }

@app.get("/api/chronos/case/{alert_id}/reconstruct")
def chronos_reconstruct_state(
    alert_id: str, 
    branch: str = "main", 
    timestamp: Optional[float] = None, 
    commit: Optional[str] = None, 
    current_user: dict = Depends(get_current_user)
):
    return chronos_engine.reconstruct_state(alert_id, branch, timestamp, commit)

@app.post("/api/chronos/case/{alert_id}/fork")
def chronos_create_fork(alert_id: str, req: ForkRequest, current_user: dict = Depends(get_current_user)):
    return chronos_engine.create_fork(alert_id, req.parent_branch, req.new_branch_name)

@app.get("/api/chronos/case/{alert_id}/diff")
def chronos_compute_diff(
    alert_id: str,
    branch_a: str,
    commit_a: str,
    branch_b: str,
    commit_b: str,
    current_user: dict = Depends(get_current_user)
):
    return chronos_engine.compute_diff(alert_id, branch_a, commit_a, branch_b, commit_b)
