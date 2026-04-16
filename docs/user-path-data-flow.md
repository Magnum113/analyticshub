# User Path Data Flow

Подробное описание того, как в проекте хранятся данные, как они агрегируются в Supabase и как превращаются в данные для визуализации графиков на фронте.

Документ покрывает:

- исходные таблицы raw-слоя
- private views и helper functions
- lookup-таблицы с подписями страниц и событий
- агрегированные `metrika_*` таблицы
- отдельные пайплайны для:
  - journey graph с участием целей Метрики
  - page-only graph только по страницам
- потребление данных на фронтенде через `src/data/dataService.ts`

## 1. Общая схема

```text
Яндекс.Метрика
  -> public.yandex_metrika_hits
  -> public.yandex_metrika_visits

public.yandex_metrika_hits / visits
  -> private.extract_* helpers
  -> private.metrika_core_* views
  -> private.metrika_journey_* views
  -> private.sync_metrika_*_labels()
  -> private.refresh_metrika_aggregates_base()
  -> private.refresh_metrika_path_network()
  -> private.refresh_metrika_page_path_network()
  -> public.metrika_* tables

public.metrika_* tables
  -> src/data/dataService.ts
  -> src/pages/*.tsx
  -> Sankey / Force-Directed / D3 Force / остальные отчёты
```

## 2. Raw-слой

### 2.1 `public.yandex_metrika_hits`

Это главный event-level слой.

Поля, которые реально используются в аналитике:

- `id`
- `event_time`
- `client_id`
- `watch_id`
- `page_url`
- `referer`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `created_at`

В `page_url` лежат не только обычные URL страниц, но и synthetic-события Метрики:

- обычные страницы:
  - `https://market.05.ru/...`
- goal-события:
  - `goal://market.05.ru/view_item_nn`
  - `goal://market.05.ru/add_to_cart_nn`
- сырые события:
  - `btn://...`
  - `form://...`

Это ключевой момент: один и тот же raw-слой содержит и page hits, и goal hits.

### 2.2 `public.yandex_metrika_visits`

Это visit/session-level агрегированный слой из Метрики.

Используется для:

- `sessions` в overview
- `pages_per_session`
- `device` breakdown
- `traffic source` breakdown

Из текущего кода и SQL видно, что именно из `yandex_metrika_visits` строятся:

- `metrika_daily_metrics.sessions`
- `metrika_devices`
- `metrika_traffic_sources`

## 3. Helper functions

Эти функции нормализуют raw `page_url` и помогают собрать понятные витрины.

### 3.1 `private.extract_host(page_url)`

Выделяет host из URL.

Пример:

- `https://market.05.ru/search?q=iphone` -> `market.05.ru`

### 3.2 `private.extract_path(page_url)`

Выделяет только path и отрезает query string и trailing slash.

Примеры:

- `https://market.05.ru/search?q=iphone` -> `/search`
- `https://market.05.ru/cat/mc/396f7486/smartfony/?sort=-rate` -> `/cat/mc/396f7486/smartfony`

Это важно для page-only режима: разные query-параметры не раздувают граф в отдельные узлы.

### 3.3 `private.extract_event_name(page_url)`

Работает только для `goal://...`.

Пример:

- `goal://market.05.ru/view_item_nn` -> `view_item`

Суффикс `_nn` отрезается.

### 3.4 `private.extract_search_term(page_url)`

Извлекает поисковый запрос из URL `/search?...`.

Используется для `metrika_search_terms`.

### 3.5 `private.default_page_label(path)`

Fallback-подпись страницы, если для неё нет ручной разметки в `metrika_page_labels`.

Примеры:

- `/` -> `Главная`
- `/search` -> `Поиск`
- `/cart` -> `Корзина`
- `/checkout` -> `Оформление заказа`
- `/cat/.../p/...` -> человекочитаемое название товара по slug

### 3.6 `private.default_page_kind(path)`

Определяет тип страницы:

- `home`
- `search`
- `cart`
- `checkout`
- `sale`
- `promo`
- `seller`
- `product`
- `catalog`
- `account`
- `auth`
- `info`
- `other`

### 3.7 `private.default_page_group(path)`

Определяет более крупную бизнес-группу страницы:

