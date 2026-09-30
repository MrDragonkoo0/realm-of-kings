'use strict';
const { BUILDING_CATALOG } = require('./catalog');
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
  level INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'built', finish_at INTEGER,
  UNIQUE(settlement_id,building_key), FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
 );
 CREATE TABLE IF NOT EXISTS settlement_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, settlement_id INTEGER NOT NULL, event TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
 );`);
 const columns=db.prepare('PRAGMA table_info(settlements)').all().map(x=>x.name);
 if(!columns.includes('last_growth_at')) db.exec("ALTER TABLE settlements ADD COLUMN last_growth_at INTEGER NOT NULL DEFAULT 0");
 const players=db.prepare('SELECT telegram_id,kingdom_name,population,gold,wood,stone FROM players').all();
 const add=db.prepare('INSERT INTO settlements(telegram_id,name,type,is_capital,population,housing,gold) VALUES(?,?,\'city\',1,?,?,?)');
 for(const p of players){
  let capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);
  if(!capital){add.run(p.telegram_id,(p.kingdom_name||'Столиця')+' — столиця',Math.max(20,p.population||20),Math.max(200,(p.population||20)+180),p.gold||0);capital=db.prepare('SELECT id FROM settlements WHERE telegram_id=? AND is_capital=1').get(p.telegram_id);
   for(const [key,val] of [['wood',p.wood||0],['stone',p.stone||0]]) db.prepare('INSERT OR IGNORE INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)').run(capital.id,key,val);
   for(const key of ['logging_camp','stone_quarry']) db.prepare('INSERT OR IGNORE INTO settlement_buildings(settlement_id,building_key,level,status) VALUES(?,?,1,\'built\')').run(capital.id,key);
  }
 }
}
function ownerSettlement(db, id, sid){return db.prepare('SELECT * FROM settlements WHERE id=? AND telegram_id=?').get(sid,id)}
function tickSettlements(db, now=Math.floor(Date.now()/1000)){
 const due=db.prepare('SELECT * FROM settlements WHERE last_growth_at<=?').all(now-21600);
 for(const s of due){const housed=s.population<s.housing;const fed=s.food>0;if(housed&&fed)db.prepare('UPDATE settlements SET population=population+1,food=food-1,last_growth_at=? WHERE id=?').run(now,s.id);else db.prepare('UPDATE settlements SET last_growth_at=? WHERE id=?').run(now,s.id);}
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
 app.post('/api/settlements',(req,res)=>{try{const id=getUserId(req),name=String(req.body.name||'').trim();if(!name||name.length>40)return res.status(400).json({error:'Назва поселення: 1–40 символів'});const p=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id);if(!p)return res.status(400).json({error:'Спочатку створи королівство'});if(p.gold<100)return res.status(400).json({error:'Для заснування села потрібно 100 золота'});const n=db.prepare('SELECT COUNT(*) n FROM settlements WHERE telegram_id=?').get(id).n;if(n>=26)return res.status(400).json({error:'Досягнуто ліміту у 25 поселень плюс столиця'});const info=db.prepare("INSERT INTO settlements(telegram_id,name,type,population,housing,food,gold) VALUES(?,?,'village',100,200,100,0)").run(id,name);db.prepare('UPDATE players SET gold=gold-100,xp=xp+5 WHERE telegram_id=?').run(id);const sid=Number(info.lastInsertRowid);for(const key of ['logging_camp','stone_quarry'])db.prepare("INSERT INTO settlement_buildings(settlement_id,building_key,level,status) VALUES(?,?,1,'built')").run(sid,key);db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'founded','Засновано нове село');res.json({settlement:ownerSettlement(db,id,sid),...listSettlements(db,id)});}catch(e){res.status(400).json({error:e.message})}});
 app.get('/api/settlements/:sid',(req,res)=>{try{tickSettlements(db);const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid);if(!s)return res.status(404).json({error:'Поселення не знайдено'});const buildings=db.prepare('SELECT id,building_key,level,status,finish_at FROM settlement_buildings WHERE settlement_id=? ORDER BY id').all(sid).map(b=>({...b,...(BUILDING_CATALOG.find(c=>c.key===b.building_key)||{})}));const resources=Object.fromEntries(db.prepare('SELECT resource_key,amount FROM settlement_resources WHERE settlement_id=?').all(sid).map(x=>[x.resource_key,x.amount]));res.json({...s,resources,buildings,defensePower:s.defense_level*100+(buildings.filter(b=>['wooden_palisade','stone_wall','reinforced_wall','main_gate','iron_gate','watchtower','archer_tower','bastion'].includes(b.building_key)).reduce((n,b)=>n+b.level*50,0))});}catch(e){res.status(400).json({error:e.message})}});
 app.get('/api/settlements/catalog/buildings',(req,res)=>res.json({catalog:BUILDING_CATALOG}));
 app.post('/api/settlements/:sid/build',(req,res)=>{try{const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid),key=String(req.body.key||''),b=BUILDING_CATALOG.find(x=>x.key===key);if(!s||!b)return res.status(400).json({error:'Поселення або будівлю не знайдено'});if(db.prepare('SELECT id FROM settlement_buildings WHERE settlement_id=? AND building_key=?').get(sid,key))return res.status(400).json({error:'Ця будівля вже є. Використай покращення.'});const p=db.prepare('SELECT gold,wood,stone FROM players WHERE telegram_id=?').get(id);if(!p||p.gold<b.baseCost.gold||(p.wood||0)<b.baseCost.wood||(p.stone||0)<b.baseCost.stone)return res.status(400).json({error:'Потрібно 35 золота, 25 деревини та 20 каменю'});db.prepare('UPDATE players SET gold=gold-35,wood=wood-25,stone=stone-20 WHERE telegram_id=?').run(id);db.prepare("INSERT INTO settlement_buildings(settlement_id,building_key,level,status) VALUES(?,?,1,'built')").run(sid,key);db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'building',`Збудовано: ${b.name}`);res.json({ok:true,settlementId:sid});}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/settlements/:sid/upgrade',(req,res)=>{try{const id=getUserId(req),sid=Number(req.params.sid),s=ownerSettlement(db,id,sid),key=String(req.body.key||'');if(!s)return res.status(404).json({error:'Поселення не знайдено'});const b=db.prepare('SELECT * FROM settlement_buildings WHERE settlement_id=? AND building_key=?').get(sid,key);if(!b)return res.status(400).json({error:'Спочатку збудуй цю будівлю'});const cost=35*b.level,p=db.prepare('SELECT gold FROM players WHERE telegram_id=?').get(id);if(!p||p.gold<cost)return res.status(400).json({error:`Потрібно ${cost} золота`});db.prepare('UPDATE players SET gold=gold-? WHERE telegram_id=?').run(cost,id);db.prepare('UPDATE settlement_buildings SET level=level+1 WHERE id=?').run(b.id);db.prepare('INSERT INTO settlement_history(settlement_id,event,details) VALUES(?,?,?)').run(sid,'upgrade',`Покращено ${key} до рівня ${b.level+1}`);res.json({ok:true,level:b.level+1});}catch(e){res.status(400).json({error:e.message})}});
}
module.exports={initSettlements,installSettlementRoutes,listSettlements,tickSettlements};
