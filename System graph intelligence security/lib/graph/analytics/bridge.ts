/**
 * GT-05 Bridge Detection
 * Detects structural bridge nodes connecting distinct subgraphs / communities.
 * Evaluates candidate bridges using a comprehensive relevance score:
 * betweenness centrality, articulation point signals, cross-community relationships, 
 * evidence density, and temporal relevance.
 * Emits INSIGHT.v1 with type POTENTIAL_BRIDGE.
 * Never labels entities with legal or criminal guilt terms.
 */

import { ENTITY_v1, REL_v1, INSIGHT_v1 } from "../../contracts/types.js";
import { CommunityDetector } from "./community.js";
import { CentralityAnalyzer } from "./centrality.js";

export class BridgeDetector {
  private communityDetector = new CommunityDetector();
  private centralityAnalyzer = new CentralityAnalyzer();

  /**
   * Detects structural bridge candidates using a comprehensive multi-factor scoring model.
   */
  public detectBridges(
    caseId: string,
    nodes: ENTITY_v1[],
    edges: REL_v1[]
  ): INSIGHT_v1[] {
    if (nodes.length <= 2 || edges.length === 0) {
      return [];
    }

    const articulationPoints = this.centralityAnalyzer.findArticulationPoints(nodes, edges);
    const centralityMap = this.centralityAnalyzer.calculateBetweennessCentrality(nodes, edges);
    const baseCommunities = this.communityDetector.detectCommunities(nodes, edges);
    const communityMap = new Map<string, number>(); // Node ID -> Community ID (Component ID)
    
    // Build quick lookup for community IDs
    for (const [nodeId, commId] of baseCommunities.nodeCommunityMap.entries()) {
      communityMap.set(nodeId, commId);
    }

    const maxCentrality = Math.max(...Array.from(centralityMap.values()), 1);

    const bridgeCandidates: Array<{
      id: string;
      scoreDetails: {
        normalizedBetweenness: number;
        articulationSignal: number;
        crossCommunityDegree: number;
        evidenceDensity: number;
        temporalRelevance: number;
      };
      bridgeScore: number;
    }> = [];

    const nowTime = new Date().getTime();

    for (const node of nodes) {
      // Find connected edges
      const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
      if (connectedEdges.length === 0) continue;

      // 1. Normalized Betweenness Centrality
      const rawCentrality = centralityMap.get(node.id) || 0;
      const normalizedBetweenness = rawCentrality / maxCentrality;

      // 2. Articulation Signal
      const isCutVertex = articulationPoints.has(node.id);
      const articulationSignal = isCutVertex ? 1.0 : 0.0;

      // 3. Cross-Community Degree (Connections to distinct communities)
      // A node bridging different connected components (or sub-components) is strong
      const connectedCommunities = new Set<string>();
      for (const edge of connectedEdges) {
        const neighborId = edge.source === node.id ? edge.target : edge.source;
        // In simple connected-components, all connected nodes are in the same community.
        // But removing the candidate node splits it. 
        // We evaluate articulation by removing this node.
      }

      // To evaluate cross-community correctly, we remove the candidate and check components.
      const subNodes = nodes.filter((n) => n.id !== node.id);
      const subEdges = edges.filter((e) => e.source !== node.id && e.target !== node.id);
      const subCommunityResult = this.communityDetector.detectCommunities(subNodes, subEdges);
      const subCommunities = Array.from(subCommunityResult.communities.values());
      
      const validSubCommunities = subCommunities.filter((communityNodes) => {
        return communityNodes.length >= 2; // Ignoring isolated single nodes
      });
      
      // Cross-community degree approximation
      const crossCommunityDegree = Math.min(validSubCommunities.length, 5) / 5.0;

      // Only consider nodes that either split communities or have high centrality
      if (!isCutVertex && rawCentrality === 0 && validSubCommunities.length <= 1) {
        continue; // Not a meaningful bridge
      }

      // 4. Evidence Density
      const totalEvidence = connectedEdges.reduce((sum, e) => sum + (e.evidence_ids?.length || 0), 0);
      const evidenceDensity = Math.min(totalEvidence, 10) / 10.0;

      // 5. Temporal Relevance (Recent activity gets higher score)
      let maxTemporalScore = 0;
      for (const e of connectedEdges) {
        if (e.event_time) {
          const edgeTime = new Date(e.event_time).getTime();
          const daysOld = Math.max(0, (nowTime - edgeTime) / (1000 * 3600 * 24));
          const temporalScore = Math.max(0, 1.0 - (daysOld / 365)); // 1.0 if today, 0 if > 1 year
          if (temporalScore > maxTemporalScore) maxTemporalScore = temporalScore;
        }
      }
      const temporalRelevance = maxTemporalScore;

      // Calculate Weighted Bridge Score (Configurable weights)
      const w1 = 0.3; // betweenness
      const w2 = 0.3; // articulation
      const w3 = 0.2; // cross-community
      const w4 = 0.1; // evidence density
      const w5 = 0.1; // temporal relevance

      const bridgeScore = 
        (w1 * normalizedBetweenness) + 
        (w2 * articulationSignal) + 
        (w3 * crossCommunityDegree) + 
        (w4 * evidenceDensity) + 
        (w5 * temporalRelevance);

      if (bridgeScore > 0.1) {
        bridgeCandidates.push({
          id: node.id,
          scoreDetails: {
            normalizedBetweenness,
            articulationSignal,
            crossCommunityDegree,
            evidenceDensity,
            temporalRelevance
          },
          bridgeScore,
        });
      }
    }

    if (bridgeCandidates.length === 0) {
      return [];
    }

    // Rank candidates by bridgeScore descending
    bridgeCandidates.sort((a, b) => b.bridgeScore - a.bridgeScore);

    // Keep top candidates (e.g., top 10% or just the top score group)
    const maxScore = bridgeCandidates[0].bridgeScore;
    const topCandidates = bridgeCandidates.filter((c) => c.bridgeScore === maxScore);

    const insights: INSIGHT_v1[] = [];

    for (const candidate of topCandidates) {
      const candidateNode = nodes.find((n) => n.id === candidate.id)!;
      const connectedEdges = edges.filter(
        (e) => e.source === candidate.id || e.target === candidate.id
      );

      const evidenceIds = Array.from(
        new Set(connectedEdges.flatMap((e) => e.evidence_ids || []))
      );

      insights.push({
        id: `bridge_${candidate.id}_${Date.now()}`,
        case_id: caseId,
        type: "POTENTIAL_BRIDGE",
        title: `Potential Bridge Candidate Identified: ${candidate.id}`,
        description: `Entity ${candidate.id} (${candidateNode.type}) acts as a structural connector bridging distinct communities. Score: ${candidate.bridgeScore.toFixed(3)}.`,
        target_entity_ids: [candidate.id],
        evidence_ids: evidenceIds,
        timestamp: new Date().toISOString(),
        // Attaching score details into a custom properties field (for internal debugging or XAI report)
        ...( { properties: candidate.scoreDetails } as any)
      });
    }

    return insights;
  }
}
