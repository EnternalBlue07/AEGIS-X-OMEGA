import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

from .data import db
from .timeline import timeline_generator
from .agents import agent_swarm

def sha256_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()

class MerkleTree:
    def __init__(self, leaves: List[str]):
        self.leaves = leaves
        if not self.leaves:
            self.leaves = [sha256_hash("EMPTY_LEAF")]
        
        self.layers = [self.leaves]
        self._build_tree()

    def _build_tree(self):
        current_layer = self.leaves
        while len(current_layer) > 1:
            next_layer = []
            for i in range(0, len(current_layer), 2):
                left = current_layer[i]
                right = current_layer[i+1] if i+1 < len(current_layer) else left
                parent_hash = sha256_hash(left + right)
                next_layer.append(parent_hash)
            self.layers.append(next_layer)
            current_layer = next_layer

    def get_root(self) -> str:
        return self.layers[-1][0]

    def get_proof(self, index: int) -> List[Dict[str, Any]]:
        proof = []
        for layer_idx in range(len(self.layers) - 1):
            layer = self.layers[layer_idx]
            if index % 2 == 0:
                sibling_idx = index + 1 if index + 1 < len(layer) else index
                is_left = False
            else:
                sibling_idx = index - 1
                is_left = True
            
            proof.append({
                "sibling": layer[sibling_idx],
                "is_left": is_left
            })
            index = index // 2
        return proof

def build_case_vault(alert_id: str) -> Dict[str, Any]:
    alert = db.alerts.get(alert_id)
    if not alert:
        return {"error": "Alert not found"}
        
    account_id = None
    if alert.entity_type == "ACCOUNT":
        account_id = alert.entity_id
    elif alert.entity_type == "TRANSACTION" and alert.entity_id in db.transactions:
        account_id = db.transactions[alert.entity_id].account_id
        
    timeline = timeline_generator.generate_timeline(account_id, alert.entity_type) if account_id else []
    
    investigation = agent_swarm.run_investigation(alert_id)
    debate = investigation.get("debate_transcript", [])
    
    evidence_nodes = []
    
    # Node 1: Alert metadata
    evidence_nodes.append({
        "type": "ALERT_METADATA",
        "description": f"Initial alert {alert.id} for trigger {alert.triggered_by} under severity {alert.severity}.",
        "data": {
            "id": alert.id,
            "entity_id": alert.entity_id,
            "entity_type": alert.entity_type,
            "triggered_by": alert.triggered_by,
            "severity": alert.severity
        }
    })
    
    # Nodes for Transactions
    txns = [t for t in db.transactions.values() if t.account_id == account_id or t.counterparty_account_id == account_id]
    for txn in txns[:3]:
        evidence_nodes.append({
            "type": "TRANSACTION_EVIDENCE",
            "description": f"Payment transfer of ${txn.amount:.2f} on rail {txn.rail}.",
            "data": {
                "id": txn.id,
                "amount": txn.amount,
                "rail": txn.rail,
                "timestamp": txn.timestamp
            }
        })
        
    # Nodes for Timeline
    for ev in timeline[:3]:
        evidence_nodes.append({
            "type": "TIMELINE_EVENT",
            "description": f"Dossier event: {ev['title']} - {ev['description']}",
            "data": {
                "title": ev["title"],
                "description": ev["description"],
                "severity": ev["severity"]
            }
        })
        
    # Nodes for Swarm Debate
    for msg in debate[:4]:
        evidence_nodes.append({
            "type": "SWARM_DEBATE_FINDING",
            "description": f"Swarm Finding: {msg['agent']} concluded with status {msg.get('status', 'COMPLETED')}.",
            "data": {
                "agent": msg["agent"],
                "message": msg["message"][:60] + "...",
                "status": msg.get("status", "COMPLETED")
            }
        })
        
    # 2. Hash Evidence nodes to form Merkle Tree Leaves
    leaf_hashes = []
    for node in evidence_nodes:
        node_json = json.dumps(node, sort_keys=True)
        leaf_hashes.append(sha256_hash(node_json))
        
    tree = MerkleTree(leaf_hashes)
    root_hash = tree.get_root()
    
    nodes_out = []
    for idx, node in enumerate(evidence_nodes):
        nodes_out.append({
            "index": idx,
            "type": node["type"],
            "description": node["description"],
            "hash": leaf_hashes[idx],
            "proof": tree.get_proof(idx)
        })
        
    return {
        "alert_id": alert_id,
        "root_hash": root_hash,
        "leaves_count": len(leaf_hashes),
        "evidence_vault": nodes_out,
        "timestamp": datetime.now().isoformat()
    }
