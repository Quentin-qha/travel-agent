-- Follow-up to 0002_translation_tables.sql.
--
-- ⚠️ Run this ONLY after the backend has been redeployed to read/write
-- itinerary_translations/activity_translations/restaurant_translations
-- instead of these columns, and you've confirmed the new code path works
-- end to end. Until then, the old columns below are harmless (unused
-- duplicates of the locale='fr' rows in the new tables) and safe to leave
-- in place — this migration is what actually makes the switch permanent.

alter table itinerary
    drop column destination_city,
    drop column destination_country,
    drop column summary;

alter table activity
    drop column name,
    drop column description,
    drop column category;

alter table restaurant
    drop column name,
    drop column description,
    drop column cuisine;
