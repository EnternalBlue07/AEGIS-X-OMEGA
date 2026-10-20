from typing import List, Dict, Any
from datetime import datetime, timedelta
from .data import db

class CaseTimelineGenerator:
    """
    Layer 5 Investigation Intelligence.
    Assembles a chronological "detective board" of an entity's lifecycle.
    """
    def __init__(self):
        pass

    def generate_timeline(self, entity_id: str, entity_type: str) -> List[Dict[str, Any]]:
        timeline = []
        
        # 1. Resolve target account/transaction
        account_id = None
        target_txn_id = None
        
        if entity_type == "ACCOUNT":
            account_id = entity_id
        elif entity_type == "TRANSACTION":
            target_txn_id = entity_id
            if entity_id in db.transactions:
                account_id = db.transactions[entity_id].account_id
                
        if not account_id or account_id not in db.accounts:
            return []

        account = db.accounts[account_id]
        user = db.users.get(account.user_id)
        
        # 2. Add User KYC creation event
        if user:
            timeline.append({
                "timestamp": user.created_at,
                "title": "KYC Profile Registered",
                "description": f"Customer '{user.name}' registered profile. Initial KYC Status set to: {user.kyc_status}.",
                "icon_type": "USER",
                "severity": "INFO",
                "evidence_ref": f"user_id: {user.id}"
            })
            
        # 3. Add Account opened event
        timeline.append({
            "timestamp": account.opened_at,
            "title": f"{account.rail_type} Account Activated",
            "description": f"Account number ending in {account.account_number[-4:]} successfully activated. Status: {account.status}.",
            "icon_type": "KEY",
            "severity": "INFO",
            "evidence_ref": f"account_id: {account.id}"
        })

        # 4. Add device linkage history based on transactions
        history = sorted(
            [t for t in db.transactions.values() if t.account_id == account_id or t.counterparty_account_id == account_id],
            key=lambda x: x.timestamp
        )
        
        seen_devices = set()
        seen_ips = set()
        
        for txn in history:
            # First time device seen
            if txn.device_id and txn.device_id not in seen_devices:
                seen_devices.add(txn.device_id)
                timeline.append({
                    "timestamp": txn.timestamp,
                    "title": "New Device Linked",
                    "description": f"Device fingerprint '{txn.device_id}' registered through transaction IP location {txn.geo_country}.",
                    "icon_type": "SHIELD",
                    "severity": "WARNING" if "MULE" in txn.device_id or "UNKNOWN" in txn.device_id else "INFO",
                    "evidence_ref": f"txn_id: {txn.id}"
                })
                
            # First time IP seen
            if txn.ip_address and txn.ip_address not in seen_ips:
                seen_ips.add(txn.ip_address)
                
            # Major transaction events
            if txn.amount > 5000:
                timeline.append({
                    "timestamp": txn.timestamp,
                    "title": "High-Value Transfer Incurred",
                    "description": f"Amount of ${txn.amount:,.2f} transferred via {txn.rail} rail to counterparty: {txn.counterparty_account_id}.",
                    "icon_type": "TRANS",
                    "severity": "WARNING",
                    "evidence_ref": f"txn_id: {txn.id}"
                })
            elif txn.mule_indicator:
                timeline.append({
                    "timestamp": txn.timestamp,
                    "title": "Mule Flow Routing Detected",
                    "description": f"High-speed outgoing layering transfer of ${txn.amount:,.2f} executed within minutes of inbound credit.",
                    "icon_type": "TRAVEL",
                    "severity": "CRITICAL",
                    "evidence_ref": f"txn_id: {txn.id}"
                })
            elif txn.id == target_txn_id:
                timeline.append({
                    "timestamp": txn.timestamp,
                    "title": "Flagged Transaction Event",
                    "description": f"Target transaction of ${txn.amount:,.2f} initiated from IP {txn.ip_address} ({txn.geo_country}).",
                    "icon_type": "TRANS",
                    "severity": "CRITICAL",
                    "evidence_ref": f"txn_id: {txn.id}"
                })

        # 5. Add Alert Trigger events
        alerts = [a for a in db.alerts.values() if a.entity_id == account_id or a.entity_id in [t.id for t in history]]
        for alt in alerts:
            timeline.append({
                "timestamp": alt.created_at,
                "title": f"System Alert Triggered: {alt.triggered_by}",
                "description": alt.description,
                "icon_type": "ALERT",
                "severity": "CRITICAL" if alt.severity == "HIGH" else "WARNING",
                "evidence_ref": f"alert_id: {alt.id}"
            })

        # Sort chronological
        timeline = sorted(timeline, key=lambda x: x["timestamp"])
        return timeline

timeline_generator = CaseTimelineGenerator()
