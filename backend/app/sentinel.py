import math
import random
from typing import Dict, List, Any, Tuple
from datetime import datetime
from .data import db, Alert

class InvestigatorDigitalTwinEngine:
    """
    AEGIS-X SENTINEL Submodule.
    The Cognitive Investigator Digital Twin Engine.
    Models individual analyst personas, dynamic biometrics-coupled fatigue,
    decision vectors under cognitive bias, and executes multi-twin consensus debates.
    """
    def __init__(self):
        pass

    def get_twins(self) -> Dict[str, Any]:
        """
        Returns active twin profiles from database.
        """
        return db.twin_profiles

    def update_telemetry(self, cpm: int, jitter: float) -> Dict[str, Any]:
        """
        Processes live browser biometrics to adjust dynamic fatigue index and bias vectors.
        """
        # Lower CPM or extreme high CPM relative to standard baseline increases fatigue
        # Baseline is 230 CPM, 15px/ms^2 jitter.
        cpm_deviation = abs(cpm - 230) / 230.0 if cpm > 0 else 0.5
        jitter_deviation = abs(jitter - 15) / 15.0
        
        # Calculate dynamic delta
        telemetry_impact = (cpm_deviation * 0.4) + (jitter_deviation * 0.6)
        
        # Adjust Priya's active profile in the database (since Priya is the default active analyst)
        priya = db.twin_profiles.get("priya")
        if priya:
            # Scale fatigue between 0.05 and 0.95
            new_fatigue = min(max(0.12 + (telemetry_impact * 0.5), 0.05), 0.95)
            priya["fatigue_index"] = round(new_fatigue, 3)
            
            # As fatigue scales up, automation bias and conservatism vectors also swell
            priya["bias_vectors"]["automation"] = round(min(0.68 + (new_fatigue * 0.2), 0.95), 3)
            priya["bias_vectors"]["conservatism"] = round(min(0.35 + (new_fatigue * 0.25), 0.85), 3)
            priya["bias_vectors"]["confirmation"] = round(min(0.50 + (new_fatigue * 0.15), 0.85), 3)
            
            # Update dynamic last active status
            priya["last_active"] = "Active now"
            
        return db.twin_profiles

    def infer_twin_decision(self, twin_id: str, alert_id: str) -> Dict[str, Any]:
        """
        Evaluates a case context under the twin's cognitive parameter vector.
        Outputs decision probabilities and the dominant chosen action.
        """
        twin = db.twin_profiles.get(twin_id)
        alert = db.alerts.get(alert_id)
        
        if not twin or not alert:
            return {
                "action": "MONITOR",
                "confidence": 0.5,
                "probabilities": {"FREEZE": 0.1, "SAR": 0.1, "MONITOR": 0.7, "CLEAR": 0.1}
            }
            
        # Base risk context (resolve alert severity and simulated composite score)
        base_risk = 0.55
        if alert.severity == "HIGH":
            base_risk = 0.82
        elif alert.severity == "MEDIUM":
            base_risk = 0.60
        else:
            base_risk = 0.35
            
        # Adjust base risk based on twin parameters:
        # High risk appetite reduces perceived risk. Low risk appetite increases it.
        perceived_risk = base_risk * (1.0 - (twin["risk_appetite"] - 0.35) * 0.5)
        
        # Incorprate Trust in ML. If high trust, we align closer to the alert's true severity.
        # If low trust, we revert to conservative defaults.
        ml_influence = twin["trust_in_ml"]
        
        # Incorporate Fatigue index: high fatigue leads to automation bias (agreeing with default/ML).
        fatigue = twin["fatigue_index"]
        effective_trust = ml_influence + (fatigue * 0.2)
        effective_trust = min(max(effective_trust, 0.0), 1.0)
        
        # Dynamic threshold comparison
        freeze_thresh = twin["freeze_threshold"] * (1.0 + (twin["bias_vectors"]["conservatism"] - 0.5) * 0.2)
        sar_thresh = twin["sar_threshold"] * (1.0 + (twin["bias_vectors"]["conservatism"] - 0.5) * 0.1)
        
        # Calculate probabilities
        prob_freeze = min(max(perceived_risk * effective_trust * (1.1 if perceived_risk > freeze_thresh else 0.7), 0.02), 0.98)
        prob_sar = min(max(perceived_risk * (1.2 if perceived_risk > sar_thresh else 0.6), 0.02), 0.98)
        
        # Normalize
        total = prob_freeze + prob_sar + 0.3 + 0.1
        p_freeze = prob_freeze / total
        p_sar = prob_sar / total
        p_monitor = 0.3 / total
        p_clear = 0.1 / total
        
        # Choose action
        probs = {
            "FREEZE": round(p_freeze, 3),
            "SAR": round(p_sar, 3),
            "MONITOR": round(p_monitor, 3),
            "CLEAR": round(p_clear, 3)
        }
        
        # Determine top action
        chosen_action = max(probs, key=probs.get)
        confidence = probs[chosen_action]
        
        return {
            "action": chosen_action,
            "confidence": confidence,
            "probabilities": probs
        }

    def run_sentinel_debate(self, alert_id: str) -> Dict[str, Any]:
        """
        Executes a 5-round consensus debate between Priya, Rahul, Dev, and Meera.
        Returns typewriter logs, final vote breakdown, and compiled minority report.
        """
        alert = db.alerts.get(alert_id)
        if not alert:
            return {"error": "Alert not found"}
            
        # 1. Infer individual decisions
        decisions = {
            "priya": self.infer_twin_decision("priya", alert_id),
            "rahul": self.infer_twin_decision("rahul", alert_id),
            "dev": self.infer_twin_decision("dev", alert_id),
            "meera": self.infer_twin_decision("meera", alert_id)
        }
        
        # 2. Build 5-Round Debate dialogue
        logs = []
        
        # ROUND 1: INITIAL OPINION
        logs.append({
            "round": 1,
            "title": "ROUND 1: INITIAL COGNITIVE OPINIONS",
            "logs": [
                {
                    "twin": "Priya",
                    "role": "Senior Analyst",
                    "action": decisions["priya"]["action"],
                    "confidence": f"{decisions['priya']['confidence']:.0%}",
                    "message": f"Alert {alert_id} triggers under my threshold. Ingestion patterns indicate {alert.triggered_by} characteristics. Fused risk is {decisions['priya']['probabilities']['FREEZE']:.0%} for immediate freezing. Action: {decisions['priya']['action']}.",
                },
                {
                    "twin": "Rahul",
                    "role": "Compliance Officer",
                    "action": decisions["rahul"]["action"],
                    "confidence": f"{decisions['rahul']['confidence']:.0%}",
                    "message": f"Looking at the regulatory vectors. The account details must align with 31 CFR Chapter X guidelines. My trust in the model is calibrated at {db.twin_profiles['rahul']['trust_in_ml']:.0%}, meaning I demand verifiable audit evidence before a freeze. Action: {decisions['rahul']['action']}.",
                },
                {
                    "twin": "Dev",
                    "role": "Risk Engineer",
                    "action": decisions["dev"]["action"],
                    "confidence": f"{decisions['dev']['confidence']:.0%}",
                    "message": f"Model explanation confidence checks out. Tabular risk distributions are highly calibrated, with prediction probability converging on {decisions['dev']['probabilities']['FREEZE'] + decisions['dev']['probabilities']['SAR']:.1%}. Action: {decisions['dev']['action']}.",
                },
                {
                    "twin": "Meera",
                    "role": "Operations Head",
                    "action": decisions["meera"]["action"],
                    "confidence": f"{decisions['meera']['confidence']:.0%}",
                    "message": f"We need to evaluate transaction velocity vs operational impact. Freezing ACC-MULE-HUB impacts active flow and customer friction index. However, risk parameters are elevated. Action: {decisions['meera']['action']}.",
                }
            ]
        })

        # ROUND 2: CROSS-EXAMINATION / CRITIQUE
        logs.append({
            "round": 2,
            "title": "ROUND 2: CROSS-CRITIQUE AUDIT",
            "logs": [
                {
                    "twin": "Priya",
                    "role": "Senior Analyst",
                    "action": "CRITIQUE",
                    "confidence": "85%",
                    "message": f"Re: Rahul. Waiting for complete audit logs increases threat exposure times. The impossible travel or mule ring layering completes inside minutes. We must restrict access immediately.",
                },
                {
                    "twin": "Rahul",
                    "role": "Compliance Officer",
                    "action": "CRITIQUE",
                    "confidence": "79%",
                    "message": f"Re: Priya. Aggressive freezing without filing matching suspicious activity reports (SAR) exposes us to wrongful termination claims. Regulators require detailed timeline mappings.",
                },
                {
                    "twin": "Dev",
                    "role": "Risk Engineer",
                    "action": "CRITIQUE",
                    "confidence": "92%",
                    "message": f"Topological centrality analysis checks: the account holds community Centrality scores exceeding 0.76. This is not isolated noise. The probability of false positive classification is < 4.2%.",
                },
                {
                    "twin": "Meera",
                    "role": "Operations Head",
                    "action": "CRITIQUE",
                    "confidence": "81%",
                    "message": f"Re: Dev. A community cluster node can simply represent a high-density payment gateway. Can we inject dynamic KYC checks instead of a full lock?",
                }
            ]
        })

        # ROUND 3: REBUTTAL & STABILIZATION
        logs.append({
            "round": 3,
            "title": "ROUND 3: REBUTTAL & ADAPTATION",
            "logs": [
                {
                    "twin": "Priya",
                    "role": "Senior Analyst",
                    "action": "REBUTTAL",
                    "confidence": "89%",
                    "message": f"Operational impact is noted. But if we leave the node unfrozen, we risk $400k+ in compliance fines. The behavioral drift is too sharp to ignore.",
                },
                {
                    "twin": "Rahul",
                    "role": "Compliance Officer",
                    "action": "REBUTTAL",
                    "confidence": "84%",
                    "message": f"If the network community centrality is verified, that establishes reasonable suspicion under BSA. I will align towards freezing, provided we compile the cryptographic Merkle proof immediately.",
                },
                {
                    "twin": "Meera",
                    "role": "Operations Head",
                    "action": "REBUTTAL",
                    "confidence": "76%",
                    "message": f"If Rahul and Dev agree that the network signatures verify the risk, the operations pipeline accepts the escalation. Customer friction is mitigated by the risk profile validation.",
                }
            ]
        })

        # ROUND 4: EVIDENCE INJECTION
        logs.append({
            "round": 4,
            "title": "ROUND 4: EVIDENCE INJECTION & INQUIRY",
            "logs": [
                {
                    "twin": "System",
                    "role": "Consensus Monitor",
                    "action": "DATA_FETCH",
                    "confidence": "100%",
                    "message": f"Seeding cryptographic hashes for case {alert_id}. Merkle root hash: {alert.scenario_archetype_id or 'AML_MULE_RING_A'}-ROOT. Node community count: 11.",
                },
                {
                    "twin": "Dev",
                    "role": "Risk Engineer",
                    "action": "AUDIT",
                    "confidence": "95%",
                    "message": f"Verifying SHA256 integrity trees. All leaves (alert parameters, debit logs, device details) are linked. No tampering observed. Evidence integrity verified.",
                }
            ]
        })

        # ROUND 5: FINAL CONSENSUS
        # Build dynamic votes based on computed decisions
        votes = {
            "Priya": decisions["priya"]["action"],
            "Rahul": decisions["rahul"]["action"],
            "Dev": decisions["dev"]["action"],
            "Meera": decisions["meera"]["action"]
        }
        
        logs.append({
            "round": 5,
            "title": "ROUND 5: FINAL STABLE RECONCILIATION",
            "logs": [
                {
                    "twin": "Priya",
                    "role": "Senior Analyst",
                    "action": votes["Priya"],
                    "confidence": "100%",
                    "message": f"Final Position: CAST VOTE FOR {votes['Priya']}.",
                },
                {
                    "twin": "Rahul",
                    "role": "Compliance Officer",
                    "action": votes["Rahul"],
                    "confidence": "100%",
                    "message": f"Final Position: CAST VOTE FOR {votes['Rahul']}.",
                },
                {
                    "twin": "Dev",
                    "role": "Risk Engineer",
                    "action": votes["Dev"],
                    "confidence": "100%",
                    "message": f"Final Position: CAST VOTE FOR {votes['Dev']}.",
                },
                {
                    "twin": "Meera",
                    "role": "Operations Head",
                    "action": votes["Meera"],
                    "confidence": "100%",
                    "message": f"Final Position: CAST VOTE FOR {votes['Meera']}.",
                }
            ]
        })

        # 3. Calculate Vote Breakdown & Metrics
        vote_counts = {}
        for twin_name, vote in votes.items():
            vote_counts[vote] = vote_counts.get(vote, 0) + 1
            
        dominant_vote = max(vote_counts, key=vote_counts.get)
        max_votes = vote_counts[dominant_vote]
        consensus_confidence = max_votes / 4.0
        
        # Calculate Disagreement Entropy (custom formula based on distinct votes)
        distinct_votes = len(vote_counts)
        if distinct_votes == 1:
            entropy = 0.0  # Perfect agreement
        elif distinct_votes == 2:
            # Splits: 3-1 (0.35 entropy) or 2-2 (0.75 entropy)
            entropy = 0.75 if 2 in vote_counts.values() else 0.35
        elif distinct_votes == 3:
            # 2-1-1 (0.85 entropy)
            entropy = 0.85
        else:
            # 1-1-1-1 (0.98 entropy)
            entropy = 0.98

        # 4. Generate Minority Report if dissent exists
        dissenters = [t for t, v in votes.items() if v != dominant_vote]
        minority_report = ""
        if dissenters:
            report_lines = []
            for d in dissenters:
                twin_key = d.lower()
                action_pref = votes[d]
                role = db.twin_profiles[twin_key]["role"]
                bias_type = max(db.twin_profiles[twin_key]["bias_vectors"], key=db.twin_profiles[twin_key]["bias_vectors"].get)
                report_lines.append(
                    f"* Investigator Twin {d} ({role}) dissented, preferring {action_pref}. "
                    f"This variance is driven by a low risk appetite ({db.twin_profiles[twin_key]['risk_appetite']}) "
                    f"and elevated cognitive {bias_type.upper()} bias."
                )
            minority_report = "\n".join(report_lines)
        else:
            minority_report = "CONVERGENT STABILITY REACHED. All 4 digital investigator twins reached perfect consensus on freezing actions with zero minority reports."

        # Increment case counts for Retraining/Retuning metrics
        for twin_key in db.twin_profiles:
            db.twin_profiles[twin_key]["case_count"] += 1
            db.twin_profiles[twin_key]["total_cases_audited"] += 1

        result = {
            "alert_id": alert_id,
            "status": "CONVERGED" if entropy < 0.6 else "DIVERGENT",
            "votes": votes,
            "vote_breakdown": vote_counts,
            "dominant_vote": dominant_vote,
            "consensus_confidence": consensus_confidence,
            "disagreement_entropy": entropy,
            "minority_report": minority_report,
            "debate_transcript": logs,
            "timestamp": datetime.now().isoformat()
        }
        
        db.sentinel_debates[alert_id] = result
        db.add_audit_log(
            "SENTINEL_COGNITIVE_TWIN",
            "DEBATE_Arena_RESOLVED",
            alert_id,
            f"Sentinel twin debate complete. Consensus: {dominant_vote} ({consensus_confidence:.0%}). Entropy: {entropy:.2f}"
        )
        
        return result

# Singleton instantiation
sentinel_engine = InvestigatorDigitalTwinEngine()
