'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserCheck, Lock } from 'lucide-react';
import CaseManagement from '@/components/case/CaseManagement';
import { d2 } from '@/src/api/d2';

export default function LandingPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    d2.auth.me()
      .then(u => {
        setUser(u);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await d2.auth.login({ username: 'investigator', password });
      const u = await d2.auth.me();
      setUser(u);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm space-y-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black text-slate-800">NETRA</h1>
            <p className="text-xs text-slate-500 uppercase">System Authentication</p>
          </div>
          {error && <div className="text-red-500 text-xs bg-red-50 p-2 rounded">{error}</div>}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">Access Key</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter secure password (password123)"
              className="w-full px-3 py-2 border rounded focus:outline-blue-500 text-slate-800"
            />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
            Authenticate
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full space-y-8 z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3">
            <img src="/static/netra-logo.png" alt="NETRA Logo" className="w-10 h-10 object-contain" />
            <div className="text-left">
              <h1 className="text-xl font-black tracking-wider text-[#0F172A] font-sans">NETRA</h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                AI-POWERED CRIMINAL NETWORK ANALYSIS SYSTEM
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 border border-amber-250 text-amber-800 text-[10px] font-bold uppercase tracking-wider shadow-sm">
              <ShieldAlert size={12} className="shrink-0 text-amber-600" />
              <span>Security Clearance Required: Level-III Restricted</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Available Case Workspaces
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase bg-slate-50 border border-slate-200 px-2 py-0.5 rounded shadow-sm">
              <UserCheck size={12} className="text-green-600" />
              <span>Identity: {user?.display_name || 'Investigator'}</span>
            </div>
          </div>

          <CaseManagement initialCases={[]} />
        </div>

        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 text-center text-xs">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-1 shadow-sm">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">System State</span>
            <span className="font-bold text-emerald-700">OPERATIONAL</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-1 shadow-sm">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Local LLM</span>
            <span className="font-bold text-blue-600">ONLINE</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-1 shadow-sm">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Audit Integrity</span>
            <span className="font-bold text-slate-700">VERIFIED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
