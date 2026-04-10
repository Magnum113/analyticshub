import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { Activity, Move, Orbit, Share2 } from 'lucide-react';
import type { PathNetworkEdge } from '../data/dataService';

interface UserPathD3ForceGraphProps {
  days: number;
  edges: PathNetworkEdge[];
  minTransitions: number;
}

interface D3ForceNode extends SimulationNodeDatum {
  id: string;
  group: string;
  order: number;
  color: string;
  incomingTransitions: number;
  outgoingTransitions: number;
  sessionReach: number;
  userReach: number;
  radius: number;
}

interface D3ForceLink extends SimulationLinkDatum<D3ForceNode> {
  id: string;
  source: string | D3ForceNode;
  target: string | D3ForceNode;
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
  stroke: string;
  stroke_width: number;
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

const GRAPH_HEIGHT = 760;
const GRAPH_PADDING = 72;

const formatPercent = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

const formatNumber = (value: number) => value.toLocaleString('ru-RU');

const getLinkStroke = (edge: Pick<D3ForceLink, 'is_backward' | 'session_share_from'>) => {
  if (edge.is_backward) {
    return '#f87171';
  }

  if (edge.session_share_from >= 0.3) {
    return '#22c55e';
  }

  if (edge.session_share_from >= 0.15) {
    return '#94a3b8';
  }

  return '#64748b';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getOrderTargetX = (order: number, width: number, maxOrder: number) => {
  if (maxOrder <= 0) {
    return width / 2;
  }

  const usableWidth = Math.max(width - GRAPH_PADDING * 2, 240);
  return GRAPH_PADDING + (order / maxOrder) * usableWidth;
};

const getEndpointLabel = (value: string | D3ForceNode) => (typeof value === 'string' ? value : value.id);

const getLinkGeometry = (link: D3ForceLink) => {
  const source = link.source as D3ForceNode;
  const target = link.target as D3ForceNode;
  const sx = source.x ?? 0;
  const sy = source.y ?? 0;
  const tx = target.x ?? 0;
  const ty = target.y ?? 0;
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const curvature = link.curvature;
  const direction = link.has_reverse_pair
    ? getEndpointLabel(link.source) < getEndpointLabel(link.target)
      ? 1
      : -1
    : link.is_backward
      ? -1
      : 1;

  const controlX = sx + dx / 2 + normalX * curvature * direction;
  const controlY = sy + dy / 2 + normalY * curvature * direction;

  return {
    path: `M ${sx} ${sy} Q ${controlX} ${controlY} ${tx} ${ty}`,
    labelX: sx * 0.25 + controlX * 0.5 + tx * 0.25,
    labelY: sy * 0.25 + controlY * 0.5 + ty * 0.25,
  };
};

const UserPathD3ForceGraph: React.FC<UserPathD3ForceGraphProps> = ({ days, edges, minTransitions }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<Simulation<D3ForceNode, D3ForceLink> | null>(null);
  const nodeMapRef = useRef<Map<string, D3ForceNode>>(new Map());
  const deferredMinTransitions = useDeferredValue(minTransitions);

  const [width, setWidth] = useState(1100);
  const [rendered, setRendered] = useState<{ nodes: D3ForceNode[]; links: D3ForceLink[] } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.max(320, Math.round(entries[0]?.contentRect.width || 1100));
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
    const nodeMap = new Map<string, Omit<D3ForceNode, keyof SimulationNodeDatum>>();

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
          radius: 0,
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
          radius: 0,
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

    const maxSessionReach = Math.max(...Array.from(nodeMap.values()).map((node) => node.sessionReach), 1);
    const nodes: D3ForceNode[] = Array.from(nodeMap.values())
      .map((node) => ({
        ...node,
        radius: 14 + Math.sqrt(node.sessionReach / maxSessionReach) * 18,
      }))
      .sort((a, b) => a.order - b.order || b.sessionReach - a.sessionReach);

    const links: D3ForceLink[] = filtered.map((edge) => {
      const hasReversePair = reversePairs.has(`${edge.source}|||${edge.target}`);

      return {
        ...edge,
        id: `${edge.source}→${edge.target}`,
        has_reverse_pair: hasReversePair,
        stroke: getLinkStroke({
          is_backward: edge.is_backward,
          session_share_from: edge.session_share_from,
        }),
        stroke_width: Math.max(1.5, Math.min(9, 1.5 + Math.sqrt(edge.transitions) / 4.5)),
        curvature: hasReversePair ? 32 : edge.is_backward ? 18 : 0,
      };
    });

    return {
      nodes,
      links,
      selfLoops,
      maxTransitions: links[0]?.transitions || 1,
      dominantFlow: links[0] || null,
    };
  }, [deferredMinTransitions, edges]);

