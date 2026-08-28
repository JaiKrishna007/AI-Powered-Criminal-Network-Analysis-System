import { EVIDENCE_v1 } from 'shared-contracts';

export class InMemoryEvidenceRepository {
  private evidence: Map<string, EVIDENCE_v1> = new Map();

  public async save(evidence: EVIDENCE_v1): Promise<void> {
    this.evidence.set(evidence.id, evidence);
  }

  public async get(id: string): Promise<EVIDENCE_v1 | undefined> {
    return this.evidence.get(id);
  }

  public async listByCase(caseId: string): Promise<EVIDENCE_v1[]> {
    const results: EVIDENCE_v1[] = [];
    for (const ev of this.evidence.values()) {
      if (ev.case_id === caseId) {
        results.push(ev);
      }
    }
    return results;
  }
}
