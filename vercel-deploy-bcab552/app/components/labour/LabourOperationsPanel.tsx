'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Data = { date: string; stats: { totalLabourers: number; present: number; clockedIn: number; totalMinutes: number; breakfast: number; lunch: number; dinner: number }; mealApplicants: { breakfast: string[]; lunch: string[]; dinner: string[] } };

function worked(minutes: number) { return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }

export default function LabourOperationsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(async () => { const response = await fetch('/api/labour/admin-overview', { cache: 'no-store' }); if (response.ok) setData(await response.json()); }, []);
  useEffect(() => { load(); const timer = window.setInterval(load, 10000); return () => window.clearInterval(timer); }, [load]);

  return <section className="rounded-2xl border border-flora-border bg-flora-dark/90 p-4 shadow-xl sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Labour operations</p><h2 className="mt-1 text-lg font-black text-slate-100">Attendance and daily food</h2><p className="mt-1 text-xs text-slate-400">Live labour clock status and meal counts for today.</p></div><Link href="/attendance/labour" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">Open overview</Link></div>{data ? <><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase text-slate-500">Present</p><p className="mt-1 text-xl font-black text-white">{data.stats.present}/{data.stats.totalLabourers}</p></div><div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3"><p className="text-[10px] uppercase text-sky-300/70">Working now</p><p className="mt-1 text-xl font-black text-sky-300">{data.stats.clockedIn}</p></div><div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3"><p className="text-[10px] uppercase text-amber-300/70">Worked today</p><p className="mt-1 text-xl font-black text-amber-200">{worked(data.stats.totalMinutes)}</p></div><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-[10px] uppercase text-emerald-300/70">Meals requested</p><p className="mt-1 text-sm font-black text-emerald-200">B {data.stats.breakfast} · L {data.stats.lunch} · D {data.stats.dinner}</p></div></div></> : <div className="mt-5 h-20 animate-pulse rounded-xl bg-white/5" />}</section>;
}
