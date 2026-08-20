'use client';

import { useTheme } from '../../context/ThemeContext';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutGaugeChartProps {
  title: string;
  subtitle?: string;
  segments?: Segment[];
  items?: Segment[];
  targetAmount?: number;
  achievedAmount?: number;
  centerLabel?: string;
  centerSublabel?: string;
}

export default function DonutGaugeChart({
  title,
  subtitle,
  segments,
  items,
  targetAmount,
  achievedAmount,
  centerLabel,
  centerSublabel,
}: DonutGaugeChartProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const chartSegments = (segments && segments.length > 0)
    ? segments
    : (items && items.length > 0)
    ? items
    : [
        { label: 'Achieved', value: achievedAmount || 0, color: '#4E9D82' },
        { label: 'Remaining', value: Math.max(0, (targetAmount || 1500000) - (achievedAmount || 0)), color: '#38bdf8' },
      ];

  const totalValue = chartSegments.reduce((sum, s) => sum + s.value, 0) || 1;

  // Compute SVG Stroke Dash offsets
  let accumulatedPercent = 0;

  const radius = 55;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;

  const shell = isLight
    ? 'border-[#DCE4DF] bg-[#FAFBF8] text-[#18221D] shadow-[0_12px_32px_rgba(35,48,41,0.06)]'
    : 'border-white/10 bg-[#171c1a]/78 text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]';
  const titleClass = isLight ? 'text-[#18221D]' : 'text-white';
  const subtitleClass = isLight ? 'text-[#4A5B52]' : 'text-slate-400';
  const trackColor = isLight ? '#D2DBD4' : 'var(--flora-border)';

  return (
    <div className={`rounded-2xl p-4 flex h-full w-full flex-col justify-between space-y-3 border ${shell}`}>
      {/* Title */}
      <div className={`border-b pb-2 ${isLight ? 'border-[#DCE4DF]' : 'border-white/10'}`}>
        <h3 className={`flex items-center space-x-2 text-sm font-bold ${titleClass}`}>
          <span>🎯</span>
          <span>{title}</span>
        </h3>
        {subtitle && <p className={`mt-0.5 text-[11px] ${subtitleClass}`}>{subtitle}</p>}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 flex-1">
        {/* SVG Donut Visual */}
        <div className="relative flex items-center justify-center flex-shrink-0">
          <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
            {/* Background Track Circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke={trackColor}
              strokeWidth={strokeWidth}
            />

            {/* Dynamic Segments */}
            {chartSegments.map((seg, idx) => {
              const segPercent = seg.value / totalValue;
              const dashArray = `${segPercent * circumference} ${circumference}`;
              const dashOffset = -accumulatedPercent * circumference;
              accumulatedPercent += segPercent;

              return (
                <circle
                  key={idx}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              );
            })}
          </svg>

          {/* Center Label */}
          <div className="absolute text-center">
            <div className={`text-lg font-black ${isLight ? 'text-[#18221D]' : 'text-white'}`}>
              {centerLabel || `${Math.round((chartSegments[0]?.value / totalValue) * 100)}%`}
            </div>
            {centerSublabel && (
              <div className={`text-[9px] font-semibold uppercase tracking-wider ${isLight ? 'text-[#4A5B52]' : 'text-slate-400'}`}>
                {centerSublabel}
              </div>
            )}
          </div>
        </div>

        {/* Side Legend */}
        <div className="flex-1 space-y-2 text-xs w-full">
          {chartSegments.map((seg, idx) => {
            const pct = Math.round((seg.value / totalValue) * 100);
            return (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-xl border p-2 shadow-sm ${isLight ? 'border-[#D2DBD4] bg-[#EBF0EA]' : 'border-white/10 bg-white/[0.06]'}`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }}></span>
                  <span className={`truncate text-[11px] font-semibold ${isLight ? 'text-[#2C3B34]' : 'text-slate-200'}`}>{seg.label}</span>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <span className={`text-[11px] font-extrabold ${isLight ? 'text-[#18221D]' : 'text-white'}`}>{seg.value.toLocaleString()}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${isLight ? 'border-[#D2DBD4] bg-[#FAFBF8] text-[#4E9D82]' : 'border-white/10 bg-white/[0.06] text-flora-sage'}`}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
