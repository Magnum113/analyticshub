import { supabase } from './supabaseClient';

interface DailyMetricsRow {
  date: string;
  active_users: number;
  sessions: number;
  page_views: number;
  new_users: number;
  bounce_rate: number;
  avg_session_duration: number;
}

interface FunnelRow {
  date: string;
  step_name: string;
  step_order: number;
  unique_sessions: number;
  unique_users: number;
}

interface TrafficSourceRow {
  date: string;
  source: string;
  medium: string;
  campaign: string | null;
  sessions: number;
  page_views: number;
  pages_per_session: number;
}

interface DeviceRow {
  date: string;
  device_category: string;
  sessions: number;
  page_views: number;
  pages_per_session: number;
}

interface PageRow {
  date: string;
  page_path: string;
  page_title: string | null;
  page_kind: string | null;
  page_group: string | null;
  label_source: string | null;
  needs_review: boolean;
  screen_page_views: number;
  active_users: number;
  avg_engagement_time: number;
  bounce_rate: number;
}

interface SearchTermRow {
  date: string;
  search_term: string;
  search_count: number;
  unique_users: number;
}

interface SankeyRow {
  date: string;
  from: string;
  to: string;
  transitions: number;
  users: number;
}

interface PathNetworkRow {
  date: string;
  source_node: string;
  source_group: string;
  source_order: number;
  target_node: string;
  target_group: string;
  target_order: number;
  transitions: number;
  unique_sessions: number;
  unique_users: number;
  source_sessions: number;
  source_users: number;
  target_sessions: number;
  target_users: number;
  session_share_from: number;
  user_share_from: number;
  is_backward: boolean;
  is_self_loop: boolean;
}

interface PagePathNetworkRow {
  date: string;
  source_path: string;
  source_title: string;
  source_kind: string;
  source_group: string;
  source_order: number;
  target_path: string;
  target_title: string;
  target_kind: string;
  target_group: string;
  target_order: number;
  transitions: number;
  unique_sessions: number;
  unique_users: number;
  source_sessions: number;
  source_users: number;
  target_sessions: number;
  target_users: number;
  session_share_from: number;
  user_share_from: number;
  is_backward: boolean;
  is_self_loop: boolean;
}

interface EcommerceRow {
  date: string;
  event_name: string;
  event_label: string | null;
  event_group: string | null;
  label_source: string | null;
  needs_review: boolean;
  event_count: number;
  unique_users: number;
  total_revenue: number;
}

interface AuthFlowDailyRow {
  date: string;
  users_with_any_auth_hit: number;
  sessions_with_any_auth_hit: number;
  auth_hits_from_market: number;
  auth_users_from_market: number;
  auth_sessions_from_market: number;
  returned_users_observed: number;
  returned_sessions_observed: number;
  return_rate_observed_users: number;
  return_rate_observed_sessions: number;
  avg_minutes_to_return: number | null;
}

interface AuthReturnRefererDailyRow {
  date: string;
  return_hits_to_market: number;
  return_users_from_auth_referer: number;
  return_sessions_from_auth_referer: number;
}

interface AuthFlowWindowSummaryRow {
  anchor_date: string;
  window_days: number;
  users_with_any_auth_hit: number;
  sessions_with_any_auth_hit: number;
  auth_hits_from_market: number;
  auth_users_from_market: number;
  auth_sessions_from_market: number;
  returned_users_observed: number;
  returned_sessions_observed: number;
  return_users_from_auth_referer: number;
  return_sessions_from_auth_referer: number;
  return_hits_to_market: number;
  return_rate_observed_users: number;
  return_rate_observed_sessions: number;
  avg_minutes_to_return: number | null;
}

interface AuthOriginPageRow {
  date: string;
  origin_path: string;
  origin_title: string;
  auth_users: number;
  auth_sessions: number;
  auth_hits: number;
  label_source: string;
}

interface AuthReturnPageRow {
  date: string;
  landing_path: string;
  landing_title: string;
  return_users: number;
  return_sessions: number;
  return_hits: number;
  label_source: string;
}

