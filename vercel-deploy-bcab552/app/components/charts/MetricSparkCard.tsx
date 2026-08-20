'use client';

import Link from 'next/link';
import { useTheme } from '../../context/ThemeContext';

interface MetricSparkCardProps {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon?: string;
  accentColor?: 'teal' | 'emerald' | 'cyan' | 'rose' | 'amber' | 'purple';
  sparklineData?: number[];
  href?: string;
}

export default function MetricSparkCard({
  label,
  value,
  change,
  isPositive = true,
  icon = '📈',
  accentColor = 'teal',
  sparklineData = [35, 42, 38, 55, 63, 58, 75, 82],
  href,
}: MetricSparkCardProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const getAccentClass = () => {
    switch (accentColor) {
      case 'emerald': return 'from-emerald-500/10 to-teal-500/5 border-emerald-500/30';
      case 'rose': return 'from-rose-500/10 to-pink-500/5 border-rose-500/30';
      case 'amber': return 'from-amber-500/10 to-orange-500/5 border-amber-500/30';
      case 'purple': return 'from-purple-500/10 to-indigo-500/5 border-purple-500/30';
      case 'cyan': return 'from-cyan-500/10 to-blue-500/5 border-cyan-500/30';
      default: return 'from-teal-500/10 to-emerald-500/5 border-teal-500/30';
    }
  };

  const getStrokeColor = () => {
    switch (accentColor) {
      case 'emerald': return '#10b981';
      case 'rose': return '#f43f5e';
      case 'amber': return '#f59e0b';
      case 'purple': return '#a855f7';
      case 'cyan': return '#06b6d4';
      default: return '#14b8a6';
    }
  };

  // Sparkline Path Generator
  const generateSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return '';
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData) || 1;
    const width = 100;
    const height = 30;

    const points = sparklineData.map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / (max - min || 1)) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const cardContent = (
    <div
      className={[
        'rounded-2xl border p-5 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl',
        isLight
          ? 'border-[#DCE4DF] bg-[#FAFBF8] text-[#18221D] shadow-[0_12px_32px_rgba(35,48,41,0.06)]'
          : 'border-white/10 bg-[#171c1a]/78 text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]',
        `bg-gradient-to-br ${getAccentClass()}`,
        href ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase font-bold tracking-wider ${isLight ? 'text-[#4A5B52]' : 'text-slate-300'}`}>{label}</span>
        <div
          className={[
            'flex h-8 w-8 items-center justify-center rounded-xl border text-sm shadow-inner',
            isLight ? 'border-[#D2DBD4] bg-[#EBF0EA] text-[#2C3B34]' : 'border-white/10 bg-white/[0.06] text-white',
          ].join(' ')}
        >
          {icon}
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <div className={`text-2xl font-black ${isLight ? 'text-[#18221D]' : 'text-white'}`}>{value}</div>

        {change && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              isPositive
                ? isLight
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : isLight
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            {isPositive ? '↑' : '↓'} {change}
          </span>
        )}
      </div>

      {/* Mini SVG Sparkline */}
      <div className="h-8 w-full pt-1 flex items-end justify-between">
        <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
          <path
            d={generateSparkline()}
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block group">{cardContent}</Link>;
  }

  return cardContent;
}
