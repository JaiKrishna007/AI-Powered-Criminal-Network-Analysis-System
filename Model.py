from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import numpy as np
import xgboost as xgb
import joblib

app = FastAPI(title="SIH Intelligence API - Level 1")

# 1. Load Models
er_model = xgb.XGBClassifier()
er_model.load_model('models/entity_resolution.json')
anomaly_model = joblib.load('models/anomaly_model.pkl')

# --- DATA MODELS ---
class EntityPairRequest(BaseModel):
    record_a_id: str
    record_b_id: str
    name_sim: float
    address_sim: float
    org_sim: float
    phone_match: bool
    vehicle_match: bool

class ActivityRequest(BaseModel):
    entity_id: str
    calls: int
    transactions: int
    amount: float

# --- ENDPOINT 1: ENTITY RESOLUTION ---
@app.post("/api/v1/resolve")
def resolve_entity(req: EntityPairRequest):
    features = pd.DataFrame([{
        'name_similarity': req.name_sim,
        'address_similarity': req.address_sim,
        'org_similarity': req.org_sim,
        'phone_match': int(req.phone_match),
        'vehicle_match': int(req.vehicle_match)
    }])
    
    # Calculate probability
    prob = float(er_model.predict_proba(features)[0][1])
    
    # Set thresholds based on validation
    if prob >= 0.90:
        status = "HIGH_CONFIDENCE_MATCH"
    elif prob >= 0.50:
        status = "REVIEW"
    else:
        status = "LOW_CONFIDENCE_NON_MATCH"

    # Return standardized Level 1 Output
    return {
        "model": "entity_resolution",
        "model_version": "v1.0",
        "entity_ids": [req.record_a_id, req.record_b_id],
        "score": round(prob, 4),
        "status": status,
        "signals": {
            "name_similarity": req.name_sim,
            "address_similarity": req.address_sim,
            "phone_match": req.phone_match,
            "vehicle_match": req.vehicle_match
        }
    }

# --- ENDPOINT 2: ANOMALY DETECTION ---
@app.post("/api/v1/analyze_behavior")
def analyze_behavior(req: ActivityRequest):
    # Calculate anomaly severity score
    features = pd.DataFrame([[req.calls, req.transactions, req.amount]], 
                            columns=['calls_per_day', 'transactions', 'transaction_amount'])
    
    raw_score = anomaly_model.decision_function(features)[0]
    
    # Historical baseline bounds from training (approximate for normalization)
    min_s, max_s = -0.15, 0.05 
    severity = float(np.clip((1 - (raw_score - min_s) / (max_s - min_s)), 0, 1))
    
    status = "POTENTIAL_ANOMALY" if severity >= 0.85 else "NORMAL_BEHAVIOR"

    # Determine specific signals triggering the anomaly
    # (Assuming simple baseline heuristics for the explainable signals layer)
    comm_spike = req.calls > 30 
    txn_spike = req.transactions > 5 or req.amount > 100000

    # Return standardized Level 1 Output
    return {
        "model": "anomaly_detection",
        "model_version": "v1.0",
        "entity_id": req.entity_id,
        "score": round(severity, 4),
        "status": status,
        "signals": {
            "communication_spike": comm_spike,
            "transaction_spike": txn_spike,
            "location_change": False # Placeholder for future feature
        }
    }
