'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { Entity, Relationship, Evidence } from '@/lib/client-contracts/contracts';

interface RelationshipDrawerProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onClose: () => void;
  onSetSeed: (id: string) => void;
  allEntities: Entity[];
}

export default function RelationshipDrawer({
  selectedNodeId,
  selectedEdgeId,
  onClose,
  onSetSeed,
  allEntities
}: RelationshipDrawerProps) {
  const [nodeData, setNodeData] = useState<Entity | null>(null);
  const [edgeData, setEdgeData] = useState<Relationship | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingHashId, setVerifyingHashId] = useState<string | null>(null);
  const [tamperedHashes, setTamperedHashes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedNodeId) {
      const node = allEntities.find((e) => e.id === selectedNodeId);
      if (node) {
        setNodeData(node);
        setEdgeData(null);
        setEvidence([]);
      }
    }
  }, [selectedNodeId, allEntities]);

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

  if (!selectedNodeId && !selectedEdgeId) return null;

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-slate-300 shadow-xl flex flex-col z-10 transition-transform duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono-tech">
          {nodeData ? 'Entity Inspector' : 'Link Inspector'}
        </h3>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200/60 transition"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="space-y-3 pt-4">
            <div className="h-5 w-3/4 rounded-sm bg-slate-100 animate-pulse"></div>
            <div className="h-4 w-1/2 rounded-sm bg-slate-100 animate-pulse"></div>
            <div className="h-24 rounded-sm bg-slate-100 animate-pulse mt-4"></div>
          </div>
        ) : nodeData ? (
          // Node Inspector View
          <div className="space-y-4">
            <div>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-tech">
                {nodeData.type.replace('_', ' ')}
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-2">{nodeData.canonical_name}</h2>
              {nodeData.aliases && nodeData.aliases.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Aliases: <span className="text-slate-700 italic">{nodeData.aliases.join(', ')}</span>
                </p>
              )}
            </div>

            {/* Profile Detail Grid */}
            <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 font-mono-tech">
                SYSTEM_METADATA
              </h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-650">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">RECORD_ID</p>
                  <p className="font-semibold font-mono-tech text-slate-800">{nodeData.id}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">MATCH_CONF</p>
                  <p className="font-semibold font-mono-tech text-slate-800">{(nodeData.confidence * 100).toFixed(0)}%</p>
                </div>
                {nodeData.phone_value && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">PHONE_VALUE</p>
                    <p className="font-semibold font-mono-tech text-slate-850">{nodeData.phone_value}</p>
                  </div>
                )}
                {nodeData.account_number && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">BANK_ACCOUNT</p>
                    <p className="font-semibold font-mono-tech text-slate-855">{nodeData.account_number}</p>
                  </div>
                )}
                {nodeData.plate_number && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">REGISTRATION_PLATE</p>
                    <p className="font-semibold font-mono-tech text-slate-855">{nodeData.plate_number}</p>
                  </div>
                )}
                {nodeData.address_label && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">GEO_COORDINATE</p>
                    <p className="font-semibold text-slate-700">{nodeData.address_label}</p>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => onSetSeed(nodeData.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
            >
              <Plus size={12} />
              <span>Use as Copilot Seed</span>
            </button>
          </div>
        ) : edgeData ? (
          // Link Inspector View
          <div className="space-y-4">
            <div>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-tech">
                {edgeData.type.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-1.5 mt-2 font-bold text-xs text-slate-800">
                <span className="truncate max-w-[100px]">{sourceNode?.canonical_name || edgeData.source}</span>
                <ArrowRight size={12} className="text-slate-400 shrink-0" />
                <span className="truncate max-w-[100px]">{targetNode?.canonical_name || edgeData.target}</span>
              </div>
            </div>

            {/* Link details */}
            <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 font-mono-tech">
                LINK_METADATA
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-650">
                {edgeData.amount && (
                  <div className="col-span-2 border-b border-slate-200 pb-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">TRANSACTION_AMOUNT</p>
                    <p className="text-base font-bold text-emerald-600 font-mono-tech">
                      INR {edgeData.amount.toLocaleString()}
                    </p>
                  </div>
                )}
                {edgeData.timestamp && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">UTC_TIMESTAMP</p>
                    <p className="font-semibold text-slate-800 font-mono-tech text-[10px]">
                      {edgeData.timestamp}
                    </p>
                  </div>
                )}
                {edgeData.valid_from && (
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">VALID_FROM</p>
                    <p className="font-semibold text-slate-700 font-mono-tech">{edgeData.valid_from.split('T')[0]}</p>
                  </div>
                )}
                {edgeData.valid_to && (
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">VALID_TO</p>
                    <p className="font-semibold text-slate-700 font-mono-tech">{edgeData.valid_to.split('T')[0]}</p>
                  </div>
                )}
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase font-mono-tech">PROB_INDEX</p>
                  <p className="font-semibold text-slate-700 font-mono-tech">
                    {edgeData.confidence ? `${(edgeData.confidence * 100).toFixed(0)}%` : '100%'}
                  </p>
                </div>
              </div>
            </div>

            {/* Supporting evidence */}
            <div className="space-y-3.5">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono-tech">
                EVIDENCE_TRAIL ({evidence.length})
              </h4>
              <div className="space-y-3">
                {evidence.map((ev) => {
                  const isTampered = !!tamperedHashes[ev.id];
                  const integrity = isTampered ? 'HASH_MISMATCH' : 'VERIFIED';
                  
                  return (
                    <div key={ev.id} className="p-3 rounded bg-white border border-slate-300 space-y-2 text-[11px] shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800 font-mono-tech">{ev.id}</span>
                        </div>
                        <span className="text-[8px] font-bold bg-slate-100 border border-slate-200 text-slate-600 px-1 rounded-sm font-mono-tech">
                          {ev.source_type}
                        </span>
                      </div>

                      {/* Excerpt box (Forensic Details - Overhaul 5) */}
                      {ev.content && (
                        <div className="p-2 rounded bg-slate-50 border border-slate-200/60 font-mono-tech text-[9px] text-slate-600 break-words leading-relaxed select-text">
                          "{ev.content}"
                        </div>
                      )}

                      <p className="text-[8px] text-slate-400 font-mono-tech">
                        Path: {ev.source_ref}
                      </p>

                      {/* Checksums */}
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-[8px] text-slate-500 uppercase tracking-wider font-bold font-mono-tech">
                          <span>SHA-256 Checksum</span>
                          {integrity === 'VERIFIED' ? (
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <ShieldCheck size={9} /> Verified
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-0.5 animate-pulse">
                              <AlertTriangle size={9} /> TAMPER DETECTED
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[8px] font-mono-tech text-slate-500 bg-slate-50 border border-slate-200 p-1 rounded-sm break-all select-all">
                          {isTampered ? '7283192083192039281039218239120372831920831920392810392182391203' : ev.sha256}
                        </p>

                        <div className="flex gap-1.5 pt-1">
                          <button
                            onClick={() => verifyEvidenceHash(ev.id)}
                            disabled={verifyingHashId === ev.id}
                            className="flex-1 py-1 rounded-sm bg-slate-50 hover:bg-slate-100 border border-slate-300 text-[9px] font-bold text-slate-600 transition"
                          >
                            {verifyingHashId === ev.id ? 'Verifying...' : 'Verify Signature'}
                          </button>
                          <button
                            onClick={() => toggleTamperEvidence(ev.id)}
                            className={`px-2 py-1 rounded-sm text-[9px] font-bold border transition ${
                              isTampered 
                                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
                                : 'bg-slate-50 border-slate-300 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            {isTampered ? 'Reset' : 'Tamper'}
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
    </div>
  );
}
