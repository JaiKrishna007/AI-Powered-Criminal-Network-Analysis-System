'use client';

import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip,
  Brush
} from 'recharts';
import { Calendar, PhoneCall } from 'lucide-react';

interface TimelineBarProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndValDate: (date: string) => void;
  filteredCount: number;
  totalCount: number;
}

export default function TimelineBar({
  startDate,
  setStartDate,
  endDate,
  setEndValDate,
  filteredCount,
  totalCount
}: TimelineBarProps) {
  
  // Dense date points
  const chartData = useMemo(() => [
    { date: '2026-08-08', events: 0, label: 'Aug 8' },
    { date: '2026-08-09', events: 0, label: 'Aug 9' },
    { date: '2026-08-10', events: 1, label: 'Aug 10' },
    { date: '2026-08-11', events: 1, label: 'Aug 11' },
    { date: '2026-08-12', events: 3, label: 'Aug 12' },
    { date: '2026-08-13', events: 0, label: 'Aug 13' },
    { date: '2026-08-14', events: 1, label: 'Aug 14' },
    { date: '2026-08-15', events: 2, label: 'Aug 15' },
    { date: '2026-08-16', events: 2, label: 'Aug 16' },
    { date: '2026-08-17', events: 0, label: 'Aug 17' },
    { date: '2026-08-18', events: 0, label: 'Aug 18' }
  ], []);

  const handleBrushChange = (indices: any) => {
    if (indices && typeof indices.startIndex === 'number' && typeof indices.endIndex === 'number') {
      const start = chartData[indices.startIndex]?.date;
      const end = chartData[indices.endIndex]?.date;
      if (start && end) {
        setStartDate(start);
        setEndValDate(end);
      }
    }
  };

  return (
    <div className="w-full p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-3 shadow-sm h-full justify-between">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Calendar size={14} className="text-slate-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider font-mono-tech">
            Timeline Overview
          </h3>
        </div>
        <div className="text-[8px] bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-mono-tech">
          {startDate.split('-')[2]} Aug to {endDate.split('-')[2]} Aug ({filteredCount} / {totalCount} links)
        </div>
      </div>

      {/* Histogram Chart with Recharts Brush (Overhaul 2 - Brush selector) */}
      <div className="h-28 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 2, right: 2, left: -34, bottom: 0 }}>
            <XAxis dataKey="label" fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
            <YAxis fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#ffffff', borderColor: '#e2e8f0', borderRadius: '4px', fontSize: '9px' }}
              labelStyle={{ color: '#475569', fontWeight: 'bold' }}
              itemStyle={{ color: '#2563eb' }}
            />
            <Bar 
              dataKey="events" 
              radius={[2, 2, 0, 0]}
              fill="#2563eb"
              fillOpacity={0.7}
            />
            {/* Draggable Blue Window Brush Selector */}
            <Brush 
              dataKey="date" 
              height={14} 
              stroke="#2563eb" 
              fill="#eff6ff" 
              onChange={handleBrushChange}
              tickFormatter={() => ''}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Connection Banner (Overhaul 2) */}
      <div className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center gap-2 text-[9px] text-slate-600 leading-snug shrink-0">
        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <PhoneCall size={10} className="text-blue-600" />
        </div>
        <div className="truncate">
          <span className="font-bold text-slate-800">Recent connection:</span> Rohan Mehta called Aarti Shah (+91 98765 01234) on Aug 12 14:31 UTC.
        </div>
      </div>
    </div>
  );
}
