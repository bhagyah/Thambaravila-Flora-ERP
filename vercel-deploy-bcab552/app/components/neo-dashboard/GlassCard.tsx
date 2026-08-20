'use client';

import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import type { ThemeMode } from './types';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  theme: ThemeMode;
  children: ReactNode;
  glow?: boolean;
}

export function GlassCard({ theme, children, className = '', glow = false, ...rest }: GlassCardProps) {
  const shell = theme === 'dark'
    ? 'bg-white/10 border-white/15 text-slate-100 shadow-[0_20px_70px_rgba(0,0,0,0.22)]'
    : 'bg-[#222826]/5 border-[#222826]/10 text-slate-900 shadow-[0_20px_70px_rgba(34,40,38,0.09)]';

  return (
    <motion.div
      {...rest}
      className={`rounded-3xl border backdrop-blur-2xl ${shell} ${glow ? 'ring-1 ring-[#6BAF91]/20' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}
