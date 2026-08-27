'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Search as SearchIcon, 
  ChevronRight, 
  X, 
  FolderClosed, 
  Lock, 
  AlertCircle 
} from 'lucide-react';
import { Case } from '@/lib/client-contracts/contracts';

interface CaseManagementProps {
  initialCases: Case[];
}

export default function CaseManagement({ initialCases }: CaseManagementProps) {
  const [cases, setCases] = useState<Case[]>(initialCases);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'>('ACTIVE');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [newCaseId, setNewCaseId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newClassification, setNewClassification] = useState<'PUBLIC' | 'CASE_RESTRICTED' | 'CONFIDENTIAL' | 'SECRET'>('CASE_RESTRICTED');

  // Reload / Re-fetch case listings
  const fetchUpdatedCases = async () => {
    try {
      const res = await fetch('/api/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (err) {
      console.error('Failed to refresh cases', err);
    }
  };

  // Submit New Case
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseId.trim()) {
      setError('Case Number / Reference is required.');
      return;
    }
    if (!newTitle.trim()) {
      setError('Case Title is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newCaseId.trim(),
          title: newTitle.trim(),
          classification: newClassification
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Case creation failed.');
      }

      // Refresh list, close modal, clear form
      await fetchUpdatedCases();
      setShowModal(false);
      setNewCaseId('');
      setNewTitle('');
      setNewClassification('CASE_RESTRICTED');
    } catch (err: any) {
      setError(err.message || 'Unable to create case. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filters logic
  const filteredCases = cases.filter((c) => {
    // 1. Status Filter
    if (statusFilter !== 'ALL' && c.status !== statusFilter) {
      return false;
    }
    // 2. Search Text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search, Status Pills, New Button */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-zinc-800/80 pb-4">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search cases by reference or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-xs bg-zinc-900/40 border border-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-100 transition placeholder-zinc-500"
          />
        </div>

        {/* Status filters & New Case Button */}
        <div className="flex w-full sm:w-auto items-center justify-end gap-3 flex-wrap">
          <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
            {(['ALL', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition ${
                  statusFilter === s
                    ? 'bg-zinc-800 text-indigo-400 font-extrabold shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {s === 'ALL' ? 'All' : s.toLowerCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setError('');
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/10 shrink-0"
          >
            + New Case
          </button>
        </div>
      </div>

      {/* Case cards list */}
      <div className="grid gap-4">
        {filteredCases.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-zinc-850 bg-zinc-900/10">
            <FolderClosed size={24} className="text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 italic">No matching case records found.</p>
          </div>
        ) : (
          filteredCases.map((c) => (
            <div 
              key={c.id} 
              className="p-5 rounded-2xl glass-card border border-zinc-850 flex items-center justify-between gap-6"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded uppercase tracking-wider">
                    {c.classification.replace('_', ' ')}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                    c.status === 'ACTIVE'
                      ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/30'
                      : c.status === 'CLOSED'
                      ? 'text-amber-400 bg-amber-950/30 border-amber-900/30'
                      : 'text-zinc-500 bg-zinc-950 border-zinc-900'
                  }`}>
                    {c.status}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-500 font-mono">Ref: {c.id}</span>
                </div>
                <h3 className="text-sm font-bold text-zinc-200 truncate">{c.title}</h3>
                <p className="text-xs text-zinc-500">
                  Owner: {c.owner_id} • Assigned Workspace
                </p>
              </div>

              <Link
                href={`/cases/${c.id}`}
                className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 text-zinc-300 hover:text-white transition shadow shadow-black/25"
              >
                <ChevronRight size={18} />
              </Link>
            </div>
          ))
        )}
      </div>

      {/* Creation Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition"
            >
              <X size={16} />
            </button>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Lock size={14} className="text-indigo-400" />
                Initialize Criminal Case
              </h3>
              <p className="text-[10px] text-zinc-500">
                Provide the required reference credentials to spawn a new secured investigation workspace.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded bg-red-950/40 border border-red-900/40 text-red-400 text-xs flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-4">
              {/* ID / Ref input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  Case Number / Reference ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CASE-1042 or FIR-2026-90"
                  value={newCaseId}
                  onChange={(e) => setNewCaseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs bg-zinc-950 border border-zinc-850 focus:outline-none focus:border-indigo-500 text-zinc-100 transition placeholder-zinc-600"
                />
              </div>

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  Case Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operation CyberShield Financial Fraud"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs bg-zinc-950 border border-zinc-850 focus:outline-none focus:border-indigo-500 text-zinc-100 transition placeholder-zinc-600"
                />
              </div>

              {/* Classification dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  Security Classification
                </label>
                <select
                  value={newClassification}
                  onChange={(e) => setNewClassification(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs bg-zinc-950 border border-zinc-850 focus:outline-none focus:border-indigo-500 text-zinc-200 transition"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="CASE_RESTRICTED">CASE RESTRICTED</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="SECRET">SECRET</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/10 flex items-center justify-center min-w-[90px]"
                >
                  {loading ? 'Initializing...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
