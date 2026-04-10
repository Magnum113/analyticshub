import React, { useState, useEffect, useMemo } from 'react';
import { fetchSankeyData } from '../data/dataService';
import { ResponsiveSankey } from '@nivo/sankey';
import { Loader2, Info, TrendingDown, ArrowRight, ArrowLeftRight } from 'lucide-react';

interface UserPathExplorerProps {
  days: number;
}

// Порядок нод в воронке (слева направо)
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

const UserPathExplorer: React.FC<UserPathExplorerProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);
  const [minTransitions, setMinTransitions] = useState(50);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data: any[] = await fetchSankeyData(days);
        setRawData(data);
        if (data.length > 0) {
          const sorted = [...data].sort((a, b) => (b.transitions || 0) - (a.transitions || 0));
          const idx = Math.min(15, sorted.length - 1);
          const threshold = sorted[idx]?.transitions || 10;
          setMinTransitions(Math.max(10, Math.floor(threshold / 10) * 10));
        }
      } catch (error) {
        console.error('Error loading sankey data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  // Sankey data — DAG only (направление: слева направо по NODE_ORDER)
  const sankeyData = useMemo(() => {
    const filtered = rawData.filter((r: any) => r.transitions >= minTransitions);
    if (filtered.length === 0) return null;

    // Для каждой пары: разрешаем переход только от меньшего order к большему
    // Если order одинаковый — пропускаем (одноуровневые переходы не показываем в Sankey)
    const validLinks: any[] = [];
    const seen = new Set<string>();

    filtered.forEach((r: any) => {
      const fromOrder = NODE_ORDER[r.from] ?? 5;
      const toOrder = NODE_ORDER[r.to] ?? 5;
      
      let source = r.from;
      let target = r.to;
      let value = r.transitions;
      
      if (fromOrder === toOrder) return; // skip same-level
      
      // Если переход "назад" (от большего order к меньшему), ищем пару и берём net flow
      if (fromOrder > toOrder) {
        // Разворачиваем: показываем как обратный поток от target к source
        // Но Sankey не поддерживает обратные потоки, пропускаем
        return;
      }
      
      const key = `${source}→${target}`;
      if (seen.has(key)) return;
      seen.add(key);
      
      validLinks.push({
        source,
        target,
        value,
        users: r.users,
      });
    });

    if (validLinks.length === 0) return null;

    const nodeSet = new Set<string>();
    validLinks.forEach(l => {
      nodeSet.add(l.source);
      nodeSet.add(l.target);
    });

    const nodes = Array.from(nodeSet)
      .sort((a, b) => (NODE_ORDER[a] ?? 5) - (NODE_ORDER[b] ?? 5))
      .map(id => ({ id, nodeColor: NODE_COLORS[id] || '#64748b' }));

    return { nodes, links: validLinks };
  }, [rawData, minTransitions]);

  // Обратные потоки (для таблицы)
  const backFlows = useMemo(() => {
    const filtered = rawData.filter((r: any) => r.transitions >= minTransitions);
    return filtered.filter((r: any) => {
      const fromOrder = NODE_ORDER[r.from] ?? 5;
      const toOrder = NODE_ORDER[r.to] ?? 5;
      return fromOrder > toOrder;
    }).sort((a: any, b: any) => b.transitions - a.transitions);
  }, [rawData, minTransitions]);

  // Статистика
  const stats = useMemo(() => {
    if (!rawData.length) return null;
    const total = rawData.reduce((s: number, r: any) => s + r.transitions, 0);
    const toCart = rawData.filter((r: any) => 
      r.to === '🛒 Корзина' || r.to === '🛒 Просмотр корзины'
    ).reduce((s: number, r: any) => s + r.transitions, 0);
    const fromProduct = rawData.filter((r: any) =>
      r.from === '📦 Карточка товара' || r.from === '👁 Просмотр товара'
    ).reduce((s: number, r: any) => s + r.transitions, 0);
    const toCheckout = rawData.filter((r: any) =>
      r.to === '💳 Оформление'
    ).reduce((s: number, r: any) => s + r.transitions, 0);

    return {
      total,
      cartRate: fromProduct > 0 ? (toCart / fromProduct * 100) : 0,
      toCart,
      fromProduct,
      toCheckout,
      backFlowCount: backFlows.reduce((s: number, r: any) => s + r.transitions, 0),
    };
  }, [rawData, backFlows]);

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
          Потоки пользователей по разделам сайта. Толщина линии = количество переходов.
        </p>
      </div>

      {/* Статистика */}
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

      {/* Ползунок */}
      <div className="flex items-center gap-4 card p-3 border border-primary/10">
        <Info size={14} className="text-primary/40 flex-shrink-0" />
        <span className="text-xs text-primary/50">Порог:</span>
        <input
          type="range"
          min={5}
          max={500}
          step={5}
          value={minTransitions}
          onChange={(e) => setMinTransitions(Number(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-sm font-bold text-primary w-12 text-right">{minTransitions}</span>
        {sankeyData && (
          <span className="text-xs text-primary/40">
            {sankeyData.links.length} связей, {sankeyData.nodes.length} нод
          </span>
        )}
      </div>

      {/* Sankey */}
      {sankeyData && sankeyData.links.length > 0 ? (
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

      {/* Таблица основных переходов */}
      {sankeyData && sankeyData.links.length > 0 && (
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

      {/* Обратные потоки */}
      {backFlows.length > 0 && (
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
                {backFlows.slice(0, 15).map((r: any, i: number) => (
                  <tr key={i} className="border-b border-red-500/5 hover:bg-red-500/5">
                    <td className="py-2 px-3">{r.from}</td>
                    <td className="text-center text-red-400/30">←</td>
                    <td className="py-2 px-3">{r.to}</td>
                    <td className="py-2 px-3 text-right font-bold text-red-400">{r.transitions.toLocaleString('ru-RU')}</td>
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
