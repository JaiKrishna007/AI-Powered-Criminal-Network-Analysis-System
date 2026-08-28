'use client';

import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { Calendar, AlertCircle } from 'lucide-react';

interface TimelineBarProps {
  startDate: string; // ISO date format
  setStartDate: (date: string) => void;
  endDate: string; // ISO date format
  setEndValDate: (date: string) => void;
  // Dynamic relations count to show current filtered size
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
  // Synthetic data timeline density points (August 2026 - Case 1042)
  const chartData = [
    { date: '2026-08-08', events: 0, label: 'Aug 8' },
    { date: '2026-08-09', events: 0, label: 'Aug 9' },
    { date: '2026-08-10', events: 1, label: 'Aug 10' }, // Rohan calls PH001
    { date: '2026-08-11', events: 1, label: 'Aug 11' }, // Vikram meets Rizwan
    { date: '2026-08-12', events: 3, label: 'Aug 12' }, // Spike: Call + transfer HDFC
    { date: '2026-08-13', events: 0, label: 'Aug 13' },
    { date: '2026-08-14', events: 1, label: 'Aug 14' }, // Vehicle toll Pune
    { date: '2026-08-15', events: 2, label: 'Aug 15' }, // Rizwan transfer Swiss
    { date: '2026-08-16', events: 2, label: 'Aug 16' }, // David calls PH002
    { date: '2026-08-17', events: 0, label: 'Aug 17' },
    { date: '2026-08-18', events: 0, label: 'Aug 18' }
  ];

  // Convert dates to numerical indexes for range sliding
  const dateMap = useMemo(() => chartData.map((d) => d.date), []);

  const startIndex = useMemo(() => {
    const idx = dateMap.indexOf(startDate);
    return idx === -1 ? 0 : idx;
  }, [startDate, dateMap]);

  const endIndex = useMemo(() => {
    const idx = dateMap.indexOf(endDate);
    return idx === -1 ? dateMap.length - 1 : idx;
  }, [endDate, dateMap]);

  const handleStartSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    // Ensure start doesn't exceed end
    const safeVal = Math.min(val, endIndex);
    setStartDate(dateMap[safeVal]);
  };

  const handleEndSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    // Ensure end is not less than start
    const safeVal = Math.max(val, startIndex);
    setEndValDate(dateMap[safeVal]);
  };

  // Format date readable
  const formatDateReadable = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="w-full p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-3">
      {/* Header controls details */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Temporal Activity Timeline
          </h3>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider text-slate-500">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
            <span>Range:</span>
            <span className="text-blue-600 font-mono">
              {formatDateReadable(startDate)}
            </span>
            <span className="text-slate-400 font-normal">to</span>
            <span className="text-blue-600 font-mono">
              {formatDateReadable(endDate)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
            <span>Active Links:</span>
            <span className="text-blue-600 font-mono">
              {filteredCount} / {totalCount}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Activity Graph showing communications peaks (FE-03) */}
      <div className="h-20 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
            <XAxis dataKey="label" fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} />
            <YAxis fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}
              labelStyle={{ fontSize: '10px', color: '#334155', fontWeight: 'bold' }}
              itemStyle={{ fontSize: '10px', color: '#2563EB' }}
            />
            <Bar 
              dataKey="events" 
              radius={[4, 4, 0, 0]}
              fill="#2563EB"
              fillOpacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Range Sliders */}
      <div className="relative pt-2 px-1 flex flex-col gap-2">
        <div className="relative h-2 rounded bg-slate-105 border border-slate-200">
          {/* Visual track between start and end indexes */}
          <div 
            className="absolute h-full bg-blue-600/20"
            style={{
              left: `${(startIndex / (dateMap.length - 1)) * 100}%`,
              right: `${100 - (endIndex / (dateMap.length - 1)) * 100}%`
            }}
          />
        </div>

        {/* Start Slider */}
        <input
          type="range"
          min={0}
          max={dateMap.length - 1}
          value={startIndex}
          onChange={handleStartSlider}
          className="absolute -top-1 w-full h-4 opacity-0 cursor-pointer pointer-events-auto z-10"
        />

        {/* End Slider */}
        <input
          type="range"
          min={0}
          max={dateMap.length - 1}
          value={endIndex}
          onChange={handleEndSlider}
          className="absolute -top-1 w-full h-4 opacity-0 cursor-pointer pointer-events-auto z-10"
        />

        {/* Range controls handle positioning overlay */}
        <div className="flex justify-between text-[9px] text-slate-400 font-mono px-1">
          {chartData.map((d) => (
            <span 
              key={d.date} 
              className={`${
                d.date === startDate || d.date === endDate 
                  ? 'text-blue-600 font-bold' 
                  : 'text-slate-300'
              }`}
            >
              |
            </span>
          ))}
        </div>
      </div>
      
      {/* Temporal Diff Alerts */}
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold px-1">
        <AlertCircle size={12} className="text-slate-400 shrink-0" />
        <span>Sliding timeline filters edges in the relationship graph. Spikes indicate dates with matching synthetic logs.</span>
      </div>
    </div>
  );
}
