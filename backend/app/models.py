import math
from datetime import datetime
from typing import Dict, List, Any, Tuple
from .data import Transaction, db

class Layer1TabularScorer:
    """
    Layer 1 Transaction Intelligence.
    Simulates XGBoost + Isolation Forest.
    Calculates raw risk based on transaction parameters.
    """
    def __init__(self):
        self.model_version = "xgb_l1_v3.2.1"

    def score(self, txn: Transaction) -> Dict[str, Any]:
        risk_factors = {}
        score = 0.0
        
        # Isolation Forest Anomaly Detection simulation on Amount
        if txn.amount > 50000:
            score += 0.4
            risk_factors["high_amount_outlier"] = 0.8
        elif txn.amount > 10000:
            score += 0.2
            risk_factors["elevated_amount"] = 0.4
            
        # Country Risk
        if txn.geo_country in ["RU", "KP", "IR", "SY"]:
            score += 0.35
            risk_factors["high_risk_jurisdiction"] = 0.7
            
        # Rail Risk
        if txn.rail == "CRYPTO":
            score += 0.15
            risk_factors["crypto_rail_baseline"] = 0.3
        elif txn.rail == "SWIFT" and txn.amount > 100000:
            score += 0.2
            risk_factors["large_swift_baseline"] = 0.4
            
        # Cap score at 1.0
        fraud_probability = min(score, 1.0)
        anomaly_score = 0.5 + (fraud_probability * 0.4) # Simulating Isolation Forest anomaly margin

        return {
            "fraud_probability": round(fraud_probability, 3),
            "anomaly_score": round(anomaly_score, 3),
            "model_version": self.model_version,
            "risk_factors": risk_factors,
            "feature_snapshot": {
                "amount": txn.amount,
                "rail": txn.rail,
                "country": txn.geo_country,
                "has_device": txn.device_id is not None
            }
        }

class Layer2BehavioralScorer:
    """
    Layer 2 Behavioral Intelligence.
    Simulates an LSTM sequence model over rolling account history.
    """
    def __init__(self):
        self.model_version = "lstm_seq_l2_v1.0.8"

    def score(self, txn: Transaction) -> Dict[str, Any]:
        risk_factors = {}
        behavior_drift = 0.0
        
        # Get historical transactions for this account
        history = [t for t in db.transactions.values() if t.account_id == txn.account_id and t.id != txn.id]
        
        if not history:
            # Cold start: new account behavior is slightly higher risk
            behavior_drift = 0.25
            risk_factors["cold_start_account"] = 0.5
        else:
            # 1. Spend amount drift
            amounts = [h.amount for h in history]
            avg_amount = sum(amounts) / len(amounts)
            if txn.amount > avg_amount * 10:
                behavior_drift += 0.4
                risk_factors["spending_spike_10x"] = 0.8
            elif txn.amount > avg_amount * 3:
                behavior_drift += 0.2
                risk_factors["spending_spike_3x"] = 0.4

            # 2. Velocity counter (Transactions in last 24 hours)
            current_time = datetime.fromisoformat(txn.timestamp.replace("Z", "+00:00"))
            recent_txns = 0
            for h in history:
                h_time = datetime.fromisoformat(h.timestamp.replace("Z", "+00:00"))
                if (current_time - h_time).total_seconds() < 86400:
                    recent_txns += 1
            
            if recent_txns > 10:
                behavior_drift += 0.3
                risk_factors["high_velocity_24h"] = 0.6
                
            # 3. Impossible Travel detection
            for h in history:
                h_time = datetime.fromisoformat(h.timestamp.replace("Z", "+00:00"))
                time_diff_hours = abs((current_time - h_time).total_seconds()) / 3600.0
                
                # Check for location differences
                if h.geo_lat and txn.geo_lat and h.geo_country != txn.geo_country:
                    # Calculate approximate distance (Haversine simplified)
                    dist = self._haversine(h.geo_lat, h.geo_lon, txn.geo_lat, txn.geo_lon)
                    if time_diff_hours > 0:
                        speed = dist / time_diff_hours
                        if speed > 1000.0 and dist > 500:  # > 1000 km/hr is physically impossible for commercial flights
                            behavior_drift += 0.6
                            risk_factors["impossible_travel"] = 0.9
                            risk_factors["speed_kph"] = int(speed)
                            break
                            
        behavior_risk_score = min(behavior_drift, 1.0)
        return {
            "behavior_risk_score": round(behavior_risk_score, 3),
            "model_version": self.model_version,
            "behavior_risk_factors": risk_factors
        }

    def _haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        # Simple distance in km
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

l1_scorer = Layer1TabularScorer()
l2_scorer = Layer2BehavioralScorer()