export interface PathNetworkEdge {
  source_id: string;
  source_label: string;
  source: string;
  source_group: string;
  source_order: number;
  source_path?: string;
  source_kind?: string;
  target_id: string;
  target_label: string;
  target: string;
  target_group: string;
  target_order: number;
  target_path?: string;
  target_kind?: string;
  transitions: number;
  unique_sessions: number;
  unique_users: number;
  source_sessions: number;
  source_users: number;
  target_sessions: number;
  target_users: number;
  session_share_from: number;
  user_share_from: number;
  is_backward: boolean;
  is_self_loop: boolean;
}

export interface AuthFlowDailyPoint {
  date: string;
  users_with_any_auth_hit: number;
  sessions_with_any_auth_hit: number;
  auth_hits_from_market: number;
  auth_users_from_market: number;
  auth_sessions_from_market: number;
  returned_users_observed: number;
  returned_sessions_observed: number;
  return_users_from_auth_referer: number;
  return_sessions_from_auth_referer: number;
  return_hits_to_market: number;
  return_rate_observed_users: number;
  return_rate_observed_sessions: number;
  avg_minutes_to_return: number;
}

export interface AuthFlowWindowSummary {
  anchor_date: string;
  window_days: number;
  users_with_any_auth_hit: number;
  sessions_with_any_auth_hit: number;
  auth_hits_from_market: number;
  auth_users_from_market: number;
  auth_sessions_from_market: number;
  returned_users_observed: number;
  returned_sessions_observed: number;
  return_users_from_auth_referer: number;
  return_sessions_from_auth_referer: number;
  return_hits_to_market: number;
  return_rate_observed_users: number;
  return_rate_observed_sessions: number;
  avg_minutes_to_return: number;
}

export interface AuthOriginPageSummary {
  title: string;
  path: string;
  auth_users: number;
  auth_sessions: number;
  auth_hits: number;
  label_source: string;
}

export interface AuthReturnPageSummary {
  title: string;
  path: string;
  return_users: number;
  return_sessions: number;
  return_hits: number;
  label_source: string;
}

export interface AuthFlowReport {
  summary: AuthFlowWindowSummary | null;
  daily: AuthFlowDailyPoint[];
  topOriginPages: AuthOriginPageSummary[];
  topReturnPages: AuthReturnPageSummary[];
}

const PAGE_KIND_DISPLAY_NAMES: Record<string, string> = {
  product: 'Страница товара',
  catalog: 'Страница каталога',
  promo: 'Промо-страница',
  seller: 'Раздел продавца',
  account: 'Раздел личного кабинета',
  sale: 'Страница акции',
  other: 'Страница сайта',
};

const PAGE_GROUP_DISPLAY_NAMES: Record<string, string> = {
  Товар: 'Страница товара',
  Каталог: 'Страница каталога',
  Акции: 'Страница акций',
  Промо: 'Промо-страница',
  'Личный кабинет': 'Раздел личного кабинета',
  'Личный кабинет селлера': 'Личный кабинет селлера',
  Продавцы: 'Раздел продавца',
  Прочее: 'Страница сайта',
};

const cache = new Map<string, Promise<any[]>>();

const getStartDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

async function loadTable<T>(table: string, days: number): Promise<T[]> {
  const cacheKey = `${table}:${days}`;

  if (!cache.has(cacheKey)) {
    cache.set(
      cacheKey,
      (async () => {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gte('date', getStartDate(days))
          .order('date', { ascending: true });

        if (error) {
          throw new Error(`Failed to load ${table}: ${error.message}`);
        }

        return data ?? [];
      })()
    );
  }

  return cache.get(cacheKey) as Promise<T[]>;
}

const getChannelName = (source: string, medium: string) => {
  if (source === '(direct)' && medium === '(none)') return 'Прямые заходы';
  if (medium === 'organic') return `${source} / organic`;
  if (medium === 'cpc') return `${source} / ads`;
  return `${source} / ${medium}`;
};

const getDeviceName = (deviceCategory: string) => {
  switch (deviceCategory) {
    case 'mobile':
      return 'Мобильные';
    case 'desktop':
      return 'Десктоп';
    case 'tablet':
      return 'Планшеты';
    default:
      return deviceCategory;
  }
};

