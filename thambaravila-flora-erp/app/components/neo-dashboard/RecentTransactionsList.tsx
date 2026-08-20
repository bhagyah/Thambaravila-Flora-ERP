'use client';

import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { hoverLift, widgetVariants, listItemVariants } from './motion';
import type { ThemeMode, TransactionItem } from './types';

interface RecentTransactionsListProps {
  theme: ThemeMode;
  items: TransactionItem[];
}

export function RecentTransactionsList({ theme, items }: RecentTransactionsListProps) {
  return (
    <motion.div variants={widgetVariants} initial="hidden" animate="show" {...hoverLift} className="h-full">
      <GlassCard theme={theme} className="h-full p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recent Transactions</div>
            <div className="mt-1 text-lg font-black">Card-level activity stream</div>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-300">
            {items.length} entries
          </span>
        </div>

        {items.length === 0 ? (
          <div className="grid min-h-[240px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">
            No transaction activity yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
            <motion.li
              key={item.id}
              variants={listItemVariants}
              whileHover="hover"
              whileTap="tap"
              className="rounded-2xl border border-white/10 bg-white/5 p-3 transition"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.kind === 'credit' ? 'bg-[#6BAF91]/15 text-[#6BAF91]' : 'bg-rose-500/15 text-rose-300'}`}>
                  {item.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{item.title}</div>
                      <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                    </div>
                    <div className={`font-black ${item.kind === 'credit' ? 'text-[#6BAF91]' : 'text-rose-400'}`}>
                      {item.kind === 'credit' ? '+' : '-'}LKR {item.amount.toLocaleString('en-US')}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{item.cardNumber}</span>
                    <span>{item.date}</span>
                  </div>
                </div>
              </div>
            </motion.li>
            ))}
          </ul>
        )}
      </GlassCard>
    </motion.div>
  );
}
