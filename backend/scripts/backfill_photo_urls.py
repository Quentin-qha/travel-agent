"""One-off maintenance script: normalize every `image_url` to the proxy URL format
(`{settings.api_base_url}/api/photo/{photo_reference}`) — whether it's still a raw Google
Places Photo URL (embedding a Google API key, see api/routes/photo.py) or an already-proxied
URL pointing at a stale `api_base_url` (e.g. `localhost:8000`, left over from a backfill run
before API_BASE_URL was set to the real deployed backend URL).

Idempotent — rows already pointing at the current `settings.api_base_url` are left untouched,
so this is safe to re-run any time `api_base_url` changes (e.g. a future domain migration).

Usage: API_BASE_URL=https://your-backend-url python scripts/backfill_photo_urls.py
"""

import re

from app.core.config import settings
from app.services.storage import client

GOOGLE_URL_PATTERN = re.compile(r"maps\.googleapis\.com/maps/api/place/photo\?.*photo_reference=([^&]+)")
PROXY_URL_PATTERN = re.compile(r"/api/photo/([^/?&]+)$")


def _extract_reference(url: str) -> str | None:
    match = GOOGLE_URL_PATTERN.search(url) or PROXY_URL_PATTERN.search(url)
    return match.group(1) if match else None


def _new_url(photo_reference: str) -> str:
    return f"{settings.api_base_url}/api/photo/{photo_reference}"


def backfill_table(table: str) -> int:
    resp = client.table(table).select("id, image_url").execute()
    updated = 0
    for row in resp.data:
        url = row.get("image_url")
        if not url:
            continue
        reference = _extract_reference(url)
        if reference is None:
            continue
        correct_url = _new_url(reference)
        if url == correct_url:
            continue
        client.table(table).update({"image_url": correct_url}).eq("id", row["id"]).execute()
        updated += 1
    return updated


if __name__ == "__main__":
    print(f"Normalizing image_url to base: {settings.api_base_url}")
    for table_name in ("itinerary", "activity", "restaurant"):
        count = backfill_table(table_name)
        print(f"{table_name}: {count} row(s) migrated")
