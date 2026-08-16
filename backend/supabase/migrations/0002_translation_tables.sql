-- Adds FR/EN bilingual content support. Splits the free-text/linguistic
-- fields off itinerary/activity/restaurant into dedicated translation
-- tables (one row per (entity, locale)), keyed by a stable FK back to the
-- entity so the base tables stay language-invariant (dates, coordinates,
-- enums, sort order...).
--
-- This migration is additive/non-destructive: the old text columns on
-- itinerary/activity/restaurant are left in place and backfilled into the
-- new tables as locale='fr'. See 0003_drop_translated_columns.sql for the
-- follow-up migration that removes them, to run only once the backend has
-- been deployed against these new tables.

-- The new backend code stops writing these columns entirely (it writes to the
-- translation tables below instead). They must become nullable now, not only
-- dropped later in 0003, otherwise every insert would violate their current
-- NOT NULL constraint the moment the new code deploys, before 0003 ever runs.
alter table itinerary alter column destination_country drop not null;
alter table itinerary alter column summary drop not null;
alter table activity alter column name drop not null;
alter table activity alter column description drop not null;
alter table activity alter column category drop not null;
alter table restaurant alter column name drop not null;
alter table restaurant alter column description drop not null;
alter table restaurant alter column cuisine drop not null;

create table if not exists itinerary_translations (
    id uuid primary key default gen_random_uuid(),
    itinerary_id uuid not null references itinerary (id) on delete cascade,
    locale text not null check (locale in ('fr', 'en')),

    destination_city text,
    destination_country text not null,
    summary text not null,

    unique (itinerary_id, locale)
);

create table if not exists activity_translations (
    id uuid primary key default gen_random_uuid(),
    activity_id uuid not null references activity (id) on delete cascade,
    locale text not null check (locale in ('fr', 'en')),

    name text not null,
    description text not null,
    category text not null,

    unique (activity_id, locale)
);

create table if not exists restaurant_translations (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurant (id) on delete cascade,
    locale text not null check (locale in ('fr', 'en')),

    name text not null,
    description text not null,
    cuisine text not null,

    unique (restaurant_id, locale)
);

create index if not exists idx_itinerary_translations_itinerary_id on itinerary_translations (itinerary_id);
create index if not exists idx_activity_translations_activity_id on activity_translations (activity_id);
create index if not exists idx_restaurant_translations_restaurant_id on restaurant_translations (restaurant_id);

-- Backfill: every itinerary/activity/restaurant generated so far only has
-- French content, in the base tables' text columns.
insert into itinerary_translations (itinerary_id, locale, destination_city, destination_country, summary)
    select id, 'fr', destination_city, destination_country, summary from itinerary
    on conflict (itinerary_id, locale) do nothing;

insert into activity_translations (activity_id, locale, name, description, category)
    select id, 'fr', name, description, category from activity
    on conflict (activity_id, locale) do nothing;

insert into restaurant_translations (restaurant_id, locale, name, description, cuisine)
    select id, 'fr', name, description, cuisine from restaurant
    on conflict (restaurant_id, locale) do nothing;
