# Metrika Aggregate Model

Проект больше не рассчитывает дашборд из `public/data/*.json`.
Фронт читает агрегированные таблицы Supabase и использует сырой слой только как источник для пересчёта.

## Экраны и таблицы

| Экран | Источник |
| --- | --- |
| Обзор | `public.metrika_daily_metrics`, `public.metrika_ecommerce` |
| Воронка продаж | `public.metrika_funnel_daily` |
| Пути пользователей | `public.metrika_sankey` |
| Пути пользователей, force graph | `public.metrika_path_network` |
| Пути пользователей, page-only force graph | `public.metrika_page_path_network` |
| Анализ уходов | `public.metrika_pages` |
| Типы устройств | `public.metrika_devices` |
| Источники трафика | `public.metrika_traffic_sources` |
| Поиск на сайте | `public.metrika_search_terms` |

## Сырой слой

- `public.yandex_metrika_hits`
- `public.yandex_metrika_visits`

Эти таблицы закрыты для `anon` и `authenticated`.
Publishable key должен читать только `metrika_*`.

## Что лежит в агрегатах

### `metrika_daily_metrics`

- `date`
- `active_users`
- `sessions`
- `page_views`
- `new_users`
- `bounce_rate`
- `avg_session_duration`

### `metrika_funnel_daily`

- `date`
- `step_name`
- `step_order`
- `unique_sessions`
- `unique_users`

### `metrika_sankey`

- `date`
- `from`
- `to`
- `transitions`
- `users`

### `metrika_path_network`

Агрегат для force-directed / network graph с русскими названиями узлов и долями переходов от предыдущего шага:

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

Источник: `private.metrika_journey_sessionized_v`, где последовательность включает и обычные страницы, и `goal://...` события Метрики, преобразованные в укрупнённые journey-узлы через `private.node_label(page_url)`.

### `metrika_page_path_network`

Агрегат для отдельного page-only force graph без целей Метрики. В последовательность попадают только реальные page hits:

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

Источник: `private.metrika_core_sessionized_v` c фильтром `is_page = true`, поэтому `goal://...`, `btn://...` и `form://...` не участвуют. Для названий и групп страниц используются `metrika_page_labels` с fallback на `private.default_page_label`, `private.default_page_kind` и `private.default_page_group`. Query string уже нормализован на этапе `private.extract_path()`, поэтому `/search?q=iphone` и `/search?q=samsung` сводятся в один узел `/search`.

### `metrika_pages`

- `date`
- `page_path`
- `page_title`
- `screen_page_views`
- `active_users`
- `avg_engagement_time`
- `bounce_rate`

### `metrika_devices`

- `date`
- `device_category`
- `sessions`
- `page_views`
- `pages_per_session`

### `metrika_traffic_sources`

- `date`
- `source`
- `medium`
- `campaign`
- `sessions`
- `page_views`
- `pages_per_session`

### `metrika_search_terms`

- `date`
- `search_term`
- `search_count`
- `unique_users`

### `metrika_ecommerce`

- `date`
- `event_name`
- `event_count`
- `unique_users`
- `total_revenue`

`total_revenue` сейчас остаётся `0`, потому что в исходных таблицах выручка не приходит.

## Lookup-слой для понятных названий

### `metrika_page_labels`

Хранит словарь `url/path -> человекочитаемое название` и метаданные разметки:

- `path`
- `display_name`
- `page_kind`
- `page_group`
- `source`
- `confidence`
- `needs_review`
- `site_title`
- `sample_hits`

Именно этот lookup подмешивается в `metrika_pages`, чтобы в графиках показывались нормальные названия страниц вместо сырых slug/path.

### `metrika_goal_labels`

Хранит словарь `event/goal -> русское название` и базовую группировку:

- `goal_key`
- `display_name`
- `goal_group`
- `funnel_step`
- `source`
- `confidence`
- `needs_review`
- `sample_hits`

Сейчас все канонические `goal://...` события уже получили названия и не требуют ручной разметки.

### `metrika_raw_event_labels`

Хранит отдельный lookup для сырых `btn://` и `form://` идентификаторов, которые приходят из Метрики без нормального имени:

- `raw_identifier`
- `raw_kind`
- `display_name`
- `event_group`
- `source`
- `confidence`
- `needs_review`
- `sample_hits`

Этот слой нужен не для текущего фронта, а для ручной операционной разметки событий, которые нельзя автоматически декодировать в нормальное название.

### Очереди на ручную разметку

- `metrika_page_labels_review_queue` — URL, которые ещё не получили нормальное название
- `metrika_goal_labels_review_queue` — канонические цели без понятного имени
- `metrika_raw_event_labels_review_queue` — raw `btn://` и `form://` идентификаторы, которые нужно подписать вручную
- `metrika_aux_goal_review_queue` — совместимый view для тех же raw-событий в старом формате

## Пересчёт после новой загрузки

После обновления `yandex_metrika_hits` и `yandex_metrika_visits` нужно выполнить:

```sql
select private.refresh_metrika_aggregates();
```

Это обновит все `metrika_*` таблицы, которые использует фронт.

Для автоматической подписи верхушки самых популярных URL можно дополнительно прогонять:

```bash
python3 scripts/sync_metrika_labels.py --limit 200
```
