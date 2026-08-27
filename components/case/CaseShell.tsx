'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  FileText, 
  FileSignature, 
  Search, 
  ChevronDown, 
  ShieldCheck, 
  Bell,
  User,
  Clock,
  Lock,
  Compass,
  LayoutDashboard
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

  // Live UTC Clock
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

  // Restructured Sidebar Tabs (Dashboard, Evidence, Reports)
  const navItems = [
    { id: 'dashboard', label: 'Intelligence Dashboard', icon: LayoutDashboard },
    { id: 'evidence', label: 'Evidence Explorer', icon: FileText },
    { id: 'report', label: 'Investigation Report', icon: FileSignature },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  const isSimulated403 = searchQuery.trim() === '403';

  return (
    <div className="flex h-screen bg-[#F4F6F9] text-slate-800 font-sans antialiased">
      
      {/* Sidebar Navigation: Deep Navy/Slate-900 background (Overhaul 1) */}
      <aside className="w-64 bg-[#0F172A] border-r border-slate-800 flex flex-col z-20 shrink-0 text-white">
        
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#2563eb] flex items-center justify-center font-bold text-base text-white">
              AG
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white uppercase">
                NETRA / PS26189
              </h1>
              <p className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase">
                INTELLIGENCE HUB
              </p>
            </div>
          </div>
        </div>

        {/* Case Switcher */}
        <div className="p-4 border-b border-slate-800 relative">
          <label className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1 block">
            Workspace Selector
          </label>
          {loading ? (
            <div className="h-9 rounded bg-slate-800/40 animate-pulse flex items-center px-3">
              <span className="text-[11px] text-slate-400">Loading cases...</span>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowCaseSelector(!showCaseSelector)}
                className="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-800 border border-slate-700 hover:border-slate-650 text-left text-xs font-semibold text-slate-200 transition"
              >
                <span className="truncate">
                  {activeCase ? activeCase.title : 'Select a Case'}
                </span>
                <ChevronDown size={14} className="text-slate-400 ml-1 shrink-0" />
              </button>

              {showCaseSelector && (
                <div className="absolute top-[64px] left-4 right-4 bg-slate-800 border border-slate-700 rounded shadow-lg overflow-hidden z-30">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveCaseId(c.id);
                        setShowCaseSelector(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-750 border-b border-slate-750 last:border-b-0 transition flex flex-col gap-0.5 ${
                        activeCaseId === c.id ? 'bg-slate-700 border-l-2 border-l-blue-500 font-bold' : ''
                      }`}
                    >
                      <span className="text-slate-100">{c.title}</span>
                      <span className="text-[8px] text-slate-400 font-mono-tech uppercase">
                        {c.classification}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation: Bright Royal Blue pill for active item (Overhaul 1) */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'dashboard' && activeTab !== 'evidence' && activeTab !== 'report');
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#2563EB] text-white font-bold shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom docked Case Context Card (Overhaul 2) */}
        {activeCase && (
          <div className="p-4 m-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 font-mono-tech">
              <span>CASE_CONTEXT</span>
              <span className="px-1 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/30 text-green-400">
                ACTIVE
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold font-mono-tech text-slate-200">ID: {activeCase.id}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Created: 2026-08-01</p>
              <p className="text-[9px] text-slate-400">Investigator: Arash (+4 agents)</p>
            </div>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="w-full text-center py-1 rounded bg-slate-700 hover:bg-slate-650 text-slate-200 text-[9px] font-bold transition font-mono-tech"
            >
              VIEW CASE DETAILS
            </button>
          </div>
        )}
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Navigation Bar: Breadcrumb path & green verified badge (Overhaul 2) */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-10 shrink-0">
          
          {/* Left Breadcrumb path */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 font-sans">
            <span>Cases</span>
            <span className="text-slate-300 font-normal">/</span>
            <span className="text-slate-600 font-semibold truncate max-w-[120px]">
              {activeCase ? activeCase.title.split(':')[0] : 'Operation Trinetra'}
            </span>
            <span className="text-slate-300 font-normal">/</span>
            <span className="text-slate-900 font-bold">Network Analysis</span>
          </div>

          {/* Center search bar with Cmd + K hint */}
          <form onSubmit={handleSearchSubmit} className="relative w-80">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search or Ask... (Cmd + K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-slate-800 bg-slate-50/50"
            />
          </form>

          {/* Right badge, notification bell, user avatar */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            {/* Live UTC Clock */}
            <div className="hidden lg:block text-[10px] text-slate-500 font-mono-tech">
              {utcClock}
            </div>

            {/* Evidence Integrity Verified Badge */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D1FAE5] border border-emerald-200 text-[#059669] text-[9px] font-bold uppercase tracking-wider font-mono-tech">
              <ShieldCheck size={11} className="shrink-0" />
              <span>Evidence Integrity: Verified</span>
            </div>

            {/* Notification bell */}
            <button className="relative p-1.5 text-slate-400 hover:text-slate-700 transition">
              <Bell size={15} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
            </button>
            
            {/* User avatar pill */}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4 shrink-0">
              <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center font-bold text-white text-xs">
                A
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-slate-900 leading-none">Arash</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">LEVEL-III</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Shell */}
        <main className="flex-1 overflow-hidden relative">
          {isSimulated403 ? (
            /* HTTP 403 Forbidden Error Banner */
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-100/60 z-30">
              <div className="max-w-md w-full p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <Lock className="text-rose-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-mono-tech text-xs font-black uppercase tracking-wider text-rose-700">
                      HTTP 403: Forbidden
                    </h3>
                    <p className="text-xs font-semibold mt-1">
                      Access denied. Workspace authentication scope mismatch for the current case. Failed closed without leaking metadata.
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
