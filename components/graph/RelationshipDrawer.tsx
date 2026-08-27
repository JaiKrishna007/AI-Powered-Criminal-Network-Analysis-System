'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Compass,
  MessageSquare,
  Network
} from 'lucide-react';
import { Entity, Relationship, Evidence } from '@/lib/client-contracts/contracts';
import CopilotPanel from '../copilot/CopilotPanel';

interface RelationshipDrawerProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onClose: () => void;
  onSetSeed: (id: string) => void;
  allEntities: Entity[];
  caseId: string;
  onGraphFocus: (graphRequest: any) => void;
  onSelectEvidence: (evId: string) => void;
}

export default function RelationshipDrawer({
  selectedNodeId,
  selectedEdgeId,
  onClose,
  onSetSeed,
  allEntities,
  caseId,
  onGraphFocus,
  onSelectEvidence
}: RelationshipDrawerProps) {
  const [nodeData, setNodeData] = useState<Entity | null>(null);
  const [edgeData, setEdgeData] = useState<Relationship | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingHashId, setVerifyingHashId] = useState<string | null>(null);
  const [tamperedHashes, setTamperedHashes] = useState<Record<string, boolean>>({});
  
  // Right drawer view selection tabs (Overhaul 3 - Copilot Access)
  const [activeTab, setActiveTab] = useState<'details' | 'copilot'>('details');

  // Fallback default entity (Ravi Kumar/Rohan Mehta) if none selected
  useEffect(() => {
    if (selectedNodeId) {
      const node = allEntities.find((e) => e.id === selectedNodeId);
      if (node) {
        setNodeData(node);
        setEdgeData(null);
        setEvidence([]);
      }
    } else if (!selectedEdgeId) {
      // Default fallback entity (e.g. suspect Rohan Mehta P001)
      const defaultNode = allEntities.find((e) => e.id === 'P001');
      if (defaultNode) {
        setNodeData(defaultNode);
        setEdgeData(null);
        setEvidence([]);
      }
    }
  }, [selectedNodeId, selectedEdgeId, allEntities]);

  useEffect(() => {
    const fetchEdgeDetail = async () => {
      setLoading(true);
      setNodeData(null);
      try {
        const res = await fetch(`/api/relationships/${selectedEdgeId}`);
        if (res.ok) {
          const data = await res.json();
          setEdgeData(data.relationship);
          setEvidence(data.evidence);
        }
      } catch (err) {
        console.error('Failed to fetch edge details', err);
      } finally {
        setLoading(false);
      }
    };

    if (selectedEdgeId) {
      fetchEdgeDetail();
    }
  }, [selectedEdgeId]);

  const sourceNode = edgeData ? allEntities.find((e) => e.id === edgeData.source) : null;
  const targetNode = edgeData ? allEntities.find((e) => e.id === edgeData.target) : null;

  const verifyEvidenceHash = async (evId: string) => {
    setVerifyingHashId(evId);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setVerifyingHashId(null);
  };

  const toggleTamperEvidence = (evId: string) => {
    setTamperedHashes((prev) => ({
      ...prev,
      [evId]: !prev[evId]
    }));
  };

  // Mock Connections List for selected entity details (Overhaul 2)
  const entityConnections = React.useMemo(() => {
    if (!nodeData) return [];
    if (nodeData.id === 'P001') {
      return [
        { name: 'Vikram Malhotra', role: 'PH002', count: 8, label: 'calls' },
        { name: 'Mohd. Rizwan', role: 'BA001', count: 4, label: 'transferred' },
        { name: 'Aarti Shah', role: 'PH001', count: 5, label: 'calls' }
      ];
    }
    return [
      { name: 'Rohan Mehta', role: 'PH001', count: 3, label: 'calls' }
    ];
  }, [nodeData]);

  // Mock Evidence list with category icons and timestamps (Overhaul 2)
  const recentEvidenceFiles = React.useMemo(() => {
    if (!nodeData) return [];
    return [
      { id: 'CDR-1045.pdf', category: 'Call Detail Record', time: '2026-08-12 14:31:00 UTC' },
      { id: 'TXN-88421.pdf', category: 'Bank Ledger Document', time: '2026-08-11 11:20:00 UTC' }
    ];
  }, [nodeData]);

  return (
    /* Slide-over responsive CSS animation class (Overhaul 2 - Responsive Drawer) */
    <div className="absolute lg:relative top-0 right-0 w-80 h-full bg-white border-l border-slate-200 shadow-xl lg:shadow-none flex flex-col z-20 shrink-0 select-none transition-transform duration-300">
      
      {/* Tab selection toggle header */}
      <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-b-2 flex items-center justify-center gap-1.5 transition ${
            activeTab === 'details' 
              ? 'border-blue-650 text-blue-600 bg-white font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Compass size={12} />
          <span>Inspector Details</span>
        </button>
        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-b-2 flex items-center justify-center gap-1.5 transition ${
            activeTab === 'copilot' 
              ? 'border-blue-650 text-blue-600 bg-white font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare size={12} />
          <span>Copilot Chat</span>
        </button>
        <button 
          onClick={onClose}
          className="p-3 text-slate-400 hover:text-slate-700 transition hover:bg-slate-100"
          title="Minimize details panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Toggle View Area */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {activeTab === 'copilot' ? (
          /* Copilot chat vector assistant */
          <div className="flex-1 h-full flex flex-col">
            <CopilotPanel
              caseId={caseId}
              onGraphFocus={onGraphFocus}
              onSelectEvidence={onSelectEvidence}
            />
          </div>
        ) : (
          /* Inspector details view */
          <div className="p-4 space-y-4 flex-1">
            {loading ? (
              <div className="space-y-3 pt-4">
                <div className="h-5 w-3/4 rounded bg-slate-100 animate-pulse"></div>
                <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse"></div>
                <div className="h-24 rounded bg-slate-100 animate-pulse"></div>
              </div>
            ) : nodeData ? (
              // Node Inspector
              <div className="space-y-4">
                <div>
                  <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono-tech">
                    {nodeData.type.replace('_', ' ')}
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 mt-2">{nodeData.canonical_name}</h2>
                  {nodeData.aliases && nodeData.aliases.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Aliases: <span className="text-slate-700 font-mono-tech">{nodeData.aliases.join(', ')}</span>
                    </p>
                  )}
                </div>

                {/* Horizontal Teal Confidence bar */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 font-mono-tech">
                    <span>CONFIDENCE INDEX</span>
                    <span className="text-[#0D9488]">91%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-[#0D9488] rounded-full" style={{ width: '91%' }} />
                  </div>
                </div>

                {/* Metadata List */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 font-mono-tech">
                    ENTITY_PROPERTIES
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[8.5px] text-slate-400 font-bold uppercase font-mono-tech">ENTITY_ID</p>
                      <p className="font-bold font-mono-tech text-slate-800">{nodeData.id}</p>
                    </div>
                    {nodeData.phone_value && (
                      <div>
                        <p className="text-[8.5px] text-slate-400 font-bold uppercase font-mono-tech">PHONE_VALUE</p>
                        <p className="font-semibold font-mono-tech text-slate-700">{nodeData.phone_value}</p>
                      </div>
                    )}
                    {nodeData.account_number && (
                      <div>
                        <p className="text-[8.5px] text-slate-400 font-bold uppercase font-mono-tech">ACCOUNT_NUMBER</p>
                        <p className="font-semibold font-mono-tech text-slate-700">{nodeData.account_number}</p>
                      </div>
                    )}
                    {nodeData.plate_number && (
                      <div>
                        <p className="text-[8.5px] text-slate-400 font-bold uppercase font-mono-tech">PLATE_NUMBER</p>
                        <p className="font-semibold font-mono-tech text-slate-700">{nodeData.plate_number}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top connections list */}
                <div className="space-y-2.5">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono-tech">
                    TOP_CONNECTIONS
                  </h4>
                  <div className="space-y-1.5">
                    {entityConnections.map((conn, idx) => (
                      <div key={idx} className="p-2.5 rounded border border-slate-200 bg-white flex items-center justify-between text-xs shadow-sm">
                        <div>
                          <p className="font-bold text-slate-800">{conn.name}</p>
                          <p className="text-[8.5px] text-slate-400 font-mono-tech mt-0.5">{conn.role}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full font-mono-tech">
                            {conn.count}x {conn.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Evidence Files card */}
                <div className="space-y-2.5">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono-tech">
                    RECENT_EVIDENCE
                  </h4>
                  <div className="space-y-2">
                    {recentEvidenceFiles.map((file, idx) => (
                      <div key={idx} className="p-2.5 rounded border border-slate-200 bg-white space-y-1 text-xs shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 font-mono-tech">{file.id}</span>
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-mono-tech">
                            {file.category}
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-400 font-mono-tech">{file.time}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => onSetSeed(nodeData.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
                >
                  <Plus size={12} />
                  <span>Use as Seed Node</span>
                </button>
              </div>
            ) : edgeData ? (
              // Edge Inspector
              <div className="space-y-4">
                <div>
                  <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono-tech">
                    {edgeData.type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1.5 mt-2 font-bold text-xs text-slate-800">
                    <span className="truncate max-w-[100px]">{sourceNode?.canonical_name || edgeData.source}</span>
                    <ArrowRight size={12} className="text-slate-450 shrink-0" />
                    <span className="truncate max-w-[100px]">{targetNode?.canonical_name || edgeData.target}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 font-mono-tech">
                    LINK_PARAMETERS
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    {edgeData.amount && (
                      <div className="col-span-2 border-b border-slate-200 pb-2">
                        <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">TRANSACTION_VALUE</p>
                        <p className="text-sm font-bold text-emerald-600 font-mono-tech">
                          INR {edgeData.amount.toLocaleString()}
                        </p>
                      </div>
                    )}
                    {edgeData.timestamp && (
                      <div className="col-span-2">
                        <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">TIMESTAMP</p>
                        <p className="font-semibold text-slate-800 font-mono-tech text-[9.5px]">
                          {edgeData.timestamp}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">PROBABILITY</p>
                      <p className="font-semibold text-slate-700 font-mono-tech">
                        {edgeData.confidence ? `${(edgeData.confidence * 100).toFixed(0)}%` : '100%'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Evidence trails */}
                <div className="space-y-3">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono-tech">
                    EVIDENCE_TRAILS ({evidence.length})
                  </h4>
                  <div className="space-y-3">
                    {evidence.map((ev) => {
                      const isTampered = !!tamperedHashes[ev.id];
                      const integrity = isTampered ? 'HASH_MISMATCH' : 'VERIFIED';
                      
                      return (
                        <div key={ev.id} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="font-bold text-slate-850 font-mono-tech">{ev.id}</span>
                            <span className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1 rounded-sm font-mono-tech">
                              {ev.source_type}
                            </span>
                          </div>

                          {ev.content && (
                            <div className="p-2 rounded bg-slate-50 border border-slate-100 font-mono-tech text-[8px] text-slate-500 whitespace-pre-wrap select-text leading-relaxed">
                              "{ev.content}"
                            </div>
                          )}

                          <p className="text-[8px] text-slate-400 font-mono-tech">
                            Path: {ev.source_ref}
                          </p>

                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            <div className="flex items-center justify-between text-[8px] text-slate-500 uppercase tracking-wider font-bold font-mono-tech">
                              <span>Digests (SHA-255)</span>
                              {integrity === 'VERIFIED' ? (
                                <span className="text-emerald-600 flex items-center gap-0.5">
                                  Verified
                                </span>
                              ) : (
                                <span className="text-rose-600 flex items-center gap-0.5 animate-pulse">
                                  TAMPERED
                                </span>
                              )}
                            </div>
                            
                            <p className="text-[8px] font-mono-tech text-slate-500 bg-slate-50 border border-slate-200 p-1 rounded break-all select-all">
                              {isTampered ? '01928038102930281039281039210293810293810293810293810' : ev.sha256}
                            </p>

                            <div className="flex gap-1.5 pt-1 font-mono-tech">
                              <button
                                onClick={() => verifyEvidenceHash(ev.id)}
                                disabled={verifyingHashId === ev.id}
                                className="flex-1 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-300 text-[9px] text-slate-650 transition"
                              >
                                {verifyingHashId === ev.id ? 'Audit...' : 'Verify Signature'}
                              </button>
                              <button
                                onClick={() => toggleTamperEvidence(ev.id)}
                                className={`px-2 py-1 rounded text-[9px] border transition ${
                                  isTampered 
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
                                    : 'bg-slate-50 border-slate-300 text-slate-450 hover:text-slate-600'
                                }`}
                              >
                                {isTampered ? 'Clear' : 'Tamper'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
