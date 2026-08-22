'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { formatLKR } from '@/lib/utils/formatters';

interface BookingData {
  id: string;
  weddingDate: string;
  daysUntilWedding: number;
  totalQuoteAmount: number;
  depositAmount: number;
  balanceDueAmount: number;
  paymentStatus: string;
  bookingStatus: string;
  serviceScope?: string;
  quotationAttachmentName?: string;
  jobSheetAttachmentUrl?: string;
  notes?: string;
  customer?: {
    name: string;
    phone: string;
    email?: string;
  };
  ceremonyVenue?: {
    name: string;
  };
  receptionVenue?: {
    name: string;
  };
  photographerVendor?: {
    name: string;
  };
  decoratorVendor?: {
    name: string;
  };
  catererVendor?: {
    name: string;
  };
  salesExec?: {
    name: string;
  };
  paymentStages?: Array<{
    status: string;
    amountPaid: number;
    amountDue: number;
  }>;
}

export default function SalesTrackerPage() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracker' | 'meetings' | 'followup' | 'kpis'>('tracker');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
        setBookings(data);
      }
    } catch (e) {
      console.error('Failed to load bookings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const res = await fetch('/api/sales/tracker/export');
      if (!res.ok) {
        throw new Error('Failed to generate Excel file');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `NEXT_30_DAYS_WEDDING_TRACKER_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Error downloading Excel sheet: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (!session) return null;

  const now = new Date();
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const next30DaysBookings = bookings.filter((b) => {
    const wDate = new Date(b.weddingDate);
    return wDate >= new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) && wDate <= thirtyDaysAhead;
  });

  const displayList = next30DaysBookings.length > 0 ? next30DaysBookings : bookings;

  // KPI calculations
  const totalWeddings = displayList.length;
  const totalPackageValue = displayList.reduce((sum, b) => sum + (b.totalQuoteAmount || 0), 0);
  const totalAdvanceReceived = displayList.reduce((sum, b) => {
    const paidStages = (b.paymentStages || []).filter((p) => p.status === 'PAID');
    const paid = paidStages.reduce((pSum, p) => pSum + (p.amountPaid || p.amountDue || 0), 0);
    return sum + (paid || b.depositAmount || 0);
  }, 0);
  const totalBalancePending = displayList.reduce((sum, b) => sum + (b.balanceDueAmount || 0), 0);
  const pendingOverdueCount = displayList.filter(
    (b) => b.paymentStatus === 'OVERDUE' || b.paymentStatus === 'DEPOSIT_DUE' || b.paymentStatus === 'PARTIAL_PAYMENT' || b.balanceDueAmount > 0
  ).length;
  const jobSheetsNotCompleted = displayList.filter((b) => !b.jobSheetAttachmentUrl).length;

  const filteredBookings = displayList.filter((b) => {
    const nameMatch = (b.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const venueMatch = (b.ceremonyVenue?.name || b.receptionVenue?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const idMatch = (b.id || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSearch = nameMatch || venueMatch || idMatch;
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'CONFIRMED') return matchesSearch && b.bookingStatus === 'CONFIRMED';
    if (statusFilter === 'OVERDUE') return matchesSearch && b.paymentStatus === 'OVERDUE';
    if (statusFilter === 'PENDING_BALANCE') return matchesSearch && b.balanceDueAmount > 0;
    if (statusFilter === 'NO_JOBSHEET') return matchesSearch && !b.jobSheetAttachmentUrl;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-extrabold text-xs rounded border border-emerald-500/30">
                SALES ROLE DESK
              </span>
              <span className="text-xs text-slate-400 font-mono">Automated 5-Sheet Excel System</span>
            </div>
            <h1 className="text-3xl font-black text-slate-100 tracking-tight mt-1">
              Next 30 Days Wedding Dashboard &amp; Tracker
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Live pipeline tracker auto-populating bookings, payments, quotations, job sheets, and meeting registers.
            </p>
          </div>

          <button
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 transition-all duration-200 border border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {downloading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating 5-Sheet Excel...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Next 30 Days Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>

        {/* 6 KPI Cards matching Sheet 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
          {/* Card 1: Total Weddings */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-4.5 shadow-lg backdrop-blur-xl transition-all duration-200 flex flex-col justify-between min-w-0 group">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Total Weddings
              </span>
              <span className="text-sm shrink-0 p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                💍
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <div className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight truncate" title={String(totalWeddings)}>
                {totalWeddings}
              </div>
              <div className="text-[11px] text-emerald-400 mt-1 font-medium truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="truncate">Next 30-day pipeline</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Package Value */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-4.5 shadow-lg backdrop-blur-xl transition-all duration-200 flex flex-col justify-between min-w-0 group">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Total Package Value
              </span>
              <span className="text-sm shrink-0 p-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                💼
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <div className="text-lg sm:text-xl xl:text-lg 2xl:text-xl font-black text-cyan-400 tracking-tight truncate" title={formatLKR(totalPackageValue)}>
                {formatLKR(totalPackageValue)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                <span className="truncate">Contract value</span>
              </div>
            </div>
          </div>

          {/* Card 3: Advance Received */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-4.5 shadow-lg backdrop-blur-xl transition-all duration-200 flex flex-col justify-between min-w-0 group">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Advance Received
              </span>
              <span className="text-sm shrink-0 p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                💰
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <div className="text-lg sm:text-xl xl:text-lg 2xl:text-xl font-black text-emerald-400 tracking-tight truncate" title={formatLKR(totalAdvanceReceived)}>
                {formatLKR(totalAdvanceReceived)}
              </div>
              <div className="text-[11px] text-emerald-400/90 mt-1 font-medium truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="truncate">Deposits collected</span>
              </div>
            </div>
          </div>

          {/* Card 4: Balance Pending */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-4.5 shadow-lg backdrop-blur-xl transition-all duration-200 flex flex-col justify-between min-w-0 group">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Balance Pending
              </span>
              <span className="text-sm shrink-0 p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                ⏳
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <div className="text-lg sm:text-xl xl:text-lg 2xl:text-xl font-black text-amber-400 tracking-tight truncate" title={formatLKR(totalBalancePending)}>
                {formatLKR(totalBalancePending)}
              </div>
              <div className="text-[11px] text-amber-400/90 mt-1 font-medium truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                <span className="truncate">To collect before event</span>
              </div>
            </div>
          </div>

          {/* Card 5: Pending / Overdue */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-4.5 shadow-lg backdrop-blur-xl transition-all duration-200 flex flex-col justify-between min-w-0 group">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Pending / Overdue
              </span>
              <span className={`text-sm shrink-0 p-1 rounded-lg border ${
                pendingOverdueCount > 0
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
              }`}>
                ⚠️
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <div className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
                pendingOverdueCount > 0 ? 'text-rose-400' : 'text-slate-100'
              }`} title={String(pendingOverdueCount)}>
                {pendingOverdueCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium truncate flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pendingOverdueCount > 0 ? 'bg-rose-400' : 'bg-slate-500'}`}></span>
                <span className="truncate">Requires follow-up</span>
              </div>
            </div>
          </div>

          {/* Card 6: Job Sheets Missing */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-4.5 shadow-lg backdrop-blur-xl transition-all duration-200 flex flex-col justify-between min-w-0 group">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Job Sheets Missing
              </span>
              <span className={`text-sm shrink-0 p-1 rounded-lg border ${
                jobSheetsNotCompleted > 0
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
              }`}>
                📋
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <div className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
                jobSheetsNotCompleted > 0 ? 'text-amber-400' : 'text-slate-100'
              }`} title={String(jobSheetsNotCompleted)}>
                {jobSheetsNotCompleted}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium truncate flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${jobSheetsNotCompleted > 0 ? 'bg-amber-400' : 'bg-slate-500'}`}></span>
                <span className="truncate">Production pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs & Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('tracker')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'tracker'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Next 30 Days Tracker
              </button>
              <button
                onClick={() => setActiveTab('meetings')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'meetings'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Meeting Register
              </button>
              <button
                onClick={() => setActiveTab('followup')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'followup'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Weekly Action Follow-up
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search client, venue, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-60"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="ALL">All Bookings</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PENDING_BALANCE">Pending Balance</option>
                <option value="OVERDUE">Overdue</option>
                <option value="NO_JOBSHEET">Missing Job Sheet</option>
              </select>
            </div>
          </div>

          {/* Tab Content: Tracker Table */}
          {activeTab === 'tracker' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
                    <th className="py-3 px-3.5">Wedding Date</th>
                    <th className="py-3 px-3.5 text-center">Days</th>
                    <th className="py-3 px-3.5">Client Name</th>
                    <th className="py-3 px-3.5">Contact No.</th>
                    <th className="py-3 px-3.5">Venue</th>
                    <th className="py-3 px-3.5 text-right">Package</th>
                    <th className="py-3 px-3.5 text-right">Advance</th>
                    <th className="py-3 px-3.5 text-right">Balance</th>
                    <th className="py-3 px-3.5 text-center">Payment Status</th>
                    <th className="py-3 px-3.5 text-center">Job Sheet</th>
                    <th className="py-3 px-3.5 text-center">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        Loading tracker data...
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500">
                        No bookings found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => {
                      const daysLeft = b.daysUntilWedding ?? Math.max(0, Math.ceil((new Date(b.weddingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                      const isHighRisk = daysLeft <= 10 && (!b.jobSheetAttachmentUrl || b.paymentStatus === 'OVERDUE' || b.balanceDueAmount > 20000000);

                      return (
                        <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-semibold text-slate-200">
                            {new Date(b.weddingDate).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-3 px-3.5 text-center font-bold text-slate-300">
                            {daysLeft}d
                          </td>
                          <td className="py-3 px-3.5 font-bold text-slate-100">
                            {b.customer?.name || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">
                            {b.customer?.phone || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-300">
                            {b.ceremonyVenue?.name || b.receptionVenue?.name || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-right font-bold text-cyan-300 font-mono">
                            {formatLKR(b.totalQuoteAmount)}
                          </td>
                          <td className="py-3 px-3.5 text-right text-emerald-400 font-mono">
                            {formatLKR(b.depositAmount)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-bold text-amber-400 font-mono">
                            {formatLKR(b.balanceDueAmount)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                                b.paymentStatus === 'PAID_IN_FULL'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : b.paymentStatus === 'OVERDUE'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {b.paymentStatus ? b.paymentStatus.replace(/_/g, ' ') : 'NOT STARTED'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                b.jobSheetAttachmentUrl
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : daysLeft <= 14
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-slate-700/50 text-slate-400'
                              }`}
                            >
                              {b.jobSheetAttachmentUrl ? 'Completed' : daysLeft <= 14 ? 'In Progress' : 'Not Started'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isHighRisk
                                  ? 'text-rose-400 bg-rose-950/60 border border-rose-800/40'
                                  : daysLeft <= 20
                                  ? 'text-amber-400 bg-amber-950/60 border border-amber-800/40'
                                  : 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                              }`}
                            >
                              {isHighRisk ? 'High' : daysLeft <= 20 ? 'Medium' : 'Low'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Content: Meeting Register */}
          {activeTab === 'meetings' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Time</th>
                    <th className="py-3 px-3.5">Client Name</th>
                    <th className="py-3 px-3.5">Wedding Date</th>
                    <th className="py-3 px-3.5">Meeting Level</th>
                    <th className="py-3 px-3.5">Responsible</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {displayList.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-slate-200">
                        {new Date(new Date(b.weddingDate).getTime() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400">10:00 AM</td>
                      <td className="py-3 px-3.5 font-bold text-slate-100">{b.customer?.name || '-'}</td>
                      <td className="py-3 px-3.5 text-slate-300">{new Date(b.weddingDate).toLocaleDateString('en-GB')}</td>
                      <td className="py-3 px-3.5 text-slate-300">Final</td>
                      <td className="py-3 px-3.5 text-slate-300">{b.salesExec?.name || 'Chinthaka / Madhuni'}</td>
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                          Scheduled
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-400">{b.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Content: Weekly Action Follow-up */}
          {activeTab === 'followup' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
                    <th className="py-3 px-3.5">Client Name</th>
                    <th className="py-3 px-3.5">Wedding Date</th>
                    <th className="py-3 px-3.5">Issue Area</th>
                    <th className="py-3 px-3.5">Action Required</th>
                    <th className="py-3 px-3.5">Responsible</th>
                    <th className="py-3 px-3.5">Priority</th>
                    <th className="py-3 px-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {displayList.map((b) => {
                    const daysLeft = Math.max(0, Math.ceil((new Date(b.weddingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                    let issue = 'Logistics & Confirmation';
                    let action = 'Finalize stem checklist & floor plan';
                    let priority = 'Medium';

                    if (b.balanceDueAmount > 0 && daysLeft <= 14) {
                      issue = 'Payment Balance';
                      action = 'Collect balance payment before setup';
                      priority = 'High';
                    } else if (!b.jobSheetAttachmentUrl && daysLeft <= 10) {
                      issue = 'Job Sheet';
                      action = 'Generate and hand over production job sheet';
                      priority = 'High';
                    }

                    return (
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-100">{b.customer?.name || '-'}</td>
                        <td className="py-3 px-3.5 text-slate-300">{new Date(b.weddingDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-3 px-3.5 text-amber-400 font-medium">{issue}</td>
                        <td className="py-3 px-3.5 text-slate-200">{action}</td>
                        <td className="py-3 px-3.5 text-slate-300">{b.salesExec?.name || 'Chinthaka / Madhuni'}</td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              priority === 'High'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {priority}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400">
                            In Progress
                          </span>
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
    </div>
  );
}
