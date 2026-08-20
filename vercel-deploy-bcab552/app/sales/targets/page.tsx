'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function SalesTargetsPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchTargets();
    }
  }, [session, period]);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/targets?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const totalCollected = data?.totalCollected || 0;
  const targetVal = data?.targets?.[0]?.targetAmount || 0;
  const percent = targetVal > 0 ? Math.min(100, Math.round((totalCollected / targetVal) * 100)) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sales Quota & Targets</h1>
          <p className="text-slate-500 text-sm mt-1">Track monthly deal conversions and revenue quota achievements.</p>
        </div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Target Progress Card */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quota Progress ({period})</span>
            <div className="text-3xl font-black text-slate-900 mt-1">
              LKR {(totalCollected / 100).toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-400">
                / LKR {(targetVal / 100).toLocaleString()} target
              </span>
            </div>
          </div>
          <span className="text-3xl font-black text-teal-600">{percent}%</span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200">
          <div
            className="bg-teal-500 h-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>

      {/* Team Quota Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Sales Representative Targets</h3>

        {data?.targets?.length === 0 ? (
          <p className="text-slate-500 text-sm">No specific individual targets set for this month.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data?.targets?.map((t: any) => (
              <div key={t.id} className="py-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">{t.userName || 'Sales Rep'}</div>
                  <div className="text-xs text-slate-500">Period: {t.period}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600">LKR {(t.targetAmount / 100).toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Target Goal</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