const humanizeEventName = (eventName: string) =>
  eventName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());

const getFriendlyPageTitle = (page: Pick<PageRow, 'page_path' | 'page_title' | 'page_kind' | 'page_group' | 'needs_review'>) => {
  const explicitTitle = page.page_title?.trim();

  if (explicitTitle && !page.needs_review) {
    return explicitTitle;
  }

  if (page.page_kind && PAGE_KIND_DISPLAY_NAMES[page.page_kind]) {
    return PAGE_KIND_DISPLAY_NAMES[page.page_kind];
  }

  if (page.page_group && PAGE_GROUP_DISPLAY_NAMES[page.page_group]) {
    return PAGE_GROUP_DISPLAY_NAMES[page.page_group];
  }

  return explicitTitle || page.page_path;
};

const getFriendlyEventLabel = (event: Pick<EcommerceRow, 'event_name' | 'event_label'>) =>
  event.event_label?.trim() || humanizeEventName(event.event_name);

export const fetchDailyMetrics = async (days: number) => {
  const data = await loadTable<DailyMetricsRow>('metrika_daily_metrics', days);
  return data.sort((a, b) => a.date.localeCompare(b.date));
};

export const fetchFunnelData = async (days: number) => {
  const data = await loadTable<FunnelRow>('metrika_funnel_daily', days);

  const aggregated = data.reduce((acc, curr) => {
    const step = acc.find((item) => item.step_name === curr.step_name);
    if (step) {
      step.unique_sessions += curr.unique_sessions;
      step.unique_users += curr.unique_users;
    } else {
      acc.push({ ...curr });
    }
    return acc;
  }, [] as FunnelRow[]);

  return aggregated.sort((a, b) => a.step_order - b.step_order);
};

