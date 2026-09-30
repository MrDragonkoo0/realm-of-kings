// Non-destructive SQLite schema initialization. Existing rows are preserved.
function initializeSchema(db) {
db.exec(`CREATE TABLE IF NOT EXISTS players (
 telegram_id INTEGER PRIMARY KEY, kingdom_name TEXT, ruler_name TEXT,
 level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0,
 population INTEGER NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 100,
 gems INTEGER NOT NULL DEFAULT 0, cities INTEGER NOT NULL DEFAULT 1,
 villages INTEGER NOT NULL DEFAULT 0, houses INTEGER NOT NULL DEFAULT 0,
 smithy INTEGER NOT NULL DEFAULT 0, farm INTEGER NOT NULL DEFAULT 0,
 stable INTEGER NOT NULL DEFAULT 0, barracks INTEGER NOT NULL DEFAULT 0,
 range INTEGER NOT NULL DEFAULT 0, temple INTEGER NOT NULL DEFAULT 0,
 bakery INTEGER NOT NULL DEFAULT 0, workshop INTEGER NOT NULL DEFAULT 0,
 hospital INTEGER NOT NULL DEFAULT 0, military_power INTEGER NOT NULL DEFAULT 0,
 stone INTEGER NOT NULL DEFAULT 0, wood INTEGER NOT NULL DEFAULT 0,
 iron INTEGER NOT NULL DEFAULT 0, straw INTEGER NOT NULL DEFAULT 0,
 brick INTEGER NOT NULL DEFAULT 0, clay INTEGER NOT NULL DEFAULT 0,
 sand INTEGER NOT NULL DEFAULT 0, bread INTEGER NOT NULL DEFAULT 0,
 meat INTEGER NOT NULL DEFAULT 0, flour INTEGER NOT NULL DEFAULT 0,
 carrot INTEGER NOT NULL DEFAULT 0, potato INTEGER NOT NULL DEFAULT 0,
 water INTEGER NOT NULL DEFAULT 0, apples INTEGER NOT NULL DEFAULT 0, milk INTEGER NOT NULL DEFAULT 0, eggs INTEGER NOT NULL DEFAULT 0,
 wheat INTEGER NOT NULL DEFAULT 0, swordsmen INTEGER NOT NULL DEFAULT 0,
 archers INTEGER NOT NULL DEFAULT 0, shieldmen INTEGER NOT NULL DEFAULT 0,
 cavalry INTEGER NOT NULL DEFAULT 0, knights INTEGER NOT NULL DEFAULT 0,
 townhall_level INTEGER NOT NULL DEFAULT 1,
 warehouse_level INTEGER NOT NULL DEFAULT 1,
 market_level INTEGER NOT NULL DEFAULT 1,
 walls_level INTEGER NOT NULL DEFAULT 1,
 gate_level INTEGER NOT NULL DEFAULT 1,
 field_count INTEGER NOT NULL DEFAULT 0,
 last_tax_at INTEGER NOT NULL DEFAULT 0,
 last_gather_at INTEGER NOT NULL DEFAULT 0,
 building_type TEXT, building_ends_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);`);

// Non-destructive schema migration. Older ROK databases may be missing
// columns that newer server code expects (for example `smithy`).
// Add every known player column that is absent, without deleting existing data.
const ALL_PLAYER_COLUMNS = [
 ['kingdom_name','TEXT'],['ruler_name','TEXT'],
 ['level','INTEGER NOT NULL DEFAULT 1'],['xp','INTEGER NOT NULL DEFAULT 0'],
 ['population','INTEGER NOT NULL DEFAULT 0'],['gold','INTEGER NOT NULL DEFAULT 100'],
 ['gems','INTEGER NOT NULL DEFAULT 0'],['cities','INTEGER NOT NULL DEFAULT 1'],
 ['villages','INTEGER NOT NULL DEFAULT 0'],['houses','INTEGER NOT NULL DEFAULT 0'],
 ['smithy','INTEGER NOT NULL DEFAULT 0'],['farm','INTEGER NOT NULL DEFAULT 0'],
 ['stable','INTEGER NOT NULL DEFAULT 0'],['barracks','INTEGER NOT NULL DEFAULT 0'],
 ['range','INTEGER NOT NULL DEFAULT 0'],['temple','INTEGER NOT NULL DEFAULT 0'],
 ['bakery','INTEGER NOT NULL DEFAULT 0'],['workshop','INTEGER NOT NULL DEFAULT 0'],
 ['hospital','INTEGER NOT NULL DEFAULT 0'],['military_power','INTEGER NOT NULL DEFAULT 0'],
 ['stone','INTEGER NOT NULL DEFAULT 0'],['wood','INTEGER NOT NULL DEFAULT 0'],
 ['iron','INTEGER NOT NULL DEFAULT 0'],['straw','INTEGER NOT NULL DEFAULT 0'],
 ['brick','INTEGER NOT NULL DEFAULT 0'],['clay','INTEGER NOT NULL DEFAULT 0'],
 ['sand','INTEGER NOT NULL DEFAULT 0'],['bread','INTEGER NOT NULL DEFAULT 0'],
 ['meat','INTEGER NOT NULL DEFAULT 0'],['flour','INTEGER NOT NULL DEFAULT 0'],
 ['carrot','INTEGER NOT NULL DEFAULT 0'],['potato','INTEGER NOT NULL DEFAULT 0'],
 ['water','INTEGER NOT NULL DEFAULT 0'],['apples','INTEGER NOT NULL DEFAULT 0'],['milk','INTEGER NOT NULL DEFAULT 0'],['eggs','INTEGER NOT NULL DEFAULT 0'],
 ['wheat','INTEGER NOT NULL DEFAULT 0'],['swordsmen','INTEGER NOT NULL DEFAULT 0'],
 ['archers','INTEGER NOT NULL DEFAULT 0'],['shieldmen','INTEGER NOT NULL DEFAULT 0'],
 ['cavalry','INTEGER NOT NULL DEFAULT 0'],['knights','INTEGER NOT NULL DEFAULT 0'],
 ['townhall_level','INTEGER NOT NULL DEFAULT 1'],['warehouse_level','INTEGER NOT NULL DEFAULT 1'],
 ['market_level','INTEGER NOT NULL DEFAULT 1'],['walls_level','INTEGER NOT NULL DEFAULT 1'],
 ['gate_level','INTEGER NOT NULL DEFAULT 1'],['field_count','INTEGER NOT NULL DEFAULT 0'],
 ['last_tax_at','INTEGER NOT NULL DEFAULT 0'],['last_gather_at','INTEGER NOT NULL DEFAULT 0'],
 ['building_type','TEXT'],['building_ends_at','INTEGER'],['flag_json','TEXT'],
 ['created_at','INTEGER NOT NULL DEFAULT (strftime(\'%s\',\'now\'))'],
 ['sawmill','INTEGER NOT NULL DEFAULT 0'],['mine','INTEGER NOT NULL DEFAULT 0'],
 ['woodcutters','INTEGER NOT NULL DEFAULT 0'],['miners','INTEGER NOT NULL DEFAULT 0'],
 ['last_extraction_at','INTEGER NOT NULL DEFAULT 0']
];
const existingColumns = new Set(db.prepare('PRAGMA table_info(players)').all().map(c => c.name));
for (const [name,def] of ALL_PLAYER_COLUMNS) {
  if (!existingColumns.has(name)) {
    try { db.exec(`ALTER TABLE players ADD COLUMN ${name} ${def}`); } catch (_) {}
  }
}

// v0.10 additive tables: production preferences, event history, and daily export quota.
// These tables are created without replacing or clearing existing player data.
db.exec(`CREATE TABLE IF NOT EXISTS production_preferences (
 telegram_id INTEGER NOT NULL, building_key TEXT NOT NULL,
 priority TEXT NOT NULL DEFAULT 'medium', updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
 PRIMARY KEY (telegram_id, building_key)
);`);
db.exec(`CREATE TABLE IF NOT EXISTS production_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER NOT NULL,
 building_key TEXT NOT NULL, resource_key TEXT NOT NULL, event_type TEXT NOT NULL,
 reason TEXT NOT NULL, created_at INTEGER NOT NULL
);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_production_events_player_time ON production_events(telegram_id, created_at);`);
db.exec(`CREATE TABLE IF NOT EXISTS production_status (
 telegram_id INTEGER NOT NULL, building_key TEXT NOT NULL, is_paused INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
 PRIMARY KEY (telegram_id, building_key)
);`);
db.exec(`CREATE TABLE IF NOT EXISTS export_daily (
 telegram_id INTEGER NOT NULL, day_key TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (telegram_id, day_key)
);`);
}

module.exports = { initializeSchema };
