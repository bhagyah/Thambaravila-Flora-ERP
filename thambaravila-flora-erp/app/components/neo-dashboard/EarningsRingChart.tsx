'use client';

import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { hoverLift, widgetVariants } from './motion';
import type { ThemeMode } from './types';
import { SparkIcon } from './icons';

interface EarningsRingChartProps {
  theme: ThemeMode;
  percentage: number;
  collected: number;
  target: number;
}

export function EarningsRingChart({ theme, percentage, collected, target }: EarningsRingChartProps) {
  const radius = 76;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <motion.div variants={widgetVariants} initial="hidden" animate="show" {...hoverLift} className="h-full">
      <GlassCard theme={theme} className="h-full p-5">
        <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          <SparkIcon className="h-4 w-4 text-[#6BAF91]" />
          Earnings Ring
        </div>

        <div className="grid place-items-center">
          <svg viewBox="0 0 220 220" className="h-56 w-56">
            <defs>
              <linearGradient id="earningsStroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6BAF91" />
                <stop offset="100%" stopColor="#4E9D82" />
              </linearGradient>
            </defs>
            <circle cx="110" cy="110" r={radius} stroke={theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(34,40,38,0.09)'} strokeWidth={stroke} fill="none" />
            <motion.circle
              cx="110"
              cy="110"
              r={radius}
              stroke="url(#earningsStroke)"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 110 110)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ type: 'spring', stiffness: 120, damping: 24 }}
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center">
            <div className="text-5xl font-black tracking-tight text-slate-100">{Math.round(percentage)}%</div>
            <div className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-400">Revenue Capture</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-slate-400">Collected</div>
            <div className="mt-1 font-mono text-[#6BAF91]">{collected.toLocaleString('en-US')}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-slate-400">Target</div>
            <div className="mt-1 font-mono text-slate-100">{target.toLocaleString('en-US')}</div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