- `Навигация`
- `Оформление`
- `Промо`
- `Продавцы`
- `Товар`
- `Каталог`
- `Личный кабинет`
- `Авторизация`
- `Информация`
- `Прочее`

### 3.8 `private.node_label(page_url)`

Это ключевая функция journey-режима.

Она превращает и страницы, и goal-события в укрупнённые journey-узлы для Sankey и force graph.

Примеры соответствий:

- `goal://.../preload-in-app` -> `📱 Вход из приложения`
- `goal://.../view_item` -> `👁 Просмотр товара`
- `goal://.../add_to_cart` -> `🛒 Корзина`
- `goal://.../begin_checkout` -> `💳 Оформление`
- `goal://.../purchase` -> `✅ Покупка`
- `https://market.05.ru/` -> `🏠 Главная`
- `https://market.05.ru/search?...` -> `🔍 Поиск`
- `https://market.05.ru/cat/.../p/...` -> `📦 Карточка товара`

Для `btn://...`, `form://...`, `localhost`, `stage`, `dev` функция возвращает `null`, и такие записи не попадают в journey graph.

### 3.9 `private.node_plain_label(node_label)`

Убирает emoji и приводит journey-узлы к plain-виду:

- `🏠 Главная` -> `Главная`
- `📦 Карточка товара` -> `Страница товара`
- `👁 Просмотр товара` -> `Просмотр товара`

### 3.10 `private.node_plain_group(node_label)`

Превращает journey-узлы в крупные группы:

- `Вход`
- `Главная`
- `Поиск и фильтры`
- `Каталог`
- `Товар`
- `Чекаут`
- `Прочее`

### 3.11 `private.node_plain_order(node_label)`

Задаёт порядок шага для графов:

- `Главная` раньше `Каталог`
- `Каталог` раньше `Товар`
- `Товар` раньше `Чекаут`

Это используется для `is_backward` и для layout в визуализациях.

## 4. Private views: core pipeline

### 4.1 `private.metrika_core_hits_v`

Базовый нормализованный view поверх `yandex_metrika_hits`.

Даёт:

- `date`
- `event_time`
- `client_id`
- `watch_id`
- `page_url`
- `host`
- `page_path`
- `event_name`
- `search_term`
- `is_goal`
- `is_page`

Фильтр:

- берутся только события с `host = 'market.05.ru'`

То есть это уже очищенный слой для аналитики по основному домену.

### 4.2 `private.metrika_core_sessionized_v`

Сессии строятся не из `yandex_metrika_visits`, а заново из hit stream:

- partition by `client_id`
- сортировка по `event_time`, `watch_id`, `page_url`
- новая сессия начинается, если разрыв больше 30 минут

Добавляет:

- `prev_event_time`
- `new_session_flag`
- `session_seq`
- `session_id = client_id:session_seq`

Это главный источник для page-level последовательностей.

### 4.3 `private.metrika_core_sessions_v`

Агрегирует `metrika_core_sessionized_v` до session-level сводки.

Даёт:

- `session_id`
- `date`
- `client_id`
- `session_start`
- `session_end`
- `duration_seconds`
- `page_hits`
- `goal_hits`
- `landing_page_path`

Используется для:

- bounce rate
- session duration
- landing page metrics

## 5. Private views: journey pipeline

### 5.1 `private.metrika_journey_hits_v`

Это view, где raw hits пропускаются через `private.node_label(page_url)`.

На выходе:

- `date`
- `event_time`
- `client_id`
- `watch_id`
- `page_url`
- `node_label`

Если `node_label(page_url)` вернул `null`, запись не попадает в journey pipeline.

### 5.2 `private.metrika_journey_sessionized_v`

Это sessionized-версия journey hits.

Механика сессий та же:

- partition by `client_id`
- разрыв 30 минут
- `session_id = client_id:session_seq`

Главное отличие от core pipeline:

- тут последовательность идёт по journey-узлам, а не по реальным страницам

## 6. Lookup-слой

### 6.1 `public.metrika_page_labels`

Словарь `path -> человекочитаемое имя + классификация`.

Поля:

- `path`
- `display_name`
- `page_kind`
- `page_group`
- `source`
- `confidence`
- `needs_review`
- `site_title`
- `sample_hits`
- `first_seen_at`
- `last_seen_at`
- `notes`
- `created_at`
- `updated_at`

