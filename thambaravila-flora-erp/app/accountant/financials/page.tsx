'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatLKR } from '@/lib/utils/formatters';

interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  totalAmount?: number | null;
  date: string;
  paymentMethod?: string | null;
  paidByName?: string | null;
}

interface PaymentStageItem {
  id: string;
  stageType: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  paidDate?: string | null;
  status: string;
}

interface BookingItem {
  id: string;
  weddingDate: string;
  bookingStatus: string;
  confirmationStatus: 'PENDING' | 'CONFIRMED' | 'NOT_CONFIRMED';
  paymentStatus: string;
  totalQuoteAmount: number;
  balanceDueAmount?: number | null;
  customer?: {
    id: string;
    customerId?: string | null;
    name: string;
    phone?: string | null;
  } | null;
  paymentStages?: PaymentStageItem[];
}

type Timeframe = 'THIS_MONTH' | 'THIS_QUARTER' | 'YTD' | 'ALL';

const EXPENSE_CATEGORIES = [
  'Flowers',
  'Labour',
  'Transport',
  'Materials',
  'Venue/Site Cost',
  'Rent',
  'Utilities',
  'Marketing',
  'Office/Admin',
  'Supplier Advance',
  'Owner Drawing',
  'Other',
];

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'ONLINE'];

function getStartDate(timeframe: Timeframe): Date | null {
  const now = new Date();

  if (timeframe === 'THIS_MONTH') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (timeframe === 'THIS_QUARTER') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterStartMonth, 1);
  }

  if (timeframe === 'YTD') {
    return new Date(now.getFullYear(), 0, 1);
  }

  return null;
}

function isWithinTimeframe(value: string | null | undefined, timeframe: Timeframe) {
  const start = getStartDate(timeframe);
  if (!start || !value) return true;
  return new Date(value) >= start;
}

function monthKey(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' });
}

function getRemainingDue(stage: PaymentStageItem) {
  return Math.max(0, (stage.amountDue || 0) - (stage.amountPaid || 0));
}

