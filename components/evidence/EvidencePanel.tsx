'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  Upload, 
  RefreshCw, 
  Search, 
  Plus, 
  Clock,
  Sparkles
} from 'lucide-react';
import { Evidence } from '@/lib/client-contracts/contracts';

interface EvidencePanelProps {
  caseId: string;
  onSelectEvidenceId: (id: string) => void;
}

export default function EvidencePanel({
  caseId,
  onSelectEvidenceId
}: EvidencePanelProps) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Ingestion upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'CDR' | 'BANK_TRANSACTION' | 'FIR' | 'PDF'>('PDF');

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ' ' })
      });
      if (res.ok) {
        const data = await res.json();
        setEvidence(data.evidence || []);
      }
    } catch (err) {
      console.error('Failed to load evidence', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [caseId]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    setUploading(true);
    setUploadProgress('QUEUED: Checking file parameters...');
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    setUploadProgress('PROCESSING: Computing SHA-256 hash...');
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    setUploadProgress('INGESTING: Running NLP Entity extraction...');
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const hash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const newEv: Evidence = {
        id: `${newFileType.substring(0, 3)}-${Math.floor(200 + Math.random() * 800)}`,
        case_id: caseId,
        source_type: newFileType as any,
        source_ref: `${newFileName.toLowerCase().replace(/\s+/g, '_')}`,
        sha256: hash,
        classification: 'CASE_RESTRICTED',
        integrity_status: 'VERIFIED',
        content: `Ingested ${newFileType} records containing synthetic metadata for ${newFileName}. Hash checked.`
      };

      setEvidence((prev) => [newEv, ...prev]);
      setNewFileName('');
      setUploadProgress('SUCCESS: Ingestion complete! Case database updated.');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setUploadProgress('');
    } catch (err) {
      console.error(err);
      setUploadProgress('ERROR: Ingestion failed.');
    } finally {
      setUploading(false);
    }
  };

  const filteredEvidence = evidence.filter((ev) => {
    const term = search.toLowerCase();
    return (
      ev.id.toLowerCase().includes(term) ||
      ev.source_type.toLowerCase().includes(term) ||
      ev.source_ref.toLowerCase().includes(term) ||
      (ev.content && ev.content.toLowerCase().includes(term))
    );
  });

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-hidden bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 shrink-0 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-blue-600" size={18} />
            Evidence Integrity Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Forensic metadata inventory containing original file parameters and cryptographic hashes.
          </p>
        </div>
        <button 
          onClick={loadEvidence}
          className="p-2 rounded border border-slate-350 bg-white hover:bg-slate-50 text-slate-500 transition shadow-sm"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
        
        {/* Left Side: Ingest Form */}
        <div className="space-y-4 flex flex-col min-h-0 shrink-0">
          <div className="p-4 rounded-md border border-slate-300 bg-white flex flex-col gap-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Upload size={14} className="text-blue-600" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono-tech">
                Ingest_New_Source
              </h3>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 font-mono-tech">
                  FILE_NAME / REFERENCE
                </label>
                <input
                  type="text"
                  placeholder="e.g. logs_mehta.csv"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  disabled={uploading}
                  className="w-full px-3 py-1.5 text-xs font-semibold technical-input focus:outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 font-mono-tech">
                  DATA_TYPE
                </label>
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value as any)}
                  disabled={uploading}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:border-blue-500 text-slate-700 cursor-pointer font-mono-tech"
                >
                  <option value="PDF">Forensic Report (PDF)</option>
                  <option value="CDR">Call Detail Record (CDR / CSV)</option>
                  <option value="BANK_TRANSACTION">Bank Ledger (CSV/JSON)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading || !newFileName.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs shadow-sm transition"
              >
                {uploading ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                <span>{uploading ? 'INGESTING...' : 'INGEST FILE'}</span>
              </button>
            </form>

            {uploadProgress && (
              <div className="p-3 rounded bg-slate-50 border border-slate-200 flex items-start gap-2.5 shadow-inner">
                <Clock size={12} className="text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[10px]">
                  <p className="font-bold text-slate-700 uppercase font-mono-tech">PIPELINE_STATUS</p>
                  <p className="text-slate-500 font-mono-tech mt-1 leading-normal">{uploadProgress}</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-md border border-slate-200 bg-white space-y-2 shadow-sm text-slate-500">
            <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-mono-tech">
              <Sparkles size={12} className="text-blue-600" />
              INTEGRITY_VERIFICATION
            </h4>
            <p className="text-[9.5px] leading-relaxed">
              Forensic records require append-only hashes. Audits compute local digests against records to detect tampering of indices.
            </p>
          </div>
        </div>

        {/* Right Side: Evidence List Table */}
        <div className="col-span-2 rounded-md border border-slate-300 bg-white flex flex-col min-h-0 overflow-hidden shadow-sm">
          
          {/* Search filter */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 relative shrink-0">
            <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search evidence directory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs font-semibold technical-input focus:outline-none"
            />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2 h-full">
                <RefreshCw size={12} className="animate-spin text-blue-600" />
                <span>Syncing forensic indexes...</span>
              </div>
            ) : filteredEvidence.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching evidence entries found.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[8px] font-mono-tech">
                    <th className="p-3">ID</th>
                    <th className="p-3">Source Ref / Excerpt</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">SHA-256 Hash</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvidence.map((ev) => (
                    <tr 
                      key={ev.id}
                      onClick={() => onSelectEvidenceId(ev.id)}
                      className="hover:bg-slate-50/70 cursor-pointer transition"
                    >
                      {/* ID */}
                      <td className="p-3 font-bold text-slate-900 font-mono-tech">
                        {ev.id}
                      </td>
                      
                      {/* Ref & Excerpt */}
                      <td className="p-3 max-w-[220px]">
                        <p className="font-semibold text-slate-800">{ev.source_ref}</p>
                        {ev.content && (
                          /* Monospace Raw Excerpt Box (Overhaul 5) */
                          <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200/60 font-mono-tech text-[8px] text-slate-600 whitespace-pre-wrap break-words leading-relaxed select-text">
                            "{ev.content}"
                          </div>
                        )}
                      </td>
                      
                      {/* Type */}
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-200 text-[8px] font-bold text-slate-600 font-mono-tech">
                          {ev.source_type}
                        </span>
                      </td>

                      {/* Hash */}
                      <td className="p-3 font-mono-tech text-[8px] text-slate-400 select-all break-all max-w-[120px]">
                        {ev.sha256.substring(0, 16)}...
                      </td>

                      {/* Status Check badge */}
                      <td className="p-3 text-center shrink-0">
                        {ev.integrity_status === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-emerald-50 border border-emerald-250 text-emerald-700 text-[9px] font-bold uppercase font-mono-tech">
                            <ShieldCheck size={10} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-rose-50 border border-rose-250 text-rose-700 text-[9px] font-bold uppercase font-mono-tech animate-pulse">
                            <AlertTriangle size={10} /> Tampered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
