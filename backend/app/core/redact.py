import re

_API_KEY_PARAM = re.compile(r"([?&]key=)[^&\s]+")


def redact_api_key(text: str) -> str:
    """Strips the value of a `key=` query param from a string before logging.

    httpx exceptions (e.g. HTTPStatusError) stringify to include the full request URL —
    for Google Maps/Places calls that URL carries `key=<GOOGLE_LOCATION_API_KEY>` in the
    clear. Logging `str(exc)` unredacted would put the key in plaintext in server logs.
    """
    return _API_KEY_PARAM.sub(r"\1***", text)
