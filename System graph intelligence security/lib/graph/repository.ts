import { ENTITY_v1, REL_v1, GRAPH_v1, AuthContext } from "../contracts/types.js";
import { FocusedSubgraphOptions } from "./focused_subgraph.js";

export interface GraphRepository {
  addEntity(entity: ENTITY_v1, auth: AuthContext): Promise<void>;
  addRelationship(rel: REL_v1, auth: AuthContext): Promise<void>;
  getEntity(id: string, auth: AuthContext): Promise<ENTITY_v1 | undefined>;
  getRelationship(id: string, auth: AuthContext): Promise<REL_v1 | undefined>;
  getAllEntitiesForCase(caseId: string, auth: AuthContext): Promise<ENTITY_v1[]>;
  getAllRelationshipsForCase(caseId: string, auth: AuthContext): Promise<REL_v1[]>;
  getCaseGraph(caseId: string, auth: AuthContext, maxNodes?: number): Promise<GRAPH_v1>;
  getAuthorizedAnalyticsGraph(caseId: string, auth: AuthContext): Promise<GRAPH_v1>;
  getFocusedSubgraph(options: FocusedSubgraphOptions, auth: AuthContext): Promise<GRAPH_v1>;
  clear(): Promise<void>;
}
