import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  fetchPagePathNetworkData,
  fetchPathNetworkData,
  fetchSankeyData,
  type PathNetworkEdge,
} from '../data/dataService';
import { ResponsiveSankey } from '@nivo/sankey';
import { Loader2, Info, TrendingDown, ArrowRight, ArrowLeftRight, Network, Orbit, Route } from 'lucide-react';

interface UserPathExplorerProps {
  days: number;
}

const NODE_ORDER: Record<string, number> = {
  '📱 Вход из приложения': 0,
  '🏠 Главная': 1,
  '🏠 Клик на главной': 1,
  '📂 Категория с главной': 1,
  '🔍 Поиск': 2,
  '🔍 Фильтр': 2,
  '📋 Категория': 3,
  '📋 Каталог': 3,
  '📂 Клик по категории': 3,
  '🏷 Акции': 3,
  '👆 Клик на товар': 4,
  '📦 Карточка товара': 5,
  '👁 Просмотр товара': 5,
  '🏪 Магазин продавца': 5,
  '🚚 Проверка доставки': 6,
  '🛒 Корзина': 7,
  '🛒 Просмотр корзины': 7,
  '💳 Оформление': 8,
  '✅ Покупка': 9,
  '📄 Другая страница': 6,
  '🏪 Другой домен': 6,
};

const NODE_COLORS: Record<string, string> = {
  '🏠 Главная': '#3b82f6',
  '📋 Категория': '#8b5cf6',
  '📋 Каталог': '#a78bfa',
  '📦 Карточка товара': '#f59e0b',
  '👁 Просмотр товара': '#f97316',
  '👆 Клик на товар': '#eab308',
  '🛒 Корзина': '#22c55e',
  '🛒 Просмотр корзины': '#16a34a',
  '💳 Оформление': '#10b981',
  '✅ Покупка': '#059669',
  '🔍 Фильтр': '#06b6d4',
  '🔍 Поиск': '#0ea5e9',
  '📱 Вход из приложения': '#6366f1',
  '🏷 Акции': '#ec4899',
  '📂 Клик по категории': '#a855f7',
  '📂 Категория с главной': '#c084fc',
  '🏪 Магазин продавца': '#14b8a6',
  '🏠 Клик на главной': '#60a5fa',
  '🚚 Проверка доставки': '#34d399',
  '📄 Другая страница': '#64748b',
  '🏪 Другой домен': '#94a3b8',
};

const UserPathForceGraph = lazy(() => import('./UserPathForceGraph'));
const UserPathD3ForceGraph = lazy(() => import('./UserPathD3ForceGraph'));

type GraphType = 'sankey' | 'force' | 'd3';
type PathMode = 'journey' | 'pages';

