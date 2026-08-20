'use client';

import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { hoverLift, widgetVariants } from './motion';
import type { ThemeMode } from './types';

interface SpendingBarChartProps {
  theme: ThemeMode;
  data: Array<{ label: string; amount: number }>;
}

export function SpendingBarChart({ theme, data }: SpendingBarChartProps) {
  const max = Math.max(1, ...data.map((item) => item.amount));

  return (
    <motion.div variants={widgetVariants} initial="hidden" animate="show" {...hoverLift} className="h-full">
      <GlassCard theme={theme} className="h-full p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Spending Breakdown</div>
            <div className="mt-1 text-lg font-black">Operational outflow by category</div>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-300">
            Top spenders
          </span>
        </div>

        {data.length === 0 ? (
          <div className="grid min-h-[220px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">
            No spending categories yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.map((item, index) => {
            const pct = Math.max(8, Math.round((item.amount / max) * 100));
            return (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="font-bold">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.amount.toLocaleString('en-US')}</div>
                  </div>
                  <div className="text-[11px] font-black text-[#6BAF91]">{pct}%</div>
                </div>
                <div className="h-32 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2">
                  <motion.div
                    className="h-full rounded-xl"
                    initial={{ height: '10%' }}
                    animate={{ height: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 90, damping: 16, delay: index * 0.06 }}
                    style={{
                      background: 'linear-gradient(180deg, rgba(107,175,145,0.95) 0%, rgba(78,157,130,0.35) 100%)',
                    }}
                  />
                </div>
              </div>
            );
            })}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
