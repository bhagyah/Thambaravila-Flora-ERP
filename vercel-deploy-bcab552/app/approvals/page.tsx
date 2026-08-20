'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface ApprovalItem {
  id: string;
  enquiryId: string;
  requestedById: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface DeletionRequestItem {
  id: string;
  bookingId: string;
  customerName: string;
  reason: string;
  status: string;
  createdAt: string;
  booking?: {
    id: string;
    weddingDate: string;
    totalQuoteAmount: number;
    customer: { name: string; phone: string };
  };
  requestedBy?: { name: string; role: { name: string } };
  approvedBy?: { name: string; role: { name: string } };
}

interface CustomerDeletionItem {
  id: string;
  customerId: string;
  customerName: string;
  reason: string;
  status: string;
  createdAt: string;
  customer?: {
    id: string;
    customerId: string;
    name: string;
    phone: string;
    email: string | null;
  };
  requestedBy?: { name: string; role: { name: string } };
  approvedBy?: { name: string; role: { name: string } };
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

function parseRequester(message: string) {
  const match = message.match(/^(.+?)\s+\((.+?)\)\s+requested deletion/i);
  if (!match) return undefined;
  return { name: match[1], role: { name: match[2] } };
}

function parseReason(message: string) {
  return message.match(/Reason:\s*"([^"]*)"/i)?.[1] || 'Owner approval requested';
}

