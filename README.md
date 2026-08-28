# AI-Powered Criminal Network Analysis System (NETRA)

An end-to-end intelligence and investigation platform for multi-source evidence extraction, automated entity resolution, dynamic graph analysis, temporal analytics, and AI-assisted investigation copilot.

---

## 🏗️ Repository Architecture

```text
AI-Powered-Criminal-Network-Analysis-System/
├── frontend/                     # Next.js 14 Web Application & Visualization UI
│   ├── app/                      # Next.js App Router (Cases, Dashboards, Reports)
│   ├── components/               # Graph Canvas, Copilot, Case Shell, Evidence Panels
│   ├── lib/client-contracts/     # Strongly-typed Shared Contract Adapters
│   ├── src/api/                  # D2 API Gateway Client & Auth Wrappers
│   └── __tests__/                # Vitest E2E & Integration Test Suites
│
└── backend/                      # Microservices Backend Architecture
    ├── D2/                       # Ingestion Gateway, AI & ML Services, Entity Review
    ├── D3/                       # RAG Pipeline, Qdrant Vector Storage, Ollama/LLM Copilot
    ├── D4/                       # Graph Intelligence, Temporal Analytics, Trust & Audit
    └── shared-contracts/         # Shared Schema Definitions & Enforced Contracts (Zod/TS)
```

---

## 🚀 Quick Start

### 1. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

To run tests and production build:
```bash
npm test
npm run build:frontend
```

### 2. Backend Services Setup
Refer to each microservice's directory (`backend/D2`, `backend/D3`, `backend/D4`) for individual requirements, environment variables, and startup instructions.

---

## 🔒 Security & Contracts
- Strict authorization and access controls enforced across all service boundaries.
- Strongly-typed validation powered by `shared-contracts` ensuring schema compliance between microservices and client interfaces.
- Evidence hashing and tamper-evident audit logging.
