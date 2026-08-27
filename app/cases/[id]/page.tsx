'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CaseShell from '@/components/case/CaseShell';
import NetworkCanvas from '@/components/graph/NetworkCanvas';
import RelationshipDrawer from '@/components/graph/RelationshipDrawer';
import TimelineBar from '@/components/timeline/TimelineBar';
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
  FolderClosed, 
  Layers,
  Network as GraphIcon, 
  GitCompare, 
  UserCheck, 
  AlertOctagon,
  Clock,
  Briefcase,
  Flag,
  FileText,
  Filter,
  CheckSquare,
  TrendingUp,
  MapPin,
  TrendingDown,
  BrainCircuit,
  ListTodo
} from 'lucide-react';

export default function CaseWorkspacePage({ params }: { params: { id: string } }) {
  const caseId = params.id;

  // Nav and Layout state
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // Local Filter settings (Filters Panel - Overhaul 2)
  const [filterTypes, setFilterTypes] = useState<Record<string, boolean>>({
    PERSON: true,
    ORGANIZATION: true,
    LOCATION: true,
    VEHICLE: true,
    BANK_ACCOUNT: true
  });
  const [minConfidence, setMinConfidence] = useState<number>(50);

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

  // 2. Fetch Graph Data
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
      const insightsRes = await fetch(`/api/cases/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ' ' })
      });
      if (insightsRes.ok) {
        const searchData = await insightsRes.json();
        setAllEntities(searchData.entities || []);
      }

      const leadsRes = await fetch(`/api/cases/${caseId}/leads`);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data);
      }

      const resRes = await fetch(`/api/cases/${caseId}/entities/resolve`);
      if (resRes.ok) {
        const data = await resRes.json();
        setResolutions(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCaseData();
    fetchInsightsAndLeads();
  }, [caseId, fetchCaseData, fetchInsightsAndLeads]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Static Insights list mapped from mock DB
  useEffect(() => {
    async function loadStaticInsights() {
      const mockInsights: Insight[] = [
        {
          id: 'INS-001',
          case_id: caseId,
          type: 'POTENTIAL_BRIDGE',
          entity_id: 'P004',
          confidence: 0.91,
          reasons: [
            'Mohd. Rizwan acts as a structural connector between Rohan Mehta and offshore cluster David Miller.',
            'Receives communication link from Rohan\'s phone proxy (PH001).',
            'Directly triggers financial transfer of INR 1.2M to Swiss Account BA003.'
          ],
          evidence_ids: ['CDR-102', 'TXN-9021']
        },
        {
          id: 'INS-002',
          case_id: caseId,
          type: 'FINANCIAL_PATH',
          entity_id: 'P001',
          confidence: 0.96,
          reasons: [
            'Rohan Mehta transferred 500,000 INR to Vikram Malhotra (BA002).',
            'Suspicious offshore transaction of 1,200,000 INR routed via Mohd. Rizwan.'
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
            'Vikram Malhotra and Mohd. Rizwan physically present at Hotel Regal, Pune on Aug 11.'
          ],
          evidence_ids: ['SURV-103']
        }
      ];
      setInsights(mockInsights.filter((i) => i.case_id === caseId));
    }
    loadStaticInsights();
  }, [caseId]);

  // Handle Search Queries
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
        setActiveTab('dashboard'); // Default search maps to workspace
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Copilot Graph Focus callback
  const handleCopilotGraphFocus = (req: NonNullable<CopilotMessage['graph_request']>) => {
    setSeedNodes(req.seed_nodes.join(','));
    setHops(req.hops);
    if (req.highlight_edges) {
      setHighlightedEdges(req.highlight_edges);
    } else {
      setHighlightedEdges([]);
    }
    setActiveTab('dashboard');
  };

  // Handle Entity Resolution Decision Approve/Reject
  const handleResolutionDecision = async (resId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/cases/${caseId}/entities/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionId: resId, decision })
      });
      if (res.ok) {
        fetchInsightsAndLeads();
        fetchGraph();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Lead Status changes
  const handleLeadStatusChange = async (leadId: string, status: Lead['status']) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status })
      });
      if (res.ok) {
        fetchInsightsAndLeads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFocusEntityId = (entId: string) => {
    setSeedNodes(entId);
    setHops(2);
    setHighlightedEdges([]);
    setSelectedNodeId(entId);
    setSelectedEdgeId(null);
    setActiveTab('dashboard');
  };

  const handleSelectEvidenceId = (evId: string) => {
    const matchingRel = mockDB.relationships.find((r) => r.evidence_ids.includes(evId));
    if (matchingRel) {
      setSelectedEdgeId(matchingRel.id);
      setSelectedNodeId(null);
      setActiveTab('dashboard');
    } else {
      setSearchQuery(evId);
      setActiveTab('evidence');
    }
  };

  const handleTypeFilterChange = (type: string) => {
    setFilterTypes((prev) => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Client side filters application based on checkbox and confidence sliders (Overhaul 2)
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => filterTypes[n.type] !== false);
  }, [nodes, filterTypes]);

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => {
      const sourceValid = nodes.find((n) => n.id === e.source && filterTypes[n.type] !== false);
      const targetValid = nodes.find((n) => n.id === e.target && filterTypes[n.type] !== false);
      const confValid = (e.confidence ?? 1.0) >= minConfidence / 100;
      return !!(sourceValid && targetValid && confValid);
    });
  }, [edges, nodes, filterTypes, minConfidence]);

  return (
    <CaseShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      activeCaseId={caseId}
      setActiveCaseId={(id) => {
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
      <div className="w-full h-full flex overflow-hidden">
        
        {/* Render Evidence panel */}
        {activeTab === 'evidence' && (
          <div className="flex-1 h-full overflow-hidden">
            <EvidencePanel
              caseId={caseId}
              onSelectEvidenceId={handleSelectEvidenceId}
            />
          </div>
        )}

        {/* Render printable reports preview */}
        {activeTab === 'report' && (
          <div className="flex-1 h-full overflow-hidden">
            <ReportPreview caseId={caseId} />
          </div>
        )}

        {/* Unified Intelligence Dashboard (activeTab === 'dashboard') */}
        {activeTab !== 'evidence' && activeTab !== 'report' && (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto bg-[#F4F6F9] h-full">
            
            {/* Top Metric Strip (4 Stat Cards) - Overhaul 2 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
              
              {/* Card 1: Active Cases (Blue) */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                    <Briefcase className="text-blue-600" size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech">Active Cases</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">2 Cases</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full font-mono-tech">
                  ↑ 20%
                </span>
              </div>

              {/* Card 2: Flagged Leads (Orange) */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                    <Flag className="text-amber-600" size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech">Flagged Leads</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{leads.length} Leads</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full font-mono-tech">
                  ↑ 12%
                </span>
              </div>

              {/* Card 3: Networks Analyzed (Cyan) */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center border border-cyan-100">
                    <GraphIcon className="text-cyan-600" size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech">Paths Mapped</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{caseObj?.relationship_count || 14} Links</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full font-mono-tech">
                  ↑ 8%
                </span>
              </div>

              {/* Card 4: Evidence Records (Green) */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                    <FileText className="text-emerald-600" size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech">Evidence Records</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{caseObj?.evidence_count || 10} Logs</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full font-mono-tech">
                  ↑ 15%
                </span>
              </div>
            </div>

            {/* Split network & query workspace */}
            <div className="flex-1 flex gap-4 min-h-[460px] overflow-hidden relative">
              
              {/* Left Sub-panel: Filters (Overhaul 2) */}
              <div className="w-60 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4 shrink-0 overflow-y-auto">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Filter size={13} className="text-slate-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-mono-tech">
                    Filter Parameters
                  </h3>
                </div>

                {/* Entity Checklist */}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech block">
                    Entity Types
                  </label>
                  <div className="space-y-1.5">
                    {[
                      { key: 'PERSON', label: 'Person', color: 'bg-[#2563EB]' },
                      { key: 'ORGANIZATION', label: 'Organization', color: 'bg-[#7C3AED]' },
                      { key: 'LOCATION', label: 'Location', color: 'bg-[#0D9488]' },
                      { key: 'VEHICLE', label: 'Vehicle', color: 'bg-[#D97706]' },
                      { key: 'BANK_ACCOUNT', label: 'Account', color: 'bg-[#CA8A04]' }
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center justify-between text-xs font-semibold text-slate-650 cursor-pointer select-none hover:text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${opt.color}`}></span>
                          <span>{opt.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={filterTypes[opt.key] !== false}
                          onChange={() => handleTypeFilterChange(opt.key)}
                          className="w-3.5 h-3.5 border-slate-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Relationship Mode */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech block">
                    Goal Path Mode
                  </label>
                  <select
                    value={goalMode}
                    onChange={(e) => setGoalMode(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-blue-500 text-slate-700 cursor-pointer font-mono-tech"
                  >
                    <option value="all">All Links</option>
                    <option value="financial">Financial Path Mode</option>
                    <option value="telecom">Telecom Mode</option>
                  </select>
                </div>

                {/* Date Bounds */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech block">
                    Communication Dates
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-tech">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded"
                    />
                  </div>
                </div>

                {/* Confidence Slider */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono-tech">
                    <span>Confidence Score</span>
                    <span className="text-blue-600 font-bold">{minConfidence}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Apply Button */}
                <button
                  onClick={fetchGraph}
                  className="w-full py-2 mt-auto rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow transition uppercase font-mono-tech shrink-0"
                >
                  Apply Filters
                </button>
              </div>

              {/* Center Canvas Workspace */}
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative min-w-0">
                <NetworkCanvas
                  nodes={filteredNodes}
                  edges={filteredEdges}
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
              </div>

              {/* Right Details & Copilot Tabbed Drawer (Overhaul 2 - Pinned details pane) */}
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
                caseId={caseId}
                onGraphFocus={handleCopilotGraphFocus}
                onSelectEvidence={handleSelectEvidenceId}
              />
            </div>

            {/* Bottom Intelligence Row (Three-Column Strip) - Overhaul 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 h-64">
              
              {/* Column 1: Timeline overview */}
              <div className="min-w-0">
                <TimelineBar
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndValDate={setEndDate}
                  filteredCount={filteredEdges.length}
                  totalCount={edges.length}
                />
              </div>

              {/* Column 2: AI Insights (Top 3) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 overflow-y-auto min-w-0">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
                  <BrainCircuit size={13} className="text-blue-600 animate-pulse" />
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-mono-tech">
                    Explainable AI Insights
                  </h3>
                </div>

                {insights.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No Insights found.</p>
                ) : (
                  <div className="space-y-3">
                    {insights.slice(0, 3).map((insight) => (
                      <InsightCard
                        key={insight.id}
                        insight={insight}
                        onFocusEntity={handleFocusEntityId}
                        onSelectEvidence={handleSelectEvidenceId}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Column 3: Actionable Leads */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 overflow-y-auto min-w-0">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
                  <ListTodo size={13} className="text-blue-600" />
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-mono-tech">
                    Investigative Leads Queue
                  </h3>
                </div>

                {leads.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No leads listed.</p>
                ) : (
                  <div className="space-y-3">
                    {leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onStatusChange={handleLeadStatusChange}
                        onSelectEvidence={handleSelectEvidenceId}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </CaseShell>
  );
}
