'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { formatLKR } from '@/lib/utils/formatters';

interface PaymentStageItem {
  id: string;
  bookingId: string;
  stageType: string;
  customTitle?: string | null;
  stageNumber?: number | null;
  amountDue: number; // in cents
  amountPaid: number; // in cents
  dueDate: string;
  paidDate?: string | null;
  status: string;
  booking: {
    id: string;
    totalQuoteAmount: number;
    balanceDueAmount: number;
    paymentStatus: string;
    bookingStatus: string;
    weddingDate?: string | null;
    paymentStages?: any[];
    customer: {
      id: string;
      name: string;
      customerId: string;
      phone: string;
      email?: string | null;
      nicNumber?: string | null;
      dateOfBirth?: string | null;
      gender?: string | null;
      socialHandle?: string | null;
    };
  };
}

interface CustomerDetail {
  id: string;
  customerId: string;
  customer_id?: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  source: string;
  nicNumber?: string | null;
  nic_number?: string | null;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  socialHandle?: string | null;
  social_handle?: string | null;
  additionalNotes?: string | null;
  additional_notes?: string | null;
  assignedSalesManager?: {
    id: string;
    name: string;
    role?: { name: string };
  } | null;
  sales_manager_name?: string | null;
  sales_manager_role?: string | null;
  leads?: any[];
  bookings?: any[];
}

interface InstallmentRow {
  title: string;
  dueDate: string;
  amount: string; // in rupees string
}

