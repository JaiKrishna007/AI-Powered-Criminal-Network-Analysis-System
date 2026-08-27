'use client';

import React from 'react';
import { 
  BrainCircuit, 
  FileText,
  TrendingUp,
  MapPin,
  TrendingDown
} from 'lucide-react';
import { Insight } from '@/lib/client-contracts/contracts';

interface InsightCardProps {
  insight: Insight;
  onFocusEntity: (entityId: string) => void;
  onSelectEvidence: (evId: string) => void;
}

export default function InsightCard({
  insight,
  onFocusEntity,
  onSelectEvidence
}: InsightCardProps) {
  
  const iconConfig = React.useMemo(() => {
    switch (insight.type) {
      case 'POTENTIAL_BRIDGE':
        return { icon: BrainCircuit, color: 'text-indigo-600', label: 'Potential Bridge Entity', border: 'border-indigo-200 bg-indigo-50/20' };
      case 'COMMUNICATION_SPIKE':
        return { icon: TrendingUp, color: 'text-cyan-600', label: 'Communication Anomaly', border: 'border-cyan-200 bg-cyan-50/20' };
      case 'FINANCIAL_PATH':
        return { icon: TrendingDown, color: 'text-emerald-600', label: 'Potential Fraud Trail', border: 'border-emerald-200 bg-emerald-50/20' };
      case 'CO_LOCATION':
        return { icon: MapPin, color: 'text-rose-600', label: 'Co-Location Context', border: 'border-rose-200 bg-rose-50/20' };
      default:
        return { icon: BrainCircuit, color: 'text-slate-600', label: 'Forensic Highlight', border: 'border-slate-300 bg-slate-50' };
    }
  }, [insight.type]);

  const Icon = iconConfig.icon;

  return (
    <div className={`p-4 rounded-md border bg-white flex flex-col gap-3 shadow-sm ${iconConfig.border}`}>
      {/* Micro-Header Chips grid (Key-Value chips - Overhaul 4) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
            <Icon size={14} className={iconConfig.color} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-sans">{iconConfig.label}</h4>
            <button
              onClick={() => onFocusEntity(insight.entity_id)}
              className="text-[9px] text-blue-600 font-bold font-mono-tech hover:underline text-left block"
            >
              FOCUS: {insight.entity_id}
            </button>
          </div>
        </div>

        {/* Monospace Confidence Meter (Overhaul 4) */}
        <div className="px-2 py-0.5 rounded-sm bg-slate-50 border border-slate-200 text-[10px] font-mono-tech text-slate-700">
          CONF: {Math.round(insight.confidence * 100)}%
        </div>
      </div>

      {/* Rationale Points */}
      <div className="text-xs text-slate-600 space-y-1 pl-1">
        <ul className="list-disc pl-4 space-y-1">
          {insight.reasons.map((reason, idx) => (
            <li key={idx} className="leading-relaxed text-slate-600">{reason}</li>
          ))}
        </ul>
      </div>

      {/* Confidence score bar */}
      <div className="w-full h-1.5 rounded-sm bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
        <div 
          className="h-full bg-blue-600 rounded-sm"
          style={{ width: `${insight.confidence * 100}%` }}
        />
      </div>

      {/* Citations evidence badges */}
      <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 text-[9px] font-bold text-slate-400 shrink-0">
        <span className="uppercase tracking-widest font-mono-tech">CITATIONS:</span>
        <div className="flex flex-wrap gap-1">
          {insight.evidence_ids.map((evId) => (
            <button
              key={evId}
              onClick={() => onSelectEvidence(evId)}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-slate-50 hover:bg-slate-100 border border-slate-300 text-[10px] text-slate-600 font-mono-tech tracking-wide transition"
            >
              <FileText size={10} className="text-slate-400" />
              <span>{evId}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