export const fetchTrafficSources = async (days: number) => {
  const data = await loadTable<TrafficSourceRow>('metrika_traffic_sources', days);

  const aggregated = data.reduce((acc, curr) => {
    const key = `${curr.source}|||${curr.medium}`;

    if (!acc[key]) {
      acc[key] = {
        name: getChannelName(curr.source, curr.medium),
        source: curr.source,
        medium: curr.medium,
        campaign: curr.campaign,
        sessions: 0,
        page_views: 0,
      };
    }

    acc[key].sessions += curr.sessions || 0;
    acc[key].page_views += curr.page_views || 0;
    return acc;
  }, {} as Record<string, {
    name: string;
    source: string;
    medium: string;
    campaign: string | null;
    sessions: number;
    page_views: number;
  }>);

  const totalSessions = Object.values(aggregated).reduce((sum, item) => sum + item.sessions, 0);

  return Object.values(aggregated)
    .map((item) => ({
      ...item,
      pages_per_session: item.sessions > 0 ? item.page_views / item.sessions : 0,
      session_share: totalSessions > 0 ? (item.sessions / totalSessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
};

export const fetchDeviceData = async (days: number) => {
  const data = await loadTable<DeviceRow>('metrika_devices', days);

  const aggregated = data.reduce((acc, curr) => {
    const key = curr.device_category;

    if (!acc[key]) {
      acc[key] = {
        name: getDeviceName(curr.device_category),
        device_category: curr.device_category,
        sessions: 0,
        page_views: 0,
      };
    }

    acc[key].sessions += curr.sessions || 0;
    acc[key].page_views += curr.page_views || 0;
    return acc;
  }, {} as Record<string, {
    name: string;
    device_category: string;
    sessions: number;
    page_views: number;
  }>);

  const totalSessions = Object.values(aggregated).reduce((sum, item) => sum + item.sessions, 0);

  return Object.values(aggregated)
    .map((item) => ({
      ...item,
      pages_per_session: item.sessions > 0 ? item.page_views / item.sessions : 0,
      session_share: totalSessions > 0 ? (item.sessions / totalSessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
};

export const fetchTopPages = async (days: number) => {
  const data = await loadTable<PageRow>('metrika_pages', days);

  const aggregated = data.reduce((acc, curr) => {
    const path = curr.page_path;

    if (!acc[path]) {
      acc[path] = {
        page_path: path,
        page_title: curr.page_title || path,
        page_kind: curr.page_kind,
        page_group: curr.page_group,
        label_source: curr.label_source || 'auto',
        needs_review: Boolean(curr.needs_review),
        screen_page_views: 0,
        active_users: 0,
        bounce_rate_sum: 0,
        bounce_rate_count: 0,
        engagement_sum: 0,
      };
    }

    acc[path].screen_page_views += curr.screen_page_views || 0;
    acc[path].active_users += curr.active_users || 0;
    acc[path].bounce_rate_sum += (curr.bounce_rate || 0) * (curr.screen_page_views || 0);
    acc[path].bounce_rate_count += curr.screen_page_views || 0;
    acc[path].engagement_sum += (curr.avg_engagement_time || 0) * (curr.active_users || 0);
    acc[path].page_kind = acc[path].page_kind || curr.page_kind;
    acc[path].page_group = acc[path].page_group || curr.page_group;
    acc[path].label_source = acc[path].label_source || curr.label_source || 'auto';
    acc[path].needs_review = acc[path].needs_review || Boolean(curr.needs_review);

    if (curr.page_title && acc[path].page_title === path) {
      acc[path].page_title = curr.page_title;
    }

    return acc;
  }, {} as Record<string, {
    page_path: string;
    page_title: string;
    page_kind: string | null;
    page_group: string | null;
    label_source: string;
    needs_review: boolean;
    screen_page_views: number;
    active_users: number;
    bounce_rate_sum: number;
    bounce_rate_count: number;
    engagement_sum: number;
  }>);

  return Object.values(aggregated)
    .map((item) => ({
      ...item,
      display_title: getFriendlyPageTitle(item),
      bounce_rate: item.bounce_rate_count > 0 ? item.bounce_rate_sum / item.bounce_rate_count : 0,
      avg_engagement_time: item.active_users > 0 ? item.engagement_sum / item.active_users : 0,
    }))
    .sort((a, b) => b.screen_page_views - a.screen_page_views);
};

export const fetchSearchTerms = async (days: number) => {
  const data = await loadTable<SearchTermRow>('metrika_search_terms', days);

  const aggregated = data.reduce((acc, curr) => {
    const key = curr.search_term;

    if (!acc[key]) {
      acc[key] = {
        search_term: curr.search_term,
        search_count: 0,
        unique_users: 0,
      };
    }

    acc[key].search_count += curr.search_count || 0;
    acc[key].unique_users += curr.unique_users || 0;
    return acc;
  }, {} as Record<string, {
    search_term: string;
    search_count: number;
    unique_users: number;
  }>);

  return Object.values(aggregated).sort((a, b) => b.search_count - a.search_count);
};

export const fetchSankeyData = async (days: number) => {
  const data = await loadTable<SankeyRow>('metrika_sankey', days);

  const aggregated = data.reduce((acc, curr) => {
    const key = `${curr.from}|||${curr.to}`;

    if (!acc[key]) {
      acc[key] = {
        from: curr.from,
        to: curr.to,
        transitions: 0,
        users: 0,
      };
    }

    acc[key].transitions += curr.transitions || 0;
    acc[key].users += curr.users || 0;
    return acc;
  }, {} as Record<string, {
    from: string;
    to: string;
    transitions: number;
    users: number;
  }>);

  return Object.values(aggregated).sort((a, b) => b.transitions - a.transitions);
};

export const fetchPathNetworkData = async (days: number): Promise<PathNetworkEdge[]> => {
  const data = await loadTable<PathNetworkRow>('metrika_path_network', days);

  const aggregated = data.reduce((acc, curr) => {
    const key = `${curr.source_node}|||${curr.target_node}`;

    if (!acc[key]) {
      acc[key] = {
        source_id: curr.source_node,
        source_label: curr.source_node,
        source: curr.source_node,
        source_group: curr.source_group,
        source_order: curr.source_order,
        target_id: curr.target_node,
        target_label: curr.target_node,
        target: curr.target_node,
        target_group: curr.target_group,
        target_order: curr.target_order,
        transitions: 0,
        unique_sessions: 0,
        unique_users: 0,
        source_sessions: 0,
        source_users: 0,
        target_sessions: 0,
        target_users: 0,
        is_backward: false,
        is_self_loop: false,
      };
    }

    acc[key].transitions += curr.transitions || 0;
    acc[key].unique_sessions += curr.unique_sessions || 0;
    acc[key].unique_users += curr.unique_users || 0;
    acc[key].source_sessions += curr.source_sessions || 0;
    acc[key].source_users += curr.source_users || 0;
    acc[key].target_sessions += curr.target_sessions || 0;
    acc[key].target_users += curr.target_users || 0;
    acc[key].is_backward = acc[key].is_backward || Boolean(curr.is_backward);
    acc[key].is_self_loop = acc[key].is_self_loop || Boolean(curr.is_self_loop);
    return acc;
  }, {} as Record<string, Omit<PathNetworkEdge, 'session_share_from' | 'user_share_from'>>);

  return Object.values(aggregated)
    .map((item) => ({
      ...item,
      session_share_from: item.source_sessions > 0 ? item.unique_sessions / item.source_sessions : 0,
      user_share_from: item.source_users > 0 ? item.unique_users / item.source_users : 0,
    }))
    .sort((a, b) => b.transitions - a.transitions);
};

export const fetchPagePathNetworkData = async (days: number): Promise<PathNetworkEdge[]> => {
  const data = await loadTable<PagePathNetworkRow>('metrika_page_path_network', days);

  const aggregated = data.reduce((acc, curr) => {
    const key = `${curr.source_path}|||${curr.target_path}`;

    if (!acc[key]) {
      acc[key] = {
        source_id: curr.source_path,
        source_label: curr.source_title,
        source: curr.source_title,
        source_group: curr.source_group,
        source_order: curr.source_order,
        source_path: curr.source_path,
        source_kind: curr.source_kind,
        target_id: curr.target_path,
        target_label: curr.target_title,
        target: curr.target_title,
        target_group: curr.target_group,
        target_order: curr.target_order,
        target_path: curr.target_path,
        target_kind: curr.target_kind,
        transitions: 0,
        unique_sessions: 0,
        unique_users: 0,
        source_sessions: 0,
        source_users: 0,
        target_sessions: 0,
        target_users: 0,
        is_backward: false,
        is_self_loop: false,
      };
    }

    acc[key].transitions += curr.transitions || 0;
    acc[key].unique_sessions += curr.unique_sessions || 0;
    acc[key].unique_users += curr.unique_users || 0;
    acc[key].source_sessions += curr.source_sessions || 0;
    acc[key].source_users += curr.source_users || 0;
    acc[key].target_sessions += curr.target_sessions || 0;
    acc[key].target_users += curr.target_users || 0;
    acc[key].is_backward = acc[key].is_backward || Boolean(curr.is_backward);
    acc[key].is_self_loop = acc[key].is_self_loop || Boolean(curr.is_self_loop);
    return acc;
  }, {} as Record<string, Omit<PathNetworkEdge, 'session_share_from' | 'user_share_from'>>);

  return Object.values(aggregated)
    .map((item) => ({
      ...item,
      session_share_from: item.source_sessions > 0 ? item.unique_sessions / item.source_sessions : 0,
      user_share_from: item.source_users > 0 ? item.unique_users / item.source_users : 0,
    }))
    .sort((a, b) => b.transitions - a.transitions);
};

const getPageFamily = (edge: Pick<PathNetworkEdge, 'source_kind' | 'target_kind' | 'source_path' | 'target_path'>, side: 'source' | 'target') => {
  const kind = side === 'source' ? edge.source_kind : edge.target_kind;
  const path = side === 'source' ? edge.source_path : edge.target_path;

  if (kind === 'home') return 'Главная';
  if (kind === 'search') return 'Поиск';
  if (kind === 'product') return 'Товар';
  if (kind === 'seller') return 'Продавец';
  if (kind === 'cart') return 'Корзина';
  if (kind === 'checkout') return 'Чекаут';
  if (kind === 'account') return 'ЛК';
  if (kind === 'auth') return 'ЛК';
  if (kind === 'sale' || kind === 'promo') return 'Акции';

  if (kind === 'catalog') {
    if (path?.startsWith('/cat/hc/') || path?.startsWith('/cat/c/') || path?.startsWith('/cat/lc/')) {
      return 'Категория';
    }

    if (path?.startsWith('/cat/mc/') || path?.startsWith('/cat/sc/')) {
      return 'Подкатегория';
    }

    return 'Категория';
  }

  return 'Прочее';
};

const PAGE_FAMILY_ORDER: Record<string, number> = {
  Главная: 1,
  Поиск: 2,
  Категория: 3,
  Подкатегория: 4,
  Товар: 5,
  Продавец: 6,
  Корзина: 7,
  Чекаут: 8,
  ЛК: 9,
  Акции: 10,
  Прочее: 11,
};

export const fetchGroupedPagePathNetworkData = async (days: number): Promise<PathNetworkEdge[]> => {
  const data = await fetchPagePathNetworkData(days);

  const aggregated = data.reduce((acc, curr) => {
    const sourceFamily = getPageFamily(curr, 'source');
    const targetFamily = getPageFamily(curr, 'target');
    const key = `${sourceFamily}|||${targetFamily}`;

    if (!acc[key]) {
      acc[key] = {
        source_id: sourceFamily,
        source_label: sourceFamily,
        source: sourceFamily,
        source_group: sourceFamily,
        source_order: PAGE_FAMILY_ORDER[sourceFamily] ?? 99,
        target_id: targetFamily,
        target_label: targetFamily,
        target: targetFamily,
        target_group: targetFamily,
        target_order: PAGE_FAMILY_ORDER[targetFamily] ?? 99,
        transitions: 0,
        unique_sessions: 0,
        unique_users: 0,
        source_sessions: 0,
        source_users: 0,
        target_sessions: 0,
        target_users: 0,
        is_backward: false,
        is_self_loop: false,
      };
    }

    acc[key].transitions += curr.transitions || 0;
    acc[key].unique_sessions += curr.unique_sessions || 0;
    acc[key].unique_users += curr.unique_users || 0;
    acc[key].source_sessions += curr.source_sessions || 0;
    acc[key].source_users += curr.source_users || 0;
    acc[key].target_sessions += curr.target_sessions || 0;
    acc[key].target_users += curr.target_users || 0;
    acc[key].is_backward = acc[key].source_order > acc[key].target_order;
    acc[key].is_self_loop = sourceFamily === targetFamily;
    return acc;
  }, {} as Record<string, Omit<PathNetworkEdge, 'session_share_from' | 'user_share_from'>>);

  return Object.values(aggregated)
    .map((item) => ({
      ...item,
      session_share_from: item.source_sessions > 0 ? item.unique_sessions / item.source_sessions : 0,
      user_share_from: item.source_users > 0 ? item.unique_users / item.source_users : 0,
    }))
    .sort((a, b) => b.transitions - a.transitions);
};

export const fetchEcommerceData = async (days: number) => {
  const data = await loadTable<EcommerceRow>('metrika_ecommerce', days);

  return data.reduce((acc, curr) => {
    const key = curr.event_name;

    if (!acc[key]) {
      acc[key] = {
        event_name: curr.event_name,
        event_label: getFriendlyEventLabel(curr),
        event_group: curr.event_group || 'Прочее',
        label_source: curr.label_source || 'auto',
        needs_review: Boolean(curr.needs_review),
        event_count: 0,
        unique_users: 0,
        total_revenue: 0,
      };
    }

    acc[key].event_count += curr.event_count || 0;
    acc[key].unique_users += curr.unique_users || 0;
    acc[key].total_revenue += curr.total_revenue || 0;
    return acc;
  }, {} as Record<string, {
    event_name: string;
    event_label: string;
    event_group: string;
    label_source: string;
    needs_review: boolean;
    event_count: number;
    unique_users: number;
    total_revenue: number;
  }>);
};

export const fetchAuthFlowReport = async (days: number): Promise<AuthFlowReport> => {
  const [flowDaily, refererDaily, originPages, returnPages, summaryResponse] = await Promise.all([
    loadTable<AuthFlowDailyRow>('metrika_auth_flow_daily', days),
    loadTable<AuthReturnRefererDailyRow>('metrika_auth_return_referer_daily', days),
    loadTable<AuthOriginPageRow>('metrika_auth_origin_pages_daily', days),
    loadTable<AuthReturnPageRow>('metrika_auth_return_pages_daily', days),
    supabase
      .from('metrika_auth_flow_window_summary')
      .select('*')
      .eq('window_days', days)
      .order('anchor_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (summaryResponse.error) {
    throw new Error(`Failed to load metrika_auth_flow_window_summary: ${summaryResponse.error.message}`);
  }

  const dailyMap = new Map<string, AuthFlowDailyPoint>();

  flowDaily.forEach((row) => {
    dailyMap.set(row.date, {
      date: row.date,
      users_with_any_auth_hit: row.users_with_any_auth_hit || 0,
      sessions_with_any_auth_hit: row.sessions_with_any_auth_hit || 0,
      auth_hits_from_market: row.auth_hits_from_market || 0,
      auth_users_from_market: row.auth_users_from_market || 0,
      auth_sessions_from_market: row.auth_sessions_from_market || 0,
      returned_users_observed: row.returned_users_observed || 0,
      returned_sessions_observed: row.returned_sessions_observed || 0,
      return_users_from_auth_referer: 0,
      return_sessions_from_auth_referer: 0,
      return_hits_to_market: 0,
      return_rate_observed_users: row.return_rate_observed_users || 0,
      return_rate_observed_sessions: row.return_rate_observed_sessions || 0,
      avg_minutes_to_return: row.avg_minutes_to_return || 0,
    });
  });

  refererDaily.forEach((row) => {
    const existing = dailyMap.get(row.date) || {
      date: row.date,
      users_with_any_auth_hit: 0,
      sessions_with_any_auth_hit: 0,
      auth_hits_from_market: 0,
      auth_users_from_market: 0,
      auth_sessions_from_market: 0,
      returned_users_observed: 0,
      returned_sessions_observed: 0,
      return_users_from_auth_referer: 0,
      return_sessions_from_auth_referer: 0,
      return_hits_to_market: 0,
      return_rate_observed_users: 0,
      return_rate_observed_sessions: 0,
      avg_minutes_to_return: 0,
    };

    existing.return_users_from_auth_referer = row.return_users_from_auth_referer || 0;
    existing.return_sessions_from_auth_referer = row.return_sessions_from_auth_referer || 0;
    existing.return_hits_to_market = row.return_hits_to_market || 0;
    dailyMap.set(row.date, existing);
  });

  const aggregateOrigins = originPages.reduce((acc, row) => {
    const key = row.origin_path;
    if (!acc[key]) {
      acc[key] = {
        title: row.origin_title,
        path: row.origin_path,
        auth_users: 0,
        auth_sessions: 0,
        auth_hits: 0,
        label_source: row.label_source || 'auto',
      };
    }
    acc[key].auth_users += row.auth_users || 0;
    acc[key].auth_sessions += row.auth_sessions || 0;
    acc[key].auth_hits += row.auth_hits || 0;
    return acc;
  }, {} as Record<string, AuthOriginPageSummary>);

  const aggregateReturns = returnPages.reduce((acc, row) => {
    const key = row.landing_path;
    if (!acc[key]) {
      acc[key] = {
        title: row.landing_title,
        path: row.landing_path,
        return_users: 0,
        return_sessions: 0,
        return_hits: 0,
        label_source: row.label_source || 'auto',
      };
    }
    acc[key].return_users += row.return_users || 0;
    acc[key].return_sessions += row.return_sessions || 0;
    acc[key].return_hits += row.return_hits || 0;
    return acc;
  }, {} as Record<string, AuthReturnPageSummary>);

  const summary = summaryResponse.data
    ? {
        ...summaryResponse.data,
        avg_minutes_to_return: summaryResponse.data.avg_minutes_to_return || 0,
      }
    : null;

  return {
    summary,
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    topOriginPages: Object.values(aggregateOrigins).sort((a, b) => b.auth_sessions - a.auth_sessions),
    topReturnPages: Object.values(aggregateReturns).sort((a, b) => b.return_sessions - a.return_sessions),
  };
};
