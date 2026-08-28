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

  constructor() {
    this.isTestEnv = process.env.NODE_ENV === 'test';
    if (this.isTestEnv) {
      this.seedDefaultRolesTest();
    }
  }

  public async connect(): Promise<void> {
    if (this.isTestEnv) return;
    
    // 1. Connect and Ping (Task 30)
    await mongoClient.connect();
    this.db = mongoClient.db('netra');
    await this.db.command({ ping: 1 }); // Ensures availability
    
    // 2. Setup Indexes (Task 28)
    await this.setupIndexes();

    // 3. Seed Roles (Task 29)
    await this.seedRoles();
  }

  private async setupIndexes() {
    if (!this.db) return;
    const collections = ['users', 'roles', 'cases', 'case_members', 'evidence', 'ingestion_jobs', 'entity_review', 'audit_event_ref'];
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
    await this.db.collection('evidence').createIndex({ sha256: 1 });
    await this.db.collection('evidence').createIndex({ case_id: 1, classification: 1 });
    await this.db.collection('ingestion_jobs').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('entity_review').createIndex({ candidate_id: 1 }, { unique: true });
    await this.db.collection('audit_event_ref').createIndex({ event_id: 1 }, { unique: true });
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

  public async addCaseMember(member: CaseMember): Promise<CaseMember> {
    if (this.isTestEnv) {
      this.testCaseMembers.push(member);
      return member;
    }
    await this.getCollection('case_members').insertOne({ ...member });
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
      }
      return review;
    }
    
    await this.getCollection('entity_review').updateOne(
      { candidate_id: review.candidate_id },
      { $set: { decision: review.decision, reviewer_id: review.reviewer_id, decided_at: review.decided_at } },
      { upsert: true }
    );
    
    const cand = this.testCandidates.get(review.candidate_id);
    if (cand) {
      cand.status = review.decision;
    } else {
      await this.getCollection('candidates').updateOne(
        { id: review.candidate_id },
        { $set: { status: review.decision } }
      );
    }
    return review;
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
  public async createAuditEvent(event: AuditEventRef): Promise<AuditEventRef> {
    if (this.isTestEnv) {
      this.testAuditEvents.set(event.event_id, event);
      return event;
    }
    await this.getCollection('audit_event_ref').insertOne({ ...event });
    return event;
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
