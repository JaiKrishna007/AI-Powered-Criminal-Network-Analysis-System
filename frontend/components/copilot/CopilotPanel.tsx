'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Send, 
  AlertOctagon, 
  Network, 
  RefreshCw, 
  FileText,
  AlertCircle
} from 'lucide-react';
import type { CopilotMessage } from '@/lib/client-contracts/contracts';
import { d2 } from '@/src/api/d2';

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
  const [messages, setMessages] = useState<CopilotMessage[]>([{
    id: `sys-${Date.now()}`,
    role: 'assistant',
    content: 'Hello Investigator, I am the NETRA Copilot. How can I assist you with this case today?',
    timestamp: new Date().toISOString()
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const assistantMsg = await d2.copilot.ask(caseId, userText);
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg as any]);
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
            type="button"
            onClick={() => onSelectEvidence(evId)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold hover:bg-blue-600 hover:text-white transition text-[9px] mx-0.5 shadow-sm"
          >
            <FileText size={9} />
            <span>{evId}</span>
          </button>
        );
      }
      return <span key={index} className="whitespace-pre-line">{part}</span>;
    });
  };

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col h-full z-10 shadow-sm">
      {/* Title Panel Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-[#2563EB]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Investigator Copilot
          </h2>
        </div>
        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase">
          Grounded RAG
        </span>
      </div>

      {/* Conversations Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          // Check for insufficient evidence triggers (FE-T06)
          const isInsufficient = !isUser && (
            msg.content.toUpperCase().includes('INSUFFICIENT EVIDENCE') || 
            msg.content.toUpperCase().includes('INSUFFICIENT_EVIDENCE') || 
            msg.content.toUpperCase().includes('NO RELEVANT EVIDENCE')
          );

          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1.5 max-w-[85%] ${
                isUser ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Message bubble */}
              {isInsufficient ? (
                <div className="p-3.5 rounded-lg border bg-amber-50 border-amber-250 text-amber-900 rounded-bl-none shadow-sm flex items-start gap-2.5">
                  <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={14} />
                  <div className="text-xs leading-normal">
                    <p className="font-bold text-[9px] uppercase tracking-wider text-amber-800">Grounding Uncertainty</p>
                    <p className="mt-1 font-semibold text-slate-650">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div
                  className={`p-3 rounded-lg text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#2563EB] text-white rounded-br-none shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                  }`}
                >
                  {isUser ? msg.content : renderMessageContent(msg.content)}

                  {/* XAI Grounding limitations section (FE-T06 / AI-05) */}
                  {!isUser && msg.limitations && msg.limitations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 text-[9px] text-slate-500 space-y-1.5">
                      <span className="flex items-center gap-1 font-bold text-amber-650 uppercase tracking-wide">
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
                      className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-700 hover:text-white text-[10px] font-bold transition shadow-sm"
                    >
                      <Network size={12} />
                      <span>View connection in Graph</span>
                    </button>
                  )}
                </div>
              )}
              <span className="text-[8px] text-slate-400 font-mono px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs p-3 rounded-lg bg-white border border-slate-200 mr-auto max-w-[85%] rounded-bl-none shadow-sm">
            <RefreshCw size={14} className="animate-spin text-blue-500" />
            <span>Consulting case evidence index...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input query panel form */}
      <form 
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-200 bg-white flex gap-2 shrink-0"
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
          className="flex-1 px-3.5 py-2.5 rounded-lg text-xs bg-slate-50 border border-slate-250 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 resize-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-lg bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-450 text-white flex items-center justify-center shrink-0 shadow-sm transition"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
