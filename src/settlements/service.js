'use strict';
const { BUILDING_CATALOG } = require('./catalog');
const { initProductionSchema, tickProduction, capacityFor, inventoryTotal, RESOURCE_NAMES, OUTPUTS, foodStock, foodMetrics } = require('./production');
function initSettlements(db) {
 db.exec(`CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER NOT NULL, name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('city','village')), is_capital INTEGER NOT NULL DEFAULT 0,
  population INTEGER NOT NULL DEFAULT 100, housing INTEGER NOT NULL DEFAULT 200,
  workers INTEGER NOT NULL DEFAULT 0, food INTEGER NOT NULL DEFAULT 100,
  warehouse_capacity INTEGER NOT NULL DEFAULT 1000, gold INTEGER NOT NULL DEFAULT 0,
  defense_level INTEGER NOT NULL DEFAULT 1, last_growth_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
 );
 CREATE INDEX IF NOT EXISTS idx_settlements_owner ON settlements(telegram_id,type);
 CREATE TABLE IF NOT EXISTS settlement_resources (
  settlement_id INTEGER NOT NULL, resource_key TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(settlement_id,resource_key), FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
 );
 CREATE TABLE IF NOT EXISTS settlement_buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, settlement_id INTEGER NOT NULL, building_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1, target_level INTEGER, status TEXT NOT NULL DEFAULT 'built', finish_at INTEGER,
  FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
 );
 CREATE TABLE IF NOT EXISTS settlement_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, settlement_id INTEGER NOT NULL, event TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
 );
 CREATE TABLE IF NOT EXISTS settlement_production_preferences (
  settlement_id INTEGER NOT NULL, building_key TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high','medium','low')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY(settlement_id,building_key), FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
 );`);
 // Migrate older schema that allowed only one copy of each building per settlement.
 const indexes=db.prepare('PRAGMA index_list(settlement_buildings)').all();
 const hasBuildingUnique=indexes.some(ix=>ix.unique && db.prepare(`PRAGMA index_info('${ix.name.replace(/'/g, "''")}')`).all().map(c=>c.name).includes('building_key') && db.prepare(`PRAGMA index_info('${ix.name.replace(/'/g, "''")}')`).all().map(c=>c.name).includes('settlement_id'));
 if(hasBuildingUnique){
  db.exec(`CREATE TABLE settlement_buildings_new (
   id INTEGER PRIMARY KEY AUTOINCREMENT, settlement_id INTEGER NOT NULL, building_key TEXT NOT NULL,
   level INTEGER NOT NULL DEFAULT 1, target_level INTEGER, status TEXT NOT NULL DEFAULT 'built', finish_at INTEGER,
   FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
  );
  INSERT INTO settlement_buildings_new(id,settlement_id,building_key,level,target_level,status,finish_at)
   SELECT id,settlement_id,building_key,level,target_level,status,finish_at FROM settlement_buildings;
  DROP TABLE settlement_buildings;
  ALTER TABLE settlement_buildings_new RENAME TO settlement_buildings;`);
 }
 const buildingColumns=db.prepare('PRAGMA table_info(settlement_buildings)').all().map(x=>x.name);
 if(!buildingColumns.includes('target_level')) db.exec('ALTER TABLE settlement_buildings ADD COLUMN target_level INTEGER');
 const columns=db.prepare('PRAGMA table_info(settlements)').all().map(x=>x.name);
 if(!columns.includes('last_growth_at')) db.exec("ALTER TABLE settlements ADD COLUMN last_growth_at INTEGER NOT NULL DEFAULT 0");
 db.exec(`CREATE TABLE IF NOT EXISTS settlement_garrisons (
  settlement_id INTEGER NOT NULL, unit_key TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0 CHECK(amount>=0),
  PRIMARY KEY(settlement_id,unit_key), FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
 );
 CREATE TABLE IF NOT EXISTS army_upkeep_state (
  telegram_id INTEGER PRIMARY KEY, last_tick INTEGER NOT NULL DEFAULT 0,
  gold_remainder REAL NOT NULL DEFAULT 0, food_remainder REAL NOT NULL DEFAULT 0,
  last_food_shortage REAL NOT NULL DEFAULT 0
 );`);
 db.exec(`CREATE TABLE IF NOT EXISTS army_units (
  telegram_id INTEGER NOT NULL, unit_key TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0 CHECK(amount>=0), level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(telegram_id,unit_key)
 );
 CREATE TABLE IF NOT EXISTS army_technologies (
  telegram_id INTEGER NOT NULL, tech_key TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(telegram_id,tech_key)
 );
 CREATE TABLE IF NOT EXISTS army_commanders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER NOT NULL, name TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, trait TEXT NOT NULL DEFAULT 'Тактик'
 );
 CREATE TABLE IF NOT EXISTS army_state (
  telegram_id INTEGER PRIMARY KEY, formation TEXT NOT NULL DEFAULT 'balanced', morale INTEGER NOT NULL DEFAULT 100, fatigue INTEGER NOT NULL DEFAULT 0, rank_xp INTEGER NOT NULL DEFAULT 0, rank_level INTEGER NOT NULL DEFAULT 1, last_battle TEXT NOT NULL DEFAULT ''
 );
 CREATE TABLE IF NOT EXISTS army_navy (
  telegram_id INTEGER NOT NULL, ship_key TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0 CHECK(amount>=0),
  PRIMARY KEY(telegram_id,ship_key)
 );
 CREATE TABLE IF NOT EXISTS army_prisoners (
  telegram_id INTEGER PRIMARY KEY, amount INTEGER NOT NULL DEFAULT 0 CHECK(amount>=0)
 );
 CREATE TABLE IF NOT EXISTS army_mercenaries (
  telegram_id INTEGER NOT NULL, unit_key TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0 CHECK(amount>=0), expires_at INTEGER NOT NULL,
  PRIMARY KEY(telegram_id,unit_key)
 );
 CREATE TABLE IF NOT EXISTS army_pvp_battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, challenger_id INTEGER NOT NULL, defender_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  result TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), completed_at INTEGER
 );
 CREATE INDEX IF NOT EXISTS idx_army_pvp_defender ON army_pvp_battles(defender_id,status);`);
 initProductionSchema(db);
 const players=db.prepare('SELECT telegram_id,kingdom_name,population,gold,wood,stone,iron FROM players').all();
 const add=db.prepare('INSERT INTO settlements(telegram_id,name,type,is_capital,population,housing,gold) VALUES(?,?,\'city\',1,?,?,?)');
 for(const p of players){
  let capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);
  if(!capital){add.run(p.telegram_id,(p.kingdom_name||'Столиця')+' — столиця',Math.max(20,p.population||20),Math.max(200,(p.population||20)+180),p.gold||0);capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);
   for(const [key,val] of [['wood',p.wood||0],['stone',p.stone||0],['iron',p.iron||0]]) db.prepare('INSERT OR IGNORE INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(capital.id,key,val);
   db.prepare('UPDATE players SET wood=0,stone=0,iron=0 WHERE telegram_id=?').run(p.telegram_id);
   for(const key of ['logging_camp','stone_quarry']) db.prepare('INSERT OR IGNORE INTO settlement_buildings(settlement_id,building_key,level,status) VALUES(?,?,1,\'built\')').run(capital.id,key);
   db.prepare('UPDATE settlements SET last_production_at=? WHERE id=? AND last_production_at=0').run(Math.floor(Date.now()/1000),capital.id);
  }
 }
 // Move legacy kingdom materials into each capital exactly once, then keep the old global fields empty.
 for(const p of db.prepare('SELECT telegram_id,wood,stone,iron FROM players').all()){const c=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);if(!c)continue;for(const r of ['wood','stone','iron']){const exists=db.prepare('SELECT 1 ok FROM settlement_resources WHERE settlement_id=? AND resource_key=?').get(c.id,r);if(!exists)db.prepare('INSERT INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(c.id,r,Math.max(0,p[r]||0));}db.prepare('UPDATE players SET wood=0,stone=0,iron=0 WHERE telegram_id=?').run(p.telegram_id);}
 // Give the two free starter production buildings two workers each; all other buildings can be staffed in the settlement UI.
 db.exec("INSERT OR IGNORE INTO settlement_building_workers(building_id,settlement_id,workers) SELECT id,settlement_id,2 FROM settlement_buildings WHERE status='built' AND level>0 AND building_key IN ('logging_camp','stone_quarry')");
 db.exec("INSERT OR IGNORE INTO settlement_building_workers(building_id,settlement_id,workers) SELECT id,settlement_id,0 FROM settlement_buildings WHERE building_key NOT IN ('logging_camp','stone_quarry')");
 // Keep the legacy food field and each settlement's inventory in sync on migration.
 for(const s of db.prepare('SELECT id,food FROM settlements').all()) db.prepare('INSERT OR IGNORE INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(s.id,'food',Math.max(0,s.food||0));
}
function ownerSettlement(db, id, sid){return db.prepare('SELECT * FROM settlements WHERE id=? AND telegram_id=?').get(sid,id)}
function tickSettlements(db, now=Math.floor(Date.now()/1000)){
 tickProduction(db,now);
 // Finish timed construction and upgrades when the player returns or opens settlements.
 const finished=db.prepare("SELECT * FROM settlement_buildings WHERE status IN ('building','upgrading') AND finish_at IS NOT NULL AND finish_at<=?").all(now);
 for(const b of finished){if(b.status==='upgrading') db.prepare("UPDATE settlement_buildings SET level=COALESCE(target_level,level+1),target_level=NULL,status='built',finish_at=NULL WHERE id=?").run(b.id); else db.prepare("UPDATE settlement_buildings SET status='built',finish_at=NULL WHERE id=?").run(b.id);}
 const due=db.prepare('SELECT * FROM settlements WHERE last_growth_at<=?').all(now-18000);
 for(const s of due){const housed=s.population<s.housing;const metrics=foodMetrics(db,s);const fed=metrics.foodStock>0;const interval=metrics.foodStatus==='Збалансований раціон'?18000:21600;if(now-(s.last_growth_at||0)<interval)continue;if(housed&&fed)db.prepare('UPDATE settlements SET population=population+1,last_growth_at=? WHERE id=?').run(now,s.id);else db.prepare('UPDATE settlements SET last_growth_at=? WHERE id=?').run(now,s.id); }
 db.prepare("UPDATE settlements SET type='city' WHERE type='village' AND population>=10000").run();
}
function listSettlements(db,id){
 tickSettlements(db);
 const rows=db.prepare('SELECT s.*, (SELECT COUNT(*) FROM settlement_buildings b WHERE b.settlement_id=s.id) AS buildings_count FROM settlements s WHERE telegram_id=? ORDER BY is_capital DESC,type,name').all(id);
 return {cities:rows.filter(x=>x.type==='city'),villages:rows.filter(x=>x.type==='village'),counts:{cities:rows.filter(x=>x.type==='city').length,villages:rows.filter(x=>x.type==='village').length},settlements:rows};
}
function detail(db,id,sid){const s=ownerSettlement(db,id,sid);if(!s)return null;return {...s,resources:Object.fromEntries(db.prepare('SELECT resource_key,amount FROM settlement_resources WHERE settlement_id=?').all(sid).map(x=>[x.resource_key,x.amount])),buildings:db.prepare('SELECT b.*,c.name,c.category FROM settlement_buildings b LEFT JOIN (SELECT key,name,category FROM json_each(?)) c ON 0 WHERE b.settlement_id=?').all('[]',sid)};}
function installSettlementRoutes(app,db,getUserId){
 app.get('/api/settlements',(req,res)=>{try{const id=getUserId(req);res.json(listSettlements(db,id));}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/settlements',(req,res)=>{try{const id=getUserId(req),name=String(req.body.name||'').trim();if(!name||name.length>40)return res.status(400).json({error:'Назва поселення: 1–40 символів'});const p=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id);if(!p)return res.status(400).json({error:'Спочатку створи королівство'});if(p.gold<500)return res.status(400).json({error:'Для заснування села потрібно 500 золота'});const n=db.prepare('SELECT COUNT(*) n FROM settlements WHERE telegram_id=?').get(id).n;if(n>=26)return res.status(400).json({error:'Досягнуто ліміту у 25 поселень плюс столиця'});const info=db.prepare("INSERT INTO settlements(telegram_id,name,type,population,housing,food,gold) VALUES(?,?,'village',100,200,100,0)").run(id,name);db.prepare('UPDATE players SET gold=gold-500,xp=xp+5 WHERE telegram_id=?').run(id);const sid=Number(info.lastInsertRowid);db.prepare('UPDATE settlements SET last_production_at=? WHERE id=?').run(Math.floor(Date.now()/1000),sid);db.prepare('INSERT OR IGNORE INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(sid,'food',100);const capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(id);if(capital){for(const [r,amount] of [['wood',20],['stone',10]]){const have=db.prepare('SELECT amount FROM settlement_resources WHERE settlement_id=? AND resource_key=?').get(capital.id,r)?.amount||0;const moved=Math.min(have,amount);if(moved){db.prepare('UPDATE settlement_resources SET amount=amount-? WHERE settlement_id=? AND resource_key=?').run(moved,capital.id,r);db.prepare('INSERT INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?) ON CONFLICT(settlement_id,resource_key) DO UPDATE SET amount=amount+excluded.amount').run(sid,r,moved);}}}for(const key of ['logging_camp','stone_quarry'])db.prepare("INSERT INTO settlement_buildings(settlement_id,building_key,level,status) VALUES(?,?,1,'built')").run(sid,key);for(const b of db.prepare("SELECT id FROM settlement_buildings WHERE settlement_id=? AND building_key IN ('logging_camp','stone_quarry')").all(sid))db.prepare('INSERT OR IGNORE INTO settlement_building_workers(building_id,settlement_id,workers) VALUES(?,?,2)').run(b.id,sid);db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'founded','Засновано нове село');res.json({settlement:ownerSettlement(db,id,sid),...listSettlements(db,id)});}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/settlements/:sid/production-priority',(req,res)=>{try{const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid),key=String(req.body.key||''),priority=String(req.body.priority||'');if(!s)return res.status(404).json({error:'Поселення не знайдено'});if(!BUILDING_CATALOG.some(b=>b.key===key)||!OUTPUTS[key])return res.status(400).json({error:'Ця будівля не виробляє ресурси'});if(!['high','medium','low'].includes(priority))return res.status(400).json({error:'Невірний пріоритет'});db.prepare(`INSERT INTO settlement_production_preferences(settlement_id,building_key,priority,updated_at) VALUES(?,?,?,?) ON CONFLICT(settlement_id,building_key) DO UPDATE SET priority=excluded.priority,updated_at=excluded.updated_at`).run(sid,key,priority,Math.floor(Date.now()/1000));db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'production_priority',`Пріоритет виробництва «${key}» змінено на «${priority}»`);res.json({ok:true,settlementId:sid,key,priority});}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/settlements/:sid/buildings/:buildingId/workers',(req,res)=>{try{const id=getUserId(req),sid=Number(req.params.sid),bid=Number(req.params.buildingId),s=ownerSettlement(db,id,sid);if(!s)return res.status(404).json({error:'Поселення не знайдено'});const b=db.prepare("SELECT * FROM settlement_buildings WHERE id=? AND settlement_id=? AND status='built' AND level>0").get(bid,sid);if(!b||!OUTPUTS[b.building_key])return res.status(400).json({error:'Працівників можна призначати лише на готові виробничі будівлі'});const workers=Math.floor(Number(req.body.workers));if(!Number.isFinite(workers)||workers<0||workers>20)return res.status(400).json({error:'Кількість працівників має бути від 0 до 20'});const assigned=db.prepare('SELECT COALESCE(SUM(workers),0) n FROM settlement_building_workers WHERE settlement_id=? AND building_id<>?').get(sid,bid).n;if(assigned+workers>s.population)return res.status(400).json({error:`Недостатньо вільних жителів. Вільно: ${Math.max(0,s.population-assigned)}.`});db.prepare('INSERT INTO settlement_building_workers(building_id,settlement_id,workers,wage_debt) VALUES(?,?,?,0) ON CONFLICT(building_id) DO UPDATE SET workers=excluded.workers').run(bid,sid,workers);db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'workers_assigned',`На будівлю ${b.building_key} призначено працівників: ${workers}`);res.json({ok:true,buildingId:bid,workers,assignedTotal:assigned+workers,freeWorkers:s.population-assigned-workers,wagePerHour:workers});}catch(e){res.status(400).json({error:e.message})}});
 app.get('/api/settlements/catalog/buildings',(req,res)=>res.json({catalog:BUILDING_CATALOG}));
 app.get('/api/settlements/:sid',(req,res)=>{try{tickSettlements(db);const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid);if(!s)return res.status(404).json({error:'Поселення не знайдено'});const priorityRows=db.prepare('SELECT building_key,priority FROM settlement_production_preferences WHERE settlement_id=?').all(sid);const priorityMap=Object.fromEntries(priorityRows.map(x=>[x.building_key,x.priority]));const buildings=db.prepare('SELECT b.id,b.building_key,b.level,b.target_level,b.status,b.finish_at,COALESCE(w.workers,0) workers,COALESCE(w.wage_debt,0) wage_debt FROM settlement_buildings b LEFT JOIN settlement_building_workers w ON w.building_id=b.id WHERE b.settlement_id=? ORDER BY b.id').all(sid).map(b=>({...b,priority:priorityMap[b.building_key]||'medium',...(BUILDING_CATALOG.find(c=>c.key===b.building_key)||{})}));const resources=Object.fromEntries(db.prepare('SELECT resource_key,amount FROM settlement_resources WHERE settlement_id=?').all(sid).map(x=>[x.resource_key,x.amount]));const productionRates={};for(const b of buildings){if(b.status!=='built'||!OUTPUTS[b.building_key])continue;const mult=(1+0.25*Math.max(0,b.level-1))*(Number(b.workers||0)/2)*(Number(b.wage_debt||0)>=Number(b.workers||0)*48?0:Number(b.wage_debt||0)>=Number(b.workers||0)*12?0.75:1);for(const [r,n] of Object.entries(OUTPUTS[b.building_key]))productionRates[r]=(productionRates[r]||0)+n*mult;}const assignedWorkers=buildings.reduce((n,b)=>n+Number(b.workers||0),0),wageDebt=buildings.reduce((n,b)=>n+Number(b.wage_debt||0),0);const workersStats={assignedWorkers,freeWorkers:Math.max(0,s.population-assignedWorkers),wagesPerHour:assignedWorkers,totalWageDebt:wageDebt};res.json({...s,workersStats,resources,resourceNames:RESOURCE_NAMES,productionRates,...foodMetrics(db,s),warehouseUsed:inventoryTotal(db,sid),warehouseCapacity:capacityFor(db,sid),buildings,defensePower:s.defense_level*100+(buildings.filter(b=>['wooden_palisade','stone_wall','reinforced_wall','main_gate','iron_gate','watchtower','archer_tower','bastion'].includes(b.building_key)).reduce((n,b)=>n+b.level*50,0))});}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/settlements/:sid/build',(req,res)=>{try{
  const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid),key=String(req.body.key||''),b=BUILDING_CATALOG.find(x=>x.key===key);
  if(!s||!b)return res.status(400).json({error:'Поселення або будівлю не знайдено'});
  tickSettlements(db);
  // Multiple copies of the same building are allowed in one settlement.
  const p=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id),cost=b.baseCost;
  const stock=Object.fromEntries(db.prepare('SELECT resource_key,amount FROM settlement_resources WHERE settlement_id=?').all(sid).map(x=>[x.resource_key,x.amount]));
  if(!p || (p.gold||0)<cost.gold || ['wood','stone','iron'].some(r=>(stock[r]||0)<cost[r]))return res.status(400).json({error:`Недостатньо ресурсів у цьому поселенні або золота в казні. Потрібно: ${cost.gold} золота в казні, ${cost.wood} деревини, ${cost.stone} каменю, ${cost.iron} заліза на складі поселення.`});
  db.prepare('UPDATE players SET gold=gold-? WHERE telegram_id=?').run(cost.gold,id);
  for(const r of ['wood','stone','iron']) if(cost[r]) db.prepare('UPDATE settlement_resources SET amount=amount-? WHERE settlement_id=? AND resource_key=?').run(cost[r],sid,r);
  const finish=Math.floor(Date.now()/1000)+b.baseSeconds;
  db.prepare("INSERT INTO settlement_buildings(settlement_id,building_key,level,status,finish_at) VALUES(?,?,0,'building',?)").run(sid,key,finish);
  db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'building_started',`Розпочато будівництво: ${b.name}; завершення через ${Math.ceil(b.baseSeconds/60)} хв.`);
  res.json({ok:true,settlementId:sid,status:'building',finish_at:finish,duration_seconds:b.baseSeconds,cost});
 }catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/settlements/:sid/upgrade',(req,res)=>{try{
  const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid),key=String(req.body.key||'');if(!s)return res.status(404).json({error:'Поселення не знайдено'});
  tickSettlements(db);
  const buildingId=Number(req.body.buildingId||0);const b=buildingId?db.prepare('SELECT * FROM settlement_buildings WHERE settlement_id=? AND id=?').get(sid,buildingId):db.prepare("SELECT * FROM settlement_buildings WHERE settlement_id=? AND building_key=? AND status='built' ORDER BY level,id LIMIT 1").get(sid,key);if(!b)return res.status(400).json({error:'Спочатку збудуй цю будівлю'});
  if(b.status!=='built')return res.status(400).json({error:'Ця будівля вже будується або покращується.'});
  const item=BUILDING_CATALOG.find(x=>x.key===key);if(!item)return res.status(400).json({error:'Немає даних про будівлю'});
  const nextLevel=b.level+1,scale=Math.pow(1.5,b.level),cost=Object.fromEntries(['wood','stone','iron','gold'].map(r=>[r,Math.ceil(item.baseCost[r]*scale*0.8)]));
  const p=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id);
  const stock=Object.fromEntries(db.prepare('SELECT resource_key,amount FROM settlement_resources WHERE settlement_id=?').all(sid).map(x=>[x.resource_key,x.amount]));
  if(!p || (p.gold||0)<cost.gold || ['wood','stone','iron'].some(r=>(stock[r]||0)<cost[r]))return res.status(400).json({error:`Для покращення до рівня ${nextLevel} потрібно: ${cost.gold} золота в казні, ${cost.wood} деревини, ${cost.stone} каменю, ${cost.iron} заліза на складі цього поселення.`});
  db.prepare('UPDATE players SET gold=gold-? WHERE telegram_id=?').run(cost.gold,id);
  for(const r of ['wood','stone','iron']) if(cost[r]) db.prepare('UPDATE settlement_resources SET amount=amount-? WHERE settlement_id=? AND resource_key=?').run(cost[r],sid,r);
  const duration=Math.ceil(item.baseSeconds*(0.75+nextLevel*0.45));const finish=Math.floor(Date.now()/1000)+duration;
  db.prepare("UPDATE settlement_buildings SET target_level=?,status='upgrading',finish_at=? WHERE id=?").run(nextLevel,finish,b.id);
  db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'upgrade_started',`Розпочато покращення ${item.name} до рівня ${nextLevel}; ${Math.ceil(duration/60)} хв.`);
  res.json({ok:true,status:'upgrading',level:b.level,target_level:nextLevel,finish_at:finish,duration_seconds:duration,cost});
 }catch(e){res.status(400).json({error:e.message})}});

