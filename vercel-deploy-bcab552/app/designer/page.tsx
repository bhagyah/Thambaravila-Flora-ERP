'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BookingItem {
  id: string;
  weddingDate: string;
  dayOfWeek: string;
  guestCount: number | null;
  packageType: string;
  serviceScope: string;
  colourTheme: string | null;
  totalQuoteAmount: number; // stored in cents
  bookingStatus: 'INQUIRY' | 'CONFIRMED' | 'IN_DESIGN' | 'IN_PRODUCTION' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  confirmationStatus: 'PENDING' | 'CONFIRMED' | 'NOT_CONFIRMED';
  quotationAttachmentUrl?: string | null;
  quotationAttachmentName?: string | null;
  jobSheetAttachmentUrl?: string | null;
  jobSheetAttachmentName?: string | null;
  quoteOutcomeReason?: string | null;
  daysUntilWedding: number;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  ceremonyVenue?: { name: string; cityArea: string; loadInNotes?: string; floralRestrictions?: string } | null;
  receptionVenue?: { name: string; cityArea: string; loadInNotes?: string; floralRestrictions?: string } | null;
}

// Stage Definition & Labels
const STAGES = [
  { key: 'INQUIRY', label: '1. Initial Meeting & Consultation', icon: '💬', color: 'border-blue-500/40 text-blue-400 bg-blue-950/30' },
  { key: 'IN_DESIGN', label: '2. Design & Quotation Stage', icon: '🎨', color: 'border-pink-500/40 text-pink-400 bg-pink-950/30' },
  { key: 'CONFIRMED', label: '3. Quote Approved & Confirmed', icon: '💍', color: 'border-amber-500/40 text-amber-400 bg-amber-950/30' },
  { key: 'IN_PRODUCTION', label: '4. Flower Production & Prep', icon: '🌸', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30' },
  { key: 'DELIVERED', label: '5. On-Site Setup & Delivery', icon: '🚚', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30' },
  { key: 'COMPLETED', label: '6. Event Completed & Teardown', icon: '✅', color: 'border-slate-700 text-slate-300 bg-slate-900' },
  { key: 'CANCELLED', label: 'Quote Declined / Not Confirmed', icon: '✕', color: 'border-rose-500/40 text-rose-300 bg-rose-950/30' },
];

export default function DesignerDashboardPage() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');

  // Job Sheet & Quotation Editor Modal State
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showJobSheetModal, setShowJobSheetModal] = useState(false);

  // Form State for Quotation & Budget Editing
  const [quoteBudget, setQuoteBudget] = useState('');
  const [quoteTheme, setQuoteTheme] = useState('');
  const [quotePackage, setQuotePackage] = useState('CLASSIC_ELEGANCE');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [jobSheetFile, setJobSheetFile] = useState<File | null>(null);
  const [quoteMode, setQuoteMode] = useState<'draft' | 'approve' | 'rework'>('draft');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pending Stage Selection State (prevents immediate accidental mutations)
  const [pendingStages, setPendingStages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (session) {
      fetchBookings();
    }
  }, [session]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
      }
    } catch (e) {
      console.error('Failed to load designer bookings:', e);
    } finally {
      setLoading(false);
    }
  };

  // Change Stage Handler (persists to backend API so all roles see updated stage)
  const handleStageChange = async (bookingId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingStatus: newStatus }),
      });

      if (res.ok) {
        setPendingStages(prev => {
          const copy = { ...prev };
          delete copy[bookingId];
          return copy;
        });
        fetchBookings();
        setFeedback({ text: `✓ Job ${bookingId} stage approved & updated to "${newStatus.replace(/_/g, ' ')}"!`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        const data = await res.json();
        setFeedback({ text: data.error || 'Failed to update stage', type: 'error' });
      }
    } catch (err) {
      setFeedback({ text: 'Error updating stage', type: 'error' });
    }
  };

  // Open Quotation & Budget Modal
  const openQuoteModal = (b: BookingItem, mode: 'draft' | 'approve' | 'rework' = 'draft') => {
    setSelectedBooking(b);
    setQuoteMode(mode);
    const amountInLKR = (b.totalQuoteAmount / 100).toString();
    setQuoteBudget(amountInLKR);
    setQuoteTheme(b.colourTheme || '');
    setQuotePackage(b.packageType || 'CLASSIC_ELEGANCE');
    setQuoteNotes(b.notes || '');
    setQuotationFile(null);
    setFeedback(null);
    setShowQuoteModal(true);
  };

  // Save Quotation & Budget Changes
  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    if (!selectedBooking.quotationAttachmentUrl && !quotationFile) {
      setFeedback({ text: 'Please upload the quotation PDF before saving.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const numericBudget = parseFloat(quoteBudget) || 0;
      const payload = new FormData();
      payload.append('totalQuoteAmount', String(numericBudget));
      payload.append('colourTheme', quoteTheme);
      payload.append('packageType', quotePackage);
      payload.append('notes', quoteNotes);
      payload.append('bookingStatus', quoteMode === 'approve' ? 'IN_PRODUCTION' : 'IN_DESIGN');
      payload.append(
        'confirmationStatus',
        quoteMode === 'approve' ? 'CONFIRMED' : quoteMode === 'rework' ? 'NOT_CONFIRMED' : 'PENDING'
      );
      payload.append('action', quoteMode === 'approve' ? 'CONFIRM_QUOTE' : quoteMode === 'rework' ? 'DECLINE_QUOTE' : 'SAVE_QUOTE');
      if (quotationFile) {
        payload.append('quotationFile', quotationFile);
      }

      const res = await fetch(`/api/bookings/${selectedBooking.id}`, {
        method: 'PATCH',
        body: payload,
      });

      if (res.ok) {
        setFeedback({
          text:
            quoteMode === 'approve'
              ? `✓ Quotation confirmed and moved to production for ${selectedBooking.id}!`
              : quoteMode === 'rework'
              ? `✓ Quotation sent back for redesign on ${selectedBooking.id}.`
              : `✓ Quotation saved for ${selectedBooking.id}.`,
          type: 'success',
        });
        setShowQuoteModal(false);
        fetchBookings();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        const data = await res.json();
        setFeedback({ text: data.error || 'Failed to update quotation', type: 'error' });
      }
    } catch (err) {
      setFeedback({ text: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineQuote = async (booking: BookingItem) => {
    const reason = window.prompt('Reason for declining this quote?', booking.quoteOutcomeReason || 'Client declined the quotation');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DECLINE_QUOTE',
          quoteOutcomeReason: reason.trim() || 'Client declined the quotation',
        }),
      });

      if (res.ok) {
        fetchBookings();
        setFeedback({ text: `✓ Booking ${booking.id} sent back for redesign.`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        const data = await res.json();
        setFeedback({ text: data.error || 'Failed to decline quote', type: 'error' });
      }
    } catch {
      setFeedback({ text: 'Failed to decline quote', type: 'error' });
    }
  };

  const handleSaveJobSheet = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!selectedBooking || !jobSheetFile) {
      setFeedback({ text: 'Please choose a job sheet file first.', type: 'error' });
      return;
    }

    const canUploadJobSheet = ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(selectedBooking.bookingStatus);
    if (!canUploadJobSheet) {
      setFeedback({ text: 'Job sheet upload opens from stage 4: Flower Production & Prep.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = new FormData();
      payload.append('jobSheetFile', jobSheetFile);

      const res = await fetch(`/api/bookings/${selectedBooking.id}`, {
        method: 'PATCH',
        body: payload,
      });

      if (res.ok) {
        fetchBookings();
        setShowJobSheetModal(false);
        setJobSheetFile(null);
        setFeedback({ text: `✓ Job sheet uploaded for ${selectedBooking.id}!`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        const data = await res.json();
        setFeedback({ text: data.error || 'Failed to upload job sheet', type: 'error' });
      }
    } catch {
      setFeedback({ text: 'Failed to upload job sheet', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  const roleName = session.user?.role?.name || '';
  const isAllowed = ['Floral Designer', 'Owner', 'Wedding Coordinator', 'IT/Admin', 'Sales Manager'].includes(roleName);

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <h2 className="text-2xl font-black text-rose-500">Access Restricted</h2>
          <p className="text-slate-400 text-xs mt-2">The Designer Studio is restricted to Designer, Owner, and Coordinator roles.</p>
        </div>
      </div>
    );
  }

  // Filtered Bookings
  const filteredBookings = bookings.filter(b => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      b.id.toLowerCase().includes(q) ||
      b.customer.name.toLowerCase().includes(q) ||
      (b.colourTheme || '').toLowerCase().includes(q) ||
      (b.ceremonyVenue?.name || '').toLowerCase().includes(q) ||
      (b.receptionVenue?.name || '').toLowerCase().includes(q);

    const matchesStage = selectedStageFilter === 'ALL' || b.bookingStatus === selectedStageFilter;
    return matchesSearch && matchesStage;
  });

  // Calculate Stage Funnel Counters (How many jobs passed each stage)
  const stageCounts = STAGES.reduce((acc, stage) => {
    acc[stage.key] = bookings.filter(b => b.bookingStatus === stage.key).length;
    return acc;
  }, {} as Record<string, number>);

  const formatLKRDisplay = (amount: number) => {
    const val = amount / 100;
    return `LKR ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-900/30 p-6 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-pink-500 to-rose-500 text-slate-950 uppercase tracking-wider">
                Lead Floral Designer Workspace
              </span>
              <span className="text-rose-400 text-xs font-mono font-semibold">● Job Sheets &amp; Design Quotations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              Floral Designer Studio &amp; Job Stages
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Design floral quotations, track event job sheets, and update booking stages in real time across the team.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/venues"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 shadow transition flex items-center space-x-1.5"
            >
              <span>🏛️</span>
              <span>Venue Directory</span>
            </Link>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold border shadow-lg animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Stage Pass-Through Funnel Counters (Job Flow Analytics) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <span>📊</span>
              <span>Event Job Stage Pipeline Funnel ({bookings.length} Total Jobs)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Real-Time Stage Sync</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAGES.map((s) => {
              const count = stageCounts[s.key] || 0;
              const isSelected = selectedStageFilter === s.key;
              return (
                <div
                  key={s.key}
                  onClick={() => setSelectedStageFilter(isSelected ? 'ALL' : s.key)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-gradient-to-b from-rose-950/80 to-slate-900 border-rose-500 text-white shadow-lg ring-2 ring-rose-500/40'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-xl font-black font-mono text-rose-400">{count}</span>
                  </div>
                  <div className="text-[11px] font-bold leading-tight">{s.label}</div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {bookings.length > 0 ? `${((count / bookings.length) * 100).toFixed(0)}% of total` : '0%'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by job ID, couple, theme, venue..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 w-full sm:w-72"
            />
          </div>

          <div className="flex items-center space-x-3 text-xs w-full sm:w-auto justify-end">
            <span className="text-slate-400 font-bold">Stage Filter:</span>
            <select
              value={selectedStageFilter}
              onChange={e => setSelectedStageFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">All Stages ({bookings.length})</option>
              {STAGES.map(s => (
                <option key={s.key} value={s.key}>
                  {s.label} ({stageCounts[s.key] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Job Sheets & Due Events Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-medium">Loading event job sheets...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            No event jobs found matching the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBookings.map((booking) => {
              const currentStage = STAGES.find(s => s.key === booking.bookingStatus) || STAGES[1];
              const isDraftStage = booking.bookingStatus === 'IN_DESIGN';
              const isApprovedQuote = booking.confirmationStatus === 'CONFIRMED';
              const needsRedesign = booking.confirmationStatus === 'NOT_CONFIRMED' || booking.quoteOutcomeReason;

              return (
                <div
                  key={booking.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                >
                  {/* Top Row: Job ID & Wedding Date */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-950 text-rose-300 border border-rose-800">
                            {booking.id}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {booking.packageType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-slate-100 mt-1">{booking.customer.name}</h3>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-1 rounded-lg">
                          📅 {new Date(booking.weddingDate).toLocaleDateString('en-GB')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          {booking.daysUntilWedding >= 0 ? `${booking.daysUntilWedding} days away` : 'Past event'}
                        </div>
                      </div>
                    </div>

                    {/* Venue & Design Theme */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center space-x-1.5 text-slate-300">
                        <span>🏛️</span>
                        <span className="font-semibold text-slate-200">
                          {booking.ceremonyVenue?.name || booking.receptionVenue?.name || 'Venue to be confirmed'}
                        </span>
                      </div>

                      {booking.colourTheme && (
                        <div className="flex items-center space-x-1.5 text-rose-300 font-medium">
                          <span>🎨</span>
                          <span>Theme: {booking.colourTheme}</span>
                        </div>
                      )}

                      {booking.guestCount && (
                        <div className="text-slate-400 text-[11px]">
                          👥 {booking.guestCount} Guests · Scope: {booking.serviceScope.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>

                    {/* Stage Switcher with Sequential Locking & Explicit Approval Button */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
                        <span>Current Job Stage:</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] border font-extrabold ${currentStage.color}`}>
                          {currentStage.icon} {currentStage.label.split('.')[1]?.trim()}
                        </span>
                      </div>

                      {(() => {
                        const currentIdx = STAGES.findIndex(s => s.key === booking.bookingStatus);
                        const activeValue = pendingStages[booking.id] || booking.bookingStatus;
                        const isPendingChange = pendingStages[booking.id] && pendingStages[booking.id] !== booking.bookingStatus;

                        return (
                          <div className="space-y-2">
                            <select
                              value={activeValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPendingStages(prev => ({ ...prev, [booking.id]: val }));
                              }}
                              className={`w-full bg-slate-900 border rounded-lg p-2 text-xs font-bold focus:outline-none transition ${
                                isPendingChange ? 'border-amber-500 text-amber-300 ring-1 ring-amber-500/50' : 'border-slate-800 text-slate-100'
                              }`}
                            >
                              {STAGES.map((s, idx) => {
                                const isCurrent = s.key === booking.bookingStatus;
                                const isNext = idx === currentIdx + 1;
                                const isPrev = idx === currentIdx - 1;
                                const isAllowed = isCurrent || isNext || isPrev || roleName === 'Owner';

                                return (
                                  <option
                                    key={s.key}
                                    value={s.key}
                                    disabled={!isAllowed}
                                    className={!isAllowed ? 'text-slate-600 bg-slate-950' : 'text-slate-100 font-bold'}
                                  >
                                    {s.label} {!isAllowed ? '🔒 (Locked: Must progress step-by-step)' : isNext ? ' ➔ [Next Step]' : isCurrent ? ' (Active)' : ''}
                                  </option>
                                );
                              })}
                            </select>

                            {/* Explicit Stage Approval Button */}
                            {isPendingChange ? (
                              <div className="flex gap-2 pt-1 animate-in fade-in">
                                <button
                                  onClick={() => handleStageChange(booking.id, pendingStages[booking.id])}
                                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg shadow-lg flex items-center justify-center space-x-1.5 transition"
                                >
                                  <span>✓ Approve &amp; Confirm Stage</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setPendingStages(prev => {
                                      const copy = { ...prev };
                                      delete copy[booking.id];
                                      return copy;
                                    });
                                  }}
                                  className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg border border-slate-700 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              currentIdx >= 0 && currentIdx < 5 && (
                                <button
                                  onClick={() => {
                                    const nextStageKey = STAGES[currentIdx + 1].key;
                                    setPendingStages(prev => ({ ...prev, [booking.id]: nextStageKey }));
                                  }}
                                  className="w-full py-1 text-[11px] font-bold text-rose-300 hover:text-rose-200 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/40 rounded-lg transition flex items-center justify-center space-x-1"
                                >
                                  <span>Select Step {currentIdx + 2} ({STAGES[currentIdx + 1].label.split('.')[1]?.trim()}) ➔</span>
                                </button>
                              )
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => handleDeclineQuote(booking)}
                      className="w-full py-1.5 text-[11px] font-bold rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition"
                    >
                      Send Back for Redesign
                    </button>

                    {/* Budget & Quotation Amount Bar */}
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Package Quote Budget:</span>
                        <span className="font-mono font-extrabold text-amber-400 text-sm">
                          {formatLKRDisplay(booking.totalQuoteAmount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openQuoteModal(booking, isApprovedQuote ? 'approve' : needsRedesign ? 'rework' : 'draft')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold rounded-lg border border-slate-700 transition text-[11px] flex items-center space-x-1"
                        >
                          <span>{isDraftStage ? 'Upload Quotation & Save' : isApprovedQuote ? 'View Quotation' : 'Edit Quote'}</span>
                        </button>
                        {needsRedesign && (
                          <button
                            onClick={() => openQuoteModal(booking, 'rework')}
                            className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 font-bold rounded-lg border border-rose-800/40 transition text-[11px]"
                          >
                            Redesign Quotation
                          </button>
                        )}
                        {booking.quotationAttachmentUrl && (
                          <a
                            href={booking.quotationAttachmentUrl}
                            download={booking.quotationAttachmentName || `${booking.id}-quotation.pdf`}
                            className="px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 font-bold rounded-lg border border-emerald-800/40 transition text-[11px]"
                          >
                            View Quotation
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setJobSheetFile(null);
                        setFeedback(null);
                        setShowJobSheetModal(true);
                      }}
                      className="flex-1 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 text-rose-300 border border-rose-500/30 transition flex items-center justify-center space-x-1.5"
                    >
                      <span>📋</span>
                      <span>Job Sheet</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL 1: DESIGN QUOTATION & BUDGET EDITOR ───────────────────────────── */}
      {showQuoteModal && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center space-x-2">
                  <span>🎨</span>
                  <span>
                    {quoteMode === 'approve'
                      ? 'Approve Floral Quotation'
                      : quoteMode === 'rework'
                      ? 'Redesign Floral Quotation'
                      : 'Upload Floral Quotation'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {quoteMode === 'approve'
                    ? `Review the previous quotation for Job ${selectedBooking.id}.`
                    : quoteMode === 'rework'
                    ? `Upload the revised quotation for Job ${selectedBooking.id}.`
                    : `Save the stage 2 quotation for Job ${selectedBooking.id}.`}
                </p>
              </div>
              <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveQuotation} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Couple / Customer</label>
                <input
                  type="text"
                  disabled
                  value={selectedBooking.customer.name}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-400 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Floral Package Type</label>
                <select
                  value={quotePackage}
                  onChange={e => setQuotePackage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-rose-500"
                >
                  <option value="ESSENTIAL_BLOOM">Essential Bloom Package</option>
                  <option value="CLASSIC_ELEGANCE">Classic Elegance Package</option>
                  <option value="PREMIUM_BLOOM_PACKAGE">Premium Bloom Package</option>
                  <option value="SIGNATURE_LUXURY">Signature Luxury Package</option>
                  <option value="BESPOKE_CUSTOM">Bespoke Custom Floral Architecture</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Design Color Theme &amp; Style</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Blush Pink & Champagne Gold"
                  value={quoteTheme}
                  onChange={e => setQuoteTheme(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Total Quote Budget (LKR)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="e.g. 450000"
                  value={quoteBudget}
                  onChange={e => setQuoteBudget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-bold focus:outline-none focus:border-rose-500 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Design Specifications &amp; Notes</label>
                <textarea
                  rows={3}
                  placeholder="Special floral requirements, arrangement specifications..."
                  value={quoteNotes}
                  onChange={e => setQuoteNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Quotation File (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setQuotationFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-[11px]"
                />
                {selectedBooking.quotationAttachmentUrl && (
                  <a
                    href={selectedBooking.quotationAttachmentUrl}
                    download={selectedBooking.quotationAttachmentName || `${selectedBooking.id}-quotation.pdf`}
                    className="inline-block mt-2 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    View current quotation
                  </a>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold rounded-xl border border-slate-800 bg-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving...'
                    : quoteMode === 'approve'
                    ? 'Confirm Quotation'
                    : quoteMode === 'rework'
                    ? 'Save Redesign'
                    : 'Upload & Save Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: FULL DUE JOB SHEET VIEW ────────────────────────────────────── */}
      {showJobSheetModal && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 text-xs max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                    JOB SHEET #{selectedBooking.id}
                  </span>
                  <span className="text-slate-400 font-bold">
                    📅 {new Date(selectedBooking.weddingDate).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-100 mt-1">{selectedBooking.customer.name} — Floral Execution Sheet</h2>
              </div>
              <button onClick={() => setShowJobSheetModal(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Client Contact</div>
                <div className="font-bold text-slate-200">{selectedBooking.customer.name}</div>
                <div className="text-slate-400 font-mono text-[11px]">📞 {selectedBooking.customer.phone}</div>
                {selectedBooking.customer.email && <div className="text-slate-400 text-[11px]">✉️ {selectedBooking.customer.email}</div>}
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Ceremony &amp; Reception Venue</div>
                <div className="font-bold text-slate-200">
                  {selectedBooking.ceremonyVenue?.name || selectedBooking.receptionVenue?.name || 'Venue TBD'}
                </div>
                <div className="text-slate-400 text-[11px]">
                  📍 {selectedBooking.ceremonyVenue?.cityArea || selectedBooking.receptionVenue?.cityArea || 'N/A'}
                </div>
              </div>
            </div>

            {/* Design Spec Summary */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-rose-400 uppercase tracking-wider text-[11px]">Design Package &amp; Specifications</h4>

              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Package Type:</span>
                  <span className="font-bold">{selectedBooking.packageType.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Color Theme:</span>
                  <span className="font-bold text-rose-300">{selectedBooking.colourTheme || 'Not set'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Service Scope:</span>
                  <span className="font-bold">{selectedBooking.serviceScope.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Design Budget:</span>
                  <span className="font-mono font-bold text-amber-400">{formatLKRDisplay(selectedBooking.totalQuoteAmount)}</span>
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <strong className="text-slate-300">Designer Notes:</strong> {selectedBooking.notes}
                </div>
              )}
            </div>

            {/* Venue Load-In Notes if available */}
            {(selectedBooking.ceremonyVenue?.loadInNotes || selectedBooking.receptionVenue?.loadInNotes) && (
              <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-2xl text-xs space-y-1">
                <div className="font-bold text-rose-300 flex items-center space-x-1">
                  <span>🏛️</span>
                  <span>Venue Setup &amp; Rigging Requirements</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  {selectedBooking.ceremonyVenue?.loadInNotes || selectedBooking.receptionVenue?.loadInNotes}
                </p>
              </div>
            )}

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Job Sheet File</div>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setJobSheetFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-[11px]"
              />
              {selectedBooking.jobSheetAttachmentUrl && (
                <a
                  href={selectedBooking.jobSheetAttachmentUrl}
                  download={selectedBooking.jobSheetAttachmentName || `${selectedBooking.id}-job-sheet.pdf`}
                  className="inline-block text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  View current job sheet
                </a>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowJobSheetModal(false);
                  openQuoteModal(selectedBooking);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold rounded-xl border border-slate-700"
              >
                ✏️ Edit Quotation &amp; Budget
              </button>

              <div className="flex items-center gap-2">
                {selectedBooking.jobSheetAttachmentUrl && (
                  <a
                    href={selectedBooking.jobSheetAttachmentUrl}
                    download={selectedBooking.jobSheetAttachmentName || `${selectedBooking.id}-job-sheet.pdf`}
                    className="px-4 py-2 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 font-bold rounded-xl border border-emerald-800/40"
                  >
                    View / Download
                  </a>
                )}
                <button
                  onClick={handleSaveJobSheet}
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-extrabold rounded-xl shadow disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Upload Job Sheet'}
                </button>
                <button
                  onClick={() => setShowJobSheetModal(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold rounded-xl border border-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
