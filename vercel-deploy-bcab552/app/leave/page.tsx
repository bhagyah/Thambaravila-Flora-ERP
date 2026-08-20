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
  status: 'Pending' | 'Assigned' | 'Approved' | 'Rejected';
  requestedAt: string;
  approverName: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  assignedByName?: string | null;
  assignedByRole?: string | null;
}

interface LeaveQuota {
  annualAllowance: number;
  usedDays: number;
  remainingDays: number;
}

export default function LeaveCalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const [myRequests, setMyRequests] = useState<LeaveRequestItem[]>([]);
  const [quota, setQuota] = useState<LeaveQuota>({ annualAllowance: 21, usedDays: 0, remainingDays: 21 });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const roleName = session?.user?.role?.name || 'Staff';
  const canApprove = roleName === 'Owner' || roleName === 'Accountant' || roleName === 'IT/Admin';

  const fetchMyRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leave-requests?scope=mine');
      if (res.ok) {
        const data = await res.json();
        setMyRequests(data.requests || []);
        if (data.quota) {
          setQuota(data.quota);
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
      fetchMyRequests();
    }
  }, [status, router, fetchMyRequests]);

  const handleAcceptLeave = async (id: string) => {
    setActingId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'Accept' }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: '🎉 Leave accepted successfully! Your calendar and attendance records are now updated.',
        });
        fetchMyRequests();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to accept leave' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'An error occurred while accepting leave.' });
    } finally {
      setActingId(null);
    }
  };

  const handleDeclineLeave = async (id: string) => {
    const reasonText = prompt('Please provide a reason for declining (optional):');
    if (reasonText === null) return;
    setActingId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'Decline', decisionNotes: reasonText }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: 'Assigned leave declined.',
        });
        fetchMyRequests();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to decline leave' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'An error occurred while declining leave.' });
    } finally {
      setActingId(null);
    }
  };

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Date selection click handler with Strict Past & Today Blocking
  const handleDateClick = (dateStr: string, isSelectable: boolean) => {
    if (!isSelectable) return;

    if (!selectedStart || (selectedStart && selectedEnd)) {
      setSelectedStart(dateStr);
      setSelectedEnd(null);
    } else if (selectedStart && !selectedEnd) {
      if (dateStr < selectedStart) {
        setSelectedStart(dateStr);
        setSelectedEnd(null);
      } else {
        setSelectedEnd(dateStr);
      }
    }
  };

  const handleSingleDaySelect = (dateStr: string, isSelectable: boolean) => {
    if (!isSelectable) return;
    setSelectedStart(dateStr);
    setSelectedEnd(dateStr);
  };

  const handleClearSelection = () => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setReason('');
  };

  // Compute requested days count
  let requestedDays = 0;
  if (selectedStart) {
    const s = new Date(selectedStart);
    const e = new Date(selectedEnd || selectedStart);
    requestedDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const isQuotaExceeded = requestedDays > quota.remainingDays;

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStart) return;
    if (isQuotaExceeded) {
      setFeedback({
        type: 'error',
        message: `Quota Exceeded! You requested ${requestedDays} days, but only have ${quota.remainingDays} days remaining out of your 21-day annual allowance.`,
      });
      return;
    }

    const finalEnd = selectedEnd || selectedStart;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: selectedStart,
          endDate: finalEnd,
          reason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `Leave request sent successfully (${requestedDays} day${requestedDays > 1 ? 's' : ''})! Sent for approval to ${roleName === 'Accountant' ? 'Owner' : 'Accountant'}.`,
        });
        handleClearSelection();
        fetchMyRequests();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to submit leave request' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'An unexpected error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to check if a date has an existing request
  const getRequestsForDate = (dateStr: string) => {
    return myRequests.filter((r) => {
      const start = r.startDate.split('T')[0];
      const end = r.endDate.split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-flora-darker flex items-center justify-center text-slate-400">
        Loading Leave System...
      </div>
    );
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const assignedPendingRequests = myRequests.filter((r) => r.status === 'Assigned');

  return (
    <div className="min-h-screen bg-flora-darker p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Annual Quota Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 flex items-center gap-2">
            <span>🏖️</span> Leave Management &amp; Calendar
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Rules: Past days &amp; Today are disabled for self-requests. Each employee receives 21 days annual allowance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Annual Quota Badge */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 flex items-center space-x-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Annual Allowance</div>
              <div className="text-sm font-black text-slate-100">{quota.annualAllowance} Days</div>
            </div>
            <div className="border-l border-slate-800 h-8"></div>
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-400">Used / Pending</div>
              <div className="text-sm font-black text-amber-400">{quota.usedDays} Days</div>
            </div>
            <div className="border-l border-slate-800 h-8"></div>
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400">Remaining</div>
              <div className="text-sm font-black text-emerald-400">{quota.remainingDays} Days</div>
            </div>
          </div>

          {canApprove && (
            <Link
              href="/leave/approve"
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-lg transition flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>Set Leave for Staff / Approvals</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Assigned Leaves Awaiting Acceptance Banner ── */}
      {assignedPendingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-slate-900 border border-blue-600/50 p-5 rounded-2xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black text-blue-200 flex items-center gap-2">
              <span className="animate-bounce">🔔</span>
              <span>You have {assignedPendingRequests.length} Leave{assignedPendingRequests.length > 1 ? 's' : ''} Assigned by Management Awaiting Your Acceptance</span>
            </h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500 text-slate-950">
              Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {assignedPendingRequests.map((req) => {
              const reqDays = Math.ceil(Math.abs(new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
              return (
                <div
                  key={req.id}
                  className="bg-slate-900/90 border border-blue-700/40 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-lg"
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div className="font-mono text-sm font-black text-emerald-400">
                        🗓️ {req.startDate.split('T')[0]} {req.startDate !== req.endDate ? `→ ${req.endDate.split('T')[0]}` : ''}
                      </div>
                      <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                        {reqDays} Day{reqDays > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Assigned by: <span className="font-bold text-amber-300">{req.assignedByName || 'Management'} ({req.assignedByRole || 'Accountant'})</span>
                    </div>

                    {req.reason && (
                      <p className="text-xs text-slate-300 bg-slate-950 p-2 rounded-lg italic border border-slate-800">
                        "{req.reason}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleAcceptLeave(req.id)}
                      disabled={actingId === req.id}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span>✅</span>
                      <span>Accept Leave</span>
                    </button>
                    <button
                      onClick={() => handleDeclineLeave(req.id)}
                      disabled={actingId === req.id}
                      className="py-2.5 px-4 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold rounded-lg text-xs transition disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex justify-between items-center ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-base font-bold">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Interactive Calendar (8 cols) */}
        <div className="lg:col-span-8 bg-flora-card border border-flora-border rounded-2xl p-5 shadow-xl space-y-4">
          {/* Month Header & Nav */}
          <div className="flex items-center justify-between border-b border-flora-border pb-3">
            <h2 className="text-lg font-bold text-slate-100">
              {monthNames[month]} {year}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={prevMonth}
                className="p-2 bg-flora-darker hover:bg-flora-border rounded-xl text-slate-300 text-sm transition"
              >
                ◀ Prev
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 bg-flora-darker hover:bg-flora-border rounded-xl text-slate-300 text-xs font-bold transition"
              >
                Current Month
              </button>
              <button
                onClick={nextMonth}
                className="p-2 bg-flora-darker hover:bg-flora-border rounded-xl text-slate-300 text-sm transition"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-1 uppercase tracking-wider">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16 sm:h-20 bg-flora-darker/30 rounded-xl border border-transparent" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayStr = String(dayNum).padStart(2, '0');
              const monthStr = String(month + 1).padStart(2, '0');
              const dateStr = `${year}-${monthStr}-${dayStr}`;

              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              const isSelectable = dateStr > todayStr; // Rule 1 & 2: Only future dates from tomorrow are selectable!

              // Selection logic
              const isStart = selectedStart === dateStr;
              const isEnd = selectedEnd === dateStr;
              const isInRange =
                selectedStart &&
                selectedEnd &&
                dateStr >= selectedStart &&
                dateStr <= selectedEnd;

              // Existing requests on this day
              const dayReqs = getRequestsForDate(dateStr);
              const assignedReq = dayReqs.find((r) => r.status === 'Assigned');
              const approvedReq = dayReqs.find((r) => r.status === 'Approved');
              const pendingReq = dayReqs.find((r) => r.status === 'Pending');
              const rejectedReq = dayReqs.find((r) => r.status === 'Rejected');

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDateClick(dateStr, isSelectable)}
                  onDoubleClick={() => handleSingleDaySelect(dateStr, isSelectable)}
                  className={`h-16 sm:h-20 p-1.5 rounded-xl border transition-all flex flex-col justify-between select-none relative overflow-hidden ${
                    !isSelectable
                      ? 'bg-slate-950/60 border-slate-900/80 text-slate-600 cursor-not-allowed opacity-50'
                      : isStart || isEnd
                      ? 'bg-flora-sage text-slate-950 border-flora-sage font-extrabold shadow-lg scale-105 z-10 cursor-pointer'
                      : isInRange
                      ? 'bg-flora-sage/30 border-flora-sage/50 text-slate-100 cursor-pointer'
                      : 'bg-flora-darker border-flora-border hover:border-slate-400 text-slate-200 cursor-pointer'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${isStart || isEnd ? 'text-slate-950 font-black' : ''}`}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded border border-slate-700">Today</span>
                    )}
                    {isPast && !isToday && (
                      <span className="text-[8px] text-slate-600 uppercase">Past</span>
                    )}
                  </div>

                  {/* Indicators for existing requests */}
                  <div className="space-y-0.5">
                    {assignedReq && (
                      <div className="text-[9px] bg-blue-950 text-blue-300 border border-blue-700/50 px-1 py-0.5 rounded truncate font-bold">
                        🔔 Assigned
                      </div>
                    )}
                    {approvedReq && !assignedReq && (
                      <div className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-1 py-0.5 rounded truncate font-semibold">
                        ✓ Approved
                      </div>
                    )}
                    {pendingReq && !approvedReq && !assignedReq && (
                      <div className="text-[9px] bg-amber-950 text-amber-300 border border-amber-700/50 px-1 py-0.5 rounded truncate font-semibold">
                        ⏳ Pending
                      </div>
                    )}
                    {rejectedReq && !approvedReq && !pendingReq && !assignedReq && (
                      <div className="text-[9px] bg-rose-950 text-rose-300 border border-rose-700/50 px-1 py-0.5 rounded truncate font-semibold">
                        ✕ Rejected
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-slate-400 flex flex-wrap gap-4 pt-2 border-t border-flora-border">
            <span>⛔ <b>Past days &amp; Today</b> are disabled for self-requests.</span>
            <span>💡 <b>Annual Quota:</b> 21 Days / Employee / Year.</span>
            <span>🔔 <b>Assigned leaves</b> from Accountant/Management can be accepted directly.</span>
          </div>
        </div>

        {/* Right Panel: Selected Form & My Leave Requests (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Submit Request Box */}
          <div className="bg-flora-card border border-flora-border rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-100 flex items-center justify-between border-b border-flora-border pb-2">
              <span>✈️ Request Leave</span>
              {selectedStart && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs font-semibold text-rose-400 hover:underline"
                >
                  Clear Selection
                </button>
              )}
            </h3>

            {selectedStart ? (
              <form onSubmit={handleSubmitRequest} className="space-y-3">
                <div className="bg-flora-darker p-3 rounded-xl border border-flora-border text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">From:</span>
                    <span className="font-bold text-flora-sage">{selectedStart}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">To:</span>
                    <span className="font-bold text-flora-sage">{selectedEnd || selectedStart}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Requested Duration:</span>
                    <span className={`font-black ${isQuotaExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {requestedDays} Day{requestedDays > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300 pt-1 border-t border-flora-border/50">
                    <span className="text-slate-500">Approver Role:</span>
                    <span className="font-bold text-amber-400">
                      {roleName === 'Accountant' ? 'Owner' : 'Accountant'}
                    </span>
                  </div>
                </div>

                {isQuotaExceeded && (
                  <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-[11px] font-bold text-rose-300">
                    ⚠️ Exceeds Quota! You requested {requestedDays} days, but only have {quota.remainingDays} days remaining out of your 21-day annual allowance.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. Personal family event, annual vacation..."
                    className="w-full bg-flora-darker border border-flora-border rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-flora-sage"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || isQuotaExceeded}
                  className="w-full py-2.5 bg-flora-green hover:bg-flora-sage text-slate-950 font-extrabold rounded-xl text-xs shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : '🚀 Send for Approval'}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                Select a future date starting from tomorrow on the calendar to request leave.
              </div>
            )}
          </div>

          {/* My Leave Requests List */}
          <div className="bg-flora-card border border-flora-border rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-100 border-b border-flora-border pb-2">
              📜 My Leave Requests
            </h3>

            {loading ? (
              <div className="text-slate-400 text-xs py-4 text-center">Loading history...</div>
            ) : myRequests.length === 0 ? (
              <div className="text-slate-500 text-xs py-4 text-center">No leave requests submitted yet.</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`bg-flora-darker border rounded-xl p-3 text-xs space-y-2 ${
                      req.status === 'Assigned'
                        ? 'border-blue-700/60 bg-blue-950/20 shadow-md'
                        : 'border-flora-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">
                        {req.startDate.split('T')[0]} {req.startDate !== req.endDate ? `→ ${req.endDate.split('T')[0]}` : ''}
                      </span>
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
                        {req.status === 'Assigned' ? '🔔 Assigned (Action Required)' : req.status}
                      </span>
                    </div>

                    {req.reason && <p className="text-slate-400 text-[11px] italic">"{req.reason}"</p>}

                    {req.status === 'Assigned' && (
                      <div className="space-y-2 pt-1 border-t border-blue-900/40">
                        <div className="text-[10px] text-slate-400">
                          Assigned by: <span className="text-amber-300 font-bold">{req.assignedByName || 'Management'} ({req.assignedByRole || 'Accountant'})</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptLeave(req.id)}
                            disabled={actingId === req.id}
                            className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition"
                          >
                            ✓ Accept Leave
                          </button>
                          <button
                            onClick={() => handleDeclineLeave(req.id)}
                            disabled={actingId === req.id}
                            className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold rounded-lg text-xs transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}

                    {req.status !== 'Pending' && req.status !== 'Assigned' && req.approverName && (
                      <div className="pt-1.5 border-t border-flora-border/50 text-[10px] text-slate-500 flex justify-between">
                        <span>Decided by: {req.approverName}</span>
                        {req.decisionNotes && <span className="text-slate-300">Note: {req.decisionNotes}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
