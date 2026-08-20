'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatLKR } from '@/lib/utils/formatters';

interface PaymentStage {
  id: string;
  stageType: string;
  customTitle?: string | null;
  stageNumber?: number | null;
  amountDue: number;
  dueDate: string;
  amountPaid: number;
  paidDate: string | null;
  status: string;
  paidConfirmedBy?: { name: string };
}

interface DiscountApproval {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  requestedBy?: { name: string; role?: { name: string } } | null;
  approvedBy?: { name: string; role?: { name: string } } | null;
}

interface BookingDetail {
  id: string;
  customerId: string;
  customer: { name: string; phone: string; email: string | null };
  lead?: { id: string; leadSource: string; stage: string };
  weddingDate: string;
  dayOfWeek: string;
  ceremonyVenue?: { name: string; cityArea: string; loadInNotes: string | null; floralRestrictions: string | null };
  receptionVenue?: { name: string; cityArea: string };
  photographerVendor?: { name: string; phone: string };
  decoratorVendor?: { name: string; phone: string };
  catererVendor?: { name: string; phone: string };
  packageType: string;
  serviceScope: string;
  colourTheme: string | null;
  totalQuoteAmount: number;
  depositPercent: number;
  depositAmount: number;
  depositPaidDate: string | null;
  balanceDueAmount: number;
  balanceDueDate: string | null;
  paymentStatus: string;
  bookingStatus: string;
  confirmationStatus: 'PENDING' | 'CONFIRMED' | 'NOT_CONFIRMED';
  quotationAttachmentUrl?: string | null;
  quotationAttachmentName?: string | null;
  jobSheetAttachmentUrl?: string | null;
  jobSheetAttachmentName?: string | null;
  quoteOutcomeReason?: string | null;
  daysUntilWedding: number;
  notes: string | null;
  paymentStages: PaymentStage[];
  discountApprovals?: DiscountApproval[];
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session } = useSession();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Adjust Budget Modal State
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newTotalBudget, setNewTotalBudget] = useState('');
  const [budgetReason, setBudgetReason] = useState('');
  const [submittingBudget, setSubmittingBudget] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchBooking();
  }, [resolvedParams.id]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bookings/${resolvedParams.id}`);
      if (res.ok) {
        const data = await res.json();
        setBooking(data);
      }
    } catch (e) {
      console.error('Failed to load booking details', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudgetAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTotalBudget || isNaN(Number(newTotalBudget))) return;

    setSubmittingBudget(true);
    setFeedbackMsg(null);

    const isOwnerUser = session?.user?.role?.name === 'Owner';

    try {
      const res = await fetch(`/api/bookings/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalQuoteAmount: parseFloat(newTotalBudget),
          notes: budgetReason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setFeedbackMsg({
          text: isOwnerUser
            ? `✓ Total wedding budget updated to LKR ${parseFloat(newTotalBudget).toLocaleString()}! Contract & payment milestones updated directly.`
            : `✓ Total wedding budget updated to LKR ${parseFloat(newTotalBudget).toLocaleString()}! Sent to Owner Dashboard for approval.`,
          type: 'success',
        });
        setShowBudgetModal(false);
        setNewTotalBudget('');
        setBudgetReason('');
        fetchBooking();
      } else {
        setFeedbackMsg({ text: data.error || 'Failed to adjust total budget', type: 'error' });
      }
    } catch (err) {
      setFeedbackMsg({ text: 'An error occurred while adjusting budget.', type: 'error' });
    } finally {
      setSubmittingBudget(false);
    }
  };



  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Loading booking...</div>;
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center space-y-4">
        <p className="text-rose-400 font-bold">Booking not found.</p>
        <Link href="/bookings" className="text-teal-400 underline">Back to Bookings</Link>
      </div>
    );
  }

  const roleName = session?.user?.role?.name || '';
  const isOwnerOrManager = ['Owner', 'Sales Manager', 'Accountant'].includes(roleName);
  const paymentActive = ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(booking.bookingStatus) && booking.confirmationStatus === 'CONFIRMED';
  const visiblePaymentStages = paymentActive ? booking.paymentStages : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link href="/bookings" className="text-xs font-semibold text-slate-400 hover:text-teal-400 transition">
            ← Back to Event Bookings
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-xs px-2.5 py-1 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Booking Status: {booking.bookingStatus}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded font-bold border ${
                booking.confirmationStatus === 'CONFIRMED'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : booking.confirmationStatus === 'NOT_CONFIRMED'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              }`}
            >
              {booking.confirmationStatus === 'CONFIRMED'
                ? 'Confirmed'
                : booking.confirmationStatus === 'NOT_CONFIRMED'
                ? 'Not confirmed'
                : 'Pending'}
            </span>
            <span className="text-xs px-2.5 py-1 rounded font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Payment: {booking.paymentStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl text-xs font-bold border shadow-lg ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}

        {/* Title Banner */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-teal-400">{booking.id}</h1>
              <span className="text-sm font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {booking.packageType.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mt-1">{booking.customer.name} Wedding</h2>
            <p className="text-xs text-slate-400 mt-1">
              🗓️ {new Date(booking.weddingDate).toLocaleDateString()} ({booking.dayOfWeek}) • {booking.daysUntilWedding} Days Away
            </p>
          </div>

          <div className="text-right bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col items-end space-y-2">
            <div>
              <div className="text-xs text-slate-400">Total Contract Value:</div>
              <div className="text-2xl font-black text-slate-100">{formatLKR(booking.totalQuoteAmount)}</div>
            </div>

            {isOwnerOrManager && (
              <button
                onClick={() => {
                  setShowBudgetModal(true);
                  setNewTotalBudget((booking.totalQuoteAmount / 100).toString());
                }}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
              >
                <span>💰</span>
                <span>Adjust Overall Wedding Budget</span>
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Payment Milestones Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-base font-bold text-slate-100">
                  💳 Payment Stage Milestones
                </h3>
                <span className="text-[10px] text-slate-400 font-mono font-semibold">
                  Auto-balanced against total budget
                </span>
              </div>

              {!paymentActive && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                  Payment dues start only after stage 4 is confirmed.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold">
                    <tr>
                      <th className="p-2.5">Stage / Installment</th>
                      <th className="p-2.5">Amount Due</th>
                      <th className="p-2.5">Due Date</th>
                      <th className="p-2.5">Paid Amount</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Confirmed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {visiblePaymentStages.map((s, idx) => {
                      const isNewDues = s.stageType.includes('New changes') || s.stageType === 'BUDGET_ADJUSTMENT';
                      const isRefund = s.stageType.includes('Refund') || s.stageType === 'REFUND_DUE';
                      const title = s.customTitle || s.stageType;

                      return (
                        <tr key={s.id} className={isRefund ? 'bg-amber-950/20 font-bold' : isNewDues ? 'bg-cyan-950/20 font-bold' : ''}>
                          <td className="p-2.5 font-extrabold">
                            <div className="flex items-center gap-1.5">
                              {s.stageNumber && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-emerald-400 font-black border border-slate-700">
                                  #{s.stageNumber}
                                </span>
                              )}
                              {isNewDues ? (
                                <span className="text-cyan-400 flex items-center gap-1">⚡ New changes Dues</span>
                              ) : isRefund ? (
                                <span className="text-amber-400 flex items-center gap-1">💸 Customer Refund Due</span>
                              ) : (
                                <span className="text-teal-300">{title}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-100">{formatLKR(s.amountDue)}</td>
                          <td className="p-2.5 text-slate-400">{new Date(s.dueDate).toLocaleDateString('en-GB')}</td>
                          <td className="p-2.5 font-semibold text-emerald-400">{formatLKR(s.amountPaid)}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.status === 'REFUND_DUE'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                  : s.status === 'PAID'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : s.status === 'OVERDUE'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {s.status === 'REFUND_DUE' ? `💸 TO REFUND: ${formatLKR(s.amountDue)}` : s.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400">{s.paidConfirmedBy?.name || 'Pending Accountant'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-100">📎 Documents</h3>
                <span className="text-[10px] text-slate-400 font-mono">Quotation and job sheet archive</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Quotation</div>
                  {booking.quotationAttachmentUrl ? (
                    <a
                      href={booking.quotationAttachmentUrl}
                      download={booking.quotationAttachmentName || `${booking.id}-quotation.pdf`}
                      className="inline-flex px-3 py-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 font-bold border border-emerald-800/40"
                    >
                      View / Download Quotation
                    </a>
                  ) : (
                    <p className="text-slate-500">No quotation uploaded yet.</p>
                  )}
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Job Sheet</div>
                  {booking.jobSheetAttachmentUrl ? (
                    <a
                      href={booking.jobSheetAttachmentUrl}
                      download={booking.jobSheetAttachmentName || `${booking.id}-job-sheet.pdf`}
                      className="inline-flex px-3 py-2 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 font-bold border border-rose-800/40"
                    >
                      View / Download Job Sheet
                    </a>
                  ) : (
                    <p className="text-slate-500">No job sheet uploaded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Owner Approval Requests & Complete Budget Audit History */}
            {booking.discountApprovals && booking.discountApprovals.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>📜</span>
                    <span>Owner Approval Requests &amp; Budget Audit History</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    {booking.discountApprovals.length} {booking.discountApprovals.length === 1 ? 'Change Record' : 'Change History Records'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {booking.discountApprovals.map((app, idx) => {
                    const reqUser = app.requestedBy?.name || 'Staff User';
                    const reqRole = app.requestedBy?.role?.name || 'User';

                    return (
                      <div
                        key={app.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-start gap-3 hover:border-slate-700 transition"
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-slate-100 flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                              #{booking.discountApprovals!.length - idx}
                            </span>
                            <span>{app.reason}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="text-teal-400 font-bold">
                              👤 Adjusted by: {reqUser} ({reqRole})
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-400">
                              🕒 {new Date(app.createdAt).toLocaleString('en-GB')}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wide uppercase border shrink-0 ${
                            app.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Venue & Logistics */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-base font-bold text-slate-100 border-b border-slate-800 pb-2">
                🏛️ Venue &amp; Logistics Assignments
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-500 block">Ceremony Venue:</span>
                  <span className="font-bold text-slate-100 text-sm">{booking.ceremonyVenue?.name || 'Not Specified'}</span>
                  <p className="text-slate-400 text-[11px] mt-1">{booking.ceremonyVenue?.cityArea}</p>
                  {booking.ceremonyVenue?.loadInNotes && (
                    <p className="text-[10px] text-teal-400 mt-2"><strong>Load-in:</strong> {booking.ceremonyVenue.loadInNotes}</p>
                  )}
                </div>

                <div className="p-3 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-500 block">Reception Venue:</span>
                  <span className="font-bold text-slate-100 text-sm">{booking.receptionVenue?.name || 'Not Specified'}</span>
                  <p className="text-slate-400 text-[11px] mt-1">{booking.receptionVenue?.cityArea}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            {/* Vendors */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                🤝 Assigned Vendors
              </h3>

              <div>
                <span className="text-slate-500 block">Photographer:</span>
                <span className="font-semibold text-slate-200">{booking.photographerVendor?.name || 'Unassigned'}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Decorator:</span>
                <span className="font-semibold text-slate-200">{booking.decoratorVendor?.name || 'Unassigned'}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Caterer:</span>
                <span className="font-semibold text-slate-200">{booking.catererVendor?.name || 'Unassigned'}</span>
              </div>
            </div>

            {/* Client Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                👤 Client Information
              </h3>

              <div>
                <span className="text-slate-500 block">Name:</span>
                <span className="font-semibold text-slate-100">{booking.customer.name}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Phone:</span>
                <span className="font-semibold text-teal-400">{booking.customer.phone}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Email:</span>
                <span className="font-semibold text-slate-300">{booking.customer.email || 'None'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: ADJUST OVERALL WEDDING BUDGET ────────────────────────── */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center space-x-2">
                  <span>💰</span>
                  <span>Adjust Total Wedding Budget</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Update overall contract quote for <strong className="text-slate-200">{booking.customer.name}</strong>.
                </p>
              </div>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-slate-400 flex justify-between">
              <span>Current Total Budget:</span>
              <span className="font-bold text-slate-100">{formatLKR(booking.totalQuoteAmount)}</span>
            </div>

            <form onSubmit={handleSaveBudgetAdjustment} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  New Total Wedding Budget (LKR)
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  value={newTotalBudget}
                  onChange={(e) => setNewTotalBudget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Reason for Budget Adjustment
                </label>
                <textarea
                  required
                  rows={2}
                  value={budgetReason}
                  onChange={(e) => setBudgetReason(e.target.value)}
                  placeholder="e.g. Upgrade to premium flower mandap, extra table decorations..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className={`p-3 rounded-xl text-[11px] font-medium ${
                roleName === 'Owner'
                  ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-950/50 border border-amber-500/30 text-amber-300'
              }`}>
                {roleName === 'Owner'
                  ? '⚡ As the Owner, changing the total budget updates the contract value directly and recalculates 30% Advance, 40% Flower, and 30% Final payment stages immediately without requiring approval.'
                  : "⚡ Changing the total budget recalculates 30% Advance, 40% Flower, and 30% Final payment stages and sends an approval request to the Owner's Dashboard."}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBudget}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {submittingBudget
                    ? 'Processing...'
                    : roleName === 'Owner'
                    ? '⚡ Save & Apply Budget Directly'
                    : '⚡ Submit & Request Owner Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
