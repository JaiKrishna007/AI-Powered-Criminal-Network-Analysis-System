import { Pool } from 'pg';
import {
  User,
  Role,
  UserRole,
  Case,
  CaseMember,
  Evidence,
  IngestionJob,
  EntityReview,
  AuditEventRef,
  EntityCandidate
} from '../models/types';

// PostgreSQL Pool connection setup
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/netra',
  max: 10,
  idleTimeoutMillis: 30000
});

export class ControlPlaneDB {
  private isTestEnv: boolean;

  // Isolated Test Repository (Used EXCLUSIVELY during unit test runs)
  private testUsers: Map<string, User> = new Map();
  private testRoles: Map<string, Role> = new Map();
  private testUserRoles: UserRole[] = [];
  private testCases: Map<string, Case> = new Map();
  private testCaseMembers: CaseMember[] = [];
  private testEvidence: Map<string, Evidence> = new Map();
  private testIngestionJobs: Map<string, IngestionJob> = new Map();
  private testEntityReviews: Map<string, EntityReview> = new Map();
  private testAuditEvents: Map<string, AuditEventRef> = new Map();
  private testCandidates: Map<string, EntityCandidate> = new Map();

  constructor() {
    this.isTestEnv = process.env.NODE_ENV === 'test';
    if (this.isTestEnv) {
      this.seedDefaultRolesTest();
    }
  }

  private seedDefaultRolesTest() {
    this.testRoles.set('INVESTIGATOR', { id: 'role-investigator', name: 'INVESTIGATOR' });
    this.testRoles.set('SUPERVISOR', { id: 'role-supervisor', name: 'SUPERVISOR' });
    this.testRoles.set('SYSTEM ADMIN', { id: 'role-admin', name: 'SYSTEM ADMIN' });
  }

  // --- 1. Users ---
  public async createUser(user: User): Promise<User> {
    if (this.isTestEnv) {
      this.testUsers.set(user.id, user);
      return user;
    }
    const query = 'INSERT INTO users (id, display_name, status) VALUES ($1, $2, $3) RETURNING *;';
    const res = await pgPool.query(query, [user.id, user.display_name, user.status]);
    return res.rows[0];
  }

  public async getUser(id: string): Promise<User | null> {
    if (this.isTestEnv) {
      return this.testUsers.get(id) || null;
    }
    const res = await pgPool.query('SELECT id, display_name, status FROM users WHERE id = $1;', [id]);
    return res.rows[0] || null;
  }

