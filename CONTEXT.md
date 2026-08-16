# Contexte du projet — Travel Agent

> Ce fichier est destiné à donner à un nouvel agent (Claude ou autre) une vue complète du projet sans avoir à tout redécouvrir. Lis-le en entier avant de faire quoi que ce soit. Les chemins de fichiers sont donnés pour que tu puisses aller lire le code source exact quand tu as besoin de détails.

## Vue d'ensemble

Application web qui génère un **planning de voyage jour par jour** (activités + restaurants, avec budget, coordonnées GPS et sources vérifiables) à partir d'un formulaire simple (ville, dates, type de voyageurs, ambiances). La génération utilise l'API Claude avec recherche web réelle, pas de données inventées. Les résultats sont sauvegardés dans Supabase et consultables via une URL permanente.

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

Le backend fait **tout** le travail métier : appelle Claude, géocode les lieux, sauvegarde en base. Le frontend est fin — formulaire + affichage.

---

## Stack technique

**Frontend** (racine du repo) :
- Next.js 16.3.1 (App Router, Turbopack) — ⚠️ **version récente avec breaking changes vs. les connaissances d'entraînement d'un modèle** : `params` dans les pages dynamiques est une `Promise`, il faut `await`. Le helper `PageProps<'/route'>` (global, généré automatiquement) sert à typer les props de page. **Avant de coder une feature Next.js non triviale, lire `node_modules/next/dist/docs/`** (voir `AGENTS.md` à la racine).
- React 19.2.8, TypeScript
- Tailwind CSS v4
- `date-fns` (dates, locale `fr`)
- `lucide-react` (icônes)

**Backend** (`backend/`) :
- Python 3.12, FastAPI, Uvicorn
- `anthropic` (SDK officiel Claude)
- `supabase` (client officiel Python, communique avec Supabase via son API REST/PostgREST)
- `httpx` (appels à Google Geocoding)
- `pydantic` / `pydantic-settings`

**Base de données** : Supabase (projet nommé "Travel-planner", région `eu-west-2`), schéma dans `backend/supabase/migrations/0001_itinerary_schema.sql`.

**IA** : API Claude directement (pas Claude Code, pas Managed Agents) — un simple appel `messages.create/stream` avec l'outil serveur `web_search` et une sortie JSON structurée (`output_config.format`).

**Géocodage** : Google Geocoding API (pas Nominatim/OpenStreetMap — abandonné après des blocages 403 peu fiables, voir section "Décisions" plus bas).

---

## Structure des dossiers

```
travel-agent/
├── src/                          # Frontend Next.js (racine du repo)
│   ├── app/
│   │   ├── page.tsx              # "/" — formulaire (via TravelFormPage)
│   │   ├── [id]/page.tsx         # "/<n'importe quoi>" — voir logique UUID ci-dessous
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── components/travel-form/
│       ├── TravelForm.tsx        # Le formulaire multi-étapes + appel API + affichage résultat
│       ├── TravelFormPage.tsx    # Layout de page réutilisé par "/" et "/[id]" (cas non-UUID)
│       ├── ItineraryResultView.tsx  # Affichage d'un itinéraire (jours/activités/restaurants)
│       ├── CityAutocomplete.tsx  # Recherche de ville via Nominatim (encore utilisé ici, pas pour le géocodage des activités)
│       ├── DateRangePicker.tsx
│       ├── TravelerPicker.tsx
│       ├── TripTypeSelect.tsx
│       ├── SummaryStep.tsx
│       ├── StepBullets.tsx
│       ├── StepFooter.tsx
│       └── types.ts              # Tous les types TS + constantes (TRIP_TYPES, TRAVELER_TYPES...)
│
├── backend/                      # Backend FastAPI (sous-projet Python indépendant)
│   ├── app/
│   │   ├── main.py               # App FastAPI, CORS, montage des routes, /health
│   │   ├── core/config.py        # Settings (pydantic-settings), lit backend/.env
│   │   ├── schemas/itinerary.py  # Tous les modèles Pydantic (requête + réponse + DB)
│   │   ├── services/
│   │   │   ├── itinerary_agent.py  # Appel Claude + géocodage + orchestration
│   │   │   └── storage.py          # Lecture/écriture Supabase
│   │   └── api/routes/itinerary.py # POST /api/itinerary, GET /api/itinerary/{id}
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env                      # Secrets (jamais commité — voir section env vars)
│   └── supabase/migrations/0001_itinerary_schema.sql  # Schéma DB, source de vérité
│
├── .env.local                    # NEXT_PUBLIC_API_URL (frontend)
├── AGENTS.md / CLAUDE.md         # Avertissement Next.js "breaking changes" — à lire avant de coder du Next.js
└── package.json
```