Используется в:

- `metrika_pages`
- `metrika_page_path_network`

### 6.2 `public.metrika_goal_labels`

Словарь `goal_key -> display name`.

Поля:

- `goal_key`
- `display_name`
- `goal_group`
- `funnel_step`
- `source`
- `confidence`
- `needs_review`
- `sample_hits`
- `last_seen_at`

Используется в:

- `metrika_ecommerce`
- косвенно в операционной разметке событий

### 6.3 `public.metrika_raw_event_labels`

Словарь для сырых `btn://` и `form://`.

Используется не для текущих графов, а для ручной операционной разметки.

### 6.4 Review queues

Есть вспомогательные queue/view таблицы:

- `metrika_page_labels_review_queue`
- `metrika_goal_labels_review_queue`
- `metrika_raw_event_labels_review_queue`
- `metrika_aux_goal_review_queue`

Они нужны, чтобы находить необработанные URL и события, которым ещё не дали нормальное имя.

## 7. Основной refresh pipeline

### 7.1 `private.refresh_metrika_aggregates_base()`

Эта функция делает базовый refresh витрин.

Сначала:

- `private.sync_metrika_page_labels()`
- `private.sync_metrika_goal_labels()`
- `private.sync_metrika_raw_event_labels()`

Затем она `truncate`-ит и пересобирает:

- `public.metrika_daily_metrics`
- `public.metrika_funnel_daily`
- `public.metrika_sankey`
- `public.metrika_pages`
- `public.metrika_devices`
- `public.metrika_traffic_sources`
- `public.metrika_ecommerce`
- `public.metrika_search_terms`

### 7.2 `private.refresh_metrika_path_network()`

Отдельно строит journey force-network:

- источник: `private.metrika_journey_sessionized_v`
- переходы считаются через `lag(node_label)`
- затем node labels приводятся через `node_plain_*`

На выходе получается `public.metrika_path_network`.

### 7.3 `private.refresh_metrika_page_path_network()`

Отдельно строит page-only force-network:

- источник: `private.metrika_core_sessionized_v`
- фильтр: `is_page = true`
- последовательность строится по `page_path`
- query string уже убран на этапе `extract_path`
- подписи и группы страниц берутся из `metrika_page_labels`
- fallback идёт через `default_page_label/default_page_kind/default_page_group`

На выходе получается `public.metrika_page_path_network`.

### 7.4 `private.refresh_metrika_auth_report()`

Отдельный refresh для витрин авторизации / 05ID.

### 7.5 `private.refresh_metrika_aggregates()`

Текущая orchestrator-функция:

```sql
begin
  perform private.refresh_metrika_aggregates_base();
  perform private.refresh_metrika_path_network();
  perform private.refresh_metrika_page_path_network();
  perform private.refresh_metrika_auth_report();
end;
```

То есть полный пересчёт всех витрин делается одной командой.

## 8. Агрегированные таблицы для фронта

### 8.1 `public.metrika_daily_metrics`

Источник:

- `private.metrika_core_hits_v`
- `private.metrika_core_sessions_v`
- `public.yandex_metrika_visits`

Поля:

- `date`
- `active_users`
- `sessions`
- `page_views`
- `new_users`
- `bounce_rate`
- `avg_session_duration`

### 8.2 `public.metrika_funnel_daily`

Источник:

- `private.metrika_core_sessionized_v`

Берёт события:

- `view_item_list`
- `view_item`
- `add_to_cart`
- `begin_checkout`
- `purchase`

И превращает их в шаги funnel.

### 8.3 `public.metrika_ecommerce`

Источник:

- `private.metrika_core_hits_v`
- `public.metrika_goal_labels`

Это таблица событий Метрики с нормальными подписями.

### 8.4 `public.metrika_search_terms`

Источник:

- `private.metrika_core_hits_v`

### 8.5 `public.metrika_pages`

Источник:

- `private.metrika_core_sessionized_v`
- `private.metrika_core_sessions_v`
- `public.metrika_page_labels`

Это агрегат по самим страницам сайта.

Поля:

- `date`
- `page_path`
- `page_title`
- `screen_page_views`
- `active_users`
- `avg_engagement_time`
- `bounce_rate`
- `page_kind`
- `page_group`
- `label_source`
- `needs_review`

