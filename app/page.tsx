import React from 'react';
import { 
  ShieldAlert, 
  UserCheck, 
  FolderClosed 
} from 'lucide-react';
import { pgPool } from '@/src/db';
import CaseManagement from '@/components/case/CaseManagement';

export const dynamic = 'force-dynamic';

export default async function LandingPortalPage() {
  let cases: any[] = [];
  try {
    const res = await pgPool.query('SELECT * FROM cases ORDER BY id DESC;');
    cases = res.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      owner_id: row.owner_id,
      classification: row.classification,
      description: '',
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Failed to fetch cases from database:', err);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background radial effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full space-y-8 z-10">
        
        {/* Portal Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-600/25">
              AG
            </div>
            <div className="text-left">
              <h1 className="text-xl font-black tracking-wider text-zinc-100 font-sans">
                ANTIGRAVITY PORTAL
              </h1>
              <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
                AI-POWERED CRIMINAL NETWORK ANALYSIS SYSTEM
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-red-950/40 border border-red-900/40 text-red-400 text-[10px] font-bold uppercase tracking-wider">
              <ShieldAlert size={12} className="shrink-0 animate-pulse" />
              <span>Security Clearance Required: Level-III Restricted</span>
            </div>
          </div>
        </div>

        {/* Portal Body - Case List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Available Case Workspaces
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase">
              <UserCheck size={12} className="text-green-500" />
              <span>Identity: Investigator Arash</span>
            </div>
          </div>

          {/* Interactive Case Management Client Component */}
          <CaseManagement initialCases={cases} />
        </div>

        {/* Portal Footer stats details */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-900 text-center text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-900/20 border border-zinc-900/80 flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">System State</span>
            <span className="font-bold text-emerald-400">OPERATIONAL</span>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/20 border border-zinc-900/80 flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Local LLM</span>
            <span className="font-bold text-indigo-400">ONLINE</span>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/20 border border-zinc-900/80 flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Audit Integrity</span>
            <span className="font-bold text-zinc-200">VERIFIED</span>
          </div>
        </div>
        
        <p className="text-[9px] text-zinc-600 text-center italic leading-normal">
          Warning: Unauthorized access to this system is prohibited and subject to cryptographic logging and criminal prosecution under case governance.
        </p>

      </div>
    </div>
  );
}
