'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

const DAY_OPTIONS = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
  { num: 7, label: 'Sun' },
];

interface WorkSchedule {
  workingDays: string;
  workStartTime: string;
  workEndTime: string;
  graceMinutes: number;
}

export default function SystemConfigPage() {
  const { data: session } = useSession();
  const [advanceDays, setAdvanceDays] = useState('3');
  const [flowerDays, setFlowerDays] = useState('14');
  const [finalDays, setFinalDays] = useState('3');
  const [saved, setSaved] = useState(false);

  // Work schedule state
  const [schedule, setSchedule] = useState<WorkSchedule>({
    workingDays: '1,2,3,4,5,6',
    workStartTime: '09:00',
    workEndTime: '17:00',
    graceMinutes: 15,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const canEditSchedule =
    session?.user?.role?.name === 'Owner' || session?.user?.role?.name === 'IT/Admin';

  useEffect(() => {
    fetch('/api/work-schedule')
      .then((r) => r.json())
      .then((d) => {
        if (d.schedule) setSchedule(d.schedule);
      })
      .catch(() => {});
  }, []);

  if (!session) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const selectedDays = schedule.workingDays
    ? schedule.workingDays.split(',').map(Number)
    : [1, 2, 3, 4, 5, 6];

  const toggleDay = (num: number) => {
    const current = new Set(selectedDays);
    if (current.has(num)) current.delete(num);
    else current.add(num);
    setSchedule((s) => ({
      ...s,
      workingDays: [...current].sort().join(','),
    }));
  };

  const [startH, startM] = schedule.workStartTime.split(':').map(Number);
  const [endH, endM] = schedule.workEndTime.split(':').map(Number);
  const hoursPerDay = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

  const saveSchedule = async () => {
    setScheduleSaving(true);
    setScheduleMsg('');
    setScheduleError('');
    try {
      const res = await fetch('/api/work-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workingDays: selectedDays,
          workStartTime: schedule.workStartTime,
          workEndTime: schedule.workEndTime,
          graceMinutes: schedule.graceMinutes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setScheduleMsg('✓ Work schedule saved successfully!');
        setTimeout(() => setScheduleMsg(''), 4000);
      } else {
        setScheduleError(data.error || 'Failed to save.');
      }
    } catch {
      setScheduleError('Network error.');
    } finally {
      setScheduleSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Configuration</h1>
        <p className="text-slate-500 text-sm mt-1">Configure payment deadline rules, work schedule, and hardware preferences.</p>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold">
          ✓ System settings updated successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Payment Rules Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            Payment Deadline Rules Engine
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Advance Payment (Days from Enquiry)
              </label>
              <input type="number" value={advanceDays} onChange={(e) => setAdvanceDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Flower Stage (Days Before Event)
              </label>
              <input type="number" value={flowerDays} onChange={(e) => setFlowerDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Final Stage (Days Before Event)
              </label>
              <input type="number" value={finalDays} onChange={(e) => setFinalDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
        </div>

        {/* Printer & Hardware Config */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            Printer & Local Infrastructure
          </h3>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Printing Mode</label>
            <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-500">
              <option value="BROWSER">Browser Native Print (window.print() with print CSS - Recommended)</option>
              <option value="AGENT">LAN Node Print Agent (CUPS / node-printer)</option>
            </select>
          </div>
        </div>

        <button type="submit"
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-sm text-sm transition">
          Save Configuration
        </button>
      </form>

      {/* ── Work Schedule Config ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${canEditSchedule ? 'bg-flora-card border-flora-border' : 'bg-slate-50 border-slate-200'}`}>
        <div className={`px-6 py-4 border-b flex items-center justify-between ${canEditSchedule ? 'border-flora-border bg-flora-darker' : 'border-slate-200'}`}>
          <div>
            <h3 className={`text-lg font-bold ${canEditSchedule ? 'text-slate-100' : 'text-slate-900'}`}>
              🕐 Work Schedule
            </h3>
            <p className={`text-xs mt-0.5 ${canEditSchedule ? 'text-slate-400' : 'text-slate-500'}`}>
              Used to calculate expected hours, compliance %, overtime, and attendance rates.
              {!canEditSchedule && ' (Owner or IT/Admin access required to edit)'}
            </p>
          </div>
          {canEditSchedule && (
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${hoursPerDay > 0 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/30 text-rose-300'}`}>
              {hoursPerDay > 0 ? `${hoursPerDay}h/day` : 'Invalid range'}
            </div>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Working Days */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-widest mb-2 ${canEditSchedule ? 'text-slate-400' : 'text-slate-500'}`}>
              Working Days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((d) => {
                const isSelected = selectedDays.includes(d.num);
                return (
                  <button
                    key={d.num}
                    type="button"
                    disabled={!canEditSchedule}
                    onClick={() => toggleDay(d.num)}
                    className={`w-12 h-12 rounded-xl text-sm font-bold transition border ${
                      isSelected
                        ? canEditSchedule
                          ? 'bg-flora-green text-slate-950 border-flora-green shadow'
                          : 'bg-teal-600 text-white border-teal-600'
                        : canEditSchedule
                          ? 'bg-flora-darker text-slate-400 border-flora-border hover:border-flora-sage hover:text-white'
                          : 'bg-white text-slate-400 border-slate-200'
                    } ${!canEditSchedule ? 'cursor-default' : ''}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className={`text-xs mt-1 ${canEditSchedule ? 'text-slate-500' : 'text-slate-400'}`}>
              {selectedDays.length} days/week selected
            </p>
          </div>

          {/* Times + grace */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-1 ${canEditSchedule ? 'text-slate-400' : 'text-slate-500'}`}>
                Start Time
              </label>
              <input
                type="time"
                value={schedule.workStartTime}
                disabled={!canEditSchedule}
                onChange={(e) => setSchedule((s) => ({ ...s, workStartTime: e.target.value }))}
                className={`w-full rounded-xl p-2.5 text-sm font-semibold border ${
                  canEditSchedule
                    ? 'bg-flora-darker border-flora-border text-slate-100 focus:outline-none focus:border-flora-sage'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-1 ${canEditSchedule ? 'text-slate-400' : 'text-slate-500'}`}>
                End Time
              </label>
              <input
                type="time"
                value={schedule.workEndTime}
                disabled={!canEditSchedule}
                onChange={(e) => setSchedule((s) => ({ ...s, workEndTime: e.target.value }))}
                className={`w-full rounded-xl p-2.5 text-sm font-semibold border ${
                  canEditSchedule
                    ? 'bg-flora-darker border-flora-border text-slate-100 focus:outline-none focus:border-flora-sage'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-1 ${canEditSchedule ? 'text-slate-400' : 'text-slate-500'}`}>
                Grace Period (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={schedule.graceMinutes}
                disabled={!canEditSchedule}
                onChange={(e) => setSchedule((s) => ({ ...s, graceMinutes: Number(e.target.value) }))}
                className={`w-full rounded-xl p-2.5 text-sm font-semibold border ${
                  canEditSchedule
                    ? 'bg-flora-darker border-flora-border text-slate-100 focus:outline-none focus:border-flora-sage'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              />
              <p className="text-[10px] text-slate-500 mt-1">Clock-ins within grace window are not marked late</p>
            </div>
          </div>

          {/* Summary preview */}
          {canEditSchedule && (
            <div className="bg-flora-darker rounded-xl border border-flora-border p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-flora-sage font-extrabold text-lg">{selectedDays.length}d</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Days/week</div>
              </div>
              <div>
                <div className="text-flora-sage font-extrabold text-lg">{hoursPerDay > 0 ? `${hoursPerDay}h` : '—'}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Hours/day</div>
              </div>
              <div>
                <div className="text-flora-sage font-extrabold text-lg">
                  {hoursPerDay > 0 ? `${Math.round(selectedDays.length * hoursPerDay * 4)}h` : '—'}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Monthly (4 weeks)</div>
              </div>
            </div>
          )}

          {scheduleMsg && (
            <div className="p-3 bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 rounded-xl text-sm font-semibold">
              {scheduleMsg}
            </div>
          )}
          {scheduleError && (
            <div className="p-3 bg-rose-900/30 border border-rose-700/40 text-rose-300 rounded-xl text-sm">
              ⚠️ {scheduleError}
            </div>
          )}

          {canEditSchedule && (
            <button
              type="button"
              onClick={saveSchedule}
              disabled={scheduleSaving || selectedDays.length === 0 || hoursPerDay <= 0}
              className="px-6 py-2.5 bg-flora-green hover:bg-flora-sage disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-sm transition shadow"
            >
              {scheduleSaving ? 'Saving…' : '💾 Save Work Schedule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
