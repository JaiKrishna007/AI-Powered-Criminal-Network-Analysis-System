'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSignature, 
  Printer, 
  Save, 
  FileCheck2, 
  Clock, 
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
      <div className="p-6 text-xs text-slate-500 flex items-center gap-2 justify-center h-full font-mono-tech">
        <Clock className="animate-spin text-blue-600" size={14} />
        <span>Compiling evidence-backed report...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-xs text-slate-500 text-center">
        No report found or generated for this case.
      </div>
    );
  }

  const isFinalized = report.status === 'FINALIZED' || report.status === 'SUPERVISOR_APPROVED';

  return (
    <div className="w-full h-full flex p-6 gap-6 min-h-0 bg-[#F8FAFC] overflow-hidden">
      {/* CSS print overrides */}
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

      {/* Control panel */}
      <div className="w-80 flex flex-col gap-4 shrink-0 no-print">
        <div className="p-4 rounded-md border border-slate-350 bg-white flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <FileSignature size={14} className="text-blue-600" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono-tech">
              Report_Dossier
            </h3>
          </div>

          <div className="space-y-3.5 text-xs text-slate-700">
            <div className="grid grid-cols-2 gap-2 text-slate-550 bg-slate-50 p-3 rounded border border-slate-200 font-mono-tech">
              <div>
                <p className="text-[8px] text-slate-400 uppercase font-bold">VERSION</p>
                <p className="font-bold text-slate-800 mt-0.5">v{report.version}.0</p>
              </div>
              <div>
                <p className="text-[8px] text-slate-400 uppercase font-bold">STATUS</p>
                <p className={`font-bold mt-0.5 ${
                  isFinalized ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {report.status}
                </p>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <p className="text-[8px] text-slate-400 uppercase font-bold">CUSTODIAN</p>
                <p className="text-slate-700 mt-0.5">{report.created_by}</p>
              </div>
            </div>

            {/* Edit */}
            {!isFinalized ? (
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 font-mono-tech">
                    EXECUTIVE_SUMMARY_DRAFT
                  </label>
                  <textarea
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-semibold technical-input focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 font-mono-tech">
                    ADD_OBSERVATION
                  </label>
                  <input
                    type="text"
                    placeholder="Enter observation..."
                    value={newFinding}
                    onChange={(e) => setNewFinding(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-semibold technical-input focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('DRAFT')}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 font-bold text-xs text-slate-700 transition"
                  >
                    <Save size={12} />
                    <span>Save Draft</span>
                  </button>
                  <button
                    onClick={() => handleSave('FINALIZED')}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-sm transition"
                  >
                    <FileCheck2 size={12} />
                    <span>Finalize</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded bg-slate-50 border border-slate-200 flex items-start gap-2 text-slate-500 leading-normal">
                <Lock size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[9.5px]">
                  Dossier finalized. Lock version compiled. Supervisors may request a review version update.
                </p>
              </div>
            )}

            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-350 hover:border-slate-400 font-bold text-xs text-slate-700 transition"
            >
              <Printer size={12} />
              <span>Export PDF / Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print sheet */}
      <div 
        id="print-area" 
        className="flex-1 bg-white rounded-md border border-slate-300 p-8 overflow-y-auto leading-relaxed text-slate-800 shadow-sm flex flex-col gap-6 font-serif select-text"
      >
        <div className="border-b-4 border-slate-800 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-wide font-sans">
              INVESTIGATION DOCKET DOSSIER
            </h1>
            <p className="text-[9px] text-slate-500 font-bold tracking-widest font-sans uppercase mt-0.5">
              CASE: {report.case_id} • VERSION: v{report.version}.0
            </p>
          </div>
          <div className="text-right font-sans">
            <p className="text-xs text-slate-500 font-bold">CLASSIFIED ASSIGNMENT</p>
            <p className="text-[8px] text-slate-400 font-mono-tech mt-0.5">
              UTC: {report.created_at}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-1.5">
          <h2 className="text-xs font-bold text-blue-600 tracking-wider uppercase font-sans font-mono-tech">
            I. EXECUTIVE_SUMMARY
          </h2>
          <p className="text-xs text-slate-700 leading-normal font-sans italic p-3 rounded bg-slate-50 border border-slate-200">
            "{report.sections.summary}"
          </p>
        </div>

        {/* Fact list */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-blue-600 tracking-wider uppercase font-sans font-mono-tech">
            II. FACT_FINDINGS
          </h2>
          <ul className="list-decimal pl-5 space-y-1.5 text-xs text-slate-750 font-sans">
            {report.sections.findings.map((finding, idx) => (
              <li key={idx} className="leading-relaxed">
                {finding}
              </li>
            ))}
          </ul>
        </div>

        {/* Limitations */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-blue-600 tracking-wider uppercase font-sans font-mono-tech">
            III. SYSTEM_DATA_CONSTRAINTS
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-500 font-sans">
            {report.sections.limitations.map((lim, idx) => (
              <li key={idx} className="leading-relaxed">
                {lim}
              </li>
            ))}
          </ul>
        </div>

        {/* Forensics validation info */}
        <div className="space-y-2.5 mt-4 pt-4 border-t border-slate-200">
          <h2 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest font-sans font-mono-tech">
            IV. FORENSIC_INTEGRITY_INDEX
          </h2>
          <div className="text-[9px] text-slate-400 font-mono-tech space-y-0.5">
            <p>Verification Checksum: SHA-256 integrity validation enabled.</p>
            <p>Scope: Bounded data coordinates matches verified.</p>
            <p>Case Member custodian: {report.created_by}</p>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-center pt-8 mt-auto border-t border-dashed border-slate-300">
          <div className="text-center font-sans">
            <div className="w-36 border-b border-slate-400 h-8"></div>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-mono-tech">
              Investigator Signature
            </p>
          </div>
          <div className="text-center font-sans">
            <div className="w-36 border-b border-slate-400 h-8 flex items-center justify-center text-[10px] text-slate-400 italic">
              {isFinalized ? 'v' + report.version + '.0 locked' : 'pending'}
            </div>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-mono-tech">
              Supervisor Approval Sign
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