export default function DuesDashboardPage() {
  const { data: session } = useSession();
  const [stages, setStages] = useState<PaymentStageItem[]>([]);
  const [bookingsList, setBookingsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('UNPAID');

  // Confirmation Payment Modal
  const [selectedStage, setSelectedStage] = useState<PaymentStageItem | null>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Extend Due Date Modal
  const [extendStage, setExtendStage] = useState<PaymentStageItem | null>(null);
  const [newDueDate, setNewDueDate] = useState('');
  const [savingExtend, setSavingExtend] = useState(false);

  // Edit Amount Due Modal
  const [editAmountStage, setEditAmountStage] = useState<PaymentStageItem | null>(null);
  const [newAmountValue, setNewAmountValue] = useState('');
  const [savingAmount, setSavingAmount] = useState(false);

  // ── NEW: Full Booking Installment Splitter Modal ──
  const [splitBooking, setSplitBooking] = useState<any | null>(null);
  const [splitInstallments, setSplitInstallments] = useState<InstallmentRow[]>([]);
  const [savingSplit, setSavingSplit] = useState(false);

  // ── NEW: Single Stage Splitter Modal ──
  const [splitSingleStage, setSplitSingleStage] = useState<PaymentStageItem | null>(null);
  const [singleSplits, setSingleSplits] = useState<InstallmentRow[]>([]);
  const [savingSingleSplit, setSavingSingleSplit] = useState(false);

  // Long Customer Details Drawer Modal
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<CustomerDetail | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');
  const [savingCustomerNotes, setSavingCustomerNotes] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const activePaymentStages = ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'];

  useEffect(() => {
    if (session) {
      fetchPaymentStages();
    }
  }, [session]);

  const fetchPaymentStages = async () => {
    try {
      setLoading(true);
      await fetch('/api/payments/activate-confirmed', { method: 'POST' });
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const bookings = await res.json();
        setBookingsList(bookings);
        const allStages: PaymentStageItem[] = [];
        bookings.forEach((b: any) => {
          if (
            b.paymentStages &&
            activePaymentStages.includes(b.bookingStatus)
          ) {
            b.paymentStages.forEach((s: any) => {
              allStages.push({ ...s, booking: b });
            });
          }
        });
        setStages(allStages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Open Long Customer Details Popup Drawer
  const handleOpenCustomerDrawer = async (cust: any) => {
    if (!cust || !cust.id) return;
    setActiveCustomerId(cust.id);
    setLoadingCustomer(true);
    try {
      const res = await fetch(`/api/customers/${cust.id}`);
      if (res.ok) {
        const data = await res.json();
        const detail = data.customer || data;
        setActiveCustomer(detail);
        setCustomerNotes(detail.additionalNotes || detail.additional_notes || '');
      }
    } catch (err) {
      console.error('Failed to load customer details:', err);
    } finally {
      setLoadingCustomer(false);
    }
  };

  // Save Customer Notes from Drawer
  const handleSaveDrawerNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomerId) return;
    setSavingCustomerNotes(true);
    try {
      const res = await fetch(`/api/customers/${activeCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalNotes: customerNotes }),
      });
      if (res.ok) {
        setMessage({ text: '✓ Customer notes saved successfully!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingCustomerNotes(false);
    }
  };

  // Handle Confirm Payment Receipt
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStage) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const amountPaidCents = Math.round(parseFloat(confirmAmount) * 100);

      const res = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStageId: selectedStage.id,
          amountPaid: amountPaidCents,
          paidDate: new Date().toISOString(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: '✓ Payment receipt confirmed successfully!', type: 'success' });
        setSelectedStage(null);
        setConfirmAmount('');
        fetchPaymentStages();
      } else {
        setMessage({ text: data.error || 'Failed to confirm payment', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Extend Due Date
  const handleSaveExtendDueDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendStage || !newDueDate) return;

    setSavingExtend(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/payments/stage/${extendStage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: new Date(newDueDate).toISOString() }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          text: `✓ Payment due date extended to ${new Date(newDueDate).toLocaleDateString('en-GB')}!`,
          type: 'success',
        });
        setExtendStage(null);
        setNewDueDate('');
        fetchPaymentStages();
      } else {
        setMessage({ text: data.error || 'Failed to extend due date', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Failed to extend payment due date', type: 'error' });
    } finally {
      setSavingExtend(false);
    }
  };

  // Quick Preset Helper for Extend Due Date
  const setPresetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().split('T')[0];
    setNewDueDate(iso);
  };

  // Handle Edit Amount Due
  const handleSaveEditAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAmountStage || !newAmountValue) return;

    setSavingAmount(true);
    setMessage(null);

    try {
      const amountCents = Math.round(parseFloat(newAmountValue) * 100);

      const res = await fetch(`/api/payments/stage/${editAmountStage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountDue: amountCents }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          text: `✓ Amount due updated to LKR ${parseFloat(newAmountValue).toLocaleString()}!`,
          type: 'success',
        });
        setEditAmountStage(null);
        setNewAmountValue('');
        fetchPaymentStages();
      } else {
        setMessage({ text: data.error || 'Failed to update amount due', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Failed to update amount due', type: 'error' });
    } finally {
      setSavingAmount(false);
    }
  };

  // ── Open Booking Installment Splitter Modal ──
  const handleOpenBookingSplitModal = (booking: any) => {
    setSplitBooking(booking);
    const stagesList = booking.paymentStages || [];
    const paidStages = stagesList.filter((s: any) => s.status === 'PAID' || s.amountPaid > 0);
    const totalPaid = paidStages.reduce((sum: number, s: any) => sum + (s.amountPaid || 0), 0);
    const remainingBalance = Math.max(0, (booking.totalQuoteAmount || 0) - totalPaid);
    const remainingRupees = remainingBalance / 100;

    const unpaidStages = stagesList.filter((s: any) => s.status !== 'PAID' && s.amountPaid === 0);

    if (unpaidStages.length > 0) {
      setSplitInstallments(
        unpaidStages.map((s: any, idx: number) => ({
          title: s.customTitle || (unpaidStages.length === 1 ? 'Full Settlement' : `Installment ${idx + 1}`),
          dueDate: new Date(s.dueDate).toISOString().split('T')[0],
          amount: (s.amountDue / 100).toString(),
        }))
      );
    } else {
      // Default to 1 full payment
      const todayIso = new Date().toISOString().split('T')[0];
      setSplitInstallments([
        {
          title: 'Full Payment Settlement',
          dueDate: todayIso,
          amount: remainingRupees.toString(),
        },
      ]);
    }
  };

  // Apply Quick Installment Preset
  const applyInstallmentPreset = (count: number) => {
    if (!splitBooking) return;
    const stagesList = splitBooking.paymentStages || [];
    const paidStages = stagesList.filter((s: any) => s.status === 'PAID' || s.amountPaid > 0);
    const totalPaid = paidStages.reduce((sum: number, s: any) => sum + (s.amountPaid || 0), 0);
    const remainingRupees = Math.max(0, (splitBooking.totalQuoteAmount || 0) - totalPaid) / 100;

    const today = new Date();
    const rows: InstallmentRow[] = [];

    if (count === 1) {
      rows.push({
        title: 'Full Payment Settlement',
        dueDate: new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0],
        amount: remainingRupees.toFixed(0),
      });
    } else if (count === 2) {
      const half = Math.round(remainingRupees / 2);
      rows.push({
        title: '1st Installment (Advance Deposit)',
        dueDate: new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0],
        amount: half.toString(),
      });
      rows.push({
        title: '2nd Installment (Final Balance)',
        dueDate: new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0],
        amount: (remainingRupees - half).toFixed(0),
      });
    } else if (count === 3) {
      const p1 = Math.round(remainingRupees * 0.3);
      const p2 = Math.round(remainingRupees * 0.4);
      const p3 = remainingRupees - p1 - p2;
      rows.push({
        title: '1st Installment (30% Advance)',
        dueDate: new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0],
        amount: p1.toFixed(0),
      });
      rows.push({
        title: '2nd Installment (40% Flowers & Setup)',
        dueDate: new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0],
        amount: p2.toFixed(0),
      });
      rows.push({
        title: '3rd Installment (30% Final Balance)',
        dueDate: new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0],
        amount: p3.toFixed(0),
      });
    } else if (count === 4) {
      const part = Math.round(remainingRupees / 4);
      for (let i = 1; i <= 4; i++) {
        const amt = i === 4 ? remainingRupees - part * 3 : part;
        rows.push({
          title: `Installment ${i} of 4`,
          dueDate: new Date(today.getTime() + i * 15 * 86400000).toISOString().split('T')[0],
          amount: amt.toFixed(0),
        });
      }
    } else if (count === 5) {
      const part = Math.round(remainingRupees / 5);
      for (let i = 1; i <= 5; i++) {
        const amt = i === 5 ? remainingRupees - part * 4 : part;
        rows.push({
          title: `Installment ${i} of 5`,
          dueDate: new Date(today.getTime() + i * 14 * 86400000).toISOString().split('T')[0],
          amount: amt.toFixed(0),
        });
      }
    }
    setSplitInstallments(rows);
  };

  // Add Row
  const handleAddInstallmentRow = () => {
    const today = new Date();
    setSplitInstallments((prev) => [
      ...prev,
      {
        title: `Installment ${prev.length + 1}`,
        dueDate: new Date(today.getTime() + (prev.length + 1) * 14 * 86400000).toISOString().split('T')[0],
        amount: '0',
      },
    ]);
  };

  // Remove Row
  const handleRemoveInstallmentRow = (index: number) => {
    setSplitInstallments((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Split Installments
  const handleSaveBookingSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitBooking) return;

    setSavingSplit(true);
    setMessage(null);

    try {
      const installmentsPayload = splitInstallments.map((r, idx) => ({
        customTitle: r.title.trim() || `Installment ${idx + 1}`,
        amountDue: Math.round(parseFloat(r.amount || '0') * 100),
        dueDate: new Date(r.dueDate).toISOString(),
      }));

      const res = await fetch('/api/payments/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: splitBooking.id,
          installments: installmentsPayload,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          text: `✓ Successfully configured ${installmentsPayload.length} installment(s) for ${splitBooking.customer?.name}!`,
          type: 'success',
        });
        setSplitBooking(null);
        fetchPaymentStages();
      } else {
        setMessage({ text: data.error || 'Failed to configure installments', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'An unexpected error occurred while saving installments', type: 'error' });
    } finally {
      setSavingSplit(false);
    }
  };

  // ── Open Single Stage Splitter Modal ──
  const handleOpenSingleStageSplit = (stage: PaymentStageItem) => {
    setSplitSingleStage(stage);
    const amountRupees = stage.amountDue / 100;
    const half = Math.round(amountRupees / 2);
    const baseTitle = stage.customTitle || stage.stageType || 'Installment';
    const today = new Date(stage.dueDate);

    setSingleSplits([
      {
        title: `${baseTitle} (Part 1)`,
        dueDate: stage.dueDate.split('T')[0],
        amount: half.toString(),
      },
      {
        title: `${baseTitle} (Part 2)`,
        dueDate: new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0],
        amount: (amountRupees - half).toString(),
      },
    ]);
  };

  const handleSaveSingleStageSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitSingleStage) return;

    setSavingSingleSplit(true);
    setMessage(null);

    try {
      const splitsPayload = singleSplits.map((s, idx) => ({
        customTitle: s.title.trim() || `Part ${idx + 1}`,
        amountDue: Math.round(parseFloat(s.amount || '0') * 100),
        dueDate: new Date(s.dueDate).toISOString(),
      }));

      const res = await fetch(`/api/payments/stage/${splitSingleStage.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splits: splitsPayload }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          text: `✓ Successfully split due into ${splitsPayload.length} installments!`,
          type: 'success',
        });
        setSplitSingleStage(null);
        fetchPaymentStages();
      } else {
        setMessage({ text: data.error || 'Failed to split due', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Failed to split payment stage', type: 'error' });
    } finally {
      setSavingSingleSplit(false);
    }
  };

  if (!session) return null;

  const roleName = session.user?.role?.name || '';
  const isAccountant = roleName === 'Accountant' || roleName === 'Owner' || roleName === 'IT/Admin';
  const today = new Date();
  const dueSoonLimit = new Date(today);
  dueSoonLimit.setDate(dueSoonLimit.getDate() + 14);

  const remainingDue = (stage: PaymentStageItem) => Math.max(0, (stage.amountDue || 0) - (stage.amountPaid || 0));
  const isStageOverdue = (stage: PaymentStageItem) => stage.status !== 'PAID' && new Date(stage.dueDate) < today;
  const isStageDueSoon = (stage: PaymentStageItem) => {
    const dueDate = new Date(stage.dueDate);
    return stage.status !== 'PAID' && dueDate >= today && dueDate <= dueSoonLimit;
  };

  const openStages = stages.filter((stage) => stage.status !== 'PAID' && remainingDue(stage) > 0);
  const totalOpenAmount = openStages.reduce((sum, stage) => sum + remainingDue(stage), 0);
  const overdueAmount = openStages.filter(isStageOverdue).reduce((sum, stage) => sum + remainingDue(stage), 0);
  const dueSoonAmount = openStages.filter(isStageDueSoon).reduce((sum, stage) => sum + remainingDue(stage), 0);
  const paidThisMonth = stages.reduce((sum, stage) => {
    if (stage.status !== 'PAID' || !stage.amountPaid) return sum;
    const paidAnchor = new Date(stage.paidDate || stage.dueDate);
    const sameMonth = paidAnchor.getFullYear() === today.getFullYear() && paidAnchor.getMonth() === today.getMonth();
    return sameMonth ? sum + stage.amountPaid : sum;
  }, 0);

  const filteredStages = stages.filter((s) => {
    if (filterStage !== 'ALL' && s.stageType !== filterStage) return false;
    if (filterStatus === 'UNPAID' && s.status === 'PAID') return false;
    if (filterStatus === 'PAID' && s.status !== 'PAID') return false;
    if (filterStatus === 'OVERDUE' && !isStageOverdue(s)) return false;
    return true;
  });

  const nextBestCollection = [...openStages].sort((a, b) => {
    const overdueSort = Number(!isStageOverdue(a)) - Number(!isStageOverdue(b));
    if (overdueSort !== 0) return overdueSort;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  })[0];

  // Calculations for Split Modal Validator
  const splitTotalAllocated = splitInstallments.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const splitPaidSoFar = splitBooking
    ? (splitBooking.paymentStages || [])
        .filter((s: any) => s.status === 'PAID' || s.amountPaid > 0)
        .reduce((sum: number, s: any) => sum + (s.amountPaid || 0), 0) / 100
    : 0;
  const splitTargetBalance = splitBooking ? Math.max(0, ((splitBooking.totalQuoteAmount || 0) / 100) - splitPaidSoFar) : 0;
  const splitDiff = splitTargetBalance - splitTotalAllocated;
  const isSplitBalanced = Math.abs(splitDiff) < 1;

  // Calculations for Single Split Validator
  const singleSplitTotal = singleSplits.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const singleSplitTarget = splitSingleStage ? splitSingleStage.amountDue / 100 : 0;
  const singleSplitDiff = singleSplitTarget - singleSplitTotal;
  const isSingleSplitBalanced = Math.abs(singleSplitDiff) < 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl backdrop-blur-md">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 uppercase tracking-wider">
                Financial Operations
              </span>
              <span className="text-flora-sage text-xs font-mono font-semibold">● Dynamic Customer Installment Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              Payment Dues &amp; Collection Schedule
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Accountant can customize and split dues into 1, 2, 3, 4, 5+ installments per customer agreement. Click any Client Name for full dossier.
            </p>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {message && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold border shadow-lg animate-in fade-in ${
              message.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Open Receivables</div>
            <div className="mt-1 text-xl font-black text-amber-300 font-mono">{formatLKR(totalOpenAmount)}</div>
            <div className="text-[10px] text-slate-500 font-semibold">{openStages.length} unpaid installments</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Overdue Exposure</div>
            <div className="mt-1 text-xl font-black text-rose-400 font-mono">{formatLKR(overdueAmount)}</div>
            <div className="text-[10px] text-slate-500 font-semibold">{openStages.filter(isStageOverdue).length} urgent accounts</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Due In 14 Days</div>
            <div className="mt-1 text-xl font-black text-teal-300 font-mono">{formatLKR(dueSoonAmount)}</div>
            <div className="text-[10px] text-slate-500 font-semibold">{openStages.filter(isStageDueSoon).length} follow-ups</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Month Collection</div>
            <div className="mt-1 text-xl font-black text-emerald-400 font-mono">{formatLKR(paidThisMonth)}</div>
            <div className="text-[10px] text-slate-500 font-semibold">Confirmed receipts</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Smart Priority</div>
            <div className="mt-1 text-sm font-black text-slate-100 truncate">{nextBestCollection?.booking?.customer?.name || 'All clear'}</div>
            <div className="text-[10px] text-slate-500 font-semibold">
              {nextBestCollection ? `${formatLKR(remainingDue(nextBestCollection))} next` : 'No dues pending'}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 uppercase">Stage Type:</span>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl text-slate-100 px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Payment Stages</option>
                <option value="INSTALLMENT">Custom Installments</option>
                <option value="ADVANCE">Advance Deposit</option>
                <option value="FLOWER">Flower Payment</option>
                <option value="FINAL">Final Balance</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400 uppercase">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl text-slate-100 px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="UNPAID">Pending &amp; Overdue</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="PAID">Confirmed Paid</option>
                <option value="ALL">All Statuses</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-400">
            Showing <span className="text-emerald-400 font-extrabold">{filteredStages.length}</span> payment stages
          </div>
        </div>

        {/* Dues Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400 font-medium text-xs">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
              Loading payment schedules...
            </div>
          ) : filteredStages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No payment stages match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Customer &amp; Booking</th>
                    <th className="px-5 py-3.5">Installment / Stage Title</th>
                    <th className="px-5 py-3.5">Due Date &amp; Extension</th>
                    <th className="px-5 py-3.5">Amount Due &amp; Edit</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Accountant Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 bg-slate-900">
                  {filteredStages.map((stage) => {
                    const isOverdue = stage.status === 'OVERDUE' || (stage.status !== 'PAID' && new Date(stage.dueDate) < new Date());
                    const cust = stage.booking?.customer;
                    const stageDisplayName = stage.customTitle || stage.stageType || 'Installment';

                    return (
                      <tr key={stage.id} className="hover:bg-slate-800/60 transition">
                        {/* Customer & Booking */}
                        <td className="px-5 py-4">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => handleOpenCustomerDrawer(cust)}
                              className="group flex flex-col text-left focus:outline-none"
                            >
                              <span className="font-extrabold text-slate-100 group-hover:text-blue-400 transition text-sm flex items-center space-x-1.5">
                                <span>👤</span>
                                <span className="underline decoration-blue-500/40 underline-offset-4">{cust?.name || 'Client'}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Booking {stage.booking?.id} ({cust?.customerId || 'TF-CUST'})
                              </span>
                            </button>

                            {isAccountant && (
                              <button
                                onClick={() => handleOpenBookingSplitModal(stage.booking)}
                                className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold shadow transition flex items-center space-x-1 shrink-0"
                                title="Customize / Split installments for this booking"
                              >
                                <span>⚡</span>
                                <span>Split Schedule</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Installment / Stage Title */}
                        <td className="px-5 py-4 font-bold">
                          <div className="space-y-1">
                            <div className="text-slate-100 flex items-center gap-1.5 font-bold">
                              {stage.stageNumber && (
                                <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-mono text-emerald-400 font-black">
                                  #{stage.stageNumber}
                                </span>
                              )}
                              <span>{stageDisplayName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium font-mono">
                              Total Quote: {formatLKR(stage.booking?.totalQuoteAmount || 0)}
                            </div>
                          </div>
                        </td>

                        {/* Due Date & Extension */}
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className={`font-extrabold font-mono ${isOverdue ? 'text-rose-400' : 'text-slate-200'}`}>
                                📅 {new Date(stage.dueDate).toLocaleDateString('en-GB')}
                              </div>
                              {isOverdue && <div className="text-[9px] text-rose-500 font-bold uppercase">Overdue</div>}
                            </div>

                            {stage.status !== 'PAID' && isAccountant && (
                              <button
                                onClick={() => {
                                  setExtendStage(stage);
                                  setNewDueDate(new Date(stage.dueDate).toISOString().split('T')[0]);
                                }}
                                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold shadow transition flex items-center space-x-1"
                                title="Extend due date for custom date range"
                              >
                                <span>📅</span>
                                <span>Extend</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Amount Due & Edit */}
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-100 font-mono text-sm">
                              {formatLKR(stage.amountDue)}
                            </span>

                            {stage.status !== 'PAID' && isAccountant && (
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => {
                                    setEditAmountStage(stage);
                                    setNewAmountValue((stage.amountDue / 100).toString());
                                  }}
                                  className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-bold shadow transition flex items-center space-x-1"
                                  title="Edit amount due"
                                >
                                  <span>✏️</span>
                                  <span>Edit</span>
                                </button>

                                <button
                                  onClick={() => handleOpenSingleStageSplit(stage)}
                                  className="px-2 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-lg text-[10px] font-bold shadow transition flex items-center space-x-1"
                                  title="Split this specific due into 2+ parts"
                                >
                                  <span>✂️</span>
                                  <span>Split</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                              stage.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : isOverdue
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {stage.status}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-4 text-right">
                          {stage.status !== 'PAID' ? (
                            isAccountant ? (
                              <button
                                onClick={() => {
                                  setSelectedStage(stage);
                                  setConfirmAmount((stage.amountDue / 100).toString());
                                }}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-slate-950 font-extrabold text-xs rounded-xl shadow transition"
                              >
                                Confirm Receipt
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Accountant Only</span>
                            )
                          ) : (
                            <span className="text-xs text-emerald-400 font-bold">✓ Paid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: CUSTOMIZE / SPLIT BOOKING INSTALLMENTS (1, 2, 3, 4, 5+ PRESETS) ── */}
      {splitBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <span>⚡</span>
                  <span>Configure Payment Installments</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Split the remaining balance for <strong className="text-slate-200">{splitBooking.customer?.name}</strong> (Booking {splitBooking.id}) into custom installments.
                </p>
              </div>
              <button onClick={() => setSplitBooking(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            {/* Financial Summary Box */}
            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 font-mono text-center">
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-bold">Total Budget</div>
                <div className="text-sm font-black text-slate-100">{formatLKR(splitBooking.totalQuoteAmount || 0)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-bold">Already Paid</div>
                <div className="text-sm font-black text-emerald-400">LKR {splitPaidSoFar.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-bold">Remaining to Split</div>
                <div className="text-sm font-black text-amber-300">LKR {splitTargetBalance.toLocaleString()}</div>
              </div>
            </div>

            {/* Quick Installment Presets */}
            <div>
              <label className="block font-bold text-slate-300 mb-1.5 uppercase text-[10px]">
                Quick Split Presets (Per Customer Request)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => applyInstallmentPreset(1)}
                  className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-teal-300 rounded-xl font-bold transition text-center"
                >
                  1 Full Payment (100%)
                </button>
                <button
                  type="button"
                  onClick={() => applyInstallmentPreset(2)}
                  className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-blue-300 rounded-xl font-bold transition text-center"
                >
                  2 Times (50 / 50)
                </button>
                <button
                  type="button"
                  onClick={() => applyInstallmentPreset(3)}
                  className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 rounded-xl font-bold transition text-center"
                >
                  3 Times (30/40/30)
                </button>
                <button
                  type="button"
                  onClick={() => applyInstallmentPreset(4)}
                  className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-purple-300 rounded-xl font-bold transition text-center"
                >
                  4 Times (25% each)
                </button>
                <button
                  type="button"
                  onClick={() => applyInstallmentPreset(5)}
                  className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-300 rounded-xl font-bold transition text-center"
                >
                  5 Times (20% each)
                </button>
              </div>
            </div>

            {/* Dynamic Installments List Form */}
            <form onSubmit={handleSaveBookingSplit} className="space-y-4">
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {splitInstallments.map((inst, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-emerald-400 font-black font-mono flex items-center justify-center text-xs shrink-0">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      required
                      placeholder={`Installment ${idx + 1} Title`}
                      value={inst.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitInstallments((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, title: val } : r))
                        );
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
                    />

                    <input
                      type="date"
                      required
                      value={inst.dueDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitInstallments((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, dueDate: val } : r))
                        );
                      }}
                      className="w-36 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                    />

                    <div className="flex items-center gap-1 w-36">
                      <span className="text-[10px] text-slate-400 font-mono">LKR</span>
                      <input
                        type="number"
                        required
                        min={1}
                        step={100}
                        value={inst.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSplitInstallments((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, amount: val } : r))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-100 font-mono font-bold text-right focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {splitInstallments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInstallmentRow(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                        title="Delete installment row"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Custom Row Button */}
              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={handleAddInstallmentRow}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition flex items-center gap-1 text-[11px]"
                >
                  <span>➕</span>
                  <span>Add Installment Row</span>
                </button>

                {/* Validation Status Indicator */}
                <div className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border font-mono ${
                  isSplitBalanced
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                }`}>
                  {isSplitBalanced ? (
                    <span>✓ Exactly Allocated (LKR {splitTotalAllocated.toLocaleString()})</span>
                  ) : (
                    <span>⚠️ Difference: LKR {Math.abs(splitDiff).toLocaleString()} {splitDiff > 0 ? 'remaining to allocate' : 'over allocated'}</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSplitBooking(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSplit || !isSplitBalanced}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {savingSplit ? 'Saving Installments...' : '💾 Save & Apply Installment Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SPLIT A SINGLE SPECIFIC DUE INTO MULTIPLE PARTS ── */}
      {splitSingleStage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <span>✂️</span>
                  <span>Split Pending Due ({formatLKR(splitSingleStage.amountDue)})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Break down this specific due into 2 or more portions with custom dates for <strong className="text-slate-200">{splitSingleStage.booking?.customer?.name}</strong>.
                </p>
              </div>
              <button onClick={() => setSplitSingleStage(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveSingleStageSplit} className="space-y-3">
              <div className="space-y-2">
                {singleSplits.map((part, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="w-5 h-5 rounded bg-slate-800 text-teal-400 font-bold font-mono flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      required
                      value={part.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleSplits((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, title: val } : r))
                        );
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-100 font-semibold focus:outline-none focus:border-teal-500 text-xs"
                    />

                    <input
                      type="date"
                      required
                      value={part.dueDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleSplits((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, dueDate: val } : r))
                        );
                      }}
                      className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-teal-500"
                    />

                    <div className="flex items-center gap-1 w-32">
                      <span className="text-[9px] text-slate-400 font-mono">LKR</span>
                      <input
                        type="number"
                        required
                        min={1}
                        value={part.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSingleSplits((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, amount: val } : r))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-100 font-mono font-bold text-right focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Part Button & Balance Indicator */}
              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date(splitSingleStage.dueDate);
                    setSingleSplits((prev) => [
                      ...prev,
                      {
                        title: `Part ${prev.length + 1}`,
                        dueDate: new Date(today.getTime() + (prev.length + 1) * 14 * 86400000).toISOString().split('T')[0],
                        amount: '0',
                      },
                    ]);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition text-[10px]"
                >
                  ➕ Add Portion
                </button>

                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border ${
                  isSingleSplitBalanced
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                }`}>
                  {isSingleSplitBalanced ? (
                    <span>✓ Sum matches LKR {singleSplitTarget.toLocaleString()}</span>
                  ) : (
                    <span>⚠️ Difference: LKR {Math.abs(singleSplitDiff).toLocaleString()}</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSplitSingleStage(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSingleSplit || !isSingleSplitBalanced}
                  className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {savingSingleSplit ? 'Splitting...' : '💾 Split Due'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 1: CONFIRM PAYMENT RECEIPT ────────────────────────────────── */}
      {selectedStage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100">Confirm Payment Receipt</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Record confirmed cash/bank payment entry into ERP accounts.</p>
              </div>
              <button onClick={() => setSelectedStage(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-400">Client:</span>
                <span className="font-bold text-slate-100">{selectedStage.booking?.customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Booking ID:</span>
                <span className="font-mono text-blue-400 font-bold">{selectedStage.booking?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stage / Installment:</span>
                <span className="font-bold text-slate-200">{selectedStage.customTitle || selectedStage.stageType}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">Scheduled Amount:</span>
                <span className="font-bold text-emerald-400">{formatLKR(selectedStage.amountDue)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Confirmed Received Amount (LKR)
                </label>
                <input
                  type="number"
                  required
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedStage(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EXTEND DUE DATE ────────────────────────────────────────── */}
      {extendStage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center space-x-2">
                  <span>📅</span>
                  <span>Extend Payment Due Date</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pick a custom date range or use quick extension presets for <strong className="text-slate-200">{extendStage.booking?.customer?.name}</strong>.
                </p>
              </div>
              <button onClick={() => setExtendStage(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            {/* Quick Extension Presets */}
            <div>
              <label className="block font-bold text-slate-300 mb-1.5 uppercase text-[10px]">
                Quick Extension Presets
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '+7 Days', days: 7 },
                  { label: '+14 Days', days: 14 },
                  { label: '+30 Days', days: 30 },
                  { label: '+60 Days', days: 60 },
                ].map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => setPresetDays(p.days)}
                    className="py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 rounded-xl font-bold transition text-center"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveExtendDueDate} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Custom Extended Due Date
                </label>
                <input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setExtendStage(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExtend}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {savingExtend ? 'Extending...' : '💾 Save Extended Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: EDIT AMOUNT DUE ────────────────────────────────────────── */}
      {editAmountStage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center space-x-2">
                  <span>✏️</span>
                  <span>Edit Stage Amount Due</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Adjust amount due for <strong className="text-slate-200">{editAmountStage.booking?.customer?.name}</strong>.
                </p>
              </div>
              <button onClick={() => setEditAmountStage(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Current Scheduled Amount:</span>
                <span className="font-bold text-slate-200">{formatLKR(editAmountStage.amountDue)}</span>
              </div>
            </div>

            <form onSubmit={handleSaveEditAmount} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Revised Amount Due (LKR)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={100}
                  value={newAmountValue}
                  onChange={(e) => setNewAmountValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditAmountStage(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAmount}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {savingAmount ? 'Updating...' : '💾 Save Revised Amount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: LONG FULL-HEIGHT SLIDING CUSTOMER DETAIL DRAWER ────────── */}
      {activeCustomerId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow">
                  {activeCustomer?.name ? activeCustomer.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {activeCustomer?.customerId || activeCustomer?.customer_id || 'TF-CUST'}
                    </span>
                    {activeCustomer?.source && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {activeCustomer.source}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-slate-100 tracking-tight mt-0.5">
                    {activeCustomer?.name || 'Customer Details'}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveCustomerId(null);
                  setActiveCustomer(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-xl p-2 rounded-xl bg-slate-950 border border-slate-800"
              >
                ✕
              </button>
            </div>

            {loadingCustomer || !activeCustomer ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-semibold animate-pulse">Loading Client Profile...</p>
              </div>
            ) : (
              <div className="space-y-6 text-xs flex-1">
                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">Lead Inquiries</span>
                    <span className="text-lg font-black text-slate-100">{activeCustomer.leads?.length || 0}</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">Confirmed Events</span>
                    <span className="text-lg font-black text-emerald-400">{activeCustomer.bookings?.length || 0}</span>
                  </div>

                  <div className="col-span-2 bg-gradient-to-r from-slate-950 to-indigo-950/60 p-3 rounded-xl border border-indigo-500/30">
                    <span className="text-indigo-300 font-bold uppercase text-[10px] block">Assigned Staff &amp; Role</span>
                    <span className="text-sm font-extrabold text-slate-100">
                      {activeCustomer.assignedSalesManager?.name || activeCustomer.sales_manager_name || session.user?.name}
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] uppercase font-bold">
                      {activeCustomer.assignedSalesManager?.role?.name || activeCustomer.sales_manager_role || session.user?.role?.name}
                    </span>
                  </div>
                </div>

                {/* Profile Information */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-2 text-xs flex items-center space-x-1.5">
                    <span>📋</span>
                    <span>Client Profile Details</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block font-medium">Phone Number:</span>
                      <span className="font-bold text-slate-100">{activeCustomer.phone}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Email Address:</span>
                      <span className="font-bold text-slate-100">{activeCustomer.email || 'N/A'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">ID / NIC Number:</span>
                      <span className="font-mono font-bold text-slate-100">{activeCustomer.nicNumber || activeCustomer.nic_number || 'N/A'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Birthday (DOB):</span>
                      <span className="font-bold text-slate-100">
                        {activeCustomer.dateOfBirth || activeCustomer.date_of_birth
                          ? `🎂 ${new Date(activeCustomer.dateOfBirth || activeCustomer.date_of_birth!).toLocaleDateString('en-GB')} ${activeCustomer.gender ? `(${activeCustomer.gender})` : ''}`
                          : 'N/A'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-slate-400 block font-medium">Social Media Profile:</span>
                      <span className="font-bold text-purple-300">{activeCustomer.socialHandle || activeCustomer.social_handle || 'N/A'}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-slate-400 block font-medium">Address:</span>
                      <span className="font-semibold text-slate-200">{activeCustomer.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Notes & Customer Requirements Section */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-2 text-xs flex items-center space-x-1.5">
                    <span>📝</span>
                    <span>Additional Notes &amp; Requirements</span>
                  </h4>

                  <form onSubmit={handleSaveDrawerNotes} className="space-y-2">
                    <textarea
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={3}
                      placeholder="Type custom client instructions, flower preferences, or special requirements..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingCustomerNotes}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow text-[11px] disabled:opacity-50"
                      >
                        {savingCustomerNotes ? 'Saving...' : '💾 Save Notes'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Link to full Customer Profile Page */}
                <div className="pt-2">
                  <Link
                    href={`/customers/${activeCustomer.id}`}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl border border-slate-700 transition flex items-center justify-center space-x-1.5 shadow"
                  >
                    <span>🔍 Open Full Dedicated Dossier →</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
