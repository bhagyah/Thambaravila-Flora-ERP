'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatLKR } from '@/lib/utils/formatters';
import AreaTrendChart from '../charts/AreaTrendChart';
import BarChartWidget from '../charts/BarChartWidget';
import DonutGaugeChart from '../charts/DonutGaugeChart';
import MetricSparkCard from '../charts/MetricSparkCard';
import TargetProgressRing from '../charts/TargetProgressRing';
import ScheduledLiabilityPanel from '../finance/ScheduledLiabilityPanel';
import DailyCashflowPanel from '../finance/DailyCashflowPanel';
import LabourOperationsPanel from '../labour/LabourOperationsPanel';

interface AnalyticsData {
  role: string;
  range?: string;
  comparisonLabel?: string;
  targetInfo?: {
    timeframeLabel: string;
    targetAmount: number;
    achievedAmount: number;
    remainingAmount: number;
    progressPct: number;
    yearlyTarget?: number;
    monthlyTarget?: number;
    weeklyTarget?: number;
    dailyTarget?: number;
  };
  deltas?: {
    leadsChangePct: number;
    conversionChangePct: number;
    bookingsChangePct: number;
    revenueChangePct: number;
  };
  sparklines?: {
    leads: number[];
    conversion: number[];
    bookings: number[];
    revenue: number[];
  };
  kpis: {
    totalLeads: number;
    wonLeads: number;
    conversionRate: number;
    totalBookings: number;
    totalContractValue: number;
    totalCollectedRevenue: number;
    totalPendingReceivables: number;
    totalExpenses: number;
    netBalance: number;
    overdueCount: number;
    usersCount: number;
    auditLogsCount: number;
    activeSessionsCount: number;
  };
  charts: {
    leadStages: Array<{ label: string; count: number; percent: number }>;
    leadSources: Array<{ label: string; count: number; percent: number }>;
    monthlyTrend: Array<{ month: string; revenue: number; expenses: number; netProfit: number }>;
    paymentStages: Array<{ stage: string; total: number; paid: number }>;
    topVenues: Array<{ name: string; city: string; capacity: number; bookingsCount: number }>;
    topVendors: Array<{ name: string; category: string; rating: number }>;
  };
  recentBookings: Array<{
    id: string;
    customerName: string;
    weddingDate: string;
    packageType: string;
    totalQuoteAmount: number;
    paymentStatus: string;
    bookingStatus: string;
  }>;
  recentLeads: Array<{
    id: string;
    customerName: string;
    source: string;
    stage: string;
    budget: number;
    converted: boolean;
  }>;
}

interface RoleDashboardViewProps {
  userRole: string;
  userName: string;
}

function createEmptyAnalytics(role: string): AnalyticsData {
  return {
    role,
    range: '1m',
    comparisonLabel: 'Analytics unavailable',
    kpis: {
      totalLeads: 0,
      wonLeads: 0,
      conversionRate: 0,
      totalBookings: 0,
      totalContractValue: 0,
      totalCollectedRevenue: 0,
      totalPendingReceivables: 0,
      totalExpenses: 0,
      netBalance: 0,
      overdueCount: 0,
      usersCount: 0,
      auditLogsCount: 0,
      activeSessionsCount: 0,
    },
    charts: {
      leadStages: [],
      leadSources: [],
      monthlyTrend: [],
      paymentStages: [],
      topVenues: [],
      topVendors: [],
    },
    recentBookings: [],
    recentLeads: [],
  };
}

