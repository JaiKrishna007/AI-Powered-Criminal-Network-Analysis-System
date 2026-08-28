import type {
  CaseV1,
  EvidenceV1,
  EntityV1,
  RelationshipV1,
  InsightV1,
  ReportV1,
} from 'shared-contracts';

export type Case = CaseV1 & { entity_count?: number; evidence_count?: number; created_at?: string; };
export type Evidence = Omit<EvidenceV1, 'storage_uri'> & { storage_uri?: string; content?: string | Uint8Array; title?: string; summary?: string; integrity_status?: string; };
export type Entity = EntityV1;
export type Relationship = RelationshipV1;
export type Insight = InsightV1;
export type Lead = any; // Fallback
export type Report = Omit<ReportV1, 'status'> & { status: string; sections?: any[]; };

export interface GraphNode {
  id: string;
  label?: string;
  type?: string;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
  properties?: Record<string, any>;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta?: { truncated: boolean; node_count?: number; edge_count?: number; };
}

export type GraphPayload = GraphResponse;

export interface AIResponseV1 {
  status: string;
  response: string;
  grounding?: string[];
}

export interface TemporalAnalysisResponse {
  insights?: InsightV1[];
  summary?: string;
}

export interface BridgeAnalysisResponse {
  insights?: InsightV1[];
  key_bridges?: {
    entity_id: string;
    betweenness_score: number;
  }[];
}

export type CopilotMessage = Partial<AIResponseV1> & {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  limitations?: string[];
  graph_request?: any;
};
