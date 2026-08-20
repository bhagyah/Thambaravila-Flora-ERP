'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailyEntry {
  date: string;
  minutes: number;
  hours: number;
  mainMinutes?: number;
  mainHours?: number;
  wfhMinutes?: number;
  wfhHours?: number;
  expectedHours: number;
  overtimeMinutes?: number;
  overtimeHours?: number;
  undertimeMinutes?: number;
  isOnLeave?: boolean;
  compliancePct: number;
}

interface SessionRecord {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  locationVerified: boolean;
  isWfh?: boolean;
  workMode?: string;
  geofenceName: string | null;
  zoneType?: string;
  clockInAccuracyMeters: number | null;
}

interface StaffRecord {
  userId: string;
  userName: string;
  email: string;
  roleName: string;
  sessionsCount: number;
  totalMinutes: number;
  totalHours: number;
  wfhMinutes?: number;
  wfhHours?: number;
  wfhSessionsCount?: number;
  onSiteMinutes?: number;
  onSiteHours?: number;
  daysPresent: number;
  daysOnLeave?: number;
  daysAbsent: number;
  expectedWorkingDays: number;
  compliancePct: number;
  overtimeMinutes: number;
  undertimeMinutes: number;
  lateCount: number;
  verifiedCount: number;
  dailyBreakdown: DailyEntry[];
  sessions: SessionRecord[];
}

interface Schedule {
  workingDays: number[];
  workStartTime: string;
  workEndTime: string;
  graceMinutes: number;
  hoursPerDay: number;
  expectedWorkingDays: number;
}

interface AttendanceStats {
  totalSessions: number;
  totalVerified: number;
  totalHoursAll: number;
  totalOvertimeMinutes?: number;
  totalOvertimeHours?: number;
  totalWfhMinutes?: number;
  totalWfhHours?: number;
  totalWfhSessions?: number;
  totalOnSiteMinutes?: number;
  totalOnSiteHours?: number;
  totalOnSiteSessions?: number;
  staffPresent: number;
  staffAbsent: number;
  totalStaff: number;
  expectedWorkingDays: number;
  attendanceRate: number;
}

