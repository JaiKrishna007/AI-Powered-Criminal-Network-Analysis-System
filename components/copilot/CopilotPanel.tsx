'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Send, 
  AlertOctagon, 
  FileText,
  Network,
  RefreshCw
} from 'lucide-react';
import { CopilotMessage } from '@/lib/client-contracts/contracts';

interface CopilotPanelProps {
  caseId: string;
  onGraphFocus: (graphRequest: NonNullable<CopilotMessage['graph_request']>) => void;
  onSelectEvidence: (evId: string) => void;
}

export default function CopilotPanel({
  caseId,
  onGraphFocus,
  onSelectEvidence
}: CopilotPanelProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/cases/${caseId}/copilot`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load chat history', err);
      }
    }
    fetchHistory();
  }, [caseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setLoading(true);

    const tempUserMsg: CopilotMessage = {
      id: `TEMP-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/cases/${caseId}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      if (res.ok) {
        const assistantMsg = await res.json();
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\[[A-Z0-9-]{3,12}\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        const evId = part.slice(1, -1);
        return (
          <button
            key={index}
            onClick={() => onSelectEvidence(evId)}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-sm bg-slate-50 border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 hover:text-slate-900 transition text-[9px] mx-0.5 font-mono-tech"
          >
            <FileText size={10} className="text-slate-400" />
            <span>{evId}</span>
          </button>
        );
      }
      return <span key={index} className="whitespace-pre-line">{part}</span>;
    });
  };

  return (
    <div className="w-96 border-l border-slate-300 bg-white flex flex-col h-full z-10 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-300 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit size={16} className="text-blue-600 animate-pulse" />
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono-tech">
            Forensic_Copilot
          </h2>
        </div>
        <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm uppercase font-mono-tech">
          RAG_INDEXED
        </span>
      </div>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          // Check for Insufficient Evidence state for FE-T06
          const isUncertain = !isUser && msg.content.includes('INSUFFICIENT EVIDENCE');
          
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 max-w-[88%] ${
                isUser ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Msg bubble container */}
              <div
                className={`p-3 rounded-md text-xs leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-none border border-blue-700'
                    : isUncertain
                    ? 'bg-amber-50/60 border border-amber-300 text-amber-900 rounded-bl-none shadow-sm' // FE-T06 Safe Uncertainty style (Overhaul 8)
                    : 'bg-white border border-slate-300 text-slate-800 rounded-bl-none shadow-sm'
                }`}
              >
                {/* Render content */}
                {isUser ? msg.content : renderMessageContent(msg.content)}

                {/* Grounding limitations */}
                {!isUser && msg.limitations && msg.limitations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-[8px] text-slate-400 space-y-1">
                    <span className="flex items-center gap-1 font-bold text-slate-500 uppercase tracking-wide font-mono-tech">
                      <AlertOctagon size={10} className="text-slate-400 shrink-0" /> LIMITATIONS:
                    </span>
                    <ul className="list-disc pl-3.5 space-y-0.5">
                      {msg.limitations.map((lim, i) => (
                        <li key={i} className="leading-snug">{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Graph Focus Action triggers */}
                {!isUser && msg.graph_request && (
                  <button
                    onClick={() => onGraphFocus(msg.graph_request!)}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-sm bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-bold uppercase transition font-mono-tech"
                  >
                    <Network size={11} className="text-slate-500 shrink-0" />
                    <span>Focus Subgraph in Canvas</span>
                  </button>
                )}
              </div>
              
              <span className="text-[8px] text-slate-400 font-mono-tech px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs p-3 rounded-md bg-white border border-slate-300 mr-auto max-w-[85%] rounded-bl-none shadow-sm">
            <RefreshCw size={12} className="animate-spin text-blue-600 shrink-0" />
            <span className="font-mono-tech text-[10px]">Grounded vector lookup...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input query panel */}
      <form 
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-300 bg-slate-50 flex gap-2 shrink-0"
      >
        <textarea
          rows={1}
          placeholder="Ask: e.g. How is Rohan connected to David?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          className="flex-1 px-3 py-2 text-xs font-semibold technical-input focus:outline-none placeholder-slate-400 resize-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white flex items-center justify-center shrink-0 shadow-sm transition"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
