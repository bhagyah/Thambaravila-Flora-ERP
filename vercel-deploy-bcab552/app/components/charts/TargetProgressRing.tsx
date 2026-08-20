'use client';

import { formatLKR } from '@/lib/utils/formatters';
import { useTheme } from '../../context/ThemeContext';

interface TargetInfo {
  timeframeLabel: string;
  targetAmount: number;
  achievedAmount: number;
  remainingAmount: number;
  progressPct: number;
}

interface TargetProgressRingProps {
  targetInfo?: TargetInfo;
  achievedAmount?: number;
  targetAmount?: number;
  remainingAmount?: number;
  progressPct?: number;
  label?: string;
  activeTimeRange?: string;
  onTimeRangeChange?: (range: string) => void;
}

export default function TargetProgressRing({
  targetInfo,
  achievedAmount,
  targetAmount,
  remainingAmount,
  progressPct,
  label,
  activeTimeRange = '1m',
  onTimeRangeChange,
}: TargetProgressRingProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  // Derive values from targetInfo object or direct props
  const timeframeLabel = targetInfo?.timeframeLabel || label || 'Target Goal';
  const targetVal = targetInfo?.targetAmount ?? targetAmount ?? 1;
  const achievedVal = targetInfo?.achievedAmount ?? achievedAmount ?? 0;
  const remainingVal = targetInfo?.remainingAmount ?? (remainingAmount !== undefined ? remainingAmount : Math.max(0, targetVal - achievedVal));
  const pctVal = targetInfo?.progressPct ?? (progressPct !== undefined ? progressPct : (targetVal > 0 ? Math.min(100, Math.round((achievedVal / targetVal) * 100)) : 0));



  // SVG Ring calculation
  const radius = 54;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(100, Math.max(0, pctVal));
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  const shell = isLight
    ? 'border-[#DDD8D3] bg-[#F2F0EF] text-[#1E2421] shadow-[0_4px_16px_rgba(40,35,30,0.04)]'
    : 'border-white/10 bg-[#171c1a]/78 text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]';
  const titleClass = isLight ? 'text-[#1E2421]' : 'text-white';
  const subtitleClass = isLight ? 'text-[#5A625D]' : 'text-slate-400';

  return (
    <div className={`rounded-2xl p-5 flex h-full w-full flex-col justify-between space-y-4 border ${shell}`}>
      {/* Header with Title & Timeframe Selector Buttons */}
      <div className={`flex flex-col space-y-3 border-b pb-3 ${isLight ? 'border-[#DDD8D3]' : 'border-white/10'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl border text-sm shadow-inner ${isLight ? 'border-[#DDD8D3] bg-[#E5E2DF] text-[#2C3B34]' : 'border-white/10 bg-white/[0.06] text-white'}`}>
              🎯
            </div>
            <div>
              <h3 className={`text-sm font-black tracking-tight ${titleClass}`}>Sales &amp; Target Goal</h3>
              <p className={`text-[10px] ${subtitleClass}`}>Target vs Actual Revenue</p>
            </div>
          </div>

          <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${isLight ? 'border border-[#DDD8D3] bg-[#FAF9F8] text-[#1E7045]' : 'border border-flora-sage/30 bg-flora-sage/15 text-flora-sage'}`}>
            {timeframeLabel}
          </span>
        </div>

        {/* Interactive Timeframe Selector Pills (if callback provided) */}
        {onTimeRangeChange && (
          <div className={`flex items-center justify-between rounded-xl border p-1 text-[11px] font-bold ${isLight ? 'border-[#DDD8D3] bg-[#E5E2DF]' : 'border-white/10 bg-white/[0.06]'}`}>
            {[
              { id: '1d', label: 'Daily' },
              { id: '1w', label: 'Weekly' },
              { id: '1m', label: 'Monthly' },
              { id: '1y', label: 'Yearly' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => onTimeRangeChange && onTimeRangeChange(t.id)}
                className={`flex-1 py-1 text-center rounded-lg transition ${
                  activeTimeRange === t.id
                    ? 'bg-flora-green text-slate-950 font-black shadow'
                    : isLight
                    ? 'text-[#5A625D] hover:text-[#1E2421]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Ring & Compact Details */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-2 my-auto">
        {/* SVG Round Gauge Ring */}
        <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 140 140" className="w-full h-full transform -rotate-90">
            <defs>
              <linearGradient id="targetRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4E9D82" />
                <stop offset="100%" stopColor="#6BAF91" />
              </linearGradient>
            </defs>

            {/* Background Track Ring */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke={isLight ? '#DDD8D3' : 'var(--flora-border)'}
              strokeWidth={strokeWidth}
              className="opacity-50"
            />

            {/* Progress Stroke Ring */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="url(#targetRingGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Info Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-2xl font-black tracking-tight ${isLight ? 'text-[#1E2421]' : 'text-slate-100'}`}>
              {clampedProgress}%
            </span>
            <span className={`-mt-0.5 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-[#1E7045]' : 'text-flora-sage'}`}>
              Achieved
            </span>
          </div>
        </div>

        {/* Small Metric Boxes Inside Chart Card */}
        <div className="w-full space-y-2 text-xs">
          <div className={`flex items-center justify-between rounded-xl border p-2.5 ${isLight ? 'border-[#DDD8D3] bg-[#E5E2DF]' : 'border-white/10 bg-white/[0.06]'}`}>
            <span className={`flex items-center space-x-1.5 font-semibold ${isLight ? 'text-[#5A625D]' : 'text-slate-400'}`}>
              <span>🎯</span>
              <span>Target Goal:</span>
            </span>
            <span className={`font-black ${isLight ? 'text-[#1E2421]' : 'text-slate-100'}`}>{formatLKR(targetVal, false)}</span>
          </div>

          <div className={`flex items-center justify-between rounded-xl border p-2.5 ${isLight ? 'border-[#DDD8D3] bg-[#E5E2DF]' : 'border-emerald-500/20 bg-emerald-500/10'}`}>
            <span className={`flex items-center space-x-1.5 font-semibold ${isLight ? 'text-[#166534]' : 'text-emerald-400'}`}>
              <span>💳</span>
              <span>Achieved:</span>
            </span>
            <span className={`font-black ${isLight ? 'text-[#166534]' : 'text-emerald-300'}`}>{formatLKR(achievedVal, false)}</span>
          </div>

          <div className={`flex items-center justify-between rounded-xl border p-2.5 ${isLight ? 'border-[#DDD8D3] bg-[#E5E2DF]' : 'border-amber-500/20 bg-amber-500/10'}`}>
            <span className={`flex items-center space-x-1.5 font-semibold ${isLight ? 'text-[#92400e]' : 'text-amber-400'}`}>
              <span>⏳</span>
              <span>Need:</span>
            </span>
            <span className={`font-black ${isLight ? 'text-[#92400e]' : 'text-amber-300'}`}>
              {remainingVal > 0 ? formatLKR(remainingVal, false) : '🎉 Goal Met!'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