interface AttendanceData {
  range: string;
  fromDate: string;
  toDate: string;
  schedule: Schedule;
  stats: AttendanceStats;
  staffSummary: StaffRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = {
  time: (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  date: (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', weekday: 'short' }),
  dateShort: (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }),
  duration: (mins: number | null | undefined) => {
    if (mins == null) return '—';
    if (mins <= 0) return '0m';
    const h = Math.floor(mins / 60), m = Math.round(mins % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ComplianceRing({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(1, pct / 100) * circ;
  const color = pct >= 90 ? '#4E9D82' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1b211f" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dy="0.35em"
        fontSize={size === 64 ? 13 : 18} fontWeight="bold" fill="white">
        {pct}%
      </text>
    </svg>
  );
}

function StatBadge({ icon, label, value, sub, color }: { icon?: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-flora-card border border-flora-border rounded-2xl p-4 hover:border-flora-sage/30 transition shadow">
      <div className="flex items-center justify-between">
        <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-xs font-bold text-slate-300 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// Daily bar chart — sparkline per staff
function DailyBars({ days, expectedHours }: { days: DailyEntry[]; expectedHours: number }) {
  if (!days.length) return <div className="text-slate-500 text-xs">No daily data</div>;
  const maxH = Math.max(expectedHours * 1.3, ...days.map((d) => d.hours), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {days.map((d) => {
        const heightPct = (d.hours / maxH) * 100;
        const isOver = d.hours > expectedHours;
        const color = d.compliancePct >= 90 ? '#4E9D82' : d.compliancePct >= 60 ? '#f59e0b' : '#ef4444';
        return (
          <div key={d.date} className="flex flex-col items-center gap-0.5 flex-1" title={`${fmt.dateShort(d.date)}: ${d.hours}h`}>
            <div className="w-full relative" style={{ height: 48 }}>
              <div
                className="absolute bottom-0 w-full rounded-t"
                style={{ height: `${heightPct}%`, backgroundColor: color, minHeight: 2 }}
              />
              {/* Expected line */}
              <div
                className="absolute w-full border-t border-dashed border-slate-500/50"
                style={{ bottom: `${(expectedHours / maxH) * 100}%` }}
              />
            </div>
            <div className="text-[8px] text-slate-500 truncate w-full text-center">
              {fmt.dateShort(d.date).split(' ')[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Staff Detail Panel (expanded inline) ─────────────────────────────────────
function StaffDetail({ staff, schedule }: { staff: StaffRecord; schedule: Schedule }) {
  const [tab, setTab] = useState<'overview' | 'daily' | 'sessions'>('overview');

  return (
    <div className="bg-flora-darker border-t border-flora-border p-5 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-flora-border pb-3">
        {(['overview', 'daily', 'sessions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition capitalize ${
              tab === t
                ? 'bg-flora-green text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'overview' ? '📊 Overview' : t === 'daily' ? '📅 Daily' : '🕐 Sessions'}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Compliance ring */}
          <div className="col-span-2 sm:col-span-1 flex flex-col items-center gap-1 bg-flora-card rounded-2xl border border-flora-border p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">Compliance</div>
            <ComplianceRing pct={staff.compliancePct} />
            <div className="text-[10px] text-slate-500">
              {staff.totalHours}h of {Math.round(schedule.hoursPerDay * staff.expectedWorkingDays)}h expected
            </div>
          </div>

          {/* Key metrics */}
          <div className="col-span-2 sm:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                icon: '📅',
                label: 'Days Present',
                value: `${staff.daysPresent}/${staff.expectedWorkingDays}`,
                sub: `${staff.daysAbsent} absent`,
                color: staff.daysPresent >= staff.expectedWorkingDays ? 'text-emerald-400' : 'text-amber-400',
              },
              {
                icon: '⏱️',
                label: 'Total Hours',
                value: `${staff.totalHours}h`,
                sub: `${staff.sessionsCount} sessions`,
                color: 'text-flora-sage',
              },
              {
                icon: '🏢',
                label: 'On-Site Work',
                value: `${staff.onSiteHours || 0}h`,
                sub: `${Math.max(0, (staff.sessionsCount || 0) - (staff.wfhSessionsCount || 0))} sessions`,
                color: 'text-emerald-400',
              },
              {
                icon: '🏠',
                label: 'Work From Home',
                value: `${staff.wfhHours || 0}h`,
                sub: `${staff.wfhSessionsCount || 0} sessions`,
                color: 'text-blue-400',
              },
              {
                icon: '⬆️',
                label: 'Overtime',
                value: staff.overtimeMinutes > 0 ? `+${fmt.duration(staff.overtimeMinutes)}` : '0m',
                sub: 'extra beyond 8h at Main Workplace',
                color: staff.overtimeMinutes > 0 ? 'text-purple-400 font-extrabold' : 'text-slate-400',
              },
              {
                icon: '⬇️',
                label: 'Undertime',
                value: staff.undertimeMinutes > 0 ? `-${fmt.duration(staff.undertimeMinutes)}` : '0m',
                sub: 'below 8h schedule',
                color: staff.undertimeMinutes > 0 ? 'text-rose-400' : 'text-slate-400',
              },
              {
                icon: '⚠️',
                label: 'Late Arrivals',
                value: staff.lateCount,
                sub: `>${schedule.graceMinutes}min grace`,
                color: staff.lateCount > 0 ? 'text-amber-400' : 'text-slate-500',
              },
              {
                icon: '📍',
                label: 'GPS Verified',
                value: `${staff.verifiedCount}/${staff.sessionsCount}`,
                sub: 'location checked',
                color: 'text-emerald-400',
              },
            ].map((m) => (
              <div key={m.label} className="bg-flora-card border border-flora-border rounded-xl p-3">
                <div className="text-lg">{m.icon}</div>
                <div className={`text-base font-extrabold ${m.color} mt-0.5`}>{m.value}</div>
                <div className="text-[10px] font-bold text-slate-400">{m.label}</div>
                <div className="text-[9px] text-slate-500">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Daily bar sparkline */}
          {staff.dailyBreakdown.length > 0 && (
            <div className="col-span-2 sm:col-span-4 bg-flora-card border border-flora-border rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Daily Hours — dashed line = expected ({schedule.hoursPerDay}h)
              </div>
              <DailyBars days={staff.dailyBreakdown} expectedHours={schedule.hoursPerDay} />
            </div>
          )}
        </div>
      )}

      {/* ── Daily Breakdown Tab ── */}
      {tab === 'daily' && (
        <div className="overflow-x-auto rounded-xl border border-flora-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-flora-border text-slate-400 uppercase tracking-wider">
                <th className="text-left p-2.5">Date</th>
                <th className="text-right p-2.5">Hours Worked</th>
                <th className="text-right p-2.5">Main Workplace</th>
                <th className="text-right p-2.5">Expected</th>
                <th className="text-right p-2.5">Overtime / Diff</th>
                <th className="text-center p-2.5">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {staff.expectedWorkingDays > 0 && (() => {
                const rows = [];
                for (const d of staff.dailyBreakdown) {
                  const hasOvertime = (d.overtimeMinutes || 0) > 0;
                  const hasUndertime = (d.undertimeMinutes || 0) > 0;
                  rows.push(
                    <tr key={d.date} className="border-b border-flora-border/50 last:border-0 hover:bg-flora-card/50">
                      <td className="p-2.5 text-slate-200 font-semibold">{fmt.date(d.date)}</td>
                      <td className="p-2.5 text-right">
                        <span className={d.hours >= d.expectedHours ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                          {d.hours}h
                        </span>
                      </td>
                      <td className="p-2.5 text-right text-slate-300">
                        {d.mainHours != null ? `${d.mainHours}h` : '—'}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">{d.expectedHours}h</td>
                      <td className="p-2.5 text-right">
                        {d.isOnLeave ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-700/50">
                            🌴 Approved Leave
                          </span>
                        ) : hasOvertime ? (
                          <span className="text-purple-400 font-bold">
                            +{fmt.duration(d.overtimeMinutes)} OT
                          </span>
                        ) : hasUndertime ? (
                          <span className="text-rose-400 font-medium">
                            -{fmt.duration(d.undertimeMinutes)} UT
                          </span>
                        ) : (
                          <span className="text-emerald-400/80 font-medium">Exact {d.expectedHours}h</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-flora-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${d.compliancePct}%`,
                                backgroundColor: d.compliancePct >= 90 ? '#4E9D82' : d.compliancePct >= 60 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 w-8">{d.compliancePct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return rows;
              })()}
            </tbody>
            <tfoot>
              <tr className="bg-flora-card/60 border-t border-flora-border font-bold">
                <td className="p-2.5 text-slate-300">Total</td>
                <td className="p-2.5 text-right text-flora-sage">{staff.totalHours}h</td>
                <td className="p-2.5 text-right text-emerald-300">{staff.onSiteHours || 0}h</td>
                <td className="p-2.5 text-right text-slate-400">
                  {Math.round(schedule.hoursPerDay * staff.expectedWorkingDays)}h
                </td>
                <td className="p-2.5 text-right">
                  {staff.overtimeMinutes > 0 ? (
                    <span className="text-purple-400 font-extrabold">
                      +{fmt.duration(staff.overtimeMinutes)} OT
                    </span>
                  ) : staff.undertimeMinutes > 0 ? (
                    <span className="text-rose-400">
                      -{fmt.duration(staff.undertimeMinutes)} UT
                    </span>
                  ) : (
                    <span className="text-emerald-400">0m OT</span>
                  )}
                </td>
                <td className="p-2.5 text-center">
                  <ComplianceRing pct={staff.compliancePct} size={40} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Sessions Tab ── */}
      {tab === 'sessions' && (
        <div className="overflow-x-auto rounded-xl border border-flora-border">
          {staff.sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No sessions in this period.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-flora-border text-slate-400 uppercase tracking-wider">
                  <th className="text-left p-2.5">Date</th>
                  <th className="text-left p-2.5">In</th>
                  <th className="text-left p-2.5">Out</th>
                  <th className="text-right p-2.5">Duration</th>
                  <th className="text-left p-2.5">Location & Mode</th>
                  <th className="text-center p-2.5">GPS</th>
                  <th className="text-right p-2.5">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {staff.sessions.map((s) => (
                  <tr key={s.id} className="border-b border-flora-border/50 last:border-0 hover:bg-flora-card/50">
                    <td className="p-2.5 text-slate-200 font-semibold">{fmt.date(s.startTime)}</td>
                    <td className="p-2.5 font-mono text-slate-300">{fmt.time(s.startTime)}</td>
                    <td className="p-2.5 font-mono text-slate-300">
                      {s.endTime ? fmt.time(s.endTime) : <span className="text-emerald-400">Active</span>}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-200">{fmt.duration(s.duration)}</td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        {s.isWfh ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            🏠 WFH
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🏢 On-Site
                          </span>
                        )}
                        <span className="text-slate-300 font-medium">{s.geofenceName || 'Approved Zone'}</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-center">{s.locationVerified ? '✅' : '⚠️'}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">
                      {s.clockInAccuracyMeters != null ? `±${Math.round(s.clockInAccuracyMeters)}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-flora-card/60 border-t border-flora-border font-bold">
                  <td colSpan={3} className="p-2.5 text-slate-400">Total</td>
                  <td className="p-2.5 text-right text-flora-sage">{fmt.duration(staff.totalMinutes)}</td>
                  <td colSpan={3} className="p-2.5 text-right text-slate-400">
                    <span className="text-blue-300 font-semibold">{staff.wfhHours || 0}h WFH</span>
                    {' · '}
                    <span className="text-emerald-300 font-semibold">{staff.onSiteHours || 0}h On-Site</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [range, setRange] = useState<RangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'hours' | 'days' | 'compliance'>('compliance');

  // Only redirect unauthenticated users. Authenticated staff should stay on the attendance page.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchData = useCallback(async () => {
    if (range === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    setData(null);
    try {
      let url = `/api/attendance?range=${range}`;
      if (range === 'custom') url += `&from=${customFrom}&to=${customTo}`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => {
    if (status === 'authenticated') fetchData();
  }, [fetchData, status]);

  if (status === 'loading') {
    return <div className="min-h-screen bg-flora-darker flex items-center justify-center text-slate-400">Loading…</div>;
  }

  const allRoles = data ? [...new Set(data.staffSummary.map((s) => s.roleName))].sort() : [];

  const filtered = (data?.staffSummary || [])
    .filter((s) => {
      const matchSearch = s.userName.toLowerCase().includes(search.toLowerCase()) ||
        s.roleName.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'all' || s.roleName === roleFilter;
      return matchSearch && matchRole;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.userName.localeCompare(b.userName);
      if (sortBy === 'hours') return b.totalMinutes - a.totalMinutes;
      if (sortBy === 'days') return b.daysPresent - a.daysPresent;
      if (sortBy === 'compliance') return b.compliancePct - a.compliancePct;
      return 0;
    });

  const stats = data?.stats;
  const schedule = data?.schedule;

  return (
    <div className="min-h-screen bg-flora-darker p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <span>🗓️</span> Attendance Overview
          </h1>
          {schedule && (
            <p className="text-slate-400 text-sm mt-1">
              Work schedule:{' '}
              <span className="text-flora-sage font-semibold">
                {schedule.workingDays.map((d) => DAY_LABELS[d]).join(', ')}
              </span>
              {' · '}{schedule.workStartTime} – {schedule.workEndTime}
              {' · '}{schedule.hoursPerDay}h/day
              {' · '}{schedule.expectedWorkingDays} expected days this period
            </p>
          )}
        </div>

        {/* Range Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              id={`attendance-range-${opt.key}`}
              onClick={() => setRange(opt.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                range === opt.key
                  ? 'bg-flora-green text-slate-950 border-flora-green shadow'
                  : 'bg-flora-card border-flora-border text-slate-300 hover:text-white hover:border-flora-sage'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date picker */}
      {range === 'custom' && (
        <div className="flex flex-wrap gap-3 items-end bg-flora-card border border-flora-border rounded-2xl p-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-semibold">From</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-flora-darker border border-flora-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-flora-sage" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-semibold">To</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="bg-flora-darker border border-flora-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-flora-sage" />
          </div>
          <button onClick={fetchData} disabled={!customFrom || !customTo}
            className="px-5 py-2 bg-flora-green hover:bg-flora-sage disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-sm transition">
            Apply
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <span className="animate-spin text-xl">⏳</span> Calculating attendance…
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatBadge icon="👥" label="Present" value={`${stats!.staffPresent}/${stats!.totalStaff}`}
              sub={`${stats!.attendanceRate}% attendance rate`} color="text-emerald-400" />
            <StatBadge icon="🏢" label="On-Site Hours" value={`${stats!.totalOnSiteHours || 0}h`}
              sub={`${stats!.totalOnSiteSessions || 0} sessions`} color="text-emerald-400" />
            <StatBadge icon="🏠" label="WFH Hours" value={`${stats!.totalWfhHours || 0}h`}
              sub={`${stats!.totalWfhSessions || 0} sessions`} color="text-blue-400" />
            <StatBadge icon="⬆️" label="Overtime Hours" value={`${stats!.totalOvertimeHours || 0}h`}
              sub="extra beyond 8h schedule" color="text-purple-400" />
            <StatBadge icon="⏱️" label="Total Hours" value={`${stats!.totalHoursAll}h`}
              sub={`${stats!.totalSessions} total sessions`} color="text-flora-sage" />
            <StatBadge icon="📅" label="Working Days" value={`${schedule!.expectedWorkingDays}d`}
              sub="expected this period" color="text-amber-400" />
            <StatBadge icon="✅" label="GPS Verified" value={stats!.totalVerified}
              sub={`of ${stats!.totalSessions} sessions`} color="text-flora-sage" />
          </div>

          {/* ── Staff Table ── */}
          <div className="bg-flora-card border border-flora-border rounded-2xl shadow-xl overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-flora-border flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <input type="text" placeholder="Search staff…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-flora-darker border border-flora-border rounded-xl px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-flora-sage w-44" />
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-flora-darker border border-flora-border rounded-xl px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-flora-sage">
                  <option value="all">All Roles</option>
                  {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-1 text-xs items-center">
                <span className="text-slate-500 mr-1">Sort:</span>
                {[
                  { key: 'compliance', label: '% Compliance' },
                  { key: 'hours', label: 'Hours' },
                  { key: 'days', label: 'Days' },
                  { key: 'name', label: 'Name' },
                ].map((s) => (
                  <button key={s.key} onClick={() => setSortBy(s.key as typeof sortBy)}
                    className={`px-2.5 py-1 rounded-lg font-semibold border transition ${
                      sortBy === s.key ? 'bg-flora-green text-slate-950 border-flora-green' : 'border-flora-border text-slate-400 hover:text-white'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-flora-border bg-flora-darker/40">
              <div className="col-span-3">Staff</div>
              <div className="col-span-2 text-center">Days Present</div>
              <div className="col-span-2 text-center">Hours Worked</div>
              <div className="col-span-2 text-center">Compliance</div>
              <div className="col-span-2 text-center">Overtime / Under</div>
              <div className="col-span-1 text-center">Status</div>
            </div>

            <div className="divide-y divide-flora-border">
              {filtered.map((staff) => {
                const isExpanded = expandedUser === staff.userId;
                const hasRecord = staff.sessionsCount > 0;
                const compliance = staff.compliancePct;

                return (
                  <div key={staff.userId}>
                    <button
                      className="w-full grid grid-cols-12 px-5 py-4 hover:bg-flora-darker/50 transition items-center text-left"
                      onClick={() => setExpandedUser(isExpanded ? null : staff.userId)}
                    >
                      {/* Name + role */}
                      <div className="col-span-3 flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-extrabold ${
                          hasRecord ? 'bg-gradient-to-br from-flora-green to-flora-sage text-slate-950' : 'bg-flora-border text-slate-500'
                        }`}>
                          {staff.userName[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 text-sm truncate">{staff.userName}</div>
                          <div className="text-[10px] text-slate-500 truncate">{staff.roleName}</div>
                        </div>
                      </div>

                      {/* Days present */}
                      <div className="col-span-2 text-center">
                        <div className="text-sm font-bold text-slate-200">
                          {staff.daysPresent}
                          <span className="text-slate-500 font-normal text-xs">/{staff.expectedWorkingDays}</span>
                        </div>
                        <div className="flex flex-col text-[10px]">
                          {staff.daysOnLeave != null && staff.daysOnLeave > 0 && (
                            <span className="text-blue-400 font-medium">{staff.daysOnLeave}d on leave</span>
                          )}
                          {staff.daysAbsent > 0 && (
                            <span className="text-rose-400">{staff.daysAbsent} absent</span>
                          )}
                        </div>
                      </div>

                      {/* Hours */}
                      <div className="col-span-2 text-center">
                        <div className={`text-sm font-bold ${hasRecord ? 'text-flora-sage' : 'text-slate-600'}`}>
                          {hasRecord ? `${staff.totalHours}h` : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          of {Math.round(schedule!.hoursPerDay * staff.expectedWorkingDays)}h
                        </div>
                      </div>

                      {/* Compliance ring */}
                      <div className="col-span-2 flex justify-center">
                        {hasRecord ? (
                          <ComplianceRing pct={compliance} size={44} />
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </div>

                      {/* Overtime / undertime */}
                      <div className="col-span-2 text-center">
                        {staff.overtimeMinutes > 0 ? (
                          <div className="text-xs font-bold text-purple-400">
                            +{fmt.duration(staff.overtimeMinutes)} OT
                          </div>
                        ) : staff.undertimeMinutes > 0 ? (
                          <div className="text-xs font-bold text-rose-400">
                            -{fmt.duration(staff.undertimeMinutes)} UT
                          </div>
                        ) : hasRecord ? (
                          <div className="text-xs text-emerald-400 font-medium">0m OT</div>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                        {staff.lateCount > 0 && (
                          <div className="text-[10px] text-amber-400">{staff.lateCount}× late</div>
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-1 flex justify-center">
                        {!hasRecord ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-900/30 text-rose-300 border border-rose-700/30">Absent</span>
                        ) : compliance >= 90 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-700/40">✓ Good</span>
                        ) : compliance >= 60 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-900/30 text-amber-300 border border-amber-700/30">⚠ Partial</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-900/30 text-rose-300 border border-rose-700/30">↓ Low</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <StaffDetail staff={staff} schedule={schedule!} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-amber-400/50 text-center">
            ⚠️ Geofence verification is best-effort — GPS data is not tamper-proof.
          </p>
        </>
      )}
    </div>
  );
}
