import React, { useMemo, useState, useEffect } from 'react';
import { TrendingDown, ArrowDown, Users, ShoppingCart, Loader2 } from 'lucide-react';
import { fetchFunnelData } from '../data/dataService';

interface FunnelChartProps {
  days: number;
}

const STEP_COLORS = [
  { bg: '#3b82f6', gradient: 'from-blue-500/20 to-blue-600/5' },
  { bg: '#6366f1', gradient: 'from-indigo-500/20 to-indigo-600/5' },
  { bg: '#8b5cf6', gradient: 'from-violet-500/20 to-violet-600/5' },
  { bg: '#f97316', gradient: 'from-orange-500/20 to-orange-600/5' },
  { bg: '#ef4444', gradient: 'from-red-500/20 to-red-600/5' },
  { bg: '#10b981', gradient: 'from-emerald-500/20 to-emerald-600/5' },
  { bg: '#06b6d4', gradient: 'from-cyan-500/20 to-cyan-600/5' },
];

const STEP_ICONS = ['🏠', '📂', '🔎', '👁', '🛒', '💳', '✅'];

const FunnelChart: React.FC<FunnelChartProps> = ({ days }) => {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchFunnelData(days);
        setFunnelData(data);
      } catch (error) {
        console.error('Failed to fetch funnel data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  const chartData = useMemo(() => {
    if (funnelData.length === 0) return [];

    // Enforce monotonic decrease: each step ≤ previous step
    // This is correct for a funnel — users can only drop off, not appear
    const rawSteps = funnelData.map(d => ({
        name: d.step_name,
        value: d.unique_sessions,
        order: d.step_order
    }));

    const steps = rawSteps.map((step, idx) => ({
      ...step,
      value: idx === 0 ? step.value : Math.min(step.value, rawSteps[idx - 1].value)
    }));

    const maxValue = steps[0].value;
    return steps.map((step, idx) => {
      const prevValue = idx === 0 ? step.value : steps[idx - 1].value;
      const convFromPrev = idx === 0 ? 100 : prevValue > 0 ? (step.value / prevValue) * 100 : 0;
      const convFromTop = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
      const dropFromPrev = 100 - convFromPrev;
      const lostUsers = idx === 0 ? 0 : prevValue - step.value;
      return {
        ...step,
        convFromPrev,
        convFromTop,
        dropFromPrev,
        lostUsers,
        widthPct: Math.max(8, convFromTop),
      };
    });
  }, [funnelData]);

  if (loading) {
     return (
       <div className="flex flex-col items-center justify-center h-64 space-y-4">
         <Loader2 className="w-12 h-12 text-primary animate-spin" />
         <p className="text-slate-400 animate-pulse font-medium">Загрузка данных воронки...</p>
       </div>
     );
  }

  if (chartData.length === 0) return null;

  // SVG Funnel
  const svgWidth = 700;
  const svgHeight = 420;
  const stepHeight = svgHeight / chartData.length;
  const maxBarWidth = svgWidth * 0.85;
  const minBarWidth = svgWidth * 0.08;

  const getFunnelPoints = (index: number) => {
    const topWidth = minBarWidth + (maxBarWidth - minBarWidth) * (chartData[index].widthPct / 100);
    const botWidth = index < chartData.length - 1
      ? minBarWidth + (maxBarWidth - minBarWidth) * (chartData[index + 1].widthPct / 100)
      : topWidth * 0.85;

    const y = index * stepHeight;
    const centerX = svgWidth / 2;
    const gap = 2;

    return {
      points: [
        `${centerX - topWidth / 2},${y + gap}`,
        `${centerX + topWidth / 2},${y + gap}`,
        `${centerX + botWidth / 2},${y + stepHeight - gap}`,
        `${centerX - botWidth / 2},${y + stepHeight - gap}`,
      ].join(' '),
      centerY: y + stepHeight / 2,
      topWidth,
    };
  };

  return (
    <div className="space-y-8">
      {/* Main Funnel Visual */}
      <div className="card p-8 bg-surface border border-slate-700/50">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-2xl font-bold text-white">Воронка конверсии</h3>
            <p className="text-sm text-slate-400 mt-1">Путь от первого визита до покупки на 05.ru</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/60 px-4 py-2 rounded-lg">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm text-slate-300">{chartData[0].value.toLocaleString()} сессий</span>
            <span className="text-slate-600 mx-1">→</span>
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-semibold">{chartData[chartData.length - 1].value.toLocaleString()} покупок</span>
          </div>
        </div>

        <div className="flex items-start gap-6">
          {/* SVG Funnel */}
          <div className="flex-1">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              width="100%"
              style={{ maxWidth: '100%', height: 'auto' }}
            >
              <defs>
                {chartData.map((_, i) => (
                  <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STEP_COLORS[i % STEP_COLORS.length].bg} stopOpacity={hoveredStep === i ? 0.9 : 0.7} />
                    <stop offset="100%" stopColor={STEP_COLORS[i % STEP_COLORS.length].bg} stopOpacity={hoveredStep === i ? 0.7 : 0.4} />
                  </linearGradient>
                ))}
              </defs>

              {chartData.map((step, i) => {
                const { points, centerY } = getFunnelPoints(i);
                const isHovered = hoveredStep === i;
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredStep(i)}
                    onMouseLeave={() => setHoveredStep(null)}
                    className="cursor-pointer"
                  >
                    {/* Funnel segment */}
                    <polygon
                      points={points}
                      fill={`url(#grad-${i})`}
                      stroke={STEP_COLORS[i % STEP_COLORS.length].bg}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeOpacity={isHovered ? 0.8 : 0.3}
                      className="transition-all duration-200"
                    />

                    {/* Step label */}
                    <text
                      x={svgWidth / 2}
                      y={centerY - 8}
                      textAnchor="middle"
                      fill={isHovered ? '#ffffff' : '#e2e8f0'}
                      fontSize="14"
                      fontWeight="600"
                      className="transition-all duration-200 pointer-events-none"
                    >
                      {STEP_ICONS[i % STEP_ICONS.length]} {step.name}
                    </text>

                    {/* Value */}
                    <text
                      x={svgWidth / 2}
                      y={centerY + 14}
                      textAnchor="middle"
                      fill={isHovered ? '#ffffff' : '#94a3b8'}
                      fontSize="13"
                      fontWeight="500"
                      className="transition-all duration-200 pointer-events-none"
                    >
                      {step.value.toLocaleString()} сессий ({step.convFromTop.toFixed(1)}%)
                    </text>

                    {/* Drop-off arrow on the right */}
                    {i > 0 && step.lostUsers > 0 && (
                      <g>
                        <line
                          x1={svgWidth / 2 + getFunnelPoints(i).topWidth / 2 + 15}
                          y1={i * stepHeight + 2}
                          x2={svgWidth / 2 + getFunnelPoints(i).topWidth / 2 + 40}
                          y2={i * stepHeight + stepHeight / 2 - 5}
                          stroke="#ef4444"
                          strokeWidth="1.5"
                          strokeOpacity={isHovered ? 0.8 : 0.4}
                          strokeDasharray="4,3"
                          markerEnd="url(#arrowRed)"
                        />
                        <text
                          x={svgWidth / 2 + getFunnelPoints(i).topWidth / 2 + 45}
                          y={i * stepHeight + stepHeight / 2}
                          fill="#ef4444"
                          fontSize="11"
                          fontWeight="500"
                          fillOpacity={isHovered ? 1 : 0.6}
                          className="pointer-events-none"
                        >
                          −{step.lostUsers.toLocaleString()} ({step.dropFromPrev.toFixed(0)}%)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              <defs>
                <marker id="arrowRed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" fillOpacity="0.6" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Step-by-step conversion cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {chartData.slice(1).map((step, i) => {
          const prev = chartData[i];
          const isGood = step.convFromPrev > 50;
          return (
            <div
              key={i}
              className="card p-5 relative overflow-hidden bg-surface border border-slate-700/50 hover:border-slate-500/50 transition-all"
              onMouseEnter={() => setHoveredStep(i + 1)}
              onMouseLeave={() => setHoveredStep(null)}
            >
              <div
                className="absolute bottom-0 left-0 right-0 opacity-10 transition-all duration-500"
                style={{
                  height: `${step.convFromPrev}%`,
                  backgroundColor: STEP_COLORS[(i + 1) % STEP_COLORS.length].bg,
                }}
              />

              <div className="relative z-10">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 truncate">
                  {prev.name}
                </p>

                <div className="flex items-center justify-center my-1">
                  <ArrowDown className="w-3 h-3 text-slate-600" />
                </div>

                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3 truncate">
                  {step.name}
                </p>

                <div className="text-center mb-3">
                  <span
                    className="text-2xl font-bold"
                    style={{ color: STEP_COLORS[(i + 1) % STEP_COLORS.length].bg }}
                  >
                    {step.convFromPrev.toFixed(1)}%
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500">Потери</span>
                  <span className="text-red-400 font-semibold flex items-center gap-1">
                    <TrendingDown className="w-2.5 h-2.5" />
                    {step.lostUsers.toLocaleString()}
                  </span>
                </div>

                <div className="h-1 w-full bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${step.convFromPrev}%`,
                      backgroundColor: isGood ? '#10b981' : '#ef4444',
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall conversion summary */}
      <div className="card p-6 bg-surface border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <ShoppingCart className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Общая конверсия (вход → покупка)</p>
              <p className="text-3xl font-bold text-emerald-400">
                {chartData[chartData.length - 1].convFromTop.toFixed(2)}%
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Из {chartData[0].value.toLocaleString()} посетителей</p>
            <p className="text-2xl font-bold text-white">
              {chartData[chartData.length - 1].value.toLocaleString()} купили
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunnelChart;
