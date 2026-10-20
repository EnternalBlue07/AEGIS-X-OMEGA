import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

# --- Layer 0: Core Data Models & Schemas ---

class User(BaseModel):
    id: str
    name: str
    kyc_status: str  # APPROVED, PENDING, REJECTED, SUSPENDED
    created_at: str

class Account(BaseModel):
    id: str
    user_id: str
    rail_type: str  # CARD, TRANSFER, UPI, SWIFT, CRYPTO
    opened_at: str
    status: str  # ACTIVE, FROZEN, SUSPENDED, CLOSED
    balance: float
    account_number: str

class Transaction(BaseModel):
    id: str
    account_id: str
    counterparty_account_id: str
    amount: float
    rail: str  # CARD, TRANSFER, UPI, SWIFT, CRYPTO
    timestamp: str
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    geo_lat: Optional[float] = None
    geo_lon: Optional[float] = None
    geo_country: Optional[str] = None
    merchant_name: Optional[str] = None
    status: str = "COMPLETED"  # COMPLETED, FAILED, PENDING, BLOCKED
    mule_indicator: bool = False
    
    # Realism Fields
    scenario_archetype_id: Optional[str] = None  # e.g., MULE_RING_TYPE_A
    ground_truth_label: str = "CLEAN"  # CLEAN, SUSPICIOUS, CONFIRMED_FRAUD

class Alert(BaseModel):
    id: str
    entity_id: str  # Can be account_id or transaction_id
    entity_type: str  # "ACCOUNT" or "TRANSACTION"
    triggered_by: str  # "VELOCITY_SPIKE", "IMPOSSIBLE_TRAVEL", "MULE_RING", "AML_STRUCTURING", "WATCHLIST_HIT"
    severity: str  # HIGH, MEDIUM, LOW
    status: str  # OPEN, UNDER_INVESTIGATION, FILED_SAR, DISMISSED
    created_at: str
    description: str
    
    # Realism Fields
    scenario_archetype_id: Optional[str] = None
    ground_truth_label: str = "SUSPICIOUS"

class AuditLog(BaseModel):
    id: str
    actor: str  # "SYSTEM", "ANALYST_PRIYA", "COMPLIANCE_RAHUL", "AGENT_SWARM"
    action: str
    target: str
    timestamp: str
    details: str

# --- Mock Database Store ---

