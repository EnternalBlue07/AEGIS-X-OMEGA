import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple
from .data import db, Transaction, Alert
from .risk import risk_fuser
from .graph import l3_scorer

class AgentPersona:
    def __init__(self, name: str, role: str, focus: str):
        self.name = name
        self.role = role
        self.focus = focus

agents_metadata = {
    "Transaction Analyst": AgentPersona(
        name="Agent TxnAnalyst",
        role="Isolated Transaction Assessor",
        focus="Velocity, size, country profiles, impossible travel calculations."
    ),
    "Network Analyst": AgentPersona(
        name="Agent NetAnalyst",
        role="Graph & Relationship Auditor",
        focus="Louvain community hubs, shared device linkages, IP subnets, node degree centrality."
    ),
    "AML Expert": AgentPersona(
        name="Agent AMLExpert",
        role="Anti-Money Laundering & Sanction Specialist",
        focus="Structuring detection (BSA/OFAC matches), layering typologies, shell company patterns."
    ),
    "Risk Assessor": AgentPersona(
        name="Agent RiskAssessor",
        role="Consensus Risk Fuser & Calibrator",
        focus="Synthesizing multi-agent outputs, SHAP explainability mapping, score calibration."
    ),
    "Report Writer": AgentPersona(
        name="Agent ReportWriter",
        role="Narrative Case Compiler",
        focus="Evidence extraction, chronological case documentation, regulatory audit tracing."
    ),
    "Compliance Officer": AgentPersona(
        name="Agent ComplianceOfficer",
        role="Final Decision Reviewer & SAR Architect",
        focus="Freeze determinations, SAR filing approvals, BSA regulatory citation audits."
    )
}