function buildNotificationFallbackRequests(
  notifications: NotificationItem[],
  bookingRequests: DeletionRequestItem[],
  customerRequests: CustomerDeletionItem[]
) {
  const nextBookingRequests = [...bookingRequests];
  const nextCustomerRequests = [...customerRequests];
  const knownBookingIds = new Set(
    nextBookingRequests.map((r) => r.bookingId || r.booking?.id || r.id).filter(Boolean)
  );
  const knownCustomerIds = new Set(
    nextCustomerRequests
      .map((r) => r.customer?.customerId || r.customerId || r.customer?.id || r.id)
      .filter(Boolean)
  );

  for (const item of notifications) {
    if (item.type !== 'URGENT') continue;

    if (item.title.includes('Customer Deletion')) {
      const parsed = item.message.match(/Customer\s+(.+?)\s+\(([^()]+)\)\.\s*Reason:/i);
      if (!parsed) continue;

      const customerName = parsed[1];
      const publicCustomerId = parsed[2];
      if (knownCustomerIds.has(publicCustomerId)) continue;

      nextCustomerRequests.push({
        id: publicCustomerId,
        customerId: publicCustomerId,
        customerName,
        reason: parseReason(item.message),
        status: 'PENDING',
        createdAt: item.createdAt,
        customer: {
          id: publicCustomerId,
          customerId: publicCustomerId,
          name: customerName,
          phone: '',
          email: null,
        },
        requestedBy: parseRequester(item.message),
      });
      knownCustomerIds.add(publicCustomerId);
    }

    if (item.title.includes('Booking Deletion')) {
      const parsed = item.message.match(/Booking\s+([A-Za-z0-9_-]+)\.\s*Reason:/i);
      if (!parsed) continue;

      const bookingId = parsed[1];
      if (knownBookingIds.has(bookingId)) continue;

      nextBookingRequests.push({
        id: bookingId,
        bookingId,
        customerName: 'Client',
        reason: parseReason(item.message),
        status: 'PENDING',
        createdAt: item.createdAt,
        requestedBy: parseRequester(item.message),
      });
      knownBookingIds.add(bookingId);
    }
  }

  return {
    bookingRequests: nextBookingRequests,
    customerRequests: nextCustomerRequests,
  };
}

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequestItem[]>([]);
  const [customerDeletions, setCustomerDeletions] = useState<CustomerDeletionItem[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Request Modal
  const [showModal, setShowModal] = useState(false);
  const [enquiryId, setEnquiryId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const roleName = session?.user?.role?.name || '';
  const canViewApprovals = ['Owner', 'Accountant', 'IT/Admin'].includes(roleName);

  useEffect(() => {
    if (session && canViewApprovals) {
      fetchApprovals();
    }
  }, [session, canViewApprovals]);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setLoadErrors([]);
      const [resDisc, resDel, resCust, resNotif] = await Promise.all([
        fetch('/api/approvals'),
        fetch('/api/bookings/delete-request'),
        fetch('/api/customers/delete-request'),
        fetch('/api/notifications'),
      ]);

      const errors: string[] = [];
      let nextApprovals: ApprovalItem[] = [];
      let nextDeletionRequests: DeletionRequestItem[] = [];
      let nextCustomerDeletions: CustomerDeletionItem[] = [];

      if (resDisc.ok) {
        const data = await resDisc.json();
        nextApprovals = data.approvals || [];
      } else {
        errors.push('Discount approval requests could not be loaded.');
      }

      if (resDel.ok) {
        const data = await resDel.json();
        nextDeletionRequests = data.requests || [];
      } else {
        errors.push('Booking deletion requests could not be loaded.');
      }

      if (resCust.ok) {
        const data = await resCust.json();
        nextCustomerDeletions = data.requests || [];
      } else {
        errors.push('Client deletion requests could not be loaded.');
      }

      if (resNotif.ok) {
        const data = await resNotif.json();
        const notificationFallbacks = buildNotificationFallbackRequests(
          data.notifications || [],
          nextDeletionRequests,
          nextCustomerDeletions
        );
        nextDeletionRequests = notificationFallbacks.bookingRequests;
        nextCustomerDeletions = notificationFallbacks.customerRequests;
      }

      setApprovals(nextApprovals);
      setDeletionRequests(nextDeletionRequests);
      setCustomerDeletions(nextCustomerDeletions);
      setLoadErrors(errors);
    } catch (e) {
      console.error(e);
      setLoadErrors(['Approval requests could not be loaded. Please refresh and try again.']);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST_DISCOUNT',
          enquiryId,
          amount: amountCents,
          reason,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEnquiryId('');
        setAmount('');
        setReason('');
        fetchApprovals();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecideDiscount = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DECIDE',
          approvalId,
          decision,
        }),
      });

      if (res.ok) {
        fetchApprovals();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecideDeletion = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/bookings/delete-request/${requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchApprovals();
      } else {
        alert(data.error || 'Failed to process decision');
      }
    } catch (e) {
      alert('Error processing decision');
    }
  };

  const handleDecideCustomerDeletion = async (
    request: CustomerDeletionItem,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    try {
      const res = await fetch(`/api/customers/delete-request/${request.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          customerId: request.customer?.id || request.customerId || null,
          publicCustomerId: request.customer?.customerId || request.customerId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchApprovals();
      } else {
        alert(data.error || 'Failed to process customer deletion decision');
      }
    } catch (e) {
      alert('Error processing customer deletion decision');
    }
  };

  if (!session) return null;

  if (!canViewApprovals) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <p className="text-sm font-bold uppercase tracking-widest text-rose-400">Access Restricted</p>
          <h1 className="mt-2 text-2xl font-black text-slate-100">Approvals are limited to Owner, Accountant, and IT/Admin.</h1>
          <p className="mt-2 text-sm text-slate-400">Your account does not have permission to open this workspace.</p>
        </div>
      </div>
    );
  }

  const isOwner = roleName === 'Owner';
  const pendingDeletions = deletionRequests.filter((r) => r.status === 'PENDING');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl text-slate-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Authorization &amp; Approval Workflows</h1>
          <p className="text-slate-400 text-sm mt-1">
            Owner sign-offs for special discounts, budget overrides, and booking deletion requests.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-xl shadow-lg transition text-sm flex items-center space-x-2"
        >
          <span>+ Request Discount</span>
        </button>
      </div>

      {loadErrors.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-4 text-sm font-semibold">
          {loadErrors.join(' ')}
        </div>
      )}

      {/* SECTION 1: BOOKING DELETION REQUESTS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🗑️</span>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Booking Deletion Requests</h2>
              <p className="text-xs text-slate-400">
                Staff &amp; customer requests to delete wedding bookings requiring Owner authorization.
              </p>
            </div>
          </div>

          {pendingDeletions.length > 0 && (
            <span className="px-3 py-1 bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 text-xs rounded-full animate-pulse">
              {pendingDeletions.length} Pending Owner Approval
            </span>
          )}
        </div>

        {deletionRequests.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No booking deletion requests submitted.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Booking ID</th>
                  <th className="px-4 py-3 text-left">Client Name</th>
                  <th className="px-4 py-3 text-left">Requested By</th>
                  <th className="px-4 py-3 text-left">Reason for Deletion</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                {deletionRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-400">{req.bookingId}</td>
                    <td className="px-4 py-3 font-bold text-slate-100">
                      {req.booking?.customer?.name || req.customerName || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {req.requestedBy ? (
                        <span>
                          {req.requestedBy.name} ({req.requestedBy.role?.name})
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Customer / System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'PENDING' && isOwner ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleDecideDeletion(req.id, 'APPROVED')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow transition"
                          >
                            ✓ Approve Delete
                          </button>
                          <button
                            onClick={() => handleDecideDeletion(req.id, 'REJECTED')}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded shadow transition"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">
                          {req.status === 'PENDING' ? 'Awaiting Owner Sign-off' : 'Decided'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 1.5: CLIENT DELETION REQUESTS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">👤</span>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Client Profile Deletion Requests</h2>
              <p className="text-xs text-slate-400">
                Staff requests to delete customer profiles and associated financial balances requiring Owner sign-off.
              </p>
            </div>
          </div>
          {customerDeletions.filter((r) => r.status === 'PENDING').length > 0 && (
            <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-xs font-bold animate-pulse">
              {customerDeletions.filter((r) => r.status === 'PENDING').length} Pending Owner Review
            </span>
          )}
        </div>

        {customerDeletions.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No client deletion requests submitted.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Client Name</th>
                  <th className="px-4 py-3 text-left">Customer ID</th>
                  <th className="px-4 py-3 text-left">Requested By</th>
                  <th className="px-4 py-3 text-left">Deletion Reason</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Owner Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customerDeletions.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-bold text-slate-100">
                      {req.customer?.name || req.customerName || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-400">
                      {req.customer?.customerId || req.customerId}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {req.requestedBy ? (
                        <span>
                          {req.requestedBy.name} ({req.requestedBy.role?.name})
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Staff / System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'PENDING' && isOwner ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleDecideCustomerDeletion(req, 'APPROVED')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow transition"
                          >
                            ✓ Approve Delete
                          </button>
                          <button
                            onClick={() => handleDecideCustomerDeletion(req, 'REJECTED')}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded shadow transition"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">
                          {req.status === 'PENDING' ? 'Awaiting Owner Sign-off' : 'Decided'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: DISCOUNT APPROVALS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <span className="text-xl">🏷️</span>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Discount &amp; Budget Adjustment Requests</h2>
            <p className="text-xs text-slate-400">
              Special price reductions and budget overrides requiring Owner sign-off.
            </p>
          </div>
        </div>

        {approvals.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No discount requests submitted.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Booking ID</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Discount (LKR)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                {approvals.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-400">{app.enquiryId}</td>
                    <td className="px-4 py-3 text-slate-300">{app.reason}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      LKR {(app.amount / 100).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                          app.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : app.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {app.status === 'PENDING' && isOwner ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleDecideDiscount(app.id, 'APPROVED')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecideDiscount(app.id, 'REJECTED')}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded shadow transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">
                          {app.status === 'PENDING' ? 'Awaiting Owner Sign-off' : 'Completed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Requesting Discount */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 text-slate-100">
            <h2 className="text-xl font-bold">Request Discount Sign-off</h2>

            <form onSubmit={handleRequestDiscount} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Booking ID / Reference *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B-001"
                  value={enquiryId}
                  onChange={(e) => setEnquiryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Requested Discount Amount (LKR) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 25000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Justification / Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Large multi-day booking discount requested by client"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-300 font-semibold hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit to Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
