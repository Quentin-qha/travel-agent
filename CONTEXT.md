# Contexte du projet — Travel Agent

> Ce fichier est destiné à donner à un nouvel agent (Claude ou autre) une vue complète du projet sans avoir à tout redécouvrir. Lis-le en entier avant de faire quoi que ce soit. Les chemins de fichiers sont donnés pour que tu puisses aller lire le code source exact quand tu as besoin de détails.

## Vue d'ensemble

Application web qui génère un **planning de voyage jour par jour** (activités + restaurants, avec budget et coordonnées GPS) à partir d'un formulaire simple (ville, dates, type de voyageurs, ambiances). La génération utilise l'API Claude avec recherche web réelle, pas de données inventées. Les résultats sont sauvegardés dans Supabase et consultables via une URL permanente (`/{id}`), listés dans une bibliothèque (`/library`), et **modifiables après coup** : régénération totale ou partielle (élément par élément) directement depuis la page du voyage.

**Architecture** : deux projets séparés dans le même repo, communiquant en HTTP.

```
┌─────────────────────┐         ┌──────────────────────┐        ┌─────────────┐
│  Frontend (Next.js)  │  HTTP   │  Backend (FastAPI)    │  HTTP  │  Supabase   │
│  src/ à la racine    │ ──────► │  backend/              │ ─────► │  (Postgres) │
│  port 3000           │         │  port 8000             │        └─────────────┘
└─────────────────────┘         └──────────┬────────────┘
                                            │ HTTP
                                            ▼
                                 ┌─────────────────────┐
                                 │  API Claude          │
                                 │  (web_search inclus) │
                                 └─────────────────────┘
                                            │
                                 ┌─────────────────────┐
                                 │  Google Geocoding    │
                                 │  API                 │
                                 └─────────────────────┘
```

Le backend fait **tout** le travail métier : appelle Claude, géocode les lieux, sauvegarde en base, régénère à la demande. Le frontend est fin — formulaire + affichage + carte, la logique de génération/régénération ne vit jamais côté client.

La carte (Leaflet, tuiles CARTO) est purement client-side — elle ne passe jamais par le backend, seules les coordonnées lat/lon déjà géocodées transitent par l'API.

---

## Stack technique

**Frontend** (racine du repo) :
- Next.js 16.3.1 (App Router, Turbopack) — ⚠️ **version récente avec breaking changes vs. les connaissances d'entraînement d'un modèle** : `params` dans les pages dynamiques est une `Promise`, il faut `await`. Le helper `PageProps<'/route'>` (global, généré automatiquement) sert à typer les props de page. **Avant de coder une feature Next.js non triviale, lire `node_modules/next/dist/docs/`** (voir `AGENTS.md` à la racine).
- React 19.2.8, TypeScript
- Tailwind CSS v4
- `date-fns` (dates, locale `fr`)
- `lucide-react` (icônes)
- `leaflet` + `react-leaflet` v5 (carte interactive sur la page `/[id]`) — voir section dédiée plus bas

**Backend** (`backend/`) :
- Python 3.12, FastAPI, Uvicorn
- `anthropic` (SDK officiel Claude)
- `supabase` (client officiel Python, communique avec Supabase via son API REST/PostgREST)
- `httpx` (appels à Google Geocoding)
- `pydantic` / `pydantic-settings`

**Base de données** : Supabase (projet nommé "Travel-planner", région `eu-west-2`), schéma dans `backend/supabase/migrations/0001_itinerary_schema.sql`.

**IA** : API Claude directement (pas Claude Code, pas Managed Agents) — un simple appel `messages.create/stream` avec l'outil serveur `web_search` et une sortie JSON structurée (`output_config.format`). Utilisée à la fois pour la génération initiale et pour les deux modes de régénération (voir plus bas).

**Géocodage** : Google Geocoding API (pas Nominatim/OpenStreetMap pour le géocodage des activités — abandonné après des blocages 403 peu fiables, voir section "Décisions" plus bas). Nominatim reste utilisé côté frontend pour l'autocomplete de ville (`CityAutocomplete.tsx`), et les tuiles de carte viennent de CARTO (basées sur les données OSM), pas de Google Maps.

---

## Structure des dossiers