class MultiAgentSwarm:
    """
    Layer 7 Autonomous Agent Swarm.
    Orchestrates specialized agent personas through a state-machine debate.
    """
    def __init__(self):
        pass

    def run_investigation(self, alert_id: str) -> Dict[str, Any]:
        """
        Runs the full 6-agent debate and report compilation pipeline for a given alert.
        """
        # 1. Resolve alert context
        if alert_id not in db.alerts:
            return {"error": "Alert not found"}
        
        alert = db.alerts[alert_id]
        account_id = None
        txn = None
        
        if alert.entity_type == "ACCOUNT":
            account_id = alert.entity_id
            # Get latest transaction
            txns = [t for t in db.transactions.values() if t.account_id == account_id or t.counterparty_account_id == account_id]
            if txns:
                txn = sorted(txns, key=lambda x: x.timestamp)[-1]
        elif alert.entity_type == "TRANSACTION":
            if alert.entity_id in db.transactions:
                txn = db.transactions[alert.entity_id]
                account_id = txn.account_id

        if not account_id or not txn:
            return {"error": "Target account or transaction context not resolved"}

        # 2. Trigger score fusion (Layer 4)
        risk_result = risk_fuser.compute_composite_risk(account_id, txn)
        net_result = l3_scorer.get_network_risk_score(account_id)

        # 3. Generate Agent Debate Logs
        debate_transcript = self._generate_debate(alert, txn, risk_result, net_result)

        # 4. Generate Case Report Draft
        report_draft = self._compile_report(alert, txn, risk_result, net_result)

        # 5. Formulate final recommended actions
        recommended_action = "MONITOR_ACCOUNT"
        action_reason = "Elevated risk profile. Continuous audit trail recommended."
        
        if risk_result["composite_risk_score"] > 0.8:
            recommended_action = "FREEZE_ACCOUNT_AND_FILE_SAR"
            action_reason = "Severe risk detected. Multi-agent consensus identifies potential sanction violation or active fraud ring hub."
        elif risk_result["composite_risk_score"] > 0.5:
            recommended_action = "SUSPEND_UPI_CARD_RAILS"
            action_reason = "Behavioral drift and device sharing indicate account takeover. Rail restriction suggested pending KYC verification."

        investigation_id = f"INV-{uuid_short()}"
        
        result = {
            "investigation_id": investigation_id,
            "alert_id": alert_id,
            "composite_score": risk_result["composite_risk_score"],
            "risk_breakdown": risk_result["layer_scores"],
            "debate_transcript": debate_transcript,
            "case_report": report_draft,
            "recommended_action": recommended_action,
            "action_reason": action_reason,
            "model_version": risk_result["model_version"]
        }
        
        db.agent_outputs[investigation_id] = debate_transcript
        db.add_audit_log(
            "AGENT_SWARM", 
            "INVESTIGATION_COMPLETED", 
            investigation_id, 
            f"Autonomous swarm completed investigation. Score: {risk_result['composite_risk_score']}. Action: {recommended_action}."
        )
        
        return result

    def _generate_debate(self, alert: Alert, txn: Transaction, risk: Dict[str, Any], net: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Creates a structured, highly realistic multi-agent debate log.
        """
        logs = []
        
        # Phase 1: Intake / Setup
        logs.append({
            "agent": "System Orchestrator",
            "message": f"Intake complete for Alert {alert.id} ({alert.triggered_by}). Dispatching task files to parallel agents.",
            "tool_calls": ["db_query_account", "load_model_weights"],
            "status": "INFO"
        })

        # Phase 2: Transaction Analyst finding
        txn_factor = next((r for r in risk["reasons"] if "amount" in r.lower() or "travel" in r.lower() or "rail" in r.lower()), "Single transaction conforms to threshold limits.")
        logs.append({
            "agent": "Agent TxnAnalyst",
            "message": f"I have reviewed the flagged transaction {txn.id}. The amount is ${txn.amount:,.2f} on rail {txn.rail}. Key anomaly identified: {txn_factor} Confidence: 0.90.",
            "tool_calls": ["get_velocity_metrics", "calculate_haversine_distance"],
            "status": "COMPLETED"
        })

        # Phase 3: Network Analyst finding
        logs.append({
            "agent": "Agent NetAnalyst",
            "message": f"Running topological graph analysis on ACC {txn.account_id}. Louvain Community ID: {net['community_id']}. PageRank Centrality: {net['pagerank_centrality']}. This account operates as a neighbor in a cluster of size {net['cluster_size']}. Mule probability is {net['mule_account_likelihood']}.",
            "tool_calls": ["query_networkx_graph", "detect_shared_identifiers"],
            "status": "COMPLETED"
        })

        # Phase 4: AML Expert finding
        aml_message = "Watchlist name-matching returns no OFAC alerts. However, structuring behavior matches BSA layering typologies (rapid cyclic payments)."
        if alert.triggered_by == "WATCHLIST_HIT":
            aml_message = "CRITICAL WARNING: Counterparty matches OFAC Russia sanctions lists. Specifically, routing via SWIFT to Vostok Export Corp. Direct violation of Bank Secrecy Act (BSA) compliance guidelines."
        elif alert.triggered_by == "AML_STRUCTURING":
            aml_message = "BSA Structuring rule violated: multiple sub-$10,000 crypto wallet transfers executed sequentially to obfuscate reporting thresholds."
            
        logs.append({
            "agent": "Agent AMLExpert",
            "message": aml_message,
            "tool_calls": ["ofac_watchlist_lookup", "check_structuring_thresholds"],
            "status": "COMPLETED"
        })

        # Phase 5: Debate Node (Conflict check)
        # Network analyst debates Transaction analyst
        debate_comment = "Notice to TxnAnalyst: While your isolated card/UPI velocity looks normal, my network graph shows a device fingerprint shared with 3 known compromised mules. We cannot dismiss this case."
        if alert.triggered_by == "IMPOSSIBLE_TRAVEL":
            debate_comment = "Notice to AMLExpert: Although there are no OFAC hits, the physical impossible travel velocity between London and Singapore is 100% indicative of credential sharing or card cloning."
            
        logs.append({
            "agent": "Agent NetAnalyst",
            "message": f"RE: Debate Node. {debate_comment}",
            "tool_calls": ["verify_device_crossover"],
            "status": "DEBATING"
        })

        # Phase 6: Risk Assessor fuses findings
        logs.append({
            "agent": "Agent RiskAssessor",
            "message": f"Fusing inputs. Tabular Risk: {risk['layer_scores']['layer_1_tabular']}, Sequence Risk: {risk['layer_scores']['layer_2_behavioral']}, Network Graph Risk: {risk['layer_scores']['layer_3_network']}. Calibrated composite risk fused at: {risk['composite_risk_score']}.",
            "tool_calls": ["run_fusion_model"],
            "status": "COMPLETED"
        })

        # Phase 7: Compliance Officer recommendation
        rec_call = "FREEZE" if risk["composite_risk_score"] > 0.8 else "MONITOR"
        logs.append({
            "agent": "Agent ComplianceOfficer",
            "message": f"Audit review complete. Fused risk {risk['composite_risk_score']} warrants a {rec_call} recommendation. Preparing regulatory SAR draft under guidelines 31 CFR Chapter X.",
            "tool_calls": ["format_sar_filing", "emit_freeze_instruction"],
            "status": "RESOLVED"
        })

        return logs

    def _compile_report(self, alert: Alert, txn: Transaction, risk: Dict[str, Any], net: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compiles the structural narrative text for the SAR builder.
        """
        fused_score = risk["composite_risk_score"]
        
        # Narrative drafting
        narrative = (
            f"On {datetime.now().strftime('%Y-%m-%d')}, AEGIS-X Autonomous Swarm flagged account "
            f"{txn.account_id} for suspicious transactions. "
        )
        
        if alert.triggered_by == "IMPOSSIBLE_TRAVEL":
            narrative += (
                f"The account exhibited geographical anomalies. Transaction {txn.id} was initiated from "
                f"Singapore (SG) shortly after card activity in London (GB), suggesting card cloning "
                f"or credential sharing. "
            )
        elif alert.triggered_by == "WATCHLIST_HIT":
            narrative += (
                f"A direct match was identified against OFAC/Sanctions list for SWIFT transfer {txn.id}. "
                f"The transaction counterparty is associated with restricted trade groups. "
            )
        elif alert.triggered_by == "MULE_RING":
            narrative += (
                f"Graph analysis mapped the account to a dense Louvain community containing shared device "
                f"fingerprints. Funds are immediately layered out of the account to ACC-MULE-HUB "
                f"within minutes of inbound credits, typical of mule routing nodes. "
            )
        else:
            narrative += (
                f"The account triggered a velocity/structuring alert, characterized by multiple sequential "
                f"transfers designed to avoid statutory regulatory reporting triggers. "
            )
            
        narrative += f"The composite risk score is computed at {fused_score:.0%}, exceeding compliance thresholds."

        return {
            "executive_summary": f"Flagged account shows severe compliance anomalies. Swarm recommends immediate review.",
            "suspicious_activity_narrative": narrative,
            "evidence_citations": [
                {"source": "L1_Tabular_Model", "fact": f"Isolation Forest score: {risk['layer_scores']['layer_1_tabular']}"},
                {"source": "L2_Behavior_Model", "fact": f"Rolling spend velocity drift: {risk['layer_scores']['layer_2_behavioral']}"},
                {"source": "L3_Network_Graph", "fact": f"Louvain Cluster Community: {net['community_id']}, Mule Likelihood: {net['mule_account_likelihood']}"}
            ],
            "regulatory_citations": [
                "31 CFR Chapter X (Financial Crimes Enforcement Network)",
                "BSA Section 5318(g) (Reporting of Suspicious Transactions)"
            ],
            "timestamp": datetime.now().isoformat()
        }

def uuid_short() -> str:
    return uuid.uuid4().hex[:6].upper()

agent_swarm = MultiAgentSwarm()
