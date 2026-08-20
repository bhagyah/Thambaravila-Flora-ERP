'use client';

import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { headerVariants, hoverLift } from './motion';
import type { ThemeMode } from './types';
import { PlusIcon, SparkIcon } from './icons';

interface HeaderProps {
  theme: ThemeMode;
  periodLabel: string;
  onManageWidgets?: () => void;
  onAddWidget?: () => void;
}

export function Header({ theme, periodLabel, onManageWidgets, onAddWidget }: HeaderProps) {
  return (
    <motion.header variants={headerVariants} initial="hidden" animate="show" className="px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <GlassCard theme={theme} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[#6BAF91]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#6BAF91]">
              ERP / Bento Workspace
            </span>
            <span className="text-xs text-slate-400">{periodLabel}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Glassmorphism Operations Dashboard</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <motion.button
            type="button"
            onClick={onManageWidgets}
            {...hoverLift}
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              theme === 'dark'
                ? 'border-white/15 bg-white/10 text-slate-100'
                : 'border-[#222826]/10 bg-[#222826]/5 text-slate-900'
            }`}
          >
            <SparkIcon className="mr-2 inline h-4 w-4" />
            Manage Widgets
          </motion.button>

          <motion.button
            type="button"
            onClick={onAddWidget}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl bg-[#6BAF91] px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-[#6BAF91]/20"
          >
            <PlusIcon className="mr-2 inline h-4 w-4" />
            Add new Widget
          </motion.button>
        </div>
      </GlassCard>
    </motion.header>
  );
}
