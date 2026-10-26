#!/usr/bin/env python3
"""Export Buwaya Tracker's public Supabase tables to the legacy pipe-delimited TXT files.

Uses only Python's standard library. Requires SUPABASE_URL and SUPABASE_ANON_KEY
(or a Supabase publishable key) in the environment. This script performs GET requests only.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("BUWAYA_DATA_DIR", str(ROOT))).resolve()
PAGE_SIZE = 1000


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required GitHub Actions variable/secret: {name}")
    return value.rstrip("/") if name == "SUPABASE_URL" else value


SUPABASE_URL = required_env("SUPABASE_URL")
SUPABASE_KEY = required_env("SUPABASE_ANON_KEY")


def fetch_rows(table: str, order: str = "id.asc") -> list[dict]:
    """Fetch all rows in stable pages. The API key is read-only by policy/grant."""
    rows: list[dict] = []
    offset = 0
    while True:
        query = urllib.parse.urlencode({"select": "*", "order": order, "limit": str(PAGE_SIZE), "offset": str(offset)})
        url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Accept": "application/json",
            "User-Agent": "BuwayaTracker-TXT-Exporter/1.0",
        }
        # Legacy anon keys are JWTs. New sb_publishable_ keys are not JWTs, so don't
        # put those in Authorization; the apikey header is sufficient for the gateway.
        if not SUPABASE_KEY.startswith("sb_publishable_"):
            headers["Authorization"] = f"Bearer {SUPABASE_KEY}"
        request = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # Avoid printing request headers or keys into logs.
            raise RuntimeError(f"Supabase read failed for table '{table}' (HTTP {exc.code}). Check URL, key, grants, and RLS policies.") from None
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Could not reach Supabase for table '{table}': {exc.reason}") from None
        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected response for table '{table}'; expected a JSON array.")
        rows.extend(payload)
        if len(payload) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def field(row: dict, key: str, default: str = "") -> str:
    value = row.get(key, default)
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    # The legacy format uses | as a field delimiter and one record per line.
    return " ".join(str(value).replace("|", "/").replace("\r", " ").replace("\n", " ").split())


def write_file(name: str, text: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target = DATA_DIR / name
    target.write_text(text.rstrip() + "\n", encoding="utf-8", newline="\n")
    print(f"Exported {target.relative_to(ROOT) if target.is_relative_to(ROOT) else target}: {sum(1 for line in text.splitlines() if line and not line.startswith('#'))} data rows")


def export_politicians() -> None:
    rows = fetch_rows("politicians", "id.asc")
    lines = [
        "# Auto-generated from Supabase by .github/workflows/sync-supabase-txt.yml",
        "# Format: id|name|party|position|platform|track record",
    ]
    for row in rows:
        lines.append("|".join([
            field(row, "id"), field(row, "name"), field(row, "party"),
            field(row, "position"), field(row, "platform"), field(row, "track_record"),
        ]))
    write_file("politicians.txt", "\n".join(lines))


def export_relations() -> None:
    rows = fetch_rows("relations", "id.asc")
    lines = [
        "# Auto-generated from Supabase by .github/workflows/sync-supabase-txt.yml",
        "# Family links between politicians. Format: id|id|type",
        '# Types: spouse, parent, sibling, cousin. For "parent", the FIRST id is the parent.',
        "# IDs come from politicians.txt. Lines starting with # are ignored.",
    ]
    for row in rows:
        lines.append("|".join([field(row, "person_a"), field(row, "person_b"), field(row, "relation_type")]))
    write_file("relations.txt", "\n".join(lines))


def export_news() -> None:
    rows = fetch_rows("news", "published_at.desc.nullslast,id.desc")
    lines = [
        "# Auto-generated from Supabase by .github/workflows/sync-supabase-txt.yml",
        "# Format: date|category|title|summary|link (optional)|politician id (optional)",
        "# Date must be YYYY-MM-DD. Newest items appear first. Do not use the | character inside a field.",
        "# Write the summary in your own words and link to the original article.",
    ]
    for row in rows:
        published = field(row, "published_at")
        # Postgres date values are ISO YYYY-MM-DD strings; blank dates stay blank.
        if published:
            try:
                published = date.fromisoformat(published[:10]).isoformat()
            except ValueError:
                raise RuntimeError(f"Invalid published_at date in news row id {row.get('id')!r}; expected YYYY-MM-DD.")
        lines.append("|".join([
            published, field(row, "category", "General"), field(row, "title"),
            field(row, "summary"), field(row, "url"), field(row, "politician_id"),
        ]))
    write_file("news.txt", "\n".join(lines))


def main() -> int:
    if not SUPABASE_URL.startswith("https://"):
        raise RuntimeError("SUPABASE_URL must start with https://")
    # Fetch all three tables before writing any output, so a failed fetch doesn't
    # leave a partially updated set of files.
    politicians = fetch_rows("politicians", "id.asc")
    relations = fetch_rows("relations", "id.asc")
    news = fetch_rows("news", "published_at.desc.nullslast,id.desc")

    def write(name: str, lines: list[str]) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        target = DATA_DIR / name
        target.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8", newline="\n")
        print(f"Exported {target.relative_to(ROOT) if target.is_relative_to(ROOT) else target}: {sum(1 for line in lines if line and not line.startswith('#'))} data rows")

    p_lines = [
        "# Auto-generated from Supabase by .github/workflows/sync-supabase-txt.yml",
        "# Format: id|name|party|position|platform|track record",
    ]
    for row in politicians:
        p_lines.append("|".join([field(row, "id"), field(row, "name"), field(row, "party"), field(row, "position"), field(row, "platform"), field(row, "track_record")]))

    r_lines = [
        "# Auto-generated from Supabase by .github/workflows/sync-supabase-txt.yml",
        "# Family links between politicians. Format: id|id|type",
        '# Types: spouse, parent, sibling, cousin. For "parent", the FIRST id is the parent.',
        "# IDs come from politicians.txt. Lines starting with # are ignored.",
    ]
    for row in relations:
        r_lines.append("|".join([field(row, "person_a"), field(row, "person_b"), field(row, "relation_type")]))

    n_lines = [
        "# Auto-generated from Supabase by .github/workflows/sync-supabase-txt.yml",
        "# Format: date|category|title|summary|link (optional)|politician id (optional)",
        "# Date must be YYYY-MM-DD. Newest items appear first. Do not use the | character inside a field.",
        "# Write the summary in your own words and link to the original article.",
    ]
    for row in news:
        published = field(row, "published_at")
        if published:
            try:
                published = date.fromisoformat(published[:10]).isoformat()
            except ValueError:
                raise RuntimeError(f"Invalid published_at date in news row id {row.get('id')!r}; expected YYYY-MM-DD.")
        n_lines.append("|".join([published, field(row, "category", "General"), field(row, "title"), field(row, "summary"), field(row, "url"), field(row, "politician_id")]))

    # Validate basic IDs and references before touching files.
    politician_ids = {str(row.get("id")) for row in politicians}
    for row in relations:
        if str(row.get("person_a")) not in politician_ids or str(row.get("person_b")) not in politician_ids:
            raise RuntimeError(f"Relation id {row.get('id')} references a politician missing from the export.")
    write("politicians.txt", p_lines)
    write("relations.txt", r_lines)
    write("news.txt", n_lines)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
