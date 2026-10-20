import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any
from .data import db, Transaction, Alert
from .risk import risk_fuser
from .graph import l3_scorer

class AdversarialSimulator:
    """
    Simulation Engine & Sandboxed Red-Teaming.
    Simulates coordinated financial attacks to test model coverage.
    """
    def __init__(self):
        pass

    def run_scenario(self, scenario_type: str) -> Dict[str, Any]:
        """
        Injects a specific fraud scenario into the live database and evaluates model coverage.
        """
        scenario_type = scenario_type.upper()
        injected_txns = []
        new_accounts = []
        
        # Base setup
        base_time = datetime.now()
        shared_device = f"DEV-SIM-{uuid.uuid4().hex[:6].upper()}"
        shared_ip = f"203.0.113.{random.randint(10, 250)}"
        
        # Create unique user & accounts
        sim_user = db.users.get("USR-SIM")
        if not sim_user:
            sim_user = db.users["USR-SIM"] = db.users.get("USR-SIM") or db.users.get("USR-CLEAN01") # fallback or create
        
        if scenario_type == "MULE_RING":
            # Coordinated layering: 4 mule accounts consolidation to 1 Hub
            hub_id = f"ACC-SIM-HUB-{uuid.uuid4().hex[:4].upper()}"
            db.accounts[hub_id] = db.accounts.get(hub_id) or db.accounts[list(db.accounts.keys())[0]] # fallback
            
            # Create a mock hub
            hub_acc = db.accounts[hub_id] = db.accounts.get(hub_id) or db.accounts[list(db.accounts.keys())[0]]
            
            for i in range(4):
                mule_id = f"ACC-SIM-MULE-{i}-{uuid.uuid4().hex[:4].upper()}"
                db.accounts[mule_id] = db.accounts.get(mule_id) or db.accounts[list(db.accounts.keys())[0]]
                new_accounts.append(mule_id)
                
                # Inflow
                t_in = Transaction(
                    id=f"TXN-SIM-IN-{i}-{uuid.uuid4().hex[:4].upper()}",
                    account_id=mule_id,
                    counterparty_account_id=f"ACC-SIM-EXT-{i}",
                    amount=round(random.uniform(4000, 6000), 2),
                    rail="UPI",
                    timestamp=(base_time - timedelta(minutes=10 * (i+1))).isoformat(),
                    device_id=shared_device,
                    ip_address=shared_ip,
                    geo_lat=28.7041,
                    geo_lon=77.1025,
                    geo_country="IN",
                    merchant_name="Layering Credit",
                    status="COMPLETED"
                )
                db.transactions[t_in.id] = t_in
                injected_txns.append(t_in)
                
                # Outflow to Hub
                t_out = Transaction(
                    id=f"TXN-SIM-OUT-{i}-{uuid.uuid4().hex[:4].upper()}",
                    account_id=mule_id,
                    counterparty_account_id=hub_id,
                    amount=round(t_in.amount - 50, 2), #Structured consolidate
                    rail="UPI",
                    timestamp=(base_time - timedelta(minutes=10 * i)).isoformat(),
                    device_id=shared_device,
                    ip_address=shared_ip,
                    geo_lat=28.7041,
                    geo_lon=77.1025,
                    geo_country="IN",
                    merchant_name="Consolidation Out",
                    status="COMPLETED",
                    mule_indicator=True
                )
                db.transactions[t_out.id] = t_out
                injected_txns.append(t_out)
                
        elif scenario_type == "TRAVEL_SPOOF":
            # Physically impossible geo travel
            mule_id = f"ACC-SIM-TRV-{uuid.uuid4().hex[:4].upper()}"
            db.accounts[mule_id] = db.accounts.get(mule_id) or db.accounts[list(db.accounts.keys())[0]]
            new_accounts.append(mule_id)
            
            # Txn 1: New York
            t1 = Transaction(
                id=f"TXN-SIM-NY-{uuid.uuid4().hex[:4].upper()}",
                account_id=mule_id,
                counterparty_account_id="ACC-MERCH-NY",
                amount=150.00,
                rail="CARD",
                timestamp=(base_time - timedelta(minutes=45)).isoformat(),
                device_id="DEV-NY-IPHONE",
                ip_address="198.51.100.12",
                geo_lat=40.7128,
                geo_lon=-74.0060,
                geo_country="US",
                merchant_name="Manhattan Diner",
                status="COMPLETED"
            )
            db.transactions[t1.id] = t1
            injected_txns.append(t1)
            
            # Txn 2: Frankfurt (Germany) 10 minutes later
            t2 = Transaction(
                id=f"TXN-SIM-FRA-{uuid.uuid4().hex[:4].upper()}",
                account_id=mule_id,
                counterparty_account_id="ACC-MERCH-FRA",
                amount=4800.00,
                rail="CARD",
                timestamp=(base_time - timedelta(minutes=35)).isoformat(),
                device_id="DEV-SIM-FRA",
                ip_address="194.25.10.9",
                geo_lat=50.1109,
                geo_lon=8.6821,
                geo_country="DE",
                merchant_name="Frankfurt Airport Duty Free",
                status="COMPLETED"
            )
            db.transactions[t2.id] = t2
            injected_txns.append(t2)

        elif scenario_type == "BSA_STRUCTURING":
            # Crypto transfers just under $10,000 threshold
            mule_id = f"ACC-SIM-CRYP-{uuid.uuid4().hex[:4].upper()}"
            db.accounts[mule_id] = db.accounts.get(mule_id) or db.accounts[list(db.accounts.keys())[0]]
            new_accounts.append(mule_id)
            
            for i in range(6):
                t_struct = Transaction(
                    id=f"TXN-SIM-STRUCT-{i}-{uuid.uuid4().hex[:4].upper()}",
                    account_id=mule_id,
                    counterparty_account_id=f"0x981...{i}ea7",
                    amount=9850.00, # under 10k
                    rail="CRYPTO",
                    timestamp=(base_time - timedelta(minutes=5 * i)).isoformat(),
                    device_id="DEV-LEDGER",
                    ip_address=shared_ip,
                    geo_lat=34.0522,
                    geo_lon=-118.2437,
                    geo_country="US",
                    merchant_name=f"DeFi Liquidity Pool {i+1}",
                    status="COMPLETED"
                )
                db.transactions[t_struct.id] = t_struct
                injected_txns.append(t_struct)

        # Evaluate detection rate
        flagged_count = 0
        total_risk = 0.0
        alerts_triggered = []
        
        for txn in injected_txns:
            # Score each injected transaction
            risk_res = risk_fuser.compute_composite_risk(txn.account_id, txn)
            total_risk += risk_res["composite_risk_score"]
            
            if risk_res["composite_risk_score"] >= 0.70:
                flagged_count += 1
                
                # Check if we should write a mock alert
                alert_id = f"ALT-SIM-{uuid.uuid4().hex[:6].upper()}"
                alert = Alert(
                    id=alert_id,
                    entity_id=txn.id,
                    entity_type="TRANSACTION",
                    triggered_by=scenario_type,
                    severity="HIGH",
                    status="OPEN",
                    created_at=datetime.now().isoformat(),
                    description=f"[SIMULATION] Coordinated {scenario_type} simulation trigger. Score: {risk_res['composite_risk_score']:.2f}. Attributes: {', '.join(risk_res['reasons'])}"
                )
                db.alerts[alert_id] = alert
                alerts_triggered.append(alert_id)
                
        # Calculate evasion metrics
        injected_count = len(injected_txns)
        evasion_rate = (1.0 - (flagged_count / injected_count)) if injected_count > 0 else 0.0
        avg_risk = (total_risk / injected_count) if injected_count > 0 else 0.0

        db.add_audit_log(
            "SYSTEM", 
            "ADVERSARIAL_SIMULATION", 
            scenario_type, 
            f"Ran {scenario_type} scenario. Injected {injected_count} txns. Flagged: {flagged_count}. Evasion Rate: {evasion_rate:.1%}."
        )

        return {
            "scenario": scenario_type,
            "transactions_injected": injected_count,
            "transactions_flagged": flagged_count,
            "evasion_rate": round(evasion_rate, 3),
            "average_risk_score": round(avg_risk, 3),
            "alerts_triggered": alerts_triggered
        }

    def generate_random_live_traffic(self) -> Transaction:
        """
        Generates a single random transaction representing normal background traffic.
        Occasionally generates anomalies (15% chance).
        """
        # Pick random clean account
        acc_id = random.choice(list(db.accounts.keys()))
        acc = db.accounts[acc_id]
        
        # 15% chance of anomalous transaction details
        is_anomalous = random.random() < 0.15
        
        amount = round(random.uniform(10.0, 850.0), 2)
        geo_country = "US"
        geo_lat, geo_lon = 37.7749, -122.4194
        device = f"DEV-{acc.user_id[-5:]}"
        ip = f"192.168.1.{random.randint(10, 200)}"
        merchant = random.choice(["Target Superstore", "Starbucks Coffee", "Amazon Online", "Chevron Gas", "Vanguard Inv"])

        if is_anomalous:
            # High amount or suspicious rail/country
            amount = round(random.uniform(6000.0, 75000.0), 2)
            geo_country = random.choice(["RU", "SG", "IN", "DE"])
            if geo_country == "RU":
                geo_lat, geo_lon = 55.7558, 37.6173
                merchant = "Vostok Brokerage"
            elif geo_country == "SG":
                geo_lat, geo_lon = 1.3521, 103.8198
                merchant = "Marina Bay Luxury Shop"
            device = "DEV-UNRECOGNIZED-MAC"
            ip = f"103.45.12.{random.randint(1, 254)}"

        txn = Transaction(
            id=f"TXN-LIVE-{uuid.uuid4().hex[:6].upper()}",
            account_id=acc_id,
            counterparty_account_id=f"ACC-EXT-{uuid.uuid4().hex[:4].upper()}",
            amount=amount,
            rail=acc.rail_type,
            timestamp=datetime.now().isoformat(),
            device_id=device,
            ip_address=ip,
            geo_lat=geo_lat,
            geo_lon=geo_lon,
            geo_country=geo_country,
            merchant_name=merchant,
            status="COMPLETED"
        )
        
        db.transactions[txn.id] = txn
        
        # Calculate risk immediately
        risk_res = risk_fuser.compute_composite_risk(acc_id, txn)
        
        # If highly suspicious, trigger live alert
        if risk_res["composite_risk_score"] >= 0.75:
            alert_id = f"ALT-LIVE-{uuid.uuid4().hex[:6].upper()}"
            db.alerts[alert_id] = Alert(
                id=alert_id,
                entity_id=txn.id,
                entity_type="TRANSACTION",
                triggered_by="VELOCITY_SPIKE" if amount > 50000 else "GEOGRAPHIC_DRIFT",
                severity="HIGH",
                status="OPEN",
                created_at=datetime.now().isoformat(),
                description=f"Real-time scoring flagged transaction {txn.id}. Composite Risk: {risk_res['composite_risk_score']:.2f}. Reasons: {', '.join(risk_res['reasons'])}"
            )

        return txn

adversarial_simulator = AdversarialSimulator()
