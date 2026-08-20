'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

interface ActivityLog {
  id: string;
  actorName: string;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  outcome: string;
  statusCode: number | null;
  changedData: unknown;
  previousData: unknown;
  newData: unknown;
  ipAddress: string | null;
  occurredAt: string;
}

interface LogResponse {
  logs: ActivityLog[];
  filters: { roles: string[]; categories: string[] };
  pagination: { page: number; total: number; totalPages: number };
}

function formatJson(value: unknown) {
  if (!value) return '-';
  return JSON.stringify(value, null, 2);
}

export default function AuditLogsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (role) params.set('role', role);
    if (category) params.set('category', category);
    if (outcome) params.set('outcome', outcome);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [category, from, outcome, page, role, search, to]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/audit-logs?${query}`);
        if (response.ok) setData(await response.json());
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, session]);

  if (!session) return null;
  const roleName = session.user?.role?.name || '';
  if (roleName !== 'Owner' && roleName !== 'IT/Admin') {
    return <div className="p-8 text-center text-rose-300">Access denied. Owner or IT/Admin only.</div>;
  }

  const resetPage = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Complete Activity Logs</h1>
          <p className="mt-1 text-sm text-slate-400">Append-only record of edits, approvals, financial actions, security events, and role activity.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-flora-sage">{data?.pagination.total || 0}</div>
          <div className="text-[10px] font-bold uppercase text-slate-500">Recorded actions</div>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-flora-border bg-flora-dark/90 p-4 md:grid-cols-2 xl:grid-cols-6">
        <input value={search} onChange={(event) => resetPage(setSearch)(event.target.value)} placeholder="Search actor, action, record..." className="rounded-md border border-flora-border bg-flora-darker px-3 py-2 text-sm text-slate-100 outline-none focus:border-flora-sage xl:col-span-2" />
        <select value={role} onChange={(event) => resetPage(setRole)(event.target.value)} className="rounded-md border border-flora-border bg-flora-darker px-3 py-2 text-sm text-slate-200">
          <option value="">All roles</option>
          {data?.filters.roles.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={category} onChange={(event) => resetPage(setCategory)(event.target.value)} className="rounded-md border border-flora-border bg-flora-darker px-3 py-2 text-sm text-slate-200">
          <option value="">All categories</option>
          {data?.filters.categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={outcome} onChange={(event) => resetPage(setOutcome)(event.target.value)} className="rounded-md border border-flora-border bg-flora-darker px-3 py-2 text-sm text-slate-200">
          <option value="">All outcomes</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
        </select>
        <button onClick={() => { setSearch(''); setRole(''); setCategory(''); setOutcome(''); setFrom(''); setTo(''); setPage(1); }} className="rounded-md border border-flora-border px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-flora-card">Clear</button>
        <label className="text-xs text-slate-400">From<input type="date" value={from} onChange={(event) => resetPage(setFrom)(event.target.value)} className="mt-1 w-full rounded-md border border-flora-border bg-flora-darker px-3 py-2 text-sm text-slate-200" /></label>
        <label className="text-xs text-slate-400">To<input type="date" value={to} onChange={(event) => resetPage(setTo)(event.target.value)} className="mt-1 w-full rounded-md border border-flora-border bg-flora-darker px-3 py-2 text-sm text-slate-200" /></label>
      </div>

      <div className="overflow-hidden rounded-lg border border-flora-border bg-flora-dark/90">
        {loading ? <div className="p-10 text-center text-slate-400">Loading activity logs...</div> : !data?.logs.length ? <div className="p-10 text-center text-slate-500">No activity found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-flora-border bg-flora-darker text-[10px] uppercase text-slate-400">
                <tr><th className="px-4 py-3">Date &amp; Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Changes</th></tr>
              </thead>
              <tbody className="divide-y divide-flora-border/60">
                {data.logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-flora-card">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(log.occurredAt).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}</td>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-100">{log.actorName}</div><div className="text-[10px] text-slate-500">{log.actorEmail || '-'}</div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-flora-sage">{log.actorRole}</td>
                    <td className="px-4 py-3"><div className="font-bold text-slate-200">{log.action.replace(/_/g, ' ')}</div><div className="mt-1 text-[10px] text-slate-500">{log.category}</div></td>
                    <td className="px-4 py-3 text-slate-300">{log.entityType || '-'}{log.entityId ? <div className="max-w-[180px] truncate text-[10px] text-slate-500">{log.entityId}</div> : null}</td>
                    <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-[10px] font-bold ${log.outcome === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{log.outcome}</span></td>
                    <td className="max-w-[320px] px-4 py-3">
                      <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="text-left font-semibold text-flora-sage hover:underline">{expandedId === log.id ? 'Hide details' : 'View details'}</button>
                      {expandedId === log.id && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-flora-darker p-3 text-[10px] text-slate-300">{log.summary || ''}{'\n'}{formatJson({ changed: log.changedData, before: log.previousData, after: log.newData, ip: log.ipAddress, status: log.statusCode })}</pre>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-flora-border px-4 py-2 text-sm text-slate-300 disabled:opacity-40">Previous</button>
        <span className="text-xs text-slate-400">Page {data?.pagination.page || 1} of {data?.pagination.totalPages || 1}</span>
        <button disabled={page >= (data?.pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-flora-border px-4 py-2 text-sm text-slate-300 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
