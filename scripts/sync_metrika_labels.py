#!/usr/bin/env python3

import argparse
import html
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


GENERIC_TITLES = {
    "05 маркет",
    "Промо от market.05.ru",
}


def load_env(env_path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'").strip('"')
    return values


def clean_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = html.unescape(re.sub(r"<[^>]+>", "", value))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def clean_title(title: Optional[str]) -> Optional[str]:
    text = clean_text(title)
    if not text:
        return None

    replacements = [
        r"\s+[|]\s+market\.05\.ru.*$",
        r"\s+-\s+маркетплейс\s+05\.ru.*$",
        r"\s+-\s+купить в маркетплейсе.*$",
        r"\s+-\s+все товары бренда.*$",
        r"\s+—\s+единый аккаунт.*$",
    ]
    for pattern in replacements:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    text = text.strip(" -")
    return text or None


def fetch_rows(base_url: str, table: str, headers: Dict[str, str], context: ssl.SSLContext, query: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    start = 0
    step = 1000
    while True:
        url = f"{base_url}/rest/v1/{table}?{query}"
        request = urllib.request.Request(
            url,
            headers={
                **headers,
                "Range-Unit": "items",
                "Range": f"{start}-{start + step - 1}",
            },
        )
        with open_url(request, context, timeout=20) as response:
            chunk = json.loads(response.read().decode("utf-8"))
        rows.extend(chunk)
        if len(chunk) < step:
            break
        start += step
    return rows


def patch_row(base_url: str, table: str, key: str, value: str, payload: Dict[str, Any], headers: Dict[str, str], context: ssl.SSLContext) -> None:
    query = urllib.parse.urlencode({key: f"eq.{value}"})
    url = f"{base_url}/rest/v1/{table}?{query}"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            **headers,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    with open_url(request, context, timeout=20):
        return


def fetch_page_metadata(path: str, context: ssl.SSLContext) -> Tuple[Optional[str], Optional[str]]:
    url = "https://market.05.ru" + ("/" if path == "/" else path)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with open_url(request, context, timeout=15) as response:
        html = response.read().decode("utf-8", "ignore")

    title_match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.IGNORECASE | re.DOTALL)
    return clean_text(title_match.group(1) if title_match else None), clean_text(h1_match.group(1) if h1_match else None)


def open_url(request: urllib.request.Request, context: ssl.SSLContext, timeout: int):
    last_error: Optional[Exception] = None
    for attempt in range(1, 4):
        try:
            return urllib.request.urlopen(request, context=context, timeout=timeout)
        except Exception as error:
            last_error = error
            if attempt == 3:
                break
            time.sleep(attempt)
    assert last_error is not None
    raise last_error


def derive_label(path: str, title: Optional[str], h1: Optional[str]) -> Optional[str]:
    if h1 and len(h1) >= 3 and h1 not in GENERIC_TITLES:
        return h1

    cleaned = clean_title(title)
    if not cleaned or cleaned in GENERIC_TITLES:
        return None

    if path == "/user":
        return "Личный кабинет / 05ID"

    return cleaned


def build_report(
    output_path: Path,
    unresolved_pages: Iterable[Dict[str, Any]],
    unresolved_goals: Iterable[Dict[str, Any]],
    aux_goals: Iterable[Dict[str, Any]],
) -> None:
    lines = [
        "# Metrika Label Review",
        "",
        "Страницы и raw-события, которые остались на ручную разметку после автосинхронизации.",
        "",
        "## Page Labels",
        "",
        "| Path | Candidate | Kind | Hits |",
        "| --- | --- | --- | ---: |",
    ]

    for row in unresolved_pages:
        lines.append(
            f"| `{row['path']}` | {row.get('candidate_name') or ''} | {row.get('page_kind') or ''} | {row.get('sample_hits') or 0} |"
        )

    lines.extend(
        [
            "",
            "## Goal Labels",
            "",
            "| Goal Key | Candidate | Group | Hits |",
            "| --- | --- | --- | ---: |",
        ]
    )

    for row in unresolved_goals:
        lines.append(
            f"| `{row['goal_key']}` | {row.get('candidate_name') or ''} | {row.get('goal_group') or ''} | {row.get('sample_hits') or 0} |"
        )

    lines.extend(
        [
            "",
            "## Raw btn/form Identifiers",
            "",
            "| Raw Identifier | Kind | Hits |",
            "| --- | --- | ---: |",
        ]
    )

    for row in aux_goals:
        lines.append(f"| `{row['raw_identifier']}` | {row['raw_kind']} | {row['hits']} |")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich metrika page labels from market.05.ru")
    parser.add_argument("--limit", type=int, default=200, help="How many unresolved pages to inspect")
    parser.add_argument(
        "--report",
        default="docs/metrika-label-review.md",
        help="Where to write the manual review report",
    )
    args = parser.parse_args()

    env = load_env(Path(".env"))
    base_url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    service_key = env.get("SUPABASE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    read_key = service_key or env.get("VITE_SUPABASE_PUBLISHABLE_KEY")

    if not base_url or not read_key:
        raise SystemExit("Supabase credentials not found in .env")

    admin_headers = {
        "apikey": read_key,
        "Authorization": f"Bearer {read_key}",
    }
    read_headers = dict(admin_headers)
    context = ssl._create_unverified_context()

    unresolved_pages = fetch_rows(
        base_url,
        "metrika_page_labels_review_queue",
        read_headers,
        context,
        f"select=path,candidate_name,page_kind,sample_hits&order=sample_hits.desc&limit={args.limit}",
    )

    updated = 0
    for row in unresolved_pages:
        path = row["path"]
        try:
            title, h1 = fetch_page_metadata(path, context)
        except Exception:
            continue

        label = derive_label(path, title, h1)
        if not label:
            continue

        patch_row(
            base_url,
            "metrika_page_labels",
            "path",
            path,
            {
                "display_name": label,
                "site_title": title,
                "source": "site",
                "confidence": 0.95,
                "needs_review": False,
            },
            admin_headers,
            context,
        )
        updated += 1

    unresolved_pages_after = fetch_rows(
        base_url,
        "metrika_page_labels_review_queue",
        read_headers,
        context,
        "select=path,candidate_name,page_kind,sample_hits&order=sample_hits.desc&limit=80",
    )
    unresolved_goals = fetch_rows(
        base_url,
        "metrika_goal_labels_review_queue",
        read_headers,
        context,
        "select=goal_key,candidate_name,goal_group,sample_hits&order=sample_hits.desc&limit=40",
    )
    aux_goals = fetch_rows(
        base_url,
        "metrika_aux_goal_review_queue",
        read_headers,
        context,
        "select=raw_identifier,raw_kind,hits&order=hits.desc&limit=40",
    )

    build_report(Path(args.report), unresolved_pages_after, unresolved_goals, aux_goals)
    print(json.dumps({"updated": updated, "report": args.report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
