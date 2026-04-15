#!/usr/bin/env python3
"""Load server/catalog.json + server/covers-map.json into Supabase (PostgREST).

Requires:
  export SUPABASE_URL=https://<project>.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=<service_role>   # recommended for catalog writes

Alternatively SUPABASE_ANON_KEY if you temporarily grant catalog INSERT (not recommended).

Replaces tracks for all works and upserts works. Does not delete lovecraft_works rows
(so lovecraft_work_ratings / lovecraft_work_comments are not CASCADE-wiped).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "server" / "catalog.json"
COVERS_PATH = ROOT / "server" / "covers-map.json"


def _request(
    url: str,
    key: str,
    path: str,
    method: str,
    body: bytes | None = None,
    extra_headers: dict[str, str] | None = None,
) -> None:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(
        f"{url.rstrip('/')}{path}",
        data=body,
        method=method,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status not in (200, 201, 204):
                raise RuntimeError(f"HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {err}") from e


def main() -> int:
    base = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip() or os.environ.get(
        "SUPABASE_ANON_KEY", ""
    ).strip()
    if not base or not key:
        print(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)",
            file=sys.stderr,
        )
        return 1

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf8"))
    covers: dict[str, str] = {}
    if COVERS_PATH.exists():
        covers = json.loads(COVERS_PATH.read_text(encoding="utf8"))

    works_raw = catalog.get("works") or []
    work_rows = []
    track_rows = []

    for sort_order, w in enumerate(works_raw):
        slug = w["slug"]
        title_sv = w["title_sv"]
        tracks = w.get("tracks") or []
        work_rows.append(
            {
                "slug": slug,
                "title_sv": title_sv,
                "original_title_en": w.get("original_title_en"),
                "description_sv": w["description_sv"],
                "sort_order": sort_order,
                "cover_filename": covers.get(slug),
            }
        )
        for part_index, filename in enumerate(tracks):
            title_track = (
                f"{title_sv} — del {part_index + 1}" if len(tracks) > 1 else title_sv
            )
            track_rows.append(
                {
                    "work_slug": slug,
                    "sort_order": part_index,
                    "filename": filename,
                    "title_sv": title_track,
                }
            )

    # Remove all tracks (does not delete works → preserves ratings/comments FK targets)
    _request(
        base,
        key,
        "/rest/v1/lovecraft_tracks?filename=not.is.null",
        "DELETE",
        extra_headers={"Prefer": "count=exact"},
    )

    if work_rows:
        payload = json.dumps(work_rows, ensure_ascii=False).encode("utf-8")
        _request(
            base,
            key,
            "/rest/v1/lovecraft_works?on_conflict=slug",
            "POST",
            body=payload,
            extra_headers={
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
        )

    if track_rows:
        payload = json.dumps(track_rows, ensure_ascii=False).encode("utf-8")
        _request(base, key, "/rest/v1/lovecraft_tracks", "POST", payload)

    print(
        f"Loaded {len(work_rows)} lovecraft_works, {len(track_rows)} lovecraft_tracks"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
