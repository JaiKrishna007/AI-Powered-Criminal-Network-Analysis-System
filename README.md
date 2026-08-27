# AI-Powered Criminal Network Analysis System

## 🚀 Live Web Service Setup Guide

Follow this step-by-step setup to run the complete intelligence pipeline as a live web service on your local machine or server.

---

### 1. Project Directory Structure

```plaintext
NETRA SIH/
│
├── models/
│   ├── entity_resolution.json
│   └── anomaly_model.pkl
│
├── Model.py
└── README.md
```

---

### 2. Install Required Dependencies

Open your terminal or command prompt in the project root directory and run:

```bash
pip install fastapi uvicorn pandas scikit-learn xgboost joblib requests
```

---

### 3. FastAPI Service (`Model.py`)

The primary web service is defined in `Model.py`, exposing Level 1 endpoints for Entity Resolution and Behavioral Anomaly Detection:

```python
from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import numpy as np
import xgboost as xgb
import joblib

app = FastAPI(title="SIH Intelligence API - Level 1")

# Load saved models
er_model = xgb.XGBClassifier()
er_model.load_model('models/entity_resolution.json')
anomaly_model = joblib.load('models/anomaly_model.pkl')

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

@app.post("/api/v1/resolve")
def resolve_entity(req: EntityPairRequest):
    features = pd.DataFrame([{
        'name_similarity': req.name_sim,
        'address_similarity': req.address_sim,
        'org_similarity': req.org_sim,
        'phone_match': int(req.phone_match),
        'vehicle_match': int(req.vehicle_match)
    }])
    
    prob = float(er_model.predict_proba(features)[0][1])
    status = "HIGH_CONFIDENCE_MATCH" if prob >= 0.90 else ("REVIEW" if prob >= 0.50 else "LOW_CONFIDENCE_NON_MATCH")

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

@app.post("/api/v1/analyze_behavior")
def analyze_behavior(req: ActivityRequest):
    features = pd.DataFrame([[req.calls, req.transactions, req.amount]], 
                            columns=['calls_per_day', 'transactions', 'transaction_amount'])
    
    raw_score = anomaly_model.decision_function(features)[0]
    min_s, max_s = -0.15, 0.05 
    severity = float(np.clip((1 - (raw_score - min_s) / (max_s - min_s)), 0, 1))
    status = "POTENTIAL_ANOMALY" if severity >= 0.85 else "NORMAL_BEHAVIOR"

    return {
        "model": "anomaly_detection",
        "model_version": "v1.0",
        "entity_id": req.entity_id,
        "score": round(severity, 4),
        "status": status,
        "signals": {
            "communication_spike": req.calls > 30,
            "transaction_spike": (req.transactions > 5 or req.amount > 100000),
            "location_change": False
        }
    }
```

---

### 4. Start the Live Server

Run Uvicorn directly with `Model:app`:

```bash
uvicorn Model:app --reload --port 8000
```

Terminal Output:
```plaintext
INFO:     Started server process [PID]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

---

### 5. Interactive Swagger UI & Testing

Open your browser and navigate to:
* **Interactive Swagger UI**: **[http://localhost:8000/docs](http://localhost:8000/docs)**
* **ReDoc Format**: **[http://localhost:8000/redoc](http://localhost:8000/redoc)**
