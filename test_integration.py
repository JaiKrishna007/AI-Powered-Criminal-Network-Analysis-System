import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000"

print("=================================================================")
print("     NETRA SIH INTEGRATION & CONTRACT SUITE (ML + GRAPH)        ")
print("=================================================================\n")

time.sleep(0.5)

failed_tests = 0
passed_tests = 0

def log_test(name, success, response_data=None):
    global failed_tests, passed_tests
    if success:
        passed_tests += 1
        print(f"[PASS] {name}")
        if response_data:
            print(json.dumps(response_data, indent=2)[:350] + "\n...\n")
    else:
        failed_tests += 1
        print(f"[FAIL] {name}\n")

# ---------------------------------------------------------------------
# 1. CLEAN REST APIs & ML PREDICTION ENDPOINTS
# ---------------------------------------------------------------------
print("--- TASK 1 & 2: REST APIs & Connected ML Service Outputs ---")

# Test 1.1: /predict/entity-match
payload_match = {
  "record_a_id": "A102",
  "record_b_id": "B784",
  "name_sim": 0.95,
  "address_sim": 0.88,
  "org_sim": 0.90,
  "phone_match": True,
  "vehicle_match": True
}
try:
    res = requests.post(f"{BASE_URL}/predict/entity-match", json=payload_match)
    log_test("ML Predict Entity Match (/predict/entity-match)", res.status_code == 200, res.json())
except Exception as e:
    log_test("ML Predict Entity Match (/predict/entity-match)", False)

# Test 1.2: /predict/anomaly
payload_anomaly = {
  "entity_id": "P102",
  "calls": 143,
  "transactions": 12,
  "amount": 1200000.0
}
try:
    res = requests.post(f"{BASE_URL}/predict/anomaly", json=payload_anomaly)
    log_test("ML Predict Anomaly (/predict/anomaly)", res.status_code == 200, res.json())
except Exception as e:
    log_test("ML Predict Anomaly (/predict/anomaly)", False)

# ---------------------------------------------------------------------
# 2. GRAPH.v1 FRONTEND CONTRACT (BOUNDED SUBGRAPH)
# ---------------------------------------------------------------------
print("--- TASK 4: Hand GRAPH.v1 Bounded Subgraph to Frontend ---")
try:
    res = requests.get(f"{BASE_URL}/api/cases/CASE-101/graph?entity_id=E101&max_hops=2")
    data = res.json()
    is_valid = res.status_code == 200 and data.get("contract") == "GRAPH.v1" and data.get("bounded") == True
    log_test("Bounded Subgraph GRAPH.v1 (/api/cases/CASE-101/graph)", is_valid, data)
except Exception as e:
    log_test("Bounded Subgraph GRAPH.v1 (/api/cases/CASE-101/graph)", False)

# ---------------------------------------------------------------------
# 3. ANALYTICS & RELATIONSHIPS
# ---------------------------------------------------------------------
print("--- TASK 6: Analytics & Relationship Inspection ---")

# Bridge Analytics
try:
    bridge_payload = {"cluster_a": ["E101", "E102"], "cluster_b": ["E201", "E202"]}
    res = requests.post(f"{BASE_URL}/api/cases/CASE-101/analytics/bridge", json=bridge_payload)
    log_test("Bridge Node Detection (/api/cases/CASE-101/analytics/bridge)", res.status_code == 200, res.json())
except Exception as e:
    log_test("Bridge Node Detection (/api/cases/CASE-101/analytics/bridge)", False)

# Temporal Analytics
try:
    temp_payload = {"entity_ids": ["E101", "E301"], "time_window": "7d"}
    res = requests.post(f"{BASE_URL}/api/cases/CASE-101/analytics/temporal", json=temp_payload)
    log_test("Temporal Analytics (/api/cases/CASE-101/analytics/temporal)", res.status_code == 200, res.json())
except Exception as e:
    log_test("Temporal Analytics (/api/cases/CASE-101/analytics/temporal)", False)

# Relationship Details
try:
    res = requests.get(f"{BASE_URL}/api/relationships/REL-101")
    data = res.json()
    is_valid = res.status_code == 200 and data.get("contract") == "RELATIONSHIP.v1"
    log_test("Relationship Details (/api/relationships/REL-101)", is_valid, data)
except Exception as e:
    log_test("Relationship Details (/api/relationships/REL-101)", False)

# ---------------------------------------------------------------------
# 4. SHARED INSIGHT.v1 FUSION CONTRACT
# ---------------------------------------------------------------------
print("--- TASK 3: Shared Contract INSIGHT.v1 Fusion ---")
try:
    fuse_payload = {
        "case_id": "CASE-101",
        "entity_ids": ["E101", "E301"],
        "ml_input": {"entity_id": "E101", "calls": 143, "transactions": 12, "amount": 1200000.0},
        "evidence_ids": ["EVID-301", "EVID-303"]
    }
    res = requests.post(f"{BASE_URL}/api/cases/CASE-101/insights/fuse", json=fuse_payload)
    data = res.json()
    is_valid = res.status_code == 200 and data.get("contract") == "INSIGHT.v1"
    log_test("Insight Fusion INSIGHT.v1 (/api/cases/CASE-101/insights/fuse)", is_valid, data)
except Exception as e:
    log_test("Insight Fusion INSIGHT.v1 (/api/cases/CASE-101/insights/fuse)", False)

# ---------------------------------------------------------------------
# 5. HAND FINDINGS TO RAG / COPILOT CONTEXT
# ---------------------------------------------------------------------
print("--- TASK 5: Hand Findings to RAG / Copilot ---")
try:
    res = requests.get(f"{BASE_URL}/api/cases/CASE-101/copilot/context?entity_id=E101")
    data = res.json()
    is_valid = res.status_code == 200 and data.get("contract") == "COPILOT_CONTEXT.v1" and "grounding_prompt" in data
    log_test("Copilot/RAG Context (/api/cases/CASE-101/copilot/context)", is_valid, data)
except Exception as e:
    log_test("Copilot/RAG Context (/api/cases/CASE-101/copilot/context)", False)

print("=================================================================")
print(f"     SUMMARY: {passed_tests} PASSED | {failed_tests} FAILED")
print("=================================================================")

if failed_tests > 0:
    sys.exit(1)
