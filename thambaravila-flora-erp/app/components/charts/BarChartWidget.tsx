'use client';

import { useTheme } from '../../context/ThemeContext';

interface BarItem {
  label: string;
  count: number;
  percent?: number;
  color?: string;
}

interface BarChartWidgetProps {
  title: string;
  subtitle?: string;
  items: BarItem[];
  maxVal?: number;
  layout?: 'horizontal' | 'vertical';
}

export default function BarChartWidget({
  title,
  subtitle,
  items,
  maxVal,
  layout = 'horizontal',
}: BarChartWidgetProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  if (!items || items.length === 0) return null;

  const highestCount = maxVal || Math.max(...items.map((i) => i.count), 1);

  const defaultColors = [
    'from-teal-500 to-emerald-400',
    'from-cyan-500 to-blue-500',
    'from-indigo-500 to-purple-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-emerald-500 to-teal-400',
  ];

  const shell = isLight
    ? 'border-[#DDD8D3] bg-[#F2F0EF] text-[#1E2421] shadow-[0_4px_16px_rgba(40,35,30,0.04)]'
    : 'border-white/10 bg-[#171c1a]/78 text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]';
  const titleClass = isLight ? 'text-[#1E2421]' : 'text-white';
  const subtitleClass = isLight ? 'text-[#5A625D]' : 'text-slate-400';
  const trackClass = isLight ? 'bg-[#E5E2DF] border-[#DDD8D3]' : 'bg-slate-950 border-slate-800';
  const mutedClass = isLight ? 'text-[#5A625D]' : 'text-slate-400';

  return (
    <div className={`rounded-2xl p-6 space-y-4 flex h-full flex-col justify-between border ${shell}`}>
      {/* Title */}
      <div className={`border-b pb-3 ${isLight ? 'border-[#DDD8D3]' : 'border-white/10'}`}>
        <h3 className={`flex items-center space-x-2 text-base font-bold ${titleClass}`}>
          <span>📊</span>
          <span>{title}</span>
        </h3>
        {subtitle && <p className={`mt-0.5 text-xs ${subtitleClass}`}>{subtitle}</p>}
      </div>

      {/* Horizontal Bar Layout */}
      {layout === 'horizontal' ? (
        <div className="space-y-3.5">
          {items.map((item, idx) => {
            const pct = Math.min(100, Math.round((item.count / highestCount) * 100));
            const gradientColor = item.color || defaultColors[idx % defaultColors.length];

            return (
              <div key={item.label} className="space-y-1.5 text-xs">
                <div className={`flex items-center justify-between font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <span className="truncate max-w-[200px]">{item.label}</span>
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.count.toLocaleString()}</span>
                    {item.percent !== undefined && (
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${mutedClass} ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                        {item.percent}%
                      </span>
                    )}
                  </div>
                </div>

                <div className={`h-3 w-full overflow-hidden rounded-full border p-0.5 ${trackClass}`}>
                  <div
                    className={`h-full bg-gradient-to-r ${gradientColor} rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vertical Bar Layout */
        <div className={`flex h-48 items-end justify-between gap-3 border-b pt-6 pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          {items.map((item, idx) => {
            const heightPct = Math.max(10, Math.min(100, Math.round((item.count / highestCount) * 100)));
            const gradientColor = item.color || defaultColors[idx % defaultColors.length];

            return (
              <div key={item.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                {/* Tooltip Tag */}
                <span className={`mb-1 rounded border px-1.5 py-0.5 text-[10px] font-bold opacity-0 transition group-hover:opacity-100 ${isLight ? 'border-slate-200 bg-white text-teal-700' : 'border-slate-800 bg-slate-950 text-teal-300'}`}>
                  {item.count}
                </span>

                <div className={`flex h-full w-full items-end overflow-hidden rounded-t-lg border p-1 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950'}`}>
                  <div
                    className={`w-full bg-gradient-to-t ${gradientColor} rounded-t transition-all duration-500`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>

                <span className={`mt-2 w-full truncate text-center text-[10px] font-semibold ${mutedClass}`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
