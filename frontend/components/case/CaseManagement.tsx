'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search as SearchIcon, 
  ChevronRight, 
  X, 
  FolderClosed, 
  Lock, 
  AlertCircle 
} from 'lucide-react';
import type { Case as Case } from '@/lib/client-contracts/contracts';
import { d2 } from '@/src/api/d2';

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

  useEffect(() => {
    if (cases.length === 0) {
      fetchUpdatedCases();
    }
  }, []);

  // Form Fields
  const [newCaseId, setNewCaseId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newClassification, setNewClassification] = useState<'PUBLIC' | 'CASE_RESTRICTED' | 'CONFIDENTIAL' | 'SECRET'>('CASE_RESTRICTED');

  // Reload / Re-fetch case listings
  const fetchUpdatedCases = async () => {
    try {
      const res = await d2.cases.list();
      if (res && res.cases) {
        setCases(res.cases);
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
      await d2.cases.create({
        id: newCaseId.trim(),
        title: newTitle.trim(),
        classification: newClassification
      });

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
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-slate-200 pb-4">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search cases by reference or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-xs bg-white border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 transition placeholder-slate-400"
          />
        </div>

        {/* Status filters & New Case Button */}
        <div className="flex w-full sm:w-auto items-center justify-end gap-3 flex-wrap">
          <div className="flex gap-1 p-0.5 rounded-lg bg-white border border-slate-200 shadow-sm">
            {(['ALL', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition ${
                  statusFilter === s
                    ? 'bg-slate-100 text-blue-600 font-extrabold'
                    : 'text-slate-500 hover:text-slate-700'
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
            className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm shrink-0"
          >
            + New Case
          </button>
        </div>
      </div>

      {/* Case cards list */}
      <div className="grid gap-4">
        {filteredCases.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-slate-300 bg-white">
            <FolderClosed size={24} className="text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-500 italic">No matching case records found.</p>
          </div>
        ) : (
          filteredCases.map((c) => (
            <div 
              key={c.id} 
              className="p-5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-6 shadow-sm hover:shadow-md transition"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-wider">
                    {c.classification.replace('_', ' ')}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                    c.status === 'ACTIVE'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : c.status === 'CLOSED'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-slate-500 bg-slate-50 border-slate-200'
                  }`}>
                    {c.status}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 font-mono">Ref: {c.id}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 truncate">{c.title}</h3>
                <p className="text-xs text-slate-500">
                  Owner: {c.owner_id} • Assigned Workspace
                </p>
              </div>

              <Link
                href={`/cases/${c.id}`}
                className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition shadow-sm"
              >
                <ChevronRight size={18} />
              </Link>
            </div>
          ))
        )}
      </div>

      {/* Creation Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-xl max-w-md w-full space-y-4 shadow-xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
            >
              <X size={16} />
            </button>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Lock size={14} className="text-[#2563EB]" />
                Initialize Criminal Case
              </h3>
              <p className="text-[10px] text-slate-500">
                Provide the required reference credentials to spawn a new secured investigation workspace.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 font-semibold">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-4">
              {/* ID / Ref input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Case Number / Reference ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CASE-1042 or FIR-2026-90"
                  value={newCaseId}
                  onChange={(e) => setNewCaseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs bg-slate-50 border border-slate-250 focus:outline-none focus:border-blue-500 text-slate-800 transition placeholder-slate-400"
                />
              </div>

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Case Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operation CyberShield Financial Fraud"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs bg-slate-50 border border-slate-250 focus:outline-none focus:border-blue-500 text-slate-800 transition placeholder-slate-400"
                />
              </div>

              {/* Classification dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Security Classification
                </label>
                <select
                  value={newClassification}
                  onChange={(e) => setNewClassification(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs bg-slate-50 border border-slate-250 focus:outline-none focus:border-blue-500 text-slate-700 transition"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="CASE_RESTRICTED">CASE RESTRICTED</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="SECRET">SECRET</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm flex items-center justify-center min-w-[90px]"
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
