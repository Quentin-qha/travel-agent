import json
import logging
import time
from datetime import date, timedelta
from math import asin, cos, radians, sin, sqrt

import httpx
from anthropic import Anthropic

from app.core.config import settings
from app.schemas.itinerary import (
    Activity,
    ActivityContent,
    City,
    DateRange,
    DayContent,
    DayItemsResponse,
    ItineraryContext,
    ItineraryCreateResponse,
    ItineraryDetail,
    ItineraryRequest,
    ItineraryResponse,
    Restaurant,
    RestaurantContent,
    TranslatedItinerary,
)
from app.services.storage import (
    check_edit_token,
    get_day_plan_ids,
    get_itinerary,
    get_itinerary_context,
    replace_day_items,
    replace_days,
    save_itinerary,
)

logger = logging.getLogger(__name__)

client = Anthropic(api_key=settings.anthropic_api_key)

GOOGLE_GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
GOOGLE_PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_PLACE_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"

# Enforced after geocoding (not just requested in the prompt) — the model's web
# search sometimes surfaces a reputable but distant excursion/landmark, so this
# is a hard backstop rather than a suggestion it can quietly ignore.
MAX_PLACE_DISTANCE_KM = 10.0

RESPONSE_SCHEMA = ItineraryResponse.model_json_schema()
DAY_ITEMS_RESPONSE_SCHEMA = DayItemsResponse.model_json_schema()
TRANSLATION_SCHEMA = TranslatedItinerary.model_json_schema()
DAY_TRANSLATION_SCHEMA = DayContent.model_json_schema()

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
        "- Rédige tous les textes (destination_country, summary, name, description, category, "
        "cuisine) exclusivement en français, quelle que soit la langue de tes sources web — "
        "traduis-les toi-même, ne recopie jamais un extrait anglais tel quel.\n"
        "- destination_city et destination_country sont tous les deux obligatoires et ne "
        "doivent jamais être vides : destination_city est le nom court de la ville demandée "
        "(ex. 'Paris'), sans le pays ; destination_country est le nom du pays (ex. 'France').\n"
        "- Pour chaque activité, estime une durée réaliste en minutes (duration_minutes) — "
        "trajets compris si pertinent.\n"
        "- Regroupe les activités et restaurants d'une même journée par proximité géographique, "
        "pour minimiser les déplacements : un jour = une zone cohérente de la ville, pas des "
        "lieux dispersés aux quatre coins.\n"
        f"- Toutes les activités et tous les restaurants doivent se trouver à moins de "
        f"{MAX_PLACE_DISTANCE_KM:g} km du centre de {request.city.name} — n'inclus rien de plus "
        "éloigné, même une excursion ou un site réputé, sauf si le voyageur l'a explicitement "
        "demandé dans les ambiances recherchées.\n"
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
        "- Laisse lat/lon et image_url à null, pour l'itinéraire comme pour chaque activité et "
        "chaque restaurant — ils sont calculés séparément après coup.\n"
        "- Répartis TOUTES les activités sur l'ensemble des jours du voyage listés ci-dessus : "
        "un planning réaliste par jour, sans journée vide ni surchargée (vise environ 4 à 8 "
        "heures d'activités par jour, hors repas).\n"
        "- Évite les suggestions génériques ou datées.\n\n"
        "Réponds uniquement selon le schéma fourni."
    )