// v0.10.9 army garrisons and hourly upkeep.
const UNIT_KEYS=['swordsmen','archers','shieldmen','cavalry','knights'];
const UNIT_POWER={swordsmen:1,archers:3,shieldmen:2,cavalry:7,knights:15};
const UNIT_UPKEEP={swordsmen:0.1,archers:0.1,shieldmen:0.1,cavalry:0.3,knights:0.5};
function armyTotals(db,id){
 const p=db.prepare('SELECT swordsmen,archers,shieldmen,cavalry,knights,gold FROM players WHERE telegram_id=?').get(id);
 if(!p)return null;
 const field=Object.fromEntries(UNIT_KEYS.map(k=>[k,Number(p[k]||0)]));
 const rows=db.prepare(`SELECT g.unit_key,SUM(g.amount) amount FROM settlement_garrisons g JOIN settlements s ON s.id=g.settlement_id WHERE s.telegram_id=? GROUP BY g.unit_key`).all(id);
 const garrison=Object.fromEntries(UNIT_KEYS.map(k=>[k,0]));for(const r of rows)if(UNIT_KEYS.includes(r.unit_key))garrison[r.unit_key]=Number(r.amount||0);
 const total=Object.fromEntries(UNIT_KEYS.map(k=>[k,field[k]+garrison[k]]));
 const count=UNIT_KEYS.reduce((n,k)=>n+total[k],0);
 const advancedRows=db.prepare('SELECT unit_key,amount FROM army_units WHERE telegram_id=?').all(id);
 const mercRows=db.prepare('SELECT unit_key,amount FROM army_mercenaries WHERE telegram_id=? AND expires_at>?').all(id,Math.floor(Date.now()/1000));
 const advancedUpkeep=advancedRows.reduce((n,u)=>n+Number(u.amount||0)*(({spearmen:.12,crossbowmen:.16,heavy_infantry:.22,longbowmen:.18,horse_archers:.32,lancers:.35,royal_guards:.7,trebuchets:.5,battering_rams:.35})[u.unit_key]||.1),0);
 const mercUpkeep=mercRows.reduce((n,u)=>n+Number(u.amount||0)*(({spearmen:.12,crossbowmen:.16,heavy_infantry:.22,longbowmen:.18,horse_archers:.32,lancers:.35,royal_guards:.7,trebuchets:.5,battering_rams:.35})[u.unit_key]||.1),0);
 const hourlyGold=UNIT_KEYS.reduce((n,k)=>n+total[k]*UNIT_UPKEEP[k],0)+advancedUpkeep+mercUpkeep;
 const capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(id);
 const settlements=db.prepare('SELECT id,name,type,is_capital,population FROM settlements WHERE telegram_id=? ORDER BY is_capital DESC,type,name').all(id).map(x=>{
  const units=db.prepare('SELECT unit_key,amount FROM settlement_garrisons WHERE settlement_id=?').all(x.id);
  const g=Object.fromEntries(UNIT_KEYS.map(k=>[k,0]));for(const u of units)if(UNIT_KEYS.includes(u.unit_key))g[u.unit_key]=Number(u.amount||0);
  const soldiers=UNIT_KEYS.reduce((n,k)=>n+g[k],0);
  return {...x,garrison:g,soldiers,power:UNIT_KEYS.reduce((n,k)=>n+g[k]*UNIT_POWER[k],0)};
 });
 const food=capital?db.prepare("SELECT resource_key,amount FROM settlement_resources WHERE settlement_id=? AND resource_key IN ('food','bread','wheat','carrot','potato','apples','milk','eggs','meat')").all(capital.id):[];
 const values={food:1,bread:1.25,wheat:.8,carrot:.7,potato:.9,apples:.7,milk:1.1,eggs:1.2,meat:1.5};
 const foodStock=food.reduce((n,r)=>n+Number(r.amount||0)*(values[r.resource_key]||1),0);
 const hourlyFood=(count+advancedRows.reduce((n,u)=>n+Number(u.amount||0),0)+mercRows.reduce((n,u)=>n+Number(u.amount||0),0))/10;
 return {field,garrison,total,count,power:UNIT_KEYS.reduce((n,k)=>n+total[k]*UNIT_POWER[k],0),hourlyGold,hourlyFood,gold:Number(p.gold||0),settlements,capitalSettlementId:capital?.id||null,foodStock,foodHours:hourlyFood>0?foodStock/hourlyFood:null};
}
function tickArmyUpkeep(db,id,now=Math.floor(Date.now()/1000)){
 const a=armyTotals(db,id);if(!a)return;
 let st=db.prepare('SELECT * FROM army_upkeep_state WHERE telegram_id=?').get(id);
 if(!st){db.prepare('INSERT INTO army_upkeep_state(telegram_id,last_tick) VALUES(?,?)').run(id,now);return;}
 const hours=Math.min(24,Math.max(0,Math.floor((now-Number(st.last_tick||now))/3600)));
 if(!hours)return;
 let goldRemainder=Number(st.gold_remainder||0),foodRemainder=Number(st.food_remainder||0),shortage=0;
 const goldDue=goldRemainder+a.hourlyGold*hours,foodDue=foodRemainder+a.hourlyFood*hours;
 const goldCharge=Math.floor(goldDue);goldRemainder=goldDue-goldCharge;
 const player=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id);
 const paid=Math.min(Number(player?.gold||0),goldCharge);
 if(paid)db.prepare('UPDATE players SET gold=gold-? WHERE telegram_id=?').run(paid,id);
 if(a.capitalSettlementId){
  let remain=foodDue;const order=['food','wheat','carrot','potato','apples','bread','milk','eggs','meat'];
  const value={food:1,wheat:.8,carrot:.7,potato:.9,apples:.7,bread:1.25,milk:1.1,eggs:1.2,meat:1.5};
  for(const key of order){if(remain<=0)break;const row=db.prepare('SELECT amount FROM settlement_resources WHERE settlement_id=? AND resource_key=?').get(a.capitalSettlementId,key);const have=Number(row?.amount||0);if(have<=0)continue;const take=Math.min(have,remain/(value[key]||1));db.prepare('UPDATE settlement_resources SET amount=MAX(0,amount-?) WHERE settlement_id=? AND resource_key=?').run(take,a.capitalSettlementId,key);remain-=take*(value[key]||1);}
  shortage=Math.max(0,remain);foodRemainder=0;
 }else{shortage=foodDue;foodRemainder=0;}
 db.prepare(`INSERT INTO army_upkeep_state(telegram_id,last_tick,gold_remainder,food_remainder,last_food_shortage) VALUES(?,?,?,?,?)
 ON CONFLICT(telegram_id) DO UPDATE SET last_tick=excluded.last_tick,gold_remainder=excluded.gold_remainder,food_remainder=excluded.food_remainder,last_food_shortage=excluded.last_food_shortage`).run(id,now,goldRemainder,foodRemainder,shortage);
}
app.get('/api/army',(req,res)=>{try{const id=getUserId(req);tickArmyUpkeep(db,id);const a=armyTotals(db,id);if(!a)return res.status(400).json({error:'Немає королівства'});const upkeep=db.prepare('SELECT last_food_shortage FROM army_upkeep_state WHERE telegram_id=?').get(id);res.json({...a,lastFoodShortage:Number(upkeep?.last_food_shortage||0),unitPower:UNIT_POWER,unitUpkeep:UNIT_UPKEEP});}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/army/garrison',(req,res)=>{try{
 const id=getUserId(req),sid=Number(req.body.sid),type=String(req.body.type||''),amount=Math.floor(Number(req.body.amount)),action=String(req.body.action||'deploy');
 if(!UNIT_KEYS.includes(type)||!Number.isFinite(amount)||amount<1||amount>100000)return res.status(400).json({error:'Перевір тип війська та кількість (1–100000).'});
 const settlement=ownerSettlement(db,id,sid);if(!settlement)return res.status(404).json({error:'Поселення не знайдено'});
 const p=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);if(!p)return res.status(400).json({error:'Немає королівства'});
 const current=Number(db.prepare('SELECT amount FROM settlement_garrisons WHERE settlement_id=? AND unit_key=?').get(sid,type)?.amount||0);
 if(action==='deploy'){
  if(Number(p[type]||0)<amount)return res.status(400).json({error:'У польовому війську недостатньо таких солдатів.'});
  db.prepare(`UPDATE players SET ${type}=${type}-? WHERE telegram_id=?`).run(amount,id);
  db.prepare('INSERT INTO settlement_garrisons(settlement_id,unit_key,amount) VALUES(?,?,?) ON CONFLICT(settlement_id,unit_key) DO UPDATE SET amount=amount+excluded.amount').run(sid,type,amount);
 }else if(action==='recall'){
  if(current<amount)return res.status(400).json({error:'У гарнізоні недостатньо таких солдатів.'});
  db.prepare('UPDATE settlement_garrisons SET amount=amount-? WHERE settlement_id=? AND unit_key=?').run(amount,sid,type);
  db.prepare(`UPDATE players SET ${type}=${type}+? WHERE telegram_id=?`).run(amount,id);
 }else return res.status(400).json({error:'Невідома дія'});
 db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'garrison',`${action==='deploy'?'До гарнізону передано':'З гарнізону повернуто'} ${amount} — ${type}`);
 tickArmyUpkeep(db,id);
 res.json(armyTotals(db,id));
}catch(e){res.status(400).json({error:e.message})}});
// v0.11.0 advanced military systems. New mechanics use separate tables to preserve legacy troop data.
 const ADV_UNITS={
 militia:{name:'Селянське ополчення',category:'Піхота',power:1,cost:8,upkeep:.05},spearmen:{name:'Списники',category:'Піхота',power:2,cost:18,upkeep:.12},heavy_infantry:{name:'Важка піхота',category:'Піхота',power:5,cost:45,upkeep:.22},twohanded_swordsmen:{name:'Дворучні мечники',category:'Піхота',power:7,cost:65,upkeep:.28},crossbowmen:{name:'Арбалетники',category:'Стрільці',power:4,cost:32,upkeep:.16},longbowmen:{name:'Довгобійні лучники',category:'Стрільці',power:5,cost:42,upkeep:.18},royal_archers:{name:'Королівські стрільці',category:'Стрільці',power:8,cost:95,upkeep:.28},horse_archers:{name:'Кінні лучники',category:'Кіннота',power:8,cost:70,upkeep:.32},scouts:{name:'Кінні розвідники',category:'Кіннота',power:4,cost:38,upkeep:.2},lancers:{name:'Кінні списники',category:'Кіннота',power:9,cost:85,upkeep:.35},heavy_cavalry:{name:'Важка кіннота',category:'Кіннота',power:12,cost:125,upkeep:.48},royal_knights:{name:'Королівські лицарі',category:'Еліта',power:20,cost:230,upkeep:.85},royal_guards:{name:'Королівська гвардія',category:'Еліта',power:18,cost:180,upkeep:.7},palace_guard:{name:'Палацова варта',category:'Еліта',power:15,cost:165,upkeep:.65},veterans:{name:'Воїни-ветерани',category:'Еліта',power:13,cost:145,upkeep:.55},general_guard:{name:'Гвардія генерала',category:'Еліта',power:16,cost:190,upkeep:.72},trebuchets:{name:'Требушети',category:'Облогова техніка',power:25,cost:260,upkeep:.5},catapults:{name:'Катапульти',category:'Облогова техніка',power:18,cost:190,upkeep:.42},battering_rams:{name:'Тарани',category:'Облогова техніка',power:14,cost:150,upkeep:.35},siege_towers:{name:'Облогові вежі',category:'Облогова техніка',power:20,cost:230,upkeep:.48},siege_ballistae:{name:'Облогові балісти',category:'Облогова техніка',power:22,cost:240,upkeep:.45},mercenary_swordsmen:{name:'Наймані мечники',category:'Найманці',power:6,cost:55,upkeep:.25},mercenary_archers:{name:'Наймані лучники',category:'Найманці',power:5,cost:48,upkeep:.22},mercenary_knights:{name:'Наймані лицарі',category:'Найманці',power:14,cost:155,upkeep:.62}};
 const ADV_TECHS={weaponry:{name:'Військова зброя',cost:180},armor:{name:'Захисні обладунки',cost:200},logistics:{name:'Військова логістика',cost:240},naval:{name:'Мореплавство',cost:300},siegecraft:{name:'Облогова справа',cost:280}};
 const FORMATIONS={balanced:{name:'Збалансований стрій',attack:1,defense:1},shield_wall:{name:'Стіна щитів',attack:.9,defense:1.25},wedge:{name:'Клин',attack:1.25,defense:.85},archer_line:{name:'Лінія стрільців',attack:1.15,defense:.9},skirmish:{name:'Розсипний стрій',attack:1.05,defense:1.05}};
 const SHIPS={transport:{name:'Транспортне судно',cost:220,capacity:100},warship:{name:'Бойовий корабель',cost:420,capacity:0},galley:{name:'Галера',cost:650,capacity:0},flagship:{name:'Королівський флагман',cost:1100,capacity:0}};
 function ensureArmyState(id){db.prepare('INSERT OR IGNORE INTO army_state(telegram_id) VALUES(?)').run(id);db.prepare('INSERT OR IGNORE INTO army_prisoners(telegram_id) VALUES(?)').run(id);}
 function advancedArmy(id){
  ensureArmyState(id); const now=Math.floor(Date.now()/1000);
  db.prepare('DELETE FROM army_mercenaries WHERE telegram_id=? AND expires_at<=?').run(id,now);
  const units=db.prepare('SELECT unit_key,amount,level,xp FROM army_units WHERE telegram_id=?').all(id).map(x=>({...x,...ADV_UNITS[x.unit_key]}));
  const technologies=db.prepare('SELECT tech_key,level FROM army_technologies WHERE telegram_id=?').all(id);
  const commanders=db.prepare('SELECT id,name,level,xp,trait FROM army_commanders WHERE telegram_id=? ORDER BY level DESC,id').all(id);
  const ships=db.prepare('SELECT ship_key,amount FROM army_navy WHERE telegram_id=?').all(id).map(x=>({...x,...SHIPS[x.ship_key]}));
  const mercenaries=db.prepare('SELECT unit_key,amount,expires_at FROM army_mercenaries WHERE telegram_id=? AND expires_at>?').all(id,now).map(x=>({...x,name:ADV_UNITS[x.unit_key]?.name||x.unit_key}));
  const state=db.prepare('SELECT * FROM army_state WHERE telegram_id=?').get(id);const prisoners=Number(db.prepare('SELECT amount FROM army_prisoners WHERE telegram_id=?').get(id)?.amount||0);
  const legacy=db.prepare('SELECT swordsmen,archers,shieldmen,cavalry,knights,gold FROM players WHERE telegram_id=?').get(id);
  const legacyCount=['swordsmen','archers','shieldmen','cavalry','knights'].reduce((n,k)=>n+Number(legacy?.[k]||0),0);
  const advancedCount=units.reduce((n,u)=>n+Number(u.amount),0), mercCount=mercenaries.reduce((n,u)=>n+Number(u.amount),0);
  const techBonus=technologies.reduce((n,t)=>n+t.level,0)*.04;
  const unitCount=(keys)=>units.filter(u=>keys.includes(u.unit_key)).reduce((n,u)=>n+u.amount,0);
  const traitDescriptions={Тактик:'Збалансований бонус до бойової сили',Захисник:'Краще тримає оборону',Полководець:'Підсилює всю армію',Розвідник:'Допомагає у походах',Піхотинець:'Підсилює піхоту',Лучник:'Підсилює стрільців',Кавалерист:'Підсилює кінноту','Облоговий майстер':'Підсилює облогову техніку',Адмірал:'Підсилює флот'};
  const commandersWithBonuses=commanders.map(c=>({...c,bonusDescription:traitDescriptions[c.trait]||traitDescriptions.Тактик}));
  let commanderBonus=0;
  for(const c of commanders){const lv=Math.min(.2,c.level*.02);if(c.trait==='Полководець'||c.trait==='Тактик')commanderBonus+=lv;else if(c.trait==='Піхотинець'&&unitCount(['militia','spearmen','heavy_infantry','twohanded_swordsmen'])>0)commanderBonus+=lv;else if(c.trait==='Лучник'&&unitCount(['crossbowmen','longbowmen','royal_archers','horse_archers','mercenary_archers'])>0)commanderBonus+=lv;else if(c.trait==='Кавалерист'&&unitCount(['horse_archers','scouts','lancers','heavy_cavalry','royal_knights'])>0)commanderBonus+=lv;else if(c.trait==='Облоговий майстер'&&unitCount(['trebuchets','catapults','battering_rams','siege_towers','siege_ballistae'])>0)commanderBonus+=lv;else if(c.trait==='Захисник')commanderBonus+=lv*.75;else if(c.trait==='Розвідник')commanderBonus+=lv*.5;}
  commanderBonus=Math.min(.45,commanderBonus);
  const navalBonus=Math.min(.5,commanders.filter(c=>c.trait==='Адмірал').reduce((n,c)=>n+Math.min(.15,c.level*.015),0));
  const navalPower=Math.floor(ships.reduce((n,ship)=>n+Number(ship.amount||0)*(ship.ship_key==='transport'?1:5),0)*(1+navalBonus));
  const legacyField=armyTotals(db,id)?.field||{};const rawPower=Object.entries(UNIT_POWER).reduce((n,[k,p])=>n+Number(legacyField[k]||0)*p,0);
  const extraPower=units.reduce((n,u)=>n+u.amount*u.power*(1+(u.level-1)*.15),0)+mercenaries.reduce((n,u)=>n+u.amount*(ADV_UNITS[u.unit_key]?.power||1),0);
  const formation=FORMATIONS[state.formation]||FORMATIONS.balanced;
  const effectivePower=Math.floor((rawPower+extraPower)*(1+techBonus+commanderBonus)*(state.morale/100)*(1-state.fatigue/200)*formation.attack);
  return {units,unitCatalog:ADV_UNITS,technologies:ADV_TECHS,researched:technologies,commanders:commandersWithBonuses,ships,shipCatalog:SHIPS,mercenaries,prisoners,state,formationCatalog:FORMATIONS,legacyCount,advancedCount,mercCount,totalCount:legacyCount+advancedCount+mercCount,rawPower,extraPower,effectivePower,techBonus,commanderBonus,navalBonus,navalPower,rankName:['Зброєносець','Вояк','Сержант','Капітан','Маршал','Великий маршал'][Math.min(5,state.rank_level-1)]};
 }
 app.get('/api/army/advanced',(req,res)=>{try{const id=getUserId(req);if(!db.prepare('SELECT 1 FROM players WHERE telegram_id=?').get(id))return res.status(400).json({error:'Немає королівства'});tickArmyUpkeep(db,id);res.json(advancedArmy(id));}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/army/advanced/action',(req,res)=>{try{
  const id=getUserId(req),action=String(req.body.action||''),key=String(req.body.key||''),p=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);if(!p)return res.status(400).json({error:'Немає королівства'});ensureArmyState(id);
  const state=db.prepare('SELECT * FROM army_state WHERE telegram_id=?').get(id);const now=Math.floor(Date.now()/1000);
  const pay=(cost)=>{const cur=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id);if(Number(cur.gold||0)<cost)throw Error(`Потрібно ${cost} золота.`);db.prepare('UPDATE players SET gold=gold-? WHERE telegram_id=?').run(cost,id)};
  if(action==='recruit'){
   const u=ADV_UNITS[key],amount=Math.max(1,Math.min(100,Math.floor(Number(req.body.amount)||1)));if(!u)throw Error('Невідомий тип війська.');pay(u.cost*amount);db.prepare('INSERT INTO army_units(telegram_id,unit_key,amount) VALUES(?,?,?) ON CONFLICT(telegram_id,unit_key) DO UPDATE SET amount=amount+excluded.amount').run(id,key,amount);
  }else if(action==='upgrade'){
   const u=ADV_UNITS[key],row=db.prepare('SELECT * FROM army_units WHERE telegram_id=? AND unit_key=?').get(id,key);if(!u||!row||row.amount<1)throw Error('Спочатку найми цей тип війська.');if(row.level>=5)throw Error('Досягнуто максимального рівня 5.');pay(u.cost*(row.level+1)*2);db.prepare('UPDATE army_units SET level=level+1,xp=xp+25 WHERE telegram_id=? AND unit_key=?').run(id,key);
  }else if(action==='technology'){
   const t=ADV_TECHS[key];if(!t)throw Error('Невідома технологія.');const row=db.prepare('SELECT level FROM army_technologies WHERE telegram_id=? AND tech_key=?').get(id,key),level=Number(row?.level||0);if(level>=5)throw Error('Технологію вже розвинено до рівня 5.');pay(t.cost*(level+1));db.prepare('INSERT INTO army_technologies(telegram_id,tech_key,level) VALUES(?,?,1) ON CONFLICT(telegram_id,tech_key) DO UPDATE SET level=level+1').run(id,key);
  }else if(action==='formation'){
   if(!FORMATIONS[key])throw Error('Невідома формація.');db.prepare('UPDATE army_state SET formation=? WHERE telegram_id=?').run(key,id);
  }else if(action==='commander'){
   const count=db.prepare('SELECT COUNT(*) n FROM army_commanders WHERE telegram_id=?').get(id).n;if(count>=3)throw Error('Можна мати максимум 3 командирів.');pay(350+count*250);const names=['Роланд','Едмунд','Альдрік','Матильда','Бернард','Ізольда','Годфрід'];const name=names[(id+count+now)%names.length];const traits=['Тактик','Захисник','Полководець','Розвідник','Піхотинець','Лучник','Кавалерист','Облоговий майстер','Адмірал'];db.prepare('INSERT INTO army_commanders(telegram_id,name,trait) VALUES(?,?,?)').run(id,name,traits[(now+count)%traits.length]);
  }else if(action==='commander_train'){
   const cid=Math.floor(Number(req.body.id));const c=db.prepare('SELECT * FROM army_commanders WHERE id=? AND telegram_id=?').get(cid,id);if(!c)throw Error('Командира не знайдено.');if(c.level>=10)throw Error('Максимальний рівень командира — 10.');pay(c.level*180);db.prepare('UPDATE army_commanders SET level=level+1,xp=xp+100 WHERE id=?').run(cid);
  }else if(action==='mercenary'){
   const u=ADV_UNITS[key],amount=Math.max(1,Math.min(20,Math.floor(Number(req.body.amount)||1)));if(!u)throw Error('Невідомий загін найманців.');pay(u.cost*amount*2);db.prepare('INSERT INTO army_mercenaries(telegram_id,unit_key,amount,expires_at) VALUES(?,?,?,?) ON CONFLICT(telegram_id,unit_key) DO UPDATE SET amount=amount+excluded.amount,expires_at=MAX(expires_at,excluded.expires_at)').run(id,key,amount,now+86400);
  }else if(action==='ship'){
   const ship=SHIPS[key],amount=Math.max(1,Math.min(10,Math.floor(Number(req.body.amount)||1)));if(!ship)throw Error('Невідомий корабель.');pay(ship.cost*amount);db.prepare('INSERT INTO army_navy(telegram_id,ship_key,amount) VALUES(?,?,?) ON CONFLICT(telegram_id,ship_key) DO UPDATE SET amount=amount+excluded.amount').run(id,key,amount);
  }else if(action==='rest'){
   db.prepare('UPDATE army_state SET morale=MIN(100,morale+25),fatigue=MAX(0,fatigue-35) WHERE telegram_id=?').run(id);
  }else if(action==='expedition'||action==='siege'){
   const a=advancedArmy(id);if(a.totalCount<5)throw Error('Потрібно щонайменше 5 воїнів для походу.');if(state.fatigue>=95)throw Error('Військо надто втомлене. Дай йому відпочити.');
   const siege=action==='siege';if(siege&&!(a.units.some(u=>['trebuchets','battering_rams'].includes(u.unit_key)&&u.amount>0)))throw Error('Для облоги потрібні тарани або требушети.');
   const enemy=Math.max(10,Math.floor(a.effectivePower*(siege?(.8+((now%31)/100)):(.55+((now%55)/100)))));const own=Math.max(1,a.effectivePower);const win=own>=enemy;const ratio=Math.min(1,enemy/own);let loss=Math.max(1,Math.floor(a.totalCount*(win?.04:.16)*ratio));loss=Math.min(loss,a.totalCount);
   // Apply losses first to temporary mercenaries, then advanced units, then legacy field army.
   let remaining=loss;for(const m of db.prepare('SELECT * FROM army_mercenaries WHERE telegram_id=? ORDER BY expires_at').all(id)){if(remaining<=0)break;const take=Math.min(remaining,m.amount);db.prepare('UPDATE army_mercenaries SET amount=amount-? WHERE telegram_id=? AND unit_key=?').run(take,id,m.unit_key);remaining-=take;}
   for(const u of db.prepare('SELECT * FROM army_units WHERE telegram_id=? ORDER BY unit_key').all(id)){if(remaining<=0)break;const take=Math.min(remaining,u.amount);db.prepare('UPDATE army_units SET amount=amount-? WHERE telegram_id=? AND unit_key=?').run(take,id,u.unit_key);remaining-=take;}
   for(const k of ['swordsmen','archers','shieldmen','cavalry','knights']){if(remaining<=0)break;const n=Number(db.prepare(`SELECT ${k} n FROM players WHERE telegram_id=?`).get(id).n||0),take=Math.min(remaining,n);if(take){db.prepare(`UPDATE players SET ${k}=${k}-? WHERE telegram_id=?`).run(take,id);remaining-=take;}}
   const loot=win?Math.floor(80+a.totalCount*7+(siege?250:0)):Math.floor(a.totalCount*2);if(loot)db.prepare('UPDATE players SET gold=gold+? WHERE telegram_id=?').run(loot,id);
   const captured=win?Math.max(0,Math.floor(a.totalCount*(siege?.08:.04))):0;if(captured)db.prepare('UPDATE army_prisoners SET amount=amount+? WHERE telegram_id=?').run(captured,id);
   const xp=win?100:35;const morale=Math.max(10,Math.min(100,state.morale+(win?8:-18)));const fatigue=Math.min(100,state.fatigue+(siege?35:22));const rankXp=state.rank_xp+xp;const rankLevel=Math.min(6,1+Math.floor(rankXp/250));
   db.prepare('UPDATE army_state SET morale=?,fatigue=?,rank_xp=?,rank_level=?,last_battle=? WHERE telegram_id=?').run(morale,fatigue,rankXp,rankLevel,`${siege?'Облога':'Похід'}: ${win?'перемога':'відступ'}, здобич ${loot} золота`,id);
   db.prepare('UPDATE players SET xp=xp+? WHERE telegram_id=?').run(Math.floor(xp/5),id);
  }else if(action==='ransom'){
   const prisoners=Number(db.prepare('SELECT amount FROM army_prisoners WHERE telegram_id=?').get(id)?.amount||0);if(prisoners<1)throw Error('Полонених немає.');const ransom=prisoners*35;db.prepare('UPDATE army_prisoners SET amount=0 WHERE telegram_id=?').run(id);db.prepare('UPDATE players SET gold=gold+? WHERE telegram_id=?').run(ransom,id);
  }else throw Error('Невідома військова дія.');
  res.json({ok:true,army:advancedArmy(id)});
 }catch(e){res.status(400).json({error:e.message})}});
 app.get('/api/army/pvp',(req,res)=>{try{const id=getUserId(req);const players=db.prepare('SELECT telegram_id,kingdom_name,ruler_name,military_power FROM players WHERE telegram_id<>? ORDER BY military_power DESC LIMIT 30').all(id);const battles=db.prepare(`SELECT b.*,p.kingdom_name AS challenger_name,q.kingdom_name AS defender_name FROM army_pvp_battles b JOIN players p ON p.telegram_id=b.challenger_id JOIN players q ON q.telegram_id=b.defender_id WHERE (b.challenger_id=? OR b.defender_id=?) AND b.status IN ('pending','finished','declined') ORDER BY b.id DESC LIMIT 20`).all(id,id);res.json({players,battles:battles.map(b=>({...b,incoming:Number(b.defender_id)===Number(id),mine:Number(b.challenger_id)===Number(id)}))});}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/army/pvp/challenge',(req,res)=>{try{const id=getUserId(req),opponent=Number(req.body.opponentId);if(!Number.isSafeInteger(opponent)||opponent===Number(id))throw Error('Обери інше королівство.');if(!db.prepare('SELECT 1 FROM players WHERE telegram_id=?').get(opponent))throw Error('Королівство суперника не знайдено.');const pending=db.prepare(`SELECT id FROM army_pvp_battles WHERE status='pending' AND ((challenger_id=? AND defender_id=?) OR (challenger_id=? AND defender_id=?))`).get(id,opponent,opponent,id);if(pending)throw Error('Між цими королівствами вже є активний виклик.');const own=advancedArmy(id);if(own.totalCount<5)throw Error('Для виклику потрібно щонайменше 5 воїнів у польовій армії.');const info=db.prepare(`INSERT INTO army_pvp_battles(challenger_id,defender_id,status) VALUES(?,?,'pending')`).run(id,opponent);res.json({ok:true,battleId:Number(info.lastInsertRowid)});}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/army/pvp/respond',(req,res)=>{try{const id=getUserId(req),battleId=Math.floor(Number(req.body.battleId)),accept=!!req.body.accept;const battle=db.prepare(`SELECT * FROM army_pvp_battles WHERE id=? AND defender_id=? AND status='pending'`).get(battleId,id);if(!battle)throw Error('Виклик не знайдено або він уже неактивний.');if(!accept){db.prepare(`UPDATE army_pvp_battles SET status='declined',result='Виклик відхилено',completed_at=? WHERE id=?`).run(Math.floor(Date.now()/1000),battleId);return res.json({ok:true,result:'Виклик відхилено.'});}const a=advancedArmy(battle.challenger_id),b=advancedArmy(battle.defender_id);if(a.totalCount<1||b.totalCount<1)throw Error('Для битви обом королівствам потрібні війська.');const powerA=Math.max(1,a.effectivePower),powerB=Math.max(1,b.effectivePower);const scoreA=powerA*(0.9+Math.random()*0.2),scoreB=powerB*(0.9+Math.random()*0.2),winner=scoreA>=scoreB?Number(battle.challenger_id):Number(battle.defender_id);const applyLoss=(owner,army,win)=>{let loss=Math.min(army.totalCount,Math.max(1,Math.floor(army.totalCount*(win?.06:.14))));let left=loss;for(const m of db.prepare('SELECT * FROM army_mercenaries WHERE telegram_id=? ORDER BY expires_at').all(owner)){if(left<=0)break;const take=Math.min(left,m.amount);db.prepare('UPDATE army_mercenaries SET amount=amount-? WHERE telegram_id=? AND unit_key=?').run(take,owner,m.unit_key);left-=take;}for(const u of db.prepare('SELECT * FROM army_units WHERE telegram_id=? ORDER BY unit_key').all(owner)){if(left<=0)break;const take=Math.min(left,u.amount);db.prepare('UPDATE army_units SET amount=amount-? WHERE telegram_id=? AND unit_key=?').run(take,owner,u.unit_key);left-=take;}for(const k of UNIT_KEYS){if(left<=0)break;const n=Number(db.prepare(`SELECT ${k} n FROM players WHERE telegram_id=?`).get(owner)?.n||0),take=Math.min(left,n);if(take){db.prepare(`UPDATE players SET ${k}=${k}-? WHERE telegram_id=?`).run(take,owner);left-=take;}}const state=db.prepare('SELECT * FROM army_state WHERE telegram_id=?').get(owner)||{morale:100,fatigue:0,rank_xp:0,rank_level:1};const xp=win?120:60,rankXp=state.rank_xp+xp;db.prepare(`INSERT OR IGNORE INTO army_state(telegram_id) VALUES(?)`).run(owner);db.prepare('UPDATE army_state SET morale=?,fatigue=?,rank_xp=?,rank_level=?,last_battle=? WHERE telegram_id=?').run(Math.max(10,Math.min(100,state.morale+(win?8:-15))),Math.min(100,state.fatigue+25),rankXp,Math.min(6,1+Math.floor(rankXp/250)),`PvP-битва #${battleId}: ${win?'перемога':'поразка'}, втрати ${loss}`,owner);db.prepare('UPDATE players SET xp=xp+? WHERE telegram_id=?').run(Math.floor(xp/5),owner);return loss;};const winA=winner===Number(battle.challenger_id);const lossA=applyLoss(battle.challenger_id,a,winA),lossB=applyLoss(battle.defender_id,b,!winA);const result=`Переможець: ${winA?'викликач':'захисник'}. Сила сторін: ${powerA} проти ${powerB}. Втрати: ${lossA} та ${lossB}.`;db.prepare(`UPDATE army_pvp_battles SET status='finished',result=?,completed_at=? WHERE id=?`).run(result,Math.floor(Date.now()/1000),battleId);res.json({ok:true,result,winner,lossA,lossB});}catch(e){res.status(400).json({error:e.message})}});
}
module.exports={initSettlements,installSettlementRoutes,listSettlements,tickSettlements};
