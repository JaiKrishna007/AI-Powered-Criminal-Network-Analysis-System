import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
from difflib import SequenceMatcher
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_score, recall_score, f1_score
from faker import Faker
import random
import re

# 1. Similarity Engine (exact same logic as training)
def smart_similarity(a, b):
    if pd.isna(a) or pd.isna(b):
        return 0.0
    a_str = re.sub(r'\bmd\.?\b', 'mohammed', str(a).lower().strip())
    b_str = re.sub(r'\bmd\.?\b', 'mohammed', str(b).lower().strip())
    
    char_sim = SequenceMatcher(None, a_str, b_str).ratio()
    a_tokens = re.findall(r'\w+', a_str)
    b_tokens = re.findall(r'\w+', b_str)
    
    if not a_tokens or not b_tokens:
        return char_sim
        
    matched_tokens = 0
    for t_a in a_tokens:
        for t_b in b_tokens:
            if t_a == t_b or (len(t_a) == 1 and t_b.startswith(t_a)) or (len(t_b) == 1 and t_a.startswith(t_b)):
                matched_tokens += 1
                break
    token_sim = matched_tokens / max(len(a_tokens), len(b_tokens))
    return max(char_sim, token_sim)

# 2. Load the production models
er_model = xgb.XGBClassifier()
er_model.load_model('models/entity_resolution.json')
anomaly_model = joblib.load('models/anomaly_model.pkl')

features = ['name_similarity', 'address_similarity', 'org_similarity', 'phone_match', 'vehicle_match']

# =====================================================================
# TEST 1: ENTITY RESOLUTION ON 1,000 UNSEEN PAIRS
# =====================================================================
print("=" * 65)
print("1. GENERATING & EVALUATING 1,000 NEW UNSEEN PAIRS (ENTITY RESOLUTION)")
print("=" * 65)

fake = Faker('en_IN')
Faker.seed(999)  # Brand new seed
random.seed(999)

def inject_noise(text):
    if not text or len(text) < 4:
        return text
    t = list(str(text))
    idx = random.randint(0, len(t) - 2)
    t[idx], t[idx+1] = t[idx+1], t[idx]
    return "".join(t)

test_data = []

# 500 Unseen True Matches (with aliases, initials, partial addresses)
for _ in range(500):
    name = fake.name()
    phone = fake.phone_number()
    street = fake.street_name()
    city = fake.city()
    state = fake.state()
    address = f"{street}, {city}, {state}"
    vehicle = f"TN{random.randint(10,99)}A{random.randint(1000,9999)}"
    org = fake.company()
    
    # Realistic alias variations
    parts = name.split()
    name_b = f"{parts[0]} {parts[1][0]}." if len(parts) > 1 and random.random() > 0.4 else inject_noise(name)
    address_b = f"{city}, {state}" if random.random() > 0.5 else address
    org_b = f"{org} Pvt Ltd" if random.random() > 0.5 else org
    
    test_data.append([name, name_b, phone, phone, address, address_b, vehicle, vehicle, org, org_b, 1])

# 500 Unseen True Negatives (Distinct people, common names, random attributes)
for _ in range(500):
    test_data.append([
        fake.name(), fake.name(),
        fake.phone_number(), fake.phone_number(),
        f"{fake.street_name()}, {fake.city()}", f"{fake.street_name()}, {fake.city()}",
        f"TN{random.randint(10,99)}A{random.randint(1000,9999)}", f"TN{random.randint(10,99)}B{random.randint(1000,9999)}",
        fake.company(), fake.company(),
        0
    ])

df_test = pd.DataFrame(test_data, columns=[
    'record_a_name', 'record_b_name', 'record_a_phone', 'record_b_phone',
    'record_a_address', 'record_b_address', 'record_a_vehicle', 'record_b_vehicle',
    'record_a_organization', 'record_b_organization', 'true_label'
])

# Feature computation
df_test['name_similarity'] = df_test.apply(lambda r: smart_similarity(r['record_a_name'], r['record_b_name']), axis=1)
df_test['address_similarity'] = df_test.apply(lambda r: smart_similarity(r['record_a_address'], r['record_b_address']), axis=1)
df_test['org_similarity'] = df_test.apply(lambda r: smart_similarity(r['record_a_organization'], r['record_b_organization']), axis=1)
df_test['phone_match'] = (df_test['record_a_phone'].astype(str) == df_test['record_b_phone'].astype(str)).astype(int)
df_test['vehicle_match'] = (df_test['record_a_vehicle'].astype(str) == df_test['record_b_vehicle'].astype(str)).astype(int)

# Inference
probs = er_model.predict_proba(df_test[features])[:, 1]
preds = (probs >= 0.80).astype(int)

# Accuracy & Metrics
y_true = df_test['true_label']
print(f"Total Test Samples:    {len(y_true)}")
print(f"Accuracy:              {accuracy_score(y_true, preds)*100:.2f}%")
print(f"Precision:             {precision_score(y_true, preds)*100:.2f}%")
print(f"Recall:                {recall_score(y_true, preds)*100:.2f}%")
print(f"F1-Score:              {f1_score(y_true, preds)*100:.2f}%\n")

print("Detailed Classification Report:")
print(classification_report(y_true, preds, target_names=['Different Entity (0)', 'Same Entity (1)']))

# =====================================================================
# TEST 2: ANOMALY DETECTION ON 1,000 UNSEEN ACTIVITY DAYS
# =====================================================================
print("=" * 65)
print("2. EVALUATING ANOMALY DETECTION ON 1,000 UNSEEN BEHAVIORAL LOGS")
print("=" * 65)

# Generate 950 normal baseline days and 50 extreme spikes
np.random.seed(999)
normal_calls = np.clip(np.random.normal(10, 3, 950), 1, 30).astype(int)
normal_txns = np.clip(np.random.normal(2, 1, 950), 1, 6).astype(int)
normal_amts = np.clip(np.random.normal(3000, 1000, 950), 500, 10000).astype(float)
normal_labels = np.zeros(950, dtype=int)

# 50 Injected High-Deviation Events
spike_calls = np.random.randint(90, 250, 50)
spike_txns = np.random.randint(10, 30, 50)
spike_amts = np.random.uniform(500000, 3000000, 50)
spike_labels = np.ones(50, dtype=int)

eval_act_df = pd.DataFrame({
    'calls_per_day': np.concatenate([normal_calls, spike_calls]),
    'transactions': np.concatenate([normal_txns, spike_txns]),
    'transaction_amount': np.concatenate([normal_amts, spike_amts]),
    'is_anomaly': np.concatenate([normal_labels, spike_labels])
})

# Run Anomaly Model Decision
scores = anomaly_model.decision_function(eval_act_df[['calls_per_day', 'transactions', 'transaction_amount']])
min_s, max_s = -0.15, 0.05
severities = np.clip((1 - (scores - min_s) / (max_s - min_s)), 0, 1)
ad_preds = (severities >= 0.85).astype(int)

print(f"Total Activity Logs:   {len(eval_act_df)}")
print(f"Injected Anomalies:    {sum(spike_labels)}")
print(f"Detected Anomalies:    {sum(ad_preds)}")
print(f"Anomaly Detection Recall (True Positive Rate): {recall_score(eval_act_df['is_anomaly'], ad_preds)*100:.2f}%")
print(f"Anomaly Precision:                            {precision_score(eval_act_df['is_anomaly'], ad_preds)*100:.2f}%")
print("=" * 65)
