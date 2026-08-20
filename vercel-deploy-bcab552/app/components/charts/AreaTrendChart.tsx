'use client';

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface DataPoint {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
}

interface AreaTrendChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
}

export default function AreaTrendChart({
  title = 'Revenue & Costs Analysis',
  subtitle = 'Monthly cash flow in vs operational outflow (LKR)',
  data,
}: AreaTrendChartProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState<{ revenue: boolean; expenses: boolean; netProfit: boolean }>({
    revenue: true,
    expenses: true,
    netProfit: true,
  });

  if (!data || data.length === 0) return null;

  const width = 600;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.revenue, d.expenses, d.netProfit)),
    100000
  );

  const getX = (index: number) => {
    return paddingLeft + (index / (data.length - 1 || 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, val);
    return paddingTop + chartHeight - (clamped / maxVal) * chartHeight;
  };

  // Generate smooth SVG Catmull-Rom or Cubic Bezier path
  const buildSmoothPath = (key: 'revenue' | 'expenses' | 'netProfit') => {
    if (data.length < 2) return '';
    const points = data.map((d, i) => ({ x: getX(i), y: getY(d[key]) }));

    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      path += ` C ${controlX},${current.y} ${controlX},${next.y} ${next.x},${next.y}`;
    }

    return path;
  };

  const buildAreaPath = (key: 'revenue' | 'expenses' | 'netProfit') => {
    const linePath = buildSmoothPath(key);
    if (!linePath) return '';
    const lastX = getX(data.length - 1);
    const firstX = getX(0);
    const bottomY = paddingTop + chartHeight;
    return `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  const formatShortLKR = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  const yTicks = [maxVal, maxVal * 0.66, maxVal * 0.33, 0];

  const shell = isLight
    ? 'border-slate-200/90 bg-white/90 text-slate-900 shadow-[0_18px_40px_rgba(34,40,38,0.08)]'
    : 'border-white/10 bg-[#171c1a]/78 text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]';
  const titleClass = isLight ? 'text-slate-900' : 'text-white';
  const subtitleClass = isLight ? 'text-slate-600' : 'text-slate-400';
  const axisColor = isLight ? '#64748b' : '#94a3b8';
  const gridColor = isLight ? '#cbd5e1' : '#334155';
  const tooltipShell = isLight
    ? 'bg-white/96 border-slate-200 text-slate-900 shadow-[0_18px_40px_rgba(34,40,38,0.12)]'
    : 'bg-slate-950/95 border-teal-500/40 text-white shadow-2xl';

  return (
    <div className={`rounded-2xl p-6 space-y-4 flex h-full flex-col justify-between border ${shell}`}>
      {/* Header & Legend Controls */}
      <div className={`flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
        <div>
          <h3 className={`flex items-center space-x-2 text-base font-bold ${titleClass}`}>
            <span>📈</span>
            <span>{title}</span>
          </h3>
          {subtitle && <p className={`mt-0.5 text-xs ${subtitleClass}`}>{subtitle}</p>}
        </div>

        {/* Legend Checkboxes */}
        <div className="flex items-center space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveSeries((s) => ({ ...s, revenue: !s.revenue }))}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border transition ${
              activeSeries.revenue
                ? isLight
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : isLight
                ? 'bg-slate-100 text-slate-500 border-slate-200 opacity-60'
                : 'bg-slate-800 text-slate-500 border-slate-700 opacity-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>Revenue</span>
          </button>

          <button
            onClick={() => setActiveSeries((s) => ({ ...s, expenses: !s.expenses }))}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border transition ${
              activeSeries.expenses
                ? isLight
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                : isLight
                ? 'bg-slate-100 text-slate-500 border-slate-200 opacity-60'
                : 'bg-slate-800 text-slate-500 border-slate-700 opacity-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
            <span>Expenses</span>
          </button>

          <button
            onClick={() => setActiveSeries((s) => ({ ...s, netProfit: !s.netProfit }))}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border transition ${
              activeSeries.netProfit
                ? isLight
                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                  : 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : isLight
                ? 'bg-slate-100 text-slate-500 border-slate-200 opacity-60'
                : 'bg-slate-800 text-slate-500 border-slate-700 opacity-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
            <span>Net Profit</span>
          </button>
        </div>
      </div>

      {/* SVG Chart Frame */}
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((tickVal, idx) => {
            const y = getY(tickVal);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={gridColor}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity={isLight ? '0.72' : '0.6'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill={axisColor}
                  fontSize="10"
                  textAnchor="end"
                  className="font-mono font-medium"
                >
                  {formatShortLKR(tickVal)}
                </text>
              </g>
            );
          })}

          {/* X-Axis Month Labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={height - 6}
              fill={axisColor}
              fontSize="11"
              textAnchor="middle"
              className="font-medium"
            >
              {d.month}
            </text>
          ))}

          {/* Fill Areas */}
          {activeSeries.revenue && (
            <path d={buildAreaPath('revenue')} fill="url(#gradRevenue)" />
          )}
          {activeSeries.expenses && (
            <path d={buildAreaPath('expenses')} fill="url(#gradExpenses)" />
          )}
          {activeSeries.netProfit && (
            <path d={buildAreaPath('netProfit')} fill="url(#gradNet)" />
          )}

          {/* Stroke Lines */}
          {activeSeries.revenue && (
            <path
              d={buildSmoothPath('revenue')}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}

          {activeSeries.expenses && (
            <path
              d={buildSmoothPath('expenses')}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
              strokeDasharray="5 5"
              strokeLinecap="round"
            />
          )}

          {activeSeries.netProfit && (
            <path
              d={buildSmoothPath('netProfit')}
              fill="none"
              stroke="#14b8a6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Interactive Data Points */}
          {data.map((d, i) => {
            const x = getX(i);
            const isHovered = hoverIndex === i;
            return (
              <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                {/* Transparent hover capture bar */}
                <rect
                  x={x - 20}
                  y={paddingTop}
                  width="40"
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                />

                {/* Vertical hover guide line */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartHeight}
                    stroke={isLight ? '#0ea5e9' : '#38bdf8'}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Dots for active series */}
                {activeSeries.revenue && (
                  <circle
                    cx={x}
                    cy={getY(d.revenue)}
                    r={isHovered ? '6' : '4'}
                    fill="#10b981"
                    stroke={isLight ? '#ffffff' : '#0f172a'}
                    strokeWidth="2"
                    className="transition-all"
                  />
                )}

                {activeSeries.expenses && (
                  <circle
                    cx={x}
                    cy={getY(d.expenses)}
                    r={isHovered ? '5' : '3.5'}
                    fill="#f43f5e"
                    stroke={isLight ? '#ffffff' : '#0f172a'}
                    strokeWidth="2"
                    className="transition-all"
                  />
                )}

                {activeSeries.netProfit && (
                  <circle
                    cx={x}
                    cy={getY(d.netProfit)}
                    r={isHovered ? '5' : '3.5'}
                    fill="#14b8a6"
                    stroke={isLight ? '#ffffff' : '#0f172a'}
                    strokeWidth="2"
                    className="transition-all"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoverIndex !== null && data[hoverIndex] && (
          <div
            className={`absolute top-2 z-20 space-y-1 rounded-xl border px-3.5 py-2.5 text-xs pointer-events-none transform -translate-x-1/2 ${tooltipShell}`}
            style={{ left: `${(getX(hoverIndex) / width) * 100}%` }}
          >
            <div className={`border-b pb-1 font-bold ${isLight ? 'border-slate-200 text-slate-900' : 'border-slate-800 text-slate-100'}`}>
              Month of {data[hoverIndex].month}
            </div>
            {activeSeries.revenue && (
              <div className={`flex justify-between gap-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                <span>Revenue:</span>
                <span className="font-bold">LKR {Math.round(data[hoverIndex].revenue).toLocaleString('en-US')}</span>
              </div>
            )}
            {activeSeries.expenses && (
              <div className={`flex justify-between gap-4 ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                <span>Expenses:</span>
                <span className="font-bold">LKR {Math.round(data[hoverIndex].expenses).toLocaleString('en-US')}</span>
              </div>
            )}
            {activeSeries.netProfit && (
              <div className={`flex justify-between gap-4 ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>
                <span>Net Profit:</span>
                <span className="font-bold">LKR {Math.round(data[hoverIndex].netProfit).toLocaleString('en-US')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