### 8.6 `public.metrika_devices`

Источник:

- `public.yandex_metrika_visits`

### 8.7 `public.metrika_traffic_sources`

Источник:

- `public.yandex_metrika_visits`

### 8.8 `public.metrika_sankey`

Источник:

- `private.metrika_journey_sessionized_v`

Механика:

- для каждого события берётся `lag(node_label)`
- получаем пару `from -> to`
- self-transition исключается
- считаются `transitions` и `users`

Важно:

`metrika_sankey` не page-only. Это journey-слой, в который включены и goal-события Метрики.

### 8.9 `public.metrika_path_network`

Источник:

- `private.metrika_journey_sessionized_v`

Это та же journey-последовательность, но в форме richer network edge table.

Поля:

- `date`
- `source_node`
- `source_group`
- `source_order`
- `target_node`
- `target_group`
- `target_order`
- `transitions`
- `unique_sessions`
- `unique_users`
- `source_sessions`
- `source_users`
- `target_sessions`
- `target_users`
- `session_share_from`
- `user_share_from`
- `is_backward`
- `is_self_loop`

Смысл:

- `transitions` — сколько всего переходов было по этому ребру
- `unique_sessions` — в скольких сессиях встречалось
- `session_share_from` — доля от исходного узла
- `is_backward` — переход назад по заданному journey order
- `is_self_loop` — переход в тот же узел

### 8.10 `public.metrika_page_path_network`

Источник:

- `private.metrika_core_sessionized_v`
- `public.metrika_page_labels`

Это отдельная page-only витрина только по реальным страницам.

Поля:

- `date`
- `source_path`
- `source_title`
- `source_kind`
- `source_group`
- `source_order`
- `target_path`
- `target_title`
- `target_kind`
- `target_group`
- `target_order`
- `transitions`
- `unique_sessions`
- `unique_users`
- `source_sessions`
- `source_users`
- `target_sessions`
- `target_users`
- `session_share_from`
- `user_share_from`
- `is_backward`
- `is_self_loop`

Это уже именно тот слой, который нужен для ответа на вопрос:

- с каких страниц
- на какие страницы
- куда реально уходят пользователи

без вмешательства `goal://...` событий.

## 9. Чем journey graph отличается от page-only graph

### 9.1 Journey graph

Источник:

- `metrika_sankey`
- `metrika_path_network`

Логика:

- в последовательность попадают и страницы, и goals
- `view_item`, `add_to_cart`, `purchase` становятся отдельными узлами
- граф читается как продуктовая воронка / behavioural journey

Подходит для:

- анализа funnel-логики
- понимания, где пользователь проходит этапы воронки

### 9.2 Page-only graph

Источник:

- `metrika_page_path_network`

Логика:

- учитываются только реальные страницы сайта
- query string схлопывается в path
- можно смотреть:
  - по конкретным URL
  - по укрупнённым группам страниц на фронте

Подходит для:

- анализа навигации по страницам
- understanding page-to-page flow
- поиска “куда реально уходят с этой страницы”

## 10. Как фронтенд получает данные

Главная точка входа:

- [src/data/dataService.ts](/Users/kadimagomedov/Documents/AnalyticsHub/src/data/dataService.ts)

### 10.1 `loadTable(table, days)`

Универсальная функция чтения:

- делает `select *`
- фильтрует по `date >= getStartDate(days)`
- сортирует по `date`
- кэширует ответ в module-level `Map`

Важно:

из-за этого после пересчёта витрины в базе иногда нужен hard refresh страницы, иначе фронт может держать старый кэш в рантайме.

### 10.2 Что читает `dataService.ts`

Сейчас data layer читает:

- `metrika_daily_metrics`
- `metrika_funnel_daily`
- `metrika_sankey`
- `metrika_path_network`
- `metrika_page_path_network`
- `metrika_pages`
- `metrika_devices`
- `metrika_traffic_sources`
- `metrika_search_terms`
- `metrika_ecommerce`
- auth-specific `metrika_auth_*`

### 10.3 Page-only данные на фронте

Есть два слоя представления:

#### `fetchPagePathNetworkData(days)`

Читает:

- `public.metrika_page_path_network`

И агрегирует по ключу:

- `source_path ||| target_path`

