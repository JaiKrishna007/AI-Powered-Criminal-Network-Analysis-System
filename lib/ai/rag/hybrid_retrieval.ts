import { IntentPlanner, IntentQueryPlan } from './intent.js';
import { AllowlistedToolExecutor } from './tools.js';
import { AuthScopeAdapter, EvidenceV1, RelV1, EntityV1 } from '../../../contracts/adapters.js';

export interface GroundedContext {
  question: string;
  intent: string;
  case_id: string;
  evidence: EvidenceV1[];
  entities: EntityV1[];
  relationships: RelV1[];
  formatted_context_text: string;
}

export class HybridRetrievalEngine {
  private intentPlanner: IntentPlanner;
  private toolExecutor: AllowlistedToolExecutor;

  constructor(intentPlanner: IntentPlanner, toolExecutor: AllowlistedToolExecutor) {
    this.intentPlanner = intentPlanner;
    this.toolExecutor = toolExecutor;
  }

  /**
   * Complete Hybrid Retrieval Pipeline:
   * question -> intent -> vector candidates -> exact filters -> graph/context lookup -> deduplicate -> rank -> top-k -> evidence context
   */
  public execute(question: string, caseId: string, scope: AuthScopeAdapter, topK: number = 5): GroundedContext {
    // 1. Intent Classification & Plan Generation
    const plan: IntentQueryPlan = this.intentPlanner.planQuery(question, caseId);

    const retrievedEvidenceMap = new Map<string, EvidenceV1>();
    const vectorScores = new Map<string, number>();
    const retrievedEntitiesMap = new Map<string, EntityV1>();
    const retrievedRelationshipsMap = new Map<string, RelV1>();

    // 2. Execute Allowlisted Operations based on Intent
    for (const op of plan.operations) {
      switch (op.tool) {
        case 'search_evidence': {
          const searchRes = this.toolExecutor.search_evidence(question, scope, caseId, topK * 2);
          for (const item of searchRes.results) {
            const evId = item.vector_id.replace('vec_', '');
            vectorScores.set(evId, item.relevance_score);
            retrievedEvidenceMap.set(evId, {
              id: evId,
              case_id: item.case_id,
              source_ref: item.source_ref,
              chunk_ref: item.chunk_ref,
              content: item.snippet,
              classification: item.classification,
              created_at: new Date().toISOString(),
              entity_ids: item.entity_ids,
            });
          }
          break;
        }
        case 'get_transactions': {
          const rels = this.toolExecutor.get_transactions(
            scope,
            caseId,
            plan.extracted_constraints.min_amount,
            plan.extracted_constraints.start_date,
            plan.extracted_constraints.end_date
          );
          for (const r of rels) retrievedRelationshipsMap.set(r.id, r);
          break;
        }
        case 'get_timeline': {
          const evs = this.toolExecutor.get_timeline(
            scope,
            caseId,
            plan.extracted_constraints.start_date,
            plan.extracted_constraints.end_date
          );
          for (const ev of evs) retrievedEvidenceMap.set(ev.id, ev);
          break;
        }
        case 'get_path': {
          const sourceId = op.params.source_entity_id;
          const targetId = op.params.target_entity_id;
          if (sourceId && targetId) {
            const pathRes = this.toolExecutor.get_path(sourceId, targetId, scope, caseId);
            if (pathRes.pathFound) {
              for (const e of pathRes.nodes) retrievedEntitiesMap.set(e.id, e);
              for (const r of pathRes.edges) retrievedRelationshipsMap.set(r.id, r);
            }
          }
          break;
        }
        case 'get_entity': {
          const entities = this.toolExecutor.get_entity(question, scope);
          for (const e of entities) retrievedEntitiesMap.set(e.id, e);
          break;
        }
        case 'get_graph': {
          const graph = this.toolExecutor.get_graph(scope, caseId, op.params.focus_entity_id, op.params.depth || 1);
          for (const e of graph.nodes) retrievedEntitiesMap.set(e.id, e);
          for (const r of graph.edges) retrievedRelationshipsMap.set(r.id, r);
          break;
        }
      }
    }

    // 3. Deduplicate Candidates
    let candidateEvidence = Array.from(retrievedEvidenceMap.values());

    // Apply Exact Date Constraint Filter if present in plan
    if (plan.extracted_constraints.start_date || plan.extracted_constraints.end_date) {
      const { start_date, end_date } = plan.extracted_constraints;
      candidateEvidence = candidateEvidence.filter((ev) => {
        if (!ev.date) return true;
        if (start_date && ev.date < start_date) return false;
        if (end_date && ev.date > end_date) return false;
        return true;
      });
    }

    // 4. Deterministic Ranking Stage using retrieval relevance/context signals
    const scoredCandidates = candidateEvidence.map((ev) => {
      // a. Semantic/Vector Relevance
      const vectorScore = vectorScores.get(ev.id) ?? 0.5;

      // b. Structured/Exact-Match Relevance
      let structuredScore = 0.0;
      if (plan.extracted_constraints.start_date && ev.date && ev.date >= plan.extracted_constraints.start_date) {
        structuredScore += 0.25;
      }
      if (plan.extracted_constraints.end_date && ev.date && ev.date <= plan.extracted_constraints.end_date) {
        structuredScore += 0.25;
      }
      if (plan.extracted_constraints.min_amount && ev.content.includes(plan.extracted_constraints.min_amount.toString())) {
        structuredScore += 0.3;
      }
      if (plan.extracted_constraints.keywords) {
        for (const kw of plan.extracted_constraints.keywords) {
          if (ev.content.toLowerCase().includes(kw.toLowerCase())) {
            structuredScore += 0.1;
          }
        }
      }
      structuredScore = Math.min(structuredScore, 1.0);

      // c. Relationship/Context Relevance
      let relationshipScore = 0.0;
      if (ev.entity_ids && ev.entity_ids.length > 0) {
        const matchingEntityCount = ev.entity_ids.filter((id) => retrievedEntitiesMap.has(id)).length;
        if (matchingEntityCount > 0) {
          relationshipScore += Math.min(0.5 + matchingEntityCount * 0.25, 1.0);
        }
      }

      // d. Evidence Quality/Completeness
      let qualityScore = 0.0;
      if (ev.source_ref) qualityScore += 0.3;
      if (ev.chunk_ref) qualityScore += 0.3;
      if (ev.classification) qualityScore += 0.2;
      if (ev.content && ev.content.length > 20) qualityScore += 0.2;

      // Calculate total retrieval rank score
      const hybridRankScore = 
        vectorScore * 0.40 + 
        structuredScore * 0.30 + 
        relationshipScore * 0.20 + 
        qualityScore * 0.10;

      return { evidence: ev, score: hybridRankScore };
    });

    // Sort deterministically descending by hybrid score, with stable ID tie-breaker
    scoredCandidates.sort((a, b) => b.score - a.score || a.evidence.id.localeCompare(b.evidence.id));

    // Select top-k evidence candidates
    const finalEvidence = scoredCandidates.slice(0, topK).map((sc) => sc.evidence);
    const finalEntities = Array.from(retrievedEntitiesMap.values());
    const finalRelationships = Array.from(retrievedRelationshipsMap.values());

    // 5. Construct Grounded Evidence Context
    const contextBlocks: string[] = [];

    if (finalEvidence.length > 0) {
      contextBlocks.push('--- RETRIEVED EVIDENCE CHUNKS ---');
      for (const ev of finalEvidence) {
        contextBlocks.push(`[Evidence ID: ${ev.id}] (Source: ${ev.source_ref}, Chunk: ${ev.chunk_ref}, Classification: ${ev.classification})`);
        contextBlocks.push(`Content: ${ev.content}`);
        if (ev.date) contextBlocks.push(`Date: ${ev.date}`);
      }
    }

    if (finalEntities.length > 0) {
      contextBlocks.push('--- RETRIEVED ENTITIES ---');
      for (const ent of finalEntities) {
        contextBlocks.push(`[Entity ID: ${ent.id}] Name: ${ent.name}, Type: ${ent.type}, Classification: ${ent.classification}`);
      }
    }

    if (finalRelationships.length > 0) {
      contextBlocks.push('--- RETRIEVED RELATIONSHIP PATHS ---');
      for (const rel of finalRelationships) {
        contextBlocks.push(`[Rel ID: ${rel.id}] Source: ${rel.source_entity_id} -> Target: ${rel.target_entity_id} (${rel.relationship_type})`);
        if (rel.attributes) contextBlocks.push(`Attributes: ${JSON.stringify(rel.attributes)}`);
      }
    }

    const formattedContextText = contextBlocks.join('\n\n');

    return {
      question,
      intent: plan.intent,
      case_id: caseId,
      evidence: finalEvidence,
      entities: finalEntities,
      relationships: finalRelationships,
      formatted_context_text: formattedContextText,
    };
  }
}
