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
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col z-20">
        {/* Brand Logo & Security Header */}
        <div className="p-5 border-b border-zinc-800/80 flex flex-col gap-2 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-indigo-600/30">
              AG
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                ANTIGRAVITY
              </h1>
              <p className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">
                CRIMINAL INTELLIGENCE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-950/30 border border-red-900/30 text-red-400 text-[10px] font-bold mt-2 uppercase tracking-wider">
            <ShieldAlert size={12} className="shrink-0 animate-pulse" />
            <span>Classified: Restricted</span>
          </div>
        </div>

        {/* Case Switcher */}
        <div className="p-4 border-b border-zinc-800/50 relative">
          <label className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1 block">
            Active Case Workspace
          </label>
          {loading ? (
            <div className="h-10 rounded bg-zinc-800/40 animate-pulse flex items-center px-3">
              <RefreshCw size={14} className="animate-spin text-zinc-500 mr-2" />
              <span className="text-xs text-zinc-500">Loading cases...</span>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowCaseSelector(!showCaseSelector)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition text-left text-xs font-semibold text-zinc-200"
              >
                <span className="truncate">
                  {activeCase ? activeCase.title : 'Select a Case'}
                </span>
                <ChevronDown size={14} className="text-zinc-500 ml-1" />
              </button>

              {showCaseSelector && (
                <div className="absolute top-[68px] left-4 right-4 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-30">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveCaseId(c.id);
                        setShowCaseSelector(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs hover:bg-zinc-800/60 border-b border-zinc-800 last:border-b-0 transition flex flex-col gap-1 ${
                        activeCaseId === c.id ? 'bg-zinc-800/40 border-l-2 border-l-indigo-500' : ''
                      }`}
                    >
                      <span className="font-semibold text-zinc-200">{c.title}</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
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
                    ? 'bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-zinc-500'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Investigator RBAC Status Header */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300">
              A
            </div>
            <div>
              <p className="font-semibold text-zinc-200">Arash</p>
              <p className="text-[10px] text-zinc-500 font-medium">Investigator</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-green-500 text-[10px] font-bold bg-green-950/20 border border-green-900/30 px-2 py-0.5 rounded uppercase">
            <UserCheck size={10} />
            <span>Authorized</span>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Panel */}
        <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/20 backdrop-blur-md flex items-center justify-between px-6 z-10">
          {/* Ask/Search query bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-96 max-w-lg">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Ask / Search: e.g. Rohan Mehta or TXN-8819..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-xs bg-zinc-900/50 border border-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-100 transition"
            />
          </form>

          {/* Classification Banner */}
          <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400">
            {activeCase && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>Active Database: {activeCase.id}</span>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] tracking-wider uppercase font-bold text-indigo-400">
              RBAC Scope: INVESTIGATOR
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