```
travel-agent/
├── src/                          # Frontend Next.js (racine du repo)
│   ├── app/
│   │   ├── page.tsx              # "/" — formulaire (via TravelFormPage)
│   │   ├── [id]/page.tsx         # "/<n'importe quoi>" — voir logique UUID ci-dessous
│   │   ├── library/page.tsx      # "/library" — bibliothèque de tous les voyages générés
│   │   ├── layout.tsx
│   │   └── globals.css           # inclut la règle globale `button:not(:disabled) { cursor: pointer }`
│   └── components/travel-form/
│       ├── TravelForm.tsx        # Le formulaire multi-étapes + appel API + affichage résultat
│       ├── TravelFormPage.tsx    # Layout de page réutilisé par "/" et "/[id]" (cas non-UUID)
│       ├── ItineraryResultView.tsx  # Affichage "carte centrée" d'un itinéraire (utilisé uniquement juste après génération, dans TravelForm.tsx)
│       ├── ItineraryMapView.tsx  # Layout carte + sidebar de la page "/[id]" — le cœur de l'affichage détail (voir section dédiée)
│       ├── ItineraryMap.tsx      # Composant Leaflet pur (chargé en dynamic import, ssr:false) — markers, popups, fit bounds
│       ├── CityAutocomplete.tsx  # Recherche de ville via Nominatim (encore utilisé ici, pas pour le géocodage des activités)
│       ├── DateRangePicker.tsx
│       ├── TravelerPicker.tsx
│       ├── TripTypeSelect.tsx
│       ├── SummaryStep.tsx
│       ├── StepBullets.tsx
│       ├── StepFooter.tsx
│       └── types.ts              # Tous les types TS + constantes (TRIP_TYPES, TRAVELER_TYPES...) + helper `formatDestination`
│
├── backend/                      # Backend FastAPI (sous-projet Python indépendant)
│   ├── app/
│   │   ├── main.py               # App FastAPI, CORS, montage des routes, /health
│   │   ├── core/config.py        # Settings (pydantic-settings), lit backend/.env
│   │   ├── schemas/itinerary.py  # Tous les modèles Pydantic (requête + réponse + DB + régénération)
│   │   ├── services/
│   │   │   ├── itinerary_agent.py  # Appel Claude + géocodage + orchestration (génération ET régénération)
│   │   │   └── storage.py          # Lecture/écriture Supabase
│   │   └── api/routes/itinerary.py # Toutes les routes REST (voir liste plus bas)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env                      # Secrets (jamais commité — voir section env vars)
│   └── supabase/migrations/0001_itinerary_schema.sql  # Schéma DB, source de vérité (documentation — pas appliqué automatiquement)
│
├── .env.local                    # NEXT_PUBLIC_API_URL (frontend)
├── AGENTS.md / CLAUDE.md         # Avertissement Next.js "breaking changes" — à lire avant de coder du Next.js
└── package.json
```

---

## Frontend — détail

### Routing

- **`/`** → `TravelFormPage` sans nom → titre "Planifie ton voyage", avec un lien "Voir des idées voyages" vers `/library`
- **`/library`** → `LibraryPage` (Server Component) : `fetch(GET /api/itinerary)`, grille de cards (titre = ville, badge nombre de jours, résumé tronqué à 3 lignes via `line-clamp-3`, toute la card cliquable vers `/{id}`). État vide géré. Bouton "Nouveau voyage" vers `/`.
  - ⚠️ Le slug est volontairement en anglais (`library`, pas `bibliotheque`) — décision explicite de l'utilisateur, le contenu affiché reste en français.