---

## Frontend — détail

### Routing

- **`/`** → `TravelFormPage` sans nom → titre "Planifie ton voyage"
- **`/<segment>`** (`src/app/[id]/page.tsx`) → teste le segment contre une regex UUID (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`) :
  - **Si UUID valide** → `fetch(GET /api/itinerary/{id})` côté serveur (Server Component), `notFound()` si 404, sinon affiche `ItineraryResultView`
  - **Si pas un UUID** (ex. `/quentin`) → affiche `TravelFormPage` avec `name` = le segment (première lettre mise en capitale) → titre "Salut Quentin, planifie ton voyage"

### Flux de génération (`TravelForm.tsx`)

1. Formulaire 3 étapes (ville/dates/voyageurs → ambiances → résumé), état local `TravelFormData`
2. Au clic "Générer" (dernière étape) : `POST {NEXT_PUBLIC_API_URL}/api/itinerary` avec le body `{city, dateRange: {from, to} (format yyyy-MM-dd — important, pas de Date brute), travelerType, travelerCount, tripTypes}`
3. Pendant l'attente : bouton en état "Génération..." (peut prendre 30s à plusieurs minutes selon le modèle/effort configurés côté backend)
4. Réponse reçue (`ItineraryResult`, contient un `id` si la sauvegarde Supabase a réussi) → affichage via `ItineraryResultView` + lien "Lien permanent vers ce voyage" vers `/{id}`
5. En cas d'erreur (réseau, 502, refus du modèle) : message d'erreur affiché, pas de crash

### Types clés (`types.ts`)

- `TravelFormData` — état du formulaire
- `ItineraryResult` — réponse du `POST /api/itinerary` (avec `destination_city`/`destination_country` séparés + `id`)
- `ItineraryDetail`-like (pas un type explicite côté frontend, le JSON de `GET /api/itinerary/{id}` a juste `destination` en un seul champ)
- `ItineraryViewData` — forme "aplatie" (`destination: string`) consommée par `ItineraryResultView`, pour que les deux flux (génération fraîche vs relecture Supabase) alimentent le même composant d'affichage

⚠️ **Piège déjà rencontré** : la réponse de génération a `destination_city`/`destination_country` (2 champs, car c'est le schéma que Claude remplit), mais la table `itinerary` en base et donc la relecture (`GET /api/itinerary/{id}`) n'ont qu'un seul champ `destination` (texte combiné). D'où l'existence de `ItineraryViewData` comme point de convergence.

---

## Backend — détail

### `main.py`
App FastAPI, CORS ouvert vers `http://localhost:3000` (configurable via `CORS_ALLOW_ORIGINS`), toutes les routes métier sous `/api`, `/health` pour un check simple.

### `core/config.py`
Toute la config vient de `backend/.env` (jamais commité). Champs requis : `anthropic_api_key`, `google_location_api_key`, `supabase_url`, `supabase_service_role_key`. `claude_model` a une valeur par défaut (`claude-haiku-4-5` actuellement — changé plusieurs fois pendant le dev pour arbitrer coût/vitesse/qualité).

### `schemas/itinerary.py`
Modèles Pydantic, tous avec `extra="forbid"` (important pour la sortie structurée Claude — génère `additionalProperties: false` dans le JSON Schema).

- **Entrée** : `ItineraryRequest` (`city`, `date_range`, `traveler_type`, `traveler_count`, `trip_types`) — miroir exact du JSON envoyé par le frontend, alias camelCase (`dateRange`, `travelerType`...)
- **Sortie génération** : `ItineraryResponse` (`destination_city` nullable, `destination_country`, `summary`, `days: list[DayPlan]`) → c'est **le schéma donné à Claude** (`RESPONSE_SCHEMA = ItineraryResponse.model_json_schema()`) pour forcer sa sortie JSON
  - `DayPlan` : `day_number`, `date`, `activities: list[Activity]`, `restaurants: list[Restaurant]`
  - `Activity` : `name`, `location_query` (nom court pour géocodage, distinct de `name` qui peut être descriptif), `description`, `category`, `duration_minutes`, `budget_level` (enum `gratuit`/`€`/`€€`/`€€€`), `source_url` (**obligatoire**, doit être une vraie URL de résultat de recherche web), `lat`/`lon` (nullable, remplis après coup par le géocodage)
  - `Restaurant` : identique à `Activity` mais `cuisine` au lieu de `category`
- `ItineraryCreateResponse` = `ItineraryResponse` + `id` (id Supabase, ajouté après la sauvegarde, renvoyé par le POST)
- `ItineraryDetail` = ce que renvoie le GET (relecture Supabase) : `id`, `destination` (un seul champ, pas city/country séparés), `summary`, `days`

### `services/itinerary_agent.py` — le cœur de l'agent

`generate_itinerary(request) -> ItineraryCreateResponse` :

1. **Construit le prompt** (`_build_prompt`) : liste explicitement chaque jour du voyage avec sa date exacte, et donne des règles précises à Claude :
   - Regrouper activités/restaurants par proximité géographique par jour
   - Proposer 1-2 restaurants par jour, adaptés au contexte
   - `budget_level` réaliste, `source_url` réelle et vérifiée (jamais inventée)
   - `location_query` = nom court géocodable, distinct de `name`
   - Laisser `lat`/`lon` à `null` (géocodés après)
   - 4-8h d'activités/jour, pas de journée vide ou surchargée
2. **Appelle Claude** (`_run` → `client.messages.stream(...).get_final_message()`, en streaming pour éviter les timeouts) avec :
   - L'outil `web_search` (version `_20260209` avec filtrage dynamique si le modèle le supporte, sinon `_20250305` — voir `MODELS_WITH_ADAPTIVE_FEATURES`)
   - `output_config.format` = le JSON Schema de `ItineraryResponse` (sortie structurée forcée)
   - `thinking: adaptive` + `effort: medium` **seulement** si le modèle les supporte (Haiku 4.5 ne les supporte pas — plante sinon)
   - Boucle de relance si `stop_reason == "pause_turn"` (la recherche web côté serveur peut se mettre en pause après sa limite d'itérations par défaut)
   - Gère `stop_reason == "refusal"` et `"max_tokens"` avec des erreurs explicites
3. **Parse le JSON** de la réponse en `ItineraryResponse`
4. **Géocode** chaque activité/restaurant (`_geocode_itinerary`) via Google Geocoding, **après** la génération — voir "Décisions" ci-dessous pour le pourquoi. Retry automatique (1 fois) car les changements de restriction de clé API Google mettent du temps à se propager et causent des échecs transitoires.
5. **Sauvegarde** dans Supabase (`save_itinerary`) — si ça échoue, c'est juste loggé (`logger.exception`), la requête ne plante pas : la persistance est un effet de bord, pas le cœur de la fonctionnalité.
6. Renvoie `ItineraryCreateResponse` avec l'`id` Supabase (ou `null` si la sauvegarde a échoué).

### `services/storage.py`

- `save_itinerary(request, itinerary) -> str` : insère dans `itinerary`, récupère son id, puis insère chaque `day_plan` (récupère son id), puis les `activity`/`restaurant` liés. Renvoie l'id de l'itinéraire créé.
- `get_itinerary(itinerary_id) -> ItineraryDetail | None` : relit tout (itinerary → day_plan → activity/restaurant) et reconstruit l'objet complet. Construit les modèles `Activity`/`Restaurant` champ par champ (pas de `model_validate(dict_brut)`) car les lignes Supabase ont des colonnes en plus (`id`, `day_plan_id`, `sort_order`) que `extra="forbid"` rejetterait.

### `api/routes/itinerary.py`

- `POST /api/itinerary` → `generate_itinerary()`, erreurs converties en 502
- `GET /api/itinerary/{itinerary_id}` → `get_itinerary()`, 404 si `None`

---

## Base de données (Supabase)

4 tables, schéma dans `backend/supabase/migrations/0001_itinerary_schema.sql` (à recoller manuellement dans le SQL Editor Supabase si la base doit être recréée — pas de CLI Supabase connecté, pas de migrations automatiques).

```
itinerary (id uuid pk, created_at, destination_name, summary, city_lat, city_lon)
  └─ day_plan (id uuid pk, itinerary_id fk cascade, day_number, date)
       ├─ activity (id uuid pk, day_plan_id fk cascade, name, location_query, description,
       │            category, duration_minutes, budget_level, source_url, lat, lon, sort_order)
       └─ restaurant (id uuid pk, day_plan_id fk cascade, name, location_query, description,
                       cuisine, budget_level, source_url, lat, lon, sort_order)
```

**Pas de RLS** — désactivé volontairement (choix explicite de l'utilisateur : gérer les accès ailleurs qu'au niveau base de données, pas via des policies Postgres). Le backend utilise la clé `service_role` qui bypasserait RLS de toute façon.

**Table `itinerary` simplifiée** : ne contient QUE `destination_name`/`summary`/`city_lat`/`city_lon` — pas de `date_from`/`date_to`/`traveler_type`/`traveler_count`/`trip_types`/`model` (existaient dans une version antérieure du schéma, supprimés quand l'utilisateur a simplifié sa table directement dans Supabase). Si tu veux retracer le contexte complet d'une requête (dates, type de voyageurs...), **ce n'est actuellement pas stocké** — seul le résultat généré l'est.

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

Puis `http://localhost:3000`. Doc API auto-générée sur `http://localhost:8000/docs` (Swagger, permet de tester `POST /api/itinerary` directement sans passer par le formulaire).

---

## Décisions importantes et leur raison (pour ne pas les défaire par erreur)

1. **Géocodage séparé de la génération** — Claude ne produit jamais lui-même `lat`/`lon` (le prompt le lui interdit explicitement). Une recherche web ne donne pas de coordonnées GPS fiables ; laisser le modèle les "estimer" menait à des hallucinations. Le géocodage est un post-traitement déterministe via Google Geocoding, sur `location_query` (jamais sur `name`, qui peut être un titre descriptif verbeux — Nominatim/Google ne matchent rien dessus).
2. **Google Geocoding plutôt que Nominatim** — Nominatim (gratuit, utilisé côté frontend pour `CityAutocomplete`) a un taux d'échec trop élevé pour un usage backend systématique (bloque sur certains User-Agent, moins de couverture). Migré vers Google Geocoding malgré la complexité de configuration (facturation, activation API, restrictions de clé).
3. **`source_url` obligatoire, pas optionnel** — pour forcer Claude à ne citer que des lieux réellement trouvés par la recherche web, pas des suggestions génériques.
4. **`save_itinerary` ne bloque jamais la réponse** — si Supabase est down, l'utilisateur reçoit quand même son itinéraire (juste non sauvegardé). La persistance est secondaire par rapport à la fonctionnalité principale.
5. **Modèle Claude configurable** (`claude_model` dans `Settings`, pas hardcodé) — testé avec Opus 5, Sonnet 5, Haiku 4.5 successivement pour arbitrer coût/vitesse pendant le dev. Le code s'adapte automatiquement aux capacités du modèle (`MODELS_WITH_ADAPTIVE_FEATURES`) : Haiku 4.5 n'a pas `thinking`/`effort`/la version récente de `web_search`.
6. **Pas de RLS sur Supabase** — décision explicite de l'utilisateur, gestion des accès prévue ailleurs (pas encore implémentée).
7. **`extra="forbid"` sur tous les modèles Pydantic** — nécessaire pour générer `additionalProperties: false`, requis par l'API Claude pour la sortie structurée (`output_config.format`).
8. **UUID check côté frontend avant d'appeler le backend** (`[id]/page.tsx`) — évite d'envoyer une requête inutile (et potentiellement une erreur mal gérée par PostgREST sur un type `uuid` invalide) quand le segment d'URL est un prénom, pas un id.

## Ce qui n'est PAS encore fait

- Pas de carte (map) affichant les lat/lon des activités — juste une liste textuelle pour l'instant
- Pas de streaming de la génération vers le frontend (le frontend attend la réponse complète, pas de retour de progression en direct)
- Pas de gestion d'utilisateurs/authentification
- La table `itinerary` ne garde pas trace des paramètres de la requête d'origine (dates, type de voyageurs) — seulement le résultat
- Pas de tests automatisés (unitaires ou e2e)
- Le dossier `src/app/api/` existe mais est vide (résidu, sans impact)
