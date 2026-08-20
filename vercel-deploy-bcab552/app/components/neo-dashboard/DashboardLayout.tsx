'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ThemeMode } from './types';

interface DashboardLayoutProps {
  theme: ThemeMode;
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ theme, sidebar, header, children }: DashboardLayoutProps) {
  return (
    <motion.div
      className="relative min-h-screen overflow-hidden"
      initial={false}
      animate={{
        backgroundColor: theme === 'dark' ? '#222826' : '#FFFFFF',
        color: theme === 'dark' ? '#F8FAF9' : '#0F172A',
      }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage:
            theme === 'dark'
              ? 'linear-gradient(135deg, rgba(107,175,145,0.18) 0%, transparent 34%), linear-gradient(310deg, rgba(78,157,130,0.12) 0%, transparent 30%), linear-gradient(180deg, rgba(34,40,38,0.98) 0%, rgba(23,28,26,1) 100%)'
              : 'linear-gradient(135deg, rgba(107,175,145,0.15) 0%, transparent 34%), linear-gradient(310deg, rgba(78,157,130,0.10) 0%, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(243,248,245,1) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 16px)',
        }}
      />
      <div className="relative grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        {sidebar}
        <div className="flex min-w-0 flex-col">
          {header}
          <main className="flex-1 px-4 pb-6 pt-4 sm:px-6 lg:px-8 lg:pt-6">{children}</main>
        </div>
      </div>
    </motion.div>
  );
}

