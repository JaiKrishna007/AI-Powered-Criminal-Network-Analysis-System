import React from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  UserCheck, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { mockDB } from '@/lib/client-contracts/mockData';

export default function LandingPortalPage() {
  const cases = mockDB.cases;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden text-slate-800 antialiased">
      {/* Background visual indicators */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full space-y-6 z-10">
        
        {/* Portal Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#2563eb] flex items-center justify-center font-bold text-lg text-white">
              AG
            </div>
            <div className="text-left">
              <h1 className="text-base font-black tracking-wide text-slate-900 uppercase">
                Antigravity Forensics Portal
              </h1>
              <p className="text-[9px] text-slate-500 font-semibold tracking-widest uppercase">
                AI-POWERED CRIMINAL NETWORK ANALYSIS SYSTEM
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold uppercase tracking-wider font-mono-tech">
              <ShieldAlert size={12} className="shrink-0 text-amber-600 animate-pulse" />
              <span>Security Authorization: Level-III Restricted</span>
            </div>
          </div>
        </div>

        {/* Case List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono-tech">
              Case_Index_Directory
            </h2>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase font-mono-tech">
              <UserCheck size={12} className="text-green-600" />
              <span>Active Agent: Investigator Arash</span>
            </div>
          </div>

          <div className="grid gap-3">
            {cases.map((c) => (
              <div 
                key={c.id} 
                className="p-4 rounded-md bg-white border border-slate-300 flex items-center justify-between gap-6 shadow-sm hover:border-slate-400 transition"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-tech">
                      {c.classification.replace('_', ' ')}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 font-mono-tech">CASE_ID: {c.id}</span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 truncate font-sans">{c.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 max-w-lg leading-relaxed font-sans">
                    {c.description}
                  </p>
                </div>

                <Link
                  href={`/cases/${c.id}`}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition shadow-sm"
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Portal Footer stats */}
        <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200 text-center text-xs font-mono-tech text-slate-600">
          <div className="p-3 rounded bg-white border border-slate-350 shadow-sm flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-400 font-bold uppercase">SYSTEM_STATE</span>
            <span className="font-bold text-emerald-700">ONLINE</span>
          </div>
          <div className="p-3 rounded bg-white border border-slate-350 shadow-sm flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-400 font-bold uppercase">LLM_RUNTIMES</span>
            <span className="font-bold text-blue-600">ONLINE</span>
          </div>
          <div className="p-3 rounded bg-white border border-slate-350 shadow-sm flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-400 font-bold uppercase">FORENSIC_AUDIT</span>
            <span className="font-bold text-slate-700">VERIFIED</span>
          </div>
        </div>
        
        <p className="text-[9px] text-slate-400 text-center italic leading-normal font-mono-tech">
          Classification Warning: All analytical query paths and case accesses are subject to cryptographic integrity logging.
        </p>

      </div>
    </div>
  );
}
