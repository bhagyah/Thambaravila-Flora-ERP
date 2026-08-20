'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import BarChartWidget from '@/app/components/charts/BarChartWidget';
import DonutGaugeChart from '@/app/components/charts/DonutGaugeChart';
import MetricSparkCard from '@/app/components/charts/MetricSparkCard';

export default function SalesAnalyticsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchAnalytics();
    }
  }, [session]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics/dashboard');
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

  // Seasonality warning flag logic (May-July and September-October in Sri Lanka wedding industry are typically low/off-peak season)
  const currentMonth = new Date().getMonth() + 1;
  const isPreLowSeason = currentMonth === 4 || currentMonth === 8;
  const isLowSeason = currentMonth === 5 || currentMonth === 6 || currentMonth === 7 || currentMonth === 9 || currentMonth === 10;

  if (loading || !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 bg-slate-950 text-slate-100">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-semibold text-sm">Loading Sales Pattern Analytics...</p>
      </div>
    );
  }

  const { kpis, charts } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-teal-500/20 text-teal-300 font-extrabold text-xs rounded border border-teal-500/30">
              SALES INTELLIGENCE
            </span>
            <span className="text-xs text-slate-400 font-mono">Two-Pipeline Pattern Analytics</span>
          </div>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight mt-1">
            Sales Pattern &amp; Channel Statistics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Rule-based analytical insight into lead conversion efficiency, acquisition channels, and seasonal forecasting.
          </p>
        </div>

        {/* Seasonality Warning Alert Banner */}
        {isPreLowSeason && (
          <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-xl flex items-start space-x-3 text-amber-200 border border-amber-500/20">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-bold text-sm">Seasonality Early Warning (6–8 Weeks Ahead)</h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Low wedding season begins shortly. Social media campaigns and promotional lead capture should be ramped up to sustain pipeline flow.
              </p>
            </div>
          </div>
        )}

        {isLowSeason && (
          <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-xl flex items-start space-x-3 text-blue-200 border border-blue-500/20">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h4 className="font-bold text-sm">Off-Peak Season Indicator</h4>
              <p className="text-xs text-blue-300/80 mt-0.5">
                Currently in off-peak wedding period. Focus on corporate events, engagement packages, and early booking discounts for upcoming peak season.
              </p>
            </div>
          </div>
        )}

        {/* Metric Spark Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricSparkCard
            label="Total Inquiries"
            value={kpis.totalLeads.toString()}
            change="+14.2%"
            isPositive={true}
            icon="📥"
            accentColor="teal"
          />
          <MetricSparkCard
            label="Won Conversion Rate"
            value={`${kpis.conversionRate}%`}
            change="+5.8%"
            isPositive={true}
            icon="🏆"
            accentColor="emerald"
          />
          <MetricSparkCard
            label="Confirmed Bookings"
            value={kpis.totalBookings.toString()}
            change="+8.4%"
            isPositive={true}
            icon="💍"
            accentColor="cyan"
          />
          <MetricSparkCard
            label="Total Contract Value"
            value={`LKR ${kpis.totalContractValue.toLocaleString()}`}
            change="+18.9%"
            isPositive={true}
            icon="💼"
            accentColor="purple"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BarChartWidget
              title="Acquisition Channel Breakdown"
              subtitle="Lead volume per social & offline channel"
              items={charts.leadSources}
              layout="horizontal"
            />
          </div>

          <div>
            <DonutGaugeChart
              title="Conversion Efficiency Ring"
              subtitle="Ratio of won bookings vs active pipeline"
              centerLabel={`${kpis.conversionRate}%`}
              centerSublabel="Conversion Rate"
              segments={[
                { label: 'Won Contracts', value: kpis.wonLeads || 1, color: '#10b981' },
                { label: 'In Negotiation', value: Math.max(1, kpis.totalLeads - kpis.wonLeads), color: '#38bdf8' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
