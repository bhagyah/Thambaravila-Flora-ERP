'use client';

import { useState, useEffect } from 'react';
import DonutGaugeChart from '../charts/DonutGaugeChart';
import BarChartWidget from '../charts/BarChartWidget';
import MetricSparkCard from '../charts/MetricSparkCard';

interface TargetAssignmentDeskProps {
  userRole: string;
}

export default function TargetAssignmentDesk({ userRole }: TargetAssignmentDeskProps) {
  const [timeframe, setTimeframe] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [targets, setTargets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [totalCollectedLKR, setTotalCollectedLKR] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Target Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [targetLKR, setTargetLKR] = useState('');
  const [targetPeriod, setTargetPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Strictly check if logged-in user is Owner
  const isOwnerOnly = userRole === 'Owner';

  useEffect(() => {
    fetchTargets();
  }, [timeframe]);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/targets?timeframe=${timeframe}`);
      if (res.ok) {
        const json = await res.json();
        setTargets(json.targets || []);
        setUsers(json.users || []);
        setTotalCollectedLKR(json.totalCollectedLKR || 0);
      }
    } catch (e) {
      console.error('Failed to load targets', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOnly) return;
    if (!selectedUserId || !targetLKR) return;

    setSaving(true);
    setMsg('');

    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      const res = await fetch('/api/sales/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          userName: selectedUser?.name || 'Staff Member',
          targetAmountLKR: Number(targetLKR),
          period: targetPeriod,
          timeframe,
        }),
      });

      if (res.ok) {
        setMsg('🎯 Target assigned & activated successfully by Owner!');
        setTargetLKR('');
        fetchTargets();
        setTimeout(() => setMsg(''), 3000);
      } else {
        const errJson = await res.json();
        setMsg(`❌ ${errJson.error || 'Failed to assign target'}`);
      }
    } catch (e) {
      setMsg('❌ Error setting target');
    } finally {
      setSaving(false);
    }
  };

  const totalTargetLKR = targets.reduce((sum, t) => sum + (t.targetAmountLKR || 0), 0) || 1;
  const overallAchievedPct = Math.min(100, Math.round((totalCollectedLKR / totalTargetLKR) * 100));
  const remainingGapLKR = Math.max(0, totalTargetLKR - totalCollectedLKR);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-flora-dark via-flora-card to-flora-darker border-2 border-flora-sage/60 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Top Highlighted Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-flora-border pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-flora-green to-flora-sage text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg">
            🎯
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-flora-sage text-slate-950 uppercase tracking-wider">
                {isOwnerOnly ? 'OWNER TARGET ASSIGNMENT ENGINE' : 'TEAM TARGET ANALYTICS (READ-ONLY)'}
              </span>
              <span className="text-flora-sage text-xs font-mono font-semibold">● Live Target Sync</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100 mt-0.5">
              {timeframe} Target Achievement &amp; Gap Tracking
            </h2>
          </div>
        </div>

        {/* Timeframe Selector Pills */}
        <div className="bg-flora-darker p-1.5 rounded-2xl border border-flora-border flex space-x-1 text-xs font-extrabold">
          <button
            onClick={() => setTimeframe('DAILY')}
            className={`px-3.5 py-2 rounded-xl transition ${
              timeframe === 'DAILY'
                ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setTimeframe('WEEKLY')}
            className={`px-3.5 py-2 rounded-xl transition ${
              timeframe === 'WEEKLY'
                ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1 Week
          </button>
          <button
            onClick={() => setTimeframe('MONTHLY')}
            className={`px-3.5 py-2 rounded-xl transition ${
              timeframe === 'MONTHLY'
                ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setTimeframe('YEARLY')}
            className={`px-3.5 py-2 rounded-xl transition ${
              timeframe === 'YEARLY'
                ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {/* Target Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <MetricSparkCard
          label={`${timeframe} Target Set by Owner`}
          value={`LKR ${totalTargetLKR.toLocaleString()}`}
          change="Assigned Target"
          isPositive={true}
          icon="🎯"
          accentColor="teal"
          sparklineData={[30, 40, 50, 60, 70, 80, 90]}
        />
        <MetricSparkCard
          label={`${timeframe} Achieved Collection`}
          value={`LKR ${totalCollectedLKR.toLocaleString()}`}
          change={`${overallAchievedPct}% Achieved`}
          isPositive={overallAchievedPct >= 50}
          icon="💳"
          accentColor="emerald"
          sparklineData={[10, 25, 40, 55, 70, 85, overallAchievedPct]}
        />
        <MetricSparkCard
          label="Amount Needed to Achieve Target"
          value={`LKR ${remainingGapLKR.toLocaleString()}`}
          change={remainingGapLKR === 0 ? "Goal Fully Met!" : "Required Gap"}
          isPositive={remainingGapLKR === 0}
          icon="⏳"
          accentColor="amber"
          sparklineData={[90, 75, 60, 45, 30, 15, 10]}
        />
      </div>

      {/* Charts Grid: Visual Ring & Comparison Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <DonutGaugeChart
            title={`${timeframe} Goal Progress`}
            subtitle="Current achievement ratio vs. target set by Owner"
            centerLabel={`${overallAchievedPct}%`}
            centerSublabel="Target Met"
            segments={[
              { label: 'Achieved Collection', value: totalCollectedLKR || 1, color: '#4E9D82' },
              { label: 'Remaining Gap to Achieve', value: Math.max(1, remainingGapLKR), color: '#38bdf8' },
            ]}
          />
        </div>

        <div className="lg:col-span-2">
          <BarChartWidget
            title={`Sales Target & Achievement by Representative (${timeframe})`}
            subtitle="Individual sales progress & targets assigned by Owner"
            items={
              targets.length > 0
                ? targets.map(t => ({
                    label: t.userName || 'Sales Rep',
                    count: t.targetAmountLKR,
                    percent: t.pctAchieved,
                  }))
                : [
                    { label: 'Samantha Sales', count: 500000, percent: 85 },
                    { label: 'Dilhani Exec', count: 350000, percent: 70 },
                  ]
            }
            layout="horizontal"
          />
        </div>
      </div>

      {/* Form Section: STRICTLY RESTRICTED TO OWNER ROLE ONLY */}
      {isOwnerOnly ? (
        <div className="p-6 bg-flora-darker/90 border border-flora-sage/50 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center space-x-2">
            <span className="text-lg">👑</span>
            <h3 className="font-extrabold text-slate-100 text-sm">Owner Target Allocation Desk</h3>
            <span className="text-[10px] font-extrabold bg-flora-sage text-slate-950 px-2 py-0.5 rounded-full">
              OWNER PRIVILEGE ONLY
            </span>
          </div>

          {msg && (
            <div className={`p-3 rounded-xl font-bold text-xs ${msg.includes('🎯') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
              {msg}
            </div>
          )}

          <form onSubmit={handleAssignTarget} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Select Sales Executive</label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-flora-dark border border-flora-border text-slate-100 rounded-xl focus:outline-none focus:border-flora-sage font-medium"
              >
                <option value="">-- Choose Team Member --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Target Amount (LKR)</label>
              <input
                type="number"
                required
                value={targetLKR}
                onChange={(e) => setTargetLKR(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-flora-dark border border-flora-border text-slate-100 rounded-xl focus:outline-none focus:border-flora-sage font-bold"
                placeholder="e.g. 500000"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Period / Date Tag</label>
              <input
                type="text"
                required
                value={targetPeriod}
                onChange={(e) => setTargetPeriod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-flora-dark border border-flora-border text-slate-100 rounded-xl focus:outline-none focus:border-flora-sage font-mono"
                placeholder="e.g. 2026-07-23 or 2026-07"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-black rounded-xl shadow-lg hover:from-flora-sage hover:to-flora-green transition text-xs disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Set ${timeframe} Target`}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 bg-flora-darker/60 border border-flora-border rounded-2xl text-center text-xs text-slate-400">
          <p className="font-semibold text-slate-300">🔒 Targets are set &amp; managed exclusively by the Owner Account.</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Use the chart &amp; metrics above to track your remaining gap to reach the assigned target.</p>
        </div>
      )}
    </div>
  );
}
