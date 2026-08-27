-- PostgreSQL Control Plane Schema for PS26189-CONTRACT-v1
-- Developer 2 ownership: users, roles, user_roles, cases, case_members, evidence, ingestion_jobs, entity_review, audit_event_ref

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    display_name TEXT NOT NULL,
    status VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id VARCHAR(255) NOT NULL,
    role_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    classification VARCHAR(100) NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS case_members (
    case_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    access_level VARCHAR(50) NOT NULL,
    PRIMARY KEY (case_id, user_id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence (
    id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    source_type VARCHAR(100) NOT NULL,
    source_ref TEXT NOT NULL,
    storage_uri TEXT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    classification VARCHAR(100) NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    source_ref TEXT NOT NULL,
    state VARCHAR(50) NOT NULL,
    error TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entity_review (
    candidate_id VARCHAR(255) PRIMARY KEY,
    decision VARCHAR(50) NOT NULL,
    reviewer_id VARCHAR(255) NOT NULL,
    decided_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_event_ref (
    event_id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255),
    actor_id VARCHAR(255) NOT NULL,
    action TEXT NOT NULL
);
