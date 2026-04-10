import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, UserCheck, Eye, MousePointer2, TrendingUp, Search, Loader2 } from 'lucide-react';
import { fetchDailyMetrics, fetchEcommerceData } from '../data/dataService';

interface SummaryDashboardProps {
  days: number;
}

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [ecommerce, setEcommerce] = useState<any>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [m, e] = await Promise.all([
          fetchDailyMetrics(days),
          fetchEcommerceData(days)
        ]);
        setMetrics(m);
        setEcommerce(e);
      } catch (error) {
        console.error('Failed to fetch summary data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  const stats = useMemo(() => {
    if (metrics.length === 0) return null;

    const totalSessions = metrics.reduce((sum, m) => sum + m.sessions, 0);
    const totalViews = metrics.reduce((sum, m) => sum + m.page_views, 0);
    const totalNewUsers = metrics.reduce((sum, m) => sum + m.new_users, 0);
    const avgBounceRate = metrics.reduce((sum, m) => sum + m.bounce_rate, 0) / metrics.length;
    
    const purchases = ecommerce['purchase']?.event_count || 0;
    const totalRevenue = ecommerce['purchase']?.total_revenue || 0;

    return {
      sessions: totalSessions,
      purchases,
      views: totalViews,
      avgOrderValue: purchases > 0 ? (totalRevenue / purchases).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : 0,
      conversionRate: totalSessions > 0 ? ((purchases / totalSessions) * 100).toFixed(2) : '0.00',
      bounceRate: (avgBounceRate * 100).toFixed(1),
      newUsers: totalNewUsers,
      totalRevenue
    };
  }, [metrics, ecommerce]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-400 animate-pulse font-medium">Загрузка аналитики...</p>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { title: 'Сессии', value: stats.sessions.toLocaleString('ru-RU'), icon: Eye, color: 'text-primary' },
    { title: 'Конверсия', value: `${stats.conversionRate}%`, icon: UserCheck, color: 'text-success' },
    { title: 'Средний чек', value: `${stats.avgOrderValue} ₽`, icon: ShoppingCart, color: 'text-warning' },
    { title: 'Отказы', value: `${stats.bounceRate}%`, icon: MousePointer2, color: 'text-danger' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="card p-6 flex items-center justify-between shadow-2xl hover:border-primary/30 transition-all border border-slate-700/50 bg-surface">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">{card.title}</p>
              <h3 className="text-3xl font-bold text-white">{card.value}</h3>
            </div>
            <div className={`p-4 rounded-2xl bg-slate-800/80 ${card.color}`}>
              <card.icon className="w-8 h-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 p-8 border border-slate-700/50 bg-surface">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <TrendingUp className="text-primary w-6 h-6" />
                    Ключевые показатели
                </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="space-y-1">
                    <p className="text-slate-500 text-sm">Просмотры страниц</p>
                    <p className="text-2xl font-bold text-white">{stats.views.toLocaleString('ru-RU')}</p>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: stats.sessions > 0 ? `${Math.min(100, (stats.views / (stats.sessions * 5)) * 100)}%` : '0%' }}></div>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-slate-500 text-sm">Всего покупок</p>
                    <p className="text-2xl font-bold text-white">{stats.purchases.toLocaleString('ru-RU')}</p>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-success/60 rounded-full" style={{ width: stats.sessions > 0 ? `${Math.min(100, (stats.purchases / (stats.sessions * 0.05)) * 100)}%` : '0%' }}></div>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-slate-500 text-sm">Новые пользователи</p>
                    <p className="text-2xl font-bold text-white">{stats.newUsers.toLocaleString('ru-RU')}</p>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-warning/60 rounded-full" style={{ width: stats.sessions > 0 ? `${Math.min(100, (stats.newUsers / stats.sessions) * 100)}%` : '0%' }}></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="card p-8 bg-gradient-to-br from-primary/10 via-surface to-surface border border-primary/20">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                <Search className="text-primary w-6 h-6" />
                Быстрые ссылки
            </h3>
            <ul className="space-y-4">
               {['Популярные товары', 'Топ категорий', 'Эффективность акций', 'Проблемные страницы'].map((item, i) => (
                   <li key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 cursor-pointer group transition-colors">
                        <span className="text-slate-300 group-hover:text-primary transition-colors uppercase text-xs font-bold tracking-widest">{item}</span>
                        <ArrowRightIcon className="w-4 h-4 text-slate-500 group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                   </li>
               ))}
            </ul>
        </div>
      </div>
    </div>
  );
};

const ArrowRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
)

export default SummaryDashboard;
