'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LeaveRequestItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: string;
  approverName: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
}

export default function LeaveApprovalQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'pending' | 'company' | 'history'>('pending');
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Company Calendar filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const roleName = session?.user?.role?.name || '';
  const isOwner = roleName === 'Owner';
  const isAccountant = roleName === 'Accountant';

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leave-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error('Failed to load leave requests', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      if (!isOwner && !isAccountant) {
        router.push('/leave');
      } else {
        fetchRequests();
      }
    }
  }, [status, isOwner, isAccountant, router, fetchRequests]);

  const handleDecision = async (id: string, action: 'Approve' | 'Reject') => {
    setProcessingId(id);
    setFeedback(null);

    const notes = actionNotes[id] || '';

    try {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, decisionNotes: notes }),
      });

      const data = await res.json();

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `Request successfully ${action === 'Approve' ? 'approved' : 'rejected'}.`,
        });
        setActionNotes((prev) => ({ ...prev, [id]: '' }));
        fetchRequests();
      } else {
        setFeedback({ type: 'error', message: data.error || `Failed to ${action.toLowerCase()} request.` });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setProcessingId(null);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-flora-darker flex items-center justify-center text-slate-400">
        Loading Approval Queue...
      </div>
    );
  }

  // Filter requests for Pending Queue:
  // Accountant handles non-Accountants. Owner handles Accountants (and can manage others if needed).
  const pendingRequests = requests.filter((r) => {
    if (r.status !== 'Pending') return false;
    if (r.userId === session?.user?.id) return false; // Self approval disabled
    if (isAccountant) return r.userRole !== 'Accountant';
    if (isOwner) return true;
    return false;
  });

  const historyRequests = requests.filter((r) => r.status !== 'Pending');

  // Company wide filtering
  const allRolesList = Array.from(new Set(requests.map((r) => r.userRole)));
  const companyFilteredRequests = requests.filter((r) => {
    if (roleFilter !== 'all' && r.userRole !== roleFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-flora-darker p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 flex items-center gap-2">
            <span>🛡️</span> Leave Approval Queue & Company Overview
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Logged in as <span className="text-flora-sage font-bold">{roleName}</span>. Manage team leave requests and inspect company-wide leave schedules.
          </p>
        </div>

        <Link
          href="/leave"
          className="px-4 py-2.5 bg-flora-darker hover:bg-flora-card text-slate-200 border border-flora-border font-bold rounded-xl text-sm transition flex items-center gap-2"
        >
          <span>◀ Back to My Leave Calendar</span>
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex justify-between items-center ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-lg font-bold">×</button>
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="bg-flora-card border border-flora-border rounded-2xl p-5 shadow-xl space-y-6">
        <div className="flex flex-wrap gap-3 border-b border-flora-border pb-3">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-flora-green text-slate-950 shadow'
                : 'bg-flora-darker text-slate-400 hover:text-white'
            }`}
          >
            <span>⏳ Pending Approvals</span>
            <span className="bg-slate-900 text-white px-2 py-0.5 rounded-full text-[10px]">
              {pendingRequests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('company')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              activeTab === 'company'
                ? 'bg-flora-green text-slate-950 shadow'
                : 'bg-flora-darker text-slate-400 hover:text-white'
            }`}
          >
            <span>🌐 Company-wide Leave Calendar</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-flora-green text-slate-950 shadow'
                : 'bg-flora-darker text-slate-400 hover:text-white'
            }`}
          >
            <span>📜 Approval History</span>
          </button>
        </div>

        {/* Tab 1: Pending Approvals */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-slate-400 text-xs py-8 text-center">Loading pending requests...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-slate-500 text-sm py-12 text-center">
                ✨ No pending leave requests requiring your decision right now.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-flora-darker border border-flora-border rounded-xl p-4 space-y-3 relative flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-slate-100 text-sm">{req.userName}</h3>
                          <span className="text-[10px] bg-flora-border/60 text-flora-sage px-2 py-0.5 rounded-full font-bold">
                            {req.userRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Requested: {req.requestedAt.split('T')[0]}
                        </span>
                      </div>

                      <div className="pt-2 text-xs text-slate-300 font-mono">
                        🗓️ <span className="font-bold text-flora-sage">{req.startDate.split('T')[0]}</span>
                        {req.startDate !== req.endDate ? ` → ${req.endDate.split('T')[0]}` : ''}
                      </div>

                      {req.reason && (
                        <p className="text-xs text-slate-400 bg-flora-card p-2 rounded-lg italic border border-flora-border/50">
                          "{req.reason}"
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-flora-border">
                      <input
                        type="text"
                        placeholder="Optional note for requester..."
                        value={actionNotes[req.id] || ''}
                        onChange={(e) =>
                          setActionNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="w-full bg-flora-card border border-flora-border rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-flora-sage"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecision(req.id, 'Approve')}
                          disabled={processingId === req.id}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-lg text-xs transition disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleDecision(req.id, 'Reject')}
                          disabled={processingId === req.id}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-lg text-xs transition disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Company-wide Leave Calendar */}
        {activeTab === 'company' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center bg-flora-darker p-3 rounded-xl border border-flora-border">
              <div>
                <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">Role Filter</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-flora-card border border-flora-border text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  {allRolesList.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-flora-card border border-flora-border text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-flora-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-flora-darker text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Date Range</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Approver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-flora-border">
                  {companyFilteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No leave records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    companyFilteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-flora-darker/50">
                        <td className="p-3 font-bold text-slate-200">{req.userName}</td>
                        <td className="p-3">
                          <span className="bg-flora-border/50 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                            {req.userRole}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-300">
                          {req.startDate.split('T')[0]} {req.startDate !== req.endDate ? `→ ${req.endDate.split('T')[0]}` : ''}
                        </td>
                        <td className="p-3 text-slate-400 italic max-w-xs truncate">{req.reason || '—'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'Approved'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                                : req.status === 'Rejected'
                                ? 'bg-rose-950 text-rose-300 border border-rose-700/50'
                                : 'bg-amber-950 text-amber-300 border border-amber-700/50'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{req.approverName || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-flora-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-flora-darker text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Staff</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Date Range</th>
                    <th className="p-3">Decision</th>
                    <th className="p-3">Decided At</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-flora-border">
                  {historyRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No historical decisions yet.
                      </td>
                    </tr>
                  ) : (
                    historyRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-flora-darker/50">
                        <td className="p-3 font-bold text-slate-200">{req.userName}</td>
                        <td className="p-3 text-slate-400">{req.userRole}</td>
                        <td className="p-3 font-mono text-slate-300">
                          {req.startDate.split('T')[0]} {req.startDate !== req.endDate ? `→ ${req.endDate.split('T')[0]}` : ''}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'Approved'
                                ? 'bg-emerald-950 text-emerald-300'
                                : 'bg-rose-950 text-rose-300'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          {req.decidedAt ? req.decidedAt.split('T')[0] : '—'}
                        </td>
                        <td className="p-3 text-slate-400 italic">{req.decisionNotes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
