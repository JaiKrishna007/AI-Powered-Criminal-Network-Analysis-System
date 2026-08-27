import { 
  LeadV1Adapter, 
  ScoreBreakdown, 
  EvidenceV1, 
  RelV1, 
  EntityV1, 
  AuthScopeAdapter 
} from '../../../contracts/adapters.js';

export interface LeadScoringInput {
  case_id: string;
  target_entity: EntityV1;
  related_evidence: EvidenceV1[];
  related_relationships: RelV1[];
  query_relevance?: number; // 0.0 to 1.0
}

export class LeadRankingEngine {
  /**
   * Ranks an investigator review task strictly using the conceptual formula:
   * lead_score = current_relevance + temporal_relevance + structural_signal + evidence_completeness - uncertainty_penalty
   *
   * Note: This score ranks advisory review priority for human investigators.
   * It is strictly NOT a crime score, guilt score, or threat assessment.
   */
  public scoreReviewTask(input: LeadScoringInput, scope: AuthScopeAdapter): LeadV1Adapter {
    if (!scope.authorized_case_ids.includes(input.case_id)) {
      throw new Error(`[LeadRankingEngine] Scope access denied for case ${input.case_id}`);
    }

    // 1. current_relevance (0.0 to 1.0)
    const current_relevance = Number((input.query_relevance ?? 0.5).toFixed(2));

    // 2. temporal_relevance (0.0 to 1.0 based on recency of evidence/transactions)
    let maxDate = '2026-01-01';
    for (const ev of input.related_evidence) {
      if (ev.date && ev.date > maxDate) maxDate = ev.date;
    }
    for (const r of input.related_relationships) {
      const d = r.created_at || r.attributes?.date;
      if (d && d > maxDate) maxDate = d;
    }
    const temporal_relevance = maxDate >= '2026-03-01' ? 0.9 : 0.5;

    // 3. structural_signal (0.0 to 1.0 based on relational complexity / bridge presence)
    const relCount = input.related_relationships.length;
    const structural_signal = relCount >= 3 ? 0.85 : relCount >= 1 ? 0.5 : 0.2;

    // 4. evidence_completeness (0.0 to 1.0 based on evidence density and verified attributes)
    const evCount = input.related_evidence.length;
    const hasAttributes = Boolean(input.target_entity.attributes && Object.keys(input.target_entity.attributes).length > 0);
    let evidence_completeness = 0.3;
    if (evCount >= 2 && hasAttributes) evidence_completeness = 0.9;
    else if (evCount >= 1) evidence_completeness = 0.6;

    // 5. uncertainty_penalty (0.0 to 1.0 based on missing context, weak evidence, or conflicts)
    let uncertainty_penalty = 0.1;
    if (evCount === 0) {
      uncertainty_penalty += 0.5;
    }
    if (!hasAttributes) {
      uncertainty_penalty += 0.2;
    }
    uncertainty_penalty = Number(Math.min(uncertainty_penalty, 0.9).toFixed(2));

    // Calculate lead_score
    const rawScore =
      current_relevance +
      temporal_relevance +
      structural_signal +
      evidence_completeness -
      uncertainty_penalty;
    
    const lead_score = Number(Math.max(0, Math.min(rawScore, 4.0)).toFixed(4));

    const score_breakdown: ScoreBreakdown = {
      current_relevance,
      temporal_relevance,
      structural_signal,
      evidence_completeness,
      uncertainty_penalty,
    };

    const advisory_notes = `Advisory task review priority score: ${lead_score}. Score incorporates current relevance (${current_relevance}), temporal currency (${temporal_relevance}), structural degree (${structural_signal}), evidence completeness (${evidence_completeness}), minus uncertainty penalty (${uncertainty_penalty}).`;

    return {
      lead_id: `lead_${input.case_id}_${input.target_entity.id}`,
      case_id: input.case_id,
      target_entity_id: input.target_entity.id,
      lead_score,
      score_breakdown,
      advisory_notes,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Sorts review tasks in descending order of lead score.
   */
  public rankTasks(tasks: LeadScoringInput[], scope: AuthScopeAdapter): LeadV1Adapter[] {
    const scored = tasks.map((t) => this.scoreReviewTask(t, scope));
    scored.sort((a, b) => b.lead_score - a.lead_score);
    return scored;
  }
}
