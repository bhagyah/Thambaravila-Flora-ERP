'use client';

import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { widgetVariants, hoverLift } from './motion';
import type { ThemeMode } from './types';
import { AiIcon, SparkIcon } from './icons';

interface AiInsightsCardProps {
  theme: ThemeMode;
  comparisonLabel?: string;
}

export function AiInsightsCard({ theme, comparisonLabel = 'vs previous month' }: AiInsightsCardProps) {
  return (
    <motion.div variants={widgetVariants} initial="hidden" animate="show" {...hoverLift} className="h-full">
      <GlassCard theme={theme} glow className="relative h-full overflow-hidden p-5">
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(120deg, rgba(107,175,145,0.95), rgba(78,157,130,0.45), rgba(34,40,38,0.05))',
            backgroundSize: '200% 200%',
          }}
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" />
        <div className="relative flex h-full flex-col justify-between gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/90">
              <AiIcon className="h-4 w-4" />
              AI Insights
            </div>
            <SparkIcon className="h-4 w-4 text-white/80" />
          </div>

          <div className="space-y-4">
            <p className="max-w-lg text-2xl font-black leading-tight text-white sm:text-3xl">
              Transaction Volume increased by 5%
            </p>
            <p className="max-w-md text-sm leading-6 text-white/80">
              {comparisonLabel}. Collections are pacing ahead of burn, and open receivables are concentrated in three high-value accounts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-white">Predictive cashflow</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-white">Auto-prioritized alerts</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-white">Live anomaly watch</span>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

