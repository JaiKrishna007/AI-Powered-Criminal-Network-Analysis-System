"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Clock, AlertTriangle } from "lucide-react";

// Mock data for the review queue
const initialCandidates = [
  {
    id: "RES-001",
    confidence: 0.85,
    reasons: ["Exact name match", "Shared case context"],
    entities: [
      { type: "PERSON", canonical_name: "Rahul Sharma", aliases: ["R. Sharma"], id: "P102" },
      { type: "PERSON", canonical_name: "Rahul Sharma", aliases: ["Rahul S."], id: "P899" }
    ],
    status: "PENDING"
  }
];

export default function ResolutionQueuePage({ params }: { params: { id: string } }) {
  const [candidates, setCandidates] = useState(initialCandidates);

  const handleDecision = (id: string, decision: 'ACCEPTED' | 'REJECTED' | 'DEFERRED') => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    // API call would go here
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <div className="max-w-4xl mx-auto">
        <Link href={`/cases/${params.id}`} className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-6 font-medium">
          <ArrowLeft size={18} /> Back to Case Workspace
        </Link>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="border-b border-slate-100 bg-slate-50/50 p-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Entity Resolution Queue</h1>
              <p className="text-slate-500 mt-1">Review ambiguous entity matches before they are merged in the graph.</p>
            </div>
            <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border border-amber-200">
              <AlertTriangle size={18} />
              {candidates.length} Pending Reviews
            </div>
          </div>

          <div className="p-6">
            {candidates.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Check size={48} className="mx-auto text-emerald-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900">Queue is empty</h3>
                <p>All entity resolution candidates have been reviewed.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {candidates.map(candidate => (
                  <div key={candidate.id} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded text-xs uppercase tracking-wider">
                            {candidate.entities[0].type}
                          </span>
                          <span className={`font-bold text-sm px-2 py-1 rounded ${
                            candidate.confidence > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {(candidate.confidence * 100).toFixed(0)}% Match
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          <strong>Reasons:</strong> {candidate.reasons.join(", ")}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button onClick={() => handleDecision(candidate.id, 'ACCEPTED')} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded shadow transition-colors" title="Accept Merge">
                          <Check size={18} />
                        </button>
                        <button onClick={() => handleDecision(candidate.id, 'DEFERRED')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded shadow transition-colors" title="Defer Review">
                          <Clock size={18} />
                        </button>
                        <button onClick={() => handleDecision(candidate.id, 'REJECTED')} className="bg-red-600 hover:bg-red-700 text-white p-2 rounded shadow transition-colors" title="Reject Merge">
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Entity A</h4>
                        <p className="font-medium text-slate-900">{candidate.entities[0].canonical_name}</p>
                        <p className="text-sm text-slate-500 mt-1">Aliases: {candidate.entities[0].aliases.join(", ") || "None"}</p>
                        <p className="text-xs text-slate-400 mt-2 font-mono">{candidate.entities[0].id}</p>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Entity B</h4>
                        <p className="font-medium text-slate-900">{candidate.entities[1].canonical_name}</p>
                        <p className="text-sm text-slate-500 mt-1">Aliases: {candidate.entities[1].aliases.join(", ") || "None"}</p>
                        <p className="text-xs text-slate-400 mt-2 font-mono">{candidate.entities[1].id}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
