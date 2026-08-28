"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusCircle, Search, FolderOpen, Briefcase, FileText } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchCases();
    }
  }, [status, router]);

  const fetchCases = async () => {
    try {
      const res = await fetch("/api/cases");
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
      }
    } catch (error) {
      console.error("Failed to fetch cases", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500 animate-pulse text-lg">Loading workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Briefcase size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">AI-Powered Network Analysis</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Investigator Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full flex items-center gap-2 border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            {session?.user?.name} 
            <span className="text-slate-400 font-normal">({(session?.user as any)?.role})</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Active Cases</h2>
            <p className="text-slate-500 mt-1">Manage and analyze your assigned investigations.</p>
          </div>
          <Link 
            href="/cases/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 hover:shadow-md active:scale-95"
          >
            <PlusCircle size={20} />
            New Case
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <FolderOpen className="text-slate-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No active cases</h3>
              <p className="text-slate-500 mb-6">You don't have any cases assigned to you right now.</p>
              <Link 
                href="/cases/new" 
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors inline-flex items-center gap-2"
              >
                <PlusCircle size={18} />
                Create your first case
              </Link>
            </div>
          ) : (
            cases.map((c) => (
              <Link key={c._id} href={`/cases/${c._id}`}>
                <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all group cursor-pointer h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                        {c.classification.replace('_', ' ')}
                      </span>
                      {c.status === 'OPEN' && (
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                          OPEN
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">{c.title}</h3>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-6 flex-grow">{c.description || 'No description provided.'}</p>
                  
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                    <div className="text-xs text-slate-400 font-medium">
                      Updated {new Date(c.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="text-blue-600 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                      Open Workspace <span>&rarr;</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
