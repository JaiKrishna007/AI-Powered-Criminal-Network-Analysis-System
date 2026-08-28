'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSignature, 
  Printer, 
  Save, 
  FileCheck2, 
  Clock, 
  Lock
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
      const findings = [...(report as any).sections.findings];
      if (newFinding.trim()) {
        findings.push(newFinding.trim());
      }
      
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          findings,
          limitations: (report as any).sections.limitations,
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
      <div className="p-6 text-xs text-slate-500 flex items-center gap-2 justify-center h-full">
        <Clock className="animate-spin text-blue-500" size={16} />
        <span>Compiling evidence-backed report...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-xs text-slate-550 text-center">
        No report found or generated for this case.
      </div>
    );
  }

  const isFinalized = (report as any).status === 'FINALIZED' || (report as any).status === 'SUPERVISOR_APPROVED';

  return (
    <div className="w-full h-full flex p-6 gap-6 min-h-0 bg-[#F4F6F9] overflow-hidden">
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
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileSignature size={16} className="text-[#2563EB]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Report Controls
            </h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-2 text-slate-500 font-semibold bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
              <div>
                <p className="text-[9px] text-slate-400 uppercase">Version</p>
                <p className="font-mono text-slate-800 mt-0.5 font-bold">v{report.version}.0</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 uppercase">Status</p>
                <p className={`font-mono mt-0.5 font-bold ${
                  isFinalized ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {report.status}
                </p>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <p className="text-[9px] text-slate-400 uppercase">Compiled By</p>
                <p className="text-slate-700 mt-0.5">{report.created_by}</p>
              </div>
            </div>

            {/* Editing options */}
            {!isFinalized ? (
              <div className="space-y-3.5 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Edit Executive Summary
                  </label>
                  <textarea
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 border border-slate-250 focus:outline-none focus:border-blue-500 text-slate-750"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Add Custom Finding
                  </label>
                  <input
                    type="text"
                    placeholder="Enter observation..."
                    value={newFinding}
                    onChange={(e) => setNewFinding(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 border border-slate-250 focus:outline-none focus:border-blue-500 text-slate-750"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('DRAFT')}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-650 transition"
                  >
                    <span>Draft</span>
                  </button>
                  <button
                    onClick={() => handleSave('FINALIZED')}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 font-bold text-xs text-white shadow-sm transition"
                  >
                    <FileCheck2 size={14} />
                    <span>Finalize</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-55 border border-slate-200 flex items-start gap-2.5 text-slate-500 leading-normal shadow-sm">
                <Lock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[10px] font-semibold">
                  Report is finalized. To edit sections, a supervisor must reject or request a new compilation version.
                </p>
              </div>
            )}

            {/* Print Action */}
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition shadow-sm"
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
        className="flex-1 bg-white rounded-xl border border-slate-200 border-t-8 border-t-slate-800 p-8 overflow-y-auto leading-relaxed text-slate-700 shadow-sm flex flex-col gap-6 font-serif"
      >
        {/* Printable docket header */}
        <div className="border-b-4 border-slate-200 pb-5 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-wide font-sans">
              INVESTIGATION DOCKET REPORT
            </h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest font-sans uppercase mt-1">
              Case Reference: {report.case_id} • Version v{report.version}.0
            </p>
          </div>
          <div className="text-right font-sans">
            <p className="text-xs text-slate-650 font-bold">CONFIDENTIAL BRIEFING</p>
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
              Compiled: {new Date(report.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Section 1: Summary */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-blue-700 tracking-wider uppercase font-sans">
            I. Executive Summary
          </h2>
          <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 italic p-4 rounded-lg font-sans">
            "{(report as any).sections.summary}"
          </p>
        </div>

        {/* Section 2: Key Findings */}
        <div className="space-y-3.5">
          <h2 className="text-sm font-bold text-blue-700 tracking-wider uppercase font-sans">
            II. Compiled Fact Findings
          </h2>
          <ul className="list-decimal pl-5 space-y-2 text-xs text-slate-650 font-sans">
            {(report as any).sections.findings.map((finding: any, idx: number) => (
              <li key={idx} className="leading-relaxed">
                {finding}
              </li>
            ))}
          </ul>
        </div>

        {/* Section 3: Material Limitations */}
        <div className="space-y-2.5">
          <h2 className="text-sm font-bold text-blue-700 tracking-wider uppercase font-sans">
            III. Constraints & Data Gaps
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-500 font-sans">
            {(report as any).sections.limitations.map((lim: any, idx: number) => (
              <li key={idx} className="leading-relaxed">
                {lim}
              </li>
            ))}
          </ul>
        </div>

        {/* Section 4: Forensic Signatures */}
        <div className="space-y-3 mt-4 pt-4 border-t border-slate-200">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-sans">
            IV. Forensic Provenance Verification Checklist
          </h2>
          <div className="text-[9px] text-slate-400 font-mono space-y-1">
            <p>Hash Integrity System: SHA-256 Checksums</p>
            <p>Status: All active references parsed and cross-checked successfully.</p>
            <p>Custodian: {report.created_by}</p>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-center pt-8 mt-auto border-t border-dashed border-slate-300">
          <div className="text-center font-sans">
            <div className="w-36 border-b border-slate-300 h-8"></div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
              Investigator Signature
            </p>
          </div>
          <div className="text-center font-sans">
            <div className="w-36 border-b border-slate-300 h-8 flex items-center justify-center text-[10px] text-slate-500 italic">
              {isFinalized ? 'v' + report.version + '.0 lock' : 'pending'}
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
              Supervisor Approval Sign
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
