'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { formatLKR } from '@/lib/utils/formatters';

interface Liability {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  amount: number;
  dueDay: number;
  startDate: string;
  isActive: boolean;
}

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  displayStatus: string;
  paidDate?: string | null;
  liability: {
    id: string;
    name: string;
    description?: string | null;
    category: string;
    isActive: boolean;
    dueDay: number;
  };
}

const categories = [
  'Rent',
  'Utilities',
  'Internet',
  'Salaries',
  'Insurance',
  'Loan',
  'Subscriptions',
  'Office/Admin',
  'Other',
];

export default function ScheduledLiabilitiesPage() {
  const { data: session, status } = useSession();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ payment: Payment; type: 'payment' | 'liability' } | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Utilities',
    amount: '',
    dueDay: '1',
    startDate: new Date().toISOString().slice(0, 10),
  });

  const role = session?.user?.role?.name;
  const permitted = role === 'Owner' || role === 'Accountant';

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/scheduled-liabilities');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load liabilities.');
      setLiabilities(data.liabilities || []);
      setPayments(data.payments || []);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to load liabilities.',
        error: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && permitted) load();
    else if (status !== 'loading') setLoading(false);
  }, [status, permitted]);

  const totals = useMemo(
    () => ({
      total: payments.reduce((sum, p) => sum + p.amount, 0),
      paid: payments.filter((p) => p.displayStatus === 'PAID').reduce((sum, p) => sum + p.amount, 0),
      due: payments
        .filter((p) => p.displayStatus !== 'PAID' && p.displayStatus !== 'CANCELLED')
        .reduce((sum, p) => sum + p.amount, 0),
    }),
    [payments]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        amount: Math.round(Number(form.amount) * 100),
        dueDay: Number(form.dueDay),
      };
      const response = await fetch(
        editingId ? `/api/scheduled-liabilities/${editingId}` : '/api/scheduled-liabilities',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save liability.');
      setMessage({ text: editingId ? 'Liability updated.' : 'Monthly liability created.' });
      setEditingId(null);
      setForm({
        name: '',
        description: '',
        category: 'Utilities',
        amount: '',
        dueDay: '1',
        startDate: new Date().toISOString().slice(0, 10),
      });
      await load();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not save liability.',
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const edit = (liability: Liability) => {
    setEditingId(liability.id);
    setForm({
      name: liability.name,
      description: liability.description || '',
      category: liability.category,
      amount: String(liability.amount / 100),
      dueDay: String(liability.dueDay),
      startDate: new Date(liability.startDate).toISOString().slice(0, 10),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = async (liability: Liability) => {
    const response = await fetch(`/api/scheduled-liabilities/${liability.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !liability.isActive }),
    });
    if (response.ok) load();
  };

  const pay = async (payment: Payment) => {
    if (
      !window.confirm(
        `Mark ${payment.liability.name} as paid? This creates an expense and reduces operating balance.`
      )
    )
      return;
    setPayingId(payment.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/scheduled-liabilities/payments/${payment.id}/pay`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not mark paid.');
      setMessage({ text: 'Payment marked paid and expense recorded.' });
      await load();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not mark paid.',
        error: true,
      });
    } finally {
      setPayingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { payment, type } = deleteTarget;
    setDeletingId(type === 'payment' ? payment.id : payment.liability.id);
    setMessage(null);

    try {
      const endpoint =
        type === 'payment'
          ? `/api/scheduled-liabilities/payments/${payment.id}`
          : `/api/scheduled-liabilities/${payment.liability.id}`;

      const response = await fetch(endpoint, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Could not delete item.');

      setMessage({
        text:
          type === 'payment'
            ? `✓ Scheduled payment for "${payment.liability.name}" deleted and financial balances updated.`
            : `✓ Recurring liability "${payment.liability.name}" and all associated payments & expenses deleted.`,
      });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to delete item.',
        error: true,
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (status === 'loading') return <div className="p-6 text-slate-300">Loading...</div>;
  if (!session || !permitted)
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-slate-300">
        <h1 className="text-xl font-black text-white">Access restricted</h1>
        <p className="mt-2 text-sm">Owner or Accountant role required.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 text-slate-100 sm:p-5 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="text-xs font-bold text-flora-sage hover:text-white">
            Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Scheduled liabilities</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Set recurring monthly company payments. Mark paid when settled; system records corresponding expense automatically.
          </p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">
          Owner + Accountant
        </span>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.error
              ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-flora-dark/90 p-4">
          <p className="text-xs uppercase text-slate-500">This month scheduled</p>
          <p className="mt-2 text-xl font-black">{formatLKR(totals.total)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
          <p className="text-xs uppercase text-emerald-300/70">Paid</p>
          <p className="mt-2 text-xl font-black text-emerald-300">{formatLKR(totals.paid)}</p>
        </div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
          <p className="text-xs uppercase text-rose-300/70">Outstanding</p>
          <p className="mt-2 text-xl font-black text-rose-300">{formatLKR(totals.due)}</p>
        </div>
      </div>

      {/* Form section */}
      <form onSubmit={submit} className="rounded-2xl border border-flora-border bg-flora-dark/90 p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">{editingId ? 'Edit liability' : 'Add monthly liability'}</h2>
            <p className="mt-1 text-xs text-slate-500">Amount entered in LKR. Due day adjusts automatically for short months.</p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  name: '',
                  description: '',
                  category: 'Utilities',
                  amount: '',
                  dueDay: '1',
                  startDate: new Date().toISOString().slice(0, 10),
                });
              }}
              className="min-h-11 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300"
            >
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-bold text-slate-300">
            Payment name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Office rent"
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white outline-none focus:border-flora-sage"
            />
          </label>
          <label className="text-xs font-bold text-slate-300">
            Category
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white outline-none focus:border-flora-sage"
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-300">
            Monthly amount (LKR)
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="50000"
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white outline-none focus:border-flora-sage"
            />
          </label>
          <label className="text-xs font-bold text-slate-300">
            Due day (1-31)
            <input
              required
              min="1"
              max="31"
              type="number"
              value={form.dueDay}
              onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white outline-none focus:border-flora-sage"
            />
          </label>
          <label className="text-xs font-bold text-slate-300">
            Start date
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white outline-none focus:border-flora-sage"
            />
          </label>
          <label className="text-xs font-bold text-slate-300">
            Description
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Monthly internet service"
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-flora-darker px-3 text-sm text-white outline-none focus:border-flora-sage"
            />
          </label>
        </div>
        <button
          disabled={saving}
          className="mt-4 min-h-11 rounded-xl bg-gradient-to-r from-flora-green to-flora-sage px-5 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
        >
          {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create monthly liability'}
        </button>
      </form>

      {/* Table section */}
      <section className="rounded-2xl border border-flora-border bg-flora-dark/90 p-4 shadow-xl sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">This month payments</h2>
            <p className="mt-1 text-xs text-slate-500">
              Marking paid creates one approved finance expense. Deleting removes payments and expenses everywhere.
            </p>
          </div>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-3">Payment</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Due</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {payments.map((payment) => {
                const liability = liabilities.find((item) => item.id === payment.liability.id);
                return (
                  <tr key={payment.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-3 py-4">
                      <p className="font-bold text-slate-200">{payment.liability.name}</p>
                      <p className="text-xs text-slate-500">{payment.liability.description || 'No description'}</p>
                    </td>
                    <td className="px-3 py-4 text-slate-400">{payment.liability.category}</td>
                    <td className="px-3 py-4 font-black text-slate-100">{formatLKR(payment.amount)}</td>
                    <td className="px-3 py-4 text-slate-400">{new Date(payment.dueDate).toLocaleDateString()}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                          payment.displayStatus === 'PAID'
                            ? 'bg-emerald-400/15 text-emerald-300'
                            : payment.displayStatus === 'OVERDUE'
                            ? 'bg-rose-400/15 text-rose-300'
                            : 'bg-amber-400/15 text-amber-200'
                        }`}
                      >
                        {payment.displayStatus}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {payment.displayStatus !== 'PAID' && payment.displayStatus !== 'CANCELLED' && (
                          <button
                            disabled={payingId === payment.id}
                            onClick={() => pay(payment)}
                            className="min-h-10 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50 hover:bg-emerald-400 transition"
                          >
                            {payingId === payment.id ? 'Saving...' : 'Mark paid'}
                          </button>
                        )}
                        {liability && (
                          <>
                            <button
                              onClick={() => edit(liability)}
                              className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggle(liability)}
                              className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 transition"
                            >
                              {liability.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                        <button
                          disabled={deletingId === payment.id || deletingId === payment.liability.id}
                          onClick={() => setDeleteTarget({ payment, type: 'payment' })}
                          className="min-h-10 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition flex items-center space-x-1"
                          title="Delete scheduled payment and recalculate financial balances"
                        >
                          <span>🗑️</span>
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!payments.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                    No monthly payments yet. Create first liability above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Choice Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-rose-400 flex items-center space-x-2">
                  <span>🗑️</span>
                  <span>Delete Scheduled Payment</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Confirm deletion for <strong className="text-slate-200">{deleteTarget.payment.liability.name}</strong> ({formatLKR(deleteTarget.payment.amount)}).
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {deleteTarget.payment.displayStatus === 'PAID' && (
              <div className="bg-rose-950/60 border border-rose-500/40 p-3 rounded-xl text-rose-200 font-semibold space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <span>⚠️</span>
                  <span>This Payment is Marked PAID</span>
                </p>
                <p className="text-[11px] text-rose-300/90 leading-relaxed">
                  Deleting this payment will permanently remove the associated recorded finance expense from ERP accounting and update all financial reports and balance calculations automatically.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Choose Deletion Scope:
              </label>

              <button
                type="button"
                onClick={() => setDeleteTarget({ ...deleteTarget, type: 'payment' })}
                className={`w-full p-3 rounded-xl border text-left flex items-start space-x-3 transition ${
                  deleteTarget.type === 'payment'
                    ? 'border-rose-500 bg-rose-500/10 text-slate-100 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="deleteType"
                  checked={deleteTarget.type === 'payment'}
                  onChange={() => setDeleteTarget({ ...deleteTarget, type: 'payment' })}
                  className="mt-0.5 accent-rose-500"
                />
                <div>
                  <div className="text-xs font-black text-slate-100">Delete This Month Payment Only</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                    Removes only this scheduled payment instance for {deleteTarget.payment.liability.name} (and its expense if paid).
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget({ ...deleteTarget, type: 'liability' })}
                className={`w-full p-3 rounded-xl border text-left flex items-start space-x-3 transition ${
                  deleteTarget.type === 'liability'
                    ? 'border-rose-500 bg-rose-500/10 text-slate-100 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="deleteType"
                  checked={deleteTarget.type === 'liability'}
                  onChange={() => setDeleteTarget({ ...deleteTarget, type: 'liability' })}
                  className="mt-0.5 accent-rose-500"
                />
                <div>
                  <div className="text-xs font-black text-slate-100">Delete Entire Recurring Liability</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                    Permanently purges the recurring liability template, all monthly payment instances, and all linked finance expenses.
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={confirmDelete}
                className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black rounded-xl shadow disabled:opacity-50"
              >
                {deletingId ? 'Deleting...' : 'Confirm Permanent Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
