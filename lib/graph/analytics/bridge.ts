/**
 * GT-05 Bridge Detection
 * Detects structural bridge nodes connecting distinct subgraphs / communities.
 * Combines community detection, betweenness centrality, articulation point analysis,
 * cross-community relationships, temporal metadata, and evidence metadata.
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
   * Detects structural bridge candidates connecting distinct communities.
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

    const bridgeCandidates: Array<{ id: string; centrality: number; bridgeScore: number }> = [];

    for (const node of nodes) {
      const isCutVertex = articulationPoints.has(node.id);
      if (!isCutVertex) continue;

      // Remove candidate node to inspect resulting subcomponents
      const subNodes = nodes.filter((n) => n.id !== node.id);
      const subEdges = edges.filter((e) => e.source !== node.id && e.target !== node.id);

      const subCommunityResult = this.communityDetector.detectCommunities(subNodes, subEdges);
      const communities = Array.from(subCommunityResult.communities.values());

      // Evaluate internal edge counts of each resulting community
      const validCommunities = communities.filter((communityNodes) => {
        if (communityNodes.length < 3) return false;
        const commNodeSet = new Set(communityNodes);
        const internalEdgeCount = subEdges.filter(
          (e) => commNodeSet.has(e.source) && commNodeSet.has(e.target)
        ).length;
        return internalEdgeCount >= 2;
      });

      // A true cross-community bridge connects 2 or more distinct multi-edge communities
      if (validCommunities.length >= 2) {
        // Calculate bridge score: product of community sizes
        const bridgeScore = validCommunities.reduce((acc, c) => acc * c.length, 1);
        const centrality = centralityMap.get(node.id) || 0;
        bridgeCandidates.push({
          id: node.id,
          centrality,
          bridgeScore,
        });
      }
    }

    if (bridgeCandidates.length === 0) {
      return [];
    }

    // Rank candidates by bridgeScore descending, then centrality descending
    bridgeCandidates.sort((a, b) => {
      if (b.bridgeScore !== a.bridgeScore) return b.bridgeScore - a.bridgeScore;
      return b.centrality - a.centrality;
    });

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
        description: `Entity ${candidate.id} (${candidateNode.type}) acts as a structural connector bridging distinct communities (Betweenness Centrality: ${candidate.centrality.toFixed(3)}).`,
        target_entity_ids: [candidate.id],
        evidence_ids: evidenceIds,
        timestamp: new Date().toISOString(),
      });
    }

    return insights;
  }
}
