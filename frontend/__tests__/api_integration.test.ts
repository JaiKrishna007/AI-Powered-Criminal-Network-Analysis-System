import { describe, it, expect, vi, beforeEach } from 'vitest';
import { d2 } from '../src/api/d2';
import { fetchApi } from '../src/api/client';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Frontend API Integration Tests (D2 Gateway)', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Login Flow', () => {
    it('Should login successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success' })
      });
      const res = await d2.auth.login({ username: 'investigator', password: 'password123' });
      expect(res.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('Should handle unauthorized login correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      });
      await expect(d2.auth.login({ username: 'hacker', password: 'bad' }))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('Case Selection & Authorization', () => {
    it('authorized CASE-001 -> success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ case: { id: 'CASE-001', title: 'Test Case' } })
      });
      const res = await d2.cases.get('CASE-001');
      expect(res.case.id).toBe('CASE-001');
    });

    it('unauthorized CASE-002 -> 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' })
      });
      await expect(d2.cases.get('CASE-002')).rejects.toThrow('Forbidden');
    });

    it('manually modified case ID -> 404 or 400', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' })
      });
      await expect(d2.cases.get('CASE-999')).rejects.toThrow('Not Found');
    });
  });

  describe('Evidence', () => {
    it('Should fetch evidence for a case', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ evidence: [{ id: 'EV-01' }] })
      });
      const res = await d2.cases.getEvidence('CASE-001');
      expect(res.evidence.length).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/cases/CASE-001/evidence'),
        expect.anything()
      );
    });
  });

  describe('Graph & Temporal Analysis', () => {
    it('Should request focused graph correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [], meta: { truncated: false } })
      });
      await d2.graph.getFocused('CASE-001', { seed: 'P001', hops: 2, goal: 'financial' });
      
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('seed=P001');
      expect(calledUrl).toContain('hops=2');
      expect(calledUrl).toContain('goal=financial');
    });

    it('Should request temporal analytics correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ buckets: [] })
      });
      await d2.graph.getTemporal('CASE-001', { start: '2026-08-01T00:00:00Z', end: '2026-08-31T23:59:59Z' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/analytics/temporal'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Copilot', () => {
    it('Should route copilot questions properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'AI-1', content: 'Here is my answer' })
      });
      const res = await d2.copilot.ask('CASE-001', 'Who is Rohan?');
      expect((res as any).content).toBe('Here is my answer');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/copilot'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ query: 'Who is Rohan?' }) })
      );
    });
  });
});
