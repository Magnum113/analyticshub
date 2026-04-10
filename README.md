# 05.ru Аналитика

Дашборд веб-аналитики маркетплейса [market.05.ru](https://market.05.ru) на данных Яндекс.Метрики.

**Стек:** React 18 + Vite + TypeScript + Tailwind CSS + Recharts + Nivo  
**Данные:** Яндекс.Метрика → Supabase (PostgreSQL) → Static JSON → Frontend  
**Деплой:** `http://89.111.152.112:4173`

---

## Архитектура

```
Яндекс.Метрика (счётчик 96470864)
        │
        ├─ Logs API (сырые хиты)      → fetch_metrika_fast.py
        └─ Reporting API (агрегаты)    → fetch_metrika.py
                │
        Supabase (PostgreSQL)
        ├─ yandex_metrika_hits    (сырые просмотры/события)
        └─ yandex_metrika_visits  (агрегированные визиты)
                │
        export_metrika_json.py
                │
        public/data/*.json  (статические файлы)
                │
        React Frontend (fetch → визуализация)
```

**Почему статические JSON, а не прямой Supabase из браузера?**  
Supabase service_role key нельзя использовать в клиентском коде — он даёт полный доступ к БД. Поэтому данные экспортируются в JSON через серверный скрипт.

---

## Структура проекта

```
├── src/
│   ├── App.tsx                    # Роутинг, сайдбар, выбор периода
│   ├── data/
│   │   ├── dataService.ts         # Загрузка JSON, агрегация, фильтрация по дням
│   │   ├── supabaseClient.ts      # (legacy, не используется во фронте)
│   │   └── mockGenerator.ts       # (legacy, для тестов)
│   ├── pages/
│   │   ├── SummaryDashboard.tsx    # Обзор: сессии, юзеры, просмотры
│   │   ├── FunnelChart.tsx         # Воронка продаж (5 шагов)
│   │   ├── UserPathExplorer.tsx    # 🗺️ Карта путей (Sankey, @nivo/sankey)
│   │   ├── DropOffAnalysis.tsx     # Анализ уходов
│   │   ├── DeviceComparison.tsx    # Устройства
│   │   ├── TrafficSourceAnalysis.tsx # Источники трафика
│   │   └── SearchBehavior.tsx      # Поиск на сайте
│   ├── components/                 # Переиспользуемые UI-компоненты
│   └── utils/                      # Утилиты
├── public/
│   └── data/                       # Статические JSON (генерируются скриптами)
│       ├── metrika_daily_metrics.json
│       ├── metrika_sankey.json     # Переходы между разделами для Sankey
│       ├── metrika_funnel_daily.json
│       ├── metrika_pages.json
│       ├── metrika_traffic_sources.json
│       ├── metrika_devices.json
│       ├── metrika_ecommerce.json
│       └── metrika_search_terms.json
├── dist/                           # Продакшн-билд (npx vite build)
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.cjs
├── tsconfig.json
└── README.md                       # ← этот файл
```

---

## Скрипты синхронизации данных

Все скрипты лежат в **`~/.openclaw/workspace/scripts/`** (воркспейс OpenClaw, НЕ в этом репозитории).

| Скрипт | Что делает | Когда запускать |
|--------|-----------|-----------------|
| `fetch_metrika_fast.py` | Logs API → сырые хиты в `yandex_metrika_hits` | Ежедневно, после полуночи |
| `fetch_metrika.py` | Reporting API → агрегаты в `yandex_metrika_visits` | Ежедневно, после полуночи |
| `export_metrika_json.py` | Supabase → JSON в `public/data/` | После каждой синхронизации |

### Полный цикл обновления данных

```bash
# 1. Загрузить сырые хиты за вчера (Logs API)
NO_PROXY='*' python3 ~/.openclaw/workspace/scripts/fetch_metrika_fast.py

# 2. Загрузить агрегаты (Reporting API)  
NO_PROXY='*' python3 ~/.openclaw/workspace/scripts/fetch_metrika.py

# 3. Экспортировать в JSON
NO_PROXY='*' python3 ~/.openclaw/workspace/scripts/export_metrika_json.py

# 4. Пересобрать фронтенд
cd ~/projects/ga4-funnels && npx vite build

# 5. Перезапустить сервер
pkill -f "vite preview"; npx vite preview --host 0.0.0.0 --port 4173 &
```

> ⚠️ **`NO_PROXY='*'`** обязательно — на сервере стоит прокси (`HTTPS_PROXY`), который ломает скачивание данных из Logs API.

---

## База данных (Supabase)

**Проект:** `fdllflsajnruoenucgkg` (EU West 1)  
**URL:** `https://fdllflsajnruoenucgkg.supabase.co`  
**Pooler:** `aws-0-eu-west-1.pooler.supabase.com:5432`  
**User:** `postgres.fdllflsajnruoenucgkg`

### Таблицы

#### `yandex_metrika_hits` (~120K записей за 7 дней)
Сырые просмотры страниц и события из Logs API.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | bigint | PK, auto-increment |
| `event_time` | timestamptz | Время события |
| `client_id` | text | ID пользователя (cookie Метрики) |
| `watch_id` | text | UNIQUE, ID хита |
| `page_url` | text | URL страницы или `goal://...` (событие) |
| `referer` | text | Откуда пришёл |
| `utm_source` | text | UTM-метка |
| `utm_medium` | text | UTM-метка |
| `utm_campaign` | text | UTM-метка |

**Индекс:** `idx_metrika_client_time` на `(client_id, event_time)` — для построения путей пользователей.

**Формат событий в `page_url`:**
- Обычные страницы: `https://market.05.ru/cat/...`
- Цели (events): `goal://market.05.ru/view_item_nn`, `goal://market.05.ru/add_to_cart_nn` и т.д.

#### `yandex_metrika_visits` (~150 записей за 7 дней)
Агрегированные визиты из Reporting API.

| Поле | Тип | Описание |
|------|-----|----------|
| `visit_date` | date | Дата |
| `start_url` | text | Первая страница визита |
| `end_url` | text | Последняя страница визита |
| `referer` | text | Источник |
| `traffic_source` | text | Канал трафика (Direct, Search, Ad, Link) |
| `source_engine` | text | Конкретный источник (yandex, google...) |
| `device` | text | Тип устройства (Smartphones, PC) |
| `visits` | integer | Кол-во визитов |
| `pageviews` | integer | Кол-во просмотров |

---

## API и ключи

Все ключи хранятся в **`~/.openclaw/workspace/.env`**.

### Яндекс.Метрика

| Переменная | Описание |
|-----------|----------|
| `YANDEX_METRIKA_COUNTER_ID` | ID счётчика (`96470864`) |
| `YANDEX_METRIKA_TOKEN` | OAuth-токен (срок: 1 год с 10.04.2026) |
| `YANDEX_METRIKA_CLIENT_ID` | ID OAuth-приложения |
| `YANDEX_METRIKA_CLIENT_SECRET` | Secret OAuth-приложения |

**API endpoints:**
- Список запросов: `GET https://api-metrika.yandex.net/management/v1/counter/{id}/logrequests`
- Создание запроса: `POST https://api-metrika.yandex.net/management/v1/counter/{id}/logrequests?...`
- Скачивание: `GET https://api-metrika.yandex.net/management/v1/counter/{id}/logrequest/{rid}/part/{n}/download`

> ⚠️ **Важный баг:** Для **списка** запросов используется `/logrequests` (мн. число), а для **скачивания/очистки** — `/logrequest` (ед. число). Это не опечатка, это реальное поведение API Яндекса.

**Обновление токена (когда истечёт):**
```bash
# 1. Получить код
open "https://oauth.yandex.ru/authorize?response_type=code&client_id=$YANDEX_METRIKA_CLIENT_ID"

# 2. Обменять код на токен
curl -X POST https://oauth.yandex.ru/token \
  -d "grant_type=authorization_code&code=КОД_ИЗ_БРАУЗЕРА&client_id=$YANDEX_METRIKA_CLIENT_ID&client_secret=$YANDEX_METRIKA_CLIENT_SECRET"

# 3. Обновить YANDEX_METRIKA_TOKEN в .env
```

### Supabase

| Переменная | Описание |
|-----------|----------|
| `SUPABASE_URL` | `https://fdllflsajnruoenucgkg.supabase.co` |
| `SUPABASE_KEY` | Service role key (полный доступ, **НЕ использовать в браузере**) |
| `SUPABASE_DB_PASSWORD` | Пароль для прямого PostgreSQL-подключения |
| `SUPABASE_DB_HOST` | `aws-0-eu-west-1.pooler.supabase.com` |

---

## Локальная разработка

```bash
# Установка зависимостей
cd ~/projects/ga4-funnels
npm install

# Dev-сервер (с hot reload)
npx vite dev --host 0.0.0.0 --port 5173

# Продакшн-билд
npx vite build

# Продакшн-превью
npx vite preview --host 0.0.0.0 --port 4173
```

### Зависимости Python-скриптов

```bash
pip install psycopg2-binary python-dotenv requests --break-system-packages
```

---

## Библиотеки визуализации

| Библиотека | Где используется | Зачем |
|-----------|-----------------|-------|
| [Recharts](https://recharts.org/) | Воронка, обзор, устройства, источники | Bar/Line/Pie/Scatter charts |
| [@nivo/sankey](https://nivo.rocks/sankey/) | Карта путей пользователей | Sankey diagram (потоки переходов) |
| [Lucide React](https://lucide.dev/) | Везде | Иконки |
| [Framer Motion](https://www.framer.com/motion/) | Анимации | Плавные переходы |

---

## Известные ограничения

1. **Нет session_id** — в Logs API (source=hits) нет поля session_id. Сессии определяются по `client_id` + gap > 30 минут.
2. **Нет revenue** — Яндекс.Метрика не передаёт сумму заказа через Logs API (нужна интеграция e-commerce через DataLayer).
3. **Нет поисковых запросов** — Reporting API не отдаёт `ym:pv:searchQuery`, нужен отдельный запрос через dimensions `ym:s:searchPhrase`.
4. **Прокси на сервере** — `HTTPS_PROXY=http://127.0.0.1:10809` ломает скачивание из Logs API. Всегда используй `NO_PROXY='*'` при запуске скриптов.
5. **Период данных** — в базе хранятся данные за последние 7 дней. Для расширения нужно запустить `fetch_metrika_fast.py --days N`.
