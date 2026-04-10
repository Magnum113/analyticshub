import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Loader2, Smartphone, Monitor, Layers3 } from 'lucide-react';
import { fetchDeviceData } from '../data/dataService';

interface DeviceComparisonProps {
  days: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

const DeviceComparison: React.FC<DeviceComparisonProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [deviceData, setDeviceData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchDeviceData(days);
        setDeviceData(data);
      } catch (error) {
        console.error('Failed to fetch device data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [days]);

  const stats = useMemo(() => {
    const totalSessions = deviceData.reduce((sum, item) => sum + item.sessions, 0);
    const totalPageViews = deviceData.reduce((sum, item) => sum + item.page_views, 0);
    const mobile = deviceData.find((item) => item.device_category === 'mobile');
    const desktop = deviceData.find((item) => item.device_category === 'desktop');

    return {
      totalSessions,
      totalPageViews,
      mobileShare: mobile?.session_share || 0,
      desktopShare: desktop?.session_share || 0,
      avgDepth: totalSessions > 0 ? totalPageViews / totalSessions : 0,
    };
  }, [deviceData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-400 font-medium">Загрузка данных по устройствам...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Сессии</span>
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalSessions.toLocaleString('ru-RU')}</div>
          <p className="text-sm text-slate-400 mt-2">Всего визитов за период</p>
        </div>

        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Просмотры</span>
            <Monitor className="w-5 h-5 text-success" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalPageViews.toLocaleString('ru-RU')}</div>
          <p className="text-sm text-slate-400 mt-2">Суммарные page views</p>
        </div>

        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Mobile share</span>
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.mobileShare.toFixed(1)}%</div>
          <p className="text-sm text-slate-400 mt-2">Доля мобильных сессий</p>
        </div>

        <div className="card p-6 bg-surface border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Глубина</span>
            <Layers3 className="w-5 h-5 text-warning" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.avgDepth.toFixed(2)}</div>
          <p className="text-sm text-slate-400 mt-2">Страниц на сессию</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold mb-8 text-white">Распределение сессий по устройствам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={deviceData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="sessions"
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {deviceData.map((entry, index) => (
                  <Cell key={`${entry.device_category}-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => Number(value ?? 0).toLocaleString('ru-RU')}
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold mb-8 text-white">Глубина просмотра по устройствам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deviceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                cursor={{ fill: '#1e293b' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-2xl">
                        <p className="font-bold text-slate-200 mb-2">{item.name}</p>
                        <div className="space-y-1">
                          <p className="flex justify-between gap-4">
                            <span className="text-slate-500">Сессии:</span>
                            <span className="text-white font-bold">{item.sessions.toLocaleString('ru-RU')}</span>
                          </p>
                          <p className="flex justify-between gap-4">
                            <span className="text-slate-500">Просмотры:</span>
                            <span className="text-primary font-bold">{item.page_views.toLocaleString('ru-RU')}</span>
                          </p>
                          <p className="flex justify-between gap-4">
                            <span className="text-slate-500">Страниц на сессию:</span>
                            <span className="text-success font-bold">{item.pages_per_session.toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="pages_per_session" name="Страниц на сессию" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-white">Профиль устройства</h3>
          <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Только реальные метрики Supabase</span>
        </div>

        <div className="space-y-6">
          {deviceData.map((device, index) => (
            <div key={device.device_category} className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <div className="text-white font-bold">{device.name}</div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">{device.session_share.toFixed(1)}% от всех сессий</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 md:gap-8">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Сессии</div>
                    <div className="text-lg font-bold text-white">{device.sessions.toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Просмотры</div>
                    <div className="text-lg font-bold text-white">{device.page_views.toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Глубина</div>
                    <div className="text-lg font-bold text-success">{device.pages_per_session.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Доля сессий</span>
                    <span>{device.session_share.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${device.session_share}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Глубина просмотра</span>
                    <span>{device.pages_per_session.toFixed(2)} стр./сессию</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/70"
                      style={{ width: `${Math.min(device.pages_per_session * 40, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 mt-8 italic uppercase tracking-widest font-bold">
          * Конверсия и выручка по устройствам не показываются, потому что в исходных таблицах их нет верифицированно.
        </p>
      </div>
    </div>
  );
};

export default DeviceComparison;