Это режим `По URL`.

#### `fetchGroupedPagePathNetworkData(days)`

Читает результат `fetchPagePathNetworkData(days)` и уже на фронте схлопывает его в семейства страниц:

- `Главная`
- `Поиск`
- `Категория`
- `Подкатегория`
- `Товар`
- `Продавец`
- `Корзина`
- `Чекаут`
- `ЛК`
- `Акции`
- `Прочее`

Это режим `По группам страниц`.

## 11. Как данные доходят до графиков на фронте

### 11.1 Экран `Пути пользователей`

Файл:

- [src/pages/UserPathExplorer.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathExplorer.tsx)

Что он делает:

- загружает journey-данные:
  - `fetchSankeyData(days)`
  - `fetchPathNetworkData(days)`
- загружает page-only данные:
  - `fetchPagePathNetworkData(days)`
  - `fetchGroupedPagePathNetworkData(days)`
- держит переключатели:
  - `journey + goals`
  - `только страницы`
  - `по URL`
  - `по группам страниц`
  - `Sankey / Force / D3 Force`

### 11.2 Sankey

Источник:

- `fetchSankeyData(days)` -> `metrika_sankey`

Особенности:

- только journey-режим
- page-only Sankey сейчас не строится
- односторонний layout по `NODE_ORDER`

### 11.3 Force-Directed Graph

Файл:

- [src/pages/UserPathForceGraph.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathForceGraph.tsx)

Источник:

- `PathNetworkEdge[]`

Это может быть:

- `metrika_path_network`
- `metrika_page_path_network`
- grouped page-only edges

### 11.4 D3 Force

Файл:

- [src/pages/UserPathD3ForceGraph.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathD3ForceGraph.tsx)

Источник:

- тот же `PathNetworkEdge[]`

Разница только в рендере и физике раскладки.

## 12. Почему page-only граф может казаться “пустым”

Это важное наблюдение из практики.

Page-only граф по конкретным URL обычно намного более разрежен, чем journey graph, потому что:

1. там нет `goal://...` событий, которые создают мощные общие узлы вроде `Просмотр товара` или `Корзина`
2. path-level граф разрезан на тысячи конкретных URL
3. большинство page-to-page переходов встречается 1 раз
4. фронт режет граф по `minTransitions`
5. self-loop рёбра скрываются из основного полотна

На практике это означает:

- сырых page-only переходов много
- но “сильных” повторяющихся рёбер между конкретными URL намного меньше

Именно поэтому режим `По группам страниц` обычно лучше подходит для первичного визуального анализа.

## 13. Что действительно является source of truth для графиков

Если коротко:

- source of truth raw:
  - `public.yandex_metrika_hits`
- source of truth journey graph:
  - `private.metrika_journey_sessionized_v`
- source of truth page-only graph:
  - `private.metrika_core_sessionized_v where is_page = true`

А фронт уже никогда не работает напрямую с raw hits.

Он читает только готовые `public.metrika_*` витрины.

## 14. Практический runbook

Если обновился raw-слой, нужно выполнить:

```sql
select private.refresh_metrika_aggregates();
```

Если нужно только пересчитать page-only граф:

```sql
select private.refresh_metrika_page_path_network();
```

Если после этого фронт показывает старые числа:

- сделать hard refresh страницы
- потому что `dataService.ts` держит module-level cache по ключу `table:days`

## 15. Главные файлы проекта по этой теме

- [src/data/dataService.ts](/Users/kadimagomedov/Documents/AnalyticsHub/src/data/dataService.ts)
- [src/pages/UserPathExplorer.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathExplorer.tsx)
- [src/pages/UserPathForceGraph.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathForceGraph.tsx)
- [src/pages/UserPathD3ForceGraph.tsx](/Users/kadimagomedov/Documents/AnalyticsHub/src/pages/UserPathD3ForceGraph.tsx)
- [docs/metrika-aggregate-model.md](/Users/kadimagomedov/Documents/AnalyticsHub/docs/metrika-aggregate-model.md)
- [README.md](/Users/kadimagomedov/Documents/AnalyticsHub/README.md)
- [sql/2026-04-16_page_only_path_network.sql](/Users/kadimagomedov/Documents/AnalyticsHub/sql/2026-04-16_page_only_path_network.sql)

