'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Send, 
  HelpCircle, 
  AlertOctagon, 
  ArrowRightCircle, 
  FileText,
  Network,
  RefreshCw
} from 'lucide-react';
import { CopilotMessage } from '@/lib/client-contracts/contracts';

interface CopilotPanelProps {
  caseId: string;
  onGraphFocus: (graphRequest: NonNullable<CopilotMessage['graph_request']>) => void;
  // Triggered when clicking an evidence citation to open its details
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

    // Optimistic UI updates for user message
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
        // Replace temp list or append properly
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse citations like [TXN-8819] and return JSX with click actions (FE-06)
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\[[A-Z0-9-]{3,12}\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        const evId = part.slice(1, -1);
        return (
          <button
            key={index}
            onClick={() => onSelectEvidence(evId)}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-indigo-950 border border-indigo-900/60 text-indigo-400 font-bold hover:bg-indigo-900 hover:text-white transition text-[10px] mx-0.5"
          >
            <FileText size={10} />
            <span>{evId}</span>
          </button>
        );
      }
      return <span key={index} className="whitespace-pre-line">{part}</span>;
    });
  };

  return (
    <div className="w-96 border-l border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col h-full z-10">
      {/* Title Panel Header */}
      <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-indigo-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Investigator Copilot
          </h2>
        </div>
        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded uppercase">
          Grounded RAG
        </span>
      </div>

      {/* Conversations Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1.5 max-w-[85%] ${
                isUser ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Message bubble */}
              <div
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
                }`}
              >
                {isUser ? msg.content : renderMessageContent(msg.content)}

                {/* XAI Grounding limitations section (FE-T06 / AI-05) */}
                {!isUser && msg.limitations && msg.limitations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/80 text-[9px] text-zinc-500 space-y-1.5">
                    <span className="flex items-center gap-1 font-bold text-amber-500 uppercase tracking-wide">
                      <AlertOctagon size={11} /> Grounding limitations
                    </span>
                    <ul className="list-disc pl-3.5 space-y-0.5">
                      {msg.limitations.map((lim, i) => (
                        <li key={i} className="leading-snug">{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Focus graph triggers inside bubble (FE-06) */}
                {!isUser && msg.graph_request && (
                  <button
                    onClick={() => onGraphFocus(msg.graph_request!)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-900/60 text-indigo-400 text-[10px] font-bold transition shadow shadow-black/20"
                  >
                    <Network size={12} />
                    <span>View connection in Graph</span>
                  </button>
                )}
              </div>
              <span className="text-[8px] text-zinc-500 font-mono px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs p-3 rounded-xl bg-zinc-900 border border-zinc-850 mr-auto max-w-[85%] rounded-bl-none">
            <RefreshCw size={14} className="animate-spin text-indigo-500" />
            <span>Consulting case evidence index...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input query panel form */}
      <form 
        onSubmit={handleSubmit}
        className="p-3 border-t border-zinc-800/80 bg-zinc-900/20 backdrop-blur-md flex gap-2 shrink-0"
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
          className="flex-1 px-3.5 py-2.5 rounded-lg text-xs bg-zinc-950 border border-zinc-850 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-100 placeholder-zinc-500 resize-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/10 transition"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
