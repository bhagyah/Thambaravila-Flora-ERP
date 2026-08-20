'use client';

import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { hoverLift, widgetVariants } from './motion';
import type { ThemeMode, TrendItem } from './types';
import { ChartIcon } from './icons';

interface BalanceOverviewChartProps {
  theme: ThemeMode;
  data: TrendItem[];
  transactionCount: number;
}

function buildCurvePath(points: number[], width: number, height: number, padding = 18) {
  if (!points.length) return '';
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const xStep = (width - padding * 2) / Math.max(1, points.length - 1);

  const coords = points.map((value, index) => {
    const x = padding + index * xStep;
    const normalized = (value - min) / range;
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y };
  });

  if (coords.length === 1) {
    return `M ${coords[0].x} ${coords[0].y}`;
  }

  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i];
    const next = coords[i + 1];
    const cp1x = current.x + xStep / 3;
    const cp1y = current.y;
    const cp2x = next.x - xStep / 3;
    const cp2y = next.y;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return d;
}

export function BalanceOverviewChart({ theme, data, transactionCount }: BalanceOverviewChartProps) {
  if (data.length === 0) {
    return (
      <motion.div variants={widgetVariants} initial="hidden" animate="show" {...hoverLift} className="h-full">
        <GlassCard theme={theme} className="h-full p-5">
          <div className="flex h-full min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">
            Waiting for trend data...
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  const values = data.map((item) => item.netProfit);
  const width = 760;
  const height = 340;
  const path = buildCurvePath(values, width, height);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const baseline = height - 18;
  const minY = baseline - ((0 - min) / Math.max(1, max - min)) * (height - 36);
  const areaPath = `${path} L ${width - 18} ${baseline} L 18 ${baseline} Z`;
  const currentValue = data[data.length - 1]?.netProfit ?? 0;

  return (
    <motion.div variants={widgetVariants} initial="hidden" animate="show" {...hoverLift} className="h-full">
      <GlassCard theme={theme} className="h-full p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              <ChartIcon className="h-4 w-4 text-[#6BAF91]" />
              Balance Overview
            </div>
            <div className="text-2xl font-black tracking-tight">{currentValue >= 0 ? 'Net positive rhythm' : 'Net pressure'}</div>
            <p className="mt-1 text-sm text-slate-400">Smooth cash movement across the last six periods.</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {[
              `${transactionCount || data.length} transactions`,
              'Monthly',
              'Compare',
              'Live',
            ].map((pill) => (
              <span key={pill} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-200">
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
            <defs>
              <linearGradient id="balanceStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6BAF91" />
                <stop offset="100%" stopColor="#4E9D82" />
              </linearGradient>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4E9D82" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#4E9D82" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75].map((tick) => {
              const y = 18 + tick * (height - 36);
              return <line key={tick} x1="18" x2={width - 18} y1={y} y2={y} stroke={theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(34,40,38,0.09)'} strokeDasharray="4 8" />;
            })}

            {areaPath && <path d={areaPath} fill="url(#balanceFill)" />}
            {path && <path d={path} fill="none" stroke="url(#balanceStroke)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />}
            {data.map((item, index) => {
              const xStep = (width - 36) / Math.max(1, data.length - 1);
              const x = 18 + index * xStep;
              const y = height - 18 - ((item.netProfit - min) / Math.max(1, max - min)) * (height - 36);
              return <circle key={item.month} cx={x} cy={y} r="4.5" fill="#6BAF91" stroke={theme === 'dark' ? '#222826' : '#FFFFFF'} strokeWidth="2" />;
            })}
            {minY > 0 && <line x1="18" x2={width - 18} y1={minY} y2={minY} stroke="rgba(107,175,145,0.25)" strokeDasharray="3 7" />}
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-400">
          {data.slice(-3).map((item) => (
            <div key={item.month} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="font-black text-slate-200">{item.month}</div>
              <div className="mt-1 font-mono text-[#6BAF91]">{item.netProfit.toLocaleString('en-US')}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
