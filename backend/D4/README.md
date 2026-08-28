# AI-Powered Criminal Network Analysis System
## 🧠 Machine Learning & Intelligence Subsystem (`ml-graph` Branch)

An intelligence API service delivering **Entity Resolution** and **Behavioral Anomaly Detection** for criminal network analysis and link prediction.

---

## 📌 Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Incoming Data Stream    │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   FastAPI REST Engine     │
                          │        (Model.py)         │
                          └──────┬─────────────┬──────┘
                                 │             │
              ┌──────────────────┘             └──────────────────┐
              ▼                                                   ▼
┌───────────────────────────┐                       ┌───────────────────────────┐
│ XGBoost Classifier         │                       │ IsolationForest Model     │
│ Entity Resolution         │                       │ Anomaly Detection         │
│ (models/entity_res.json)  │                       │ (models/anomaly_model.pkl)│
└─────────────┬─────────────┘                       └─────────────┬─────────────┘
              │                                                   │
              ▼                                                   ▼
┌───────────────────────────┐                       ┌───────────────────────────┐
│ High Match / Review /     │                       │ Potential Anomaly /       │
│ Low Match Classification  │                       │ Normal Behavior Output    │
└───────────────────────────┘                       └───────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Virtual environment (recommended)

### 2. Installation
Clone the repository and switch to the `ml-graph` branch:

```bash
git clone -b ml-graph https://github.com/JaiKrishna007/AI-Powered-Criminal-Network-Analysis-System.git
cd AI-Powered-Criminal-Network-Analysis-System
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

### 3. Running the API Server

Start the live ASGI server using Uvicorn:

```bash
uvicorn Model:app --reload --host 0.0.0.0 --port 8000
```

Once running, access the interactive API documentation at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 API Specification

### 1. Entity Resolution (`POST /api/v1/resolve`)
Determines whether two distinct records refer to the same physical person or alias within criminal intelligence datasets.

**Request Payload:**
```json
{
  "record_a_id": "A102",
  "record_b_id": "B784",
  "name_sim": 0.95,
  "address_sim": 0.88,
  "org_sim": 0.90,
  "phone_match": true,
  "vehicle_match": true
}
```

**Response:**
```json
{
  "model": "entity_resolution",
  "model_version": "v1.0",
  "entity_ids": ["A102", "B784"],
  "score": 0.9421,
  "status": "HIGH_CONFIDENCE_MATCH",
  "signals": {
    "name_similarity": 0.95,
    "address_similarity": 0.88,
    "phone_match": true,
    "vehicle_match": true
  }
}
```

---

### 2. Behavioral Anomaly Detection (`POST /api/v1/analyze_behavior`)
Analyzes call activity, transaction counts, and monetary amounts to flag potential suspicious behavior spikes.

**Request Payload:**
```json
{
  "entity_id": "P102",
  "calls": 143,
  "transactions": 12,
  "amount": 1200000.0
}
```

**Response:**
```json
{
  "model": "anomaly_detection",
  "model_version": "v1.0",
  "entity_id": "P102",
  "score": 0.8950,
  "status": "POTENTIAL_ANOMALY",
  "signals": {
    "communication_spike": true,
    "transaction_spike": true,
    "location_change": false
  }
}
```

---

## 📂 Repository Structure

```plaintext
.
├── models/
│   ├── entity_resolution.json     # Trained XGBoost Entity Resolution Model
│   └── anomaly_model.pkl          # Trained IsolationForest Anomaly Model
├── .gitignore                     # Git exclusion rules
├── Model.py                       # Core FastAPI application & ML inference pipeline
├── README.md                      # Documentation & deployment guide
└── requirements.txt               # Python package dependencies
```
