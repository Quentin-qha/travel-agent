# Contexte du projet — Travel Agent

> Ce fichier est destiné à donner à un nouvel agent (Claude ou autre) une vue complète du projet sans avoir à tout redécouvrir. Lis-le en entier avant de faire quoi que ce soit. Les chemins de fichiers sont donnés pour que tu puisses aller lire le code source exact quand tu as besoin de détails.

## Vue d'ensemble

Application web qui génère un **planning de voyage jour par jour** (activités + restaurants, avec budget et coordonnées GPS) à partir d'un formulaire simple (ville, dates, type de voyageurs, ambiances). La génération utilise l'API Claude avec recherche web réelle, pas de données inventées. Les résultats sont sauvegardés dans Supabase et consultables via une URL permanente (`/{id}`), listés dans une bibliothèque (`/library`, avec recherche + filtres), et **modifiables après coup** : régénération totale ou partielle (élément par élément) directement depuis la page du voyage.

**Bilingue FR/EN** : toute l'interface (labels, boutons...) et **le contenu généré par l'IA** (résumé, activités, restaurants, destination) sont disponibles en français et en anglais, avec un bouton de bascule visible sur toutes les pages. Voir section dédiée "Internationalisation (FR/EN)" plus bas — c'est un pan entier de l'app, à lire avant de toucher au contenu affiché ou à la génération.

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

**Base de données** : Supabase (projet nommé "Travel-planner", région `eu-west-2`), schéma dans `backend/supabase/migrations/0001_itinerary_schema.sql` + `0002_translation_tables.sql` + `0003_drop_translated_columns.sql` (voir section DB plus bas — le contenu texte a été extrait dans des tables de traduction dédiées).

**IA** : API Claude directement (pas Claude Code, pas Managed Agents) — un simple appel `messages.create/stream` avec l'outil serveur `web_search` et une sortie JSON structurée (`output_config.format`). Utilisée à la fois pour la génération initiale et pour les deux modes de régénération (voir plus bas).

**Géocodage** : Google Geocoding API (pas Nominatim/OpenStreetMap pour le géocodage des activités — abandonné après des blocages 403 peu fiables, voir section "Décisions" plus bas). Nominatim reste utilisé côté frontend pour l'autocomplete de ville (`CityAutocomplete.tsx`), et les tuiles de carte viennent de CARTO (basées sur les données OSM), pas de Google Maps.

---

## Structure des dossiers

