import json
import logging
import time
from datetime import timedelta

import httpx
from anthropic import Anthropic

from app.core.config import settings
from app.schemas.itinerary import Activity, ItineraryRequest, ItineraryResponse, Restaurant
from app.services.storage import save_itinerary

logger = logging.getLogger(__name__)

client = Anthropic(api_key=settings.anthropic_api_key)

GOOGLE_GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"

RESPONSE_SCHEMA = ItineraryResponse.model_json_schema()

# Models that support adaptive thinking, output_config.effort, and the
# dynamic-filtering web_search_20260209 tool. Older/lighter models
# (e.g. claude-haiku-4-5) error on these params — use the basic fallbacks.
MODELS_WITH_ADAPTIVE_FEATURES = {
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
}


def _build_prompt(request: ItineraryRequest) -> str:
    trip_types = ", ".join(request.trip_types) if request.trip_types else "aucune préférence particulière"
    day_count = (request.date_range.to_date - request.date_range.from_date).days + 1
    day_dates = "\n".join(
        f"Jour {i + 1} : {(request.date_range.from_date + timedelta(days=i)).isoformat()}"
        for i in range(day_count)
    )
    return (
        f"Propose un planning de voyage détaillé, jour par jour, à {request.city.name} "
        f"({request.city.label}), du {request.date_range.from_date.isoformat()} "
        f"au {request.date_range.to_date.isoformat()} ({day_count} jour(s)), "
        f"pour {request.traveler_count} voyageur(s) en configuration '{request.traveler_type.value}'. "
        f"Ambiances recherchées : {trip_types}.\n\n"
        f"Jours du voyage :\n{day_dates}\n\n"
        "Utilise la recherche web pour trouver des activités et restaurants réels et actuels "
        "(lieux ouverts aux dates données ci-dessus, avis récents, adaptés à la période et au "
        "profil de voyageurs).\n\n"
        "RÈGLES :\n"
        "- Pour chaque activité, estime une durée réaliste en minutes (duration_minutes) — "
        "trajets compris si pertinent.\n"
        "- Regroupe les activités et restaurants d'une même journée par proximité géographique, "
        "pour minimiser les déplacements : un jour = une zone cohérente de la ville, pas des "
        "lieux dispersés aux quatre coins.\n"
        "- Pour chaque jour, propose aussi 1 à 2 restaurants (déjeuner et/ou dîner) proches des "
        "activités de ce jour précis, ouverts, adaptés au profil et aux ambiances recherchées — "
        "les meilleures options disponibles dans le contexte, pas des choix génériques.\n"
        "- Pour chaque activité et chaque restaurant, indique budget_level : 'gratuit', '€' "
        "(économique), '€€' (intermédiaire) ou '€€€' (haut de gamme), selon le coût réel estimé.\n"
        "- Pour chaque activité et chaque restaurant, source_url doit être l'URL exacte d'un "
        "résultat de ta recherche web que tu as réellement consultée — jamais une URL inventée. "
        "N'inclus une activité ou un restaurant que si tu as une source réelle à citer.\n"
        "- Renseigne location_query : le nom court et exact du lieu tel qu'il apparaîtrait sur "
        "une carte (ex. 'Torre de Belém'), sans phrase descriptive ni plusieurs lieux combinés "
        "— sert uniquement au géocodage, distinct de 'name' qui peut rester descriptif.\n"
        "- Laisse lat/lon à null — ils sont calculés séparément après coup.\n"
        "- Répartis TOUTES les activités sur l'ensemble des jours du voyage listés ci-dessus : "
        "un planning réaliste par jour, sans journée vide ni surchargée (vise environ 4 à 8 "
        "heures d'activités par jour, hors repas).\n"
        "- Évite les suggestions génériques ou datées.\n\n"
        "Réponds uniquement selon le schéma fourni."
    )


def _request_params(messages: list[dict]) -> dict:
    model = settings.claude_model
    supports_adaptive = model in MODELS_WITH_ADAPTIVE_FEATURES

    web_search_tool = {
        "type": "web_search_20260209" if supports_adaptive else "web_search_20250305",
        "name": "web_search",
        "max_uses": 4,
    }

    params: dict = {
        "model": model,
        "max_tokens": 16000,
        "output_config": {"format": {"type": "json_schema", "schema": RESPONSE_SCHEMA}},
        "tools": [web_search_tool],
        "messages": messages,
    }

    if supports_adaptive:
        params["thinking"] = {"type": "adaptive"}
        params["output_config"]["effort"] = "medium"

    return params


def _run(messages: list[dict]):
    # Streaming avoids SDK HTTP timeouts at this max_tokens size.
    with client.messages.stream(**_request_params(messages)) as stream:
        return stream.get_final_message()


def _geocode_once(query: str) -> tuple[float, float] | None:
    try:
        resp = httpx.get(
            GOOGLE_GEOCODING_URL,
            params={"address": query, "key": settings.google_location_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Geocoding request failed for %r: %s", query, exc)
        return None
    if data.get("status") != "OK" or not data.get("results"):
        logger.warning(
            "Geocoding failed for %r: status=%s error_message=%s",
            query,
            data.get("status"),
            data.get("error_message"),
        )
        return None
    try:
        location = data["results"][0]["geometry"]["location"]
        return float(location["lat"]), float(location["lng"])
    except (KeyError, ValueError, TypeError) as exc:
        logger.warning("Unexpected geocoding response shape for %r: %s", query, exc)
        return None


def _geocode(query: str, retries: int = 1) -> tuple[float, float] | None:
    # Google API key restriction changes can take a few minutes to fully
    # propagate, causing sporadic REQUEST_DENIED on an otherwise-working key.
    # A short retry absorbs that kind of transient failure.
    for attempt in range(retries + 1):
        result = _geocode_once(query)
        if result is not None:
            return result
        if attempt < retries:
            time.sleep(1)
    return None


def _geocode_place(destination: str, place: Activity | Restaurant) -> None:
    coords = _geocode(f"{place.location_query}, {destination}")
    if coords is not None:
        place.lat, place.lon = coords


def _geocode_itinerary(destination: str, itinerary: ItineraryResponse) -> None:
    for day in itinerary.days:
        for activity in day.activities:
            _geocode_place(destination, activity)
        for restaurant in day.restaurants:
            _geocode_place(destination, restaurant)


def generate_itinerary(request: ItineraryRequest) -> ItineraryResponse:
    messages: list[dict] = [{"role": "user", "content": _build_prompt(request)}]
    response = _run(messages)

    # The server-side web_search loop pauses after its default iteration cap;
    # resending the assistant turn resumes it automatically.
    while response.stop_reason == "pause_turn":
        messages.append({"role": "assistant", "content": response.content})
        response = _run(messages)

    if response.stop_reason == "refusal":
        raise RuntimeError("La génération a été refusée par les garde-fous du modèle.")
    if response.stop_reason == "max_tokens":
        raise RuntimeError(
            "La réponse a été tronquée avant la fin (max_tokens atteint) — augmente max_tokens."
        )

    text_block = next(block.text for block in response.content if block.type == "text")
    data = json.loads(text_block)
    itinerary = ItineraryResponse.model_validate(data)

    _geocode_itinerary(request.city.name, itinerary)

    try:
        save_itinerary(request, itinerary)
    except Exception:
        # Persistence is a side effect — don't fail the request over it.
        logger.exception("Failed to save itinerary to Supabase")

    return itinerary
