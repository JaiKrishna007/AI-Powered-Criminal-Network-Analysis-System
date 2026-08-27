'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Trash2,
  FileText
} from 'lucide-react';
import { Lead } from '@/lib/client-contracts/contracts';

interface LeadCardProps {
  lead: Lead;
  onStatusChange: (leadId: string, newStatus: Lead['status']) => void;
  onSelectEvidence: (evId: string) => void;
}

export default function LeadCard({
  lead,
  onStatusChange,
  onSelectEvidence
}: LeadCardProps) {
  const [updating, setUpdating] = useState(false);

  const priorityColor = React.useMemo(() => {
    switch (lead.priority) {
      case 'HIGH':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'MEDIUM':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'LOW':
        return 'text-slate-700 bg-slate-50 border-slate-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  }, [lead.priority]);

  const handleStatusSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as Lead['status'];
    setUpdating(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    onStatusChange(lead.id, val);
    setUpdating(false);
  };

  return (
    <div className="p-4 rounded-md border border-slate-350 bg-white flex flex-col gap-3 shadow-sm hover:border-slate-400 transition">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase border font-mono-tech ${priorityColor}`}>
              {lead.priority} Priority
            </span>
            {lead.relevance_score && (
              <span className="text-[10px] font-bold text-blue-600 font-mono-tech">
                RELEVANCE: {Math.round(lead.relevance_score * 100)}%
              </span>
            )}
          </div>
          <h3 className="text-xs font-bold text-slate-800 leading-snug mt-1 font-sans">{lead.title}</h3>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {updating ? (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
          ) : lead.status === 'COMPLETED' ? (
            <CheckCircle size={14} className="text-emerald-600" />
          ) : lead.status === 'IN_PROGRESS' ? (
            <Clock size={14} className="text-blue-600 font-bold" />
          ) : lead.status === 'DISMISSED' ? (
            <Trash2 size={14} className="text-slate-400" />
          ) : (
            <AlertTriangle size={14} className="text-slate-500" />
          )}
        </div>
      </div>

      {/* Rationale detail */}
      <p className="text-xs text-slate-600 leading-normal font-sans">
        {lead.rationale}
      </p>

      {/* Actions and citations */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100 shrink-0">
        {/* Monospace citations */}
        <div className="flex items-center gap-1 flex-wrap">
          {lead.evidence_ids.map((evId) => (
            <button
              key={evId}
              onClick={() => onSelectEvidence(evId)}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-slate-50 border border-slate-300 hover:bg-slate-100 text-[10px] text-slate-600 font-mono-tech transition"
            >
              <FileText size={10} className="text-slate-400" />
              <span>{evId}</span>
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div>
          <select
            value={lead.status}
            onChange={handleStatusSelect}
            disabled={updating}
            className="px-2 py-1 rounded-sm text-[9px] font-bold bg-slate-50 border border-slate-300 text-slate-700 focus:outline-none focus:border-blue-500 transition cursor-pointer font-mono-tech"
          >
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
        </div>
      </div>
    </div>
  );
}
