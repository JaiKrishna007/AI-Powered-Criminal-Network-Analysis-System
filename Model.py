from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
import xgboost as xgb
import joblib

app = FastAPI(
    title="AI Criminal Network Analysis API — ML & Graph Subsystem",
    version="1.0.0",
    description="Integrated API exposing ML models (Entity Resolution, Anomaly Detection), Graph Analytics (Bounded GRAPH.v1), Insight Fusion (INSIGHT.v1), and RAG/Copilot Context."
)

# ---------------------------------------------------------------------
# 1. LOAD PRE-TRAINED ML MODELS
# ---------------------------------------------------------------------
er_model = xgb.XGBClassifier()
try:
    er_model.load_model('models/entity_resolution.json')
except Exception as e:
    print(f"Warning: Could not load entity_resolution.json: {e}")

try:
    anomaly_model = joblib.load('models/anomaly_model.pkl')
except Exception as e:
    print(f"Warning: Could not load anomaly_model.pkl: {e}")


# ---------------------------------------------------------------------
# 3. PYDANTIC CONTRACT SCHEMAS
# ---------------------------------------------------------------------
class EntityPairRequest(BaseModel):
    record_a_id: str
    record_b_id: str
    name_sim: float = Field(..., ge=0.0, le=1.0)
    address_sim: float = Field(..., ge=0.0, le=1.0)
    org_sim: float = Field(..., ge=0.0, le=1.0)
    phone_match: bool
    vehicle_match: bool

class ActivityRequest(BaseModel):
    entity_id: str
    calls: int = Field(..., ge=0)
    transactions: int = Field(..., ge=0)
    amount: float = Field(..., ge=0.0)


# ---------------------------------------------------------------------
# 4. ML PREDICTION ENDPOINTS (Standard & Connected)
# ---------------------------------------------------------------------
@app.post("/predict/entity-match", summary="ML Entity Match Prediction")
@app.post("/api/v1/resolve", summary="Level 1 Entity Resolution Endpoint")
def resolve_entity(req: EntityPairRequest):
    features = pd.DataFrame([{
        'name_similarity': req.name_sim,
        'address_similarity': req.address_sim,
        'org_similarity': req.org_sim,
        'phone_match': int(req.phone_match),
        'vehicle_match': int(req.vehicle_match)
    }])
    
    prob = float(er_model.predict_proba(features)[0][1])
    
    if prob >= 0.90:
        status = "HIGH_CONFIDENCE_MATCH"
    elif prob >= 0.50:
        status = "REVIEW"
    else:
        status = "LOW_CONFIDENCE_NON_MATCH"

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

@app.post("/predict/anomaly", summary="ML Behavioral Anomaly Prediction")
@app.post("/api/v1/analyze_behavior", summary="Level 1 Behavior Anomaly Endpoint")
def analyze_behavior(req: ActivityRequest):
    features = pd.DataFrame([[req.calls, req.transactions, req.amount]], 
                            columns=['calls_per_day', 'transactions', 'transaction_amount'])
    
    raw_score = anomaly_model.decision_function(features)[0]
    min_s, max_s = -0.15, 0.05 
    severity = float(np.clip((1 - (raw_score - min_s) / (max_s - min_s)), 0, 1))
    
    status = "POTENTIAL_ANOMALY" if severity >= 0.85 else "NORMAL_BEHAVIOR"
    comm_spike = req.calls > 30 
    txn_spike = req.transactions > 5 or req.amount > 100000

    return {
        "model": "anomaly_detection",
        "model_version": "v1.0",
        "entity_id": req.entity_id,
        "score": round(severity, 4),
        "status": status,
        "signals": {
            "communication_spike": comm_spike,
            "transaction_spike": txn_spike,
            "location_change": False
        }
    }


