import { fetchApi } from './client';
import type { 
  Case, 
  Evidence,
  GraphResponse,
  AIResponseV1,
  TemporalAnalysisResponse,
  BridgeAnalysisResponse
} from '@/lib/client-contracts/contracts';

export const d2 = {
  auth: {
    login: async (credentials: any) => {
      return fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    },
    me: async () => {
      return fetchApi('/api/me');
    },
    logout: async () => {
      return fetchApi('/api/auth/logout', { method: 'POST' });
    }
  },
  cases: {
    list: async (status?: string, search?: string) => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      const q = params.toString() ? `?${params.toString()}` : '';
      return fetchApi<{ cases: Case[] }>(`/api/cases${q}`);
    },
    get: async (caseId: string) => {
      return fetchApi<{ case: Case }>(`/api/cases/${caseId}`);
    },
    update: async (caseId: string, data: Partial<Case>) => {
      return fetchApi<{ status: string }>(`/api/cases/${caseId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    create: async (data: { id: string, title: string, classification: string }) => {
      return fetchApi<{ status: string, case: Case }>(`/api/cases`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    getEvidence: async (caseId: string) => {
      return fetchApi<{ evidence: Evidence[] }>(`/api/cases/${caseId}/evidence`);
    },
    getResolutions: async (caseId: string) => {
      return fetchApi<any[]>(`/api/cases/${caseId}/entities/resolve`);
    },
    resolveEntity: async (caseId: string, candidateId: string, decision: string) => {
      return fetchApi(`/api/cases/${caseId}/entities/resolve`, {
        method: 'POST',
        body: JSON.stringify({ candidate_id: candidateId, decision })
      });
    },
    search: async (caseId: string, query: string) => {
      return fetchApi<any>(`/api/cases/${caseId}/search`, {
        method: 'POST',
        body: JSON.stringify({ query })
      });
    },
    generateLeads: async (caseId: string, request: any = {}) => {
      return fetchApi<any>(`/api/cases/${caseId}/leads`, {
        method: 'POST',
        body: JSON.stringify({ request })
      });
    }
  },
  copilot: {
    ask: async (caseId: string, query: string): Promise<AIResponseV1> => {
      return fetchApi<AIResponseV1>(`/api/cases/${caseId}/copilot`, {
        method: 'POST',
        body: JSON.stringify({ query })
      });
    }
  },
  graph: {
    getFocused: async (caseId: string, params: any): Promise<GraphResponse> => {
      const q = new URLSearchParams();
      if (params.seed) q.append('seed', params.seed);
      if (params.hops) q.append('hops', params.hops.toString());
      if (params.validFrom) q.append('validFrom', params.validFrom);
      if (params.validTo) q.append('validTo', params.validTo);
      if (params.goal) q.append('goal', params.goal);
      return fetchApi<GraphResponse>(`/api/cases/${caseId}/graph?${q.toString()}`);
    },
    getTemporal: async (caseId: string, timeRange: any): Promise<TemporalAnalysisResponse> => {
      return fetchApi<TemporalAnalysisResponse>(`/api/cases/${caseId}/analytics/temporal`, {
        method: 'POST',
        body: JSON.stringify({ timeRange })
      });
    },
    getBridge: async (caseId: string): Promise<BridgeAnalysisResponse> => {
      return fetchApi<BridgeAnalysisResponse>(`/api/cases/${caseId}/analytics/bridge`, {
        method: 'POST'
      });
    }
  }
};
