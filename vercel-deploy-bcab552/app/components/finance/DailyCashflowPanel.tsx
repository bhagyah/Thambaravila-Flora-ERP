'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatLKR } from '@/lib/utils/formatters';

interface CashflowRecord {
  id: string;
  direction: 'IN' | 'OUT';
  amount: number;
  occurredAt: string;
  title: string;
  category: string;
}

interface CashflowData {
  summary: { received: number; paid: number; net: number; transactions: number };
  records: CashflowRecord[];
}

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DailyCashflowPanel() {
  const [data, setData] = useState<CashflowData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const date = localDateKey();
    fetch(`/api/finance/history?from=${date}&to=${date}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load daily cashflow.');
        setData(await response.json());
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setData(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <section className="rounded-2xl border border-emerald-400/20 bg-flora-dark/90 p-4 shadow-xl sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Today cashflow</p>
          <h2 className="mt-1 text-lg font-black text-slate-100">Daily payments and receipts</h2>
          <p className="mt-1 text-xs text-slate-400">Live money received, money paid, and net movement.</p>
        </div>
        <Link href="/accountant/cashflow-history" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-400/20">Open history</Link>
      </div>

      {loading ? <div className="mt-5 h-28 animate-pulse rounded-xl bg-white/5" /> : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-[10px] uppercase text-emerald-300/70">Received</p><p className="mt-1 text-sm font-black text-emerald-300 sm:text-base">{formatLKR(data?.summary.received || 0)}</p></div>
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3"><p className="text-[10px] uppercase text-rose-300/70">Paid</p><p className="mt-1 text-sm font-black text-rose-300 sm:text-base">{formatLKR(data?.summary.paid || 0)}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase text-slate-500">Net</p><p className={`mt-1 text-sm font-black sm:text-base ${(data?.summary.net || 0) >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>{formatLKR(data?.summary.net || 0)}</p></div>
          </div>
          <div className="mt-4 divide-y divide-white/10">
            {(data?.records || []).slice(0, 4).map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-200">{record.title}</p><p className="text-[11px] text-slate-500">{record.category.replace(/_/g, ' ')}</p></div>
                <span className={`shrink-0 text-sm font-black ${record.direction === 'IN' ? 'text-emerald-300' : 'text-rose-300'}`}>{record.direction === 'IN' ? '+' : '-'}{formatLKR(record.amount)}</span>
              </div>
            ))}
            {!data?.records.length && <p className="py-5 text-center text-xs text-slate-500">No payments or receipts today.</p>}
          </div>
        </>
      )}
    </section>
  );
}
