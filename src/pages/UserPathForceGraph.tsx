import React, { useDeferredValue, useEffect, useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Activity, Orbit, Share2 } from 'lucide-react';
import type { PathNetworkEdge } from '../data/dataService';

interface UserPathForceGraphProps {
  days: number;
  edges: PathNetworkEdge[];
  minTransitions: number;
}

interface ForceNode {
  id: string;
  group: string;
  order: number;
  color: string;
  incomingTransitions: number;
  outgoingTransitions: number;
  sessionReach: number;
  userReach: number;
}

interface ForceLink {
  source: string | ForceNode;
  target: string | ForceNode;
  transitions: number;
  unique_sessions: number;
  unique_users: number;
  session_share_from: number;
  user_share_from: number;
  source_group: string;
  target_group: string;
  is_backward: boolean;
  is_self_loop: boolean;
  has_reverse_pair: boolean;
  color: string;
  curvature: number;
}

const GROUP_COLORS: Record<string, string> = {
  Вход: '#6366f1',
  Главная: '#3b82f6',
  'Поиск и фильтры': '#06b6d4',
  Каталог: '#8b5cf6',
  Товар: '#f59e0b',
  Чекаут: '#10b981',
  Прочее: '#64748b',
};

const formatPercent = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

const getEndpointLabel = (value: string | ForceNode) => (typeof value === 'string' ? value : value.id);

const getLinkColor = (edge: Pick<ForceLink, 'is_backward' | 'is_self_loop' | 'session_share_from'>) => {
  if (edge.is_backward) {
    return 'rgba(248, 113, 113, 0.45)';
  }

  if (edge.is_self_loop) {
    return 'rgba(59, 130, 246, 0.25)';
  }

  if (edge.session_share_from >= 0.3) {
    return 'rgba(34, 197, 94, 0.6)';
  }

  if (edge.session_share_from >= 0.15) {
    return 'rgba(148, 163, 184, 0.5)';
  }

  return 'rgba(100, 116, 139, 0.35)';
};