export default function FinancialDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [searchExpense, setSearchExpense] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [category, setCategory] = useState('Flowers');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const activePaymentStatuses = ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'];

  useEffect(() => {
    if (session) {
      fetchFinancialData();
    }
  }, [session]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);

      const [bookingRes, expenseRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/expenses'),
      ]);

      if (bookingRes.ok) {
        setBookings(await bookingRes.json());
      }

      if (expenseRes.ok) {
        const data = await expenseRes.json();
        setExpenses(data.expenses || []);
      }
    } catch (e) {
      console.error('Error fetching financial analytics data:', e);
      setFeedback({ text: 'Failed to load finance data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        setFeedback({ text: 'Expense amount must be greater than 0.', type: 'error' });
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description,
          amount: amountCents,
          date: expenseDate,
          paymentMethod,
          notes,
        }),
      });

      if (res.ok) {
        setFeedback({ text: 'Expense recorded successfully.', type: 'success' });
        setShowExpenseModal(false);
        setDescription('');
        setAmount('');
        setNotes('');
        setExpenseDate(new Date().toISOString().split('T')[0]);
        fetchFinancialData();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        const data = await res.json();
        setFeedback({ text: data.error || 'Failed to record expense.', type: 'error' });
      }
    } catch (err) {
      setFeedback({ text: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  const roleName = session.user?.role?.name || '';
  const isAllowed = roleName === 'Owner' || roleName === 'Accountant';

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl">
          <h2 className="text-2xl font-black text-rose-500">Access Restricted</h2>
          <p className="text-slate-400 text-xs mt-2">The financial dashboard is restricted to Owner and Accountant roles.</p>
        </div>
      </div>
    );
  }

  const contractedBookings = bookings.filter((b) => b.bookingStatus !== 'CANCELLED' && b.confirmationStatus !== 'NOT_CONFIRMED');
  const paymentActiveBookings = bookings.filter(
    (b) => activePaymentStatuses.includes(b.bookingStatus)
  );

  const allStages = paymentActiveBookings.flatMap((booking) =>
    (booking.paymentStages || []).map((stage) => ({ ...stage, booking }))
  );

  const revenue = allStages.reduce((sum, stage) => {
    if (stage.amountPaid <= 0) return sum;
    return isWithinTimeframe(stage.paidDate || stage.dueDate, timeframe) ? sum + stage.amountPaid : sum;
  }, 0);

  const filteredExpenseBase = expenses.filter((expense) => isWithinTimeframe(expense.date, timeframe));
  const totalExpenses = filteredExpenseBase.reduce((sum, expense) => sum + (expense.totalAmount || expense.amount || 0), 0);
  const grossContractedValue = contractedBookings.reduce((sum, booking) => sum + (booking.totalQuoteAmount || 0), 0);
  const receivables = paymentActiveBookings.reduce((bookingSum, booking) => {
    const stages = booking.paymentStages || [];
    if (stages.length === 0) {
      return bookingSum + Math.max(0, booking.balanceDueAmount ?? booking.totalQuoteAmount ?? 0);
    }
    return bookingSum + stages.reduce((stageSum, stage) => stageSum + getRemainingDue(stage), 0);
  }, 0);

  const now = new Date();
  const soonLimit = new Date(now);
  soonLimit.setDate(soonLimit.getDate() + 14);
  const monthLimit = new Date(now);
  monthLimit.setDate(monthLimit.getDate() + 30);

  const unpaidStages = allStages.filter((stage) => getRemainingDue(stage) > 0 && stage.status !== 'PAID');
  const overdueStages = unpaidStages.filter((stage) => new Date(stage.dueDate) < now);
  const dueSoonStages = unpaidStages.filter((stage) => {
    const dueDate = new Date(stage.dueDate);
    return dueDate >= now && dueDate <= soonLimit;
  });
  const next30Receivable = unpaidStages.reduce((sum, stage) => {
    const dueDate = new Date(stage.dueDate);
    return dueDate <= monthLimit ? sum + getRemainingDue(stage) : sum;
  }, 0);

  const totalPaidAllTime = allStages.reduce((sum, stage) => sum + (stage.amountPaid || 0), 0);
  const totalScheduled = allStages.reduce((sum, stage) => sum + (stage.amountDue || 0), 0);
  const collectionRate = totalScheduled > 0 ? Math.round((totalPaidAllTime / totalScheduled) * 100) : 0;
  const netBalance = revenue - totalExpenses;
  const profitMarginPercent = revenue > 0 ? ((netBalance / revenue) * 100).toFixed(1) : '0.0';
  const expensePressure = revenue > 0 ? Math.round((totalExpenses / revenue) * 100) : totalExpenses > 0 ? 100 : 0;
  const monthlyBurn = totalExpenses / Math.max(1, timeframe === 'ALL' ? 6 : 1);
  const runwayMonths = monthlyBurn > 0 ? Math.max(0, netBalance / monthlyBurn).toFixed(1) : 'Stable';

  const categoryTotals = filteredExpenseBase.reduce<Record<string, number>>((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + (expense.totalAmount || expense.amount || 0);
    return acc;
  }, {});
  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([name, categoryAmount]) => ({
      name,
      amount: categoryAmount,
      percent: totalExpenses > 0 ? Math.round((categoryAmount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const filteredExpenses = filteredExpenseBase.filter((expense) => {
    const matchesSearch =
      expense.description.toLowerCase().includes(searchExpense.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchExpense.toLowerCase());
    const matchesCat = selectedCategoryFilter === 'ALL' || expense.category === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const priorityStages = unpaidStages
    .sort((a, b) => {
      const aOverdue = new Date(a.dueDate) < now ? 0 : 1;
      const bOverdue = new Date(b.dueDate) < now ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 6);

  const trendMonths = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: monthKey(date),
      revenue: 0,
      expenses: 0,
    };
  });

  allStages.forEach((stage) => {
    if (!stage.amountPaid) return;
    const paidDate = new Date(stage.paidDate || stage.dueDate);
    const key = `${paidDate.getFullYear()}-${paidDate.getMonth()}`;
    const bucket = trendMonths.find((month) => month.key === key);
    if (bucket) bucket.revenue += stage.amountPaid;
  });

  expenses.forEach((expense) => {
    const expDate = new Date(expense.date);
    const key = `${expDate.getFullYear()}-${expDate.getMonth()}`;
    const bucket = trendMonths.find((month) => month.key === key);
    if (bucket) bucket.expenses += expense.totalAmount || expense.amount || 0;
  });

  const trendMax = Math.max(1, ...trendMonths.flatMap((month) => [month.revenue, month.expenses]));
  const topExpenseCategory = categoryBreakdown[0];
  const biggestReceivable = priorityStages[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-400 text-slate-950 uppercase tracking-wider">
                Finance Command Center
              </span>
              <span className="text-teal-300 text-xs font-mono font-semibold">Live cash intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-2">
              Accounts &amp; Finance Intelligence
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Contract value, collected payments, operating costs, receivables, and collection risk from live booking data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/accountant/dues" className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 transition">
              Payment Dues
            </Link>
            <Link href="/accountant/reports" className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 transition">
              P&amp;L Report
            </Link>
            <a href="/api/expenses/export" download className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition">
              Export Excel
            </a>
            <button onClick={() => setShowExpenseModal(true)} className="px-4 py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs rounded-xl transition">
              Record Expense
            </button>
          </div>
        </div>

        {feedback && (
          <div className={`p-4 rounded-2xl text-xs font-bold border shadow-lg ${feedback.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' : 'bg-rose-950/80 text-rose-300 border-rose-500/50'}`}>
            {feedback.text}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-3">
          {[
            ['THIS_MONTH', 'This Month'],
            ['THIS_QUARTER', 'This Quarter'],
            ['YTD', 'YTD'],
            ['ALL', 'All Time'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTimeframe(value as Timeframe)}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition ${timeframe === value ? 'bg-teal-400 text-slate-950 border-teal-300' : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'}`}
            >
              {label}
            </button>
          ))}
          <button onClick={fetchFinancialData} className="ml-auto px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 font-semibold">
            Loading finance data...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                ['Gross Contracted', grossContractedValue, 'text-slate-100', `${contractedBookings.length} active bookings`],
                ['Cash Collected', revenue, 'text-emerald-400', `${collectionRate}% all-time collection`],
                ['Operating Expenses', totalExpenses, 'text-rose-400', `${expensePressure}% expense pressure`],
                ['Net Cash Position', netBalance, netBalance >= 0 ? 'text-teal-300' : 'text-rose-400', `${profitMarginPercent}% margin`],
                ['Receivables', receivables, 'text-amber-400', `${overdueStages.length} overdue stages`],
              ].map(([label, value, color, sub]) => (
                <div key={label as string} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                  <div className={`text-xl font-black font-mono ${color}`}>{formatLKR(value as number)}</div>
                  <div className="text-[10px] text-slate-500 font-medium">{sub}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase text-teal-300">Next 30 Days Forecast</div>
                <div className="text-2xl font-black font-mono mt-2 text-slate-100">{formatLKR(next30Receivable)}</div>
                <div className="text-xs text-slate-500 mt-1">{dueSoonStages.length} dues inside 14 days</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase text-rose-300">Overdue Exposure</div>
                <div className="text-2xl font-black font-mono mt-2 text-rose-400">{formatLKR(overdueStages.reduce((sum, s) => sum + getRemainingDue(s), 0))}</div>
                <div className="text-xs text-slate-500 mt-1">Immediate collection risk</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase text-indigo-300">Cost Hotspot</div>
                <div className="text-lg font-black mt-2 text-slate-100">{topExpenseCategory?.name || 'No expenses'}</div>
                <div className="text-xs text-slate-500 mt-1">{topExpenseCategory ? `${topExpenseCategory.percent}% of selected expenses` : 'Ready for tracking'}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase text-amber-300">Runway Signal</div>
                <div className="text-2xl font-black font-mono mt-2 text-amber-300">{runwayMonths}</div>
                <div className="text-xs text-slate-500 mt-1">{typeof runwayMonths === 'string' ? 'No burn pressure' : 'months at current burn'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-100">Six-Month Cash Curve</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Collected vs spent</span>
                </div>
                <div className="grid grid-cols-6 gap-3 h-48 items-end">
                  {trendMonths.map((month) => (
                    <div key={month.key} className="flex flex-col items-center gap-2 h-full justify-end">
                      <div className="w-full flex items-end gap-1 h-36">
                        <div className="flex-1 bg-emerald-400/80 rounded-t" style={{ height: `${Math.max(4, (month.revenue / trendMax) * 100)}%` }} />
                        <div className="flex-1 bg-rose-400/80 rounded-t" style={{ height: `${Math.max(4, (month.expenses / trendMax) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">{month.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 text-[10px] font-bold text-slate-400">
                  <span><span className="inline-block w-2 h-2 bg-emerald-400 rounded-full mr-1" />Collected</span>
                  <span><span className="inline-block w-2 h-2 bg-rose-400 rounded-full mr-1" />Spent</span>
                </div>
              </div>

              <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-100">Collection Priority Queue</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{unpaidStages.length} open dues</span>
                </div>
                {priorityStages.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-8">No open payment dues.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                        <tr>
                          <th className="py-2 text-left">Client</th>
                          <th className="py-2 text-left">Stage</th>
                          <th className="py-2 text-left">Due Date</th>
                          <th className="py-2 text-right">Open Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {priorityStages.map((stage) => {
                          const dueDate = new Date(stage.dueDate);
                          const isOverdue = dueDate < now;
                          return (
                            <tr key={stage.id}>
                              <td className="py-3 font-bold text-slate-100">{stage.booking.customer?.name || 'Client'} <span className="text-slate-500 font-mono">({stage.booking.id})</span></td>
                              <td className="py-3 text-slate-300">{stage.stageType}</td>
                              <td className={`py-3 font-mono ${isOverdue ? 'text-rose-400' : 'text-amber-300'}`}>{dueDate.toLocaleDateString('en-GB')}</td>
                              <td className="py-3 text-right font-black text-amber-300 font-mono">{formatLKR(getRemainingDue(stage))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-100">Expense Category Breakdown</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{categoryBreakdown.length} categories</span>
                </div>

                {categoryBreakdown.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-6">No expenses logged for this timeframe.</div>
                ) : (
                  <div className="space-y-3.5 text-xs">
                    {categoryBreakdown.map((item) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-300">{item.name}</span>
                          <span className="text-slate-100 font-mono">{formatLKR(item.amount)} ({item.percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div className="bg-rose-400 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, item.percent)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-100">Operational Expense Log ({filteredExpenses.length})</h3>

                  <div className="flex items-center space-x-2 text-xs">
                    <input
                      type="text"
                      placeholder="Search expenses"
                      value={searchExpense}
                      onChange={(e) => setSearchExpense(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />

                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                    >
                      <option value="ALL">All Categories</option>
                      {EXPENSE_CATEGORIES.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredExpenses.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-8">
                    No expense entries found matching filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-80">
                    <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="p-3">Category</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Method</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-slate-800/60 transition">
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {expense.category}
                              </span>
                            </td>
                            <td className="p-3 text-slate-200 font-medium">{expense.description}</td>
                            <td className="p-3 text-slate-400">{new Date(expense.date).toLocaleDateString('en-GB')}</td>
                            <td className="p-3 text-slate-400">{expense.paymentMethod || 'CASH'}</td>
                            <td className="p-3 text-right font-extrabold text-rose-400 font-mono">{formatLKR(expense.totalAmount || expense.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {biggestReceivable && (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-100">
                <span className="font-black">Smart action:</span> Prioritize {biggestReceivable.booking.customer?.name || 'the top client'} for {formatLKR(getRemainingDue(biggestReceivable))} due on {new Date(biggestReceivable.dueDate).toLocaleDateString('en-GB')}.
              </div>
            )}
          </>
        )}
      </div>

      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100">Record Operational Expense</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Add cost, method, date, and memo for audit-ready finance tracking.</p>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-white font-bold text-lg">x</button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-rose-500">
                    {EXPENSE_CATEGORIES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-rose-500">
                    {PAYMENT_METHODS.map((item) => (
                      <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Description / Memo</label>
                <input type="text" required placeholder="e.g. Floral supply purchase" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-rose-500" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Amount (LKR)</label>
                  <input type="number" required min={1} step={0.01} placeholder="45000" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-rose-500" />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Date</label>
                  <input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-rose-500" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Supplier, receipt number, or internal note" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-rose-500" />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-extrabold rounded-xl shadow disabled:opacity-50">
                  {submitting ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
