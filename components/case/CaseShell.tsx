'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Network, 
  Calendar, 
  FileText, 
  BrainCircuit, 
  ListTodo, 
  FileSignature, 
  Search, 
  ChevronDown, 
  ShieldAlert, 
  UserCheck, 
  RefreshCw,
  Clock,
  Lock
} from 'lucide-react';
import { Case } from '@/lib/client-contracts/contracts';

interface CaseShellProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCaseId: string;
  setActiveCaseId: (caseId: string) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  children: React.ReactNode;
}

export default function CaseShell({
  activeTab,
  setActiveTab,
  activeCaseId,
  setActiveCaseId,
  onSearch,
  searchQuery,
  setSearchQuery,
  children
}: CaseShellProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCaseSelector, setShowCaseSelector] = useState(false);
  const [utcClock, setUtcClock] = useState('');

  // Live UTC Clock (Overhaul 1)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcClock(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch cases
  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await fetch('/api/cases');
        if (res.ok) {
          const data = await res.json();
          setCases(data);
          if (data.length > 0 && !activeCaseId) {
            setActiveCaseId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch cases', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, [activeCaseId, setActiveCaseId]);

  useEffect(() => {
    if (activeCaseId && cases.length > 0) {
      const c = cases.find((item) => item.id === activeCaseId);
      if (c) setActiveCase(c);
    }
  }, [activeCaseId, cases]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: FolderOpen },
    { id: 'network', label: 'Relationship Graph', icon: Network },
    { id: 'timeline', label: 'Temporal Analysis', icon: Calendar },
    { id: 'evidence', label: 'Evidence Explorer', icon: FileText },
    { id: 'insights', label: 'AI Insights', icon: BrainCircuit },
    { id: 'leads', label: 'Investigative Leads', icon: ListTodo },
    { id: 'report', label: 'Investigation Report', icon: FileSignature },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  // Simulated 403 Block check for verification (FE-T07)
  const isSimulated403 = searchQuery.trim() === '403';

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-300 bg-slate-100 flex flex-col z-20 shrink-0">
        
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-300 flex flex-col gap-2 bg-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#2563eb] flex items-center justify-center font-bold text-base text-white">
              AG
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-slate-900 uppercase">
                Antigravity
              </h1>
              <p className="text-[9px] text-slate-500 font-semibold tracking-widest uppercase">
                TECHNICAL FORENSICS
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold mt-2 uppercase tracking-wider font-mono-tech">
            <ShieldAlert size={11} className="shrink-0 text-amber-600" />
            <span>CASE_RESTRICTED CLASSIFICATION</span>
          </div>
        </div>

        {/* Case Switcher */}
        <div className="p-4 border-b border-slate-200 relative bg-slate-100">
          <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase mb-1 block">
            Workspace Selector
          </label>
          {loading ? (
            <div className="h-9 rounded-sm bg-slate-200/50 animate-pulse flex items-center px-3">
              <RefreshCw size={12} className="animate-spin text-slate-500 mr-2" />
              <span className="text-[11px] text-slate-500">Retrieving Cases...</span>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowCaseSelector(!showCaseSelector)}
                className="w-full flex items-center justify-between px-3 py-2 rounded bg-white border border-slate-350 hover:border-slate-400 text-left text-xs font-semibold text-slate-700 transition"
              >
                <span className="truncate">
                  {activeCase ? activeCase.title : 'Select a Case'}
                </span>
                <ChevronDown size={14} className="text-slate-500 ml-1 shrink-0" />
              </button>

              {showCaseSelector && (
                <div className="absolute top-[64px] left-4 right-4 bg-white border border-slate-300 rounded shadow-lg overflow-hidden z-30">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveCaseId(c.id);
                        setShowCaseSelector(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition flex flex-col gap-0.5 ${
                        activeCaseId === c.id ? 'bg-slate-100 border-l-2 border-l-blue-600 font-bold' : ''
                      }`}
                    >
                      <span className="text-slate-800">{c.title}</span>
                      <span className="text-[8px] text-slate-500 font-mono-tech uppercase">
                        {c.classification}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition ${
                  isActive
                    ? 'bg-white border border-slate-300 text-blue-600 font-bold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-500'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Investigator RBAC & Identity Status */}
        <div className="p-4 border-t border-slate-300 bg-slate-100 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-300 border border-slate-400 flex items-center justify-center font-bold text-slate-700 text-xs">
              A
            </div>
            <div>
              <p className="font-semibold text-slate-800">Arash</p>
              <p className="text-[9px] text-slate-500 font-medium">Investigator</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-green-700 text-[9px] font-bold bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-sm uppercase font-mono-tech">
            <UserCheck size={9} />
            <span>Auth</span>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Panel (Grid Dividers - Overhaul 1) */}
        <header className="h-14 border-b border-slate-300 bg-white flex items-center justify-between px-6 z-10 shrink-0">
          {/* Ask/Search query command bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-80">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search or Ask... (Cmd+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs font-medium technical-input focus:outline-none placeholder-slate-400"
            />
          </form>

          {/* Live UTC Clock & Case metadata */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            {/* Live UTC Clock (Technical - Overhaul 1) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-mono-tech">
              <Clock size={11} className="text-slate-500" />
              <span>{utcClock}</span>
            </div>

            {activeCase && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-mono-tech text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                <span>DB: {activeCase.id}</span>
              </div>
            )}
            
            <div className="px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] tracking-wide uppercase font-bold text-slate-600 font-mono-tech">
              SCOPE: INVESTIGATOR
            </div>
          </div>
        </header>

        {/* Content Shell (with Permission Denial Fallback) */}
        <main className="flex-1 overflow-hidden relative">
          {isSimulated403 ? (
            /* HTTP 403 Forbidden Error Banner (FE-T07) */
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-50 z-30">
              <div className="max-w-md w-full p-6 rounded-md bg-rose-50 border border-rose-300 text-rose-900 shadow-sm flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <Lock className="text-rose-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-mono-tech text-xs font-black uppercase tracking-wider text-rose-700">
                      HTTP 403: Forbidden
                    </h3>
                    <p className="text-xs font-semibold mt-1">
                      Access denied. Your active role clearance (INVESTIGATOR) does not possess case members authorization logic for this metadata scope.
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-rose-200 flex justify-end">
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] uppercase font-mono-tech transition"
                  >
                    Close & Reset Panel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
