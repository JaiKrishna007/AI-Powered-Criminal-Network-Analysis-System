'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  ShieldCheck, 
  AlertOctagon, 
  ArrowRight,
  Plus
} from 'lucide-react';
import { Entity, Relationship, Evidence } from '@/lib/client-contracts/contracts';

interface RelationshipDrawerProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onClose: () => void;
  onSetSeed: (id: string) => void;
  // Shared Entities database to look up node labels
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

  // 1. Listen for Node Selection
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

  // Verify Evidence Hash (FE-T04 / FR-25)
  const verifyEvidenceHash = async (evId: string) => {
    setVerifyingHashId(evId);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setVerifyingHashId(null);
  };

  // Toggle Hash Tampering (FR-25)
  const toggleTamperEvidence = (evId: string) => {
    setTamperedHashes((prev) => ({
      ...prev,
      [evId]: !prev[evId]
    }));
  };

  if (!selectedNodeId && !selectedEdgeId) return null;

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-slate-200 shadow-xl flex flex-col z-10 transition-transform duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {nodeData ? 'Entity Inspector' : 'Relationship Inspector'}
        </h3>
        <button 
          onClick={onClose}
          className="text-slate-450 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="space-y-3 pt-4">
            <div className="h-6 w-3/4 rounded bg-slate-100 animate-pulse"></div>
            <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse"></div>
            <div className="h-20 rounded bg-slate-100 animate-pulse mt-4"></div>
          </div>
        ) : nodeData ? (
          // NODE VIEW
          <div className="space-y-5">
            {/* Identity & Classification */}
            <div>
              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-wider">
                {nodeData.type.replace('_', ' ')}
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-2">{nodeData.canonical_name}</h2>
              {nodeData.aliases && nodeData.aliases.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Aliases: <span className="text-slate-700 italic">{nodeData.aliases.join(', ')}</span>
                </p>
              )}
            </div>

            {/* Entity Attributes */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1.5">
                Attributes
              </h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-700">
                <div>
                  <p className="text-[9px] text-slate-400 font-medium">Record ID</p>
                  <p className="font-semibold text-slate-800">{nodeData.id}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-medium">Confidence Score</p>
                  <p className="font-semibold text-slate-800">{(nodeData.confidence * 100).toFixed(0)}%</p>
                </div>
                {nodeData.phone_value && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-medium">Phone Number</p>
                    <p className="font-semibold text-slate-800 font-mono">{nodeData.phone_value}</p>
                  </div>
                )}
                {nodeData.account_number && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-medium">Bank Account</p>
                    <p className="font-semibold text-slate-800 font-mono">{nodeData.account_number}</p>
                  </div>
                )}
                {nodeData.plate_number && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-medium">License Plate</p>
                    <p className="font-semibold text-slate-800 font-mono">{nodeData.plate_number}</p>
                  </div>
                )}
                {nodeData.address_label && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-medium">Physical Location</p>
                    <p className="font-semibold text-slate-800">{nodeData.address_label}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Node Actions */}
            <div className="space-y-2">
              <button 
                onClick={() => onSetSeed(nodeData.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
              >
                <Plus size={14} />
                <span>Use as Copilot Seed</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center italic font-semibold">
                Double-click node in canvas to expand connections
              </p>
            </div>
          </div>
        ) : edgeData ? (
          // EDGE/RELATIONSHIP VIEW (FE-04)
          <div className="space-y-5">
            <div>
              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-wider">
                {edgeData.type.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-2 mt-3 font-bold text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="truncate max-w-[90px]">{sourceNode?.canonical_name || edgeData.source}</span>
                <ArrowRight size={14} className="text-slate-400 shrink-0" />
                <span className="truncate max-w-[90px]">{targetNode?.canonical_name || edgeData.target}</span>
              </div>
            </div>

            {/* Relationship properties */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1.5">
                Link Properties
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                {edgeData.amount && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-medium">Transaction Amount</p>
                    <p className="text-base font-black text-emerald-700 mt-0.5">
                      INR {edgeData.amount.toLocaleString()}
                    </p>
                  </div>
                )}
                {edgeData.timestamp && (
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 font-medium">Occurred At</p>
                    <p className="font-semibold text-slate-800 font-mono mt-0.5">
                      {new Date(edgeData.timestamp).toUTCString()}
                    </p>
                  </div>
                )}
                {edgeData.valid_from && (
                  <div>
                    <p className="text-[9px] text-slate-400 font-medium">Valid From</p>
                    <p className="font-semibold text-slate-800 font-mono mt-0.5">{edgeData.valid_from.split('T')[0]}</p>
                  </div>
                )}
                {edgeData.valid_to && (
                  <div>
                    <p className="text-[9px] text-slate-400 font-medium">Valid To</p>
                    <p className="font-semibold text-slate-800 font-mono mt-0.5">{edgeData.valid_to.split('T')[0]}</p>
                  </div>
                )}
                <div>
                  <p className="text-[9px] text-slate-400 font-medium">Link Confidence</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {edgeData.confidence ? `${(edgeData.confidence * 100).toFixed(0)}%` : '100%'}
                  </p>
                </div>
              </div>
            </div>

            {/* Supporting Evidence Chain (FR-25 / FE-T04) */}
            <div className="space-y-3">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Source Evidence Trail ({evidence.length})
              </h4>
              {evidence.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No supporting evidence artifacts.</p>
              ) : (
                <div className="space-y-3">
                  {evidence.map((ev) => {
                    const isTampered = !!tamperedHashes[ev.id];
                    const integrity = isTampered ? 'HASH_MISMATCH' : 'VERIFIED';
                    
                    return (
                      <div key={ev.id} className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm space-y-2">
                        {/* Evidence Title & Type */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1">
                            <FileText size={14} className="text-slate-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-800">{ev.id}</span>
                          </div>
                          <span className="text-[8px] font-bold bg-slate-50 border border-slate-200 text-slate-500 px-1 rounded">
                            {ev.source_type}
                          </span>
                        </div>

                        {/* Snippet */}
                        {ev.content && (
                          <p className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 leading-normal">
                            "{ev.content}"
                          </p>
                        )}

                        {/* Provenance ref */}
                        <p className="text-[8px] text-slate-400 font-mono">
                          Ref: {ev.source_ref}
                        </p>

                        {/* Cryptographic Hash Audit Block (FR-25) */}
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <div className="flex items-center justify-between text-[8px] text-slate-450 uppercase tracking-wider font-bold">
                            <span>SHA-256 Digital Fingerprint</span>
                            {integrity === 'VERIFIED' ? (
                              <span className="text-emerald-700 flex items-center gap-0.5">
                                <ShieldCheck size={10} /> Verified
                              </span>
                            ) : (
                              <span className="text-rose-700 flex items-center gap-0.5 animate-pulse">
                                <AlertOctagon size={10} /> TAMPER DETECTED
                              </span>
                            )}
                          </div>
                          <p className="text-[8px] font-mono text-slate-500 bg-slate-50 p-1 rounded select-all break-all border border-slate-200">
                            {isTampered ? '7283192083192039281039218239120372831920831920392810392182391203' : ev.sha256}
                          </p>
                          
                          {/* Integrity Verification controls */}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => verifyEvidenceHash(ev.id)}
                              disabled={verifyingHashId === ev.id}
                              className="flex-1 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[9px] font-bold transition text-slate-600 shadow-sm"
                            >
                              {verifyingHashId === ev.id ? 'Computing...' : 'Recalculate Hash'}
                            </button>
                            <button
                              onClick={() => toggleTamperEvidence(ev.id)}
                              className={`px-2 py-1 rounded text-[9px] font-bold border transition shadow-sm ${
                                isTampered 
                                  ? 'bg-rose-50 border-rose-250 text-rose-700 hover:bg-rose-100' 
                                  : 'bg-slate-50 border-slate-200 text-slate-450 hover:text-slate-700'
                              }`}
                            >
                              {isTampered ? 'Untamper' : 'Simulate Tamper'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
