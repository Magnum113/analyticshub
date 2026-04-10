# 05.ru Аналитика

Дашборд веб-аналитики маркетплейса [market.05.ru](https://market.05.ru) на данных Яндекс.Метрики.

Фронтенд написан на React + Vite и читает не статические JSON, а агрегированные таблицы Supabase. Сырые данные Метрики используются только как source-of-truth для пересчёта витрин и словарей человекочитаемых названий страниц/событий.

## Текущая архитектура

```text
Яндекс.Метрика
    ├─ Logs API / Reporting API
    │
    ▼
Supabase raw layer
    ├─ public.yandex_metrika_hits
    └─ public.yandex_metrika_visits
    │
    ▼
private.refresh_metrika_aggregates()
    ├─ агрегаты metrika_*
    ├─ lookup-таблицы metrika_*_labels
    └─ очереди на ручную разметку
    │
    ▼
Vite / React frontend
    └─ src/data/dataService.ts -> Supabase publishable key -> графики и отчёты
```

Ключевой принцип:

- браузер читает только `metrika_*` таблицы
- сырой слой `yandex_metrika_*` не должен быть доступен через publishable key
- понятные русские названия страниц и событий подмешиваются на уровне data layer и агрегатов, а не вручную в компонентах

Подробная схема агрегатов: [docs/metrika-aggregate-model.md](/Users/kadimagomedov/Documents/AnalyticsHub/docs/metrika-aggregate-model.md)

## Стек

- React 19
- Vite 8
- TypeScript
- Tailwind CSS 4
- Supabase JS
- Recharts
- `@nivo/sankey`
- `react-force-graph-2d`
- `d3-force`

## Что есть в интерфейсе

- `Обзор` — сессии, пользователи, просмотры, bounce rate, engagement
- `Воронка продаж` — агрегированная воронка по шагам
- `Пути пользователей` — три режима:
  - Sankey
  - Force-Directed Graph на `react-force-graph-2d`
  - D3 Force Graph на `d3-force`
- `Анализ уходов` — топ страниц и точки выхода
- `Типы устройств`
- `Источники трафика`
- `Поиск на сайте`

## Структура проекта

```text
.
├── docs/
│   ├── metrika-aggregate-model.md   # схема витрин, lookup-таблиц и refresh-пайплайна
│   └── metrika-label-review.md      # текущая очередь на ручную разметку
├── scripts/
│   └── sync_metrika_labels.py       # автодоразметка URL по живому сайту
├── src/
│   ├── App.tsx
│   ├── data/
│   │   ├── dataService.ts           # загрузка metrika_* из Supabase и friendly labels
│   │   ├── supabaseClient.ts        # frontend client через publishable key
│   │   └── mockGenerator.ts         # legacy / не используется в production-flow
│   └── pages/
│       ├── SummaryDashboard.tsx
│       ├── FunnelChart.tsx
│       ├── UserPathExplorer.tsx
│       ├── UserPathForceGraph.tsx
│       ├── UserPathD3ForceGraph.tsx
│       ├── DropOffAnalysis.tsx
│       ├── DeviceComparison.tsx
│       ├── TrafficSourceAnalysis.tsx
│       └── SearchBehavior.tsx
├── package.json
└── README.md
```

## Переменные окружения

Минимальный набор для фронтенда:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Для служебных скриптов и админских операций в Supabase:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<service-role-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Что используется где:

- [src/data/supabaseClient.ts](/Users/kadimagomedov/Documents/AnalyticsHub/src/data/supabaseClient.ts) читает `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`
- [scripts/sync_metrika_labels.py](/Users/kadimagomedov/Documents/AnalyticsHub/scripts/sync_metrika_labels.py) читает `.env` и для записи предпочитает service role key

## Локальный запуск

```bash
npm install
npm run dev
```

По умолчанию Vite поднимет локальный сервер на `http://127.0.0.1:5173/`.

Дополнительно:

```bash
npm run build
npm run preview
```

## Как фронтенд получает данные

[src/data/dataService.ts](/Users/kadimagomedov/Documents/AnalyticsHub/src/data/dataService.ts) читает эти витрины:

- `metrika_daily_metrics`
- `metrika_funnel_daily`
- `metrika_sankey`
- `metrika_path_network`
- `metrika_pages`
- `metrika_devices`
- `metrika_traffic_sources`
- `metrika_search_terms`
- `metrika_ecommerce`

Внутри data layer уже есть:

- агрегация по выбранному периоду
- friendly titles для страниц
- friendly labels для событий
- fallback-логика для страниц без ручной подписи
- нормализация данных для Sankey и network-графов

## Модель данных в Supabase

### Сырой слой

- `public.yandex_metrika_hits`
- `public.yandex_metrika_visits`

Эти таблицы используются только для пересчёта агрегатов и не должны быть открыты для publishable key.

### Агрегаты для фронтенда

- `public.metrika_daily_metrics`
- `public.metrika_funnel_daily`
- `public.metrika_sankey`
- `public.metrika_path_network`
- `public.metrika_pages`
- `public.metrika_devices`
- `public.metrika_traffic_sources`
- `public.metrika_search_terms`
- `public.metrika_ecommerce`

### Lookup-слой для понятных названий

- `public.metrika_page_labels`
- `public.metrika_goal_labels`
- `public.metrika_raw_event_labels`

### Очереди на ручную разметку

- `public.metrika_page_labels_review_queue`
- `public.metrika_goal_labels_review_queue`
- `public.metrika_raw_event_labels_review_queue`
- `public.metrika_aux_goal_review_queue`

Подробный состав полей описан в [docs/metrika-aggregate-model.md](/Users/kadimagomedov/Documents/AnalyticsHub/docs/metrika-aggregate-model.md).

## Runbook обновления данных

Этот репозиторий не содержит ETL-скрипты загрузки Метрики в raw layer. Предполагается, что внешняя джоба уже обновила:

- `public.yandex_metrika_hits`
- `public.yandex_metrika_visits`

После этого нужно пересчитать витрины:

```sql
select private.refresh_metrika_aggregates();
```

Это обновит:

- агрегированные `metrika_*` таблицы
- витрины путей пользователей
- словари подписей
- review queues

## Автодоразметка страниц

Для популярных URL можно автоматически подтянуть заголовки с живого сайта:

```bash
python3 scripts/sync_metrika_labels.py --limit 200
```

Скрипт:

- берёт unresolved URL из `metrika_page_labels_review_queue`
- ходит на `https://market.05.ru`
- пытается достать `title` / `h1`
- обновляет `metrika_page_labels`
- пересобирает локальный отчёт на ручную разметку в [docs/metrika-label-review.md](/Users/kadimagomedov/Documents/AnalyticsHub/docs/metrika-label-review.md)

Важно:

- для записи в Supabase скрипту нужен service role key
- не все `btn://` и `form://` raw-события можно подписать автоматически, они остаются в review queue

## Визуализации путей пользователей

На экране [UserPathExplorer.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathExplorer.tsx) есть три режима:

1. Sankey для линейного чтения потока
2. `react-force-graph-2d` для быстрого canvas network view
3. `d3-force` для отдельного SVG-графа с drag и физической раскладкой

Оба force-графа используют одну и ту же витрину `public.metrika_path_network`.

Особенности:

- self-loop переходы не рисуются на основном полотне, чтобы не изолировать узлы вроде `Главная`
- они показываются отдельным блоком как повторы шага
- для связей используются уже нормализованные русские названия узлов

## Ограничения и текущие нюансы

1. `total_revenue` в `metrika_ecommerce` сейчас остаётся `0`, если выручка не загружается в raw-слой Метрики.
2. Часть raw-событий вида `btn://...` и `form://...` требует ручной подписи.
3. Фронтенд зависит от корректных RLS / grants в Supabase: publishable key должен читать только `metrika_*`.
4. В проекте остаются legacy-файлы вроде `mockGenerator.ts`, но production-flow на них не завязан.
5. `README` описывает только этот репозиторий и Supabase-side runbook; фактические ETL-джобы импорта из Метрики живут вне репозитория.

## Полезные файлы

- [README.md](/Users/kadimagomedov/Documents/AnalyticsHub/README.md)
- [docs/metrika-aggregate-model.md](/Users/kadimagomedov/Documents/AnalyticsHub/docs/metrika-aggregate-model.md)
- [docs/metrika-label-review.md](/Users/kadimagomedov/Documents/AnalyticsHub/docs/metrika-label-review.md)
- [src/data/dataService.ts](/Users/kadimagomedov/Documents/AnalyticsHub/src/data/dataService.ts)
- [src/pages/UserPathExplorer.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathExplorer.tsx)
- [scripts/sync_metrika_labels.py](/Users/kadimagomedov/Documents/AnalyticsHub/scripts/sync_metrika_labels.py)
