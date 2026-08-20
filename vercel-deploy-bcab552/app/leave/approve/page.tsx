'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StaffOption {
  id: string;
  name: string;
  email: string;
  roleName: string;
}

interface LeaveRequestItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'Pending' | 'Assigned' | 'Approved' | 'Rejected';
  requestedAt: string;
  approverName: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  assignedByName?: string | null;
  assignedByRole?: string | null;
}

export default function LeaveApprovalQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'pending' | 'assign' | 'assigned' | 'company' | 'history'>('pending');
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Set Leave for Staff Form State
  const [assignUserId, setAssignUserId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Company Calendar filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const roleName = session?.user?.role?.name || '';
  const isOwner = roleName === 'Owner';
  const isAccountant = roleName === 'Accountant';
  const isAdmin = roleName === 'IT/Admin';
  const canManageLeaves = isOwner || isAccountant || isAdmin;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leave-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        if (data.allStaff) {
          setStaffList(data.allStaff);
        }
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
      if (!canManageLeaves) {
        router.push('/leave');
      } else {
        fetchRequests();
      }
    }
  }, [status, canManageLeaves, router, fetchRequests]);

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
    } catch {
      setFeedback({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAssignLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId || !assignStartDate) {
      setFeedback({ type: 'error', message: 'Please select a staff member and start date.' });
      return;
    }

    const finalEndDate = assignEndDate || assignStartDate;
    if (finalEndDate < assignStartDate) {
      setFeedback({ type: 'error', message: 'End date cannot be before start date.' });
      return;
    }

    setAssignSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: assignUserId,
          startDate: assignStartDate,
          endDate: finalEndDate,
          reason: assignReason || `Assigned by ${session?.user?.name || roleName}`,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const targetStaff = staffList.find((s) => s.id === assignUserId);
        setFeedback({
          type: 'success',
          message: `✅ Leave successfully set for ${targetStaff?.name || 'employee'} (${assignStartDate} → ${finalEndDate})! A notification was sent to them to accept.`,
        });
        setAssignUserId('');
        setAssignStartDate('');
        setAssignEndDate('');
        setAssignReason('');
        setActiveTab('assigned');
        fetchRequests();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to assign leave.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'An error occurred while setting leave.' });
    } finally {
      setAssignSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-flora-darker flex items-center justify-center text-slate-400">
        Loading Approval Queue...
      </div>
    );
  }

  // Filter requests
  const pendingRequests = requests.filter((r) => {
    if (r.status !== 'Pending') return false;
    if (r.userId === session?.user?.id) return false;
    if (isAccountant) return r.userRole !== 'Accountant';
    if (isOwner || isAdmin) return true;
    return false;
  });

  const assignedRequests = requests.filter((r) => r.status === 'Assigned');
  const historyRequests = requests.filter((r) => r.status === 'Approved' || r.status === 'Rejected');

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
            onClick={() => setActiveTab('assign')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              activeTab === 'assign'
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg'
                : 'bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50'
            }`}
          >
            <span>➕ Set Leave for Staff</span>
          </button>

          <button
            onClick={() => setActiveTab('assigned')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              activeTab === 'assigned'
                ? 'bg-flora-green text-slate-950 shadow'
                : 'bg-flora-darker text-slate-400 hover:text-white'
            }`}
          >
            <span>🔔 Assigned Leaves</span>
            <span className="bg-slate-900 text-white px-2 py-0.5 rounded-full text-[10px]">
              {assignedRequests.length}
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

        {/* Tab: Set Leave for Staff */}
        {activeTab === 'assign' && (
          <div className="max-w-2xl bg-flora-darker border border-amber-800/40 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="border-b border-flora-border pb-3">
              <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                <span>➕</span> Assign Leave for Staff Member
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                As <span className="text-amber-400 font-bold">{roleName}</span>, you can set leave for any role for any day of the month. The staff member will receive a notification to review and accept the leave. Once accepted, it will automatically update their calendar and attendance.
              </p>
            </div>

            <form onSubmit={handleAssignLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Select Staff Member / Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  required
                  className="w-full bg-flora-card border border-flora-border rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Choose Employee --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.roleName}) {s.email ? `• ${s.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Start Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    required
                    className="w-full bg-flora-card border border-flora-border rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    End Date (leave blank for single day)
                  </label>
                  <input
                    type="date"
                    value={assignEndDate}
                    onChange={(e) => setAssignEndDate(e.target.value)}
                    min={assignStartDate}
                    className="w-full bg-flora-card border border-flora-border rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Reason / Purpose
                </label>
                <input
                  type="text"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="e.g. Allocated company off-day, medical leave, duty leave..."
                  className="w-full bg-flora-card border border-flora-border rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-800/30 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                <span>ℹ️</span>
                <span>
                  The employee will see this assigned leave on their calendar with an <b>Accept Leave</b> button. When accepted, it becomes <b>Approved</b> and updates all attendance reports automatically.
                </span>
              </div>

              <button
                type="submit"
                disabled={assignSubmitting}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-lg transition disabled:opacity-50"
              >
                {assignSubmitting ? 'Setting Leave...' : '🚀 Assign Leave & Notify Staff Member'}
              </button>
            </form>
          </div>
        )}

        {/* Tab: Assigned Leaves */}
        {activeTab === 'assigned' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-flora-darker p-3 rounded-xl border border-flora-border">
              <span className="text-xs text-slate-300 font-bold">
                Leaves Assigned by Management Awaiting Employee Acceptance
              </span>
              <button
                onClick={() => setActiveTab('assign')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition"
              >
                ➕ Assign Another Leave
              </button>
            </div>

            {loading ? (
              <div className="text-slate-400 text-xs py-8 text-center">Loading assigned leaves...</div>
            ) : assignedRequests.length === 0 ? (
              <div className="text-slate-500 text-sm py-12 text-center">
                No active assigned leaves waiting for acceptance.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-flora-darker border border-amber-800/40 rounded-xl p-4 space-y-3 relative flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-slate-100 text-sm">{req.userName}</h3>
                          <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded-full font-bold">
                            {req.userRole}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px] font-bold rounded-full">
                          🔔 Awaiting Acceptance
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

                      <div className="text-[10px] text-slate-500 pt-1">
                        Assigned by: {req.assignedByName || 'Management'} ({req.assignedByRole || 'Accountant'})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                  <option value="Assigned">Assigned (Awaiting Acceptance)</option>
                  <option value="Pending">Pending Approval</option>
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
                    <th className="p-3">Approver / Assignee</th>
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
                                : req.status === 'Assigned'
                                ? 'bg-blue-950 text-blue-300 border border-blue-700/50'
                                : req.status === 'Rejected'
                                ? 'bg-rose-950 text-rose-300 border border-rose-700/50'
                                : 'bg-amber-950 text-amber-300 border border-amber-700/50'
                            }`}
                          >
                            {req.status === 'Assigned' ? '🔔 Assigned' : req.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{req.approverName || req.assignedByName || '—'}</td>
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
