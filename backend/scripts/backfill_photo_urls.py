"""One-off maintenance script: rewrite `image_url` values that still embed a raw Google
Places Photo URL (and therefore a Google API key, see api/routes/photo.py) into the
same-origin proxy URL format instead.

Idempotent — rows already migrated (or with no photo) don't match OLD_URL_PATTERN and are
skipped, so this is safe to re-run.

Usage: python scripts/backfill_photo_urls.py
"""

import re

from app.core.config import settings
from app.services.storage import client

OLD_URL_PATTERN = re.compile(r"maps\.googleapis\.com/maps/api/place/photo\?.*photo_reference=([^&]+)")


def _new_url(photo_reference: str) -> str:
    return f"{settings.api_base_url}/api/photo/{photo_reference}"


def backfill_table(table: str) -> int:
    resp = client.table(table).select("id, image_url").execute()
    updated = 0
    for row in resp.data:
        url = row.get("image_url")
        if not url:
            continue
        match = OLD_URL_PATTERN.search(url)
        if not match:
            continue
        client.table(table).update({"image_url": _new_url(match.group(1))}).eq("id", row["id"]).execute()
        updated += 1
    return updated


if __name__ == "__main__":
    for table_name in ("itinerary", "activity", "restaurant"):
        count = backfill_table(table_name)
        print(f"{table_name}: {count} row(s) migrated")
