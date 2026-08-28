# AI-Powered Criminal Network Analysis System (Backend)

This repository contains the `D2` Control Plane Backend for the AI-Powered Criminal Network Analysis System.
It strictly adheres to the PS26189 Developer 2 API Contract.

## Architecture
The system is divided into functional boundaries:
- **D2 (This Repo)**: Orchestrates the API, authentication, authorization, evidence ingestion, auditing, and entity state control.
- **D3 (Mocked/External)**: Intelligence, Embeddings, RAG, and LLM Copilot operations.
- **D4 (Mocked/External)**: Graph Analytics, Temporal analytics, and visual layout.

## Prerequisites
- Node.js (v18+)
- Docker & Docker Compose
- Vitest

## Installation
```bash
git clone <repository_url>
cd AI-Powered-Criminal-Network-Analysis-System-backend
npm install
```

## Environment Variables
Create a `.env` file based on the provided `.env.example`:
```bash
cp .env.example .env
```
Ensure you have set `MONGODB_URI` and `SESSION_SECRET` correctly.

## MongoDB Setup
By default, the application will initialize its own required collections and indexes in MongoDB upon connecting. 
The database uses `netra` as the default database name.

## Running Infrastructure with Docker Compose
The system relies on MongoDB, Neo4j, Redis, and Qdrant. You can spin these up using:
```bash
docker-compose up -d
```

## Running the Backend
To start the backend in development mode:
```bash
npm run dev
```

To build and run in production:
```bash
npm run build
npm start
```

## Running Tests
Tests are executed using Vitest, which handles testing logic, integration, and mocking.
```bash
npm test
```

## Synthetic Dataset & Demo
A deterministic test fixture dataset is used in the `tests/fixtures.test.ts` to simulate Case 1042, Case 101, etc.
For the Two-Laptop Demo, one laptop runs the Backend (this repo) + MongoDB/Redis, and the other laptop runs the Frontend or Graph client.

### Reset Procedure
To completely wipe and reset the local backend state:
1. Stop the backend server.
2. Run `docker-compose down -v` to wipe all databases and volumes.
3. Restart `docker-compose up -d`.
4. Run `npm run start` to automatically seed the default test roles and users on boot.

## Troubleshooting
- **Build Errors**: Check for `target: ES2022` mismatches or missing `@types`. Run `npm run build` to verify typings.
- **Worker Hangs**: Ensure Redis is reachable and the `BullMQ` configuration in `worker/ingestion.queue.ts` points to the correct host.
- **ML/D4 Failures**: Since D3/D4 are separate repos, if they are down, D2 is designed to fail gracefully with mock/fallback probabilities.
