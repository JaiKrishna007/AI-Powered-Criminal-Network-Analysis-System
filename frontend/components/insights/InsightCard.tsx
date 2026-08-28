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
  // Triggered when selecting an entity in the graph
  onFocusEntity: (entityId: string) => void;
  // Triggered when selecting an evidence item
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
        return { icon: BrainCircuit, color: 'text-blue-600 bg-blue-50/50', label: 'Potential Bridge Entity', border: 'border-blue-200' };
      case 'COMMUNICATION_SPIKE':
        return { icon: TrendingUp, color: 'text-cyan-600 bg-cyan-50/50', label: 'Communication Spike', border: 'border-cyan-200' };
      case 'FINANCIAL_PATH':
        return { icon: TrendingDown, color: 'text-emerald-700 bg-emerald-50/50', label: 'Financial Fraud Trail', border: 'border-emerald-200' };
      case 'CO_LOCATION':
        return { icon: MapPin, color: 'text-teal-600 bg-teal-50/50', label: 'Co-Location Context', border: 'border-teal-200' };
      default:
        return { icon: BrainCircuit, color: 'text-slate-600 bg-slate-50/50', label: 'AI Highlight', border: 'border-slate-200' };
    }
  }, [insight.type]);

  const Icon = iconConfig.icon;

  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-3.5">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center bg-white ${iconConfig.border}`}>
            <Icon size={16} className={iconConfig.color} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">{iconConfig.label}</h4>
            <button
              onClick={() => onFocusEntity((insight.target_entity_ids?.[0] || 'Unknown'))}
              className="text-[10px] text-blue-600 font-bold hover:underline text-left block"
            >
              Target Entity ID: {(insight.target_entity_ids?.[0] || 'Unknown')}
            </button>
          </div>
        </div>

        {/* Confidence Circle/Badge */}
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Confidence</span>
          <span className={`text-xs font-black ${(insight.confidence || 0) >= 0.9 ? 'text-emerald-600' : 'text-blue-650'}`}>
            {Math.round((insight.confidence || 0) * 100)}%
          </span>
        </div>
      </div>

      {/* Rationale Bullet Points (XAI - FE-07) */}
      <div className="space-y-1.5 text-xs text-slate-600">
        <ul className="list-disc pl-4 space-y-1 text-slate-500">
          {(insight.content ? [insight.content] : []).map((reason, idx) => (
            <li key={idx} className="leading-normal">{reason}</li>
          ))}
        </ul>
      </div>

      {/* Confidence rating progress bar */}
      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div 
          className="h-full bg-blue-600 rounded-full"
          style={{ width: `${(insight.confidence || 0) * 100}%` }}
        />
      </div>

      {/* Citations evidence tags */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Supporting Evidence:</span>
        <div className="flex flex-wrap gap-1">
          {(insight.evidence_ids || []).map((evId) => (
            <button
              key={evId}
              onClick={() => onSelectEvidence(evId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] text-slate-600 font-bold transition shadow-sm"
            >
              <FileText size={10} />
              <span>{evId}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
