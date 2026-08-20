'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface TargetConfig {
  yearlyTarget: number;
  monthlyTarget: number;
  weeklyTarget: number;
  dailyTarget: number;
}

export default function AccountantTargetsPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [targetAmount, setTargetAmount] = useState('');
  const [totalCollected, setTotalCollected] = useState(0);
  const [currentTarget, setCurrentTarget] = useState<number | null>(null);
  const [targetConfig, setTargetConfig] = useState<TargetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState('');

  useEffect(() => {
    if (session) {
      fetchTargetData();
      fetchTargetConfig();
    }
  }, [session, period]);

  const fetchTargetConfig = async () => {
    try {
      const res = await fetch('/api/targets/config');
      if (res.ok) {
        const data = await res.json();
        setTargetConfig(data.config);
      }
    } catch (e) {
      console.error('Failed to load target config', e);
    }
  };

  const fetchTargetData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/targets?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setTotalCollected(data.totalCollectedLKR || (data.totalCollected ? data.totalCollected / 100 : 0));
        if (data.targets && data.targets.length > 0) {
          setCurrentTarget(data.targets[0].targetAmountLKR || data.targets[0].targetAmount / 100);
        } else {
          setCurrentTarget(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetMasterMonthlyTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAmount) return;

    try {
      const numVal = parseFloat(targetAmount);
      const res = await fetch('/api/targets/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyTarget: numVal }),
      });

      if (res.ok) {
        setSavingMsg('✓ Master Monthly & Yearly Revenue Target updated successfully!');
        setTargetAmount('');
        fetchTargetConfig();
        fetchTargetData();
        setTimeout(() => setSavingMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!session) return null;

  const activeMonthlyTarget = targetConfig?.monthlyTarget || currentTarget || 5000000;
  const progressPercent = activeMonthlyTarget > 0 ? Math.min(100, Math.round((totalCollected / activeMonthlyTarget) * 100)) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Accountant Revenue &amp; Collection Targets</h1>
        <p className="text-slate-500 text-sm mt-1">Track monthly collection goals against actual confirmed payments and central business revenue targets.</p>
      </div>

      {savingMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold">
          {savingMsg}
        </div>
      )}

      {/* Period Selection & Master Summary */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Target Period:</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-teal-500 mt-1"
          />
        </div>

        {targetConfig && (
          <div className="text-right text-xs text-slate-500">
            <span className="font-bold text-slate-700 block">System Master Targets:</span>
            <span>Yearly Goal: <strong className="text-teal-700 font-mono">LKR {targetConfig.yearlyTarget.toLocaleString()}</strong></span>
            <span className="ml-3">Daily Goal: <strong className="text-teal-700 font-mono">LKR {targetConfig.dailyTarget.toLocaleString()}</strong></span>
          </div>
        )}
      </div>

      {/* Progress Card */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target vs Actual Confirmed Collections</div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              LKR {totalCollected.toLocaleString()}{' '}
              <span className="text-sm font-semibold text-slate-400">
                / LKR {activeMonthlyTarget.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-teal-600">{progressPercent}%</span>
            <div className="text-xs text-slate-500 font-medium">Achieved</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200">
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {/* Timeframe breakdown grid */}
        {targetConfig && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Daily Target</span>
              <span className="font-extrabold text-slate-800 font-mono">LKR {targetConfig.dailyTarget.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Weekly Target</span>
              <span className="font-extrabold text-slate-800 font-mono">LKR {targetConfig.weeklyTarget.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Monthly Target</span>
              <span className="font-extrabold text-teal-700 font-mono">LKR {targetConfig.monthlyTarget.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Yearly Target</span>
              <span className="font-extrabold text-amber-700 font-mono">LKR {targetConfig.yearlyTarget.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Target Setter Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Set Monthly Target (Auto-Prorates Daily, Weekly, Yearly)</h3>
        <form onSubmit={handleSetMasterMonthlyTarget} className="flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="number"
            required
            placeholder="Target Amount in LKR (e.g. 5000000)"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="w-full sm:flex-1 border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-teal-500 font-mono"
          />
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-sm transition"
          >
            Update Target Goal
          </button>
        </form>
      </div>
    </div>
  );
}
