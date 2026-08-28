import { MongoClient, Db } from 'mongodb';
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

// MongoDB connection setup
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
export const mongoClient = new MongoClient(uri);

export class ControlPlaneDB {
  private isTestEnv: boolean;
  public db: Db | null = null;

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
  private testReports: Map<string, any> = new Map();

  constructor() {
    this.isTestEnv = process.env.NODE_ENV === 'test';
    if (this.isTestEnv) {
      this.seedDefaultRolesTest();
    }
  }

  public async connect(maxRetries: number = 5, retryDelayMs: number = 1000): Promise<void> {
    if (this.isTestEnv) return;
    
    // 1. Connect and Ping with retry backoff for container startup readiness (Issue 30)
    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await mongoClient.connect();
        const dbName = process.env.MONGODB_DB || 'netra';
        this.db = mongoClient.db(dbName);
        await this.db.command({ ping: 1 }); // Ensures availability
        break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in ${retryDelayMs * attempt}ms...`);
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, retryDelayMs * attempt));
        }
      }
    }

    if (!this.db) {
      throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts: ${lastErr?.message}`);
    }
    
    // 2. Setup Indexes (Task 28)
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DB_MIGRATION === 'true') {
      await this.setupIndexes();
    }

    // 3. Seed Roles (Task 29)
    await this.seedRoles();

    // 4. Seed Users (Issues 9-10)
    await this.seedUsers();
  }

  private async setupIndexes() {
    if (!this.db) return;
    const collections = ['users', 'roles', 'cases', 'case_members', 'evidence', 'ingestion_jobs', 'entity_review', 'audit_event_ref', 'reports'];
    for (const coll of collections) {
      // Ensure collections exist to avoid "ns does not exist" errors
      const collinfo = await this.db.listCollections({ name: coll }).toArray();
      if (collinfo.length === 0) {
        await this.db.createCollection(coll);
      }
    }

    await this.db.collection('users').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('roles').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('cases').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('case_members').createIndex({ case_id: 1, user_id: 1 }, { unique: true });
    await this.db.collection('evidence').createIndex({ case_id: 1, sha256: 1 }, { unique: true });
    await this.db.collection('ingestion_jobs').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('entity_review').createIndex({ candidate_id: 1 }, { unique: true });
    await this.db.collection('audit_event_ref').createIndex({ event_id: 1 }, { unique: true });
    await this.db.collection('audit_event_ref').createIndex({ actor_id: 1, timestamp: -1 });
    await this.db.collection('audit_event_ref').createIndex({ case_id: 1, timestamp: -1 });
    await this.db.collection('audit_event_ref').createIndex({ action: 1, timestamp: -1 });
    await this.db.collection('reports').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('reports').createIndex({ case_id: 1, version: 1 }, { unique: true });
  }

  private async seedRoles() {
    if (!this.db) return;
    const defaultRoles = [
      { id: 'role-investigator', name: 'INVESTIGATOR' },
      { id: 'role-supervisor', name: 'SUPERVISOR' },
      { id: 'role-admin', name: 'SYSTEM ADMIN' }
    ];

    for (const role of defaultRoles) {
      await this.db.collection('roles').updateOne(
        { name: role.name },
        { $setOnInsert: role },
        { upsert: true }
      );
    }
  }

  private async seedUsers() {
    if (!this.db) return;
    
    // In strict production mode, avoid automatically seeding default demo credentials unless requested
    if (process.env.NODE_ENV === 'production' && !process.env.DEMO_PASSWORD && !process.env.ADMIN_INITIAL_PASSWORD) {
      console.info('Production mode active: Automated demo user seeding omitted.');
      return;
    }

    const bcrypt = require('bcrypt');
    const defaultPassword = process.env.DEMO_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'demo_password123_sih_only';
    const hash = await bcrypt.hash(defaultPassword, 10);

    const demoUsers = [
      { id: 'USR-INV-001', display_name: 'investigator1', status: 'ACTIVE', clearance_level: 2, role: 'INVESTIGATOR' },
      { id: 'USR-SUP-001', display_name: 'supervisor1', status: 'ACTIVE', clearance_level: 3, role: 'SUPERVISOR' },
      { id: 'USR-ADM-001', display_name: 'admin1', status: 'ACTIVE', clearance_level: 4, role: 'SYSTEM ADMIN' }
    ];

    for (const user of demoUsers) {
      const { role, ...userData } = user;
      const existingUser = await this.getUser(user.id);
      if (!existingUser) {
        await this.createUser({ ...userData, password_hash: hash });
        await this.assignUserRole(user.id, role);
      }
    }
  }

  private seedDefaultRolesTest() {
    this.testRoles.set('INVESTIGATOR', { id: 'role-investigator', name: 'INVESTIGATOR' });
    this.testRoles.set('SUPERVISOR', { id: 'role-supervisor', name: 'SUPERVISOR' });
    this.testRoles.set('SYSTEM ADMIN', { id: 'role-admin', name: 'SYSTEM ADMIN' });
  }

  private getCollection(name: string) {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection(name);
  }

  // --- 1. Users ---
  public async createUser(user: User): Promise<User> {
    if (this.isTestEnv) {
      this.testUsers.set(user.id, user);
      return user;
    }
    await this.getCollection('users').insertOne({ ...user });
    return user;
  }

  public async getUser(id: string): Promise<User | null> {
    if (this.isTestEnv) {
      return this.testUsers.get(id) || null;
    }
    const res = await this.getCollection('users').findOne({ id });
    if (!res) return null;
    const { _id, ...user } = res;
    return user as unknown as User;
  }

  public async getAllUsers(): Promise<User[]> {
    if (this.isTestEnv) {
      return Array.from(this.testUsers.values());
    }
    const res = await this.getCollection('users').find({}).toArray();
    return res.map(row => {
      const { _id, ...user } = row;
      return user as unknown as User;
    });
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
    const roleRes = await this.getCollection('roles').findOne({ name: role_name });
    if (roleRes) {
      const roleId = roleRes.id;
      await this.getCollection('user_roles').updateOne(
        { user_id, role_id: roleId },
        { $setOnInsert: { user_id, role_id: roleId } },
        { upsert: true }
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
    const userRoles = await this.getCollection('user_roles').find({ user_id }).toArray();
    const roleIds = userRoles.map(ur => ur.role_id);
    const roles = await this.getCollection('roles').find({ id: { $in: roleIds } }).toArray();
    return roles.map(r => r.name);
  }

  // --- 3. Cases & Case Members ---
  public async createCase(caseItem: Case): Promise<Case> {
    if (this.isTestEnv) {
      this.testCases.set(caseItem.id, caseItem);
      return caseItem;
    }
    await this.getCollection('cases').insertOne({ ...caseItem });
    return caseItem;
  }

  public async getCase(id: string): Promise<Case | null> {
    if (this.isTestEnv) {
      return this.testCases.get(id) || null;
    }
    const res = await this.getCollection('cases').findOne({ id });
    if (!res) return null;
    const { _id, ...caseItem } = res;
    return caseItem as unknown as Case;
  }

  public async getAllCases(): Promise<Case[]> {
    if (this.isTestEnv) {
      return Array.from(this.testCases.values());
    }
    const res = await this.getCollection('cases').find({}).toArray();
    return res.map(row => {
      const { _id, ...c } = row;
      return c as unknown as Case;
    });
  }

  public async addCaseMember(memberOrCaseId: CaseMember | string, userId?: string, accessLevel: string = 'MEMBER'): Promise<CaseMember> {
    const member: CaseMember = typeof memberOrCaseId === 'string'
      ? { case_id: memberOrCaseId, user_id: userId!, access_level: accessLevel }
      : memberOrCaseId;

    if (this.isTestEnv) {
      const idx = this.testCaseMembers.findIndex(cm => cm.case_id === member.case_id && cm.user_id === member.user_id);
      if (idx >= 0) {
        this.testCaseMembers[idx] = member;
      } else {
        this.testCaseMembers.push(member);
      }
      return member;
    }

    await this.getCollection('case_members').updateOne(
      { case_id: member.case_id, user_id: member.user_id },
      { $set: member },
      { upsert: true }
    );
    return member;
  }

  public async isUserMemberOfCase(user_id: string, case_id: string): Promise<boolean> {
    if (this.isTestEnv) {
      const c = this.testCases.get(case_id);
      if (c && c.owner_id === user_id) return true;
      return this.testCaseMembers.some(cm => cm.case_id === case_id && cm.user_id === user_id);
    }
    const cRes = await this.getCollection('cases').findOne({ id: case_id });
    if (cRes && cRes.owner_id === user_id) {
      return true;
    }
    const cmRes = await this.getCollection('case_members').findOne({ case_id, user_id });
    return !!cmRes;
  }

  public async getCaseMember(case_id: string, user_id: string): Promise<CaseMember | null> {
    if (this.isTestEnv) {
      const c = this.testCases.get(case_id);
      if (c && c.owner_id === user_id) {
        return { case_id, user_id, access_level: 'OWNER' };
      }
      return this.testCaseMembers.find(cm => cm.case_id === case_id && cm.user_id === user_id) || null;
    }
    const cRes = await this.getCollection('cases').findOne({ id: case_id });
    if (cRes && cRes.owner_id === user_id) {
      return { case_id, user_id, access_level: 'OWNER' };
    }
    const cmRes = await this.getCollection('case_members').findOne({ case_id, user_id });
    if (!cmRes) return null;
    const { _id, ...cm } = cmRes;
    return cm as unknown as CaseMember;
  }

  // --- 4. Evidence ---
  public async createEvidence(ev: Evidence): Promise<Evidence> {
    if (this.isTestEnv) {
      this.testEvidence.set(ev.id, ev);
      return ev;
    }
    await this.getCollection('evidence').insertOne({ ...ev });
    return ev;
  }

  public async getEvidence(id: string): Promise<Evidence | null> {
    if (this.isTestEnv) {
      return this.testEvidence.get(id) || null;
    }
    const res = await this.getCollection('evidence').findOne({ id });
    if (!res) return null;
    const { _id, ...ev } = res;
    return ev as unknown as Evidence;
  }

  public async findEvidenceBySha256(sha256: string): Promise<Evidence | null> {
    if (this.isTestEnv) {
      for (const ev of this.testEvidence.values()) {
        if (ev.sha256 === sha256) return ev;
      }
      return null;
    }
    const res = await this.getCollection('evidence').findOne({ sha256 });
    if (!res) return null;
    const { _id, ...ev } = res;
    return ev as unknown as Evidence;
  }

  public async getEvidenceByCase(case_id: string): Promise<Evidence[]> {
    if (this.isTestEnv) {
      const list: Evidence[] = [];
      for (const ev of this.testEvidence.values()) {
        if (ev.case_id === case_id) list.push(ev);
      }
      return list;
    }
    const res = await this.getCollection('evidence').find({ case_id }).toArray();
    return res.map(row => {
      const { _id, ...ev } = row;
      return ev as unknown as Evidence;
    });
  }

  // --- 5. Ingestion Jobs ---
  public async createIngestionJob(job: IngestionJob): Promise<IngestionJob> {
    if (this.isTestEnv) {
      this.testIngestionJobs.set(job.id, job);
      return job;
    }
    await this.getCollection('ingestion_jobs').insertOne({ ...job });
    return job;
  }

  public async updateIngestionJobState(id: string, state: IngestionJob['state'], error?: string | null): Promise<IngestionJob | null> {
    if (this.isTestEnv) {
      const job = this.testIngestionJobs.get(id);
      if (!job) return null;
      job.state = state;
      if (error !== undefined) job.error = error;
      return job;
    }
    
    const updateDoc: any = { $set: { state } };
    if (error !== undefined) updateDoc.$set.error = error !== null ? error : null;
    
    const res = await this.getCollection('ingestion_jobs').findOneAndUpdate(
      { id },
      updateDoc,
      { returnDocument: 'after' }
    );
    if (!res) return null;
    const { _id, ...job } = res as any;
    return job as unknown as IngestionJob;
  }

  public async getIngestionJob(id: string): Promise<IngestionJob | null> {
    if (this.isTestEnv) {
      return this.testIngestionJobs.get(id) || null;
    }
    const res = await this.getCollection('ingestion_jobs').findOne({ id });
    if (!res) return null;
    const { _id, ...job } = res;
    return job as unknown as IngestionJob;
  }

  // --- 6. Entity Review ---
  public async createEntityReview(review: EntityReview): Promise<EntityReview> {
    if (this.isTestEnv) {
      this.testEntityReviews.set(review.candidate_id, review);
      const cand = this.testCandidates.get(review.candidate_id);
      if (cand) {
        cand.status = review.decision;
        cand.sync_state = review.sync_state;
      }
      return review;
    }
    
    await this.getCollection('entity_review').updateOne(
      { candidate_id: review.candidate_id },
      { 
        $set: { 
          decision: review.decision, 
          reviewer_id: review.reviewer_id, 
          decided_at: review.decided_at,
          sync_state: review.sync_state,
          sync_error: review.sync_error
        } 
      },
      { upsert: true }
    );
    
    const cand = this.testCandidates.get(review.candidate_id);
    if (cand) {
      cand.status = review.decision;
      cand.sync_state = review.sync_state;
    } else {
      await this.getCollection('candidates').updateOne(
        { id: review.candidate_id },
        { 
          $set: { 
            status: review.decision,
            sync_state: review.sync_state
          } 
        }
      );
    }
    return review;
  }

  public async updateEntityReview(candidateId: string, updates: Partial<EntityReview>): Promise<EntityReview | null> {
    if (this.isTestEnv) {
      const review = this.testEntityReviews.get(candidateId);
      if (review) {
        Object.assign(review, updates);
      }
      const cand = this.testCandidates.get(candidateId);
      if (cand && updates.sync_state) {
        cand.sync_state = updates.sync_state;
      }
      return review || null;
    }

    await this.getCollection('entity_review').updateOne(
      { candidate_id: candidateId },
      { $set: updates }
    );

    if (updates.sync_state) {
      await this.getCollection('candidates').updateOne(
        { id: candidateId },
        { $set: { sync_state: updates.sync_state } }
      );
    }

    return await this.getEntityReview(candidateId);
  }

  public async getEntityReview(candidateId: string): Promise<EntityReview | null> {
    if (this.isTestEnv) {
      return this.testEntityReviews.get(candidateId) || null;
    }
    const res = await this.getCollection('entity_review').findOne({ candidate_id: candidateId });
    if (!res) return null;
    const { _id, ...rev } = res;
    return rev as unknown as EntityReview;
  }

  // --- 7. Audit Event Reference ---
  public async getLatestAuditEvent(): Promise<AuditEventRef | null> {
    if (this.isTestEnv) {
      const events = Array.from(this.testAuditEvents.values());
      return events.length > 0 ? events[events.length - 1] : null;
    }
    const res = await this.getCollection('audit_event_ref').find({}).sort({ _id: -1 }).limit(1).toArray();
    if (res.length === 0) return null;
    const { _id, ...evt } = res[0];
    return evt as unknown as AuditEventRef;
  }

  // Serialize audit writes to prevent hash chain branching (Issue 27)
  private auditMutex: Promise<any> = Promise.resolve();

  public async createAuditEvent(event: any): Promise<AuditEventRef> {
    return new Promise((resolve, reject) => {
      this.auditMutex = this.auditMutex.then(async () => {
        try {
          const previousEvent = await this.getLatestAuditEvent();
    const previousHash = previousEvent ? previousEvent.hash : 'GENESIS';
    
    const dataString = JSON.stringify({
      event_id: event.event_id,
      actor_id: event.actor_id,
      case_id: event.case_id,
      action: event.action
    });
    
    // We dynamically require crypto to avoid top-level import conflicts, or just use the global if available.
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(previousHash + dataString).digest('hex');

    event.previous_hash = previousHash;
    event.hash = hash;

          if (this.isTestEnv) {
            this.testAuditEvents.set(event.event_id, event);
            return resolve(event);
          }
          await this.getCollection('audit_event_ref').insertOne({ ...event });
          resolve(event);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  public async getAuditEvent(event_id: string): Promise<AuditEventRef | null> {
    if (this.isTestEnv) {
      return this.testAuditEvents.get(event_id) || null;
    }
    const res = await this.getCollection('audit_event_ref').findOne({ event_id });
    if (!res) return null;
    const { _id, ...evt } = res;
    return evt as unknown as AuditEventRef;
  }

  public async getAllAuditEvents(): Promise<AuditEventRef[]> {
    if (this.isTestEnv) {
      return Array.from(this.testAuditEvents.values());
    }
    const res = await this.getCollection('audit_event_ref').find({}).toArray();
    return res.map(row => {
      const { _id, ...evt } = row;
      return evt as unknown as AuditEventRef;
    });
  }

  // --- Candidate Storage Resolution for Entity Review ---
  public async saveCandidate(candidate: EntityCandidate): Promise<EntityCandidate> {
    if (this.isTestEnv) {
      this.testCandidates.set(candidate.id, candidate);
      return candidate;
    }
    await this.getCollection('candidates').insertOne({ ...candidate });
    return candidate;
  }

  public async createCandidate(candidate: EntityCandidate): Promise<EntityCandidate> {
    return this.saveCandidate(candidate);
  }

  public async getCandidate(id: string): Promise<EntityCandidate | null> {
    if (this.isTestEnv) {
      return this.testCandidates.get(id) || null;
    }
    const res = await this.getCollection('candidates').findOne({ id });
    if (!res) return null;
    const { _id, ...cand } = res;
    return cand as unknown as EntityCandidate;
  }

  public async getCandidatesByCase(case_id: string): Promise<EntityCandidate[]> {
    if (this.isTestEnv) {
      const list: EntityCandidate[] = [];
      for (const c of this.testCandidates.values()) {
        if (c.case_id === case_id) list.push(c);
      }
      return list;
    }
    const res = await this.getCollection('candidates').find({ case_id }).toArray();
    return res.map(row => {
      const { _id, ...cand } = row;
      return cand as unknown as EntityCandidate;
    });
  }

  // --- Reports ---
  public async createReport(report: any): Promise<any> {
    if (this.isTestEnv) {
      if (!this.testReports) this.testReports = new Map();
      const existingVersion = Array.from(this.testReports.values()).find((r: any) => r.case_id === report.case_id && r.version === report.version);
      if (existingVersion && existingVersion.id !== report.id) {
        const err: any = new Error(`Duplicate report version v${report.version} for case ${report.case_id}`);
        err.code = 11000;
        throw err;
      }
      this.testReports.set(report.id, report);
      return report;
    }
    await this.getCollection('reports').insertOne({ ...report });
    return report;
  }

  public async getReportsByCase(case_id: string): Promise<any[]> {
    if (this.isTestEnv) {
      if (!this.testReports) this.testReports = new Map();
      return Array.from(this.testReports.values()).filter((r: any) => r.case_id === case_id);
    }
    const res = await this.getCollection('reports').find({ case_id }).toArray();
    return res.map(row => {
      const { _id, ...rep } = row;
      return rep;
    });
  }

  public async getReport(id: string): Promise<any> {
    if (this.isTestEnv) {
      return this.testReports?.get(id) || null;
    }
    const res = await this.getCollection('reports').findOne({ id });
    if (!res) return null;
    const { _id, ...rep } = res;
    return rep;
  }

  public async updateReport(id: string, updates: Record<string, any>): Promise<any> {
    if (this.isTestEnv) {
      if (!this.testReports) this.testReports = new Map();
      const existing = this.testReports.get(id);
      if (existing) {
        Object.assign(existing, updates);
        return existing;
      }
      return null;
    }
    const res = await this.getCollection('reports').findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    if (!res) return null;
    const { _id, ...rep } = res as any;
    return rep;
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
    if (this.testReports) this.testReports.clear();
    this.seedDefaultRolesTest();
  }
}

export const db = new ControlPlaneDB();
