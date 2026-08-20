'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Geofence {
  name: string;
  zoneType?: string;
  isMain?: boolean;
}

interface WorkSession {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  notes: string | null;
  locationVerified: boolean;
  isWfh?: boolean;
  workMode?: string;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockInAccuracyMeters: number | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
  clockOutAccuracyMeters: number | null;
  geofence: Geofence | null;
  deviceInfo: string | null;
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export default function WorkSessionsPage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'on_site' | 'wfh' | 'unverified'>('all');

  const isPrivileged =
    session?.user?.role?.name === 'Owner' ||
    session?.user?.role?.name === 'IT/Admin';

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/work-sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setActiveSession(data.activeSession || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const filtered = sessions.filter((s) => {
    const isSessionWfh = Boolean(s.isWfh || s.workMode === 'WFH' || s.geofence?.zoneType === 'WFH');
    if (filter === 'on_site') return s.locationVerified && !isSessionWfh;
    if (filter === 'wfh') return isSessionWfh;
    if (filter === 'unverified') return !s.locationVerified;
    return true;
  });

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const wfhMinutes = sessions
    .filter((s) => s.isWfh || s.workMode === 'WFH' || s.geofence?.zoneType === 'WFH')
    .reduce((sum, s) => sum + (s.duration || 0), 0);
  const onSiteMinutes = Math.max(0, totalMinutes - wfhMinutes);

  return (
    <div className="min-h-screen bg-flora-darker p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
          <span>⏱️</span> Attendance & Work Sessions
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {isPrivileged
            ? 'All staff attendance records with geofence verification and Work From Home status.'
            : 'Your personal attendance history with geofence verification and Work From Home records.'}
        </p>
        {/* Disclaimer */}
        <p className="text-[11px] text-amber-400/70 mt-1">
          ⚠️ Geofence verification is best-effort. Staff inside authorized Main or WFH zones have their attendance verified and tagged accordingly.
        </p>
      </div>

      {/* Active Session Banner */}
      {activeSession && (() => {
        const isSessionWfh = Boolean(activeSession.isWfh || activeSession.workMode === 'WFH' || activeSession.geofence?.zoneType === 'WFH');
        return (
          <div className={`border rounded-2xl p-4 flex items-center justify-between gap-4 ${
            isSessionWfh
              ? 'bg-blue-950/40 border-blue-700/50'
              : 'bg-emerald-900/30 border-emerald-700/50'
          }`}>
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isSessionWfh ? 'bg-blue-400' : 'bg-emerald-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  isSessionWfh ? 'bg-blue-500' : 'bg-emerald-500'
                }`} />
              </span>
              <div>
                <div className={`font-bold text-sm flex items-center gap-2 ${
                  isSessionWfh ? 'text-blue-200' : 'text-emerald-200'
                }`}>
                  <span>Currently Clocked In</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    isSessionWfh
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {isSessionWfh ? '🏠 Work From Home' : '🏢 On-Site (Main)'}
                  </span>
                </div>
                <div className={`text-xs mt-0.5 ${
                  isSessionWfh ? 'text-blue-400/80' : 'text-emerald-400/80'
                }`}>
                  Since {formatTime(activeSession.startTime)} · 
                  {activeSession.geofence
                    ? ` Verified at ${activeSession.geofence.name}`
                    : ' Location not verified'}
                </div>
              </div>
            </div>
            <div className="text-xs font-semibold text-right">
              {activeSession.locationVerified ? (
                <span className={isSessionWfh ? 'text-blue-300' : 'text-emerald-300'}>
                  ✅ Geofence Verified
                </span>
              ) : (
                <span className="text-amber-400">⚠️ No Location</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length, icon: '📋', sub: `${formatDuration(totalMinutes)} total` },
          { label: 'On-Site Work', value: `${Math.floor(onSiteMinutes / 60)}h ${onSiteMinutes % 60}m`, icon: '🏢', sub: 'in approved workplaces' },
          { label: 'Work From Home', value: `${Math.floor(wfhMinutes / 60)}h ${wfhMinutes % 60}m`, icon: '🏠', sub: 'in approved home zones' },
          { label: 'GPS Verified', value: `${sessions.filter((s) => s.locationVerified).length}/${sessions.length}`, icon: '✅', sub: 'location confirmed' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-flora-card border border-flora-border rounded-2xl p-4 text-center shadow"
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-xl font-extrabold text-slate-100">{stat.value}</div>
            <div className="text-xs font-bold text-slate-300 mt-0.5">{stat.label}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All Sessions' },
          { key: 'on_site', label: '🏢 On-Site' },
          { key: 'wfh', label: '🏠 Work From Home' },
          { key: 'unverified', label: '⚠️ Unverified' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition ${
              filter === f.key
                ? 'bg-flora-green text-slate-950 border-flora-green'
                : 'bg-flora-card border-flora-border text-slate-300 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      <div className="bg-flora-card border border-flora-border rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading sessions…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-4xl mb-3">📭</div>
            <div className="font-semibold text-slate-300 mb-1">No sessions found</div>
            <div className="text-sm text-slate-500">Use the Mark Attendance button in the top bar to clock in.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flora-border text-slate-400 text-xs uppercase tracking-widest">
                  <th className="text-left p-4">Date</th>
                  {isPrivileged && <th className="text-left p-4">Staff</th>}
                  <th className="text-left p-4">Clock In</th>
                  <th className="text-left p-4">Clock Out</th>
                  <th className="text-right p-4">Duration</th>
                  <th className="text-center p-4">Mode</th>
                  <th className="text-left p-4">Zone</th>
                  <th className="text-right p-4">GPS Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const isSessionWfh = Boolean(s.isWfh || s.workMode === 'WFH' || s.geofence?.zoneType === 'WFH');
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-flora-border last:border-0 hover:bg-flora-darker/50 transition"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{formatDate(s.startTime)}</div>
                      </td>
                      {isPrivileged && (
                        <td className="p-4 text-slate-300 font-medium">{s.userName}</td>
                      )}
                      <td className="p-4 font-mono text-slate-300 text-xs">
                        {formatTime(s.startTime)}
                        {s.clockInLatitude != null && (
                          <div className="text-slate-500 text-[10px]">
                            {s.clockInLatitude.toFixed(4)}, {s.clockInLongitude?.toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-slate-300 text-xs">
                        {s.endTime ? (
                          <>
                            {formatTime(s.endTime)}
                            {s.clockOutLatitude != null && (
                              <div className="text-slate-500 text-[10px]">
                                {s.clockOutLatitude.toFixed(4)}, {s.clockOutLongitude?.toFixed(4)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Active</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-200">
                        {s.endTime ? formatDuration(s.duration) : '—'}
                      </td>
                      <td className="p-4 text-center">
                        {isSessionWfh ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            🏠 WFH
                          </span>
                        ) : s.locationVerified ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🏢 On-Site
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-900/30 text-amber-300 border border-amber-700/40">
                            ⚠️ Unverified
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-300 text-xs font-medium">
                        {s.geofence?.name || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="p-4 text-right text-xs font-mono text-slate-400">
                        {s.clockInAccuracyMeters != null
                          ? `±${Math.round(s.clockInAccuracyMeters)}m`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IT/Owner Manual Override note */}
      {isPrivileged && (
        <div className="bg-flora-card border border-flora-border rounded-2xl p-5 text-sm space-y-2">
          <div className="font-bold text-slate-200 flex items-center gap-2">🛠️ Manual Session Override</div>
          <p className="text-slate-400 text-xs leading-relaxed">
            If a legitimate work session could not be recorded due to GPS failure, IT/Owner can apply
            a manual correction via the override API. A mandatory reason is required and every override
            is permanently recorded in the Audit Log.
          </p>
          <code className="text-xs text-flora-sage bg-flora-darker border border-flora-border rounded-lg px-3 py-2 block font-mono">
            POST /api/work-sessions/override — requires workSessionId, reason, and optional startTime/endTime
          </code>
        </div>
      )}
    </div>
  );
}
