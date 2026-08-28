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
  RefreshCw 
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

  return (
    <div className="flex h-screen bg-[#F4F6F9] text-slate-800 font-sans">
      {/* Sidebar Navigation - Navy Sidebar */}
      <aside className="w-64 bg-[#0F172A] flex flex-col z-20 text-slate-300">
        {/* Brand Logo & Security Header */}
        <div className="p-5 border-b border-slate-800 flex flex-col gap-2 bg-[#0F172A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center font-bold text-lg text-white shadow-md shadow-blue-600/30">
              AG
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white">
                NETRA
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                CRIMINAL INTELLIGENCE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-950/40 border border-red-900/40 text-red-400 text-[10px] font-bold mt-2 uppercase tracking-wider">
            <ShieldAlert size={12} className="shrink-0 animate-pulse" />
            <span>Classified: Restricted</span>
          </div>
        </div>

        {/* Case Switcher */}
        <div className="p-4 border-b border-slate-800 relative">
          <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 block">
            Active Case Workspace
          </label>
          {loading ? (
            <div className="h-10 rounded bg-slate-800/40 animate-pulse flex items-center px-3">
              <RefreshCw size={14} className="animate-spin text-slate-500 mr-2" />
              <span className="text-xs text-slate-500">Loading cases...</span>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowCaseSelector(!showCaseSelector)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition text-left text-xs font-semibold text-slate-200"
              >
                <span className="truncate">
                  {activeCase ? activeCase.title : 'Select a Case'}
                </span>
                <ChevronDown size={14} className="text-slate-500 ml-1" />
              </button>

              {showCaseSelector && (
                <div className="absolute top-[68px] left-4 right-4 bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden z-30">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveCaseId(c.id);
                        setShowCaseSelector(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-800/60 border-b border-slate-800 last:border-b-0 transition flex flex-col gap-1 ${
                        activeCaseId === c.id ? 'bg-slate-800/40 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <span className="font-semibold text-zinc-200">{c.title}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                        Classification: {c.classification.replace('_', ' ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#2563EB] text-white font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Investigator Status Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0B132B] flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
              A
            </div>
            <div>
              <p className="font-semibold text-zinc-200">Arash</p>
              <p className="text-[10px] text-slate-400 font-medium">Investigator</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded uppercase">
            <UserCheck size={10} />
            <span>Authorized</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F4F6F9]">
        {/* Top Header Panel */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-10 shadow-sm">
          {/* Ask/Search query bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-96 max-w-lg">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search entities, cases, evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 transition placeholder-slate-400"
            />
          </form>

          {/* Classification & Security Banner */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            {activeCase && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="font-mono">Active: {activeCase.id}</span>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] tracking-wider uppercase font-bold text-emerald-700 flex items-center gap-1.5 shadow-sm">
              <UserCheck size={12} />
              <span>Secure Environment</span>
            </div>
          </div>
        </header>

        {/* Content Shell */}
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
