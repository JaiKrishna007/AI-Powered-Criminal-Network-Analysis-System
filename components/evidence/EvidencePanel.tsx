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
  Copy,
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
  
  // Ingestion upload mocks (FR-01 / FR-27)
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'CDR' | 'BANK_TRANSACTION' | 'FIR' | 'PDF'>('PDF');

  // Load evidence
  const loadEvidence = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ' ' }) // empty space to return all for this case
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

  // Simulate Ingestion (FR-27 / FR-01 / FR-02 / FR-25)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    setUploading(true);
    setUploadProgress('QUEUED: Checking file parameters...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setUploadProgress('PROCESSING: Computing SHA-256 hash...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setUploadProgress('INGESTING: Running NLP Entity extraction...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Post mock ingestion to relationship database state
    try {
      // In-memory manipulation of mockDB via search route side effects
      // We will add it to the state directly
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

      // Add to local state
      setEvidence((prev) => [newEv, ...prev]);
      setNewFileName('');
      setUploadProgress('SUCCESS: Ingestion complete! Case database updated.');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setUploadProgress('');
    } catch (err) {
      console.error(err);
      setUploadProgress('ERROR: Ingestion failed.');
    } finally {
      setUploading(false);
    }
  };

  // Filter evidence
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
    <div className="w-full h-full flex flex-col p-6 overflow-hidden bg-zinc-950">
      {/* Header controls details */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <FileText className="text-indigo-400" />
            Evidence Integrity Explorer
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Forensic trace documentation containing files, metadata classifications, and cryptographic checksum checks.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadEvidence}
            className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
        {/* Left Columns: Ingest & Upload forms */}
        <div className="space-y-6 flex flex-col min-h-0">
          {/* Upload panel (FR-01 / FR-27) */}
          <div className="p-4 rounded-xl glass-panel border border-zinc-800/80 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-2">
              <Upload size={16} className="text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Ingest Source File
              </h3>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                  Source Reference / File Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call_Logs_Mehta.csv"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  disabled={uploading}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-indigo-500 text-zinc-100 placeholder-zinc-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                  Ingestion Source Type
                </label>
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value as any)}
                  disabled={uploading}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-indigo-500 text-zinc-300"
                >
                  <option value="PDF">Forensic Report (PDF)</option>
                  <option value="CDR">Call Detail Record (CDR / CSV)</option>
                  <option value="BANK_TRANSACTION">Bank Ledger (CSV/JSON)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading || !newFileName.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white font-bold text-xs shadow-md shadow-indigo-600/10 transition"
              >
                {uploading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                <span>{uploading ? 'Processing Ingestion...' : 'Ingest Document'}</span>
              </button>
            </form>

            {/* Ingestion status logs (FR-27) */}
            {uploadProgress && (
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 flex items-start gap-2.5">
                <Clock size={14} className="text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[10px]">
                  <p className="font-bold text-zinc-300">Pipeline Status</p>
                  <p className="text-zinc-500 font-mono mt-1 leading-normal">{uploadProgress}</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick instructions details */}
          <div className="p-4 rounded-xl glass-card border border-zinc-850 space-y-2">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-400" />
              Forensic Hash Guidelines
            </h4>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Every document is stamped with a SHA-256 hash immediately upon ingestion. Any changes to files in memory or storage will trigger a checksum mismatch in subsequent audits.
            </p>
          </div>
        </div>

        {/* Right Columns: Evidence list grid */}
        <div className="col-span-2 rounded-xl glass-panel border border-zinc-800/80 flex flex-col min-h-0 overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-zinc-800/85 bg-zinc-900/40 relative shrink-0">
            <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter evidence logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-xs bg-zinc-950 border border-zinc-850 focus:outline-none focus:border-indigo-500 text-zinc-100"
            />
          </div>

          {/* Table List container */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-indigo-500" />
                <span>Loading forensic evidence list...</span>
              </div>
            ) : filteredEvidence.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No matching evidence artifacts found.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="p-4">ID</th>
                    <th className="p-4">Source Reference</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">SHA-256 Hash</th>
                    <th className="p-4 text-center">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredEvidence.map((ev) => (
                    <tr 
                      key={ev.id}
                      onClick={() => onSelectEvidenceId(ev.id)}
                      className="hover:bg-zinc-900/30 cursor-pointer transition"
                    >
                      {/* ID */}
                      <td className="p-4 font-bold text-zinc-100 font-mono">
                        {ev.id}
                      </td>
                      
                      {/* Reference */}
                      <td className="p-4">
                        <p className="font-semibold text-zinc-300">{ev.source_ref}</p>
                        {ev.content && (
                          <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[200px]">
                            {ev.content}
                          </p>
                        )}
                      </td>
                      
                      {/* Type */}
                      <td className="p-4">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400 font-mono">
                          {ev.source_type}
                        </span>
                      </td>

                      {/* Hash */}
                      <td className="p-4 font-mono text-[9px] text-zinc-500 max-w-[120px] truncate select-all">
                        {ev.sha256}
                      </td>

                      {/* Integrity */}
                      <td className="p-4 text-center">
                        {ev.integrity_status === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[9px] font-bold uppercase">
                            <ShieldCheck size={12} />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[9px] font-bold uppercase animate-pulse">
                            <AlertTriangle size={12} />
                            <span>Tampered</span>
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
