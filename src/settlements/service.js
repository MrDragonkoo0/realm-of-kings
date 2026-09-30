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
 initProductionSchema(db);
 const players=db.prepare('SELECT telegram_id,kingdom_name,population,gold,wood,stone,iron FROM players').all();
 const add=db.prepare('INSERT INTO settlements(telegram_id,name,type,is_capital,population,housing,gold) VALUES(?,?,\'city\',1,?,?,?)');
 for(const p of players){
  let capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);
  if(!capital){add.run(p.telegram_id,(p.kingdom_name||'Столиця')+' — столиця',Math.max(20,p.population||20),Math.max(200,(p.population||20)+180),p.gold||0);capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);
   for(const [key,val] of [['wood',p.wood||0],['stone',p.stone||0],['iron',p.iron||0]]) db.prepare('INSERT OR IGNORE INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(capital.id,key,val);
   db.prepare('UPDATE players SET wood=0,stone=0,iron=0 WHERE telegram_id=?').run(p.telegram_id);
   for(const key of ['logging_camp','stone_quarry']) db.prepare('INSERT OR IGNORE INTO settlement_buildings(settlement_id,building_key,level,status) VALUES(?,?,1,\'built\')').run(capital.id,key);
  }
 }
 // Move legacy kingdom materials into each capital exactly once, then keep the old global fields empty.
 for(const p of db.prepare('SELECT telegram_id,wood,stone,iron FROM players').all()){const c=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);if(!c)continue;for(const r of ['wood','stone','iron']){const exists=db.prepare('SELECT 1 ok FROM settlement_resources WHERE settlement_id=? AND resource_key=?').get(c.id,r);if(!exists)db.prepare('INSERT INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(c.id,r,Math.max(0,p[r]||0));}db.prepare('UPDATE players SET wood=0,stone=0,iron=0 WHERE telegram_id=?').run(p.telegram_id);}
 // Keep the legacy food field and each settlement's inventory in sync on migration.
 for(const s of db.prepare('SELECT id,food FROM settlements').all()) db.prepare('INSERT OR IGNORE INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(s.id,'food',Math.max(0,s.food||0));
}
function ownerSettlement(db, id, sid){return db.prepare('SELECT * FROM settlements WHERE id=? AND telegram_id=?').get(sid,id)}
function tickSettlements(db, now=Math.floor(Date.now()/1000)){
 tickProduction(db,now);
 // Finish timed construction and upgrades when the player returns or opens settlements.
 const finished=db.prepare("SELECT * FROM settlement_buildings WHERE status IN ('building','upgrading') AND finish_at IS NOT NULL AND finish_at<=?").all(now);
 for(const b of finished){if(b.status==='upgrading') db.prepare("UPDATE settlement_buildings SET level=COALESCE(target_level,level+1),target_level=NULL,status='built',finish_at=NULL WHERE id=?").run(b.id); else db.prepare("UPDATE settlement_buildings SET status='built',finish_at=NULL WHERE id=?").run(b.id);}
 const due=db.prepare('SELECT * FROM settlements WHERE last_growth_at<=?').all(now-21600);
 for(const s of due){const housed=s.population<s.housing;const fed=foodStock(db,s.id)>0;if(housed&&fed){db.prepare('UPDATE settlements SET population=population+1,last_growth_at=? WHERE id=?').run(now,s.id);}else db.prepare('UPDATE settlements SET last_growth_at=? WHERE id=?').run(now,s.id);}
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
 app.post('/api/settlements',(req,res)=>{try{const id=getUserId(req),name=String(req.body.name||'').trim();if(!name||name.length>40)return res.status(400).json({error:'Назва поселення: 1–40 символів'});const p=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id);if(!p)return res.status(400).json({error:'Спочатку створи королівство'});if(p.gold<500)return res.status(400).json({error:'Для заснування села потрібно 500 золота'});const n=db.prepare('SELECT COUNT(*) n FROM settlements WHERE telegram_id=?').get(id).n;if(n>=26)return res.status(400).json({error:'Досягнуто ліміту у 25 поселень плюс столиця'});const info=db.prepare("INSERT INTO settlements(telegram_id,name,type,population,housing,food,gold) VALUES(?,?,'village',100,200,100,0)").run(id,name);db.prepare('UPDATE players SET gold=gold-500,xp=xp+5 WHERE telegram_id=?').run(id);const sid=Number(info.lastInsertRowid);db.prepare('UPDATE settlements SET last_production_at=? WHERE id=?').run(Math.floor(Date.now()/1000),sid);db.prepare('INSERT OR IGNORE INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(sid,'food',100);const capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(id);if(capital){for(const [r,amount] of [['wood',20],['stone',10]]){const have=db.prepare('SELECT amount FROM settlement_resources WHERE settlement_id=? AND resource_key=?').get(capital.id,r)?.amount||0;const moved=Math.min(have,amount);if(moved){db.prepare('UPDATE settlement_resources SET amount=amount-? WHERE settlement_id=? AND resource_key=?').run(moved,capital.id,r);db.prepare('INSERT INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?) ON CONFLICT(settlement_id,resource_key) DO UPDATE SET amount=amount+excluded.amount').run(sid,r,moved);}}}for(const key of ['logging_camp','stone_quarry'])db.prepare("INSERT INTO settlement_buildings(settlement_id,building_key,level,status) VALUES(?,?,1,'built')").run(sid,key);db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'founded','Засновано нове село');res.json({settlement:ownerSettlement(db,id,sid),...listSettlements(db,id)});}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/settlements/:sid/production-priority',(req,res)=>{try{const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid),key=String(req.body.key||''),priority=String(req.body.priority||'');if(!s)return res.status(404).json({error:'Поселення не знайдено'});if(!BUILDING_CATALOG.some(b=>b.key===key)||!OUTPUTS[key])return res.status(400).json({error:'Ця будівля не виробляє ресурси'});if(!['high','medium','low'].includes(priority))return res.status(400).json({error:'Невірний пріоритет'});db.prepare(`INSERT INTO settlement_production_preferences(settlement_id,building_key,priority,updated_at) VALUES(?,?,?,?) ON CONFLICT(settlement_id,building_key) DO UPDATE SET priority=excluded.priority,updated_at=excluded.updated_at`).run(sid,key,priority,Math.floor(Date.now()/1000));db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'production_priority',`Пріоритет виробництва «${key}» змінено на «${priority}»`);res.json({ok:true,settlementId:sid,key,priority});}catch(e){res.status(400).json({error:e.message})}});
 app.get('/api/settlements/catalog/buildings',(req,res)=>res.json({catalog:BUILDING_CATALOG}));
 app.get('/api/settlements/:sid',(req,res)=>{try{tickSettlements(db);const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid);if(!s)return res.status(404).json({error:'Поселення не знайдено'});const priorityRows=db.prepare('SELECT building_key,priority FROM settlement_production_preferences WHERE settlement_id=?').all(sid);const priorityMap=Object.fromEntries(priorityRows.map(x=>[x.building_key,x.priority]));const buildings=db.prepare('SELECT id,building_key,level,target_level,status,finish_at FROM settlement_buildings WHERE settlement_id=? ORDER BY id').all(sid).map(b=>({...b,priority:priorityMap[b.building_key]||'medium',...(BUILDING_CATALOG.find(c=>c.key===b.building_key)||{})}));const resources=Object.fromEntries(db.prepare('SELECT resource_key,amount FROM settlement_resources WHERE settlement_id=?').all(sid).map(x=>[x.resource_key,x.amount]));const productionRates={};for(const b of buildings){if(b.status!=='built'||!OUTPUTS[b.building_key])continue;const mult=1+0.25*Math.max(0,b.level-1);for(const [r,n] of Object.entries(OUTPUTS[b.building_key]))productionRates[r]=(productionRates[r]||0)+n*mult;}res.json({...s,resources,resourceNames:RESOURCE_NAMES,productionRates,...foodMetrics(db,s),warehouseUsed:inventoryTotal(db,sid),warehouseCapacity:capacityFor(db,sid),buildings,defensePower:s.defense_level*100+(buildings.filter(b=>['wooden_palisade','stone_wall','reinforced_wall','main_gate','iron_gate','watchtower','archer_tower','bastion'].includes(b.building_key)).reduce((n,b)=>n+b.level*50,0))});}catch(e){res.status(400).json({error:e.message})}});
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
}
module.exports={initSettlements,installSettlementRoutes,listSettlements,tickSettlements};