def _build_partial_prompt(
    context: ItineraryContext,
    day_date: date,
    kept_activities: list[Activity],
    kept_restaurants: list[Restaurant],
    activities_to_add: int,
    restaurants_to_add: int,
) -> str:
    city_label = context.destination_city or context.destination_country
    trip_types = ", ".join(context.trip_types) if context.trip_types else "aucune préférence particulière"

    kept_lines = [
        f"- [Activité, {a.duration_minutes} min, {a.budget_level.value}] {a.name} — {a.description}"
        for a in kept_activities
    ] + [
        f"- [Restaurant, {r.cuisine}, {r.budget_level.value}] {r.name} — {r.description}" for r in kept_restaurants
    ]
    kept_block = "\n".join(kept_lines) if kept_lines else "(aucun — la journée est vide à part les nouveautés)"

    return (
        f"Tu ajustes UNE SEULE journée ({day_date.isoformat()}) d'un voyage déjà planifié à {city_label}, "
        f"pour {context.traveler_count} voyageur(s) en configuration '{context.traveler_type.value}'. "
        f"Ambiances recherchées : {trip_types}.\n\n"
        f"Éléments CONSERVÉS ce jour-là (ne pas les dupliquer ni les modifier — ils font déjà partie du "
        f"planning, tiens-en compte pour la logistique : horaires et zone géographique) :\n{kept_block}\n\n"
        f"Propose EXACTEMENT {activities_to_add} nouvelle(s) activité(s) et {restaurants_to_add} nouveau(x) "
        f"restaurant(s) pour compléter cette journée à la place de ce qui a été retiré.\n\n"
        "RÈGLES :\n"
        "- Rédige tous les textes (name, description, category, cuisine) exclusivement en français, "
        "quelle que soit la langue de tes sources web — traduis-les toi-même, ne recopie jamais un "
        "extrait anglais tel quel.\n"
        "- Cohérence géographique avec les éléments conservés : reste dans la même zone/quartier autant "
        "que possible, pour minimiser les déplacements.\n"
        f"- Les nouveautés doivent se trouver à moins de {MAX_PLACE_DISTANCE_KM:g} km du centre de "
        f"{city_label} — n'inclus rien de plus éloigné.\n"
        "- Faisabilité temporelle : le temps total de la journée (éléments conservés + nouveaux) doit "
        "rester réaliste (environ 4 à 8 heures d'activités, hors repas) — ne surcharge pas la journée.\n"
        "- N'invente rien de similaire ou redondant avec les éléments conservés.\n"
        "- Utilise la recherche web pour trouver des lieux réels, ouverts, adaptés au profil et aux "
        "ambiances recherchées.\n"
        "- budget_level réaliste ('gratuit', '€', '€€', '€€€').\n"
        "- source_url doit être l'URL exacte d'un résultat de recherche web réellement consulté — jamais "
        "inventée. N'inclus un élément que si tu as une source réelle à citer.\n"
        "- location_query : nom court et exact du lieu pour le géocodage, distinct de 'name'.\n"
        "- Laisse lat/lon et image_url à null.\n\n"
        "Réponds uniquement selon le schéma fourni."
    )


def _request_params(messages: list[dict], schema: dict, use_search: bool = True) -> dict:
    model = settings.claude_model
    supports_adaptive = model in MODELS_WITH_ADAPTIVE_FEATURES

    params: dict = {
        "model": model,
        "max_tokens": 16000,
        "output_config": {"format": {"type": "json_schema", "schema": schema}},
        "messages": messages,
    }

    if use_search:
        params["tools"] = [
            {
                "type": "web_search_20260209" if supports_adaptive else "web_search_20250305",
                "name": "web_search",
                "max_uses": 4,
            }
        ]

    if supports_adaptive:
        params["thinking"] = {"type": "adaptive"}
        params["output_config"]["effort"] = "medium"

    return params


def _run(messages: list[dict], schema: dict, use_search: bool = True):
    # Streaming avoids SDK HTTP timeouts at this max_tokens size.
    with client.messages.stream(**_request_params(messages, schema, use_search)) as stream:
        return stream.get_final_message()


def _run_to_completion(messages: list[dict], schema: dict = RESPONSE_SCHEMA, use_search: bool = True):
    response = _run(messages, schema, use_search)

    # The server-side web_search loop pauses after its default iteration cap;
    # resending the assistant turn resumes it automatically.
    while response.stop_reason == "pause_turn":
        messages.append({"role": "assistant", "content": response.content})
        response = _run(messages, schema, use_search)

    if response.stop_reason == "refusal":
        raise RuntimeError("La génération a été refusée par les garde-fous du modèle.")
    if response.stop_reason == "max_tokens":
        raise RuntimeError(
            "La réponse a été tronquée avant la fin (max_tokens atteint) — augmente max_tokens."
        )

    return response


def _geocode_once(query: str) -> tuple[float, float, str | None] | None:
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
        result = data["results"][0]
        location = result["geometry"]["location"]
        return float(location["lat"]), float(location["lng"]), result.get("place_id")
    except (KeyError, ValueError, TypeError) as exc:
        logger.warning("Unexpected geocoding response shape for %r: %s", query, exc)
        return None


def _geocode(query: str, retries: int = 1) -> tuple[float, float, str | None] | None:
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


