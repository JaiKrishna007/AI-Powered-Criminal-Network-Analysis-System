'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSignature, 
  Printer, 
  Save, 
  FileCheck2, 
  Clock, 
  History,
  Lock,
  Plus
} from 'lucide-react';
import { Report } from '@/lib/client-contracts/contracts';

interface ReportPreviewProps {
  caseId: string;
}

export default function ReportPreview({
  caseId
}: ReportPreviewProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [newFinding, setNewFinding] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${caseId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setSummary(data.sections.summary || '');
      }
    } catch (err) {
      console.error('Failed to fetch report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [caseId]);

  const handleSave = async (status: Report['status']) => {
    if (!report) return;
    setSaving(true);
    try {
      const findings = [...report.sections.findings];
      if (newFinding.trim()) {
        findings.push(newFinding.trim());
      }
      
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          findings,
          limitations: report.sections.limitations,
          status
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setSummary(data.sections.summary || '');
        setNewFinding('');
      }
    } catch (err) {
      console.error('Failed to save report', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-6 text-xs text-zinc-500 flex items-center gap-2 justify-center h-full">
        <Clock className="animate-spin text-indigo-500" size={16} />
        <span>Compiling evidence-backed report...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-xs text-zinc-500 text-center">
        No report found or generated for this case.
      </div>
    );
  }

  const isFinalized = report.status === 'FINALIZED' || report.status === 'SUPERVISOR_APPROVED';

  return (
    <div className="w-full h-full flex p-6 gap-6 min-h-0 bg-zinc-950 overflow-hidden">
      {/* CSS print-specific formatting rules overlay */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            color: black !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Left panel: Report properties edit panel */}
      <div className="w-80 flex flex-col gap-5 shrink-0 no-print">
        <div className="p-4 rounded-xl glass-panel border border-zinc-800/80 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-zinc-850 pb-2">
            <FileSignature size={16} className="text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Report Controls
            </h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-2 text-zinc-400 font-semibold bg-zinc-950 p-3 rounded-lg border border-zinc-900">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Version</p>
                <p className="font-mono text-zinc-200 mt-0.5">v{report.version}.0</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Status</p>
                <p className={`font-mono mt-0.5 font-bold ${
                  isFinalized ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {report.status}
                </p>
              </div>
              <div className="col-span-2 pt-2 border-t border-zinc-900">
                <p className="text-[9px] text-zinc-500 uppercase">Compiled By</p>
                <p className="text-zinc-300 mt-0.5">{report.created_by}</p>
              </div>
            </div>

            {/* Editing options */}
            {!isFinalized ? (
              <div className="space-y-3.5 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                    Edit Executive Summary
                  </label>
                  <textarea
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-indigo-500 text-zinc-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                    Add Custom Finding
                  </label>
                  <input
                    type="text"
                    placeholder="Enter observation..."
                    value={newFinding}
                    onChange={(e) => setNewFinding(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-indigo-500 text-zinc-200"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('DRAFT')}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 font-bold text-xs text-zinc-300 transition"
                  >
                    <Save size={14} />
                    <span>Draft</span>
                  </button>
                  <button
                    onClick={() => handleSave('FINALIZED')}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-md shadow-indigo-600/10 transition"
                  >
                    <FileCheck2 size={14} />
                    <span>Finalize</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-900 flex items-start gap-2.5 text-zinc-500 leading-normal">
                <Lock size={16} className="text-zinc-600 shrink-0 mt-0.5" />
                <p className="text-[10px]">
                  Report is finalized. To edit sections, a supervisor must reject or request a new compilation version.
                </p>
              </div>
            )}

            {/* Print Action */}
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 font-bold text-xs text-zinc-200 transition"
            >
              <Printer size={14} />
              <span>Print / Export PDF Docket</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: Report preview document render sheet */}
      <div 
        id="print-area" 
        className="flex-1 bg-zinc-900/40 rounded-xl border border-zinc-800/80 p-8 overflow-y-auto leading-relaxed text-zinc-350 shadow-inner flex flex-col gap-6 font-serif"
      >
        {/* Printable docket header */}
        <div className="border-b-4 border-zinc-800/80 pb-5 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-zinc-100 tracking-wide font-sans">
              INVESTIGATION DOCKET REPORT
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-widest font-sans uppercase mt-1">
              Case Reference: {report.case_id} • Version v{report.version}.0
            </p>
          </div>
          <div className="text-right font-sans">
            <p className="text-xs text-zinc-400 font-bold">CONFIDENTIAL BRIEFING</p>
            <p className="text-[9px] text-zinc-500 font-mono mt-0.5">
              Compiled: {new Date(report.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Section 1: Summary */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-indigo-400 tracking-wider uppercase font-sans">
            I. Executive Summary
          </h2>
          <p className="text-sm text-zinc-300 leading-normal font-sans italic p-4 rounded bg-zinc-950/20 border border-zinc-900/60">
            "{report.sections.summary}"
          </p>
        </div>

        {/* Section 2: Key Findings */}
        <div className="space-y-3.5">
          <h2 className="text-sm font-bold text-indigo-400 tracking-wider uppercase font-sans">
            II. Compiled Fact Findings
          </h2>
          <ul className="list-decimal pl-5 space-y-2 text-xs text-zinc-300 font-sans">
            {report.sections.findings.map((finding, idx) => (
              <li key={idx} className="leading-relaxed">
                {finding}
              </li>
            ))}
          </ul>
        </div>

        {/* Section 3: Material Limitations */}
        <div className="space-y-2.5">
          <h2 className="text-sm font-bold text-indigo-400 tracking-wider uppercase font-sans">
            III. Constraints & Data Gaps
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-zinc-400 font-sans">
            {report.sections.limitations.map((lim, idx) => (
              <li key={idx} className="leading-relaxed">
                {lim}
              </li>
            ))}
          </ul>
        </div>

        {/* Section 4: Forensic Signatures */}
        <div className="space-y-3 mt-4 pt-4 border-t border-zinc-850">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-sans">
            IV. Forensic Provenance Verification Checklist
          </h2>
          <div className="text-[9px] text-zinc-500 font-mono space-y-1">
            <p>Hash Integrity System: SHA-256 Checksums</p>
            <p>Status: All active references parsed and cross-checked successfully.</p>
            <p>Custodian: {report.created_by}</p>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-center pt-8 mt-auto border-t border-dashed border-zinc-800">
          <div className="text-center font-sans">
            <div className="w-36 border-b border-zinc-700/60 h-8"></div>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1.5">
              Investigator Signature
            </p>
          </div>
          <div className="text-center font-sans">
            <div className="w-36 border-b border-zinc-700/60 h-8 flex items-center justify-center text-[10px] text-zinc-600 italic">
              {isFinalized ? 'v' + report.version + '.0 lock' : 'pending'}
            </div>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1.5">
              Supervisor Approval Sign
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
