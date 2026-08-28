# AI-Powered Criminal Network Analysis System (Backend)

This repository contains the **D2 Control Plane Backend** for the AI-Powered Criminal Network Analysis System.
It strictly adheres to the frozen `PS26189 Developer 2 API Contract`.

## System Architecture & Boundaries

The architecture maintains strict boundaries across microservices:
- **D2 (This Repo — Control Plane Backend)**:
  - Orchestrates core REST APIs (`/api/cases`, `/api/ingestions`, `/api/relationships`, `/api/reports`, `/api/evidence`, `/api/admin`, `/api/auth`).
  - Manages secure user authentication, RBAC authorization, case scoping, and multi-level classification clearance.
  - Owns MongoDB (control plane state, metadata, evidence registry, case membership) and Redis (session store & BullMQ async queues).
  - Owns evidence ingestion pipeline, deterministic entity/relationship extraction, and cryptographic SHA-256 integrity verification.
  - **Zero Direct Database Coupling**: D2 does **not** connect directly to Qdrant, Neo4j, or Ollama. All intelligence and graph operations are delegated via signed HTTP microservice contracts.
- **D3 (Intelligence & Copilot Microservice)**:
  - Owns vector embeddings, Qdrant vector database, RAG, and LLM Copilot operations (Ollama).
- **D4 (Graph Analytics Microservice)**:
  - Owns Neo4j graph database, graph path analysis, betweenness centrality bridges, and temporal timeline clustering.
- **ML (Predictive Analytics Microservice)**:
  - Owns machine learning entity matching and anomalous behavior detection.

## Microservice Integration Contracts

All inter-service HTTP requests from D2 are authenticated using cryptographically signed headers:
- `X-Authorization-Context`: JSON containing `user_id`, `role`, `case_id`, and `access_level`.
- `X-Authorization-Signature`: HMAC-SHA256 signature generated with `INTERNAL_SERVICE_SECRET`.
- `X-Correlation-ID`: Audit correlation identifier.

### D3 Service Endpoints (`D3_SERVICE_URL`)
- `POST /search` — Semantic multi-modal search across case evidence.
- `POST /copilot` — AI Copilot grounded Q&A and risk synthesis.
- `POST /leads` — Actionable investigative lead generation.

### D4 Service Endpoints (`D4_SERVICE_URL`)
- `POST /graph/focused` — Ego-network subgraphs centered on target entities.
- `POST /graph/path` — Shortest path and relational chain discovery between nodes.
- `POST /analytics/bridge` — Structural bridge entity detection via betweenness centrality.
- `POST /analytics/temporal` — Time-series communication cadence and cluster detection.
- `POST /relationships/batch` — Bulk relationship ingestion into Neo4j (`CALLED`, `TRANSFERRED_MONEY`, `USED`, `VISITED`, `MET_AT`, `LINKED_TO`).
- `POST /internal/entities/resolve` (`ENTITY_RESOLUTION.v1`) — Canonical entity resolution synchronization:
  ```json
  {
    "candidate_id": "CAND-001",
    "case_id": "CASE-1042",
    "decision": "ACCEPTED",
    "canonical_entity": {
      "id": "ENT-001",
      "name": "John Doe",
      "type": "PERSON",
      "identifiers": { "phone": "+919876543210" },
      "properties": { "score": 0.95 },
      "created_at": "2026-08-28T10:00:00.000Z"
    },
    "reviewer_id": "USR-001",
    "decided_at": "2026-08-28T10:05:00.000Z"
  }
  ```

### ML Service Endpoints (`ML_SERVICE_URL`)
- `POST /predict/entity-match` — Entity resolution match probability and explainable signal breakdown.
- `POST /predict/anomaly` — Structural anomaly scoring and suspicious activity flagging.

## Real Services vs Contract Mock Services

- **Demo / Development Mode (`docker-compose.yml`)**:
  Provides built-in contract mock HTTP services (`ml_service`, `d3_service`, `d4_service`) labeled as `CONTRACT MOCK / DEMO ONLY` to allow isolated backend contract verification and local functional testing.
- **Production / SIH Final Integration**:
  Replace the mock containers in `docker-compose.yml` with the real D3 (Qdrant + Ollama), D4 (Neo4j), and ML service repository containers connected to the `netra` Docker bridge network, pointing `D3_SERVICE_URL`, `D4_SERVICE_URL`, and `ML_SERVICE_URL` to their respective service names.

## Resilience & Graceful Degradation Policy

> [!IMPORTANT]
> **Zero Intelligence Fabrication Policy**:
> D2 fails gracefully when ML, D3, or D4 microservices are unavailable. It **never fabricates** intelligence results or synthetic match scores. Unavailable analysis is explicitly reported as an `UNAVAILABLE` state, ensuring officers are never presented with artificial probabilities.

## Prerequisites
- Node.js (v20+)
- Docker & Docker Compose
- Vitest

## Installation
```bash
git clone <repository_url>
cd AI-Powered-Criminal-Network-Analysis-System-backend
npm install
```

## Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure you have set `MONGODB_URI`, `SESSION_SECRET`, and `INTERNAL_SERVICE_SECRET`.

## Running with Docker Compose
To launch the complete environment (Backend, MongoDB, Redis, and mock D3/D4/ML services):
```bash
docker compose up -d
```

## Running the Backend Locally
```bash
# Development mode with live reload
npm run dev

# Production build and start
npm run build
npm start
```

## Running Tests
```bash
npm test
```
The test suite executes:
- **Contract Verification Tests** (`tests/contract_verification.test.ts`): Verifies D2 $\rightarrow$ D3/D4/ML schemas and signatures.
- **Fixture Tests** (`tests/fixtures.test.ts`): BE-T01 through BE-T07 regression fixtures.
- **Reports & Mocks Tests** (`tests/reports_and_mocks.test.ts`): 16-section PDF reports and downstream resilience.
- **Security & Authorization Tests** (`tests/security_and_resilience.test.ts`): Cross-case isolation, pre-downstream authorization enforcement, and sync retries.
- **E2E Integration** (`tests/integration/e2e.test.ts`): Complete upload $\rightarrow$ ingest $\rightarrow$ resolve $\rightarrow$ report workflow.