export default function RoleDashboardView({ userRole, userName }: RoleDashboardViewProps) {
  const [activeRolePerspective, setActiveRolePerspective] = useState<string>(userRole);
  const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | '1y' | 'custom'>('1m');
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-31');

  // Dashboard View Mode: 'full' or 'targets_only'
  const [viewMode, setViewMode] = useState<'full' | 'targets_only'>('full');

  // Target Settings Modal state
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInputMode, setTargetInputMode] = useState<'yearly' | 'monthly'>('yearly');
  const [targetInputValue, setTargetInputValue] = useState<string>('60000000');
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetSuccessMsg, setTargetSuccessMsg] = useState('');

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics(timeRange, startDate, endDate);
    fetchTargetConfig();
  }, [timeRange]);

  const fetchAnalytics = async (
    range: string = timeRange,
    start: string = startDate,
    end: string = endDate
  ) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      setLoading(true);
      setAnalyticsError(null);
      if (userRole === 'Accountant') {
        await fetch('/api/payments/activate-confirmed', { method: 'POST', signal: controller.signal });
      }
      const params = new URLSearchParams({
        range,
        ...(range === 'custom' && { startDate: start, endDate: end }),
      });

      const res = await fetch(`/api/analytics/dashboard?${params}`, { signal: controller.signal });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        throw new Error(`Analytics request failed (${res.status})`);
      }
    } catch (e) {
      console.error('Failed to load analytics dashboard data', e);
      setAnalyticsError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Analytics are taking too long to load.'
          : 'Analytics could not be loaded right now.'
      );
      setData((current) => current || createEmptyAnalytics(userRole));
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  };

  const fetchTargetConfig = async () => {
    try {
      const res = await fetch('/api/targets/config');
      if (res.ok) {
        const json = await res.json();
        if (json.config?.yearlyTarget) {
          setTargetInputValue(json.config.yearlyTarget.toString());
        }
      }
    } catch (e) {
      console.error('Failed to load target config', e);
    }
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTarget(true);
    setTargetSuccessMsg('');
    try {
      const numVal = parseFloat(targetInputValue) || 60000000;
      const payload = targetInputMode === 'yearly' ? { yearlyTarget: numVal } : { monthlyTarget: numVal };

      const res = await fetch('/api/targets/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setTargetSuccessMsg('✓ Revenue targets updated and prorated across all timeframes!');
        if (json.config?.yearlyTarget) {
          setTargetInputValue(json.config.yearlyTarget.toString());
        }
        setTimeout(() => {
          setShowTargetModal(false);
          setTargetSuccessMsg('');
          fetchAnalytics();
        }, 1200);
      }
    } catch (e) {
      console.error('Failed to update target config', e);
    } finally {
      setSavingTarget(false);
    }
  };

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics('custom', startDate, endDate);
  };

  const isOwnerOrIT = userRole === 'Owner' || userRole === 'IT/Admin';
  const isOwner = userRole === 'Owner';
  const formatDashboardLKR = (val: number | string | null | undefined) => formatLKR(val, false);



  const formatChange = (val: number | undefined) => {
    if (val === undefined) return '+0%';
    return `${val >= 0 ? '+' : ''}${val}%`;
  };

  if (loading && !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-flora-green border-t-transparent rounded-full animate-spin"></div>
        <p className="text-flora-sage font-semibold text-sm animate-pulse">Computing Real-time Analytics &amp; True Period Comparisons...</p>
      </div>
    );
  }

  const dashboardData = data || createEmptyAnalytics(userRole);
  const { kpis, charts, recentBookings, recentLeads, comparisonLabel = 'vs Prev Period', deltas, sparklines, targetInfo } = dashboardData;

  // Compute live auto-calculations for the target modal
  const rawInput = parseFloat(targetInputValue) || 0;
  const computedYearly = targetInputMode === 'yearly' ? rawInput : rawInput * 12;
  const computedMonthly = Math.round(computedYearly / 12);
  const computedWeekly = Math.round(computedYearly / 52);
  const computedDaily = Math.round(computedYearly / 365);

  return (
    <div className="space-y-4 sm:space-y-6">
      {analyticsError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-center justify-between gap-3">
          <span>{analyticsError}</span>
          <button
            onClick={() => fetchAnalytics(timeRange, startDate, endDate)}
            className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-100 hover:bg-amber-500/25"
          >
            Retry
          </button>
        </div>
      )}

      {/* Brand Header Banner with Official Logo */}
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-flora-border bg-flora-dark/95 p-4 shadow-xl sm:rounded-3xl sm:p-5 md:flex-row md:items-center md:gap-6">
        {/* Background Watermark Logo Emblem */}
        <div className="pointer-events-none absolute right-3 top-1/2 h-16 w-28 -translate-y-1/2 opacity-[0.07] sm:right-6 sm:h-20 sm:w-40 sm:opacity-10">
          <Image src="/logo.svg" alt="Watermark Logo" fill sizes="(max-width: 640px) 112px, 160px" className="scale-[2.1] object-contain object-center" />
        </div>

        <div className="z-10 flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-flora-border bg-flora-darker shadow-inner sm:h-14 sm:w-14 sm:rounded-2xl">
            <Image src="/logo.svg" alt="Thambaravila Flora Logo" width={48} height={48} className="scale-[2.1] object-contain object-center" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="rounded-full bg-gradient-to-r from-flora-green to-flora-sage px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-950 shadow sm:px-3 sm:py-0.5 sm:text-[11px]">
                {activeRolePerspective} Viewpoint
              </span>
              <span className="hidden text-xs font-mono font-semibold text-flora-sage sm:inline">● Live ERP Sync</span>
            </div>
            <h1 className="mt-1 text-lg font-black tracking-tight text-slate-100 sm:text-2xl">
              Welcome back, {userName}
            </h1>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400 sm:text-xs">
              Thambaravila Flora Executive Analytics &amp; Wedding Production Dashboard
            </p>
          </div>
        </div>

        {/* Perspective Switcher for Owner/IT */}
        {isOwnerOrIT && (
          <div className="z-10 flex flex-wrap gap-1 rounded-xl border border-flora-border bg-flora-darker p-1.5 text-xs sm:rounded-2xl">
            {['Owner', 'Sales Manager', 'Accountant', 'Wedding Coordinator', 'Social Media Manager', 'IT/Admin'].map((r) => (
              <button
                key={r}
                onClick={() => setActiveRolePerspective(r)}
                className={`min-h-11 rounded-xl px-3 py-2 font-bold transition ${
                  activeRolePerspective === r
                    ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-flora-card'
                }`}
              >
                {r.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Dashboard Control Bar: Timeframe & View Mode Switcher */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-flora-border bg-flora-dark/90 p-3 shadow-xl sm:p-3.5 lg:flex-row lg:items-center">
        {/* Left: View Mode Toggle & Timeframe Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle: Full Overview vs Target Focus */}
          <div className="flex w-full items-center rounded-xl border border-flora-border bg-flora-darker p-1 text-xs font-bold sm:w-auto">
            <button
              onClick={() => setViewMode('full')}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition sm:flex-none ${
                viewMode === 'full'
                  ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-extrabold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📊</span>
              <span>Full View</span>
            </button>
            <button
              onClick={() => setViewMode('targets_only')}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition sm:flex-none ${
                viewMode === 'targets_only'
                  ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-extrabold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🎯</span>
              <span>Target-Only View</span>
            </button>
          </div>

          <div className="h-6 w-px bg-flora-border hidden sm:block"></div>

          {/* Timeframe Selector */}
          <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-flora-border bg-flora-darker p-1 text-xs font-semibold sm:flex sm:w-auto sm:flex-wrap">
            <button
              onClick={() => setTimeRange('1d')}
              className={`min-h-11 rounded-lg px-3 py-2 transition ${
                timeRange === '1d'
                  ? 'bg-flora-green text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-flora-card'
              }`}
            >
              Daily
            </button>

            <button
              onClick={() => setTimeRange('1w')}
              className={`min-h-11 rounded-lg px-3 py-2 transition ${
                timeRange === '1w'
                  ? 'bg-flora-green text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-flora-card'
              }`}
            >
              1 Week
            </button>

            <button
              onClick={() => setTimeRange('1m')}
              className={`min-h-11 rounded-lg px-3 py-2 transition ${
                timeRange === '1m'
                  ? 'bg-flora-green text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-flora-card'
              }`}
            >
              Monthly
            </button>

            <button
              onClick={() => setTimeRange('1y')}
              className={`min-h-11 rounded-lg px-3 py-2 transition ${
                timeRange === '1y'
                  ? 'bg-flora-green text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-flora-card'
              }`}
            >
              Yearly
            </button>

            <button
              onClick={() => setTimeRange('custom')}
              className={`col-span-2 min-h-11 rounded-lg px-3 py-2 transition sm:col-span-1 ${
                timeRange === 'custom'
                  ? 'bg-flora-green text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-flora-card'
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Right: Owner Target Setter Button (OWNER ONLY) & Comparison Badge */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isOwner && (
            <button
              onClick={() => setShowTargetModal(true)}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-300 shadow transition hover:bg-amber-500/30"
            >
              <span>🎯</span>
              <span>Change Targets</span>
            </button>
          )}

          <div className="flex min-h-11 items-center gap-1 rounded-xl border border-flora-sage/30 bg-flora-sage/10 px-3 py-2 text-xs font-extrabold text-flora-sage shadow-inner">
            <span>⚡</span>
            <span>{comparisonLabel}</span>
          </div>

          {timeRange === 'custom' && (
            <form onSubmit={handleCustomApply} className="grid w-full grid-cols-1 gap-2 text-xs sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <div className="flex min-h-11 items-center gap-1.5 rounded-lg border border-flora-border bg-flora-darker px-3 py-2">
                <span className="text-slate-500 font-semibold">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-100 outline-none"
                />
              </div>

              <div className="flex min-h-11 items-center gap-1.5 rounded-lg border border-flora-border bg-flora-darker px-3 py-2">
                <span className="text-slate-500 font-semibold">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-100 outline-none"
                />
              </div>

              <button
                type="submit"
                className="min-h-11 rounded-lg bg-gradient-to-r from-flora-green to-flora-sage px-3 py-2 font-bold text-slate-950 shadow transition"
              >
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      {(userRole === 'Owner' || userRole === 'Accountant') &&
        (activeRolePerspective === 'Owner' || activeRolePerspective === 'Accountant') &&
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <DailyCashflowPanel />
          <ScheduledLiabilityPanel />
        </div>}

      {(userRole === 'Owner' || userRole === 'Accountant' || userRole === 'IT/Admin') &&
        (activeRolePerspective === 'Owner' || activeRolePerspective === 'Accountant' || activeRolePerspective === 'IT/Admin') &&
        <LabourOperationsPanel />}

      {/* ── CONDITIONAL VIEW MODE 1: TARGET-ONLY FOCUS VIEW ────────────────── */}
      {viewMode === 'targets_only' && (
        <div className="space-y-5">
          {/* Target Header Status Card */}
          <div className="bg-gradient-to-br from-flora-dark to-flora-card border border-flora-border rounded-2xl p-5 shadow-2xl space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-flora-border pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase text-flora-sage tracking-widest">
                    🎯 Master Target Hub
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {targetInfo?.timeframeLabel || 'Active Filter'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-100 mt-1">
                  Revenue Collection vs Master Target Goal
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pro-rated target allocations automatically calculated from central Yearly Business Target.
                </p>
              </div>

              {isOwner && (
                <button
                  onClick={() => setShowTargetModal(true)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-extrabold rounded-xl text-xs shadow transition flex items-center space-x-1.5"
                >
                  <span>⚙️</span>
                  <span>Adjust Master Target</span>
                </button>
              )}
            </div>

            {/* Target Ring & Progress Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-4 flex justify-center">
                <TargetProgressRing
                  targetInfo={targetInfo}
                  achievedAmount={targetInfo?.achievedAmount || 0}
                  targetAmount={targetInfo?.targetAmount || 1}
                  label={targetInfo?.timeframeLabel || 'Target'}
                />
              </div>

              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-flora-darker border border-flora-border rounded-xl p-3.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Target</div>
                    <div className="text-lg font-extrabold text-slate-100 mt-0.5">
                      {formatDashboardLKR(targetInfo?.targetAmount || 0)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{targetInfo?.timeframeLabel}</div>
                  </div>

                  <div className="bg-flora-darker border border-flora-border rounded-xl p-3.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirmed Revenue</div>
                    <div className="text-lg font-extrabold text-flora-green mt-0.5">
                      {formatDashboardLKR(targetInfo?.achievedAmount || 0)}
                    </div>
                    <div className="text-[10px] text-emerald-400/80 mt-0.5">Paid into accounts</div>
                  </div>

                  <div className="bg-flora-darker border border-flora-border rounded-xl p-3.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining to Goal</div>
                    <div className="text-lg font-extrabold text-amber-400 mt-0.5">
                      {formatDashboardLKR(targetInfo?.remainingAmount || 0)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Needed for 100% completion</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-300">
                    <span>Overall Completion Rate</span>
                    <span className="text-flora-sage font-extrabold">{targetInfo?.progressPct || 0}%</span>
                  </div>
                  <div className="w-full bg-flora-darker rounded-full h-3 border border-flora-border overflow-hidden p-0.5">
                    <div
                      className="bg-gradient-to-r from-flora-green to-flora-sage h-full rounded-full transition-all duration-700 shadow"
                      style={{ width: `${targetInfo?.progressPct || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Card Multi-Timeframe Target Breakdowns */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2.5 flex items-center space-x-2">
              <span>📅</span>
              <span>Prorated Multi-Timeframe Target Breakdown</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                {
                  title: 'Daily Target',
                  icon: '☀️',
                  target: targetInfo?.dailyTarget || Math.round((targetInfo?.yearlyTarget || 60000000) / 365),
                  sub: 'Yearly / 365 days',
                  color: 'text-cyan-400',
                },
                {
                  title: 'Weekly Target',
                  icon: '📅',
                  target: targetInfo?.weeklyTarget || Math.round((targetInfo?.yearlyTarget || 60000000) / 52),
                  sub: 'Yearly / 52 weeks',
                  color: 'text-emerald-400',
                },
                {
                  title: 'Monthly Target',
                  icon: '📆',
                  target: targetInfo?.monthlyTarget || Math.round((targetInfo?.yearlyTarget || 60000000) / 12),
                  sub: 'Yearly / 12 months',
                  color: 'text-flora-sage',
                },
                {
                  title: 'Yearly Master Target',
                  icon: '🏆',
                  target: targetInfo?.yearlyTarget || 60000000,
                  sub: 'Annual Business Goal',
                  color: 'text-amber-400',
                },
              ].map((card) => {
                const pct = card.target > 0 ? Math.min(100, Math.round(((targetInfo?.achievedAmount || 0) / card.target) * 100)) : 0;
                return (
                  <div key={card.title} className="bg-flora-card border border-flora-border rounded-xl p-4 shadow-lg space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xl">{card.icon}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-flora-darker border border-flora-border ${card.color}`}>
                        {card.title}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg font-extrabold text-slate-100">{formatDashboardLKR(card.target)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{card.sub}</div>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-flora-border/60">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Current Filter Collections:</span>
                        <span className="font-bold text-flora-green">{formatDashboardLKR(targetInfo?.achievedAmount || 0)}</span>
                      </div>
                      <div className="w-full bg-flora-darker rounded-full h-1.5 overflow-hidden border border-flora-border">
                        <div
                          className="bg-gradient-to-r from-flora-green to-flora-sage h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Stage Targets Breakdown */}
          <div className="bg-flora-card border border-flora-border rounded-2xl p-5 shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>💳</span>
              <span>Payment Stage Collection Progress against Target</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {charts.paymentStages.map((stg) => {
                const pct = stg.total > 0 ? Math.min(100, Math.round((stg.paid / stg.total) * 100)) : 0;
                return (
                  <div key={stg.stage} className="bg-flora-darker border border-flora-border p-3.5 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                      <span>{stg.stage}</span>
                      <span className="text-flora-sage">{pct}% Paid</span>
                    </div>
                    <div className="text-base font-extrabold text-slate-100">
                      {formatDashboardLKR(stg.paid)}{' '}
                      <span className="text-xs text-slate-500 font-normal">/ {formatDashboardLKR(stg.total)}</span>
                    </div>
                    <div className="w-full bg-flora-card rounded-full h-1.5 overflow-hidden border border-flora-border">
                      <div
                        className="bg-gradient-to-r from-flora-green to-flora-sage h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONDITIONAL VIEW MODE 2: FULL EXECUTIVE OVERVIEW ────────────────── */}
      {viewMode === 'full' && (
        <>
          {/* KPI Cards Row (Role Tailored, Time Filtered & Automatically Compared) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(activeRolePerspective === 'Owner' || activeRolePerspective === 'Sales Manager') && (
              <>
                <MetricSparkCard
                  label="Total Lead Pipeline"
                  value={kpis.totalLeads.toString()}
                  change={formatChange(deltas?.leadsChangePct)}
                  isPositive={(deltas?.leadsChangePct || 0) >= 0}
                  icon="📥"
                  accentColor="teal"
                  sparklineData={sparklines?.leads}
                  href="/leads"
                />
                <MetricSparkCard
                  label="Won Conversion Rate"
                  value={`${kpis.conversionRate}%`}
                  change={formatChange(deltas?.conversionChangePct)}
                  isPositive={(deltas?.conversionChangePct || 0) >= 0}
                  icon="🏆"
                  accentColor="emerald"
                  sparklineData={sparklines?.conversion}
                  href="/leads"
                />
                <MetricSparkCard
                  label="Active Event Bookings"
                  value={kpis.totalBookings.toString()}
                  change={formatChange(deltas?.bookingsChangePct)}
                  isPositive={(deltas?.bookingsChangePct || 0) >= 0}
                  icon="💍"
                  accentColor="cyan"
                  sparklineData={sparklines?.bookings}
                  href="/bookings"
                />
                <MetricSparkCard
                  label="Total Contract Value"
                  value={formatDashboardLKR(kpis.totalContractValue)}
                  change={formatChange(deltas?.revenueChangePct)}
                  isPositive={(deltas?.revenueChangePct || 0) >= 0}
                  icon="💼"
                  accentColor="purple"
                  sparklineData={sparklines?.revenue}
                  href="/bookings"
                />
              </>
            )}

            {activeRolePerspective === 'Accountant' && (
              <>
                <MetricSparkCard
                  label="Confirmed Collections"
                  value={formatDashboardLKR(kpis.totalCollectedRevenue)}
                  change={formatChange(deltas?.revenueChangePct)}
                  isPositive={(deltas?.revenueChangePct || 0) >= 0}
                  icon="💰"
                  accentColor="emerald"
                  sparklineData={sparklines?.revenue}
                />
                <MetricSparkCard
                  label="Pending Receivables"
                  value={formatDashboardLKR(kpis.totalPendingReceivables)}
                  change="-2%"
                  isPositive={false}
                  icon="⏳"
                  accentColor="amber"
                />
                <MetricSparkCard
                  label="Production Expenses"
                  value={formatDashboardLKR(kpis.totalExpenses)}
                  change="+4%"
                  isPositive={false}
                  icon="🧾"
                  accentColor="rose"
                />
                <MetricSparkCard
                  label="Net Working Balance"
                  value={formatDashboardLKR(kpis.netBalance)}
                  change={formatChange(deltas?.revenueChangePct)}
                  isPositive={kpis.netBalance >= 0}
                  icon="⚖️"
                  accentColor="teal"
                />
              </>
            )}

            {(activeRolePerspective === 'Wedding Coordinator' || activeRolePerspective === 'Social Media Manager' || activeRolePerspective === 'IT/Admin') && (
              <>
                <MetricSparkCard
                  label="Confirmed Events"
                  value={kpis.totalBookings.toString()}
                  change={formatChange(deltas?.bookingsChangePct)}
                  isPositive={(deltas?.bookingsChangePct || 0) >= 0}
                  icon="🗓️"
                  accentColor="teal"
                  sparklineData={sparklines?.bookings}
                />
                <MetricSparkCard
                  label="New Inquiries"
                  value={kpis.totalLeads.toString()}
                  change={formatChange(deltas?.leadsChangePct)}
                  isPositive={(deltas?.leadsChangePct || 0) >= 0}
                  icon="💬"
                  accentColor="emerald"
                  sparklineData={sparklines?.leads}
                />
                <MetricSparkCard
                  label="Active Users"
                  value={kpis.usersCount.toString()}
                  change="+0%"
                  isPositive={true}
                  icon="👥"
                  accentColor="cyan"
                />
                <MetricSparkCard
                  label="Audit Log Entries"
                  value={kpis.auditLogsCount.toString()}
                  change="+12%"
                  isPositive={true}
                  icon="🛡️"
                  accentColor="purple"
                />
              </>
            )}
          </div>

          {/* Primary Side-by-Side Visual Grid: Area Trend Curve (2 Cols) + Donut Target Gauge (1 Col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <AreaTrendChart title="Financial & Revenue Trend Curve" subtitle={`Confirmed collections, floral expenses, and net profit (${comparisonLabel})`} data={charts.monthlyTrend} />
            </div>
            <div className="lg:col-span-1">
              <DonutGaugeChart
                title={targetInfo?.timeframeLabel || 'Target Tracking'}
                subtitle={`Confirmed collections vs target (${comparisonLabel})`}
                targetAmount={targetInfo?.targetAmount || 1500000}
                achievedAmount={targetInfo?.achievedAmount || 0}
                items={
                  activeRolePerspective === 'Accountant'
                    ? [
                        { label: 'Advance (30%)', value: charts.paymentStages[0]?.paid || 0, color: '#4E9D82' },
                        { label: 'Flower (40%)', value: charts.paymentStages[1]?.paid || 0, color: '#6BAF91' },
                        { label: 'Final (30%)', value: charts.paymentStages[2]?.paid || 0, color: '#38bdf8' },
                      ]
                    : [
                        { label: 'Won / Confirmed', value: kpis.wonLeads || 0, color: '#4E9D82' },
                        {
                          label: 'Open Pipeline',
                          value: Math.max(
                            0,
                            kpis.totalLeads -
                              kpis.wonLeads -
                              (charts.leadStages.find((stage) => stage.label === 'LOST')?.count || 0)
                          ),
                          color: '#38bdf8',
                        },
                        {
                          label: 'Failed / Declined',
                          value: charts.leadStages.find((stage) => stage.label === 'LOST')?.count || 0,
                          color: '#fb7185',
                        },
                      ]
                }
              />
            </div>
          </div>

          {/* Secondary Side-by-Side Visual Grid: Lead Stages Funnel (2 Cols) + Lead Sources (1 Col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BarChartWidget
                title="Lead Pipeline Stage Funnel"
                subtitle={`Inquiries progressing through sales stages (${comparisonLabel})`}
                items={charts.leadStages.map(s => ({
                  label: s.label,
                  count: s.count,
                  percent: s.percent,
                }))}
                layout="horizontal"
              />
            </div>
            <div className="lg:col-span-1 grid min-h-0 grid-rows-2 gap-4">
              <div className="min-h-0 overflow-hidden rounded-2xl border border-flora-border bg-flora-dark/90 p-4 shadow-xl">
                <div className="flex items-start justify-between gap-3 border-b border-flora-border pb-2.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-100">Recent Confirmed Bookings</h3>
                    <p className="mt-0.5 text-[10px] text-slate-400">Latest confirmed contracts</p>
                  </div>
                  <Link href="/bookings" className="shrink-0 text-[11px] font-semibold text-flora-sage hover:underline">View All</Link>
                </div>
                <div className="mt-2 divide-y divide-flora-border/60">
                  {recentBookings.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">No bookings yet.</div>
                  ) : recentBookings.slice(0, 3).map((booking) => (
                    <Link key={booking.id} href={`/bookings/${booking.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-flora-card">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-100">{booking.customerName}</div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500">{booking.id}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold text-flora-green">{formatDashboardLKR(booking.totalQuoteAmount)}</div>
                        <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">{booking.paymentStatus.replace(/_/g, ' ')}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="min-h-0 overflow-hidden rounded-2xl border border-flora-border bg-flora-dark/90 p-4 shadow-xl">
                <div className="flex items-start justify-between gap-3 border-b border-flora-border pb-2.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-100">Active Lead Pipeline</h3>
                    <p className="mt-0.5 text-[10px] text-slate-400">Current pre-conversion inquiries</p>
                  </div>
                  <Link href="/leads" className="shrink-0 text-[11px] font-semibold text-flora-sage hover:underline">View All</Link>
                </div>
                <div className="mt-2 divide-y divide-flora-border/60">
                  {recentLeads.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">No active leads.</div>
                  ) : recentLeads.slice(0, 3).map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-100">{lead.customerName}</div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500">{lead.source.replace(/_/g, ' ')}</div>
                      </div>
                      <span className="shrink-0 rounded border border-blue-500/30 bg-blue-500/20 px-2 py-1 text-[9px] font-bold text-blue-300">
                        {lead.stage.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden">
            {/* Confirmed Event Bookings */}
            <div className="bg-flora-dark/90 border border-flora-border rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex justify-between items-center border-b border-flora-border pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>💍</span>
                    <span>Recent Confirmed Bookings</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Latest post-conversion event contracts</p>
                </div>
                <Link href="/bookings" className="text-xs font-semibold text-flora-sage hover:underline">
                  View All →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-flora-darker text-slate-400 font-bold border-b border-flora-border uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Booking ID</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Total Quote</th>
                      <th className="p-2">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flora-border/60">
                    {recentBookings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">No bookings yet.</td>
                      </tr>
                    ) : (
                      recentBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-flora-card transition">
                          <td className="p-2 font-bold text-flora-sage">
                            <Link href={`/bookings/${b.id}`} className="hover:underline">{b.id}</Link>
                          </td>
                          <td className="p-2 font-semibold text-slate-100">{b.customerName}</td>
                          <td className="p-2 font-bold text-flora-green">{formatDashboardLKR(b.totalQuoteAmount)}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-flora-card text-slate-300 border border-flora-border">
                              {b.paymentStatus.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lead Pipeline Inquiries */}
            <div className="bg-flora-dark/90 border border-flora-border rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex justify-between items-center border-b border-flora-border pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>📥</span>
                    <span>Active Lead Pipeline</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Pre-conversion client inquiries</p>
                </div>
                <Link href="/leads" className="text-xs font-semibold text-flora-sage hover:underline">
                  View All →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-flora-darker text-slate-400 font-bold border-b border-flora-border uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Lead ID</th>
                      <th className="p-2">Client</th>
                      <th className="p-2">Channel</th>
                      <th className="p-2">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flora-border/60">
                    {recentLeads.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">No active leads.</td>
                      </tr>
                    ) : (
                      recentLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-flora-card transition">
                          <td className="p-2 font-bold text-flora-sage">{l.id}</td>
                          <td className="p-2 font-semibold text-slate-100">{l.customerName}</td>
                          <td className="p-2 font-medium text-slate-400">{l.source.replace(/_/g, ' ')}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.stage === 'WON' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                              {l.stage.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── OWNER TARGET SETTING MODAL (OWNER ONLY) ────────────────────────── */}
      {showTargetModal && isOwner && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-flora-card border border-flora-border rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start border-b border-flora-border pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-100 flex items-center space-x-2">
                  <span>🎯</span>
                  <span>Set Master Revenue Target Goal</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter a Master Yearly or Monthly Target. The system will automatically calculate, prorate, and project targets for Daily, Weekly, Monthly, and Yearly timeframes across all dashboards.
                </p>
              </div>
              <button
                onClick={() => setShowTargetModal(false)}
                className="text-slate-400 hover:text-white font-bold text-xl"
              >
                ✕
              </button>
            </div>

            {targetSuccessMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-xl text-xs font-bold">
                {targetSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveTarget} className="space-y-4">
              {/* Input Mode Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-300 block">Target Input Format</label>
                <div className="grid grid-cols-2 gap-2 bg-flora-darker p-1 rounded-xl border border-flora-border text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      if (targetInputMode !== 'yearly') {
                        setTargetInputMode('yearly');
                        setTargetInputValue((parseFloat(targetInputValue) * 12).toString());
                      }
                    }}
                    className={`py-2 rounded-lg transition ${
                      targetInputMode === 'yearly'
                        ? 'bg-flora-green text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🏆 Master Yearly Target
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (targetInputMode !== 'monthly') {
                        setTargetInputMode('monthly');
                        setTargetInputValue(Math.round(parseFloat(targetInputValue) / 12).toString());
                      }
                    }}
                    className={`py-2 rounded-lg transition ${
                      targetInputMode === 'monthly'
                        ? 'bg-flora-green text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📆 Master Monthly Target
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {targetInputMode === 'yearly' ? 'Yearly Revenue Goal (LKR)' : 'Monthly Revenue Goal (LKR)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-bold">LKR</span>
                  <input
                    type="number"
                    required
                    min={100000}
                    step={50000}
                    value={targetInputValue}
                    onChange={(e) => setTargetInputValue(e.target.value)}
                    className="w-full bg-flora-darker border border-flora-border rounded-xl py-2 pl-14 pr-4 text-slate-100 text-sm font-mono font-bold focus:outline-none focus:border-flora-sage"
                    placeholder="e.g. 60000000"
                  />
                </div>
              </div>

              {/* Live Automatic Pro-rated Target Preview */}
              <div className="bg-flora-darker border border-flora-border rounded-2xl p-3.5 space-y-2">
                <div className="text-[11px] font-bold text-flora-sage uppercase tracking-wider">
                  ⚡ Live Auto-Prorated Timeframe Breakdown Preview:
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-flora-card p-2 rounded-xl border border-flora-border">
                    <span className="text-[10px] text-slate-400 block">☀️ Daily Target:</span>
                    <span className="font-extrabold text-cyan-300">{formatDashboardLKR(computedDaily)} / day</span>
                  </div>

                  <div className="bg-flora-card p-2 rounded-xl border border-flora-border">
                    <span className="text-[10px] text-slate-400 block">📅 Weekly Target:</span>
                    <span className="font-extrabold text-emerald-300">{formatDashboardLKR(computedWeekly)} / week</span>
                  </div>

                  <div className="bg-flora-card p-2 rounded-xl border border-flora-border">
                    <span className="text-[10px] text-slate-400 block">📆 Monthly Target:</span>
                    <span className="font-extrabold text-flora-sage">{formatDashboardLKR(computedMonthly)} / month</span>
                  </div>

                  <div className="bg-flora-card p-2 rounded-xl border border-flora-border">
                    <span className="text-[10px] text-slate-400 block">🏆 Yearly Target:</span>
                    <span className="font-extrabold text-amber-300">{formatDashboardLKR(computedYearly)} / year</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingTarget}
                  className="flex-1 py-2.5 bg-gradient-to-r from-flora-green to-flora-sage hover:opacity-90 text-slate-950 font-extrabold rounded-xl text-sm transition shadow disabled:opacity-50"
                >
                  {savingTarget ? 'Saving & Applying...' : '💾 Save Target Goals'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTargetModal(false)}
                  className="px-5 py-2.5 bg-flora-darker hover:bg-flora-card border border-flora-border text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
