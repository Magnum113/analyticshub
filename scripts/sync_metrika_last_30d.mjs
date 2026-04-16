import fs from 'node:fs';
import process from 'node:process';
import { Client } from 'pg';

process.env.NO_PROXY = '*';

const LOGS_HIT_FIELDS = [
  'ym:pv:dateTime',
  'ym:pv:clientID',
  'ym:pv:watchID',
  'ym:pv:URL',
  'ym:pv:referer',
  'ym:pv:UTMSource',
  'ym:pv:UTMMedium',
  'ym:pv:UTMCampaign',
];

const REPORT_VISIT_DIMENSIONS = [
  'ym:s:date',
  'ym:s:startURL',
  'ym:s:endURL',
  'ym:s:referer',
  'ym:s:lastTrafficSource',
  'ym:s:lastSearchEngineRoot',
  'ym:s:deviceCategory',
];

const REPORT_VISIT_METRICS = [
  'ym:s:visits',
  'ym:s:pageviews',
];

function loadEnv(path = '.env') {
  const values = {};
  for (const rawLine of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    values[line.slice(0, eqIndex)] = line.slice(eqIndex + 1);
  }
  return values;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) {
      continue;
    }
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getDateRange({ days, dateFrom, dateTo }) {
  const today = new Date();
  const defaultEnd = addDays(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())), -1);
  const endDate = dateTo ? new Date(`${dateTo}T00:00:00Z`) : defaultEnd;
  const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00Z`) : addDays(endDate, -(Number(days) - 1));
  const dates = [];
  for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
    dates.push(formatDate(cursor));
  }
  return {
    dateFrom: formatDate(startDate),
    dateTo: formatDate(endDate),
    dates,
  };
}

async function yandexRequest(url, options = {}, attempt = 1) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    if (attempt < 4 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      return yandexRequest(url, options, attempt + 1);
    }
    throw new Error(`Yandex API ${response.status}: ${body}`);
  }
  return response;
}

async function createLogRequest({ counterId, token, source, dateFrom, dateTo }) {
  const params = new URLSearchParams({
    date1: dateFrom,
    date2: dateTo,
    source,
    fields: LOGS_HIT_FIELDS.join(','),
  });
  const response = await yandexRequest(
    `https://api-metrika.yandex.net/management/v1/counter/${counterId}/logrequests?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${token}`,
      },
    }
  );
  const payload = await response.json();
  return payload.log_request.request_id;
}

async function waitForLogRequest({ counterId, token, requestId }) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await yandexRequest(
      `https://api-metrika.yandex.net/management/v1/counter/${counterId}/logrequest/${requestId}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
      }
    );
    const payload = await response.json();
    const request = payload.log_request;
    if (request.status === 'processed') {
      return request;
    }
    if (request.status === 'canceled') {
      throw new Error(`Log request ${requestId} was canceled`);
    }
    if (attempt % 10 === 0) {
      console.log(`  log request ${requestId} status: ${request.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Timed out waiting for log request ${requestId}`);
}

async function cleanLogRequest({ counterId, token, requestId }) {
  await yandexRequest(
    `https://api-metrika.yandex.net/management/v1/counter/${counterId}/logrequest/${requestId}/clean`,
    {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${token}`,
      },
    }
  );
}

function parseTsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }
  const headers = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cols = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    return row;
  });
}

async function downloadLogRows({ counterId, token, requestId, parts }) {
  const rows = [];
  for (const part of parts) {
    const response = await yandexRequest(
      `https://api-metrika.yandex.net/management/v1/counter/${counterId}/logrequest/${requestId}/part/${part.part_number}/download`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
      }
    );
    const text = await response.text();
    for (const row of parseTsv(text)) {
      rows.push(row);
    }
  }
  return rows;
}

