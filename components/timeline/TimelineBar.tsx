'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { Calendar, Play, Pause, AlertCircle } from 'lucide-react';

interface TimelineBarProps {
  startDate: string; // ISO date format
  setStartDate: (date: string) => void;
  endDate: string; // ISO date format
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
  const [isPlaying, setIsPlaying] = useState(false);

  // Synthetic date density points
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

  const dateMap = useMemo(() => chartData.map((d) => d.date), [chartData]);

  const startIndex = useMemo(() => {
    const idx = dateMap.indexOf(startDate);
    return idx === -1 ? 0 : idx;
  }, [startDate, dateMap]);

  const endIndex = useMemo(() => {
    const idx = dateMap.indexOf(endDate);
    return idx === -1 ? dateMap.length - 1 : idx;
  }, [endDate, dateMap]);

  // Timeline slider auto-play automation (Bottom Dock Play/Pause - Overhaul 3)
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      const curStartIdx = dateMap.indexOf(startDate);
      const curEndIdx = dateMap.indexOf(endDate);
      
      let nextStart = curStartIdx + 1;
      let nextEnd = curEndIdx + 1;
      
      if (nextEnd >= dateMap.length) {
        nextStart = 0;
        nextEnd = 2; // Reset to 2-day initial window
      }
      
      setStartDate(dateMap[nextStart]);
      setEndValDate(dateMap[nextEnd]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, startDate, endDate, dateMap, setStartDate, setEndValDate]);

  const handleStartSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const safeVal = Math.min(val, endIndex);
    setStartDate(dateMap[safeVal]);
  };

  const handleEndSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const safeVal = Math.max(val, startIndex);
    setEndValDate(dateMap[safeVal]);
  };

  const formatDateReadable = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Difference indicators calculations (+/- edge count chips - Overhaul 3)
  const addedDiff = Math.max(0, filteredCount - 4);
  const prunedDiff = Math.max(0, totalCount - filteredCount);

  return (
    <div className="w-full p-4 rounded-md border border-slate-300 bg-white flex flex-col gap-3 shadow-sm">
      {/* Header controls details */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button toggle */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-6 h-6 rounded-sm flex items-center justify-center border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition shrink-0 ${
              isPlaying ? 'ring-1 ring-blue-500 border-blue-500' : ''
            }`}
            title={isPlaying ? 'Pause auto-play' : 'Play timeline animation'}
          >
            {isPlaying ? <Pause size={10} className="fill-slate-600" /> : <Play size={10} className="fill-slate-600 ml-0.5" />}
          </button>
          
          <div className="flex items-center gap-1 text-slate-500">
            <Calendar size={12} className="text-slate-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono-tech">
              Activity_Timeline
            </h3>
          </div>
        </div>

        {/* Date window & Diff chips (Overhaul 3) */}
        <div className="flex items-center gap-3 text-[9px] uppercase font-bold tracking-wider text-slate-500">
          {/* Diff edge indicators */}
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono-tech">
              +{addedDiff} Added
            </span>
            <span className="px-1.5 py-0.5 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 font-mono-tech">
              -{prunedDiff} Pruned
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono-tech">
            <span>Window:</span>
            <span className="text-blue-600 font-bold">
              {formatDateReadable(startDate)}
            </span>
            <span className="text-slate-400 font-normal">to</span>
            <span className="text-blue-600 font-bold">
              {formatDateReadable(endDate)}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono-tech">
            <span>Links:</span>
            <span className="text-blue-600 font-bold">
              {filteredCount} / {totalCount}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts chart */}
      <div className="h-16 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 2, right: 5, left: -32, bottom: 0 }}>
            <XAxis dataKey="label" fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
            <YAxis fontSize={8} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#ffffff', borderColor: '#cbd5e1', borderRadius: '4px', fontSize: '9px' }}
              labelStyle={{ color: '#475569', fontWeight: 'bold' }}
              itemStyle={{ color: '#2563eb' }}
            />
            <Bar 
              dataKey="events" 
              radius={[2, 2, 0, 0]}
              fill="#2563eb"
              fillOpacity={0.6}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Slider inputs */}
      <div className="relative pt-1 px-1 flex flex-col gap-2">
        <div className="relative h-1.5 rounded-sm bg-slate-100 border border-slate-200">
          <div 
            className="absolute h-full bg-blue-500/15"
            style={{
              left: `${(startIndex / (dateMap.length - 1)) * 100}%`,
              right: `${100 - (endIndex / (dateMap.length - 1)) * 100}%`
            }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={dateMap.length - 1}
          value={startIndex}
          onChange={handleStartSlider}
          className="absolute -top-1 w-full h-4 opacity-0 cursor-pointer pointer-events-auto z-10"
        />

        <input
          type="range"
          min={0}
          max={dateMap.length - 1}
          value={endIndex}
          onChange={handleEndSlider}
          className="absolute -top-1 w-full h-4 opacity-0 cursor-pointer pointer-events-auto z-10"
        />

        <div className="flex justify-between text-[8px] text-slate-400 font-mono-tech px-1">
          {chartData.map((d) => (
            <span 
              key={d.date} 
              className={`${
                d.date === startDate || d.date === endDate 
                  ? 'text-blue-600 font-bold' 
                  : ''
              }`}
            >
              |
            </span>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 text-[8px] text-slate-400 font-semibold px-1 uppercase font-mono-tech">
        <AlertCircle size={10} className="text-slate-400 shrink-0" />
        <span>Use the play toggle to animate the temporal communications diff window.</span>
      </div>
    </div>
  );
}