- **`/<segment>`** (`src/app/[id]/page.tsx`) → teste le segment contre une regex UUID (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`) :
  - **Si UUID valide** → `fetch(GET /api/itinerary/{id})` côté serveur (Server Component), `notFound()` si 404, sinon passe `id` + `itinerary` à `ItineraryMapView` (Client Component)
  - **Si pas un UUID** (ex. `/quentin`) → affiche `TravelFormPage` avec `name` = le segment (première lettre mise en capitale) → titre "Salut Quentin, planifie ton voyage"

### Page détail d'un voyage — `ItineraryMapView.tsx` (le composant le plus dense du repo)

Layout plein écran (`h-svh`), split en deux :
- **Colonne gauche** (~420px desktop, pleine largeur + carte en haut sur mobile) : header sticky (destination, tags d'ambiance, résumé, boutons), puis la liste de **tous les jours en continu** sous forme de timeline verticale (pastille numérotée + ligne reliant chaque jour, pas de filtrage — contrairement à la carte).
- **Colonne droite** (3/4 desktop) : carte Leaflet (`ItineraryMap.tsx`, chargée en `next/dynamic(..., { ssr: false })` — Leaflet touche `window` au chargement, casse le rendu serveur sinon). Sélecteur de jour flottant en haut à gauche de la carte (`Tout` + `1`, `2`, `3`...) qui **filtre les pins affichés** et recadre la carte, sans jamais dé-filtrer la sidebar.

**Synchronisation carte ↔ sidebar** :
- Cliquer un pin → ouvre son popup + scroll + surligne la card correspondante dans la sidebar (clés `itemRefs`/`markerRefs` type `Map<string, HTMLElement>`).
- Cliquer une card → sélectionne l'item ; si son jour n'est pas celui affiché sur la carte, la carte re-filtre automatiquement sur ce jour (sauf en mode "Tout", qui n'est jamais désactivé par un clic sur un item).
- Cliquer un bouton de jour → scroll la sidebar jusqu'à la section du jour (offset calculé dynamiquement pour ne pas passer sous le header sticky) et marque le bouton actif.
- **Clés des cards/pins** : format `${day_number}-${"activity"|"restaurant"}-${index}` (ex. `2-activity-0`) — générées une fois par `buildPoints`/le rendu de la sidebar, **doivent rester préfixées par le jour** (sinon collision de clé React entre jours → bug déjà rencontré : popup qui reste ouvert après changement de jour). Ce même format de clé est réutilisé tel quel comme identifiant envoyé au backend pour la régénération partielle (voir plus bas) — **ne pas changer ce format sans mettre à jour `_parse_item_keys` côté backend**.

**Carte (`ItineraryMap.tsx`)** :
- Tuiles **CARTO Voyager** (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`) — gratuit, sans clé API, choisi pour un rendu "à la Google Maps" (eau bleue, routes jaune/blanc, parcs verts) mais épuré. D'autres styles CARTO existent si besoin (`light_all` = gris minimaliste "Positron", `dark_all` = sombre, chacun avec variante `_nolabels`).
- Markers = `L.divIcon` avec du HTML brut (pas de composant React ni d'image — évite le problème classique d'icônes Leaflet cassées avec les bundlers). Icône SVG inline à l'intérieur (chemins copiés à la main depuis `lucide-react` : pin pour activité, couverts croisés pour restaurant) — **si l'icône change côté sidebar, il faut mettre à jour `MARKER_ICON_PATHS` dans `ItineraryMap.tsx` à la main**, ce n'est pas une source unique.
- Couleurs : activité = violet `#7c3aed`, restaurant = **ambre** `#f59e0b` (pas rouge — un rouge se lit comme une couleur d'alerte, changé sur demande explicite).
- Pas de lien "Source" affiché ni sur les popups de la carte ni sur les cards de la sidebar (retiré sur demande) — **`source_url` reste stocké en base et renvoyé par l'API**, juste plus affiché dans l'UI. Si on veut le réafficher un jour, la donnée est toujours là.

**Mode édition / régénération** (crayon en haut à droite du titre) :
1. Clic sur le crayon → entre en mode édition : chaque activité/restaurant de la sidebar affiche une checkbox, **toutes cochées par défaut**. Le crayon (et le bouton partage à côté) disparaissent, remplacés par une **barre "Mode édition"** au-dessus du titre contenant le bouton d'action + une croix pour annuler. Un lien "Tout (dé)sélectionner" apparaît au-dessus de la liste des jours (bascule selon que tout est déjà coché ou non).
2. Le libellé du bouton d'action dépend du nombre d'éléments cochés :
   - Tous cochés → **"Régénérer"** → régénération complète du voyage (nouveau prompt entier, comme à la création).
   - Certains cochés (pas tous, au moins un) → **"Changer les éléments sélectionnés (N)"** → régénération partielle, jour par jour.
   - Aucun coché → bouton **désactivé**, libellé "Aucun élément sélectionné" — seule la croix (annuler) reste utilisable.
3. `POST /api/itinerary/{id}/regenerate` avec `{itemKeys: string[]}` (les clés cochées). Le backend décide seul full vs partiel (voir section backend). La réponse (un `ItineraryDetail` complet) remplace l'état local `itinerary` du composant — pas de rechargement de page.
4. Cliquer sur un item d'une card en édition **toggle sa checkbox** au lieu de faire l'interaction normale (sélection carte/scroll) — les deux comportements sont mutuellement exclusifs via la prop `editable`.

**Bouton partage** (icône `Share2`, à côté du crayon, visible seulement hors mode édition) : copie `window.location.href` dans le presse-papier (`navigator.clipboard.writeText`) et affiche un toast custom ("Lien de partage copié", position fixe bas d'écran, auto-disparition après 2s). Pas de librairie de toast — implémentation locale minimaliste (un seul `useState` bool + `setTimeout`), pas justifié d'ajouter une dépendance pour un seul cas d'usage.

### Flux de génération (`TravelForm.tsx`)

1. Formulaire 3 étapes (ville/dates/voyageurs → ambiances → résumé), état local `TravelFormData`
2. Au clic "Générer" (dernière étape) : `POST {NEXT_PUBLIC_API_URL}/api/itinerary` avec le body `{city, dateRange: {from, to} (format yyyy-MM-dd — important, pas de Date brute), travelerType, travelerCount, tripTypes}`
3. Pendant l'attente : bouton en état "Génération..." (peut prendre 30s à plusieurs minutes selon le modèle/effort configurés côté backend)
4. Réponse reçue (`ItineraryResult`, contient un `id` si la sauvegarde Supabase a réussi) → affichage via `ItineraryResultView` (la carte "centrée" classique, **pas** `ItineraryMapView` — ce composant-là n'est utilisé que sur `/[id]`) + lien "Lien permanent vers ce voyage" vers `/{id}`
5. En cas d'erreur (réseau, 502, refus du modèle) : message d'erreur affiché, pas de crash

### Types clés (`types.ts`)

- `TravelFormData` — état du formulaire
- `ItineraryResult` — réponse du `POST /api/itinerary` : `id`, `destination_city` (string, non-null), `destination_country`, `summary`, `trip_types: string[]`, `days`
- `ItineraryViewData` — forme partagée entre génération fraîche et relecture Supabase, consommée par `ItineraryResultView` **et** `ItineraryMapView` : `destination_city: string | null` (nullable ici pour tolérer les anciennes lignes), `destination_country`, `summary`, `trip_types`, `days`
- `ItinerarySummary` — forme légère pour la bibliothèque : `id`, `destination_city`, `destination_country`, `summary`, `day_count`, `created_at`
- `formatDestination(city, country)` — helper partagé qui renvoie `"Ville, Pays"` ou juste `"Pays"` si la ville est absente ; utilisé partout où on affiche la destination, pour ne plus jamais dupliquer cette logique.

✅ **Ancien piège résolu** : `destination_city`/`destination_country` sont maintenant deux colonnes distinctes en base (`itinerary.destination_city`, `itinerary.destination_country` — anciennement une seule colonne `destination_name`). Les deux flux (génération fraîche et lecture GET) renvoient exactement la même forme, `ItineraryViewData` n'a plus besoin de "aplatir" quoi que ce soit.

---

## Backend — détail

### `main.py`
App FastAPI, CORS ouvert vers `http://localhost:3000` (configurable via `CORS_ALLOW_ORIGINS`), toutes les routes métier sous `/api`, `/health` pour un check simple.

### `core/config.py`
Toute la config vient de `backend/.env` (jamais commité). Champs requis : `anthropic_api_key`, `google_location_api_key`, `supabase_url`, `supabase_service_role_key`. `claude_model` a une valeur par défaut (changée plusieurs fois pendant le dev pour arbitrer coût/vitesse/qualité).

### `schemas/itinerary.py`
Modèles Pydantic, tous avec `extra="forbid"` (important pour la sortie structurée Claude — génère `additionalProperties: false` dans le JSON Schema).

- **Entrée génération** : `ItineraryRequest` (`city`, `date_range`, `traveler_type`, `traveler_count`, `trip_types`) — miroir exact du JSON envoyé par le frontend, alias camelCase (`dateRange`, `travelerType`...)
- **Sortie génération (schéma structuré donné à Claude)** : `ItineraryResponse` (`destination_city: str` obligatoire, `destination_country`, `summary`, `days: list[DayPlan]`) → `RESPONSE_SCHEMA = ItineraryResponse.model_json_schema()`. `destination_city` est **obligatoire, jamais nullable** ici — le prompt force explicitement Claude à toujours le remplir (voir "Décisions").
  - `DayPlan` : `day_number`, `date`, `activities: list[Activity]`, `restaurants: list[Restaurant]`
  - `Activity` : `name`, `location_query` (nom court pour géocodage, distinct de `name` qui peut être descriptif), `description`, `category`, `duration_minutes`, `budget_level` (enum `gratuit`/`€`/`€€`/`€€€`), `source_url` (**obligatoire**, doit être une vraie URL de résultat de recherche web — toujours stocké, plus affiché côté UI), `lat`/`lon` (nullable, remplis après coup par le géocodage)
  - `Restaurant` : identique à `Activity` mais `cuisine` au lieu de `category`
- `ItineraryCreateResponse` = `ItineraryResponse` + `id` (id Supabase) + `trip_types: list[str]` (**échoué depuis la requête, jamais généré par Claude** — l'utilisateur a déjà choisi ces tags dans le formulaire)
- `ItineraryDetail` = ce que renvoie le GET (et la régénération) : `id`, `destination_city` (nullable — tolère les lignes créées avant que ce champ existe), `destination_country`, `summary`, `trip_types`, `days`
- `ItinerarySummary` — forme légère pour `GET /api/itinerary` (liste) : pas d'activités/restaurants, juste `id`, `destination_city`, `destination_country`, `summary`, `day_count`, `created_at`
- `RegenerateItineraryRequest` — body de `POST /api/itinerary/{id}/regenerate` : `item_keys: list[str]` (alias JSON `itemKeys`), format `"{day_number}-{activity|restaurant}-{index}"` — voir section frontend pour l'origine de ce format.
- `ItineraryContext` — modèle interne (jamais exposé via l'API), reconstruit à partir de la base pour ré-générer : ville/coordonnées, `traveler_type`/`traveler_count` (fallback `solo`/`1` si absents — anciennes lignes), `trip_types`, dates de chaque jour.
- `DayItemsResponse` — schéma structuré interne utilisé **uniquement** pour la régénération partielle (un seul jour à la fois) : `activities: list[Activity]` + `restaurants: list[Restaurant]`, sans `destination_city`/`summary`/etc.

### `services/itinerary_agent.py` — le cœur de l'agent

Fonctions internes partagées entre génération et régénération :
- `_run_to_completion(messages, schema=RESPONSE_SCHEMA)` : boucle d'appel Claude générique (streaming, gère `pause_turn`/`refusal`/`max_tokens`), paramétrée par le schéma JSON de sortie attendu — réutilisée pour la génération complète (`RESPONSE_SCHEMA`) et la régénération partielle (`DAY_ITEMS_RESPONSE_SCHEMA`).
- `_geocode_itinerary`/`_geocode_place`/`_geocode` : géocodage Google, retry 1 fois (propagation des restrictions de clé API), inchangés.

**`generate_itinerary(request) -> ItineraryCreateResponse`** (génération initiale) :
1. `_build_prompt(request)` : liste chaque jour avec sa date exacte, règles précises (proximité géographique par jour, 1-2 restaurants/jour, `budget_level` réaliste, `source_url` réelle, `location_query` distinct de `name`, `lat`/`lon` laissés `null`, **`destination_city`/`destination_country` tous les deux obligatoires**, 4-8h d'activités/jour).
2. `_run_to_completion` avec `RESPONSE_SCHEMA`, parse le JSON en `ItineraryResponse`.
3. Géocode tout, sauvegarde (`save_itinerary` — best-effort, ne bloque jamais la réponse si Supabase est down).
4. Renvoie `ItineraryCreateResponse` avec `trip_types` échoué depuis `request`.

**`regenerate_itinerary(itinerary_id, item_keys) -> ItineraryDetail`** (point d'entrée de la régénération, appelé par la route) :
1. Reconstruit le contexte original (`get_itinerary_context`) et l'itinéraire courant (`get_itinerary`).
2. Compare `len(set(item_keys))` au nombre total d'items existants : **tout sélectionné → régénération complète** (`_regenerate_full`), **sinon → partielle** (`_regenerate_partial`). Le frontend ne décide jamais lui-même du mode — il envoie juste les clés cochées.

**`_regenerate_full(itinerary_id, context)`** : reconstruit un `ItineraryRequest` équivalent à partir du contexte stocké (`_context_to_request` — ville/coordonnées/dates/voyageurs/ambiances), relance exactement le même prompt que `generate_itinerary`, géocode, puis `replace_days` (supprime tous les `day_plan` existants — cascade sur activity/restaurant — et réinsère tout). Résumé et destination sont rafraîchis.

**`_regenerate_partial(itinerary_id, context, item_keys)`** : pour chaque **jour concerné uniquement** :
1. `_parse_item_keys` regroupe les clés par jour/type/index.
2. Sépare les éléments **conservés** (non cochés) des éléments **à remplacer** (cochés) — les conservés ne sont jamais renvoyés à Claude pour modification, juste listés comme contexte.
3. `_build_partial_prompt` : prompt scopé à une seule journée, donne la liste des éléments conservés (nom, durée/cuisine, budget, description) et demande **exactement** N nouvelles activités + M nouveaux restaurants, avec des règles explicites de **cohérence géographique** (même zone que les éléments conservés) et de **faisabilité temporelle** (temps total de la journée réaliste, ~4-8h) — c'est la partie qui répond directement à la demande "attention à ce que ce soit faisable en termes de temps et de localisation".
4. Appelle Claude avec `DAY_ITEMS_RESPONSE_SCHEMA` (web_search inclus), géocode uniquement les nouveaux éléments (les conservés gardent leurs coordonnées).
5. `_merge_by_index` réinjecte les nouveaux éléments à la position des anciens (ordre préservé autant que possible) ; si Claude renvoie moins d'éléments que demandé, le slot est simplement abandonné (pas de crash).
6. `replace_day_items` : supprime puis réinsère les activités/restaurants de **ce jour précis seulement** (les autres jours ne sont jamais touchés).
7. ⚠️ Le résumé global du voyage (`itinerary.summary`) **n'est pas rafraîchi** lors d'une régénération partielle (seule la régénération complète le fait) — simplification assumée pour éviter un appel Claude supplémentaire à chaque petit changement.

### `services/storage.py`

- `save_itinerary(request, itinerary) -> str` : insère `itinerary` (avec `trip_types`, `traveler_type`, `traveler_count`), puis délègue à `_insert_days` (helper partagé, extrait pour être réutilisé par la régénération complète).
- `get_itinerary(itinerary_id) -> ItineraryDetail | None` : relit tout (itinerary → day_plan → activity/restaurant), reconstruit champ par champ (pas de `model_validate(dict_brut)` — les lignes Supabase ont des colonnes en plus que `extra="forbid"` rejetterait).
- `list_itineraries() -> list[ItinerarySummary]` : une seule requête avec embed PostgREST `day_plan(day_number)` pour compter les jours sans requête N+1.
- `get_itinerary_context(itinerary_id) -> ItineraryContext | None` : reconstruit les paramètres de la requête d'origine pour la régénération (voir schémas). Fallback `solo`/`1` si `traveler_type`/`traveler_count` sont `null` (anciennes lignes).
- `replace_days(itinerary_id, itinerary)` : régénération complète — update destination/summary, supprime tous les `day_plan` (cascade), réinsère via `_insert_days`.
- `get_day_plan_ids(itinerary_id) -> dict[int, str]` : mappe `day_number → day_plan.id`, nécessaire pour cibler un seul jour en régénération partielle.
- `replace_day_items(day_plan_id, activities, restaurants)` : régénération partielle — supprime puis réinsère les activités/restaurants d'un seul `day_plan`.

### `api/routes/itinerary.py`

- `POST /api/itinerary` → `generate_itinerary()`, erreurs converties en 502
- `GET /api/itinerary` → `list_itineraries()` — utilisé par `/library`
- `GET /api/itinerary/{itinerary_id}` → `get_itinerary()`, 404 si `None`
- `POST /api/itinerary/{itinerary_id}/regenerate` → `regenerate_itinerary(id, request.item_keys)`, 404 si itinéraire introuvable (`ValueError`), 502 pour toute autre erreur (échec Claude, etc.)

---

## Base de données (Supabase)

4 tables, schéma dans `backend/supabase/migrations/0001_itinerary_schema.sql` (documentation du schéma cible — à recoller manuellement dans le SQL Editor Supabase si la base doit être recréée ; **pas de CLI Supabase connecté, pas de migrations automatiques**, l'utilisateur applique lui-même chaque `ALTER TABLE` que je lui fournis).

```
itinerary (id uuid pk, created_at,
           destination_city text (nullable), destination_country text not null,
           summary text not null,
           trip_types text[] not null default '{}',
           traveler_type text (nullable), traveler_count integer (nullable),
           city_lat double precision not null, city_lon double precision not null)
  └─ day_plan (id uuid pk, itinerary_id fk cascade, day_number, date)
       ├─ activity (id uuid pk, day_plan_id fk cascade, name, location_query, description,
       │            category, duration_minutes, budget_level, source_url, lat, lon, sort_order)
       └─ restaurant (id uuid pk, day_plan_id fk cascade, name, location_query, description,
                       cuisine, budget_level, source_url, lat, lon, sort_order)
```

**Historique des colonnes `itinerary`** (pour comprendre pourquoi certains champs sont nullable) :
- À l'origine, une seule colonne `destination_name` (texte combiné "Ville, Pays"). Renommée en `destination_country` puis complétée par une nouvelle colonne `destination_city` (nullable — les lignes créées avant ce changement n'ont pas de ville séparée).
- `trip_types` (les ambiances choisies dans le formulaire) n'existait pas du tout au départ — ajoutée avec un défaut `'{}'`, donc jamais `null`, mais peut être vide pour les anciennes lignes.
- `traveler_type`/`traveler_count` ajoutées plus tard spécifiquement pour permettre la **régénération complète** (reconstruire le prompt d'origine) — nullable, fallback `solo`/`1` côté backend si absents.

**Pas de RLS** — désactivé volontairement (choix explicite de l'utilisateur : gérer les accès ailleurs qu'au niveau base de données, pas via des policies Postgres). Le backend utilise la clé `service_role` qui bypasserait RLS de toute façon.

**Toujours pas stocké** : `date_from`/`date_to` explicites (dérivables du min/max des `day_plan.date`, donc pas bloquant), et rien côté auth/utilisateurs (pas de notion de propriétaire d'un voyage).

---

## Variables d'environnement

**`backend/.env`** (jamais commité, `.gitignore` couvre `.env*`) :
```
ANTHROPIC_API_KEY=...       # console Anthropic
GOOGLE_LOCATION_API_KEY=... # Google Cloud Console, projet avec Geocoding API activée + facturation + clé SANS restriction "HTTP referrers" (elle doit marcher server-side, pas juste browser)
SUPABASE_URL=https://qxwkztwxpgtzuxwnysgn.supabase.co   # SANS /rest/v1/ à la fin
SUPABASE_SERVICE_ROLE_KEY=...  # clé "secret"/service_role, PAS la clé publique/anon
```

**`.env.local`** (racine, frontend) :
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Comment lancer le projet en local

```bash
# Backend
cd backend
python3 -m venv .venv   # si pas déjà fait
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (autre terminal, racine du repo)
npm run dev
```

Puis `http://localhost:3000`. Doc API auto-générée sur `http://localhost:8000/docs` (Swagger, permet de tester toutes les routes directement sans passer par le formulaire, y compris `POST /api/itinerary/{id}/regenerate`).

Pour un test rapide de bout en bout sans repasser par le formulaire (génération réelle = coût + temps d'appel Claude), interroger directement Supabase via son API REST avec la `service_role` key (`backend/.env`) pour récupérer un id d'itinéraire existant, plutôt que d'en générer un nouveau.

---

## Décisions importantes et leur raison (pour ne pas les défaire par erreur)

1. **Géocodage séparé de la génération** — Claude ne produit jamais lui-même `lat`/`lon` (le prompt le lui interdit explicitement). Une recherche web ne donne pas de coordonnées GPS fiables ; laisser le modèle les "estimer" menait à des hallucinations. Le géocodage est un post-traitement déterministe via Google Geocoding, sur `location_query` (jamais sur `name`, qui peut être un titre descriptif verbeux).
2. **Google Geocoding plutôt que Nominatim** — Nominatim (gratuit, utilisé côté frontend pour `CityAutocomplete`) a un taux d'échec trop élevé pour un usage backend systématique. Migré vers Google Geocoding malgré la complexité de configuration.
3. **`source_url` obligatoire, pas optionnel** — pour forcer Claude à ne citer que des lieux réellement trouvés par la recherche web. Toujours généré et stocké, même si l'UI ne l'affiche plus (retiré sur demande, données conservées pour un usage futur).
4. **`save_itinerary` ne bloque jamais la réponse** — si Supabase est down, l'utilisateur reçoit quand même son itinéraire (juste non sauvegardé — et donc non régénérable plus tard, puisqu'il n'a pas d'id permanent).
5. **Modèle Claude configurable** (`claude_model` dans `Settings`, pas hardcodé) — le code s'adapte automatiquement aux capacités du modèle (`MODELS_WITH_ADAPTIVE_FEATURES`) : les modèles hors de cette liste (ex. Haiku 4.5) n'ont pas `thinking`/`effort`/la version récente de `web_search`.
6. **Pas de RLS sur Supabase** — décision explicite de l'utilisateur, gestion des accès prévue ailleurs (pas encore implémentée).
7. **`extra="forbid"` sur tous les modèles Pydantic** — nécessaire pour générer `additionalProperties: false`, requis par l'API Claude pour la sortie structurée.
8. **UUID check côté frontend avant d'appeler le backend** (`[id]/page.tsx`) — évite d'envoyer une requête inutile quand le segment d'URL est un prénom, pas un id.
9. **Régénération = mise à jour en place, jamais un nouvel id** — "régénérer" un voyage modifie les lignes existantes (delete + reinsert des `day_plan`/`activity`/`restaurant` concernés), l'URL `/{id}` ne change jamais. C'est la seule lecture cohérente de "modifier le voyage" depuis sa propre page.
10. **Régénération partielle = un appel Claude par jour concerné, jamais un seul appel global** — plus cher en tokens/latence si plusieurs jours sont touchés, mais chaque appel reste scopé et contrôlable (contexte = juste ce jour-là), plus fiable qu'un unique prompt "modifie ces N éléments precis dans un JSON de tout le voyage".
11. **Clés d'items (`{day}-{type}-{index}`) utilisées à la fois côté UI et comme identifiant API** — pas de vrai id de ligne exposé pour `Activity`/`Restaurant` (le schéma Claude doit rester "propre", sans champ `id` que le modèle pourrait halluciner). L'adressage par position (jour + type + index) est stable tant qu'on ne réordonne pas silencieusement une journée.
12. **Carte en tuiles CARTO (Voyager), pas Google Maps ni OSM standard** — reste dans l'esprit "gratuit, sans clé API" du choix Leaflet initial, tout en étant plus lisible que le rendu OSM par défaut (trop chargé) et plus familier que Positron seul (trop minimaliste, manque de repères).
13. **Règle CSS globale `button:not(:disabled) { cursor: pointer }`** (`globals.css`) plutôt que `cursor-pointer` répété sur chaque bouton — un `<button>` HTML n'a pas ce curseur par défaut (contrairement à `<a>`), et le vouloir partout justifie une règle globale plutôt qu'une classe Tailwind dupliquée des dizaines de fois.

## Ce qui n'est PAS encore fait

- Pas de streaming de la génération/régénération vers le frontend (le frontend attend la réponse complète, pas de retour de progression en direct — peut être long, surtout pour une régénération complète)
- Pas de gestion d'utilisateurs/authentification — tout voyage généré est visible par quiconque a l'URL (ou passe par `/library`, qui liste tout sans filtrage)
- Pas de tests automatisés (unitaires ou e2e)
- Pas d'historique/annulation après une régénération (écrase les données précédentes, pas de "undo")
- La régénération partielle ne rafraîchit pas le résumé global du voyage (seule la régénération complète le fait)
- Le dossier `src/app/api/` existe mais est vide (résidu, sans impact)
