create or replace view private.metrika_auth_hits_v as
select
  (h.event_time)::date as date,
  h.event_time,
  h.client_id,
  h.watch_id,
  h.page_url,
  h.referer,
  private.extract_host(h.page_url) as host,
  private.extract_path(h.page_url) as page_path
from public.yandex_metrika_hits h
where (h.page_url like 'http://%' or h.page_url like 'https://%')
  and private.extract_host(h.page_url) in ('market.05.ru', 'id.05.ru');

create or replace view private.metrika_auth_sessionized_v as
with ordered as (
  select
    h.date,
    h.event_time,
    h.client_id,
    h.watch_id,
    h.page_url,
    h.referer,
    h.host,
    h.page_path,
    lag(h.event_time) over (
      partition by h.client_id
      order by h.event_time, coalesce(h.watch_id, ''), h.page_url
    ) as prev_event_time
  from private.metrika_auth_hits_v h
),
flagged as (
  select
    o.*,
    case
      when o.prev_event_time is null
        or o.event_time - o.prev_event_time > interval '30 minutes'
        then 1
      else 0
    end as new_session_flag
  from ordered o
),
numbered as (
  select
    f.*,
    sum(f.new_session_flag) over (
      partition by f.client_id
      order by f.event_time, coalesce(f.watch_id, ''), f.page_url
      rows between unbounded preceding and current row
    ) as session_seq
  from flagged f
)
select
  n.date,
  n.event_time,
  n.client_id,
  n.watch_id,
  n.page_url,
  n.referer,
  n.host,
  n.page_path,
  n.prev_event_time,
  n.new_session_flag,
  n.session_seq,
  n.client_id || ':' || n.session_seq::text as session_id
from numbered n;

create table if not exists public.metrika_auth_flow_daily (
  date date primary key,
  users_with_any_auth_hit integer not null default 0,
  sessions_with_any_auth_hit integer not null default 0,
  auth_hits_from_market integer not null default 0,
  auth_users_from_market integer not null default 0,
  auth_sessions_from_market integer not null default 0,
  returned_users_observed integer not null default 0,
  returned_sessions_observed integer not null default 0,
  return_rate_observed_users double precision not null default 0,
  return_rate_observed_sessions double precision not null default 0,
  avg_minutes_to_return double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.metrika_auth_return_referer_daily (
  date date primary key,
  return_hits_to_market integer not null default 0,
  return_users_from_auth_referer integer not null default 0,
  return_sessions_from_auth_referer integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.metrika_auth_flow_window_summary (
  anchor_date date not null,
  window_days integer not null,
  users_with_any_auth_hit integer not null default 0,
  sessions_with_any_auth_hit integer not null default 0,
  auth_hits_from_market integer not null default 0,
  auth_users_from_market integer not null default 0,
  auth_sessions_from_market integer not null default 0,
  returned_users_observed integer not null default 0,
  returned_sessions_observed integer not null default 0,
  return_users_from_auth_referer integer not null default 0,
  return_sessions_from_auth_referer integer not null default 0,
  return_hits_to_market integer not null default 0,
  return_rate_observed_users double precision not null default 0,
  return_rate_observed_sessions double precision not null default 0,
  avg_minutes_to_return double precision,
  updated_at timestamptz not null default now(),
  primary key (anchor_date, window_days)
);

create table if not exists public.metrika_auth_origin_pages_daily (
  date date not null,
  origin_path text not null,
  origin_title text not null,
  auth_users integer not null default 0,
  auth_sessions integer not null default 0,
  auth_hits integer not null default 0,
  label_source text not null default 'auto',
  updated_at timestamptz not null default now(),
  primary key (date, origin_path)
);

create table if not exists public.metrika_auth_return_pages_daily (
  date date not null,
  landing_path text not null,
  landing_title text not null,
  return_users integer not null default 0,
  return_sessions integer not null default 0,
  return_hits integer not null default 0,
  label_source text not null default 'auto',
  updated_at timestamptz not null default now(),
  primary key (date, landing_path)
);

create index if not exists metrika_auth_origin_pages_daily_date_idx
  on public.metrika_auth_origin_pages_daily (date, auth_sessions desc);

create index if not exists metrika_auth_return_pages_daily_date_idx
  on public.metrika_auth_return_pages_daily (date, return_sessions desc);

alter table public.metrika_auth_flow_daily enable row level security;
alter table public.metrika_auth_return_referer_daily enable row level security;
alter table public.metrika_auth_flow_window_summary enable row level security;
alter table public.metrika_auth_origin_pages_daily enable row level security;
alter table public.metrika_auth_return_pages_daily enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'metrika_auth_flow_daily'
      and policyname = 'metrika_auth_flow_daily_public_read'
  ) then
    create policy metrika_auth_flow_daily_public_read
      on public.metrika_auth_flow_daily
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'metrika_auth_return_referer_daily'
      and policyname = 'metrika_auth_return_referer_daily_public_read'
  ) then
    create policy metrika_auth_return_referer_daily_public_read
      on public.metrika_auth_return_referer_daily
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'metrika_auth_flow_window_summary'
      and policyname = 'metrika_auth_flow_window_summary_public_read'
  ) then
    create policy metrika_auth_flow_window_summary_public_read
      on public.metrika_auth_flow_window_summary
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'metrika_auth_origin_pages_daily'
      and policyname = 'metrika_auth_origin_pages_daily_public_read'
  ) then
    create policy metrika_auth_origin_pages_daily_public_read
      on public.metrika_auth_origin_pages_daily
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'metrika_auth_return_pages_daily'
      and policyname = 'metrika_auth_return_pages_daily_public_read'
  ) then
    create policy metrika_auth_return_pages_daily_public_read
      on public.metrika_auth_return_pages_daily
      for select
      using (true);
  end if;