const UserPathExplorer: React.FC<UserPathExplorerProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);
  const [journeyNetworkData, setJourneyNetworkData] = useState<PathNetworkEdge[]>([]);
  const [pageNetworkData, setPageNetworkData] = useState<PathNetworkEdge[]>([]);
  const [minTransitions, setMinTransitions] = useState(50);
  const [graphType, setGraphType] = useState<GraphType>('sankey');
  const [pathMode, setPathMode] = useState<PathMode>('journey');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [sankey, journeyNetwork, pageNetwork] = await Promise.all([
          fetchSankeyData(days),
          fetchPathNetworkData(days),
          fetchPagePathNetworkData(days),
        ]);

        setRawData(sankey);
        setJourneyNetworkData(journeyNetwork);
        setPageNetworkData(pageNetwork);
      } catch (error) {
        console.error('Error loading path data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  useEffect(() => {
    if (pathMode === 'pages' && graphType === 'sankey') {
      setGraphType('force');
    }
  }, [graphType, pathMode]);

  const activeNetworkData = pathMode === 'journey' ? journeyNetworkData : pageNetworkData;

  useEffect(() => {
    const thresholdSource = activeNetworkData.filter((edge) => !edge.is_self_loop);
    const fallbackSource = pathMode === 'journey'
      ? (thresholdSource.length > 0 ? thresholdSource : rawData)
      : thresholdSource;

    if (fallbackSource.length === 0) {
      return;
    }

    const sorted = [...fallbackSource].sort((a: any, b: any) => (b.transitions || 0) - (a.transitions || 0));
    const idx = Math.min(15, sorted.length - 1);
    const threshold = sorted[idx]?.transitions || 10;
    setMinTransitions(Math.max(10, Math.floor(threshold / 10) * 10));
  }, [activeNetworkData, pathMode, rawData]);

  const sankeyData = useMemo(() => {
    const filtered = rawData.filter((r: any) => r.transitions >= minTransitions);
    if (filtered.length === 0) return null;

    const validLinks: any[] = [];
    const seen = new Set<string>();

    filtered.forEach((r: any) => {
      const fromOrder = NODE_ORDER[r.from] ?? 5;
      const toOrder = NODE_ORDER[r.to] ?? 5;

      if (fromOrder === toOrder || fromOrder > toOrder) {
        return;
      }

      const key = `${r.from}→${r.to}`;
      if (seen.has(key)) return;
      seen.add(key);

      validLinks.push({
        source: r.from,
        target: r.to,
        value: r.transitions,
        users: r.users,
      });
    });

    if (validLinks.length === 0) return null;

    const nodeSet = new Set<string>();
    validLinks.forEach((link) => {
      nodeSet.add(link.source);
      nodeSet.add(link.target);
    });

    const nodes = Array.from(nodeSet)
      .sort((a, b) => (NODE_ORDER[a] ?? 5) - (NODE_ORDER[b] ?? 5))
      .map((id) => ({ id, nodeColor: NODE_COLORS[id] || '#64748b' }));

    return { nodes, links: validLinks };
  }, [minTransitions, rawData]);

  const backFlows = useMemo(() => {
    const filtered = rawData.filter((r: any) => r.transitions >= minTransitions);
    return filtered
      .filter((r: any) => {
        const fromOrder = NODE_ORDER[r.from] ?? 5;
        const toOrder = NODE_ORDER[r.to] ?? 5;
        return fromOrder > toOrder;
      })
      .sort((a: any, b: any) => b.transitions - a.transitions);
  }, [minTransitions, rawData]);

  const visibleNetworkEdges = useMemo(
    () => activeNetworkData.filter((edge) => !edge.is_self_loop && edge.transitions >= minTransitions).length,
    [activeNetworkData, minTransitions]
  );

  const stats = useMemo(() => {
    if (!rawData.length || pathMode !== 'journey') return null;

    const total = rawData.reduce((sum: number, row: any) => sum + row.transitions, 0);
    const toCart = rawData
      .filter((row: any) => row.to === '🛒 Корзина' || row.to === '🛒 Просмотр корзины')
      .reduce((sum: number, row: any) => sum + row.transitions, 0);
    const fromProduct = rawData
      .filter((row: any) => row.from === '📦 Карточка товара' || row.from === '👁 Просмотр товара')
      .reduce((sum: number, row: any) => sum + row.transitions, 0);
    const toCheckout = rawData
      .filter((row: any) => row.to === '💳 Оформление')
      .reduce((sum: number, row: any) => sum + row.transitions, 0);

    return {
      total,
      cartRate: fromProduct > 0 ? (toCart / fromProduct) * 100 : 0,
      toCart,
      fromProduct,
      toCheckout,
      backFlowCount: backFlows.reduce((sum: number, row: any) => sum + row.transitions, 0),
    };
  }, [backFlows, pathMode, rawData]);

  const pageModeSummary = useMemo(() => {
    if (pathMode !== 'pages' || !pageNetworkData.length) return null;

    const filtered = pageNetworkData.filter((edge) => !edge.is_self_loop && edge.transitions >= minTransitions);
    if (!filtered.length) return null;

    const topEdge = filtered[0];
    const nodeCount = new Set(filtered.flatMap((edge) => [edge.source_id, edge.target_id])).size;

    return {
      transitions: filtered.reduce((sum, edge) => sum + edge.transitions, 0),
      nodeCount,
      topEdge,
    };
  }, [minTransitions, pageNetworkData, pathMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-primary">КАРТА ПУТЕЙ ПОЛЬЗОВАТЕЛЕЙ</h2>
        <p className="text-primary/50 text-sm mt-1">
          Два режима анализа: текущий journey-flow со смешением страниц и целей Метрики, и новый page-only граф только по реальным страницам сайта.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPathMode('journey')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            pathMode === 'journey'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-slate-700/60 bg-surface text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route size={15} />
          Journey + goals
        </button>
        <button
          type="button"
          onClick={() => setPathMode('pages')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            pathMode === 'pages'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-slate-700/60 bg-surface text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network size={15} />
          Только страницы
        </button>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-4 text-sm text-slate-300">
        {pathMode === 'journey' ? (
          <>
            Текущий режим читает `private.metrika_journey_sessionized_v`, где в одну ленту сведены `http(s)`-страницы и `goal://market.05.ru/...`.
            Из-за этого граф отражает не только переходы между страницами, но и переходы через цели Метрики вроде `view_item`, `add_to_cart`, `purchase`.
          </>
        ) : (
          <>
            Новый режим читает `public.metrika_page_path_network`: там в последовательность берутся только реальные page hits из `private.metrika_core_sessionized_v`,
            query string уже отрезан через `private.extract_path()`, а подписи и группы страниц берутся из `metrika_page_labels` с fallback на `private.default_page_label/default_page_group`.
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {pathMode === 'journey' && (
          <button
            type="button"
            onClick={() => setGraphType('sankey')}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              graphType === 'sankey'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-slate-700/60 bg-surface text-slate-400 hover:text-slate-200'
            }`}
          >
            <Route size={15} />
            Sankey
          </button>
        )}
        <button
          type="button"
          onClick={() => setGraphType('force')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            graphType === 'force'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-slate-700/60 bg-surface text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network size={15} />
          Force-Directed Graph
        </button>
        <button
          type="button"
          onClick={() => setGraphType('d3')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            graphType === 'd3'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-slate-700/60 bg-surface text-slate-400 hover:text-slate-200'
          }`}
        >
          <Orbit size={15} />
          D3 Force
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 border border-primary/10">
            <div className="text-xs font-bold text-primary/40 uppercase tracking-wider mb-2">Переходов</div>
            <div className="text-2xl font-black text-primary">{stats.total.toLocaleString('ru-RU')}</div>
            <div className="text-xs text-primary/50 mt-1">за {days} дн.</div>
          </div>
          <div className="card p-4 border border-warning/20">
            <div className="text-xs font-bold text-warning/60 uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingDown size={12} /> Товар → Корзина
            </div>
            <div className="text-2xl font-black text-warning">{stats.cartRate.toFixed(1)}%</div>
            <div className="text-xs text-primary/50 mt-1">
              {stats.toCart.toLocaleString('ru-RU')} из {stats.fromProduct.toLocaleString('ru-RU')}
            </div>
          </div>
          <div className="card p-4 border border-green-500/20">
            <div className="text-xs font-bold text-green-400/60 uppercase tracking-wider mb-2">→ Оформление</div>
            <div className="text-2xl font-black text-green-400">{stats.toCheckout.toLocaleString('ru-RU')}</div>
            <div className="text-xs text-primary/50 mt-1">дошли до чекаута</div>
          </div>
          <div className="card p-4 border border-red-500/20">
            <div className="text-xs font-bold text-red-400/60 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowLeftRight size={12} /> Возвраты назад
            </div>
            <div className="text-2xl font-black text-red-400">{stats.backFlowCount.toLocaleString('ru-RU')}</div>
            <div className="text-xs text-primary/50 mt-1">переходов «назад» по воронке</div>
          </div>
        </div>
      )}

      {pageModeSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 border border-primary/10">
            <div className="text-xs font-bold text-primary/40 uppercase tracking-wider mb-2">Page-only переходы</div>
            <div className="text-2xl font-black text-primary">{pageModeSummary.transitions.toLocaleString('ru-RU')}</div>
            <div className="text-xs text-primary/50 mt-1">только между страницами сайта за {days} дн.</div>
          </div>
          <div className="card p-4 border border-slate-700/50">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Уникальные страницы</div>
            <div className="text-2xl font-black text-white">{pageModeSummary.nodeCount.toLocaleString('ru-RU')}</div>
            <div className="text-xs text-slate-400 mt-1">попали в граф после текущего порога</div>
          </div>
          <div className="card p-4 border border-green-500/20">
            <div className="text-xs font-bold text-green-400/60 uppercase tracking-wider mb-2">Сильнейший путь</div>
            <div className="text-base font-black text-white truncate">
              {pageModeSummary.topEdge.source_label} → {pageModeSummary.topEdge.target_label}
            </div>
            <div className="text-xs text-primary/50 mt-1">{pageModeSummary.topEdge.transitions.toLocaleString('ru-RU')} переходов</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 card p-3 border border-primary/10">
        <Info size={14} className="text-primary/40 flex-shrink-0" />
        <span className="text-xs text-primary/50">Порог:</span>
        <input
          type="range"
          min={5}
          max={pathMode === 'pages' ? 300 : 500}
          step={5}
          value={minTransitions}
          onChange={(e) => setMinTransitions(Number(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-sm font-bold text-primary w-12 text-right">{minTransitions}</span>
        {pathMode === 'journey' && graphType === 'sankey' && sankeyData && (
          <span className="text-xs text-primary/40">
            {sankeyData.links.length} связей, {sankeyData.nodes.length} нод
          </span>
        )}
        {(graphType === 'force' || graphType === 'd3') && (
          <span className="text-xs text-primary/40">
            {visibleNetworkEdges} связей в сети
          </span>
        )}
      </div>

      {graphType === 'force' ? (
        <Suspense
          fallback={
            <div className="card p-12 text-center border border-primary/10">
              <Loader2 className="mx-auto mb-4 animate-spin text-primary" size={28} />
              <p className="text-primary/40">Загрузка сетевого графа...</p>
            </div>
          }
        >
          <UserPathForceGraph days={days} edges={activeNetworkData} minTransitions={minTransitions} />
        </Suspense>
      ) : graphType === 'd3' ? (
        <Suspense
          fallback={
            <div className="card p-12 text-center border border-primary/10">
              <Loader2 className="mx-auto mb-4 animate-spin text-primary" size={28} />
              <p className="text-primary/40">Загрузка D3 force-графа...</p>
            </div>
          }
        >
          <UserPathD3ForceGraph days={days} edges={activeNetworkData} minTransitions={minTransitions} />
        </Suspense>
      ) : sankeyData && sankeyData.links.length > 0 ? (
        <div className="card p-4 border border-primary/10" style={{ height: Math.max(500, sankeyData.nodes.length * 50) }}>
          <ResponsiveSankey
            data={sankeyData}
            margin={{ top: 10, right: 180, bottom: 10, left: 180 }}
            align="justify"
            colors={(node: any) => NODE_COLORS[node.id] || '#64748b'}
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.15}
            nodeThickness={18}
            nodeSpacing={14}
            nodeBorderWidth={0}
            nodeBorderRadius={3}
            linkOpacity={0.25}
            linkHoverOthersOpacity={0.05}
            linkContract={3}
            linkBlendMode="screen"
            enableLinkGradient={true}
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={10}
            labelTextColor={{ from: 'color', modifiers: [['brighter', 0.6]] }}
            theme={{
              text: { fontSize: 11, fill: '#94a3b8' },
              tooltip: {
                container: {
                  background: '#1e293b',
                  color: '#e2e8f0',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148,163,184,0.2)',
                  padding: '10px 14px',
                },
              },
            }}
            nodeTooltip={({ node }) => (
              <div style={{ background: '#1e293b', color: '#e2e8f0', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', fontSize: '12px' }}>
                <strong>{node.id}</strong>
                <br />
                Поток: <b>{node.value?.toLocaleString('ru-RU')}</b> переходов
              </div>
            )}
            linkTooltip={({ link }) => (
              <div style={{ background: '#1e293b', color: '#e2e8f0', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ color: (link.source as any).color, fontWeight: 'bold' }}>{(link.source as any).id}</span>
                  <span style={{ color: '#64748b' }}>→</span>
                  <span style={{ color: (link.target as any).color, fontWeight: 'bold' }}>{(link.target as any).id}</span>
                </div>
                <div>Переходов: <b>{link.value.toLocaleString('ru-RU')}</b></div>
              </div>
            )}
          />
        </div>
      ) : (
        <div className="card p-12 text-center border border-primary/10">
          <p className="text-primary/40 mb-2">Нет данных для диаграммы.</p>
          <p className="text-primary/30 text-sm">Попробуйте уменьшить порог переходов с помощью ползунка выше.</p>
        </div>
      )}

      {pathMode === 'journey' && graphType === 'sankey' && sankeyData && sankeyData.links.length > 0 && (
        <div className="card p-6 border border-primary/10">
          <h3 className="text-lg font-bold text-primary mb-4">Основные потоки (вперёд по воронке)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10">
                  <th className="text-left py-2 px-3 text-primary/50 font-medium">Откуда</th>
                  <th className="text-center py-2 px-3 text-primary/50 w-8"></th>
                  <th className="text-left py-2 px-3 text-primary/50 font-medium">Куда</th>
                  <th className="text-right py-2 px-3 text-primary/50 font-medium">Переходы</th>
                  <th className="text-right py-2 px-3 text-primary/50 font-medium">Юзеры</th>
                </tr>
              </thead>
              <tbody>
                {sankeyData.links
                  .sort((a: any, b: any) => b.value - a.value)
                  .slice(0, 20)
                  .map((link: any, i: number) => (
                    <tr key={i} className="border-b border-primary/5 hover:bg-primary/5">
                      <td className="py-2 px-3">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: NODE_COLORS[link.source] || '#64748b' }} />
                        {link.source}
                      </td>
                      <td className="text-center text-primary/30"><ArrowRight size={14} /></td>
                      <td className="py-2 px-3">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: NODE_COLORS[link.target] || '#64748b' }} />
                        {link.target}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">{link.value.toLocaleString('ru-RU')}</td>
                      <td className="py-2 px-3 text-right text-primary/60">{link.users?.toLocaleString('ru-RU') || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pathMode === 'journey' && graphType === 'sankey' && backFlows.length > 0 && (
        <div className="card p-6 border border-red-500/10">
          <h3 className="text-lg font-bold text-red-400 mb-1 flex items-center gap-2">
            <ArrowLeftRight size={18} /> Возвраты назад по воронке
          </h3>
          <p className="text-xs text-primary/40 mb-4">Пользователи, которые вернулись на предыдущий этап. Это точки потери конверсии.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-500/10">
                  <th className="text-left py-2 px-3 text-red-400/50 font-medium">Откуда (дальше по воронке)</th>
                  <th className="text-center py-2 px-3 text-red-400/50 w-8"></th>
                  <th className="text-left py-2 px-3 text-red-400/50 font-medium">Куда (назад)</th>
                  <th className="text-right py-2 px-3 text-red-400/50 font-medium">Возвратов</th>
                </tr>
              </thead>
              <tbody>
                {backFlows.slice(0, 15).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-red-500/5 hover:bg-red-500/5">
                    <td className="py-2 px-3">{row.from}</td>
                    <td className="text-center text-red-400/30">←</td>
                    <td className="py-2 px-3">{row.to}</td>
                    <td className="py-2 px-3 text-right font-bold text-red-400">{row.transitions.toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPathExplorer;
