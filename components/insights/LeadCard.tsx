'use client';

import React, { useState } from 'react';
import { 
  ListTodo, 
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
        return 'text-rose-400 bg-rose-950/30 border-rose-900/50';
      case 'MEDIUM':
        return 'text-amber-400 bg-amber-950/30 border-amber-900/50';
      case 'LOW':
        return 'text-zinc-400 bg-zinc-950 border-zinc-800';
      default:
        return 'text-zinc-400 bg-zinc-950 border-zinc-800';
    }
  }, [lead.priority]);

  const handleStatusSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as Lead['status'];
    setUpdating(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    onStatusChange(lead.id, val);
    setUpdating(false);
  };

  return (
    <div className={`p-4 rounded-xl glass-card flex flex-col gap-3.5 border border-zinc-850 hover:border-zinc-700/60`}>
      {/* Header Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${priorityColor}`}>
              {lead.priority} Priority
            </span>
            {lead.relevance_score && (
              <span className="text-[10px] font-bold text-indigo-400">
                Score: {Math.round(lead.relevance_score * 100)}%
              </span>
            )}
          </div>
          <h3 className="text-xs font-bold text-zinc-100 leading-snug mt-1">{lead.title}</h3>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {updating ? (
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
          ) : lead.status === 'COMPLETED' ? (
            <CheckCircle size={14} className="text-emerald-400" />
          ) : lead.status === 'IN_PROGRESS' ? (
            <Clock size={14} className="text-indigo-400" />
          ) : lead.status === 'DISMISSED' ? (
            <Trash2 size={14} className="text-zinc-500" />
          ) : (
            <AlertTriangle size={14} className="text-zinc-400" />
          )}
        </div>
      </div>

      {/* Rationale details */}
      <p className="text-xs text-zinc-400 leading-normal">
        {lead.rationale}
      </p>

      {/* Actions & Status Dropdown */}
      <div className="flex items-center justify-between gap-4 pt-3.5 border-t border-zinc-850">
        {/* Evidence Links */}
        <div className="flex items-center gap-1 flex-wrap">
          {lead.evidence_ids.map((evId) => (
            <button
              key={evId}
              onClick={() => onSelectEvidence(evId)}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-[10px] text-zinc-400 font-bold hover:text-zinc-200 transition"
            >
              <FileText size={10} />
              <span>{evId}</span>
            </button>
          ))}
        </div>

        {/* Change Status Dropdown */}
        <div>
          <select
            value={lead.status}
            onChange={handleStatusSelect}
            disabled={updating}
            className="px-2 py-1 rounded text-[10px] font-bold bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
      </div>
    </div>
  );
}
