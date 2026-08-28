"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, ShieldAlert } from "lucide-react";

export default function NewCasePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classification, setClassification] = useState("CASE_RESTRICTED");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, classification }),
      });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create case");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-6 font-medium">
          <ArrowLeft size={18} /> Back to Workspace
        </Link>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 p-6">
            <h1 className="text-2xl font-bold text-slate-900">Create Investigation Case</h1>
            <p className="text-slate-500 mt-1">Initialize a new workspace for evidence and graph analysis.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 border border-red-100">
                <ShieldAlert className="mt-0.5 flex-shrink-0" size={18} />
                <p className="font-medium text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Case Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Operation Crimson Syndicate"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Description & Scope
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of the intelligence target or known activities..."
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-y"
              />
            </div>

            <div>
              <label htmlFor="classification" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Data Classification
              </label>
              <select
                id="classification"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-white"
              >
                <option value="PUBLIC_DEMO">PUBLIC / DEMO (Synthetic only)</option>
                <option value="CASE_RESTRICTED">CASE RESTRICTED (Standard)</option>
                <option value="SENSITIVE">SENSITIVE (Requires additional policy)</option>
                <option value="SECRET">SECRET (Highly restricted)</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Classification affects which users can search or retrieve evidence attached to this case.
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Initializing...
                  </span>
                ) : (
                  <>
                    <Save size={18} /> Create Workspace
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
