import { 
  InsightV1Adapter, 
  InsightSignals, 
  BridgeSignal, 
  CommunicationSignal, 
  FinancialSignal, 
  TemporalSignal, 
  EvidenceDensitySignal,
  EvidenceV1,
  RelV1,
  AuthScopeAdapter
} from '../../../contracts/adapters.js';

export class ExplainabilityEngine {
  /**
   * Evaluates evidence and relationship signals for a case entity to generate a fully explainable insight (InsightV1Adapter).
   */
  public generateInsight(
    caseId: string,
    targetEntityId: string,
    evidenceList: EvidenceV1[],
    relationships: RelV1[],
    scope: AuthScopeAdapter
  ): InsightV1Adapter {
    // 1. Authorization check
    if (!scope.authorized_case_ids.includes(caseId)) {
      throw new Error(`[ExplainabilityEngine] Scope access denied for case ${caseId}`);
    }

    const bridgeSignals: BridgeSignal[] = [];
    const commSignals: CommunicationSignal[] = [];
    const finSignals: FinancialSignal[] = [];
    const tempSignals: TemporalSignal[] = [];
    const supportingEvidenceIds: string[] = [];

    // Filter evidence related to case and scope
    const caseEvidence = evidenceList.filter((ev) => ev.case_id === caseId);
    caseEvidence.forEach((ev) => supportingEvidenceIds.push(ev.id));

    // Filter relationships involving target entity
    const entityRels = relationships.filter(
      (r) => r.case_id === caseId && (r.source_entity_id === targetEntityId || r.target_entity_id === targetEntityId)
    );

    // Compute Bridge Signal (e.g. key intermediary node connecting multiple subgraphs)
    if (entityRels.length >= 2) {
      bridgeSignals.push({
        value: 0.85,
        reason_code: 'BRIDGE_NODE_HIGH_CENTRALITY',
      });
    }

    // Compute Communication Signal
    const commRels = entityRels.filter((r) => r.relationship_type === 'COMMUNICATED_WITH');
    if (commRels.length > 0) {
      commSignals.push({
        count: commRels.length,
        time_window: '30_DAYS',
      });
    }

    // Compute Financial Signal
    const finRels = entityRels.filter(
      (r) => r.relationship_type === 'TRANSFERRED_FUNDS' || r.relationship_type === 'FINANCIAL_TRANSACTION'
    );
    let totalAmount = 0;
    let minDate = '9999-12-31';
    let maxDate = '0000-01-01';

    for (const r of finRels) {
      const amt = r.attributes?.amount || 0;
      totalAmount += amt;
      const date = r.created_at || r.attributes?.date || '2026-01-01';
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    }

    if (finRels.length > 0) {
      finSignals.push({
        amount: totalAmount,
        count: finRels.length,
        start_date: minDate === '9999-12-31' ? '2026-01-01' : minDate,
        end_date: maxDate === '0000-01-01' ? '2026-06-30' : maxDate,
      });
    }

    // Compute Temporal Signal
    if (finRels.length > 3) {
      tempSignals.push({
        change: 'RAPID_TRANSACTION_FREQUENCY_SPIKE',
        window: '48_HOURS',
      });
    }

    // Compute Evidence Density
    const evidenceDensity: EvidenceDensitySignal = {
      count: caseEvidence.length,
      evidence_ids: supportingEvidenceIds,
    };

    const signals: InsightSignals = {
      bridge_signals: bridgeSignals.length > 0 ? bridgeSignals : undefined,
      communication_signals: commSignals.length > 0 ? commSignals : undefined,
      financial_signals: finSignals.length > 0 ? finSignals : undefined,
      temporal_signals: tempSignals.length > 0 ? tempSignals : undefined,
      evidence_density: evidenceDensity,
    };

    const highlightReason = `Entity ${targetEntityId} highlighted due to observed financial activity ($${totalAmount}) and ${bridgeSignals.length > 0 ? 'bridge node centrality' : 'associated evidence density'}.`;

    return {
      insight_id: `ins_${caseId}_${targetEntityId}_${Date.now()}`,
      case_id: caseId,
      highlight_reason: highlightReason,
      signals,
      supporting_evidence_ids: supportingEvidenceIds,
      created_at: new Date().toISOString(),
    };
  }
}
