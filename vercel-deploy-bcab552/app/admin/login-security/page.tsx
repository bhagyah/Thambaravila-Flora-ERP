'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

type LoginEvent = {
  id: string;
  attemptedEmail: string | null;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  locationGranted: boolean;
  userAgent: string | null;
  deviceFingerprint: string | null;
  createdAt: string;
  user: { name: string; email: string; role: { name: string } } | null;
};

type ResponseData = {
  events: LoginEvent[];
  pagination: { page: number; total: number; totalPages: number };
};

export default function LoginSecurityPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ResponseData | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [page, search, status]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/admin/login-security?${query}`, { cache: 'no-store' });
      if (response.ok) setData(await response.json());
    }, 200);
    return () => clearTimeout(timer);
  }, [query, session]);

  if (!session) return null;
  if (!['Owner', 'IT/Admin'].includes(session.user.role.name)) {
    return <div className="p-8 text-center text-rose-300">Access denied. Owner or IT/Admin only.</div>;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <div><h1 className="text-2xl font-bold text-slate-100">Login Security Events</h1><p className="mt-1 text-sm text-slate-400">Every login attempt with IP, browser location, device fingerprint, result, user, and timestamp.</p></div>
      <div className="grid gap-3 rounded-lg border border-flora-border bg-flora-dark/90 p-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search email, user, IP, reason..." className="min-h-11 rounded-md border border-flora-border bg-flora-darker px-3 text-sm text-slate-100" />
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="min-h-11 rounded-md border border-flora-border bg-flora-darker px-3 text-sm text-slate-200"><option value="">All attempts</option><option value="success">Successful</option><option value="failed">Failed</option></select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-flora-border bg-flora-dark/90">
        <table className="min-w-[1180px] w-full text-left text-xs"><thead className="border-b border-flora-border bg-flora-darker text-[10px] uppercase text-slate-400"><tr><th className="px-4 py-3">Date &amp; Time</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">IP Address</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Reason</th></tr></thead>
          <tbody className="divide-y divide-flora-border/60">{data?.events.map((event) => <tr key={event.id} className="align-top hover:bg-flora-card"><td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(event.createdAt).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}</td><td className="px-4 py-3"><div className="font-semibold text-slate-100">{event.user?.name || 'Unknown account'}</div><div className="text-[10px] text-slate-500">{event.attemptedEmail || event.user?.email || '-'}</div><div className="text-[10px] text-flora-sage">{event.user?.role.name || '-'}</div></td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-[10px] font-bold ${event.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{event.success ? 'SUCCESS' : 'FAILED'}</span></td><td className="px-4 py-3 font-mono text-slate-300">{event.ipAddress || '-'}</td><td className="px-4 py-3 text-slate-300">{event.locationGranted && event.latitude !== null && event.longitude !== null ? <><div>{event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</div><div className="text-[10px] text-slate-500">Accuracy {Math.round(event.locationAccuracy || 0)} m</div></> : <span className="text-rose-300">Not granted</span>}</td><td className="max-w-[280px] px-4 py-3"><div className="truncate font-mono text-[10px] text-flora-sage">{event.deviceFingerprint || '-'}</div><div className="mt-1 line-clamp-2 text-[10px] text-slate-500">{event.userAgent || '-'}</div></td><td className="max-w-[220px] px-4 py-3 text-slate-400">{event.failureReason || '-'}</td></tr>)}</tbody>
        </table>
        {!data?.events.length && <div className="p-10 text-center text-slate-500">No login events found.</div>}
      </div>
      <div className="flex items-center justify-between"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-11 rounded-md border border-flora-border px-4 text-slate-300 disabled:opacity-40">Previous</button><span className="text-xs text-slate-400">Page {data?.pagination.page || 1} of {data?.pagination.totalPages || 1}</span><button disabled={page >= (data?.pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-md border border-flora-border px-4 text-slate-300 disabled:opacity-40">Next</button></div>
    </div>
  );
}
