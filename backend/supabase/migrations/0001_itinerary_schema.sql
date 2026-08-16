-- Schema for storing generated travel itineraries.
-- Mirrors: ItineraryResponse (+ request fields) -> DayPlan -> Activity / Restaurant
-- (see backend/app/schemas/itinerary.py)

create extension if not exists "pgcrypto";

-- One row per generated itinerary.
create table if not exists itinerary (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),

    -- Nullable: rows saved before this field existed may not have it.
    destination_city text,
    destination_country text not null,
    summary text not null,
    -- Ambiances picked in the form (e.g. 'Culture', 'Nature') — echoed back for
    -- display, not read from Claude's response.
    trip_types text[] not null default '{}',
    -- Nullable: rows saved before regeneration existed may not have these.
    -- Needed to rebuild the original request when regenerating the trip.
    traveler_type text,
    traveler_count integer,
    city_lat double precision not null,
    city_lon double precision not null
);

-- One row per day of an itinerary.
create table if not exists day_plan (
    id uuid primary key default gen_random_uuid(),
    itinerary_id uuid not null references itinerary (id) on delete cascade,

    day_number integer not null check (day_number > 0),
    date date not null,

    unique (itinerary_id, day_number)
);

-- One row per activity within a day.
create table if not exists activity (
    id uuid primary key default gen_random_uuid(),
    day_plan_id uuid not null references day_plan (id) on delete cascade,

    name text not null,
    location_query text not null,
    description text not null,
    category text not null,
    duration_minutes integer not null check (duration_minutes > 0),
    budget_level text not null
        check (budget_level in ('gratuit', '€', '€€', '€€€')),
    source_url text not null,
    lat double precision,
    lon double precision,

    sort_order integer not null default 0
);

-- One row per restaurant suggested within a day.
create table if not exists restaurant (
    id uuid primary key default gen_random_uuid(),
    day_plan_id uuid not null references day_plan (id) on delete cascade,

    name text not null,
    location_query text not null,
    description text not null,
    cuisine text not null,
    budget_level text not null
        check (budget_level in ('gratuit', '€', '€€', '€€€')),
    source_url text not null,
    lat double precision,
    lon double precision,

    sort_order integer not null default 0
);

create index if not exists idx_day_plan_itinerary_id on day_plan (itinerary_id);
create index if not exists idx_activity_day_plan_id on activity (day_plan_id);
create index if not exists idx_restaurant_day_plan_id on restaurant (day_plan_id);
create index if not exists idx_itinerary_created_at on itinerary (created_at desc);

-- No RLS: access control is handled outside the database (backend layer),
-- not via Postgres row-level security policies.
