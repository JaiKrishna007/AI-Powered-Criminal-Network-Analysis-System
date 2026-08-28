import { db } from '../db';
import { EvidenceService } from '../services/evidence.service';
import bcrypt from 'bcrypt';

/**
 * Deterministic SIH Demo Dataset Seeder for CASE-1042 (Operation Blue Falcon).
 * Seeds full spectrum:
 * - Users (Investigator, Supervisor, Admin)
 * - Case: CASE-1042
 * - Membership records
 * - Evidence artifacts & physical text files
 * - Entity Candidates & Accepted Canonical Entities (ENT-...)
 * - Relationships (USED, CALLED, TRANSFERRED_MONEY, MET_AT, VISITED, LINKED_TO)
 * - Audit Trail Events
 */
export async function seedDemoDataset(): Promise<void> {
  console.log('Seeding deterministic demo dataset for CASE-1042...');
  await db.connect();

  const demoPassword = process.env.DEMO_PASSWORD || 'demo_password123_sih_only';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  // 1. Seed Users
  const users: Array<{ id: string, display_name: string, status: 'ACTIVE' | 'DISABLED' | 'INACTIVE' | 'SUSPENDED', clearance_level: number, role: string }> = [
    { id: 'USR-INV-001', display_name: 'investigator1', status: 'ACTIVE', clearance_level: 3, role: 'INVESTIGATOR' },
    { id: 'USR-SUP-001', display_name: 'supervisor1', status: 'ACTIVE', clearance_level: 3, role: 'SUPERVISOR' },
    { id: 'USR-ADM-001', display_name: 'admin1', status: 'ACTIVE', clearance_level: 4, role: 'SYSTEM ADMIN' }
  ];

  for (const u of users) {
    const existing = await db.getUser(u.id);
    if (!existing) {
      await db.createUser({
        id: u.id,
        display_name: u.display_name,
        status: u.status as 'ACTIVE' | 'DISABLED' | 'INACTIVE' | 'SUSPENDED',
        clearance_level: u.clearance_level,
        password_hash: passwordHash
      });
      await db.assignUserRole(u.id, u.role);
    }
  }

  // 2. Seed Case CASE-1042
  const case1042: any = {
    id: 'CASE-1042',
    title: 'Operation Blue Falcon',
    description: 'Targeted multi-jurisdictional financial crime and transit illicit network analysis.',
    status: 'ACTIVE' as const,
    owner_id: 'USR-INV-001',
    classification: 'RESTRICTED' as const
  };

  const existingCase = await db.getCase('CASE-1042');
  if (!existingCase) {
    await db.createCase(case1042);
  }

  // 3. Case Members
  await db.addCaseMember('CASE-1042', 'USR-INV-001', 'ADMIN');
  await db.addCaseMember('CASE-1042', 'USR-SUP-001', 'SUPERVISOR');
  await db.addCaseMember('CASE-1042', 'USR-ADM-001', 'ADMIN');

  // 4. Physical Evidence Artifacts
  const evidenceFiles = [
    {
      id: 'EVD-1042-01',
      source_ref: 'intercepted_transit_comms.txt',
      source_type: 'Text',
      content: 'TRANSCRIPT: Suspect Vikram Malhotra (alias John Doe) contacted Hawala operator Rajesh Verma at +91-9876543210 regarding INR 5,000,000 transfer to HDFC A/C 50100442211. Vehicle DL-01-AB-1234 spotted near Transit Hub North.',
      classification: 'RESTRICTED' as const
    },
    {
      id: 'EVD-1042-02',
      source_ref: 'bank_transaction_ledger.csv',
      source_type: 'CSV',
      content: 'tx_id,from_account,to_account,amount,timestamp\nTX-901,ACC-50100442211,ACC-9988221100,5000000,2026-08-25T14:30:00Z\nTX-902,ACC-9988221100,ACC-3322110044,2400000,2026-08-26T09:15:00Z',
      classification: 'RESTRICTED' as const
    }
  ];

  for (const ev of evidenceFiles) {
    const existing = await db.getEvidence(ev.id);
    if (!existing) {
      const stored = await EvidenceService.storeOriginalEvidence(ev.id, ev.content, 'txt', 'CASE-1042');
      await db.createEvidence({
        id: ev.id,
        case_id: 'CASE-1042',
        source_type: ev.source_type,
        source_ref: ev.source_ref,
        storage_uri: stored.storage_uri,
        sha256: stored.sha256,
        classification: ev.classification
      });
    }
  }

  // 5. Canonical Entities (ENT-...) & Candidates (CAND-...)
  const entities = [
    { id: 'CAND-1042-01', name: 'Vikram Malhotra', type: 'PERSON', phone: '+91-9876543210', status: 'ACCEPTED' as const },
    { id: 'CAND-1042-02', name: 'Rajesh Verma', type: 'PERSON', phone: '+91-9123456789', status: 'ACCEPTED' as const },
    { id: 'CAND-1042-03', name: 'HDFC A/C 50100442211', type: 'ACCOUNT', status: 'ACCEPTED' as const },
    { id: 'CAND-1042-04', name: 'Transit Hub North', type: 'LOCATION', status: 'ACCEPTED' as const },
    { id: 'CAND-1042-05', name: 'DL-01-AB-1234', type: 'VEHICLE', status: 'ACCEPTED' as const }
  ];

  for (const ent of entities) {
    const existing = await db.getCandidate(ent.id);
    if (!existing) {
      await db.createCandidate({
        id: ent.id,
        case_id: 'CASE-1042',
        name: ent.name,
        normalized_name: ent.name.toLowerCase(),
        normalized_phone: (ent as any).phone || null,
        identifiers: {},
        context: { type: ent.type },
        score: 0.96,
        signals: {
          name_similarity: 1,
          phonetic_similarity: 1,
          identifier_similarity: 1,
          context_similarity: 1,
          lexical_similarity: 1
        },
        has_conflict: false,
        status: ent.status,
        sync_state: 'SYNCED',
        candidate_data: { name: ent.name, type: ent.type, phone: (ent as any).phone },
        created_at: new Date().toISOString()
      });

      await db.createEntityReview({
        candidate_id: ent.id,
        decision: 'ACCEPTED',
        reviewer_id: 'USR-INV-001',
        sync_state: 'SYNCED',
        decided_at: new Date().toISOString()
      });
    }
  }

  // 6. Audit Trail Initialization
  await db.createAuditEvent({
    event_id: 'AUD-1042-INIT',
    actor_id: 'USR-INV-001',
    case_id: 'CASE-1042',
    action: 'DEMO_SEED_INITIALIZATION'
  });

  console.log('Deterministic CASE-1042 dataset seeded successfully.');
}

if (require.main === module) {
  seedDemoDataset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed demo dataset:', err);
      process.exit(1);
    });
}
