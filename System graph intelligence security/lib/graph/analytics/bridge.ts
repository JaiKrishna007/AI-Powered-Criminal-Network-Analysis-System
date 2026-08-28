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
import { ClusterDetector } from "./cluster.js";
import { CentralityAnalyzer } from "./centrality.js";

// Helper to get centralized temporal date (P2-4)
function getEdgeEffectiveTime(e: any): number | undefined {
  const startStr = e.event_time || e.effective_start || e.valid_from || (e.properties && (e.properties.effective_start || e.properties.valid_from));
  if (startStr) return new Date(startStr).getTime();
  return undefined;
}

export class BridgeDetector {
  private clusterDetector = new ClusterDetector();
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
    const baseClusters = this.clusterDetector.detectClusters(nodes, edges);
    const clusterMap = new Map<string, number>(); // Node ID -> Cluster ID
    
    for (const [nodeId, clusterId] of baseClusters.nodeClusterMap.entries()) {
      clusterMap.set(nodeId, clusterId);
    }

    const maxCentrality = Math.max(...Array.from(centralityMap.values()), 1);

    const bridgeCandidates: Array<{
      id: string;
      scoreDetails: {
        normalizedBetweenness: number;
        articulationSignal: number;
        crossClusterConnectivity: number;
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

      // 3. Cross-Cluster Connectivity
      // A node bridging different connected components is strong
      const connectedClusters = new Set<string>();

      const subNodes = nodes.filter((n) => n.id !== node.id);
      const subEdges = edges.filter((e) => e.source !== node.id && e.target !== node.id);
      const subClusterResult = this.clusterDetector.detectClusters(subNodes, subEdges);
      const subClusters = Array.from(subClusterResult.clusters.values());
      
      const validSubClusters = subClusters.filter((clusterNodes) => {
        return clusterNodes.length >= 2; 
      });
      
      const crossClusterConnectivity = Math.min(validSubClusters.length, 5) / 5.0;

      if (!isCutVertex && rawCentrality === 0 && validSubClusters.length <= 1) {
        continue; 
      }

      // 4. Evidence Density
      const totalEvidence = connectedEdges.reduce((sum, e) => sum + (e.evidence_ids?.length || 0), 0);
      const evidenceDensity = Math.min(totalEvidence, 10) / 10.0;

      // 5. Temporal Relevance (Recent activity gets higher score)
      let maxTemporalScore = 0;
      for (const e of connectedEdges) {
        const edgeTime = getEdgeEffectiveTime(e);
        if (edgeTime !== undefined) {
          const daysOld = Math.max(0, (nowTime - edgeTime) / (1000 * 3600 * 24));
          const temporalScore = Math.max(0, 1.0 - (daysOld / 365)); 
          if (temporalScore > maxTemporalScore) maxTemporalScore = temporalScore;
        }
      }
      const temporalRelevance = maxTemporalScore;

      const w1 = 0.3; // betweenness
      const w2 = 0.3; // articulation
      const w3 = 0.2; // cross-cluster
      const w4 = 0.1; // evidence density
      const w5 = 0.1; // temporal relevance

      const bridgeScore = 
        (w1 * normalizedBetweenness) + 
        (w2 * articulationSignal) + 
        (w3 * crossClusterConnectivity) + 
        (w4 * evidenceDensity) + 
        (w5 * temporalRelevance);

      if (bridgeScore > 0.1) {
        bridgeCandidates.push({
          id: node.id,
          scoreDetails: {
            normalizedBetweenness,
            articulationSignal,
            crossClusterConnectivity,
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
        title: `Potential Structural Bridge Identified: ${candidate.id}`,
        description: `Entity ${candidate.id} (${candidateNode.type}) acts as a structural connector bridging distinct clusters. Score: ${candidate.bridgeScore.toFixed(3)}.`,
        target_entity_ids: [candidate.id],
        evidence_ids: evidenceIds,
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }
}