async function fetchVisitRows({ counterId, token, dateFrom, dateTo }) {
  let offset = 1;
  const limit = 100000;
  const rows = [];

  while (true) {
    const params = new URLSearchParams({
      ids: counterId,
      date1: dateFrom,
      date2: dateTo,
      dimensions: REPORT_VISIT_DIMENSIONS.join(','),
      metrics: REPORT_VISIT_METRICS.join(','),
      accuracy: 'full',
      limit: String(limit),
      offset: String(offset),
    });
    const response = await yandexRequest(
      `https://api-metrika.yandex.net/stat/v1/data?${params.toString()}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
      }
    );
    const payload = await response.json();
    const chunk = (payload.data || []).map((item) => ({
      visit_date: item.dimensions?.[0]?.name ?? '',
      start_url: item.dimensions?.[1]?.name ?? '',
      end_url: item.dimensions?.[2]?.name ?? '',
      referer: item.dimensions?.[3]?.name ?? '',
      traffic_source: item.dimensions?.[4]?.name ?? '',
      source_engine: item.dimensions?.[5]?.name ?? null,
      device: item.dimensions?.[6]?.name ?? '',
      visits: Math.round(Number(item.metrics?.[0] ?? 0)),
      pageviews: Math.round(Number(item.metrics?.[1] ?? 0)),
    }));

    rows.push(...chunk);

    if (chunk.length < limit) {
      break;
    }
    offset += limit;
  }

  return rows;
}

function dedupeHitRows(rows) {
  const byWatchId = new Map();
  for (const row of rows) {
    const watchId = row['ym:pv:watchID'];
    if (!watchId) {
      continue;
    }
    byWatchId.set(watchId, {
      event_time: row['ym:pv:dateTime'].replace(' ', 'T') + '+00:00',
      client_id: row['ym:pv:clientID'] || '',
      watch_id: watchId,
      page_url: row['ym:pv:URL'] || '',
      referer: row['ym:pv:referer'] || '',
      utm_source: row['ym:pv:UTMSource'] || '',
      utm_medium: row['ym:pv:UTMMedium'] || '',
      utm_campaign: row['ym:pv:UTMCampaign'] || '',
    });
  }
  return Array.from(byWatchId.values());
}

function groupRowsByDate(rows, dateField) {
  const grouped = new Map();
  for (const row of rows) {
    const raw = row[dateField];
    if (!raw) {
      continue;
    }
    const date = raw.slice(0, 10);
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date).push(row);
  }
  return grouped;
}

async function insertHitsForDay(client, date, rows) {
  await client.query('begin');
  try {
    await client.query(
      `delete from public.yandex_metrika_hits where event_time::date = $1::date`,
      [date]
    );

    const chunkSize = 500;
    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      const values = [];
      const params = [];

      chunk.forEach((row, index) => {
        const base = index * 8;
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`
        );
        params.push(
          row.event_time,
          row.client_id,
          row.watch_id,
          row.page_url,
          row.referer,
          row.utm_source,
          row.utm_medium,
          row.utm_campaign
        );
      });

      await client.query(
        `
          insert into public.yandex_metrika_hits (
            event_time,
            client_id,
            watch_id,
            page_url,
            referer,
            utm_source,
            utm_medium,
            utm_campaign
          )
          values ${values.join(',')}
          on conflict (watch_id) do update
          set
            event_time = excluded.event_time,
            client_id = excluded.client_id,
            page_url = excluded.page_url,
            referer = excluded.referer,
            utm_source = excluded.utm_source,
            utm_medium = excluded.utm_medium,
            utm_campaign = excluded.utm_campaign
        `,
        params
      );
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function insertVisitsForDay(client, date, rows) {
  await client.query('begin');
  try {
    await client.query(
      `delete from public.yandex_metrika_visits where visit_date = $1::date`,
      [date]
    );

    const chunkSize = 400;
    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      await client.query(
        `
          insert into public.yandex_metrika_visits (
            visit_date,
            start_url,
            end_url,
            referer,
            traffic_source,
            source_engine,
            device,
            visits,
            pageviews
          )
          values ${chunk.map((_, index) => {
            const base = index * 9;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
          }).join(',')}
          on conflict (visit_date, start_url, end_url, referer, traffic_source, source_engine, device) do update
          set
            visits = excluded.visits,
            pageviews = excluded.pageviews
        `,
        chunk.flatMap((row) => [
          row.visit_date,
          row.start_url,
          row.end_url,
          row.referer,
          row.traffic_source,
          row.source_engine,
          row.device,
          row.visits,
          row.pageviews,
        ])
      );
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function main() {
  const env = loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const { dateFrom, dateTo, dates } = getDateRange({
    days: args.days || '30',
    dateFrom: args['date-from'],
    dateTo: args['date-to'],
  });

  const projectRef = env.SUPABASE_PROJECT_REF;
  const dbUser = `postgres.${projectRef}`;
  const connectionString = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${env.SUPABASE_DB_HOST}:5432/postgres`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const summary = {
    range: { dateFrom, dateTo },
    hits: {},
    visits: {},
  };

  try {
    console.log(`[hits] ${dateFrom}..${dateTo}`);
    const hitRequestId = await createLogRequest({
      counterId: env.YANDEX_METRIKA_COUNTER_ID,
      token: env.YANDEX_METRIKA_TOKEN,
      source: 'hits',
      dateFrom,
      dateTo,
    });
    const hitRequest = await waitForLogRequest({
      counterId: env.YANDEX_METRIKA_COUNTER_ID,
      token: env.YANDEX_METRIKA_TOKEN,
      requestId: hitRequestId,
    });
    const rawHitRows = await downloadLogRows({
      counterId: env.YANDEX_METRIKA_COUNTER_ID,
      token: env.YANDEX_METRIKA_TOKEN,
      requestId: hitRequestId,
      parts: hitRequest.parts || [],
    });
    const hitRowsByDate = groupRowsByDate(dedupeHitRows(rawHitRows), 'event_time');

    for (const date of dates) {
      const rows = hitRowsByDate.get(date) || [];
      await insertHitsForDay(client, date, rows);
      summary.hits[date] = rows.length;
      console.log(`  inserted ${rows.length} hits for ${date}`);
    }
    await cleanLogRequest({
      counterId: env.YANDEX_METRIKA_COUNTER_ID,
      token: env.YANDEX_METRIKA_TOKEN,
      requestId: hitRequestId,
    });

    console.log(`[visits] ${dateFrom}..${dateTo}`);
    const visitRowsByDate = groupRowsByDate(
      await fetchVisitRows({
        counterId: env.YANDEX_METRIKA_COUNTER_ID,
        token: env.YANDEX_METRIKA_TOKEN,
        dateFrom,
        dateTo,
      }),
      'visit_date'
    );

    for (const date of dates) {
      const rows = visitRowsByDate.get(date) || [];
      await insertVisitsForDay(client, date, rows);
      summary.visits[date] = rows.length;
      console.log(`  inserted ${rows.length} visit groups for ${date}`);
    }

    await client.query('select private.refresh_metrika_aggregates()');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
