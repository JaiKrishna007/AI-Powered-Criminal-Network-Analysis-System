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

print("=================================================================")
print(f"     SUMMARY: {passed_tests} PASSED | {failed_tests} FAILED")
print("=================================================================")

if failed_tests > 0:
    sys.exit(1)
