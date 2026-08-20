'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Data = {
  date: string;
  stats: {
    totalLabourers: number;
    present: number;
    clockedIn: number;
    totalMinutes: number;
    breakfast: number;
    lunch: number;
    dinner: number;
  };
  mealApplicants: { breakfast: string[]; lunch: string[]; dinner: string[] };
};

function worked(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function LabourOperationsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(async () => {
    const response = await fetch('/api/labour/admin-overview', { cache: 'no-store' });
    if (response.ok) setData(await response.json());
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <section className="rounded-2xl border border-flora-border bg-flora-dark p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#4E9D82]">
            Labour operations
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-100">
            Attendance and daily food
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Live labour clock status and meal counts for today.
          </p>
        </div>
        <Link
          href="/attendance/labour"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-flora-border bg-flora-card px-3.5 py-2 text-xs font-bold text-slate-100 transition hover:bg-flora-darker"
        >
          Open overview
        </Link>
      </div>

      {data ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-flora-border bg-flora-darker p-3">
            <p className="text-[10px] uppercase font-bold text-slate-400">Present</p>
            <p className="mt-1 text-xl font-black text-slate-100">
              {data.stats.present}/{data.stats.totalLabourers}
            </p>
          </div>
          <div className="rounded-xl border border-flora-border bg-flora-darker p-3">
            <p className="text-[10px] uppercase font-bold text-slate-400">Working now</p>
            <p className="mt-1 text-xl font-black text-sky-600 dark:text-sky-300">
              {data.stats.clockedIn}
            </p>
          </div>
          <div className="rounded-xl border border-flora-border bg-flora-darker p-3">
            <p className="text-[10px] uppercase font-bold text-slate-400">Worked today</p>
            <p className="mt-1 text-xl font-black text-amber-600 dark:text-amber-200">
              {worked(data.stats.totalMinutes)}
            </p>
          </div>
          <div className="rounded-xl border border-flora-border bg-flora-darker p-3">
            <p className="text-[10px] uppercase font-bold text-slate-400">Meals requested</p>
            <p className="mt-1 text-sm font-black text-emerald-600 dark:text-emerald-200">
              B {data.stats.breakfast} · L {data.stats.lunch} · D {data.stats.dinner}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 h-20 animate-pulse rounded-xl bg-flora-darker" />
      )}
    </section>
  );
}