end $$;

grant select on public.metrika_auth_flow_daily to anon, authenticated;
grant select on public.metrika_auth_return_referer_daily to anon, authenticated;
grant select on public.metrika_auth_flow_window_summary to anon, authenticated;
grant select on public.metrika_auth_origin_pages_daily to anon, authenticated;
grant select on public.metrika_auth_return_pages_daily to anon, authenticated;
grant all on public.metrika_auth_flow_daily to service_role;
grant all on public.metrika_auth_return_referer_daily to service_role;
grant all on public.metrika_auth_flow_window_summary to service_role;
grant all on public.metrika_auth_origin_pages_daily to service_role;
grant all on public.metrika_auth_return_pages_daily to service_role;

create or replace function private.refresh_metrika_auth_report()
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  truncate table
    public.metrika_auth_flow_daily,
    public.metrika_auth_return_referer_daily,
    public.metrika_auth_flow_window_summary,
    public.metrika_auth_origin_pages_daily,
    public.metrika_auth_return_pages_daily;

  create temporary table tmp_auth_ordered
  on commit drop
  as
  select
    s.*,
    row_number() over (
      partition by s.session_id
      order by s.event_time, coalesce(s.watch_id, ''), s.page_url
    ) as seq
  from private.metrika_auth_sessionized_v s;

  create index tmp_auth_ordered_session_seq_idx on tmp_auth_ordered (session_id, seq);
  create index tmp_auth_ordered_date_host_idx on tmp_auth_ordered (date, host);
  create index tmp_auth_ordered_host_referer_idx on tmp_auth_ordered (host, referer);

  create temporary table tmp_auth_with_origin
  on commit drop
  as
  select
    a.date as auth_date,
    a.client_id,
    a.session_id,
    a.seq as auth_seq,
    a.event_time as auth_time,
    origin.page_path as origin_path
  from tmp_auth_ordered a
  join lateral (
    select o.page_path
    from tmp_auth_ordered o
    where o.session_id = a.session_id
      and o.seq < a.seq
      and o.host = 'market.05.ru'
    order by o.seq desc
    limit 1
  ) origin on true
  where a.host = 'id.05.ru';

  create index tmp_auth_with_origin_date_idx on tmp_auth_with_origin (auth_date);
  create index tmp_auth_with_origin_session_idx on tmp_auth_with_origin (session_id, auth_seq);

  create temporary table tmp_first_auth
  on commit drop
  as
  select distinct on (a.session_id)
    a.auth_date,
    a.client_id,
    a.session_id,
    a.auth_seq,
    a.auth_time,
    a.origin_path
  from tmp_auth_with_origin a
  order by a.session_id, a.auth_seq;

  create index tmp_first_auth_date_idx on tmp_first_auth (auth_date);
  create index tmp_first_auth_session_idx on tmp_first_auth (session_id, auth_seq);

  create temporary table tmp_first_return
  on commit drop
  as
  select
    fa.auth_date,
    fa.client_id,
    fa.session_id,
    fa.auth_time,
    fa.origin_path,
    ret.date as return_date,
    ret.event_time as return_time,
    ret.page_path as landing_path
  from tmp_first_auth fa
  left join lateral (
    select o.date, o.event_time, o.page_path
    from tmp_auth_ordered o
    where o.session_id = fa.session_id
      and o.seq > fa.auth_seq
      and o.host = 'market.05.ru'
    order by o.seq
    limit 1
  ) ret on true;

  create index tmp_first_return_auth_date_idx on tmp_first_return (auth_date);
  create index tmp_first_return_return_date_idx on tmp_first_return (return_date);

  with any_auth as (
    select
      o.date,
      count(distinct o.client_id)::integer as users_with_any_auth_hit,
      count(distinct o.session_id)::integer as sessions_with_any_auth_hit
    from tmp_auth_ordered o
    where o.host = 'id.05.ru'
    group by o.date
  ),
  auth_hits_from_market as (
    select
      a.auth_date as date,
      count(*)::integer as auth_hits_from_market,
      count(distinct a.client_id)::integer as auth_users_from_market,
      count(distinct a.session_id)::integer as auth_sessions_from_market
    from tmp_auth_with_origin a
    group by a.auth_date
  ),
  observed_returns as (
    select
      fr.auth_date as date,
      count(distinct fr.client_id) filter (where fr.return_time is not null)::integer as returned_users_observed,
      count(distinct fr.session_id) filter (where fr.return_time is not null)::integer as returned_sessions_observed,
      avg(extract(epoch from (fr.return_time - fr.auth_time)) / 60.0)
        filter (where fr.return_time is not null)::double precision as avg_minutes_to_return
    from tmp_first_return fr
    group by fr.auth_date
  ),
  flow_dates as (
    select date from any_auth
    union
    select date from auth_hits_from_market
    union
    select date from observed_returns
  )
  insert into public.metrika_auth_flow_daily (
    date,
    users_with_any_auth_hit,
    sessions_with_any_auth_hit,
    auth_hits_from_market,
    auth_users_from_market,
    auth_sessions_from_market,
    returned_users_observed,
    returned_sessions_observed,
    return_rate_observed_users,
    return_rate_observed_sessions,
    avg_minutes_to_return,
    updated_at
  )
  select
    d.date,
    coalesce(aa.users_with_any_auth_hit, 0),
    coalesce(aa.sessions_with_any_auth_hit, 0),
    coalesce(ah.auth_hits_from_market, 0),
    coalesce(ah.auth_users_from_market, 0),
    coalesce(ah.auth_sessions_from_market, 0),
    coalesce(orx.returned_users_observed, 0),
    coalesce(orx.returned_sessions_observed, 0),
    coalesce(orx.returned_users_observed::double precision / nullif(ah.auth_users_from_market, 0), 0),
    coalesce(orx.returned_sessions_observed::double precision / nullif(ah.auth_sessions_from_market, 0), 0),
    orx.avg_minutes_to_return,
    now()
  from flow_dates d
  left join any_auth aa using (date)
  left join auth_hits_from_market ah using (date)
  left join observed_returns orx using (date)
  order by d.date;

  insert into public.metrika_auth_return_referer_daily (
    date,
    return_hits_to_market,
    return_users_from_auth_referer,
    return_sessions_from_auth_referer,
    updated_at
  )
  select
    o.date,
    count(*)::integer as return_hits_to_market,
    count(distinct o.client_id)::integer as return_users_from_auth_referer,
    count(distinct o.session_id)::integer as return_sessions_from_auth_referer,
    now()
  from tmp_auth_ordered o
  where o.host = 'market.05.ru'
    and coalesce(o.referer, '') ilike '%id.05.ru%'
  group by o.date
  order by o.date;

  with anchor as (
    select max(date) as anchor_date
    from tmp_auth_ordered
  ),
  windows as (
    select
      a.anchor_date,
      w.window_days,
      (a.anchor_date - (w.window_days - 1))::date as start_date
    from anchor a
    cross join (values (7), (14), (30)) as w(window_days)
  )
  insert into public.metrika_auth_flow_window_summary (
    anchor_date,
    window_days,
    users_with_any_auth_hit,
    sessions_with_any_auth_hit,
    auth_hits_from_market,
    auth_users_from_market,
    auth_sessions_from_market,
    returned_users_observed,
    returned_sessions_observed,
    return_users_from_auth_referer,
    return_sessions_from_auth_referer,
    return_hits_to_market,
    return_rate_observed_users,
    return_rate_observed_sessions,
    avg_minutes_to_return,
    updated_at
  )
  select
    w.anchor_date,
    w.window_days,
    coalesce((
      select count(distinct o.client_id)::integer
      from tmp_auth_ordered o
      where o.host = 'id.05.ru'
        and o.date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(distinct o.session_id)::integer
      from tmp_auth_ordered o
      where o.host = 'id.05.ru'
        and o.date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(*)::integer
      from tmp_auth_with_origin a
      where a.auth_date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(distinct fa.client_id)::integer
      from tmp_first_auth fa
      where fa.auth_date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(*)::integer
      from tmp_first_auth fa
      where fa.auth_date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(distinct fr.client_id)::integer
      from tmp_first_return fr
      where fr.auth_date between w.start_date and w.anchor_date
        and fr.return_time is not null
    ), 0),
    coalesce((
      select count(*)::integer
      from tmp_first_return fr
      where fr.auth_date between w.start_date and w.anchor_date
        and fr.return_time is not null
    ), 0),
    coalesce((
      select count(distinct o.client_id)::integer
      from tmp_auth_ordered o
      where o.host = 'market.05.ru'
        and coalesce(o.referer, '') ilike '%id.05.ru%'
        and o.date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(distinct o.session_id)::integer
      from tmp_auth_ordered o
      where o.host = 'market.05.ru'
        and coalesce(o.referer, '') ilike '%id.05.ru%'
        and o.date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(*)::integer
      from tmp_auth_ordered o
      where o.host = 'market.05.ru'
        and coalesce(o.referer, '') ilike '%id.05.ru%'
        and o.date between w.start_date and w.anchor_date
    ), 0),
    coalesce((
      select count(distinct fr.client_id)::double precision
      from tmp_first_return fr
      where fr.auth_date between w.start_date and w.anchor_date
        and fr.return_time is not null
    ) / nullif((
      select count(distinct fa.client_id)::double precision
      from tmp_first_auth fa
      where fa.auth_date between w.start_date and w.anchor_date
    ), 0), 0),
    coalesce((
      select count(*)::double precision
      from tmp_first_return fr
      where fr.auth_date between w.start_date and w.anchor_date
        and fr.return_time is not null
    ) / nullif((
      select count(*)::double precision
      from tmp_first_auth fa
      where fa.auth_date between w.start_date and w.anchor_date
    ), 0), 0),
    (
      select avg(extract(epoch from (fr.return_time - fr.auth_time)) / 60.0)::double precision
      from tmp_first_return fr
      where fr.auth_date between w.start_date and w.anchor_date
        and fr.return_time is not null
    ),
    now()
  from windows w;

  insert into public.metrika_auth_origin_pages_daily (
    date,
    origin_path,
    origin_title,
    auth_users,
    auth_sessions,
    auth_hits,
    label_source,
    updated_at
  )
  select
    fa.auth_date as date,
    fa.origin_path,
    coalesce(pl.display_name, private.default_page_label(fa.origin_path), fa.origin_path) as origin_title,
    count(distinct fa.client_id)::integer as auth_users,
    count(distinct fa.session_id)::integer as auth_sessions,
    count(*)::integer as auth_hits,
    coalesce(pl.source, 'auto') as label_source,
    now()
  from tmp_first_auth fa
  left join public.metrika_page_labels pl
    on pl.path = fa.origin_path
  group by fa.auth_date, fa.origin_path, origin_title, label_source
  order by fa.auth_date, auth_sessions desc;

  insert into public.metrika_auth_return_pages_daily (
    date,
    landing_path,
    landing_title,
    return_users,
    return_sessions,
    return_hits,
    label_source,
    updated_at
  )
  select
    fr.return_date as date,
    fr.landing_path,
    coalesce(pl.display_name, private.default_page_label(fr.landing_path), fr.landing_path) as landing_title,
    count(distinct fr.client_id)::integer as return_users,
    count(distinct fr.session_id)::integer as return_sessions,
    count(*)::integer as return_hits,
    coalesce(pl.source, 'auto') as label_source,
    now()
  from tmp_first_return fr
  left join public.metrika_page_labels pl
    on pl.path = fr.landing_path
  where fr.return_date is not null
    and fr.landing_path is not null
  group by fr.return_date, fr.landing_path, landing_title, label_source
  order by fr.return_date, return_sessions desc;
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
  perform private.refresh_metrika_auth_report();
end;
$function$;
