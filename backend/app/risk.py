from typing import Dict, List, Any
from .data import Transaction, db
from .models import l1_scorer, l2_scorer
from .graph import l3_scorer

class Layer4RiskFuser:
    """
    Layer 4 Risk Intelligence.
    Fuses Layer 1, 2, and 3 risk scores into a calibrated composite risk score
    and generates explainable SHAP-like feature attributions.
    """
    def __init__(self):
        self.model_version = "meta_calibrated_fusion_v4.1.0"
        self.baseline_risk = 0.05

    def compute_composite_risk(self, account_id: str, txn: Transaction) -> Dict[str, Any]:
        # 1. Gather scores from Layers 1-3
        l1_res = l1_scorer.score(txn)
        l2_res = l2_scorer.score(txn)
        l3_res = l3_scorer.get_network_risk_score(account_id)
        
        l1_prob = l1_res["fraud_probability"]
        l2_prob = l2_res["behavior_risk_score"]
        l3_prob = l3_res["network_risk_score"]

        # 2. Score Fusion (calibrated logistic weighted sum)
        # Weights: 35% L1 Tabular, 30% L2 Sequence, 35% L3 Graph Network
        raw_blend = (0.35 * l1_prob) + (0.30 * l2_prob) + (0.35 * l3_prob)
        
        # Softmax-style scaling or sigmoid calibration
        # Let's ensure if any single layer flags 1.0 (extreme risk, like travel or sanction), the fused score is elevated
        fused_score = raw_blend
        if l1_prob >= 0.9 or l2_prob >= 0.9 or l3_prob >= 0.9:
            fused_score = max(fused_score, 0.85)
            
        fused_score = min(round(fused_score, 3), 1.0)

        # 3. Simulate SHAP Local Attributions
        # We divide the difference between fused_score and baseline_risk among active features
        shap_values = {}
        reasons = []
        
        # Attribute to L1 Tabular features
        for factor, weight in l1_res["risk_factors"].items():
            val = round(weight * 0.35, 3)
            shap_values[factor] = val
            
            # Map factors to natural language reasons
            if factor == "high_amount_outlier":
                reasons.append("Transaction amount is extremely high for standard rail limits.")
            elif factor == "high_risk_jurisdiction":
                reasons.append("Counterparty account is hosted in a high-risk sanction jurisdiction.")
            elif factor == "crypto_rail_baseline":
                reasons.append("Crypto rail transactions carry an elevated default risk tier.")

        # Attribute to L2 Behavioral features
        for factor, weight in l2_res["behavior_risk_factors"].items():
            val = round(weight * 0.30, 3)
            shap_values[factor] = val
            
            if factor == "spending_spike_10x":
                reasons.append("Immediate transaction size represents a 10x spike compared to 90-day baseline.")
            elif factor == "high_velocity_24h":
                reasons.append("High transaction frequency (velocity) within a rolling 24-hour window.")
            elif factor == "impossible_travel":
                reasons.append("Card used in two physically incompatible geographies within a sub-hour duration.")

        # Attribute to L3 Network features
        net_risk = l3_res["network_risk_score"]
        mule_lik = l3_res["mule_account_likelihood"]
        if net_risk > 0.4:
            val = round(net_risk * 0.35, 3)
            shap_values["network_cluster_risk"] = val
            reasons.append("Account is densely connected to a cluster containing multiple suspicious entities.")
            
        if mule_lik > 0.5:
            shap_values["mule_identity_match"] = round(mule_lik * 0.2, 3)
            reasons.append("Transactional topology matches signature patterns of a financial mule routing hub.")

        # Default fallback explanation
        if not reasons:
            reasons.append("Transaction characteristics conform fully to historical clean baseline standards.")
            shap_values["baseline_regularity"] = 0.05
            
        # Format SHAP data for chart render
        shap_chart_data = [{"feature": k, "shap_value": v} for k, v in shap_values.items()]

        return {
            "composite_risk_score": fused_score,
            "shap_values": shap_chart_data,
            "reasons": reasons[:4], # Top 4 reasons max to avoid clutter
            "model_version": self.model_version,
            "layer_scores": {
                "layer_1_tabular": l1_prob,
                "layer_2_behavioral": l2_prob,
                "layer_3_network": l3_prob
            }
        }

risk_fuser = Layer4RiskFuser()
