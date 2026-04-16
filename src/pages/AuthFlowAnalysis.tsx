import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  LogIn,
  Repeat,
  TimerReset,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { fetchAuthFlowReport, type AuthFlowReport } from '../data/dataService';

interface AuthFlowAnalysisProps {
  days: number;
}

const AuthFlowAnalysis: React.FC<AuthFlowAnalysisProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AuthFlowReport | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchAuthFlowReport(days);
        setReport(data);
      } catch (error) {
        console.error('Failed to fetch auth flow data:', error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [days]);

  const summary = useMemo(() => {
    if (!report?.summary) {
      return null;
    }

    const data = report.summary;
    const maxFunnel = Math.max(
      data.auth_users_from_market || 0,
      data.returned_users_observed || 0,
      data.return_users_from_auth_referer || 0,
      1
    );

    return {
      ...data,
      maxFunnel,
      observedReturnRatePct: (data.return_rate_observed_users || 0) * 100,
      observedSessionRatePct: (data.return_rate_observed_sessions || 0) * 100,
    };
  }, [report]);

  const funnelData = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        step: 'Ушли в 05ID',
        value: summary.auth_users_from_market,
        fill: '#3b82f6',
        description: 'Уникальные пользователи с наблюдаемым переходом market -> id',
      },
      {
        step: 'Вернулись обратно',
        value: summary.returned_users_observed,
        fill: '#10b981',
        description: 'Возврат в market после наблюдаемого auth в той же сессии',
      },
      {
        step: 'Возврат по referer',
        value: summary.return_users_from_auth_referer,
        fill: '#f59e0b',
        description: 'Более широкий сигнал: market hit с referer = id.05.ru',
      },
    ];
  }, [summary]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-400 font-medium">Загрузка отчёта по авторизации...</p>
      </div>
    );
  }

  if (!report || !summary) {
    return (
      <div className="card p-10 border border-slate-700/50 bg-surface text-center">
        <p className="text-slate-300 font-medium">Нет данных для отчёта по авторизации.</p>
      </div>
    );
  }

  const cards = [
    {
      title: 'Ушли в 05ID',
      value: summary.auth_users_from_market.toLocaleString('ru-RU'),
      subtitle: `${summary.auth_sessions_from_market.toLocaleString('ru-RU')} сессий`,
      icon: LogIn,
      color: 'text-primary',
    },
    {
      title: 'Вернулись обратно',
      value: summary.returned_users_observed.toLocaleString('ru-RU'),
      subtitle: `${summary.observedReturnRatePct.toFixed(1)}% от наблюдаемого auth`,
      icon: Repeat,
      color: 'text-success',
    },
    {
      title: 'Возврат по referer',
      value: summary.return_users_from_auth_referer.toLocaleString('ru-RU'),
      subtitle: `${summary.return_hits_to_market.toLocaleString('ru-RU')} хитов возврата`,
      icon: ShieldCheck,
      color: 'text-warning',
    },
    {
      title: 'Среднее время возврата',
      value: `${summary.avg_minutes_to_return.toFixed(1)} мин`,
      subtitle: `по ${summary.returned_sessions_observed.toLocaleString('ru-RU')} наблюдаемым возвратам`,
      icon: TimerReset,
      color: 'text-white',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-primary">ВОРОНКА АВТОРИЗАЦИИ / 05ID</h2>
        <p className="text-primary/50 text-sm mt-1">
          Отдельный отчёт по переходу пользователей из <code>market.05.ru</code> на <code>id.05.ru</code> и возвращению обратно в маркетплейс.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="card p-6 bg-surface border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">{card.title}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-3xl font-bold text-white">{card.value}</div>
            <p className="text-sm text-slate-400 mt-2">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Конверсия в возврат
              </h3>
              <p className="text-sm text-slate-400 mt-2">
                Слева строгая наблюдаемая воронка <code>market -&gt; id -&gt; market</code>, справа более широкий сигнал возврата по <code>referer</code>.
              </p>
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">
              Anchor: {summary.anchor_date}
            </span>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={funnelData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="step" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip
                cursor={{ fill: '#1e293b' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }
                  const item = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-2xl">
                      <p className="font-bold text-slate-200 mb-2">{item.step}</p>
                      <p className="text-sm text-slate-400 mb-2">{item.description}</p>
                      <p className="text-primary font-bold">{Number(item.value || 0).toLocaleString('ru-RU')} пользователей</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {funnelData.map((item) => (
                  <Cell key={item.step} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {funnelData.map((item) => (
              <div key={item.step} className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">{item.step}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                </div>
                <div className="text-2xl font-bold text-white">{item.value.toLocaleString('ru-RU')}</div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden mt-4">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (item.value / summary.maxFunnel) * 100)}%`,
                      backgroundColor: item.fill,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold text-white mb-6">Справка по качеству сигнала</h3>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Любой hit на 05ID</div>
              <div className="text-2xl font-bold text-white">{summary.users_with_any_auth_hit.toLocaleString('ru-RU')}</div>
              <div className="text-sm text-slate-400 mt-2">
                Пользователи, у которых вообще наблюдался <code>id.05.ru</code> в сыром слое за окно.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Наблюдаемый return rate</div>
              <div className="text-2xl font-bold text-success">{summary.observedReturnRatePct.toFixed(1)}%</div>
              <div className="text-sm text-slate-400 mt-2">
                Доля пользователей, которые вернулись в <code>market.05.ru</code> после наблюдаемого auth-перехода.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Возврат по referer</div>
              <div className="text-2xl font-bold text-warning">{summary.return_users_from_auth_referer.toLocaleString('ru-RU')}</div>
              <div className="text-sm text-slate-400 mt-2">
                Более широкий сигнал возврата: hit на маркетплейсе, у которого <code>referer = id.05.ru</code>.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
        <h3 className="text-xl font-bold mb-8 text-white">Динамика по дням</h3>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={report.daily} margin={{ top: 20, right: 24, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '12px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="auth_users_from_market" name="Ушли в 05ID" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="returned_users_observed" name="Вернулись наблюдаемо" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="return_users_from_auth_referer" name="Вернулись по referer" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold text-white mb-6">С каких страниц уходят в 05ID</h3>
          <div className="space-y-4">
            {report.topOriginPages.slice(0, 8).map((page) => (
              <div key={page.path} className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-bold text-white">{page.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{page.path}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{page.auth_sessions.toLocaleString('ru-RU')}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">сессий</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Пользователи</div>
                    <div className="font-bold text-white">{page.auth_users.toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Хиты auth</div>
                    <div className="font-bold text-success">{page.auth_hits.toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Источник label</div>
                    <div className="font-bold text-slate-300">{page.label_source}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold text-white mb-6">Куда возвращаются после 05ID</h3>
          <div className="space-y-4">
            {report.topReturnPages.slice(0, 8).map((page) => (
              <div key={page.path} className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-bold text-white">{page.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{page.path}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-warning">{page.return_sessions.toLocaleString('ru-RU')}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">сессий</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Пользователи</div>
                    <div className="font-bold text-white">{page.return_users.toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Return hits</div>
                    <div className="font-bold text-success">{page.return_hits.toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Источник label</div>
                    <div className="font-bold text-slate-300">{page.label_source}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthFlowAnalysis;
