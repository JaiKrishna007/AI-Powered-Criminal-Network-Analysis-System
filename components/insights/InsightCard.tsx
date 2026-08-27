'use client';

import React from 'react';
import { 
  BrainCircuit, 
  ArrowRight, 
  ShieldCheck, 
  HelpCircle,
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
        return { icon: BrainCircuit, color: 'text-indigo-400', label: 'Potential Bridge Entity', border: 'border-indigo-500/20' };
      case 'COMMUNICATION_SPIKE':
        return { icon: TrendingUp, color: 'text-cyan-400', label: 'Communication Spike', border: 'border-cyan-500/20' };
      case 'FINANCIAL_PATH':
        return { icon: TrendingDown, color: 'text-emerald-400', label: 'Financial Fraud Trail', border: 'border-emerald-500/20' };
      case 'CO_LOCATION':
        return { icon: MapPin, color: 'text-rose-400', label: 'Co-Location Context', border: 'border-rose-500/20' };
      default:
        return { icon: BrainCircuit, color: 'text-zinc-400', label: 'AI Highlight', border: 'border-zinc-800' };
    }
  }, [insight.type]);

  const Icon = iconConfig.icon;

  return (
    <div className={`p-4 rounded-xl glass-card flex flex-col gap-3.5 border ${iconConfig.border}`}>
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-center">
            <Icon size={16} className={iconConfig.color} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-100">{iconConfig.label}</h4>
            <button
              onClick={() => onFocusEntity(insight.entity_id)}
              className="text-[10px] text-indigo-400 font-semibold hover:underline text-left"
            >
              Target Entity ID: {insight.entity_id}
            </button>
          </div>
        </div>

        {/* Confidence Circle/Badge */}
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Confidence</span>
          <span className={`text-xs font-black ${insight.confidence >= 0.9 ? 'text-emerald-400' : 'text-indigo-400'}`}>
            {Math.round(insight.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Rationale Bullet Points (XAI - FE-07) */}
      <div className="space-y-1.5 text-xs text-zinc-300">
        <ul className="list-disc pl-4 space-y-1 text-zinc-400">
          {insight.reasons.map((reason, idx) => (
            <li key={idx} className="leading-normal">{reason}</li>
          ))}
        </ul>
      </div>

      {/* Confidence rating progress bar */}
      <div className="w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
        <div 
          className="h-full bg-indigo-600 rounded-full"
          style={{ width: `${insight.confidence * 100}%` }}
        />
      </div>

      {/* Citations evidence tags */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/40">
        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Supporting Evidence:</span>
        <div className="flex flex-wrap gap-1">
          {insight.evidence_ids.map((evId) => (
            <button
              key={evId}
              onClick={() => onSelectEvidence(evId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-[10px] text-zinc-400 font-bold hover:text-zinc-200 transition"
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