```
travel-agent/
├── src/                          # Frontend Next.js (racine du repo)
│   ├── app/
│   │   ├── page.tsx              # "/" — formulaire (via TravelFormPage)
│   │   ├── [id]/page.tsx         # "/<n'importe quoi>" — voir logique UUID ci-dessous ; lit la locale (cookie) et passe ?lang= au fetch
│   │   ├── library/page.tsx      # "/library" — fetch seul (Server Component) ; tout le rendu délégué à LibraryBrowser (Client)
│   │   ├── layout.tsx            # Root layout : <html lang="fr"> statique, enrobe {children} dans <LanguageProvider>, monte <LanguageToggle /> (visible sur toutes les pages)
│   │   └── globals.css           # règle globale `button:not(:disabled) { cursor: pointer }` + keyframes `orbit`/`fade-in` (loader) + styles `.dual-range-thumb` (slider bibliothèque)
│   ├── components/travel-form/
│   │   ├── TravelForm.tsx        # Formulaire multi-étapes + appel API + affiche GenerationLoaderModal pendant la génération
│   │   ├── TravelFormPage.tsx    # Layout de page réutilisé par "/" et "/[id]" (cas non-UUID) — Client Component (traduit son texte via useLanguage)
│   │   ├── GenerationLoaderModal.tsx  # Overlay plein écran pendant la génération : icône avion en orbite + messages qui défilent (traduits, tList("generationLoader.steps"))
│   │   ├── ItineraryResultView.tsx  # Affichage "carte centrée" d'un itinéraire (fallback uniquement si la sauvegarde Supabase échoue — sinon TravelForm redirige direct vers /{id}, voir plus bas)
│   │   ├── ItineraryMapView.tsx  # Layout carte + sidebar de la page "/[id]" — le cœur de l'affichage détail (voir section dédiée)
│   │   ├── ItineraryMap.tsx      # Composant Leaflet pur (chargé en dynamic import, ssr:false) — markers, popups, fit bounds
│   │   ├── CityAutocomplete.tsx  # Recherche de ville via Nominatim (encore utilisé ici, pas pour le géocodage des activités)
│   │   ├── DateRangePicker.tsx
│   │   ├── TravelerPicker.tsx
│   │   ├── TripTypeSelect.tsx
│   │   ├── SummaryStep.tsx
│   │   ├── StepBullets.tsx
│   │   ├── StepFooter.tsx
│   │   └── types.ts              # Types TS + constantes (TRIP_TYPES, TRAVELER_TYPES...) + helper `formatDestination` — TRIP_TYPES reste en valeurs françaises fixes (voir i18n)
│   ├── components/library/       # Page "/library" — extrait de page.tsx pour pouvoir traduire (Server Component ne peut pas lire le cookie de langue côté client)
│   │   ├── LibraryBrowser.tsx    # Orchestrateur : header, état vide, filtrage (recherche + plage de jours + tags), grille de LibraryCard
│   │   ├── LibraryToolbar.tsx    # Barre recherche + DayRangeDropdown + chips de tags (valeurs TRIP_TYPES traduites à l'affichage via translateTripType)
│   │   ├── DayRangeDropdown.tsx  # Bouton "Durée" → panneau (React Portal vers document.body — nécessaire, voir "Décisions" #14) contenant DayRangeSlider
│   │   ├── DayRangeSlider.tsx    # Slider double-poignée natif (deux <input type=range> superposés, cf. `.dual-range-thumb` dans globals.css)
│   │   └── LibraryCard.tsx       # Card individuelle (tags trip_types actuellement commentés/désactivés dans le JSX, cf. system-reminder de session — ne pas les réactiver sans demande explicite)
│   ├── components/common/
│   │   └── LanguageToggle.tsx    # Bouton FR/EN, fixed top-4 right-4, z-[999] (au-dessus des contrôles Leaflet, voir "Décisions" #15)
│   └── lib/i18n/                 # Toute l'internationalisation (voir section dédiée)
│       ├── translations.ts       # Dictionnaires fr/en (TRANSLATIONS), typés l'un sur l'autre
│       ├── LanguageProvider.tsx  # Context + hooks useLanguage()/useDateFnsLocale(), locale stockée en cookie (pas localStorage)
│       ├── locale.ts             # getServerLocale() — lecture du cookie côté serveur (next/headers, async)
│       └── tripTypeLabels.ts     # translateTripType(value, locale) — mapping d'affichage EN pour les valeurs TRIP_TYPES (les valeurs elles-mêmes ne changent jamais)
│
├── backend/                      # Backend FastAPI (sous-projet Python indépendant)
│   ├── app/
│   │   ├── main.py               # App FastAPI, CORS, montage des routes, /health
│   │   ├── core/config.py        # Settings (pydantic-settings), lit backend/.env
│   │   ├── schemas/itinerary.py  # Modèles Pydantic (requête + réponse + DB + régénération + traduction)
│   │   ├── services/
│   │   │   ├── itinerary_agent.py  # Appel Claude + géocodage + traduction EN + orchestration (génération ET régénération)
│   │   │   └── storage.py          # Lecture/écriture Supabase, y compris les tables de traduction
│   │   └── api/routes/itinerary.py # Toutes les routes REST, chacune avec un paramètre `lang` (voir liste plus bas)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env                      # Secrets (jamais commité — voir section env vars)
│   └── supabase/migrations/
│       ├── 0001_itinerary_schema.sql        # Schéma de base (tables itinerary/day_plan/activity/restaurant)
│       ├── 0002_translation_tables.sql      # Ajoute itinerary_translations/activity_translations/restaurant_translations + backfill fr + rend nullable les anciennes colonnes texte
│       └── 0003_drop_translated_columns.sql # Supprime les anciennes colonnes texte (destination_city/country, summary, name, description, category, cuisine) — DÉJÀ EXÉCUTÉE, ces colonnes n'existent plus
│
├── .env.local                    # NEXT_PUBLIC_API_URL (frontend)
├── AGENTS.md / CLAUDE.md         # Avertissement Next.js "breaking changes" — à lire avant de coder du Next.js
└── package.json
```

