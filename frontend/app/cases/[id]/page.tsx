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
import { d2 } from '@/src/api/d2';
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

  // Settings UI states
  const [showSettings, setShowSettings] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editClassification, setEditClassification] = useState<any>('CASE_RESTRICTED');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Sync edits state when caseObj changes
  useEffect(() => {
    if (caseObj) {
      setEditTitle(caseObj.title);
      setEditClassification(caseObj.classification);
    }
  }, [caseObj]);

  const handleSaveChanges = async () => {
    if (!editTitle.trim()) {
      setSettingsError('Title is required.');
      return;
    }
    setSettingsError('');
    setSettingsSuccess(false);
    try {
      await d2.cases.update(caseId, {
        title: editTitle.trim(),
        classification: editClassification
      });
      setSettingsSuccess(true);
      fetchCaseData(); // Refresh case page details
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to save settings.');
    }
  };

  const handleCloseCase = async () => {
    const confirm = window.confirm('Are you sure you want to CLOSE this investigation? The workspace will become read-only.');
    if (!confirm) return;

    setSettingsError('');
    setSettingsSuccess(false);
    try {
      await d2.cases.update(caseId, { status: 'CLOSED' });
      setSettingsSuccess(true);
      fetchCaseData(); // Refresh case details
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to close case.');
    }
  };

  const handleArchiveCase = async () => {
    const confirm = window.confirm('Are you sure you want to ARCHIVE this case? It will be hidden from default case views.');
    if (!confirm) return;

    setSettingsError('');
    setSettingsSuccess(false);
    try {
      await d2.cases.update(caseId, { status: 'ARCHIVED' });
      setSettingsSuccess(true);
      fetchCaseData(); // Refresh case details
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to archive case.');
    }
  };

  // Graph state
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
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
  const [allEntities, setAllEntities] = useState<any[]>([]);

  // 1. Fetch Case Details & Core Metadata
  const fetchCaseData = useCallback(async () => {
    try {
      const res = await d2.cases.get(caseId);
      if (res && res.case) {
        setCaseObj(res.case);
      }
    } catch (err) {
      console.error(err);
    }
  }, [caseId]);

  // 2. Fetch Graph Data (FE-02 / FE-03 / FE-05)
  const fetchGraph = useCallback(async () => {
    try {
      const data = await d2.graph.getFocused(caseId, {
        seed: seedNodes,
        hops,
        validFrom: `${startDate}T00:00:00Z`,
        validTo: `${endDate}T23:59:59Z`,
        goal: goalMode
      });
      if (data) {
        setNodes(data.nodes);
        setEdges(data.edges);
        setTruncated(data.meta?.truncated || false);
      }
    } catch (err) {
      console.error(err);
    }
  }, [caseId, seedNodes, hops, startDate, endDate, goalMode]);

  // 3. Fetch Insights, Leads & Entity Resolutions
  const fetchInsightsAndLeads = useCallback(async () => {
    try {
      // Insights
      const searchData = await d2.cases.search(caseId, ' ');
      if (searchData) {
        setAllEntities(searchData.entities || []);
      }

      // Leads (GET mapping to d2 POST for now)
      const data = await d2.cases.generateLeads(caseId, {});
      if (data && data.leads) {
        setLeads(data.leads);
      }

      // Resolutions
      const resData = await d2.cases.getResolutions(caseId);
      if (resData) {
        setResolutions(resData);
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
          id: 'INS-01',
          case_id: caseId,
          type: 'POTENTIAL_BRIDGE',
          target_entity_ids: ['P004'],
          confidence: 0.91,
          content: 'Mohd. Rizwan acts as a structural connector between the primary suspect cluster (Rohan Mehta) and the offshore fund cluster (David Miller).',
          description: 'Identified a critical bridge node connecting two distinct clusters.',
          evidence_ids: ['CDR-102', 'TXN-9021', 'DIR-103']
        },
        {
          id: 'INS-002',
          case_id: caseId,
          type: 'FINANCIAL_PATH',
          target_entity_ids: ['P001'],
          confidence: 0.96,
          content: 'Identified high-velocity transaction trail. Pattern matches offshore shell-company diversion techniques.',
          evidence_ids: ['TXN-8819', 'TXN-9021']
        },
        {
          id: 'INS-003',
          case_id: caseId,
          type: 'CO_LOCATION',
          target_entity_ids: ['P002'],
          confidence: 0.85,
          content: 'Vikram Malhotra and Mohd. Rizwan physically present at the same location (Hotel Regal, Pune) on 2026-08-11T18:00:00Z. Corresponds to surveillance reports and CCTV footage logs.',
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
      const searchData = await d2.cases.search(caseId, query);
      if (searchData) {
        setSearchResults(searchData);
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
      await d2.cases.resolveEntity(caseId, resId, decision);
      // Refresh local views & rebuild graph to include new aliases
      fetchInsightsAndLeads();
      fetchGraph();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Lead Status changes (FE-07)
  const handleLeadStatusChange = async (leadId: string, status: Lead['status']) => {
    try {
      await d2.cases.generateLeads(caseId, { leadId, status });
      // Reload leads list
      fetchInsightsAndLeads();
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
    const matchingRel = edges.find((r) => r.evidence_ids?.includes(evId));
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F4F6F9]">
              
              {/* Search Results Display (FE-01) */}
              {searchResults ? (
                <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      Search results for "{searchResults.query}"
                    </h3>
                    <button 
                      onClick={() => setSearchResults(null)}
                      className="text-xs text-slate-500 hover:text-slate-700 font-bold"
                    >
                      Clear Search
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Matched Entities */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 mb-3">Matched Entities ({searchResults.entities?.length || 0})</h4>
                      {searchResults.entities?.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No entities match query.</p>
                      ) : (
                        <div className="space-y-2">
                          {searchResults.entities.map((e: Entity) => (
                            <button
                              key={e.id}
                              onClick={() => handleFocusEntityId(e.id)}
                              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-350 text-left transition shadow-sm"
                            >
                              <span className="text-xs font-bold text-slate-700">{e.name}</span>
                              <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">{e.type}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Matched Evidence */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 mb-3">Matched Evidence ({searchResults.evidence?.length || 0})</h4>
                      {searchResults.evidence?.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No evidence artifacts match query.</p>
                      ) : (
                        <div className="space-y-2">
                          {searchResults.evidence.map((e: any) => (
                            <button
                              key={e.id}
                              onClick={() => {
                                handleSelectEvidenceId(e.id);
                              }}
                              className="w-full flex flex-col gap-1 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-350 text-left transition shadow-sm"
                            >
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>{e.id}</span>
                                <span className="text-[8px] bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold">{e.source_type}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 truncate mt-1">{e.content}</p>
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
                  
                  {/* Top compact KPI Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* KPI 1 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Case Status</span>
                      <span className={`text-xs font-bold flex items-center gap-1.5 ${
                        caseObj?.status === 'ACTIVE' ? 'text-emerald-700' : caseObj?.status === 'CLOSED' ? 'text-amber-700' : 'text-slate-500'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          caseObj?.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : caseObj?.status === 'CLOSED' ? 'bg-amber-500' : 'bg-slate-400'
                        }`}></span>
                        {caseObj?.status || 'UNKNOWN'}
                      </span>
                    </div>
                    {/* KPI 2 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-sans">Flagged Leads</span>
                      <span className="text-sm font-extrabold text-slate-700 font-mono">
                        {leads.filter(l => l.priority === 'HIGH').length} / {leads.length}
                      </span>
                    </div>
                    {/* KPI 3 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Resolved Entities</span>
                      <span className="text-sm font-extrabold text-slate-700 font-mono">
                        {(caseObj as any)?.entity_count || 0}
                      </span>
                    </div>
                    {/* KPI 4 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Evidence Records</span>
                      <span className="text-sm font-extrabold text-slate-700 font-mono">
                        {(caseObj as any)?.evidence_count || 0}
                      </span>
                    </div>
                  </div>

                  {/* Case brief header card / Context Card */}
                  {caseObj && (
                    <div className="p-6 rounded-xl bg-white border border-slate-200 flex flex-col gap-4 relative overflow-hidden shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-widest">
                            {caseObj.classification.replace('_', ' ')}
                          </span>
                          <h2 className="text-lg font-black text-slate-800 tracking-wide mt-3">
                            {caseObj.title}
                          </h2>
                        </div>
                        <button
                          onClick={() => {
                            setSettingsError('');
                            setSettingsSuccess(false);
                            setShowSettings(!showSettings);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs font-bold transition shadow-sm"
                        >
                          {showSettings ? 'Hide Settings' : 'Case Settings'}
                        </button>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                          {caseObj.description || 'No description provided.'}
                        </p>
                      </div>

                      {showSettings && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4 text-xs">
                          <div className="space-y-1">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Workspace Management Settings
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              Edit case title, classification, or transition workspace status.
                            </p>
                          </div>
                          
                          {settingsError && (
                            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                              {settingsError}
                            </div>
                          )}

                          {settingsSuccess && (
                            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                              Case settings updated successfully.
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Title edit */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Case Title</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                disabled={caseObj.status !== 'ACTIVE'}
                                className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                              />
                            </div>

                            {/* Classification edit */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Classification</label>
                              <select
                                value={editClassification}
                                onChange={(e) => setEditClassification(e.target.value as any)}
                                disabled={caseObj.status !== 'ACTIVE'}
                                className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                              >
                                <option value="PUBLIC">PUBLIC</option>
                                <option value="CASE_RESTRICTED">CASE RESTRICTED</option>
                                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                                <option value="SECRET">SECRET</option>
                              </select>
                            </div>
                          </div>

                          {/* Lifecycle action buttons */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                            <div className="flex gap-2">
                              {caseObj.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  onClick={handleCloseCase}
                                  className="px-3.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-bold text-[10px] transition"
                                >
                                  Close Workspace
                                </button>
                              )}
                              
                              {caseObj.status === 'CLOSED' && (
                                <button
                                  type="button"
                                  onClick={handleArchiveCase}
                                  className="px-3.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition"
                                >
                                  Archive Case
                                </button>
                              )}

                              {caseObj.status === 'ARCHIVED' && (
                                <span className="text-[10px] italic text-slate-400 font-bold">
                                  Workspace is archived and read-only.
                                </span>
                              )}
                            </div>

                            {caseObj.status === 'ACTIVE' && (
                              <button
                                type="button"
                                onClick={handleSaveChanges}
                                className="px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-[10px] transition shadow-sm"
                              >
                                Save Changes
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Compact Case Context Details panel details */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-4 mt-2">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Case Identifier</span>
                          <span className="font-bold text-slate-700 font-mono">{caseObj.id}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Classification</span>
                          <span className="font-bold text-blue-700">{caseObj.classification.replace('_', ' ')}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Created Date</span>
                          <span className="font-bold text-slate-600 font-mono">2026-08-10 UTC</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Lead Investigators</span>
                          <span className="font-bold text-slate-600">Arash (USR-201)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Entity Resolution Queue (FE-T03 / FE-07) */}
                  <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <GitCompare size={16} className="text-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Entity Resolution Verification Queue ({resolutions.filter((r) => r.status === 'CANDIDATE').length})
                      </h3>
                    </div>

                    {resolutions.filter((r) => r.status === 'CANDIDATE').length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No candidates awaiting review.</p>
                    ) : (
                      <div className="space-y-4">
                        {resolutions.filter((r) => r.status === 'CANDIDATE').map((res) => (
                          <div 
                            key={res.id}
                            className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded font-bold">
                                Similarity Confidence: {Math.round(res.confidence * 100)}%
                              </span>
                              <span className="text-[8px] font-mono text-slate-400">ID: {res.id}</span>
                            </div>

                            {/* Candidate Names comparison */}
                            <div className="flex items-center gap-6 justify-center py-2 border-y border-slate-200 bg-white rounded-lg">
                              <div className="text-center w-36">
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Canonical Profile</p>
                                <p className="font-bold text-slate-800 mt-1">{res.original.canonical_name}</p>
                                <p className="text-[8px] text-slate-400 font-mono mt-0.5">ID: {res.original.id}</p>
                              </div>
                              <div className="px-3.5 py-1 rounded bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500">
                                Match?
                              </div>
                              <div className="text-center w-36">
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Extracted Candidate</p>
                                <p className="font-bold text-blue-600 mt-1">{res.candidate.canonical_name}</p>
                                <p className="text-[8px] text-slate-400 font-mono mt-0.5">aka: {res.candidate.aliases.join(', ')}</p>
                              </div>
                            </div>

                            {/* Contributing signals lists */}
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Similarity Rationale:</p>
                              <ul className="list-disc pl-4 text-[10px] text-slate-500 space-y-0.5">
                                {res.reasons.map((reason: string, i: number) => (
                                  <li key={i} className="leading-snug">{reason}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Actions review buttons */}
                            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                              <button
                                onClick={() => handleResolutionDecision(res.id, 'REJECTED')}
                                className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold transition text-[10px]"
                              >
                                Reject Merge
                              </button>
                              <button
                                onClick={() => handleResolutionDecision(res.id, 'ACCEPTED')}
                                className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold transition shadow-sm text-[10px]"
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
              <div className="absolute top-4 right-4 z-10 flex gap-1.5 p-1 rounded-lg bg-white/95 border border-slate-200 backdrop-blur-md shadow-sm">
                <button
                  onClick={() => setGoalMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                    goalMode === 'all' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  All Links
                </button>
                <button
                  onClick={() => setGoalMode('financial')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                    goalMode === 'financial' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Financial Path Mode
                </button>
                <button
                  onClick={() => setGoalMode('telecom')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                    goalMode === 'telecom' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Telecom Mode
                </button>
              </div>

              {/* Seed Node Clear/Indicator badge */}
              {seedNodes && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-sm">
                  <GraphIcon size={14} className="shrink-0 text-blue-600" />
                  <span>Focused Subgraph (Seeds: {seedNodes})</span>
                  <button 
                    onClick={() => {
                      setSeedNodes('');
                      setHighlightedEdges([]);
                    }}
                    className="text-[9px] uppercase tracking-wider text-blue-700 hover:text-blue-900 ml-2 bg-blue-100/50 px-1.5 py-0.5 rounded border border-blue-200 font-bold transition"
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
            <div className="flex-1 flex flex-col p-6 gap-6 min-h-0 bg-[#F4F6F9]">
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
                  totalCount={edges.length}
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F4F6F9]">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <BrainCircuit className="text-[#2563EB]" />
                  Explainable AI (XAI) Insight Index
                </h2>
                <p className="text-xs text-slate-500 mt-1">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F4F6F9]">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ListTodo className="text-[#2563EB]" />
                  Advisory Investigative Lead Recommendations
                </h2>
                <p className="text-xs text-slate-500 mt-1">
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
