'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CaseShell from '@/components/case/CaseShell';
import NetworkCanvas from '@/components/graph/NetworkCanvas';
import RelationshipDrawer from '@/components/graph/RelationshipDrawer';
import TimelineBar from '@/components/timeline/TimelineBar';
import CopilotPanel from '@/components/copilot/CopilotPanel';
import EvidencePanel from '@/components/evidence/EvidencePanel';
import InsightCard from '@/components/insights/InsightCard';
import LeadCard from '@/components/insights/LeadCard';
import ReportPreview from '@/components/reports/ReportPreview';
import { 
  Case, 
  Entity, 
  Relationship, 
  Insight, 
  Lead, 
  GraphPayload, 
  CopilotMessage 
} from '@/lib/client-contracts/contracts';
import { mockDB } from '@/lib/client-contracts/mockData';
import { 
  ShieldAlert, 
  Layers, 
  Network as GraphIcon, 
  GitCompare, 
  UserCheck, 
  AlertOctagon,
  Clock,
  Compass,
  FolderClosed,
  ChevronRight,
  BrainCircuit,
  ListTodo
} from 'lucide-react';

export default function CaseWorkspacePage({ params }: { params: { id: string } }) {
  const caseId = params.id;

  // Nav and Layout state
  const [activeTab, setActiveTab] = useState('overview');
  const [caseObj, setCaseObj] = useState<Case | null>(null);

  // Graph state
  const [nodes, setNodes] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Relationship[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [seedNodes, setSeedNodes] = useState<string>('');
  const [hops, setHops] = useState<number>(2);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
  const [goalMode, setGoalMode] = useState<string>('all');

  // Temporal range parameters (UTC ISO format)
  const [startDate, setStartDate] = useState('2026-08-08');
  const [endDate, setEndDate] = useState('2026-08-18');

  // Inspector state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Resolution & Intel state
  const [insights, setInsights] = useState<Insight[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [resolutions, setResolutions] = useState<any[]>([]);
  
  // Search query state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);

  // Shared all entities list to translate IDs
  const [allEntities, setAllEntities] = useState<Entity[]>([]);

  // 1. Fetch Case Details & Core Metadata
  const fetchCaseData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      if (res.ok) {
        const data = await res.json();
        setCaseObj(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [caseId]);

  // 2. Fetch Graph Data (FE-02 / FE-03 / FE-05)
  const fetchGraph = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (seedNodes) params.append('seed', seedNodes);
      params.append('hops', hops.toString());
      params.append('validFrom', `${startDate}T00:00:00Z`);
      params.append('validTo', `${endDate}T23:59:59Z`);
      params.append('goal', goalMode);
      
      const res = await fetch(`/api/cases/${caseId}/graph?${params.toString()}`);
      if (res.ok) {
        const data: GraphPayload = await res.json();
        setNodes(data.nodes);
        setEdges(data.edges);
        setTruncated(data.meta.truncated);
      }
    } catch (err) {
      console.error(err);
    }
  }, [caseId, seedNodes, hops, startDate, endDate, goalMode]);

  // 3. Fetch Insights, Leads & Entity Resolutions
  const fetchInsightsAndLeads = useCallback(async () => {
    try {
      // Insights
      const insightsRes = await fetch(`/api/cases/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ' ' })
      });
      if (insightsRes.ok) {
        const searchData = await insightsRes.json();
        setAllEntities(searchData.entities || []);
      }

      // Leads (GET)
      const leadsRes = await fetch(`/api/cases/${caseId}/leads`);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data);
      }

      // Resolutions (GET)
      const resRes = await fetch(`/api/cases/${caseId}/entities/resolve`);
      if (resRes.ok) {
        const data = await resRes.json();
        setResolutions(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [caseId]);

  // Load baseline on mount or case switch
  useEffect(() => {
    fetchCaseData();
    fetchInsightsAndLeads();
  }, [caseId, fetchCaseData, fetchInsightsAndLeads]);

  // Sync graph whenever seeds, time boundaries or filters change (FE-03 / FE-05)
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Static Insights list mapped from mock DB
  useEffect(() => {
    async function loadStaticInsights() {
      // Mock lookup: INS-001, INS-002, INS-003
      // We will parse them from static details
      const mockInsights: Insight[] = [
        {
          id: 'INS-001',
          case_id: caseId,
          type: 'POTENTIAL_BRIDGE',
          entity_id: 'P004',
          confidence: 0.91,
          reasons: [
            'Mohd. Rizwan acts as a structural connector between the primary suspect cluster (Rohan Mehta) and the offshore fund cluster (David Miller).',
            'Receives communication link from Rohan\'s phone proxy (PH001).',
            'Directly triggers financial transfer of INR 1.2M to Swiss Account BA003 linked to offshore beneficiary David Miller.'
          ],
          evidence_ids: ['CDR-102', 'TXN-9021', 'DIR-103']
        },
        {
          id: 'INS-002',
          case_id: caseId,
          type: 'FINANCIAL_PATH',
          entity_id: 'P001',
          confidence: 0.96,
          reasons: [
            'Identified high-velocity transaction trail.',
            'Rohan Mehta transferred 500,000 INR to Vikram Malhotra (BA002) within 24 hours of call activity.',
            'Suspicious offshore transaction of 1,200,000 INR routed via Mohd. Rizwan within the same 72-hour window.'
          ],
          evidence_ids: ['TXN-8819', 'TXN-9021']
        },
        {
          id: 'INS-003',
          case_id: caseId,
          type: 'CO_LOCATION',
          entity_id: 'P002',
          confidence: 0.85,
          reasons: [
            'Vikram Malhotra and Mohd. Rizwan physically present at the same location (Hotel Regal, Pune) on 2026-08-11T18:00:00Z.',
            'Corresponds to surveillance reports and CCTV footage logs.'
          ],
          evidence_ids: ['SURV-103']
        }
      ];
      setInsights(mockInsights.filter((i) => i.case_id === caseId));
    }
    loadStaticInsights();
  }, [caseId]);

  // Handle Search Queries (FE-01)
  const handleSearchSubmit = async (query: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setActiveTab('overview'); // Switch to Overview tab to view results
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Copilot Graph Focus callback (FE-06)
  const handleCopilotGraphFocus = (req: NonNullable<CopilotMessage['graph_request']>) => {
    setSeedNodes(req.seed_nodes.join(','));
    setHops(req.hops);
    if (req.highlight_edges) {
      setHighlightedEdges(req.highlight_edges);
    } else {
      setHighlightedEdges([]);
    }
    // Switch navigation automatically to graph tab to observe focus
    setActiveTab('network');
  };

  // Handle Entity Resolution Decision Approve/Reject (FE-T03)
  const handleResolutionDecision = async (resId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/cases/${caseId}/entities/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionId: resId, decision })
      });
      if (res.ok) {
        // Refresh local views & rebuild graph to include new aliases
        fetchInsightsAndLeads();
        fetchGraph();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Lead Status changes (FE-07)
  const handleLeadStatusChange = async (leadId: string, status: Lead['status']) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status })
      });
      if (res.ok) {
        // Reload leads list
        fetchInsightsAndLeads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Triggered when selecting an entity in Copilot or insights list
  const handleFocusEntityId = (entId: string) => {
    setSeedNodes(entId);
    setHops(2);
    setHighlightedEdges([]);
    setSelectedNodeId(entId);
    setSelectedEdgeId(null);
    setActiveTab('network');
  };

  // Triggered when clicking evidence citations in Copilot
  const handleSelectEvidenceId = (evId: string) => {
    // Find the relationship that is supported by this evidence
    const matchingRel = mockDB.relationships.find((r) => r.evidence_ids.includes(evId));
    if (matchingRel) {
      setSelectedEdgeId(matchingRel.id);
      setSelectedNodeId(null);
      setActiveTab('network');
    } else {
      // Otherwise open the evidence explorer tab and search for it
      setSearchQuery(evId);
      setActiveTab('evidence');
    }
  };

  return (
    <CaseShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      activeCaseId={caseId}
      setActiveCaseId={(id) => {
        // Clear focus on case switch
        setSeedNodes('');
        setHighlightedEdges([]);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        window.location.href = `/cases/${id}`;
      }}
      onSearch={handleSearchSubmit}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >
      <div className="w-full h-full flex overflow-hidden relative">
        
        {/* Left main work container: adapts based on active tab */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-950">
              
              {/* Search Results Display (FE-01) */}
              {searchResults ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                      Search results for "{searchResults.query}"
                    </h3>
                    <button 
                      onClick={() => setSearchResults(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Clear Search
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Matched Entities */}
                    <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850">
                      <h4 className="text-xs font-bold text-zinc-300 mb-3">Matched Entities ({searchResults.entities?.length || 0})</h4>
                      {searchResults.entities?.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No entities match query.</p>
                      ) : (
                        <div className="space-y-2">
                          {searchResults.entities.map((e: Entity) => (
                            <button
                              key={e.id}
                              onClick={() => handleFocusEntityId(e.id)}
                              className="w-full flex items-center justify-between p-2.5 rounded bg-zinc-950 border border-zinc-900 hover:border-zinc-850 text-left transition"
                            >
                              <span className="text-xs font-bold text-zinc-200">{e.canonical_name}</span>
                              <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">{e.type}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Matched Evidence */}
                    <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850">
                      <h4 className="text-xs font-bold text-zinc-300 mb-3">Matched Evidence ({searchResults.evidence?.length || 0})</h4>
                      {searchResults.evidence?.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No evidence artifacts match query.</p>
                      ) : (
                        <div className="space-y-2">
                          {searchResults.evidence.map((e: any) => (
                            <button
                              key={e.id}
                              onClick={() => {
                                handleSelectEvidenceId(e.id);
                              }}
                              className="w-full flex flex-col gap-1 p-2.5 rounded bg-zinc-950 border border-zinc-900 hover:border-zinc-850 text-left transition"
                            >
                              <div className="flex items-center justify-between text-xs font-bold text-zinc-200">
                                <span>{e.id}</span>
                                <span className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 rounded">{e.source_type}</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 truncate">{e.content}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Default Case Overview */
                <div className="space-y-6">
                  {/* Case brief header card */}
                  {caseObj && (
                    <div className="p-6 rounded-2xl glass-panel border border-zinc-800 flex flex-col gap-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-3xl rounded-full"></div>
                      <div>
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded uppercase tracking-widest">
                          {caseObj.classification.replace('_', ' ')}
                        </span>
                        <h2 className="text-2xl font-black text-zinc-100 tracking-wide mt-3">
                          {caseObj.title}
                        </h2>
                        <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed max-w-3xl">
                          {caseObj.description}
                        </p>
                      </div>
                      
                      {/* Case stats metadata strip */}
                      <div className="grid grid-cols-4 gap-4 border-t border-zinc-850 pt-4 mt-2">
                        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900/80 flex flex-col gap-1.5 text-xs">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Workspace State</span>
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            {caseObj.status}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900/80 flex flex-col gap-1.5 text-xs">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Resolved Entities</span>
                          <span className="font-bold text-zinc-200 font-mono">{caseObj.entity_count}</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900/80 flex flex-col gap-1.5 text-xs">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Identified Links</span>
                          <span className="font-bold text-zinc-200 font-mono">{caseObj.relationship_count}</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900/80 flex flex-col gap-1.5 text-xs">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Evidence Index</span>
                          <span className="font-bold text-zinc-200 font-mono">{caseObj.evidence_count}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Entity Resolution Queue (FE-T03 / FE-07) */}
                  <div className="p-5 rounded-2xl glass-panel border border-zinc-800/80 flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-zinc-850 pb-2">
                      <GitCompare size={16} className="text-indigo-400 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Entity Resolution Verification Queue ({resolutions.filter((r) => r.status === 'CANDIDATE').length})
                      </h3>
                    </div>

                    {resolutions.filter((r) => r.status === 'CANDIDATE').length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No candidates awaiting review.</p>
                    ) : (
                      <div className="space-y-4">
                        {resolutions.filter((r) => r.status === 'CANDIDATE').map((res) => (
                          <div 
                            key={res.id}
                            className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 flex flex-col gap-3.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-indigo-400 uppercase bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded">
                                Similarity Confidence: {Math.round(res.confidence * 100)}%
                              </span>
                              <span className="text-[8px] font-mono text-zinc-500">ID: {res.id}</span>
                            </div>

                            {/* Candidate Names comparison */}
                            <div className="flex items-center gap-6 justify-center py-2 border-y border-zinc-900 bg-zinc-900/10">
                              <div className="text-center w-36">
                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Canonical Profile</p>
                                <p className="font-bold text-zinc-200 mt-1">{res.original.canonical_name}</p>
                                <p className="text-[8px] text-zinc-500 font-mono mt-0.5">ID: {res.original.id}</p>
                              </div>
                              <div className="px-3.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400">
                                Match?
                              </div>
                              <div className="text-center w-36">
                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Extracted Candidate</p>
                                <p className="font-bold text-indigo-400 mt-1">{res.candidate.canonical_name}</p>
                                <p className="text-[8px] text-zinc-500 font-mono mt-0.5">aka: {res.candidate.aliases.join(', ')}</p>
                              </div>
                            </div>

                            {/* Contributing signals lists */}
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Similarity Rationale:</p>
                              <ul className="list-disc pl-4 text-[10px] text-zinc-500 space-y-0.5">
                                {res.reasons.map((reason: string, i: number) => (
                                  <li key={i} className="leading-snug">{reason}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Actions review buttons */}
                            <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-900">
                              <button
                                onClick={() => handleResolutionDecision(res.id, 'REJECTED')}
                                className="px-3.5 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-bold transition"
                              >
                                Reject Merge
                              </button>
                              <button
                                onClick={() => handleResolutionDecision(res.id, 'ACCEPTED')}
                                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md shadow-indigo-600/10"
                              >
                                Approve Merge
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NETWORK GRAPH (FE-02) */}
          {activeTab === 'network' && (
            <div className="flex-1 flex flex-col relative min-h-0">
              
              {/* Goal selector panel overlay (FE-05) */}
              <div className="absolute top-4 right-4 z-10 flex gap-1.5 p-1 rounded-lg bg-zinc-900/85 border border-zinc-800/80 backdrop-blur-md">
                <button
                  onClick={() => setGoalMode('all')}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition ${
                    goalMode === 'all' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All Links
                </button>
                <button
                  onClick={() => setGoalMode('financial')}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition ${
                    goalMode === 'financial' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Financial Path Mode
                </button>
                <button
                  onClick={() => setGoalMode('telecom')}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition ${
                    goalMode === 'telecom' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Telecom Mode
                </button>
              </div>

              {/* Seed Node Clear/Indicator badge */}
              {seedNodes && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-900/50 text-indigo-400 text-xs font-semibold backdrop-blur-md">
                  <GraphIcon size={14} className="shrink-0" />
                  <span>Focused Subgraph (Seeds: {seedNodes})</span>
                  <button 
                    onClick={() => {
                      setSeedNodes('');
                      setHighlightedEdges([]);
                    }}
                    className="text-[9px] uppercase tracking-wider text-zinc-400 hover:text-white ml-2 bg-indigo-900/40 px-1.5 py-0.5 rounded border border-indigo-850"
                  >
                    Clear Focus
                  </button>
                </div>
              )}

              {/* Canvas Render Area */}
              <div className="flex-1 min-h-0 relative">
                <NetworkCanvas
                  nodes={nodes}
                  edges={edges}
                  truncated={truncated}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                  selectedEdgeId={selectedEdgeId}
                  setSelectedEdgeId={setSelectedEdgeId}
                  onExpandNode={(nodeId) => {
                    // Node Expand query parameters (FE-T03)
                    setSeedNodes(nodeId);
                    setHops(2);
                  }}
                  highlightedEdges={highlightedEdges}
                />
              </div>

              {/* Selection detail slide out drawer wrapper */}
              {(selectedNodeId || selectedEdgeId) && (
                <RelationshipDrawer
                  selectedNodeId={selectedNodeId}
                  selectedEdgeId={selectedEdgeId}
                  onClose={() => {
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                  }}
                  onSetSeed={(id) => {
                    setSeedNodes(id);
                    setHops(1);
                  }}
                  allEntities={allEntities}
                />
              )}
            </div>
          )}

          {/* TAB 3: TEMPORAL TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="flex-1 flex flex-col p-6 gap-6 min-h-0 bg-zinc-950">
              <div className="flex-1 min-h-0 relative">
                {/* Render canvas layout */}
                <NetworkCanvas
                  nodes={nodes}
                  edges={edges}
                  truncated={truncated}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                  selectedEdgeId={selectedEdgeId}
                  setSelectedEdgeId={setSelectedEdgeId}
                  onExpandNode={(nodeId) => {
                    setSeedNodes(nodeId);
                    setHops(2);
                  }}
                  highlightedEdges={highlightedEdges}
                />

                {(selectedNodeId || selectedEdgeId) && (
                  <RelationshipDrawer
                    selectedNodeId={selectedNodeId}
                    selectedEdgeId={selectedEdgeId}
                    onClose={() => {
                      setSelectedNodeId(null);
                      setSelectedEdgeId(null);
                    }}
                    onSetSeed={(id) => {
                      setSeedNodes(id);
                      setHops(1);
                    }}
                    allEntities={allEntities}
                  />
                )}
              </div>

              {/* Range sliders coordinates filters (FE-03) */}
              <div className="shrink-0">
                <TimelineBar
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndValDate={setEndDate}
                  filteredCount={edges.length}
                  totalCount={mockDB.relationships.length}
                />
              </div>
            </div>
          )}

          {/* TAB 4: EVIDENCE EXPLORER */}
          {activeTab === 'evidence' && (
            <div className="flex-1 min-h-0">
              <EvidencePanel
                caseId={caseId}
                onSelectEvidenceId={handleSelectEvidenceId}
              />
            </div>
          )}

          {/* TAB 5: AI INSIGHTS */}
          {activeTab === 'insights' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-950">
              <div>
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <BrainCircuit className="text-indigo-400" />
                  Explainable AI (XAI) Insight Index
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  High-confidence risk highlights, bridges, and financial path detection flags generated by model analytics.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onFocusEntity={handleFocusEntityId}
                    onSelectEvidence={handleSelectEvidenceId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LEADS */}
          {activeTab === 'leads' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-950">
              <div>
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <ListTodo className="text-indigo-400" />
                  Advisory Investigative Lead Recommendations
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Heuristic-derived tasks prioritised to guide investigators through data verification steps.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onStatusChange={handleLeadStatusChange}
                    onSelectEvidence={handleSelectEvidenceId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: REPORT */}
          {activeTab === 'report' && (
            <div className="flex-1 min-h-0">
              <ReportPreview
                caseId={caseId}
              />
            </div>
          )}

        </div>

        {/* Right Chat panel sidebar for Copilot RAG queries (FE-06) */}
        {activeTab !== 'report' && (
          <CopilotPanel
            caseId={caseId}
            onGraphFocus={handleCopilotGraphFocus}
            onSelectEvidence={handleSelectEvidenceId}
          />
        )}

      </div>
    </CaseShell>
  );
}
