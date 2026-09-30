# Realm of Kings — v0.10.0

Telegram Mini App / Node.js + Express + SQLite. Requires Node.js >=22.5.

## Run
1. `npm install`
2. Set `BOT_TOKEN` to the Telegram bot token used for Mini App init-data verification.
3. `npm start`
4. Keep `DB_PATH` unset to use `rok.db`, or set it to a persistent SQLite path (recommended on hosting).

## v0.10.0 implementation
- Preserves the existing player/economy schema and adds settlement tables without dropping existing data.
- Migrates each existing kingdom to one capital city if it does not already have one.
- Settlement lists split cities and villages; each settlement has its own detail page, buildings, population, housing, food, workers, warehouse capacity, and defense level fields.
- Founding a village costs 100 gold. New villages start with 100 residents and a starter logging camp and stone quarry.
- Population grows by one every six hours while food and housing are available. Villages reaching 10,000 residents become cities automatically.
- Includes a 100-building catalog grouped into 10 categories, build and upgrade APIs, and a settlement event log.
- Main menu has six primary destinations: Settlements, Troops, Treasury, Market, Quests, Politics. Diplomacy is nested under Politics.
- Production/economy modules and their existing API endpoints remain in place.

## Modular layout
- `src/settlements/catalog.js` — 100 building definitions and categories.
- `src/settlements/service.js` — additive DB migration, settlement logic and API routes.
- `src/db/schema.js` — existing core and production schema.
- `src/config/catalogs.js` — legacy/core building, troop and market catalogs.
- `economy.js` — existing economy and automatic production logic.
- `public/js/core.js` — existing Mini App core screens.
- `public/js/production.js` — production interface.
- `public/js/settlements.js` — settlement UI and the six-button main menu.

## Important scope note
This update implements the settlement data model and the initial settlement UI/API. The legacy economy still primarily operates on kingdom-level resources; production/workers/food have not yet been fully migrated to independent per-settlement simulation. Siege resolution/capture, real diplomacy treaties, and quest logic also remain follow-up work. Do not treat those as implemented gameplay yet.