def _find_place(query: str) -> tuple[float, float, str | None] | None:
    """Places 'Find Place From Text' — matches a named venue (restaurant, landmark)
    by name, unlike the Geocoding API which is built for parsing addresses. For a
    restaurant name that isn't a clean postal address, Geocoding often resolves to
    the wrong nearby place_id, which then pulls the wrong establishment's photo."""
    try:
        resp = httpx.get(
            GOOGLE_FIND_PLACE_URL,
            params={
                "input": query,
                "inputtype": "textquery",
                "fields": "place_id,geometry",
                "key": settings.google_location_api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Find place request failed for %r: %s", query, exc)
        return None
    if data.get("status") != "OK":
        return None
    candidates = data.get("candidates") or []
    if not candidates:
        return None
    try:
        location = candidates[0]["geometry"]["location"]
        return float(location["lat"]), float(location["lng"]), candidates[0].get("place_id")
    except (KeyError, ValueError, TypeError) as exc:
        logger.warning("Unexpected find place response shape for %r: %s", query, exc)
        return None


def _fetch_place_photo_url(place_id: str) -> str | None:
    """First Google Places photo for a place_id already resolved via geocoding —
    no separate Places text search needed, just one Place Details lookup."""
    try:
        resp = httpx.get(
            GOOGLE_PLACE_DETAILS_URL,
            params={"place_id": place_id, "fields": "photos", "key": settings.google_location_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Place details request failed for %r: %s", place_id, exc)
        return None
    if data.get("status") != "OK":
        logger.warning("Place details failed for %r: status=%s", place_id, data.get("status"))
        return None
    photos = data.get("result", {}).get("photos") or []
    photo_reference = photos[0].get("photo_reference") if photos else None
    if not photo_reference:
        return None
    return (
        f"{GOOGLE_PLACE_PHOTO_URL}?maxwidth=800&photo_reference={photo_reference}"
        f"&key={settings.google_location_api_key}"
    )


def _geocode_place(destination: str, place: Activity | Restaurant) -> None:
    result = _find_place(f"{place.name}, {destination}") or _geocode(f"{place.location_query}, {destination}")
    if result is None:
        return
    place.lat, place.lon, place_id = result
    if place_id:
        place.image_url = _fetch_place_photo_url(place_id)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlambda / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(a))


def _is_within_range(place: Activity | Restaurant, origin_lat: float, origin_lon: float) -> bool:
    if place.lat is None or place.lon is None:
        return True  # Ungeocoded — nothing to judge distance against, let it through.
    return _haversine_km(origin_lat, origin_lon, place.lat, place.lon) <= MAX_PLACE_DISTANCE_KM


def _filter_by_distance(
    activities: list[Activity], restaurants: list[Restaurant], origin_lat: float, origin_lon: float
) -> tuple[list[Activity], list[Restaurant]]:
    kept_activities = [a for a in activities if _is_within_range(a, origin_lat, origin_lon)]
    kept_restaurants = [r for r in restaurants if _is_within_range(r, origin_lat, origin_lon)]
    dropped = (len(activities) - len(kept_activities)) + (len(restaurants) - len(kept_restaurants))
    if dropped:
        logger.warning("Dropped %d place(s) beyond %gkm of the destination", dropped, MAX_PLACE_DISTANCE_KM)
    return kept_activities, kept_restaurants


def _geocode_itinerary(destination: str, itinerary: ItineraryResponse, origin_lat: float, origin_lon: float) -> None:
    for day in itinerary.days:
        for activity in day.activities:
            _geocode_place(destination, activity)
        for restaurant in day.restaurants:
            _geocode_place(destination, restaurant)
        day.activities, day.restaurants = _filter_by_distance(
            day.activities, day.restaurants, origin_lat, origin_lon
        )


def _fetch_destination_image(city_label: str) -> str | None:
    result = _geocode(city_label)
    if result is None:
        return None
    _, _, place_id = result
    return _fetch_place_photo_url(place_id) if place_id else None


def _build_translation_prompt(payload: dict) -> str:
    return (
        "Traduis ce contenu de voyage du français vers l'anglais, en gardant EXACTEMENT la même "
        "structure : même nombre de jours, même nombre d'activités et de restaurants par jour, "
        "dans le même ordre — le résultat est réinjecté par position, un décalage casserait tout. "
        "Ne traduis pas les noms propres de lieux/monuments s'ils n'ont pas de forme anglaise "
        "usuelle ; utilise la forme anglaise standard quand elle existe (ex. 'Tour Eiffel' -> "
        "'Eiffel Tower'). Garde un ton naturel, pas une traduction mot à mot.\n\n"
        f"Contenu à traduire (JSON) :\n{json.dumps(payload, ensure_ascii=False)}\n\n"
        "Réponds uniquement selon le schéma fourni."
    )


def _itinerary_translation_payload(itinerary: ItineraryResponse) -> dict:
    return {
        "destination_city": itinerary.destination_city,
        "destination_country": itinerary.destination_country,
        "summary": itinerary.summary,
        "days": [_day_translation_payload(day.activities, day.restaurants) for day in itinerary.days],
    }


def _day_translation_payload(activities: list[Activity], restaurants: list[Restaurant]) -> dict:
    return {
        "activities": [{"name": a.name, "description": a.description, "category": a.category} for a in activities],
        "restaurants": [
            {"name": r.name, "description": r.description, "cuisine": r.cuisine} for r in restaurants
        ],
    }


def _translate_with_retry(prompt: str, schema: dict, model_cls, retries: int = 1):
    """Runs a translation call, retrying on failure. Translation calls are cheap (no
    web search, no thinking) so absorbing a transient API error this way is low-cost —
    same rationale as _geocode's retry for the same class of intermittent failure."""
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = _run_to_completion([{"role": "user", "content": prompt}], schema, use_search=False)
            text_block = next(block.text for block in response.content if block.type == "text")
            return model_cls.model_validate(json.loads(text_block))
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                logger.warning("Translation attempt %d failed, retrying: %s", attempt + 1, exc)
    logger.error("Translation failed after %d attempt(s): %s", retries + 1, last_error)
    return None


def _translate_to_english(itinerary: ItineraryResponse) -> TranslatedItinerary | None:
    prompt = _build_translation_prompt(_itinerary_translation_payload(itinerary))
    translated = _translate_with_retry(prompt, TRANSLATION_SCHEMA, TranslatedItinerary)
    if translated is None:
        logger.warning("English translation failed — falling back to French-only for this itinerary")
        return None

    if len(translated.days) != len(itinerary.days):
        logger.warning("Translation day-count mismatch — falling back to French-only for this itinerary")
        return None
    for day, translated_day in zip(itinerary.days, translated.days):
        if len(translated_day.activities) != len(day.activities) or len(translated_day.restaurants) != len(
            day.restaurants
        ):
            logger.warning("Translation item-count mismatch — falling back to French-only for this itinerary")
            return None

    return translated


def _translate_day_items(activities: list[Activity], restaurants: list[Restaurant]) -> DayContent | None:
    if not activities and not restaurants:
        return DayContent(activities=[], restaurants=[])

    prompt = _build_translation_prompt(_day_translation_payload(activities, restaurants))
    translated = _translate_with_retry(prompt, DAY_TRANSLATION_SCHEMA, DayContent)
    if translated is None:
        logger.warning("English translation failed for regenerated day items — falling back to French-only")
        return None

    if len(translated.activities) != len(activities) or len(translated.restaurants) != len(restaurants):
        logger.warning("Translation item-count mismatch for regenerated day — falling back to French-only")
        return None

    return translated


def _apply_translation(
    itinerary: ItineraryResponse, translated: TranslatedItinerary | None, lang: str
) -> ItineraryResponse:
    """In-memory equivalent of storage.py's locale merge, for the rare case where the
    generated itinerary couldn't be persisted (so there's no row to re-read via get_itinerary)."""
    if lang != "en" or translated is None:
        return itinerary

    days = []
    for day, translated_day in zip(itinerary.days, translated.days):
        activities = [
            activity.model_copy(update={"name": t.name, "description": t.description, "category": t.category})
            for activity, t in zip(day.activities, translated_day.activities)
        ]
        restaurants = [
            restaurant.model_copy(update={"name": t.name, "description": t.description, "cuisine": t.cuisine})
            for restaurant, t in zip(day.restaurants, translated_day.restaurants)
        ]
        days.append(day.model_copy(update={"activities": activities, "restaurants": restaurants}))

    return itinerary.model_copy(
        update={
            "destination_city": translated.destination_city,
            "destination_country": translated.destination_country,
            "summary": translated.summary,
            "days": days,
        }
    )


def generate_itinerary(request: ItineraryRequest, lang: str = "fr") -> ItineraryCreateResponse:
    messages: list[dict] = [{"role": "user", "content": _build_prompt(request)}]
    response = _run_to_completion(messages)

    text_block = next(block.text for block in response.content if block.type == "text")
    data = json.loads(text_block)
    itinerary = ItineraryResponse.model_validate(data)

    _geocode_itinerary(request.city.name, itinerary, request.city.lat, request.city.lon)
    itinerary.image_url = _fetch_destination_image(request.city.label)
    translated = _translate_to_english(itinerary)

    itinerary_id: str | None = None
    edit_token: str | None = None
    try:
        itinerary_id, edit_token = save_itinerary(request, itinerary, translated)
    except Exception:
        # Persistence is a side effect — don't fail the request over it.
        logger.exception("Failed to save itinerary to Supabase")

    if itinerary_id is not None:
        detail = get_itinerary(itinerary_id, locale=lang, edit_token=edit_token)
        assert detail is not None  # we just saved it
        return ItineraryCreateResponse(
            **detail.model_dump(exclude={"id", "trip_types", "can_edit"}),
            id=itinerary_id,
            trip_types=request.trip_types,
            edit_token=edit_token,
        )

    localized = _apply_translation(itinerary, translated, lang)
    return ItineraryCreateResponse(**localized.model_dump(), id=None, trip_types=request.trip_types)


def _context_to_request(context: ItineraryContext) -> ItineraryRequest:
    city_name = context.destination_city or context.destination_country
    city_label = (
        f"{context.destination_city}, {context.destination_country}"
        if context.destination_city
        else context.destination_country
    )
    return ItineraryRequest(
        city=City(id="regen", name=city_name, label=city_label, lat=context.city_lat, lon=context.city_lon),
        date_range=DateRange(from_date=min(context.day_dates), to_date=max(context.day_dates)),
        traveler_type=context.traveler_type,
        traveler_count=context.traveler_count,
        trip_types=context.trip_types,
    )


def _regenerate_full(
    itinerary_id: str, context: ItineraryContext, lang: str = "fr", edit_token: str | None = None
) -> ItineraryDetail:
    request = _context_to_request(context)
    messages: list[dict] = [{"role": "user", "content": _build_prompt(request)}]
    response = _run_to_completion(messages)

    text_block = next(block.text for block in response.content if block.type == "text")
    itinerary = ItineraryResponse.model_validate(json.loads(text_block))
    _geocode_itinerary(request.city.name, itinerary, request.city.lat, request.city.lon)
    translated = _translate_to_english(itinerary)

    replace_days(itinerary_id, itinerary, translated)

    updated = get_itinerary(itinerary_id, locale=lang, edit_token=edit_token)
    if updated is None:
        raise RuntimeError("Itinéraire introuvable après régénération.")
    return updated


def _parse_item_keys(item_keys: list[str]) -> dict[int, dict[str, set[int]]]:
    """Card keys look like '2-activity-0' (day_number-kind-index) — see ItineraryMapView.tsx."""
    replace_by_day: dict[int, dict[str, set[int]]] = {}
    for key in item_keys:
        try:
            day_str, kind, index_str = key.split("-")
            day_number, index = int(day_str), int(index_str)
        except ValueError:
            continue
        if kind not in ("activity", "restaurant"):
            continue
        replace_by_day.setdefault(day_number, {}).setdefault(kind, set()).add(index)
    return replace_by_day


def _merge_by_index(original: list, replaced_indices: set[int], new_items: list) -> list:
    new_iter = iter(new_items)
    merged = []
    for i, item in enumerate(original):
        if i in replaced_indices:
            replacement = next(new_iter, None)
            if replacement is not None:
                merged.append(replacement)
            # else: model returned fewer items than requested — that slot is simply dropped.
        else:
            merged.append(item)
    return merged


def _regenerate_partial(
    itinerary_id: str,
    context: ItineraryContext,
    item_keys: list[str],
    lang: str = "fr",
    edit_token: str | None = None,
) -> ItineraryDetail:
    # Kept items' French text drives the regeneration prompt (see module note on
    # get_itinerary_context); their English text (if any) is carried over as-is into
    # the new day rows, since replace_day_items re-inserts the whole day.
    current = get_itinerary(itinerary_id, locale="fr")
    if current is None:
        raise RuntimeError("Itinéraire introuvable.")
    current_en = get_itinerary(itinerary_id, locale="en")
    en_days_by_number = {day.day_number: day for day in current_en.days} if current_en else {}

    replace_by_day = _parse_item_keys(item_keys)
    day_plan_ids = get_day_plan_ids(itinerary_id)
    city_name = context.destination_city or context.destination_country

    for day in current.days:
        replace = replace_by_day.get(day.day_number)
        if not replace:
            continue

        replace_activity_idx = replace.get("activity", set())
        replace_restaurant_idx = replace.get("restaurant", set())
        if not replace_activity_idx and not replace_restaurant_idx:
            continue

        kept_activities = [a for i, a in enumerate(day.activities) if i not in replace_activity_idx]
        kept_restaurants = [r for i, r in enumerate(day.restaurants) if i not in replace_restaurant_idx]

        prompt = _build_partial_prompt(
            context,
            day.date,
            kept_activities,
            kept_restaurants,
            len(replace_activity_idx),
            len(replace_restaurant_idx),
        )
        response = _run_to_completion([{"role": "user", "content": prompt}], DAY_ITEMS_RESPONSE_SCHEMA)
        text_block = next(block.text for block in response.content if block.type == "text")
        day_items = DayItemsResponse.model_validate(json.loads(text_block))

        new_activities = day_items.activities[: len(replace_activity_idx)]
        new_restaurants = day_items.restaurants[: len(replace_restaurant_idx)]
        if len(new_activities) < len(replace_activity_idx) or len(new_restaurants) < len(replace_restaurant_idx):
            logger.warning("Regeneration returned fewer items than requested for day %s", day.day_number)

        for activity in new_activities:
            _geocode_place(city_name, activity)
        for restaurant in new_restaurants:
            _geocode_place(city_name, restaurant)
        new_activities, new_restaurants = _filter_by_distance(
            new_activities, new_restaurants, context.city_lat, context.city_lon
        )

        final_activities = _merge_by_index(day.activities, replace_activity_idx, new_activities)
        final_restaurants = _merge_by_index(day.restaurants, replace_restaurant_idx, new_restaurants)

        translated_new = _translate_day_items(new_activities, new_restaurants)
        final_day_en: DayContent | None = None
        if translated_new is not None:
            en_day = en_days_by_number.get(day.day_number)
            en_activities = [
                ActivityContent(name=a.name, description=a.description, category=a.category)
                for a in (en_day.activities if en_day else day.activities)
            ]
            en_restaurants = [
                RestaurantContent(name=r.name, description=r.description, cuisine=r.cuisine)
                for r in (en_day.restaurants if en_day else day.restaurants)
            ]
            final_day_en = DayContent(
                activities=_merge_by_index(en_activities, replace_activity_idx, translated_new.activities),
                restaurants=_merge_by_index(en_restaurants, replace_restaurant_idx, translated_new.restaurants),
            )

        day_plan_id = day_plan_ids.get(day.day_number)
        if day_plan_id:
            replace_day_items(day_plan_id, final_activities, final_restaurants, final_day_en)

    updated = get_itinerary(itinerary_id, locale=lang, edit_token=edit_token)
    if updated is None:
        raise RuntimeError("Itinéraire introuvable après régénération.")
    return updated


def regenerate_itinerary(
    itinerary_id: str, item_keys: list[str], lang: str = "fr", edit_token: str | None = None
) -> ItineraryDetail:
    if not check_edit_token(itinerary_id, edit_token):
        raise PermissionError("Jeton d'édition invalide ou manquant.")

    context = get_itinerary_context(itinerary_id)
    if context is None:
        raise ValueError("Itinéraire introuvable.")

    current = get_itinerary(itinerary_id, locale="fr")
    if current is None:
        raise ValueError("Itinéraire introuvable.")

    total_items = sum(len(day.activities) + len(day.restaurants) for day in current.days)
    if len(set(item_keys)) >= total_items:
        return _regenerate_full(itinerary_id, context, lang, edit_token)
    return _regenerate_partial(itinerary_id, context, item_keys, lang, edit_token)
