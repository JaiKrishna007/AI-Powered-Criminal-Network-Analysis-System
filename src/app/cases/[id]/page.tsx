"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Network, FileText, Database, Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

export default function CaseWorkspacePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Hello Investigator. I have access to Qdrant vector memory and Neo4j graph structure for this case. How can I assist you with this network analysis?' }
  ]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchCase();
    }
  }, [status, router, id]);

  const fetchCase = async () => {
    try {
      const res = await fetch(`/api/cases/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCaseData(data.case);
      }
    } catch (error) {
      console.error("Failed to fetch case", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput("");
    setIsCopilotLoading(true);

    try {
      const res = await fetch(`/api/cases/${id}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage, focusEntityId: null })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Error communicating with AI Copilot." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "An unexpected error occurred." }]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500 animate-pulse text-lg">Loading Case Workspace...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 p-8">
        <Shield size={48} className="mb-4 text-slate-300" />
        <h2 className="text-xl font-bold mb-2">Access Denied or Not Found</h2>
        <p className="mb-6">You do not have permission to view this case, or it does not exist.</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col h-screen overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">{caseData.title}</h1>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                {caseData.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium tracking-wide flex items-center gap-2">
              <Shield size={12} /> {caseData.classification.replace('_', ' ')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link 
            href={`/cases/${id}/resolution`}
            className="bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Database size={16} />
            Resolution Queue
          </Link>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm transition-all flex items-center gap-2">
            <FileText size={16} />
            Upload Evidence
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Evidence & Entities */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Database size={18} className="text-slate-400" />
              Case Directory
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Evidence Sources</h4>
              <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded p-4 text-center">
                No evidence ingested yet.
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Extracted Entities</h4>
              <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded p-4 text-center">
                Graph is empty.
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Copilot & Graph */}
        <div className="flex-1 flex flex-col relative bg-slate-100/50">
          {/* Graph Visualization Area */}
          <div className="absolute inset-0 z-0 flex items-center justify-center p-8">
            <div className="text-center opacity-40">
              <Network size={120} className="mx-auto mb-4 text-slate-300" strokeWidth={1} />
              <h2 className="text-2xl font-light text-slate-500">Graph Database Uninitialized</h2>
              <p className="text-slate-400 mt-2 max-w-md mx-auto">Upload evidence documents to automatically extract nodes and edges for the investigation.</p>
            </div>
          </div>

          {/* D3 AI Copilot Overlay */}
          <div className="absolute top-4 right-4 w-96 h-[calc(100%-2rem)] bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl flex flex-col z-10 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} />
                <h3 className="font-bold tracking-wide">D3 Investigator Copilot</h3>
              </div>
              <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                Active
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-900 rounded-tl-none shadow-sm">
                <p>Hello Investigator. I am synchronized with <strong>{caseData.title}</strong>.</p>
              </div>
              
              {messages.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-lg text-sm shadow-sm ${msg.role === 'user' ? 'bg-white border border-slate-200 ml-8 rounded-tr-none' : 'bg-blue-50 border border-blue-100 mr-8 rounded-tl-none text-blue-900 whitespace-pre-wrap'}`}>
                  {msg.content}
                </div>
              ))}
              
              {isCopilotLoading && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-900 mr-8 rounded-tl-none shadow-sm flex items-center gap-2 w-max">
                  <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                  Analyzing graph...
                </div>
              )}
            </div>
            
            <div className="p-3 bg-white border-t border-slate-200">
              <form onSubmit={handleCopilotSubmit} className="relative">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about entities, links, or request hypotheses..." 
                  disabled={isCopilotLoading}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner disabled:opacity-50"
                />
                <button 
                  type="submit" 
                  disabled={isCopilotLoading || !chatInput.trim()}
                  className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  <ArrowLeft size={16} className="rotate-180" />
                </button>
              </form>
              <div className="mt-2 text-[10px] text-center text-slate-400">
                Copilot synthesizes exact Database relationships & Vector evidence.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
