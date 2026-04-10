import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Globe, MousePointer2, Gauge } from 'lucide-react';
import { fetchTrafficSources } from '../data/dataService';
import {
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer as RechartsResponsiveContainer,
} from 'recharts';

interface TrafficSourceAnalysisProps {
  days: number;
}

const TrafficSourceAnalysis: React.FC<TrafficSourceAnalysisProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [sourceData, setSourceData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchTrafficSources(days);
        setSourceData(data);
      } catch (error) {
        console.error('Failed to fetch traffic source data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [days]);

  const stats = useMemo(() => {
    const totalSessions = sourceData.reduce((sum, item) => sum + item.sessions, 0);
    const totalPageViews = sourceData.reduce((sum, item) => sum + item.page_views, 0);
    const topChannel = sourceData[0];

    return {
      totalSessions,
      totalPageViews,
      avgDepth: totalSessions > 0 ? totalPageViews / totalSessions : 0,
      topChannel,
    };
  }, [sourceData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-400 font-medium italic">Загрузка данных источников трафика...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Сессии</span>
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalSessions.toLocaleString('ru-RU')}</div>
          <p className="text-sm text-slate-400 mt-2">Всего визитов по каналам</p>
        </div>

        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Просмотры</span>
            <MousePointer2 className="w-5 h-5 text-success" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalPageViews.toLocaleString('ru-RU')}</div>
          <p className="text-sm text-slate-400 mt-2">Page views из агрегатов</p>
        </div>

        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Средняя глубина</span>
            <Gauge className="w-5 h-5 text-warning" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.avgDepth.toFixed(2)}</div>
          <p className="text-sm text-slate-400 mt-2">Страниц на сессию</p>
        </div>

        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Топ канал</span>
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="text-lg font-bold text-white truncate">{stats.topChannel?.name || '—'}</div>
          <p className="text-sm text-slate-400 mt-2">
            {stats.topChannel ? `${stats.topChannel.session_share.toFixed(1)}% сессий` : 'Нет данных'}
          </p>
        </div>
      </div>

      <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
        <h3 className="text-xl font-bold mb-8 text-white">Сильнейшие каналы по объёму трафика</h3>
        <RechartsResponsiveContainer width="100%" height={420}>
          <RechartsBarChart
            data={sourceData.slice(0, 10)}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            layout="vertical"
          >
            <RechartsCartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
            <RechartsXAxis type="number" stroke="#94a3b8" />
            <RechartsYAxis
              dataKey="name"
              type="category"
              stroke="#94a3b8"
              width={170}
              tickLine={false}
              axisLine={false}
              style={{ fontSize: '11px' }}
            />
            <RechartsTooltip
              cursor={{ fill: '#1e293b' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-2xl">
                      <p className="font-bold text-slate-200 mb-2">{item.name}</p>
                      <div className="space-y-1">
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-500 text-sm">Сессии:</span>
                          <span className="text-primary font-bold">{item.sessions.toLocaleString('ru-RU')}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-500 text-sm">Просмотры:</span>
                          <span className="text-white font-bold">{item.page_views.toLocaleString('ru-RU')}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-500 text-sm">Страниц на сессию:</span>
                          <span className="text-success font-bold">{item.pages_per_session.toFixed(2)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-500 text-sm">Доля трафика:</span>
                          <span className="text-warning font-bold">{item.session_share.toFixed(1)}%</span>
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <RechartsBar dataKey="sessions" name="Сессии" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </RechartsBarChart>
        </RechartsResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold mb-8 text-white">Качество трафика по глубине</h3>
          <RechartsResponsiveContainer width="100%" height={320}>
            <RechartsBarChart data={sourceData.slice(0, 8)} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
              <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <RechartsXAxis
                dataKey="name"
                stroke="#94a3b8"
                angle={-18}
                textAnchor="end"
                height={80}
                style={{ fontSize: '11px' }}
              />
              <RechartsYAxis stroke="#94a3b8" />
              <RechartsTooltip
                formatter={(value: any) => Number(value ?? 0).toFixed(2)}
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '12px',
                }}
              />
              <RechartsBar dataKey="pages_per_session" fill="#10b981" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          </RechartsResponsiveContainer>
        </div>

        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-white">Паспорт каналов</h3>
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Без подставной revenue</span>
          </div>

          <div className="space-y-4">
            {sourceData.slice(0, 6).map((source) => (
              <div key={`${source.source}-${source.medium}`} className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h5 className="font-bold text-slate-200 text-sm uppercase tracking-wider">{source.name}</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      {source.campaign || 'Без кампании'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{source.sessions.toLocaleString('ru-RU')}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">сессий</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Доля</div>
                    <div className="text-sm font-bold text-primary">{source.session_share.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Page views</div>
                    <div className="text-sm font-bold text-white">{source.page_views.toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Глубина</div>
                    <div className="text-sm font-bold text-success">{source.pages_per_session.toFixed(2)}</div>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${source.session_share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficSourceAnalysis;