---

## Frontend — détail

### Routing

- **`/`** → `TravelFormPage` sans nom → titre traduit ("Planifie ton voyage"/"Let's plan your trip"), avec un lien vers `/library`
- **`/library`** → `LibraryPage` (Server Component, garde le `fetch` côté serveur) : lit `getServerLocale()`, `fetch(GET /api/itinerary?lang=...)`, délègue tout le rendu (header, état vide, toolbar, grille) à `LibraryBrowser` (Client Component — nécessaire pour `useLanguage()` et le filtrage interactif). Voir section "Bibliothèque — recherche et filtres" plus bas.
  - ⚠️ Le slug est volontairement en anglais (`library`, pas `bibliotheque`) — décision explicite de l'utilisateur, indépendante de la locale d'affichage.
- **`/<segment>`** (`src/app/[id]/page.tsx`) → teste le segment contre une regex UUID (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`) :
  - **Si UUID valide** → lit `getServerLocale()`, `fetch(GET /api/itinerary/{id}?lang=...)` côté serveur, `notFound()` si 404, sinon passe `id` + `itinerary` à `ItineraryMapView` avec `key={locale}` (force un remount propre quand la langue change — reset l'état d'édition local, cohérent puisque le contenu sous-jacent vient de changer de langue)
  - **Si pas un UUID** (ex. `/quentin`) → affiche `TravelFormPage` avec `name` = le segment (première lettre mise en capitale) → titre "Salut {name}, planifie ton voyage" (traduit)

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
2. Au clic "Générer" (dernière étape) : `POST {NEXT_PUBLIC_API_URL}/api/itinerary?lang={locale}` avec le body `{city, dateRange: {from, to} (format yyyy-MM-dd — important, pas de Date brute), travelerType, travelerCount, tripTypes}`
3. Pendant l'attente : `GenerationLoaderModal` en overlay plein écran (icône avion en orbite + messages qui défilent toutes les ~2,4s, traduits) — peut prendre 30s à plusieurs minutes selon le modèle/effort côté backend, **plus l'appel de traduction EN désormais systématique** (voir i18n)
4. Réponse reçue (`ItineraryResult`) :
   - Si `id` présent (sauvegarde Supabase réussie, cas normal) → **redirection immédiate** via `router.push(\`/${id}\`)`, le loader reste affiché jusqu'à ce que la nouvelle page prenne le relais (pas de retour à l'état `isGenerating=false` dans ce cas, pour éviter un flash de retour au formulaire)
   - Si pas d'`id` (Supabase down) → fallback : affichage inline via `ItineraryResultView` (la carte "centrée" classique, **pas** `ItineraryMapView`) + pas de lien permanent possible
5. En cas d'erreur (réseau, 502, refus du modèle) : message d'erreur affiché, pas de crash

### Bibliothèque — recherche et filtres (`src/components/library/`)

`LibraryBrowser` possède l'état de filtrage (recherche texte, plage de jours, tags sélectionnés) et calcule la liste filtrée en mémoire (les `itineraries` sont déjà tous chargés par le fetch serveur — pas de requête au backend par filtre) :
- **Recherche** (`LibraryToolbar`) : substring case-insensitive sur `destination_city` + `destination_country`.
- **Plage de jours** (`DayRangeDropdown` + `DayRangeSlider`) : bornes min/max calculées depuis les `day_count` présents. Le panneau slider est rendu via **React Portal vers `document.body`** — nécessaire, pas un choix esthétique (voir "Décisions" #14). `min-w-[8.5rem]` sur le bouton déclencheur pour que son libellé variable ("Durée" ↔ "3–5 jours") ne fasse pas sauter la largeur du champ de recherche à côté.
- **Tags** (`LibraryToolbar`) : liste dérivée des `trip_types` réellement présents dans les voyages chargés (pas tout `TRIP_TYPES`), filtrage en "au moins un tag sélectionné correspond" (OR, pas AND). Labels traduits à l'affichage (`translateTripType`), la comparaison de filtrage se fait toujours sur les valeurs françaises brutes.
- État vide géré à deux niveaux : aucun voyage du tout (`itineraries.length === 0`, avant même d'afficher la toolbar) vs. aucun résultat après filtrage (`filtered.length === 0`, avec bouton "Réinitialiser les filtres").

## Internationalisation (FR/EN)

Deux couches distinctes, à ne pas confondre :

**1. Interface (chrome statique)** — `src/lib/i18n/translations.ts` (dictionnaires `fr`/`en`, un namespace par zone de l'app), `LanguageProvider.tsx` (contexte + hooks `useLanguage()` → `{ locale, setLocale, t, tList }` et `useDateFnsLocale()` pour le formatage des dates). Chaque composant affichant du texte statique est un Client Component appelant `t("clé")`.

**2. Contenu généré par l'IA** — résumé, description/nom des activités et restaurants, ville/pays de destination. Traduit et **stocké en base dans des tables dédiées** (`itinerary_translations`/`activity_translations`/`restaurant_translations`, voir section DB), jamais recalculé à la volée à chaque lecture. Voir section backend pour le détail du pipeline de traduction.

**Locale = cookie, pas `localStorage`** — décision clé (voir "Décisions" #16) : un Server Component (page bibliothèque, page voyage) doit pouvoir connaître la langue de l'utilisateur pour demander le bon contenu au backend (`?lang=`) **avant même le premier rendu**, ce que `localStorage` ne permet pas côté serveur. `LanguageProvider` lit/écrit un cookie `travel-agent-locale` (nom dupliqué en dur dans `locale.ts` — ce fichier importe `next/headers`, donc ne peut pas être importé depuis le Client Component `LanguageProvider.tsx`, d'où la duplication assumée du nom de cookie plutôt qu'un import).

**`LanguageToggle`** (`src/components/common/LanguageToggle.tsx`) : monté une seule fois dans `layout.tsx`, visible sur toutes les pages. Au clic : écrit le cookie + `router.refresh()` (recharge les fetchs des Server Components avec la nouvelle langue, sans rechargement complet de page).

**Valeurs vs. labels traduits** — `TRIP_TYPES` (`types.ts`) reste une liste fixe de chaînes **françaises**, jamais traduites en base : ce sont les valeurs stockées/comparées (filtrage bibliothèque, `trip_types` envoyé à l'API). Seul l'**affichage** passe par `translateTripType(value, locale)` (`src/lib/i18n/tripTypeLabels.ts`), qui a une entrée statique par valeur de `TRIP_TYPES`. Ne jamais traduire `TRIP_TYPES` lui-même — ça casserait la génération, le stockage et le filtrage existants.

### Types clés (`types.ts`)

- `TravelFormData` — état du formulaire
- `ItineraryResult` — réponse du `POST /api/itinerary` : `id`, `destination_city` (string, non-null), `destination_country`, `summary`, `trip_types: string[]`, `days` — déjà dans la langue demandée via `?lang=`
- `ItineraryViewData` — forme partagée entre génération fraîche et relecture Supabase, consommée par `ItineraryResultView` **et** `ItineraryMapView` : `destination_city: string | null` (nullable ici pour tolérer les anciennes lignes), `destination_country`, `summary`, `trip_types`, `days`
- `ItinerarySummary` — forme légère pour la bibliothèque : `id`, `destination_city`, `destination_country`, `summary`, `trip_types: string[]` (ajouté pour le filtrage par tags), `day_count`, `created_at`
- `STEPS` — `{ id, labelKey }` (pas `label` en dur) ; `TRAVELER_TYPES` — `{ id, defaultCount }` (le `label` a été retiré, résolu via `t(\`travelerTypes.${id}\`)`) — les deux ont perdu leur texte français en dur au profit des dictionnaires i18n.
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

- **Entrée génération** : `ItineraryRequest` (`city`, `date_range`, `traveler_type`, `traveler_count`, `trip_types`) — miroir exact du JSON envoyé par le frontend, alias camelCase (`dateRange`, `travelerType`...). Ne contient **pas** de champ langue — la génération produit toujours le français en premier (voir agent), `lang` n'existe qu'en query param des routes, pour choisir quoi *renvoyer*.
- **Sortie génération (schéma structuré donné à Claude)** : `ItineraryResponse` (`destination_city: str` obligatoire, `destination_country`, `summary`, `days: list[DayPlan]`) → `RESPONSE_SCHEMA = ItineraryResponse.model_json_schema()`. `destination_city` est **obligatoire, jamais nullable** ici — le prompt force explicitement Claude à toujours le remplir (voir "Décisions").
  - `DayPlan` : `day_number`, `date`, `activities: list[Activity]`, `restaurants: list[Restaurant]`
  - `Activity` : `name`, `location_query` (nom court pour géocodage, distinct de `name` qui peut être descriptif), `description`, `category`, `duration_minutes`, `budget_level` (enum `gratuit`/`€`/`€€`/`€€€` — **reste toujours en français**, y compris en mode EN, voir "Décisions" #17), `source_url` (**obligatoire**, doit être une vraie URL de résultat de recherche web — toujours stocké, plus affiché côté UI), `lat`/`lon` (nullable, remplis après coup par le géocodage)
  - `Restaurant` : identique à `Activity` mais `cuisine` au lieu de `category`
- **Traduction** (nouveau) : `ActivityContent`/`RestaurantContent` (juste `name`/`description`/`category` ou `cuisine` — le sous-ensemble linguistique d'`Activity`/`Restaurant`), `DayContent` (`activities: list[ActivityContent]` + `restaurants: list[RestaurantContent]`, pour une seule journée), `TranslatedItinerary` (`destination_city`, `destination_country`, `summary`, `days: list[DayContent]`) — schéma structuré donné à Claude pour l'appel de traduction FR→EN (voir agent). `TRANSLATION_SCHEMA`/`DAY_TRANSLATION_SCHEMA` dans `itinerary_agent.py`.
- `ItineraryCreateResponse` = `ItineraryResponse` + `id` (id Supabase) + `trip_types: list[str]` (**échoué depuis la requête, jamais généré par Claude** — l'utilisateur a déjà choisi ces tags dans le formulaire)
- `ItineraryDetail` = ce que renvoie le GET (et la régénération) : `id`, `destination_city` (nullable — tolère les traductions incomplètes), `destination_country`, `summary`, `trip_types`, `days` — **déjà dans la langue demandée**, la fusion FR/EN se fait entièrement côté `storage.py`.
- `ItinerarySummary` — forme légère pour `GET /api/itinerary` (liste) : pas d'activités/restaurants, juste `id`, `destination_city`, `destination_country`, `summary`, `trip_types`, `day_count`, `created_at`
- `RegenerateItineraryRequest` — body de `POST /api/itinerary/{id}/regenerate` : `item_keys: list[str]` (alias JSON `itemKeys`), format `"{day_number}-{activity|restaurant}-{index}"` — voir section frontend pour l'origine de ce format.
- `ItineraryContext` — modèle interne (jamais exposé via l'API), reconstruit à partir de la base pour ré-générer : ville/coordonnées, `traveler_type`/`traveler_count` (fallback `solo`/`1` si absents — anciennes lignes), `trip_types`, dates de chaque jour. **Toujours reconstruit depuis le contenu français** (voir "Décisions" #18) — jamais depuis une traduction, quelle que soit la langue de l'utilisateur qui déclenche la régénération.
- `DayItemsResponse` — schéma structuré interne utilisé **uniquement** pour la régénération partielle (un seul jour à la fois) : `activities: list[Activity]` + `restaurants: list[Restaurant]`, sans `destination_city`/`summary`/etc.

### `services/itinerary_agent.py` — le cœur de l'agent

Fonctions internes partagées entre génération et régénération :
- `_run_to_completion(messages, schema=RESPONSE_SCHEMA, use_search=True)` : boucle d'appel Claude générique (streaming, gère `pause_turn`/`refusal`/`max_tokens`), paramétrée par le schéma JSON de sortie attendu. `use_search=False` (nouveau) omet l'outil `web_search` — utilisé pour les appels de traduction, qui n'ont besoin de rien chercher.
- `_geocode_itinerary`/`_geocode_place`/`_geocode` : géocodage Google, retry 1 fois (propagation des restrictions de clé API), inchangés.
- `_translate_with_retry(prompt, schema, model_cls, retries=1)` : appelle Claude et valide via `model_cls.model_validate`, **retry une fois** en cas d'échec — même logique que `_geocode` pour la même raison (absorber une erreur API transitoire). Un vrai échec silencieux a été observé en prod avant l'ajout de ce retry (voir "Décisions" #19).
- `_translate_to_english(itinerary: ItineraryResponse) -> TranslatedItinerary | None` : traduit tout un itinéraire fraîchement généré. **Valide strictement** que le nombre de jours et d'items par jour correspond exactement à l'original (le résultat est réinjecté par position) — sinon log un warning et renvoie `None` (dégradation silencieuse vers "pas de version anglaise pour ce voyage", jamais de corruption/désalignement).
- `_translate_day_items(activities, restaurants) -> DayContent | None` : même chose mais scopé à une seule journée — utilisé par la régénération partielle.

**`generate_itinerary(request, lang="fr") -> ItineraryCreateResponse`** (génération initiale) :
1. `_build_prompt(request)` : liste chaque jour avec sa date exacte, règles précises (proximité géographique par jour, 1-2 restaurants/jour, `budget_level` réaliste, `source_url` réelle, `location_query` distinct de `name`, `lat`/`lon` laissés `null`, **`destination_city`/`destination_country` tous les deux obligatoires**, 4-8h d'activités/jour). **Toujours en français** — `lang` ne change jamais le prompt de génération, seulement quoi renvoyer à la fin.
2. `_run_to_completion` avec `RESPONSE_SCHEMA`, parse le JSON en `ItineraryResponse`.
3. Géocode tout, puis `_translate_to_english(itinerary)` (nouveau — un appel Claude de plus, sans recherche web, donc rapide/peu coûteux).
4. `save_itinerary(request, itinerary, translated)` — best-effort, ne bloque jamais la réponse si Supabase est down. Écrit les deux locales d'un coup.
5. Si la sauvegarde a réussi, relit via `get_itinerary(itinerary_id, locale=lang)` pour construire la réponse (réutilise la logique de fusion/fallback de `storage.py` plutôt que de la dupliquer) ; sinon, fusionne en mémoire via `_apply_translation` (cas de repli rare : pas de ligne à relire puisque rien n'a été persisté).

**`regenerate_itinerary(itinerary_id, item_keys, lang="fr") -> ItineraryDetail`** (point d'entrée de la régénération, appelé par la route) :
1. Reconstruit le contexte original (`get_itinerary_context` — toujours français) et l'itinéraire courant (`get_itinerary(..., locale="fr")`).
2. Compare `len(set(item_keys))` au nombre total d'items existants : **tout sélectionné → régénération complète** (`_regenerate_full`), **sinon → partielle** (`_regenerate_partial`). Le frontend ne décide jamais lui-même du mode — il envoie juste les clés cochées.

**`_regenerate_full(itinerary_id, context, lang="fr")`** : reconstruit un `ItineraryRequest` équivalent à partir du contexte stocké (`_context_to_request` — ville/coordonnées/dates/voyageurs/ambiances), relance exactement le même prompt que `generate_itinerary`, géocode, traduit (`_translate_to_english`), puis `replace_days` (supprime tous les `day_plan` existants — cascade sur activity/restaurant/leurs traductions — et réinsère tout dans les deux langues). Résumé et destination sont rafraîchis dans les deux locales.

**`_regenerate_partial(itinerary_id, context, item_keys, lang="fr")`** : pour chaque **jour concerné uniquement** :
1. `_parse_item_keys` regroupe les clés par jour/type/index.
2. Sépare les éléments **conservés** (non cochés) des éléments **à remplacer** (cochés) — les conservés ne sont jamais renvoyés à Claude pour modification, juste listés comme contexte.
3. `_build_partial_prompt` : prompt scopé à une seule journée, donne la liste des éléments conservés (nom, durée/cuisine, budget, description) et demande **exactement** N nouvelles activités + M nouveaux restaurants, avec des règles explicites de **cohérence géographique** (même zone que les éléments conservés) et de **faisabilité temporelle** (temps total de la journée réaliste, ~4-8h) — c'est la partie qui répond directement à la demande "attention à ce que ce soit faisable en termes de temps et de localisation".
4. Appelle Claude avec `DAY_ITEMS_RESPONSE_SCHEMA` (web_search inclus), géocode uniquement les nouveaux éléments (les conservés gardent leurs coordonnées).
5. `_merge_by_index` réinjecte les nouveaux éléments à la position des anciens (ordre préservé autant que possible) ; si Claude renvoie moins d'éléments que demandé, le slot est simplement abandonné (pas de crash).
6. Traduit uniquement les *nouveaux* éléments (`_translate_day_items`), puis reconstruit la version anglaise complète du jour en **récupérant les traductions déjà existantes des éléments conservés** (lecture `get_itinerary(..., locale="en")`) et en les fusionnant par position avec les nouvelles — nécessaire car `replace_day_items` supprime/réinsère *toute* la journée, y compris les éléments non touchés.
7. `replace_day_items` : supprime puis réinsère les activités/restaurants de **ce jour précis seulement** (les autres jours ne sont jamais touchés), dans les deux langues.
8. ⚠️ Le résumé global du voyage (`itinerary.summary`) **n'est pas rafraîchi** lors d'une régénération partielle (seule la régénération complète le fait) — simplification assumée pour éviter un appel Claude supplémentaire à chaque petit changement.

### `services/storage.py`

Toute lecture/écriture texte passe maintenant par les tables de traduction (voir section DB). `_pick_translation(rows, locale)` est le point central : cherche la ligne de la locale demandée, sinon **fallback silencieux vers le français** — jamais d'erreur, jamais de blanc, même pour un voyage jamais traduit (créé avant ce chantier, ou dont la traduction a échoué).

- `save_itinerary(request, itinerary, translated=None) -> str` : insère `itinerary` (structurel seulement : `trip_types`, `traveler_type`, `traveler_count`, `city_lat`, `city_lon` — plus de texte), insère la ligne `itinerary_translations` `fr` (+ `en` si `translated` fourni), délègue à `_insert_days`.
- `_insert_activities`/`_insert_restaurants`/`_insert_days` : insèrent la table structurelle, récupèrent les `id` générés (l'insert bulk Supabase renvoie les lignes dans l'ordre soumis — vérifié en pratique), puis insèrent les lignes de traduction correspondantes par position.
- `get_itinerary(itinerary_id, locale="fr") -> ItineraryDetail | None` : relit tout avec des embeds PostgREST (`itinerary_translations(*)`, `activity_translations(*)`, `restaurant_translations(*)`), choisit la traduction via `_pick_translation`.
- `list_itineraries(locale="fr") -> list[ItinerarySummary]` : une seule requête avec embeds `itinerary_translations(*)` + `day_plan(day_number)` (comptage sans requête N+1).
- `get_itinerary_context(itinerary_id) -> ItineraryContext | None` : reconstruit les paramètres de la requête d'origine pour la régénération. **Locale hardcodée à `"fr"` en interne, jamais paramétrable** — voir "Décisions" #18.
- `replace_days(itinerary_id, itinerary, translated=None)` : régénération complète — supprime/réinsère `itinerary_translations`, supprime tous les `day_plan` (cascade jusqu'aux tables de traduction), réinsère via `_insert_days`.
- `get_day_plan_ids(itinerary_id) -> dict[int, str]` : inchangé.
- `replace_day_items(day_plan_id, activities, restaurants, translated=None)` : régénération partielle — supprime puis réinsère *toutes* les activités/restaurants d'un `day_plan` (kept + new), dans les deux langues si `translated` est fourni.

### `api/routes/itinerary.py`

Toutes les routes acceptent désormais `lang: str = "fr"` en query param (FastAPI l'infère automatiquement comme query param puisque c'est un argument simple à côté du modèle de body) :

- `POST /api/itinerary?lang=` → `generate_itinerary(request, lang=lang)`, erreurs converties en 502
- `GET /api/itinerary?lang=` → `list_itineraries(lang)` — utilisé par `/library`
- `GET /api/itinerary/{itinerary_id}?lang=` → `get_itinerary(itinerary_id, lang)`, 404 si `None`
- `POST /api/itinerary/{itinerary_id}/regenerate?lang=` → `regenerate_itinerary(id, request.item_keys, lang=lang)`, 404 si itinéraire introuvable (`ValueError`), 502 pour toute autre erreur (échec Claude, etc.)

---

## Base de données (Supabase)

7 tables, schéma dans `backend/supabase/migrations/0001_itinerary_schema.sql` + `0002_translation_tables.sql` + `0003_drop_translated_columns.sql` (documentation du schéma cible — à recoller manuellement dans le SQL Editor Supabase si la base doit être recréée ; **pas de CLI Supabase connecté, pas de migrations automatiques**, l'utilisateur applique lui-même chaque script SQL que je lui fournis). **Les 3 migrations ont déjà été exécutées** sur la base actuelle — le schéma ci-dessous est l'état réel, pas juste une cible.

```
itinerary (id uuid pk, created_at,
           trip_types text[] not null default '{}',
           traveler_type text (nullable), traveler_count integer (nullable),
           city_lat double precision not null, city_lon double precision not null)
  ├─ itinerary_translations (id uuid pk, itinerary_id fk cascade, locale text check (fr/en),
  │                          destination_city text (nullable), destination_country text not null,
  │                          summary text not null,  unique(itinerary_id, locale))
  └─ day_plan (id uuid pk, itinerary_id fk cascade, day_number, date)
       ├─ activity (id uuid pk, day_plan_id fk cascade, location_query, duration_minutes,
       │            budget_level, source_url, lat, lon, sort_order)
       │    └─ activity_translations (id uuid pk, activity_id fk cascade, locale check (fr/en),
       │                              name, description, category,  unique(activity_id, locale))
       └─ restaurant (id uuid pk, day_plan_id fk cascade, location_query,
                       budget_level, source_url, lat, lon, sort_order)
            └─ restaurant_translations (id uuid pk, restaurant_id fk cascade, locale check (fr/en),
                                        name, description, cuisine,  unique(restaurant_id, locale))
```

**`itinerary`/`activity`/`restaurant` n'ont plus aucune colonne texte libre** — `destination_city`/`destination_country`/`summary`/`name`/`description`/`category`/`cuisine` ont tous été déplacés dans les tables `*_translations` correspondantes (une ligne par langue). Les FK sont `on delete cascade`, donc supprimer un `day_plan` nettoie automatiquement `activity`/`restaurant` **et** leurs traductions, sans code de nettoyage supplémentaire.

⚠️ **Ne pas essayer de lire/écrire `destination_city`, `name`, `description`, etc. directement sur les tables de base** — ces colonnes n'existent plus depuis `0003_drop_translated_columns.sql`. Tout passe par `itinerary_translations`/`activity_translations`/`restaurant_translations` (voir `storage.py`).

**Pourquoi des tables de traduction séparées plutôt qu'une colonne par langue ou du JSONB** — voir "Décisions" #16.

**Voyages générés avant ce chantier** : ont une ligne `locale='fr'` dans les tables de traduction (backfillée par `0002_translation_tables.sql` depuis les anciennes colonnes), mais **aucune ligne `en`** — pas de backfill EN décidé (voir "Ce qui n'est PAS encore fait"). Ils s'affichent en français même en mode EN, jusqu'à leur prochaine régénération.

**Historique des colonnes `itinerary`** (pour comprendre pourquoi certains champs restent nullable) :
- À l'origine, une seule colonne `destination_name` (texte combiné "Ville, Pays"). Renommée en `destination_country` puis complétée par une nouvelle colonne `destination_city` (nullable — les lignes créées avant ce changement n'ont pas de ville séparée) — ces deux colonnes vivent maintenant dans `itinerary_translations`.
- `trip_types` (les ambiances choisies dans le formulaire) n'existait pas du tout au départ — ajoutée avec un défaut `'{}'`, donc jamais `null`, mais peut être vide pour les anciennes lignes. Reste sur la table `itinerary` de base (valeurs françaises fixes, jamais traduites en base — voir section i18n).
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
