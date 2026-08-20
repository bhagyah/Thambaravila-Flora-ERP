'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatLKR } from '@/lib/utils/formatters';

interface LiabilityPayment {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  displayStatus: string;
  liability: { id: string; name: string; category: string; isActive: boolean; dueDay: number };
}

export default function ScheduledLiabilityPanel() {
  const [payments, setPayments] = useState<LiabilityPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await fetch('/api/scheduled-liabilities');
      if (response.ok) setPayments((await response.json()).payments || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => ({
    total: payments.reduce((sum, item) => sum + item.amount, 0),
    paid: payments.filter((item) => item.displayStatus === 'PAID').reduce((sum, item) => sum + item.amount, 0),
    outstanding: payments.filter((item) => item.displayStatus !== 'PAID' && item.displayStatus !== 'CANCELLED').reduce((sum, item) => sum + item.amount, 0),
  }), [payments]);

  return (
    <section className="rounded-2xl border border-flora-border bg-flora-dark p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#4E9D82]">Monthly liabilities</p>
          <h2 className="mt-1 text-lg font-black text-slate-100">Scheduled company payments</h2>
          <p className="mt-1 text-xs text-slate-400">Recurring obligations this month. Paid items enter expenses automatically.</p>
        </div>
        <Link href="/accountant/liabilities" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-flora-border bg-flora-card px-3.5 py-2 text-xs font-bold text-slate-100 hover:bg-flora-darker">Manage liabilities</Link>
      </div>

      {loading ? <div className="mt-5 h-16 animate-pulse rounded-xl bg-flora-darker" /> : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-flora-border bg-flora-darker p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400">Scheduled</p>
              <p className="mt-1 text-base font-black text-slate-100">{formatLKR(summary.total)}</p>
            </div>
            <div className="rounded-xl border border-flora-border bg-flora-darker p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400">Paid</p>
              <p className="mt-1 text-base font-black text-emerald-600 dark:text-emerald-300">{formatLKR(summary.paid)}</p>
            </div>
            <div className="rounded-xl border border-flora-border bg-flora-darker p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400">Outstanding</p>
              <p className="mt-1 text-base font-black text-rose-600 dark:text-rose-300">{formatLKR(summary.outstanding)}</p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-flora-border/60">
            {payments.slice(0, 5).map((item) => (
              <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-100">{item.liability.name}</p><p className="text-[11px] text-slate-400">Due {new Date(item.dueDate).toLocaleDateString()} · {item.liability.category}</p></div>
                <div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-sm font-black text-slate-100">{formatLKR(item.amount)}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.displayStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : item.displayStatus === 'OVERDUE' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-200'}`}>{item.displayStatus}</span></div>
              </div>
            ))}
            {!payments.length && <p className="py-4 text-center text-xs text-slate-400">No active monthly liabilities.</p>}
          </div>
        </>
      )}
    </section>
  );
}
