'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { sidebarVariants, hoverLift, themeSwitchVariants } from './motion';
import type { NavItem, ThemeMode } from './types';
import {
  AccountsIcon,
  AiIcon,
  BellIcon,
  ChartIcon,
  DashboardIcon,
  MoonIcon,
  PlusIcon,
  ReportsIcon,
  SettingsIcon,
  SparkIcon,
  SunIcon,
  TransactionsIcon,
  WalletIcon,
} from './icons';

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon /> },
  { label: 'AI', href: '/dashboard?panel=ai', icon: <AiIcon /> },
  { label: 'Accounts', href: '/accountant/financials', icon: <AccountsIcon /> },
  { label: 'Transactions', href: '/accountant/dues', icon: <TransactionsIcon /> },
  { label: 'Reports', href: '/accountant/reports', icon: <ReportsIcon /> },
  { label: 'Targets', href: '/sales/targets', icon: <ChartIcon /> },
  { label: 'Settings', href: '/settings/2fa', icon: <SettingsIcon /> },
];

interface SidebarProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  userName: string;
  roleName: string;
  activePath: string;
}

export function Sidebar({ theme, onToggleTheme, userName, roleName, activePath }: SidebarProps) {
  return (
    <motion.aside
      variants={sidebarVariants}
      initial="hidden"
      animate="show"
      className="hidden lg:block p-4 lg:sticky lg:top-0 lg:h-screen"
    >
      <GlassCard theme={theme} className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6BAF91] to-[#4E9D82] text-slate-950 font-black shadow-lg">
            TF
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black tracking-[0.18em] uppercase">Thambaravila</div>
            <div className="text-[11px] text-slate-400">ERP Command Center</div>
          </div>
        </div>

        <GlassCard theme={theme} className="p-4" glow>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6BAF91] to-[#4E9D82] text-slate-950 font-black">
                {userName?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{userName}</div>
                <div className="text-[11px] text-slate-400">{roleName}</div>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={onToggleTheme}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              className={`flex h-10 items-center gap-2 rounded-full border px-2.5 text-[11px] font-bold ${
                theme === 'dark'
                  ? 'border-white/15 bg-white/10 text-slate-100'
                  : 'border-[#222826]/10 bg-[#222826]/5 text-slate-900'
              }`}
            >
              <span className="relative flex h-6 w-11 items-center rounded-full border border-white/15 bg-black/10 px-1">
                <motion.span
                  className="absolute left-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#6BAF91] text-slate-950 shadow-sm"
                  animate={theme === 'dark' ? 'dark' : 'light'}
                  variants={themeSwitchVariants}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {theme === 'dark' ? (
                      <motion.span key="moon" initial={{ opacity: 0, rotate: -45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }} className="flex">
                        <MoonIcon className="h-2.5 w-2.5" />
                      </motion.span>
                    ) : (
                      <motion.span key="sun" initial={{ opacity: 0, rotate: 45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }} className="flex">
                        <SunIcon className="h-2.5 w-2.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
              </span>
              <span className="pr-1">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </motion.button>
          </div>
        </GlassCard>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = item.href === '/dashboard' ? activePath === '/dashboard' : activePath === item.href;

            return (
              <motion.div key={item.href} {...hoverLift}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                    active
                      ? 'border-[#6BAF91]/40 bg-[#6BAF91]/12 text-inherit shadow-[0_16px_30px_rgba(107,175,145,0.12)]'
                      : theme === 'dark'
                      ? 'border-white/0 text-slate-300 hover:border-white/10 hover:bg-white/10'
                      : 'border-[#222826]/0 text-slate-700 hover:border-[#222826]/10 hover:bg-[#222826]/5'
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-[#6BAF91] text-slate-950' : 'bg-white/10 text-[#6BAF91]'}`}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <GlassCard theme={theme} className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#6BAF91]">
              <SparkIcon className="h-4 w-4" />
              Pro Features
            </div>
            <p className="text-sm leading-6 text-slate-400">
              Unlock predictive cashflow, automated approvals, and widget presets for your team.
            </p>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6BAF91] px-4 py-3 text-sm font-black text-slate-950"
            >
              <PlusIcon className="h-4 w-4" />
              Upgrade Workspace
            </motion.button>
          </GlassCard>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <BellIcon className="h-4 w-4" />
              Live status
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#6BAF91]">
              <WalletIcon className="h-4 w-4" />
              Synced
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.aside>
  );
}