const UserPathForceGraph: React.FC<UserPathForceGraphProps> = ({ days, edges, minTransitions }) => {
  const graphRef = useRef<any>(null);
  const deferredMinTransitions = useDeferredValue(minTransitions);

  const network = useMemo(() => {
    const selfLoops = edges
      .filter((edge) => edge.is_self_loop)
      .sort((a, b) => b.transitions - a.transitions);

    const filtered = edges
      .filter((edge) => !edge.is_self_loop)
      .filter((edge) => edge.transitions >= deferredMinTransitions)
      .sort((a, b) => b.transitions - a.transitions)
      .slice(0, 120);

    if (filtered.length === 0) {
      return null;
    }

    const reversePairs = new Set(filtered.map((edge) => `${edge.target}|||${edge.source}`));
    const nodeMap = new Map<string, ForceNode>();

    filtered.forEach((edge) => {
      if (!nodeMap.has(edge.source)) {
        nodeMap.set(edge.source, {
          id: edge.source,
          group: edge.source_group,
          order: edge.source_order,
          color: GROUP_COLORS[edge.source_group] || GROUP_COLORS['Прочее'],
          incomingTransitions: 0,
          outgoingTransitions: 0,
          sessionReach: edge.source_sessions,
          userReach: edge.source_users,
        });
      }

      if (!nodeMap.has(edge.target)) {
        nodeMap.set(edge.target, {
          id: edge.target,
          group: edge.target_group,
          order: edge.target_order,
          color: GROUP_COLORS[edge.target_group] || GROUP_COLORS['Прочее'],
          incomingTransitions: 0,
          outgoingTransitions: 0,
          sessionReach: edge.target_sessions,
          userReach: edge.target_users,
        });
      }

      const sourceNode = nodeMap.get(edge.source)!;
      const targetNode = nodeMap.get(edge.target)!;
      sourceNode.outgoingTransitions += edge.transitions;
      targetNode.incomingTransitions += edge.transitions;
      sourceNode.sessionReach = Math.max(sourceNode.sessionReach, edge.source_sessions);
      sourceNode.userReach = Math.max(sourceNode.userReach, edge.source_users);
      targetNode.sessionReach = Math.max(targetNode.sessionReach, edge.target_sessions);
      targetNode.userReach = Math.max(targetNode.userReach, edge.target_users);
    });

    const links: ForceLink[] = filtered.map((edge) => {
      const hasReversePair = reversePairs.has(`${edge.source}|||${edge.target}`);
      const link = {
        ...edge,
        unique_sessions: edge.unique_sessions,
        unique_users: edge.unique_users,
        has_reverse_pair: hasReversePair,
        color: getLinkColor({
          is_backward: edge.is_backward,
          is_self_loop: edge.is_self_loop,
          session_share_from: edge.session_share_from,
        }),
        curvature: edge.is_self_loop ? 0.7 : hasReversePair ? 0.18 : 0,
      };

      return link;
    });

    const nodes = Array.from(nodeMap.values()).sort((a, b) => a.order - b.order || b.sessionReach - a.sessionReach);
    const maxTransitions = links[0]?.transitions || 1;
    const dominantFlow = links[0] || null;

    return {
      nodes,
      links,
      selfLoops,
      maxTransitions,
      dominantFlow,
    };
  }, [deferredMinTransitions, edges]);

  useEffect(() => {
    if (!network || !graphRef.current) {
      return;
    }

    const linkForce = graphRef.current.d3Force?.('link');
    if (linkForce) {
      linkForce.distance((link: ForceLink) => 90 + (1 - Math.min(link.session_share_from, 0.8)) * 150);
      linkForce.strength((link: ForceLink) => Math.min(0.95, 0.2 + link.session_share_from));
    }

    const chargeForce = graphRef.current.d3Force?.('charge');
    if (chargeForce) {
      chargeForce.strength(-320);
    }

    if (graphRef.current?.d3VelocityDecay) {
      graphRef.current.d3VelocityDecay(0.28);
    }

    if (graphRef.current?.d3ReheatSimulation) {
      graphRef.current.d3ReheatSimulation();
    }

    const timer = window.setTimeout(() => {
      if (graphRef.current?.zoomToFit) {
        graphRef.current.zoomToFit(600, 80);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [network]);

  if (!network) {
    return (
      <div className="card p-12 text-center border border-primary/10">
        <p className="text-primary/40 mb-2">Нет данных для сетевого графа.</p>
        <p className="text-primary/30 text-sm">Уменьши порог переходов, чтобы показать больше связей.</p>
      </div>
    );
  }

  const topEdges = network.links.slice(0, 12);
  const repeatFlows = network.selfLoops.slice(0, 3);
  const repeatTransitions = network.selfLoops.reduce((sum, edge) => sum + edge.transitions, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 border border-primary/10">
          <div className="text-xs font-bold text-primary/40 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Orbit size={12} /> Узлы и связи
          </div>
          <div className="text-2xl font-black text-primary">{network.nodes.length}</div>
          <div className="text-xs text-primary/50 mt-1">{network.links.length} межузловых связей за {days} дн.</div>
        </div>
        <div className="card p-4 border border-success/20">
          <div className="text-xs font-bold text-success/60 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Share2 size={12} /> Сильнейшая ветка
          </div>
          <div className="text-base font-black text-white truncate">
            {network.dominantFlow ? `${getEndpointLabel(network.dominantFlow.source)} → ${getEndpointLabel(network.dominantFlow.target)}` : '—'}
          </div>
          <div className="text-xs text-primary/50 mt-1">
            {network.dominantFlow ? `${formatPercent(network.dominantFlow.session_share_from)} от исходного узла` : '—'}
          </div>
        </div>
        <div className="card p-4 border border-warning/20">
          <div className="text-xs font-bold text-warning/60 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Activity size={12} /> Отображение
          </div>
          <div className="text-base font-black text-white">{repeatTransitions.toLocaleString('ru-RU')} повторов на том же шаге</div>
          <div className="text-xs text-primary/50 mt-1">Самопереходы скрыты из полотна, чтобы не забивать сеть и не изолировать узлы вроде «Главная»</div>
        </div>
      </div>

      <div className="card p-3 border border-primary/10">
        <div className="mb-3 px-3">
          <h3 className="text-lg font-bold text-white">Сетевой граф путей пользователей</h3>
          <p className="text-xs text-slate-400 mt-1">
            Узлы показывают этапы пути, толщина связи показывает объём переходов, подпись на линии показывает долю сессий от исходного узла. Самопереходы вынесены отдельно ниже.
          </p>
        </div>

        <div className="h-[720px] rounded-2xl overflow-hidden bg-slate-950/70 border border-slate-800">
          <ForceGraph2D
            ref={graphRef}
            graphData={network}
            backgroundColor="#020617"
            cooldownTicks={140}
            nodeRelSize={7}
            nodeVal={(node: any) => Math.max(1, (node.sessionReach || 0) / 140)}
            nodeColor={(node: any) => node.color}
            linkColor={(link: any) => link.color}
            linkWidth={(link: any) => Math.max(1, (link.transitions / network.maxTransitions) * 10)}
            linkCurvature={(link: any) => link.curvature}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={(link: any) => (link.session_share_from >= 0.2 ? 1 : 0)}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.004}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.id as string;
              const fontSize = Math.max(10 / globalScale, 6);
              ctx.font = `${fontSize}px Inter, sans-serif`;
              const textWidth = ctx.measureText(label).width;
              const padding = 4 / globalScale;
              const x = node.x + 10 / globalScale;
              const y = node.y - 8 / globalScale;

              ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
              ctx.fillRect(x - padding, y - fontSize + padding / 2, textWidth + padding * 2, fontSize + padding * 1.2);
              ctx.fillStyle = '#e2e8f0';
              ctx.fillText(label, x, y);
            }}
            linkCanvasObjectMode={() => 'after'}
            linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              if (globalScale < 0.65 || link.transitions < deferredMinTransitions * 1.4) {
                return;
              }

              const start = link.source as ForceNode & { x: number; y: number };
              const end = link.target as ForceNode & { x: number; y: number };
              if (typeof start.x !== 'number' || typeof end.x !== 'number') {
                return;
              }

              const label = formatPercent(link.session_share_from);
              const fontSize = Math.max(9 / globalScale, 5);
              const midX = start.x + (end.x - start.x) * 0.5;
              const midY = start.y + (end.y - start.y) * 0.5;
              const angle = Math.atan2(end.y - start.y, end.x - start.x);

              ctx.save();
              ctx.translate(midX, midY);
              ctx.rotate(angle);
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
              ctx.fillText(label, 0, -4 / globalScale);
              ctx.restore();
            }}
            nodeLabel={(node: any) => `
              <div style="padding:10px 12px">
                <div style="font-weight:700;margin-bottom:6px">${node.id}</div>
                <div>Группа: <b>${node.group}</b></div>
                <div>Сессий на узле: <b>${Number(node.sessionReach || 0).toLocaleString('ru-RU')}</b></div>
                <div>Входящих переходов: <b>${Number(node.incomingTransitions || 0).toLocaleString('ru-RU')}</b></div>
                <div>Исходящих переходов: <b>${Number(node.outgoingTransitions || 0).toLocaleString('ru-RU')}</b></div>
              </div>
            `}
            linkLabel={(link: any) => `
              <div style="padding:10px 12px">
                <div style="font-weight:700;margin-bottom:6px">${link.source.id} → ${link.target.id}</div>
                <div>Переходов: <b>${Number(link.transitions || 0).toLocaleString('ru-RU')}</b></div>
                <div>Сессий: <b>${Number(link.unique_sessions || 0).toLocaleString('ru-RU')}</b></div>
                <div>Пользователей: <b>${Number(link.unique_users || 0).toLocaleString('ru-RU')}</b></div>
                <div>Доля от исходного узла: <b>${formatPercent(link.session_share_from || 0)}</b></div>
              </div>
            `}
          />
        </div>
      </div>

      <div className="card p-6 border border-primary/10">
        <h3 className="text-lg font-bold text-primary mb-4">Ключевые связи в сети</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10">
                <th className="text-left py-2 px-3 text-primary/50 font-medium">Откуда</th>
                <th className="text-left py-2 px-3 text-primary/50 font-medium">Куда</th>
                <th className="text-right py-2 px-3 text-primary/50 font-medium">Переходы</th>
                <th className="text-right py-2 px-3 text-primary/50 font-medium">Сессии</th>
                <th className="text-right py-2 px-3 text-primary/50 font-medium">Доля</th>
              </tr>
            </thead>
            <tbody>
              {topEdges.map((edge) => (
                <tr key={`${edge.source}-${edge.target}`} className="border-b border-primary/5 hover:bg-primary/5">
                  <td className="py-2 px-3">{typeof edge.source === 'string' ? edge.source : edge.source.id}</td>
                  <td className="py-2 px-3">{typeof edge.target === 'string' ? edge.target : edge.target.id}</td>
                  <td className="py-2 px-3 text-right font-bold">{edge.transitions.toLocaleString('ru-RU')}</td>
                  <td className="py-2 px-3 text-right text-white">{edge.unique_sessions.toLocaleString('ru-RU')}</td>
                  <td className="py-2 px-3 text-right text-success">{formatPercent(edge.session_share_from)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {repeatFlows.length > 0 && (
        <div className="card p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-4">Повторы на том же шаге</h3>
          <div className="space-y-3">
            {repeatFlows.map((edge) => (
              <div key={`${edge.source}-${edge.target}-self`} className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3">
                <div>
                  <div className="font-semibold text-white">{getEndpointLabel(edge.source)}</div>
                  <div className="text-xs text-slate-400">
                    Пользователь остаётся на этом же шаге ещё раз
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{edge.transitions.toLocaleString('ru-RU')}</div>
                  <div className="text-xs text-slate-500">{formatPercent(edge.session_share_from)} от шага</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPathForceGraph;