  // --- 2. Roles & UserRoles ---
  public async assignUserRole(user_id: string, role_name: string): Promise<void> {
    if (this.isTestEnv) {
      const role = Array.from(this.testRoles.values()).find(r => r.name === role_name);
      if (role) {
        if (!this.testUserRoles.some(ur => ur.user_id === user_id && ur.role_id === role.id)) {
          this.testUserRoles.push({ user_id, role_id: role.id });
        }
      }
      return;
    }
    const roleRes = await pgPool.query('SELECT id FROM roles WHERE name = $1;', [role_name]);
    if (roleRes.rows.length > 0) {
      const roleId = roleRes.rows[0].id;
      await pgPool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
        [user_id, roleId]
      );
    }
  }

  public async getUserRoles(user_id: string): Promise<string[]> {
    if (this.isTestEnv) {
      const userRoleEntries = this.testUserRoles.filter(ur => ur.user_id === user_id);
      const roleNames: string[] = [];
      for (const ur of userRoleEntries) {
        for (const role of this.testRoles.values()) {
          if (role.id === ur.role_id) {
            roleNames.push(role.name);
          }
        }
      }
      return roleNames;
    }
    const res = await pgPool.query(
      'SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1;',
      [user_id]
    );
    return res.rows.map(row => row.name);
  }

  // --- 3. Cases & Case Members ---
  public async createCase(caseItem: Case): Promise<Case> {
    if (this.isTestEnv) {
      this.testCases.set(caseItem.id, caseItem);
      return caseItem;
    }
    const query = 'INSERT INTO cases (id, title, status, owner_id, classification) VALUES ($1, $2, $3, $4, $5) RETURNING *;';
    const res = await pgPool.query(query, [caseItem.id, caseItem.title, caseItem.status, caseItem.owner_id, caseItem.classification]);
    return res.rows[0];
  }

  public async getCase(id: string): Promise<Case | null> {
    if (this.isTestEnv) {
      return this.testCases.get(id) || null;
    }
    const res = await pgPool.query('SELECT id, title, status, owner_id, classification FROM cases WHERE id = $1;', [id]);
    return res.rows[0] || null;
  }

  public async addCaseMember(member: CaseMember): Promise<CaseMember> {
    if (this.isTestEnv) {
      this.testCaseMembers.push(member);
      return member;
    }
    const query = 'INSERT INTO case_members (case_id, user_id, access_level) VALUES ($1, $2, $3) RETURNING *;';
    const res = await pgPool.query(query, [member.case_id, member.user_id, member.access_level]);
    return res.rows[0];
  }

  public async isUserMemberOfCase(user_id: string, case_id: string): Promise<boolean> {
    if (this.isTestEnv) {
      const c = this.testCases.get(case_id);
      if (c && c.owner_id === user_id) return true;
      return this.testCaseMembers.some(cm => cm.case_id === case_id && cm.user_id === user_id);
    }
    const cRes = await pgPool.query('SELECT owner_id FROM cases WHERE id = $1;', [case_id]);
    if (cRes.rows.length > 0 && cRes.rows[0].owner_id === user_id) {
      return true;
    }
    const cmRes = await pgPool.query('SELECT 1 FROM case_members WHERE case_id = $1 AND user_id = $2;', [case_id, user_id]);
    return cmRes.rows.length > 0;
  }

  // --- 4. Evidence ---
  public async createEvidence(ev: Evidence): Promise<Evidence> {
    if (this.isTestEnv) {
      this.testEvidence.set(ev.id, ev);
      return ev;
    }
    const query = `INSERT INTO evidence (id, case_id, source_type, source_ref, storage_uri, sha256, classification)
                   VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
    const res = await pgPool.query(query, [
      ev.id, ev.case_id, ev.source_type, ev.source_ref, ev.storage_uri, ev.sha256, ev.classification
    ]);
    return res.rows[0];
  }

  public async getEvidence(id: string): Promise<Evidence | null> {
    if (this.isTestEnv) {
      return this.testEvidence.get(id) || null;
    }
    const res = await pgPool.query('SELECT * FROM evidence WHERE id = $1;', [id]);
    return res.rows[0] || null;
  }

  public async findEvidenceBySha256(sha256: string): Promise<Evidence | null> {
    if (this.isTestEnv) {
      for (const ev of this.testEvidence.values()) {
        if (ev.sha256 === sha256) return ev;
      }
      return null;
    }
    const res = await pgPool.query('SELECT * FROM evidence WHERE sha256 = $1;', [sha256]);
    return res.rows[0] || null;
  }

  public async getEvidenceByCase(case_id: string): Promise<Evidence[]> {
    if (this.isTestEnv) {
      const list: Evidence[] = [];
      for (const ev of this.testEvidence.values()) {
        if (ev.case_id === case_id) list.push(ev);
      }
      return list;
    }
    const res = await pgPool.query('SELECT * FROM evidence WHERE case_id = $1;', [case_id]);
    return res.rows;
  }

  // --- 5. Ingestion Jobs ---
  public async createIngestionJob(job: IngestionJob): Promise<IngestionJob> {
    if (this.isTestEnv) {
      this.testIngestionJobs.set(job.id, job);
      return job;
    }
    const query = 'INSERT INTO ingestion_jobs (id, case_id, source_ref, state, error) VALUES ($1, $2, $3, $4, $5) RETURNING *;';
    const res = await pgPool.query(query, [job.id, job.case_id, job.source_ref, job.state, job.error || null]);
    return res.rows[0];
  }

  public async updateIngestionJobState(id: string, state: IngestionJob['state'], error?: string | null): Promise<IngestionJob | null> {
    if (this.isTestEnv) {
      const job = this.testIngestionJobs.get(id);
      if (!job) return null;
      job.state = state;
      if (error !== undefined) job.error = error;
      return job;
    }
    const query = 'UPDATE ingestion_jobs SET state = $1, error = $2 WHERE id = $3 RETURNING *;';
    const res = await pgPool.query(query, [state, error !== undefined ? error : null, id]);
    return res.rows[0] || null;
  }

  public async getIngestionJob(id: string): Promise<IngestionJob | null> {
    if (this.isTestEnv) {
      return this.testIngestionJobs.get(id) || null;
    }
    const res = await pgPool.query('SELECT * FROM ingestion_jobs WHERE id = $1;', [id]);
    return res.rows[0] || null;
  }

  // --- 6. Entity Review ---
  public async createEntityReview(review: EntityReview): Promise<EntityReview> {
    if (this.isTestEnv) {
      this.testEntityReviews.set(review.candidate_id, review);
      const cand = this.testCandidates.get(review.candidate_id);
      if (cand) {
        cand.status = review.decision;
      }
      return review;
    }
    const query = `INSERT INTO entity_review (candidate_id, decision, reviewer_id, decided_at)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (candidate_id) DO UPDATE SET decision = EXCLUDED.decision, reviewer_id = EXCLUDED.reviewer_id, decided_at = EXCLUDED.decided_at
                   RETURNING *;`;
    const res = await pgPool.query(query, [review.candidate_id, review.decision, review.reviewer_id, review.decided_at]);
    const cand = this.testCandidates.get(review.candidate_id);
    if (cand) {
      cand.status = review.decision;
    }
    return res.rows[0];
  }

  public async getEntityReview(candidate_id: string): Promise<EntityReview | null> {
    if (this.isTestEnv) {
      return this.testEntityReviews.get(candidate_id) || null;
    }
    const res = await pgPool.query('SELECT * FROM entity_review WHERE candidate_id = $1;', [candidate_id]);
    return res.rows[0] || null;
  }

  // --- 7. Audit Event Reference ---
  public async logAuditEvent(event: AuditEventRef): Promise<AuditEventRef> {
    if (this.isTestEnv) {
      this.testAuditEvents.set(event.event_id, event);
      return event;
    }
    const query = 'INSERT INTO audit_event_ref (event_id, case_id, actor_id, action) VALUES ($1, $2, $3, $4) RETURNING *;';
    const res = await pgPool.query(query, [event.event_id, event.case_id || null, event.actor_id, event.action]);
    return res.rows[0];
  }

  public async getAuditEvent(event_id: string): Promise<AuditEventRef | null> {
    if (this.isTestEnv) {
      return this.testAuditEvents.get(event_id) || null;
    }
    const res = await pgPool.query('SELECT * FROM audit_event_ref WHERE event_id = $1;', [event_id]);
    return res.rows[0] || null;
  }

  public async getAllAuditEvents(): Promise<AuditEventRef[]> {
    if (this.isTestEnv) {
      return Array.from(this.testAuditEvents.values());
    }
    const res = await pgPool.query('SELECT * FROM audit_event_ref;');
    return res.rows;
  }

  // --- Candidate Storage Resolution for Entity Review ---
  public async saveCandidate(candidate: EntityCandidate): Promise<EntityCandidate> {
    this.testCandidates.set(candidate.id, candidate);
    return candidate;
  }

  public async getCandidate(id: string): Promise<EntityCandidate | null> {
    return this.testCandidates.get(id) || null;
  }

  public async getCandidatesByCase(case_id: string): Promise<EntityCandidate[]> {
    const list: EntityCandidate[] = [];
    for (const c of this.testCandidates.values()) {
      if (c.case_id === case_id) list.push(c);
    }
    return list;
  }

  public async resetDb(): Promise<void> {
    this.testUsers.clear();
    this.testUserRoles = [];
    this.testCases.clear();
    this.testCaseMembers = [];
    this.testEvidence.clear();
    this.testIngestionJobs.clear();
    this.testEntityReviews.clear();
    this.testAuditEvents.clear();
    this.testCandidates.clear();
    this.seedDefaultRolesTest();
  }
}

export const db = new ControlPlaneDB();