class Database:
    def __init__(self):
        self.users: Dict[str, User] = {}
        self.accounts: Dict[str, Account] = {}
        self.transactions: Dict[str, Transaction] = {}
        self.alerts: Dict[str, Alert] = {}
        self.audit_logs: List[AuditLog] = []
        self.evidence: Dict[str, List[Dict[str, Any]]] = {}  # case_id -> list of evidence
        self.fraud_cases: Dict[str, Dict[str, Any]] = {}
        self.risk_scores: Dict[str, List[Dict[str, Any]]] = {}  # entity_id -> history of risk scores
        self.predictions: List[Dict[str, Any]] = []
        self.agent_outputs: Dict[str, List[Dict[str, Any]]] = {}  # case_id -> list of agent reports
        self.twin_profiles: Dict[str, Dict[str, Any]] = {}
        self.sentinel_debates: Dict[str, Dict[str, Any]] = {}
        self.chronos_event_store: List[Dict[str, Any]] = []
        self.chronos_branch_pointers: Dict[str, Dict[str, str]] = {}

        self._seed_data()

    def add_audit_log(self, actor: str, action: str, target: str, details: str):
        log = AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:6].upper()}",
            actor=actor,
            action=action,
            target=target,
            timestamp=datetime.now().isoformat(),
            details=details
        )
        self.audit_logs.append(log)

    def _seed_data(self):
        # 1. Clean Users & Accounts (Background noise)
        clean_user = User(id="USR-CLEAN01", name="Alice Chen", kyc_status="APPROVED", created_at="2025-01-15T09:00:00Z")
        self.users[clean_user.id] = clean_user
        
        clean_acc = Account(
            id="ACC-CLEAN01",
            user_id=clean_user.id,
            rail_type="CARD",
            opened_at="2025-01-15T10:00:00Z",
            status="ACTIVE",
            balance=4500.0,
            account_number="CARD-8902-1249"
        )
        self.accounts[clean_acc.id] = clean_acc

        # 2. Archetype MULE_RING_TYPE_A: Coordinated ring layering into consolidated HUB
        shared_device = "DEV-MULE-FNG7"
        shared_ip = "192.168.43.102"
        
        # Hub Account
        hub_user = User(id="USR-MULE-HUB", name="Frank Vance", kyc_status="APPROVED", created_at="2026-02-10T12:00:00Z")
        self.users[hub_user.id] = hub_user
        hub_acc = Account(
            id="ACC-MULE-HUB",
            user_id=hub_user.id,
            rail_type="TRANSFER",
            opened_at="2026-02-10T14:00:00Z",
            status="ACTIVE",
            balance=150000.0,
            account_number="TRANS-8729-1102"
        )
        self.accounts[hub_acc.id] = hub_acc

        mules = [
            ("USR-MULE01", "Mule Account Alpha", "ACC-MULE01", "UPI", "UPI-alpha@pay"),
            ("USR-MULE02", "Mule Account Beta", "ACC-MULE02", "UPI", "UPI-beta@pay"),
            ("USR-MULE03", "Mule Account Gamma", "ACC-MULE03", "TRANSFER", "TRANS-3321-9988"),
        ]

        base_time = datetime.now() - timedelta(days=2)

        for u_id, name, a_id, rail, acc_num in mules:
            user = User(id=u_id, name=name, kyc_status="PENDING", created_at=(base_time - timedelta(days=5)).isoformat())
            self.users[user.id] = user
            acc = Account(
                id=a_id,
                user_id=user.id,
                rail_type=rail,
                opened_at=(base_time - timedelta(days=4)).isoformat(),
                status="ACTIVE",
                balance=150.0,
                account_number=acc_num
            )
            self.accounts[acc.id] = acc

            # Rapid transfer: Funds in from random counterparty, then immediately out to HUB
            in_txn = Transaction(
                id=f"TXN-IN-{uuid.uuid4().hex[:6].upper()}",
                account_id=acc.id,
                counterparty_account_id=f"ACC-EXT-{uuid.uuid4().hex[:6].upper()}",
                amount=5000.0,
                rail=rail,
                timestamp=(base_time + timedelta(hours=1)).isoformat(),
                device_id=shared_device,
                ip_address=shared_ip,
                geo_lat=12.9716,
                geo_lon=77.5946,
                geo_country="IN",
                merchant_name="Inbound Layering Source",
                status="COMPLETED",
                scenario_archetype_id="MULE_RING_TYPE_A",
                ground_truth_label="CONFIRMED_FRAUD"
            )
            self.transactions[in_txn.id] = in_txn

            out_txn = Transaction(
                id=f"TXN-OUT-{uuid.uuid4().hex[:6].upper()}",
                account_id=acc.id,
                counterparty_account_id=hub_acc.id,
                amount=4950.0,  # structured fee out
                rail=rail,
                timestamp=(base_time + timedelta(hours=1, minutes=10)).isoformat(),
                device_id=shared_device,
                ip_address=shared_ip,
                geo_lat=12.9716,
                geo_lon=77.5946,
                geo_country="IN",
                merchant_name="Consolidation Outflow",
                status="COMPLETED",
                mule_indicator=True,
                scenario_archetype_id="MULE_RING_TYPE_A",
                ground_truth_label="CONFIRMED_FRAUD"
            )
            self.transactions[out_txn.id] = out_txn

        # Trigger Mule Ring Alert on Hub
        self.alerts["ALT-MULE-001"] = Alert(
            id="ALT-MULE-001",
            entity_id=hub_acc.id,
            entity_type="ACCOUNT",
            triggered_by="MULE_RING",
            severity="HIGH",
            status="OPEN",
            created_at=base_time.isoformat(),
            description="Highly integrated network cluster detected centering on ACC-MULE-HUB. Shared device DEV-MULE-FNG7 and high-speed in-and-out layering observed across 3 satellite accounts.",
            scenario_archetype_id="MULE_RING_TYPE_A",
            ground_truth_label="CONFIRMED_FRAUD"
        )

        # 3. Archetype TRAVEL_SPOOF_GPS: Coordinated geographic невозможность traversal
        travel_user = User(id="USR-TRAVEL01", name="Sarah Jenkins", kyc_status="APPROVED", created_at="2024-05-12T08:00:00Z")
        self.users[travel_user.id] = travel_user
        travel_acc = Account(
            id="ACC-TRAVEL01",
            user_id=travel_user.id,
            rail_type="CARD",
            opened_at="2024-05-12T09:00:00Z",
            status="ACTIVE",
            balance=12400.0,
            account_number="CARD-4389-9812"
        )
        self.accounts[travel_acc.id] = travel_acc

        txn1 = Transaction(
            id="TXN-TRV-01",
            account_id=travel_acc.id,
            counterparty_account_id="ACC-MERCH-LDN",
            amount=85.00,
            rail="CARD",
            timestamp=(datetime.now() - timedelta(hours=3)).isoformat(),
            device_id="DEV-SARAH-IPHONE",
            ip_address="82.165.12.90",
            geo_lat=51.5074,
            geo_lon=-0.1278,
            geo_country="GB",
            merchant_name="London Coffee House",
            status="COMPLETED",
            scenario_archetype_id="TRAVEL_SPOOF_GPS",
            ground_truth_label="CLEAN" # Legitimate cardholder starts here
        )
        self.transactions[txn1.id] = txn1

        txn2 = Transaction(
            id="TXN-TRV-Singapore",
            account_id=travel_acc.id,
            counterparty_account_id="ACC-MERCH-SGP",
            amount=3200.00,
            rail="CARD",
            timestamp=(datetime.now() - timedelta(hours=2, minutes=30)).isoformat(),
            device_id="DEV-UNKNOWN-ANDROID",
            ip_address="103.24.116.1",
            geo_lat=1.3521,
            geo_lon=103.8198,
            geo_country="SG",
            merchant_name="Singapore Luxury Electronics",
            status="COMPLETED",
            scenario_archetype_id="TRAVEL_SPOOF_GPS",
            ground_truth_label="CONFIRMED_FRAUD" # Hijacked transaction spoof
        )
        self.transactions[txn2.id] = txn2

        # Singapore Travel Alert
        self.alerts["ALT-TRV-001"] = Alert(
            id="ALT-TRV-001",
            entity_id=txn2.id,
            entity_type="TRANSACTION",
            triggered_by="IMPOSSIBLE_TRAVEL",
            severity="HIGH",
            status="OPEN",
            created_at=(datetime.now() - timedelta(hours=2, minutes=30)).isoformat(),
            description="Geographically impossible travel detected. Card ACC-TRAVEL01 used in London (UK) and Singapore (SG) within 30 minutes. Velocity exceeds 10,000 km/hr. Unseen device fingerprint DEV-UNKNOWN-ANDROID.",
            scenario_archetype_id="TRAVEL_SPOOF_GPS",
            ground_truth_label="CONFIRMED_FRAUD"
        )

        # 4. SWIFT Watchlist Sanctions match
        swift_user = User(id="USR-SWIFT01", name="Dmitry Rostova", kyc_status="PENDING", created_at="2026-03-01T10:00:00Z")
        self.users[swift_user.id] = swift_user
        swift_acc = Account(
            id="ACC-SWIFT01",
            user_id=swift_user.id,
            rail_type="SWIFT",
            opened_at="2026-03-01T11:00:00Z",
            status="ACTIVE",
            balance=980000.00,
            account_number="SWIFT-ROST-CH-ZZ"
        )
        self.accounts[swift_acc.id] = swift_acc

        swift_txn = Transaction(
            id="TXN-SWIFT-Sanction",
            account_id=swift_acc.id,
            counterparty_account_id="ACC-SANCTIONED-ENTITY-RU",
            amount=450000.00,
            rail="SWIFT",
            timestamp=(datetime.now() - timedelta(days=1)).isoformat(),
            device_id="DEV-ROST-DESKTOP",
            ip_address="198.51.100.45",
            geo_lat=47.2357,
            geo_lon=39.7015,
            geo_country="RU",
            merchant_name="Vostok Export Corp (OFAC Sanction Match)",
            status="COMPLETED",
            scenario_archetype_id="SWIFT_SANCTION_HIT",
            ground_truth_label="CONFIRMED_FRAUD"
        )
        self.transactions[swift_txn.id] = swift_txn

        self.alerts["ALT-SWIFT-001"] = Alert(
            id="ALT-SWIFT-001",
            entity_id=swift_txn.id,
            entity_type="TRANSACTION",
            triggered_by="WATCHLIST_HIT",
            severity="HIGH",
            status="OPEN",
            created_at=(datetime.now() - timedelta(days=1)).isoformat(),
            description="OFAC/Sanctions list watchlist hit. SWIFT transfer of $450,000.00 routed to designated sanctioned counterparty entity in Rostov-on-Don (RU).",
            scenario_archetype_id="SWIFT_SANCTION_HIT",
            ground_truth_label="CONFIRMED_FRAUD"
        )

        # 5. Archetype BSA_STRUCTURING_CRYPT: Structured crypto layering transfers
        crypto_user = User(id="USR-CRYPTO01", name="Devin Blockchain", kyc_status="APPROVED", created_at="2025-08-01T10:00:00Z")
        self.users[crypto_user.id] = crypto_user
        crypto_acc = Account(
            id="ACC-CRYPTO01",
            user_id=crypto_user.id,
            rail_type="CRYPTO",
            opened_at="2025-08-01T10:30:00Z",
            status="ACTIVE",
            balance=12.45,
            account_number="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        )
        self.accounts[crypto_acc.id] = crypto_acc

        for i in range(5):
            str_txn = Transaction(
                id=f"TXN-CRP-STRUCT-{i}",
                account_id=crypto_acc.id,
                counterparty_account_id=f"0x8920...{i}4bb3",
                amount=9900.00,
                rail="CRYPTO",
                timestamp=(datetime.now() - timedelta(hours=5, minutes=i*8)).isoformat(),
                device_id="DEV-CRYPTO-LEDGER",
                ip_address="45.12.87.5",
                geo_lat=37.7749,
                geo_lon=-122.4194,
                geo_country="US",
                merchant_name=f"Peer-to-Peer Wallet Transfer {i+1}",
                status="COMPLETED",
                scenario_archetype_id="BSA_STRUCTURING_CRYPT",
                ground_truth_label="CONFIRMED_FRAUD"
            )
            self.transactions[str_txn.id] = str_txn

        self.alerts["ALT-CRP-001"] = Alert(
            id="ALT-CRP-001",
            entity_id=crypto_acc.id,
            entity_type="ACCOUNT",
            triggered_by="AML_STRUCTURING",
            severity="MEDIUM",
            status="OPEN",
            created_at=(datetime.now() - timedelta(hours=5)).isoformat(),
            description="Crypto asset structuring activity. Multiple transfers of exactly $9,900.00 (under anti-money-laundering thresholds) executed sequentially within 40 minutes across different blockchain wallet destinations.",
            scenario_archetype_id="BSA_STRUCTURING_CRYPT",
            ground_truth_label="CONFIRMED_FRAUD"
        )

        self.add_audit_log("SYSTEM", "SEED_DATABASE", "DB", "Successfully seeded mock users and realistic scenario-first archetypes.")

        # Seed Predictions
        self._seed_predictions()
        
        # Seed Sentinel Twin Profiles
        self._seed_twins()

        # Seed Chronos Replay Commits
        self._seed_chronos()

    def _seed_predictions(self):
        regions = ["North America", "Southeast Asia", "Eastern Europe", "Western Europe", "Latin America"]
        rails = ["CARD", "TRANSFER", "UPI", "SWIFT", "CRYPTO"]
        
        for rg in regions:
            for rl in rails:
                self.predictions.append({
                    "id": f"PRD-{uuid.uuid4().hex[:6].upper()}",
                    "region": rg,
                    "rail": rl,
                    "time_window": "Next 14 Days",
                    "predicted_risk": round(random.uniform(0.1, 0.95), 3),
                    "confidence_lower": round(random.uniform(0.05, 0.5), 3),
                    "confidence_upper": round(random.uniform(0.6, 0.99), 3),
                    "pattern_trend": random.choice(["UPWARD", "STABLE", "DOWNWARD"]),
                    "contributing_factors": [
                        "Recent increase in synthetic card applications from region.",
                        "Correlated cluster of headless browser logins detected.",
                        "Spike in off-ramp crypto volumes in localized wallets."
                    ]
                })

    def _seed_twins(self):
        self.twin_profiles = {
            "priya": {
                "id": "priya",
                "name": "Priya",
                "role": "Senior Fraud Analyst",
                "risk_appetite": 0.35,
                "sar_threshold": 0.84,
                "freeze_threshold": 0.72,
                "trust_in_ml": 0.75,
                "fatigue_index": 0.12,
                "case_count": 0,
                "bias_vectors": {
                    "anchoring": 0.45,
                    "confirmation": 0.50,
                    "automation": 0.68,
                    "conservatism": 0.35,
                    "recency": 0.55,
                    "availability": 0.50
                },
                "decision_accuracy": 0.942,
                "total_cases_audited": 412,
                "last_active": "Just now"
            },
            "rahul": {
                "id": "rahul",
                "name": "Rahul",
                "role": "Compliance Officer",
                "risk_appetite": 0.15,
                "sar_threshold": 0.91,
                "freeze_threshold": 0.85,
                "trust_in_ml": 0.40,
                "fatigue_index": 0.08,
                "case_count": 0,
                "bias_vectors": {
                    "anchoring": 0.65,
                    "confirmation": 0.70,
                    "automation": 0.25,
                    "conservatism": 0.82,
                    "recency": 0.40,
                    "availability": 0.45
                },
                "decision_accuracy": 0.968,
                "total_cases_audited": 387,
                "last_active": "5m ago"
            },
            "dev": {
                "id": "dev",
                "name": "Dev",
                "role": "Risk Engineer",
                "risk_appetite": 0.50,
                "sar_threshold": 0.85,
                "freeze_threshold": 0.80,
                "trust_in_ml": 0.88,
                "fatigue_index": 0.10,
                "case_count": 0,
                "bias_vectors": {
                    "anchoring": 0.30,
                    "confirmation": 0.35,
                    "automation": 0.50,
                    "conservatism": 0.40,
                    "recency": 0.35,
                    "availability": 0.30
                },
                "decision_accuracy": 0.915,
                "total_cases_audited": 289,
                "last_active": "12m ago"
            },
            "meera": {
                "id": "meera",
                "name": "Meera",
                "role": "Operations Head",
                "risk_appetite": 0.60,
                "sar_threshold": 0.90,
                "freeze_threshold": 0.88,
                "trust_in_ml": 0.50,
                "fatigue_index": 0.15,
                "case_count": 0,
                "bias_vectors": {
                    "anchoring": 0.40,
                    "confirmation": 0.45,
                    "automation": 0.35,
                    "conservatism": 0.45,
                    "recency": 0.60,
                    "availability": 0.55
                },
                "decision_accuracy": 0.889,
                "total_cases_audited": 314,
                "last_active": "1h ago"
            }
        }

    def _seed_chronos(self):
        import hashlib
        import time

        case_id = "ALT-MULE-001"
        now = time.time()
        
        events = [
            {
                "event_type": "CASE_CREATED",
                "actor": "SYSTEM",
                "offset_sec": -7200,
                "payload": {
                    "alert_id": case_id,
                    "status": "OPEN",
                    "severity": "HIGH",
                    "triggered_by": "MULE_RING",
                    "initial_risk_score": 0.82
                }
            },
            {
                "event_type": "TIMELINE_EXPANDED",
                "actor": "ANALYST_PRIYA",
                "offset_sec": -5400,
                "payload": {
                    "action": "EXPAND_DOSSIER",
                    "section": "TRANSACTIONS_LOG",
                    "user_cadence_cpm": 230
                }
            },
            {
                "event_type": "MOUSE_TRACK",
                "actor": "ANALYST_PRIYA",
                "offset_sec": -3600,
                "payload": {
                    "dwell_millis": 4500,
                    "target_node": "ACC-MULE-HUB",
                    "path_coordinates": [
                        {"x": 120, "y": 140},
                        {"x": 180, "y": 190},
                        {"x": 220, "y": 240},
                        {"x": 310, "y": 380}
                    ]
                }
            },
            {
                "event_type": "SWARM_DEBATE",
                "actor": "AGENT_SWARM",
                "offset_sec": -2700,
                "payload": {
                    "orchestrator_decision": "DEBATING",
                    "risk_breakdown": {
                        "layer_1_tabular": 0.78,
                        "layer_2_behavioral": 0.82,
                        "layer_3_network": 0.88
                    }
                }
            },
            {
                "event_type": "SENTINEL_TWIN_DEBATE",
                "actor": "TWIN_ARENA",
                "offset_sec": -1800,
                "payload": {
                    "dominant_vote": "FREEZE",
                    "consensus_confidence": 0.75,
                    "disagreement_entropy": 0.35,
                    "votes": {"Priya": "FREEZE", "Rahul": "FREEZE", "Dev": "FREEZE", "Meera": "MONITOR"}
                }
            },
            {
                "event_type": "EVIDENCE_ADDED",
                "actor": "COMPLIANCE_RAHUL",
                "offset_sec": -900,
                "payload": {
                    "evidence_type": "KYC_VERIFICATION",
                    "document_id": "DOC-KYC-VANCE-89",
                    "hash": "6c802713845648297f261f1e4fe7787785628d188dff49088dab6ae9bd4052f3"
                }
            }
        ]

        parent_hash = "GENESIS_ROOT"
        branch = "main"
        
        if case_id not in self.chronos_branch_pointers:
            self.chronos_branch_pointers[case_id] = {}

        for e in events:
            timestamp = now + e["offset_sec"]
            event_id = f"EVT-{uuid.uuid4().hex[:6].upper()}"
            
            hash_input = f"{parent_hash}|{timestamp}|{e['event_type']}|{e['actor']}|{str(e['payload'])}"
            event_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
            
            commit = {
                "event_id": event_id,
                "case_id": case_id,
                "timestamp": timestamp,
                "event_type": e["event_type"],
                "actor": e["actor"],
                "branch": branch,
                "payload": e["payload"],
                "parent_hash": parent_hash,
                "hash": event_hash
            }
            self.chronos_event_store.append(commit)
            parent_hash = event_hash

        self.chronos_branch_pointers[case_id][branch] = parent_hash

db = Database()