  useEffect(() => {
    if (!network) {
      setRendered(null);
      return;
    }

    const maxOrder = Math.max(...network.nodes.map((node) => node.order), 0);
    const nodes = network.nodes.map((node, index) => ({
      ...node,
      x:
        getOrderTargetX(node.order, width, maxOrder) +
        (index % 3 === 0 ? -1 : 1) * (((index * 17) % 70) - 35),
      y: GRAPH_HEIGHT / 2 + (((index * 29) % 240) - 120),
    }));
    const links = network.links.map((link) => ({ ...link }));

    nodeMapRef.current = new Map(nodes.map((node) => [node.id, node]));

    const simulation = forceSimulation<D3ForceNode, D3ForceLink>(nodes)
      .force(
        'link',
        forceLink<D3ForceNode, D3ForceLink>(links)
          .id((node) => node.id)
          .distance((link) => 95 + (1 - Math.min(link.session_share_from, 0.8)) * 150)
          .strength((link) => Math.min(0.95, 0.18 + link.session_share_from))
      )
      .force('charge', forceManyBody<D3ForceNode>().strength((node) => -260 - node.radius * 10))
      .force('collide', forceCollide<D3ForceNode>().radius((node) => node.radius + 10).strength(0.95))
      .force('center', forceCenter(width / 2, GRAPH_HEIGHT / 2))
      .force('x', forceX<D3ForceNode>((node) => getOrderTargetX(node.order, width, maxOrder)).strength(0.16))
      .force('y', forceY<D3ForceNode>(GRAPH_HEIGHT / 2).strength(0.05))
      .alpha(1)
      .alphaDecay(0.045);

    simulationRef.current = simulation;

    let frameId = 0;
    const renderFrame = () => {
      frameId = 0;
      setRendered({
        nodes: [...nodes],
        links: [...links],
      });
    };

    simulation.on('tick', () => {
      if (frameId === 0) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    });

    renderFrame();

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      simulation.stop();
    };
  }, [network, width]);

  useEffect(() => {
    if (!draggedNodeId) {
      return;
    }

    const updateDraggedNode = (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const simulation = simulationRef.current;
      const node = nodeMapRef.current.get(draggedNodeId);

      if (!svg || !simulation || !node) {
        return;
      }

      const rect = svg.getBoundingClientRect();
      const nextX = ((clientX - rect.left) / rect.width) * width;
      const nextY = ((clientY - rect.top) / rect.height) * GRAPH_HEIGHT;

      node.fx = clamp(nextX, node.radius + 24, width - node.radius - 24);
      node.fy = clamp(nextY, node.radius + 24, GRAPH_HEIGHT - node.radius - 24);
      simulation.alphaTarget(0.22).restart();
    };

    const handlePointerMove = (event: PointerEvent) => updateDraggedNode(event.clientX, event.clientY);
    const handlePointerUp = () => {
      const simulation = simulationRef.current;
      const node = nodeMapRef.current.get(draggedNodeId);

      if (node) {
        node.fx = null;
        node.fy = null;
      }

      simulation?.alphaTarget(0);
      setDraggedNodeId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggedNodeId, width]);

  if (!network) {
    return (
      <div className="card p-12 text-center border border-primary/10">
        <p className="text-primary/40 mb-2">Нет данных для D3 force-графа.</p>
        <p className="text-primary/30 text-sm">Уменьши порог переходов, чтобы показать больше связей.</p>
      </div>
    );
  }

  const repeatFlows = network.selfLoops.slice(0, 3);
  const repeatTransitions = network.selfLoops.reduce((sum, edge) => sum + edge.transitions, 0);
  const activeNode = hoveredNodeId ? rendered?.nodes.find((node) => node.id === hoveredNodeId) ?? null : null;
  const activeLink = hoveredLinkId ? rendered?.links.find((link) => link.id === hoveredLinkId) ?? null : null;
  const topEdges = network.links.slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 border border-primary/10">
          <div className="text-xs font-bold text-primary/40 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Orbit size={12} /> D3 узлы и связи
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
            <Activity size={12} /> Повторы шага
          </div>
          <div className="text-base font-black text-white">{formatNumber(repeatTransitions)}</div>
          <div className="text-xs text-primary/50 mt-1">Самопереходы вынесены ниже, чтобы сеть не схлопывалась в петли.</div>
        </div>
        <div className="card p-4 border border-slate-700/60">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Move size={12} /> Под курсором
          </div>
          {activeLink ? (
            <>
              <div className="text-sm font-black text-white truncate">
                {getEndpointLabel(activeLink.source)} → {getEndpointLabel(activeLink.target)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {formatNumber(activeLink.transitions)} переходов, {formatPercent(activeLink.session_share_from)} от узла
              </div>
            </>
          ) : activeNode ? (
            <>
              <div className="text-sm font-black text-white truncate">{activeNode.id}</div>
              <div className="text-xs text-slate-400 mt-1">
                {formatNumber(activeNode.sessionReach)} сессий, {formatNumber(activeNode.outgoingTransitions)} исходящих переходов
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-black text-white">Наведи или перетащи узел</div>
              <div className="text-xs text-slate-400 mt-1">Граф собран на `d3-force`, узлы можно двигать мышью.</div>
            </>
          )}
        </div>
      </div>

      <div className="card p-3 border border-primary/10">
        <div className="mb-4 px-3">
          <h3 className="text-lg font-bold text-white">D3 Force Graph путей пользователей</h3>
          <p className="text-xs text-slate-400 mt-1">
            Раскладка считает физические силы через `d3-force`: связи тянут связанные шаги, а коллизии разводят узлы. Узлы слегка
            выровнены по порядку этапов, чтобы путь по сайту читался слева направо, но при этом оставался сетевым.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(GROUP_COLORS).map(([group, color]) => (
              <span
                key={group}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/40 px-3 py-1 text-[11px] text-slate-300"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {group}
              </span>
            ))}
          </div>
        </div>

        <div ref={containerRef} className="h-[760px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80">
          {!rendered ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Раскладываю сеть...</div>
          ) : (
            <svg ref={svgRef} viewBox={`0 0 ${width} ${GRAPH_HEIGHT}`} className="h-full w-full">
              <defs>
                <marker id="d3-force-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
                </marker>
              </defs>

              {rendered.links.map((link) => {
                const geometry = getLinkGeometry(link);
                const isActive = hoveredLinkId === link.id;

                return (
                  <g
                    key={link.id}
                    onMouseEnter={() => {
                      setHoveredLinkId(link.id);
                      setHoveredNodeId(null);
                    }}
                    onMouseLeave={() => setHoveredLinkId((current) => (current === link.id ? null : current))}
                  >
                    <path
                      d={geometry.path}
                      fill="none"
                      stroke={isActive ? '#f8fafc' : link.stroke}
                      strokeOpacity={isActive ? 0.92 : 0.7}
                      strokeWidth={isActive ? link.stroke_width + 1.4 : link.stroke_width}
                      markerEnd="url(#d3-force-arrow)"
                      style={{ transition: 'stroke 120ms ease, stroke-width 120ms ease, stroke-opacity 120ms ease' }}
                    >
                      <title>
                        {`${getEndpointLabel(link.source)} → ${getEndpointLabel(link.target)}\nПереходов: ${formatNumber(link.transitions)}\nСессий: ${formatNumber(link.unique_sessions)}\nПользователей: ${formatNumber(link.unique_users)}\nДоля от узла: ${formatPercent(link.session_share_from)}`}
                      </title>
                    </path>

                    {link.transitions >= deferredMinTransitions * 1.4 && (
                      <text
                        x={geometry.labelX}
                        y={geometry.labelY}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#f8fafc"
                        stroke="#020617"
                        strokeWidth="4"
                        paintOrder="stroke"
                        className="pointer-events-none select-none font-semibold"
                      >
                        {formatPercent(link.session_share_from)}
                      </text>
                    )}
                  </g>
                );
              })}

              {rendered.nodes.map((node) => {
                const isActive = hoveredNodeId === node.id;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                    onMouseEnter={() => {
                      setHoveredNodeId(node.id);
                      setHoveredLinkId(null);
                    }}
                    onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const liveNode = nodeMapRef.current.get(node.id);
                      if (!liveNode) {
                        return;
                      }
                      liveNode.fx = node.x ?? 0;
                      liveNode.fy = node.y ?? 0;
                      simulationRef.current?.alphaTarget(0.22).restart();
                      setDraggedNodeId(node.id);
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <circle
                      r={node.radius + (isActive ? 5 : 0)}
                      fill="none"
                      stroke={node.color}
                      strokeOpacity={isActive ? 0.85 : 0.28}
                      strokeWidth={isActive ? 6 : 2}
                    />
                    <circle
                      r={node.radius}
                      fill={node.color}
                      fillOpacity={0.94}
                      stroke="#020617"
                      strokeWidth={isActive ? 3 : 2}
                    >
                      <title>
                        {`${node.id}\nГруппа: ${node.group}\nСессий на узле: ${formatNumber(node.sessionReach)}\nВходящих переходов: ${formatNumber(node.incomingTransitions)}\nИсходящих переходов: ${formatNumber(node.outgoingTransitions)}`}
                      </title>
                    </circle>
                    <text
                      y={node.radius + 18}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#e2e8f0"
                      stroke="#020617"
                      strokeWidth="5"
                      paintOrder="stroke"
                      className="pointer-events-none select-none font-semibold"
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      <div className="card p-6 border border-primary/10">
        <h3 className="text-lg font-bold text-primary mb-4">Ключевые связи в D3-сети</h3>
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
                <tr key={edge.id} className="border-b border-primary/5 hover:bg-primary/5">
                  <td className="py-2 px-3">{getEndpointLabel(edge.source)}</td>
                  <td className="py-2 px-3">{getEndpointLabel(edge.target)}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatNumber(edge.transitions)}</td>
                  <td className="py-2 px-3 text-right text-white">{formatNumber(edge.unique_sessions)}</td>
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
              <div
                key={`${edge.source}-${edge.target}-self`}
                className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-white">{edge.source}</div>
                  <div className="text-xs text-slate-400">Пользователь остаётся на этом же шаге ещё раз</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{formatNumber(edge.transitions)}</div>
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

export default UserPathD3ForceGraph;
