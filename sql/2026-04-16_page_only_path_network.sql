create table if not exists public.metrika_page_path_network (
  date date not null,
  source_path text not null,
  source_title text not null,
  source_kind text not null,
  source_group text not null,
  source_order integer not null,
  target_path text not null,
  target_title text not null,
  target_kind text not null,
  target_group text not null,
  target_order integer not null,
  transitions integer not null,
  unique_sessions integer not null,
  unique_users integer not null,
  source_sessions integer not null,
  source_users integer not null,
  target_sessions integer not null,
  target_users integer not null,
  session_share_from double precision not null,
  user_share_from double precision not null,
  is_backward boolean not null default false,
  is_self_loop boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, source_path, target_path)
);

create index if not exists metrika_page_path_network_date_idx
  on public.metrika_page_path_network (date, transitions desc);

create index if not exists metrika_page_path_network_source_idx
  on public.metrika_page_path_network (source_path, date desc);

create index if not exists metrika_page_path_network_target_idx
  on public.metrika_page_path_network (target_path, date desc);

alter table public.metrika_page_path_network enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'metrika_page_path_network'
      and policyname = 'metrika_page_path_network_public_read'
  ) then
    create policy metrika_page_path_network_public_read
      on public.metrika_page_path_network
      for select
      using (true);
  end if;
end $$;

grant select on public.metrika_page_path_network to anon, authenticated;
grant all on public.metrika_page_path_network to service_role;

create or replace function private.page_kind_order(page_kind text)
returns integer
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case page_kind
    when 'home' then 1
    when 'search' then 2
    when 'catalog' then 3
    when 'sale' then 3
    when 'promo' then 3
    when 'product' then 4
    when 'seller' then 5
    when 'cart' then 6
    when 'checkout' then 7
    when 'account' then 8
    when 'auth' then 9
    when 'info' then 10
    else 11
  end;
$function$;

create or replace function private.refresh_metrika_page_path_network()
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  truncate table public.metrika_page_path_network;

  insert into public.metrika_page_path_network (
    date,
    source_path,
    source_title,
    source_kind,
    source_group,
    source_order,
    target_path,
    target_title,
    target_kind,
    target_group,
    target_order,
    transitions,
    unique_sessions,
    unique_users,
    source_sessions,
    source_users,
    target_sessions,
    target_users,
    session_share_from,
    user_share_from,
    is_backward,
    is_self_loop,
    updated_at
  )
  with normalized as (
    select
      s.date,
      s.client_id,
      s.session_id,
      s.event_time,
      coalesce(s.watch_id, '') as watch_id,
      coalesce(s.page_url, '') as page_url,
      s.page_path,
      coalesce(pl.display_name, private.default_page_label(s.page_path), s.page_path) as page_title,
      coalesce(pl.page_kind, private.default_page_kind(s.page_path)) as page_kind,
      coalesce(pl.page_group, private.default_page_group(s.page_path)) as page_group,
      private.page_kind_order(coalesce(pl.page_kind, private.default_page_kind(s.page_path))) as page_order
    from private.metrika_core_sessionized_v s
    left join public.metrika_page_labels pl
      on pl.path = s.page_path
    where s.is_page
      and s.page_path is not null
  ), ordered as (
    select
      n.date,
      n.client_id,
      n.session_id,
      n.page_path,
      n.page_title,
      n.page_kind,
      n.page_group,
      n.page_order,
      lag(n.page_path) over (
        partition by n.session_id
        order by n.event_time, n.watch_id, n.page_url
      ) as prev_page_path,
      lag(n.page_title) over (
        partition by n.session_id
        order by n.event_time, n.watch_id, n.page_url
      ) as prev_page_title,
      lag(n.page_kind) over (
        partition by n.session_id
        order by n.event_time, n.watch_id, n.page_url
      ) as prev_page_kind,
      lag(n.page_group) over (
        partition by n.session_id
        order by n.event_time, n.watch_id, n.page_url
      ) as prev_page_group,
      lag(n.page_order) over (
        partition by n.session_id
        order by n.event_time, n.watch_id, n.page_url
      ) as prev_page_order
    from normalized n
  ), node_totals as (
    select
      n.date,
      n.page_path,
      n.page_title,
      n.page_kind,
      n.page_group,
      n.page_order,
      count(distinct n.session_id)::integer as node_sessions,
      count(distinct n.client_id)::integer as node_users
    from normalized n
    group by
      n.date,
      n.page_path,
      n.page_title,
      n.page_kind,
      n.page_group,
      n.page_order
  ), edge_totals as (
    select
      o.date,
      o.prev_page_path as source_path,
      o.prev_page_title as source_title,
      o.prev_page_kind as source_kind,
      o.prev_page_group as source_group,
      o.prev_page_order as source_order,
      o.page_path as target_path,
      o.page_title as target_title,
      o.page_kind as target_kind,
      o.page_group as target_group,
      o.page_order as target_order,
      count(*)::integer as transitions,
      count(distinct o.session_id)::integer as unique_sessions,
      count(distinct o.client_id)::integer as unique_users
    from ordered o
    where o.prev_page_path is not null
      and o.page_path is not null
    group by
      o.date,
      o.prev_page_path,
      o.prev_page_title,
      o.prev_page_kind,
      o.prev_page_group,
      o.prev_page_order,
      o.page_path,
      o.page_title,
      o.page_kind,
      o.page_group,
      o.page_order
  )
  select
    e.date,
    e.source_path,
    e.source_title,
    e.source_kind,
    e.source_group,
    e.source_order,
    e.target_path,
    e.target_title,
    e.target_kind,
    e.target_group,
    e.target_order,
    e.transitions,
    e.unique_sessions,
    e.unique_users,
    coalesce(src.node_sessions, 0) as source_sessions,
    coalesce(src.node_users, 0) as source_users,
    coalesce(tgt.node_sessions, 0) as target_sessions,
    coalesce(tgt.node_users, 0) as target_users,
    coalesce(e.unique_sessions::double precision / nullif(src.node_sessions, 0), 0) as session_share_from,
    coalesce(e.unique_users::double precision / nullif(src.node_users, 0), 0) as user_share_from,
    e.source_order > e.target_order as is_backward,
    e.source_path = e.target_path as is_self_loop,
    now() as updated_at
  from edge_totals e
  left join node_totals src
    on src.date = e.date and src.page_path = e.source_path
  left join node_totals tgt
    on tgt.date = e.date and tgt.page_path = e.target_path
  order by e.date, e.transitions desc;
end;
$function$;

create or replace function private.refresh_metrika_aggregates()
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  perform private.refresh_metrika_aggregates_base();
  perform private.refresh_metrika_path_network();
  perform private.refresh_metrika_page_path_network();
  perform private.refresh_metrika_auth_report();
end;
$function$;
