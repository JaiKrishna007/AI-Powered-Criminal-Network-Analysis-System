import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ControlPlaneDB } from '../../src/db';
import { User, Case } from '../../src/models/types';
import crypto from 'crypto';

describe('Real MongoDB Integration Tests', () => {
  let realDb: ControlPlaneDB;

  beforeAll(async () => {
    // Override NODE_ENV to force real connection for this file only
    process.env.NODE_ENV = 'development';
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
    realDb = new ControlPlaneDB();
    
    // Connect to a special test database to avoid dropping dev data
    await realDb.connect();
    
    // Manually override the database name for safety
    if (realDb.db) {
      realDb.db = realDb.db.client.db('netra_test_integration');
      
      // Clean DB before starting
      await realDb.db.dropDatabase();
      
      // Manually trigger index setup since we bypassed the connect lifecycle
      const collections = ['users', 'roles', 'cases', 'case_members', 'evidence', 'ingestion_jobs', 'entity_review', 'audit_event_ref'];
      for (const coll of collections) {
        await realDb.db.createCollection(coll);
      }
      await realDb.db.collection('users').createIndex({ id: 1 }, { unique: true });
      await realDb.db.collection('roles').createIndex({ id: 1 }, { unique: true });
      await realDb.db.collection('cases').createIndex({ id: 1 }, { unique: true });
      await realDb.db.collection('evidence').createIndex({ sha256: 1 });
      await realDb.db.collection('evidence').createIndex({ case_id: 1, classification: 1 });
      await realDb.db.collection('ingestion_jobs').createIndex({ id: 1 }, { unique: true });
      await realDb.db.collection('entity_review').createIndex({ candidate_id: 1 }, { unique: true });
      await realDb.db.collection('audit_event_ref').createIndex({ event_id: 1 }, { unique: true });
    }
  });

  afterAll(async () => {
    if (realDb.db) {
      await realDb.db.dropDatabase();
    }
    // Restore NODE_ENV
    process.env.NODE_ENV = 'test';
  });

  it('Should successfully connect and ping the database', async () => {
    expect(realDb.db).not.toBeNull();
    const ping = await realDb.db!.command({ ping: 1 });
    expect(ping.ok).toBe(1);
  });

  it('Should insert and query a user', async () => {
    const user: User = { id: 'USR-INTEG-1', display_name: 'Integration User', status: 'ACTIVE' };
    await realDb.createUser(user);

    const fetched = await realDb.getUser('USR-INTEG-1');
    expect(fetched).toBeDefined();
    expect(fetched?.display_name).toBe('Integration User');
  });

  it('Should enforce unique constraint on user ID', async () => {
    const user: User = { id: 'USR-INTEG-2', display_name: 'Second User', status: 'ACTIVE' };
    await realDb.createUser(user);

    try {
      await realDb.createUser(user);
      expect.fail('Should have thrown duplicate key error');
    } catch (e: any) {
      expect(e.code).toBe(11000); // MongoDB duplicate key error code
    }
  });

  it('Should correctly update an ingestion job state', async () => {
    const job = {
      id: 'JOB-INTEG-1',
      case_id: 'CASE-INTEG-1',
      source_ref: 'file.txt',
      state: 'QUEUED' as const
    };
    await realDb.createIngestionJob(job);

    const updated = await realDb.updateIngestionJobState('JOB-INTEG-1', 'COMPLETED');
    expect(updated).toBeDefined();
    expect(updated?.state).toBe('COMPLETED');
  });

  it('Should correctly compute audit event hash chains (tamper evidence)', async () => {
    const event1 = await realDb.createAuditEvent({
      event_id: 'AUD-INTEG-1',
      actor_id: 'USR-INTEG-1',
      action: 'LOGIN',
      hash: '',
      previous_hash: ''
    });

    expect(event1.previous_hash).toBe('GENESIS');
    expect(event1.hash).toBeDefined();

    const event2 = await realDb.createAuditEvent({
      event_id: 'AUD-INTEG-2',
      actor_id: 'USR-INTEG-1',
      action: 'LOGOUT',
      hash: '',
      previous_hash: ''
    });

    // Hash chain verification
    expect(event2.previous_hash).toBe(event1.hash);
    
    // Manually verify event2 hash matches expected
    const dataString = JSON.stringify({
      event_id: 'AUD-INTEG-2',
      actor_id: 'USR-INTEG-1',
      case_id: undefined,
      action: 'LOGOUT'
    });
    const expectedHash = crypto.createHash('sha256').update(event1.hash + dataString).digest('hex');
    expect(event2.hash).toBe(expectedHash);
  });
});
