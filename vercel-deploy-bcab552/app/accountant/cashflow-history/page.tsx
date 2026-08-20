'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { formatLKR } from '@/lib/utils/formatters';

type SourceType = 'RECEIPT' | 'EXPENSE';
type Action = 'EDIT' | 'DELETE';

interface AdjustmentRequest {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  action: Action;
  status: string;
  reason: string;
  proposedAmount?: number | null;
  proposedDate?: string | null;
  proposedDescription?: string | null;
  proposedCategory?: string | null;
  snapshot: Record<string, unknown>;
  requestedBy: { id: string; name: string; role?: { name: string } };
  createdAt: string;
}

interface CashflowRecord {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  direction: 'IN' | 'OUT';
  amount: number;
  occurredAt: string;
  title: string;
  description: string;
  category: string;
  method?: string | null;
  actorName: string;
  reference: string;
  pendingRequest?: AdjustmentRequest | null;
}

interface HistoryData {
  range: { from: string; to: string };
  summary: { received: number; paid: number; net: number; transactions: number };
  records: CashflowRecord[];
  pendingRequests: AdjustmentRequest[];
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthStartKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function dateInput(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function requestLabel(request: AdjustmentRequest) {
  const snapshot = request.snapshot || {};
  return String(snapshot.description || snapshot.paymentStageId || request.sourceId);
}

export default function CashflowHistoryPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [preset, setPreset] = useState<'TODAY' | 'MONTH' | 'CUSTOM'>('TODAY');
  const [from, setFrom] = useState(dateKey());
  const [to, setTo] = useState(dateKey());
  const [customFrom, setCustomFrom] = useState(monthStartKey());
  const [customTo, setCustomTo] = useState(dateKey());
  const [selected, setSelected] = useState<CashflowRecord | null>(null);
  const [action, setAction] = useState<Action>('EDIT');
  const [amount, setAmount] = useState('');
  const [recordDate, setRecordDate] = useState(dateKey());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const role = session?.user?.role?.name || '';
  const permitted = role === 'Owner' || role === 'Accountant';
  const isOwner = role === 'Owner';

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/finance/history?from=${from}&to=${to}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load cashflow history.');
      setData(result);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Failed to load cashflow history.', error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && permitted) load();
  }, [status, permitted, from, to]);

  const selectPreset = (next: 'TODAY' | 'MONTH') => {
    setPreset(next);
    setFrom(next === 'TODAY' ? dateKey() : monthStartKey());
    setTo(dateKey());
  };

  const applyCustom = (event: React.FormEvent) => {
    event.preventDefault();
    if (customFrom > customTo) {
      setMessage({ text: 'Start date must be before end date.', error: true });
      return;
    }
    setPreset('CUSTOM');
    setFrom(customFrom);
    setTo(customTo);
  };

  const openAction = (record: CashflowRecord, nextAction: Action) => {
    setSelected(record);
    setAction(nextAction);
    setAmount((record.amount / 100).toFixed(2));
    setRecordDate(dateInput(record.occurredAt));
    setDescription(record.description);
    setCategory(record.category);
    setReason('');
    setMessage(null);
  };

  const closeAction = () => {
    setSelected(null);
    setReason('');
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (isOwner && !window.confirm(`Confirm ${action.toLowerCase()} for this financial record?`)) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/finance/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: selected.sourceType,
          sourceId: selected.sourceId,
          action,
          reason,
          proposedAmount: action === 'EDIT' ? Math.round(Number(amount) * 100) : null,
          proposedDate: action === 'EDIT' ? recordDate : null,
          proposedDescription: action === 'EDIT' ? description : null,
          proposedCategory: action === 'EDIT' ? category : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit change.');
      setMessage({ text: result.applied ? 'Owner confirmed and change applied.' : 'Request sent to Owner for confirmation.' });
      closeAction();
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not submit change.', error: true });
    } finally {
      setSubmitting(false);
    }
  };

  const decide = async (request: AdjustmentRequest, decision: 'APPROVED' | 'REJECTED') => {
    const note = decision === 'REJECTED' ? window.prompt('Reason for rejection:') : '';
    if (decision === 'REJECTED' && note === null) return;
    if (decision === 'APPROVED' && !window.confirm(`Approve ${request.action.toLowerCase()} request?`)) return;
    setDecidingId(request.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/finance/adjustments/${request.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decisionNote: note || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not decide request.');
      setMessage({ text: `Request ${decision.toLowerCase()}.` });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not decide request.', error: true });
    } finally {
      setDecidingId(null);
    }
  };

  const rangeLabel = useMemo(() => from === to ? from : `${from} to ${to}`, [from, to]);

  if (status === 'loading') return <div className="p-6 text-slate-300">Loading...</div>;
  if (!session || !permitted) return <div className="mx-auto max-w-2xl p-8 text-center text-slate-300"><h1 className="text-xl font-black text-white">Access restricted</h1><p className="mt-2 text-sm">Owner or Accountant role required.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 text-slate-100 sm:p-5 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard" className="text-xs font-bold text-flora-sage hover:text-white">Back to dashboard</Link>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Payments and receivables history</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Daily cash movement, custom-date history, and Owner-controlled corrections.</p>
        </div>
        <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">Owner + Accountant</span>
      </header>

      {message && <div className={`rounded-xl border p-3 text-sm font-bold ${message.error ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>{message.text}</div>}

      <section className="space-y-3 border-b border-white/10 pb-5">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => selectPreset('TODAY')} className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-black ${preset === 'TODAY' ? 'border-emerald-300 bg-emerald-400 text-slate-950' : 'border-white/10 bg-white/5 text-slate-300'}`}>Today</button>
          <button onClick={() => selectPreset('MONTH')} className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-black ${preset === 'MONTH' ? 'border-emerald-300 bg-emerald-400 text-slate-950' : 'border-white/10 bg-white/5 text-slate-300'}`}>This month</button>
          <form onSubmit={applyCustom} className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white" />
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white" />
            <button className="min-h-11 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-black text-sky-200">Apply dates</button>
          </form>
          <button onClick={load} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300 sm:ml-auto">Refresh</button>
        </div>
        <p className="text-xs text-slate-500">Showing {rangeLabel}</p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4"><p className="text-[10px] font-black uppercase text-emerald-300/70">Received</p><p className="mt-1 text-lg font-black text-emerald-300 sm:text-xl">{formatLKR(data?.summary.received || 0)}</p></div>
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4"><p className="text-[10px] font-black uppercase text-rose-300/70">Paid</p><p className="mt-1 text-lg font-black text-rose-300 sm:text-xl">{formatLKR(data?.summary.paid || 0)}</p></div>
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-4"><p className="text-[10px] font-black uppercase text-sky-300/70">Net movement</p><p className={`mt-1 text-lg font-black sm:text-xl ${(data?.summary.net || 0) >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>{formatLKR(data?.summary.net || 0)}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Transactions</p><p className="mt-1 text-lg font-black text-slate-100 sm:text-xl">{data?.summary.transactions || 0}</p></div>
      </section>

      {isOwner && Boolean(data?.pendingRequests.length) && (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase text-amber-300">Owner confirmation queue</p><h2 className="mt-1 text-lg font-black">Pending financial changes</h2></div><span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-slate-950">{data?.pendingRequests.length}</span></div>
          <div className="mt-4 divide-y divide-white/10">
            {data?.pendingRequests.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0"><p className="font-bold text-slate-100">{request.action} {request.sourceType}: {requestLabel(request)}</p><p className="mt-1 text-xs text-slate-400">{request.requestedBy.name} · {request.reason}</p>{request.proposedAmount ? <p className="mt-1 text-xs text-amber-200">Proposed: {formatLKR(request.proposedAmount)}{request.proposedDate ? ` · ${dateInput(request.proposedDate)}` : ''}</p> : null}</div>
                <div className="flex gap-2"><button disabled={decidingId === request.id} onClick={() => decide(request, 'REJECTED')} className="min-h-11 rounded-xl border border-rose-400/30 px-4 py-2 text-xs font-black text-rose-200 disabled:opacity-50">Reject</button><button disabled={decidingId === request.id} onClick={() => decide(request, 'APPROVED')} className="min-h-11 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">Approve</button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-flora-border bg-flora-dark/90 p-3 shadow-xl sm:p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Transaction history</h2><p className="mt-1 text-xs text-slate-500">Receipts and operating payments ordered by date.</p></div>{loading && <span className="text-xs text-slate-500">Loading...</span>}</div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Details</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Recorded by</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {(data?.records || []).map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-4 text-slate-400">{new Date(record.occurredAt).toLocaleDateString()}<p className="text-[10px] text-slate-600">{new Date(record.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></td>
                  <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${record.direction === 'IN' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>{record.direction === 'IN' ? 'RECEIVED' : 'PAID'}</span></td>
                  <td className="px-3 py-4"><p className="max-w-xs truncate font-bold text-slate-200">{record.title}</p><p className="max-w-xs truncate text-xs text-slate-500">{record.description} · {record.category.replace(/_/g, ' ')}</p><p className="text-[10px] text-slate-600">Ref: {record.reference}</p></td>
                  <td className="px-3 py-4 text-slate-400">{record.method?.replace(/_/g, ' ') || 'Not recorded'}</td>
                  <td className={`px-3 py-4 font-black ${record.direction === 'IN' ? 'text-emerald-300' : 'text-rose-300'}`}>{record.direction === 'IN' ? '+' : '-'}{formatLKR(record.amount)}</td>
                  <td className="px-3 py-4 text-slate-400">{record.actorName}</td>
                  <td className="px-3 py-4"><div className="flex justify-end gap-2">{record.pendingRequest ? <span className="rounded-lg bg-amber-400/10 px-3 py-2 text-[10px] font-black text-amber-200">OWNER PENDING</span> : <><button onClick={() => openAction(record, 'EDIT')} className="min-h-10 rounded-lg border border-sky-400/25 px-3 py-2 text-xs font-bold text-sky-200">Edit</button><button onClick={() => openAction(record, 'DELETE')} className="min-h-10 rounded-lg border border-rose-400/25 px-3 py-2 text-xs font-bold text-rose-200">Delete</button></>}</div></td>
                </tr>
              ))}
              {!loading && !data?.records.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-500">No payment activity for selected dates.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAction(); }}>
          <form onSubmit={submitAction} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-white/10 bg-flora-dark p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase text-flora-sage">{isOwner ? 'Owner confirmation' : 'Owner approval request'}</p><h2 className="mt-1 text-xl font-black">{action === 'EDIT' ? 'Edit financial record' : 'Delete financial record'}</h2><p className="mt-1 text-xs text-slate-400">{selected.title} · {formatLKR(selected.amount)}</p></div><button type="button" onClick={closeAction} className="min-h-11 min-w-11 rounded-xl border border-white/10 text-slate-300" aria-label="Close">X</button></div>
            {action === 'EDIT' && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-300">Amount (LKR)<input required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-white" /></label><label className="text-xs font-bold text-slate-300">Date<input required type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-white" /></label><label className="text-xs font-bold text-slate-300 sm:col-span-2">Description<input required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-white" /></label>{selected.sourceType === 'EXPENSE' && <label className="text-xs font-bold text-slate-300 sm:col-span-2">Category<input required value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-white" /></label>}</div>}
            <label className="mt-4 block text-xs font-bold text-slate-300">Reason<textarea required minLength={3} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-white/10 bg-flora-darker p-3 text-white" /></label>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={closeAction} className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">Cancel</button><button disabled={submitting} className={`min-h-11 rounded-xl px-5 py-2 text-xs font-black disabled:opacity-50 ${action === 'DELETE' ? 'bg-rose-500 text-white' : 'bg-emerald-400 text-slate-950'}`}>{submitting ? 'Saving...' : isOwner ? `Confirm ${action.toLowerCase()}` : `Request ${action.toLowerCase()}`}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
