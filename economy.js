'use strict';
const RESOURCE_FIELDS = {
  wood:'wood', stone:'stone', iron:'iron', straw:'straw', brick:'brick', clay:'clay', sand:'sand',
  bread:'bread', meat:'meat', flour:'flour', carrot:'carrot', potato:'potato', water:'water', apples:'apples', milk:'milk', eggs:'eggs', wheat:'wheat',
  copper:'copper', coal:'coal', silver:'silver', gold_ore:'gold_ore', salt:'salt', gemstones:'gemstones', planks:'planks', glass:'glass', metal:'metal', copper_bars:'copper_bars', tools:'tools'
};
const BUILDINGS = {
 logging:{label:'🌲 Лісозаготівля',category:'Видобуток',resource:'wood',base:5,workers:2,max:15,free:true},
 wood_sawmill:{label:'🪚 Лісопильний двір',category:'Видобуток',resource:'wood',base:4,workers:2,max:12},
 quarry:{label:'⛰️ Каменоломня',category:'Видобуток',resource:'stone',base:3,workers:2,max:15,free:true},
 iron_mine:{label:'⛏️ Залізна шахта',category:'Видобуток',resource:'iron',base:2.5,workers:2,max:12},
 copper_mine:{label:'🟠 Мідна шахта',category:'Видобуток',resource:'copper',base:2,workers:2,max:10},
 coal_mine:{label:'⚫ Вугільна шахта',category:'Видобуток',resource:'coal',base:2.5,workers:2,max:10},
 clay_quarry:{label:'🧱 Глиняний кар’єр',category:'Видобуток',resource:'clay',base:2.5,workers:2,max:10},
 silver_mine:{label:'🥈 Срібна шахта',category:'Видобуток',resource:'silver',base:.5,workers:2,max:8},
 gold_mine:{label:'🪙 Золота шахта',category:'Видобуток',resource:'gold_ore',base:.5,workers:2,max:8},
 sand_quarry:{label:'🏖️ Піщаний кар’єр',category:'Видобуток',resource:'sand',base:2.5,workers:2,max:8},
 salt_mine:{label:'🧂 Соляна шахта',category:'Видобуток',resource:'salt',base:1.5,workers:2,max:8},
 gemstone_mine:{label:'💎 Рудник самоцвітів',category:'Видобуток',resource:'gemstones',base:.5,workers:2,max:6},
 grain_farm:{label:'🌾 Зернова ферма',category:'Їжа',resource:'wheat',base:2.5,workers:2,max:10,food:true},
 carrot_farm:{label:'🥕 Морквяна ферма',category:'Їжа',resource:'carrot',base:2,workers:2,max:10,food:true},
 potato_farm:{label:'🥔 Картопляна ферма',category:'Їжа',resource:'potato',base:2.5,workers:2,max:10,food:true},
 orchard:{label:'🍎 Сад',category:'Їжа',resource:'apples',base:1.5,workers:2,max:10,food:true},
 dairy:{label:'🥛 Молочна ферма',category:'Їжа',resource:'milk',base:2,workers:2,max:10,food:true},
 chicken_coop:{label:'🥚 Курник',category:'Їжа',resource:'eggs',base:2.5,workers:2,max:10,food:true},
 livestock:{label:'🥩 Тваринницька ферма',category:'Їжа',resource:'meat',base:1,workers:2,max:10,food:true},
 mill:{label:'⚙️ Млин',category:'Виробництво',input:{wheat:2},resource:'flour',base:2.5,workers:2,max:12},
 bakery:{label:'🍞 Пекарня',category:'Виробництво',input:{flour:2},resource:'bread',base:2.5,workers:2,max:12},
 plank_sawmill:{label:'🪚 Лісопилка',category:'Виробництво',input:{wood:2},resource:'planks',base:2.5,workers:2,max:12},
 smelter:{label:'🔥 Плавильня',category:'Виробництво',input:{iron:1,coal:1},resource:'metal',base:1,workers:2,max:12},
 copper_smelter:{label:'🟠 Мідеплавильня',category:'Виробництво',input:{copper:1,coal:1},resource:'copper_bars',base:1,workers:2,max:10},
 brickworks:{label:'🧱 Цегельня',category:'Виробництво',input:{clay:2},resource:'brick',base:2,workers:2,max:10},
 glassworks:{label:'🪟 Склярня',category:'Виробництво',input:{sand:2,coal:1},resource:'glass',base:1,workers:2,max:8},
 smithy:{label:'⚒️ Кузня',category:'Виробництво',input:{metal:1,wood:1},resource:'tools',base:.5,workers:2,max:12}
};
const FOOD = {wheat:.5,carrot:.8,potato:.8,apples:.7,milk:1,eggs:1,meat:2,bread:1.5};
function initEconomy(db) {
  const existing = new Set(db.prepare('PRAGMA table_info(players)').all().map(c=>c.name));
  for (const col of Object.keys(RESOURCE_FIELDS)) if (!existing.has(col)) db.exec(`ALTER TABLE players ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
  db.exec(`CREATE TABLE IF NOT EXISTS economy_state(telegram_id INTEGER PRIMARY KEY,last_tick INTEGER NOT NULL DEFAULT 0,wage_debt REAL NOT NULL DEFAULT 0,debt_hours INTEGER NOT NULL DEFAULT 0,food_penalty REAL NOT NULL DEFAULT 1,food_remainder REAL NOT NULL DEFAULT 0,population_growth_hours INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT 0);`);
  const stateCols=new Set(db.prepare('PRAGMA table_info(economy_state)').all().map(c=>c.name));if(!stateCols.has('debt_hours'))db.exec('ALTER TABLE economy_state ADD COLUMN debt_hours INTEGER NOT NULL DEFAULT 0');if(!stateCols.has('food_remainder'))db.exec('ALTER TABLE economy_state ADD COLUMN food_remainder REAL NOT NULL DEFAULT 0');if(!stateCols.has('population_growth_hours'))db.exec('ALTER TABLE economy_state ADD COLUMN population_growth_hours INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS economy_buildings(telegram_id INTEGER NOT NULL,building_key TEXT NOT NULL,level INTEGER NOT NULL DEFAULT 0,production_remainder REAL NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(telegram_id,building_key));`);
  const buildingCols=new Set(db.prepare('PRAGMA table_info(economy_buildings)').all().map(c=>c.name));if(!buildingCols.has('production_remainder'))db.exec('ALTER TABLE economy_buildings ADD COLUMN production_remainder REAL NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS economy_workers(telegram_id INTEGER NOT NULL,building_key TEXT NOT NULL,workers INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(telegram_id,building_key));`);
  db.exec(`CREATE TABLE IF NOT EXISTS economy_constructions(telegram_id INTEGER NOT NULL,building_key TEXT NOT NULL,ends_at INTEGER NOT NULL,cost_json TEXT NOT NULL,PRIMARY KEY(telegram_id,building_key));`);
  db.exec(`CREATE TABLE IF NOT EXISTS economy_upgrades(telegram_id INTEGER NOT NULL,building_key TEXT NOT NULL,target_level INTEGER NOT NULL,ends_at INTEGER NOT NULL,cost_json TEXT NOT NULL,PRIMARY KEY(telegram_id,building_key));`);
  db.exec(`CREATE TABLE IF NOT EXISTS economy_reserve(telegram_id INTEGER NOT NULL,resource_key TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(telegram_id,resource_key));`);
  db.exec(`CREATE TABLE IF NOT EXISTS economy_notification_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,telegram_id INTEGER NOT NULL,building_key TEXT NOT NULL,resource_key TEXT NOT NULL,event_type TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL,delivered INTEGER NOT NULL DEFAULT 0);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_economy_notify ON economy_notification_queue(delivered,created_at);`);
  return {db};
}
function player(db,id){return db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id)}
function warehouseCapacity(p){return Math.floor(1000*Math.pow(1.5,Math.max(0,(p.warehouse_level||1)-1)))}
function resourceTotal(p){return Object.keys(RESOURCE_FIELDS).reduce((n,k)=>n+Math.max(0,Number(p[k]||0)),0)}
function addEvent(db,id,key,resource,type,reason,now){
 db.prepare('INSERT INTO production_events(telegram_id,building_key,resource_key,event_type,reason,created_at) VALUES(?,?,?,?,?,?)').run(id,key,resource,type,reason,now);
 db.prepare('INSERT INTO economy_notification_queue(telegram_id,building_key,resource_key,event_type,reason,created_at) VALUES(?,?,?,?,?,?)').run(id,key,resource,type,reason,now);
}
function setPaused(db,id,key,resource,paused,reason,now){
 const row=db.prepare('SELECT is_paused FROM production_status WHERE telegram_id=? AND building_key=?').get(id,key);const was=!!row?.is_paused;if(was===paused)return;
 db.prepare(`INSERT INTO production_status(telegram_id,building_key,is_paused,updated_at) VALUES(?,?,?,?) ON CONFLICT(telegram_id,building_key) DO UPDATE SET is_paused=excluded.is_paused,updated_at=excluded.updated_at`).run(id,key,paused?1:0,now);
 addEvent(db,id,key,resource,paused?'stop':'resume',reason,now);
}
function ensureKingdom(db,p,now){
 if(!p)return;
 // Older registered kingdoms could have zero residents from the pre-economy schema; grant a playable starting population without resetting their other data.
 if(Number(p.population||0)<=0){db.prepare('UPDATE players SET population=20,houses=MAX(houses,2) WHERE telegram_id=?').run(p.telegram_id);p=player(db,p.telegram_id);}
 db.prepare('INSERT OR IGNORE INTO economy_state(telegram_id,last_tick,created_at) VALUES(?,?,?)').run(p.telegram_id,now,now);
 let priorityOrder=Date.now();
 for(const [key,b] of Object.entries(BUILDINGS)){
  db.prepare("INSERT OR IGNORE INTO production_preferences(telegram_id,building_key,priority,updated_at) VALUES(?,?,'medium',?)").run(p.telegram_id,key,priorityOrder++);
  const initial=key==='logging'||key==='quarry'?1:(key==='bakery'||key==='smithy'?Math.max(0,Number(p[key]||0)):0);
  db.prepare('INSERT OR IGNORE INTO economy_buildings(telegram_id,building_key,level,created_at) VALUES(?,?,?,?)').run(p.telegram_id,key,initial,now);
  db.prepare('INSERT OR IGNORE INTO economy_workers(telegram_id,building_key,workers) VALUES(?,?,0)').run(p.telegram_id,key);
 }
 // Import old assigned workers once into the new building workforce, without duplication.
 const mark=db.prepare("SELECT created_at FROM economy_state WHERE telegram_id=?").get(p.telegram_id);
 if(mark && mark.created_at===now){
   if(p.woodcutters>0)db.prepare('UPDATE economy_workers SET workers=MAX(workers,?) WHERE telegram_id=? AND building_key=?').run(p.woodcutters,p.telegram_id,'logging');
   if(p.miners>0)db.prepare('UPDATE economy_workers SET workers=MAX(workers,?) WHERE telegram_id=? AND building_key=?').run(p.miners,p.telegram_id,'quarry');
 }
}
function refreshWarehouseStatuses(db,id){
 let p=player(db,id);if(!p)return;const rank={high:0,medium:1,low:2},prefs=db.prepare('SELECT building_key,priority,updated_at FROM production_preferences WHERE telegram_id=?').all(id),pref=new Map(prefs.map(x=>[x.building_key,x]));
 const rows=db.prepare('SELECT building_key FROM production_status WHERE telegram_id=? AND is_paused=1').all(id).filter(r=>{const e=db.prepare('SELECT reason,event_type FROM production_events WHERE telegram_id=? AND building_key=? ORDER BY created_at DESC,id DESC LIMIT 1').get(id,r.building_key);return e?.event_type==='stop'&&e.reason==='Склад заповнений';});
 rows.sort((a,b)=>(rank[pref.get(a.building_key)?.priority||'medium']-rank[pref.get(b.building_key)?.priority||'medium'])||((pref.get(a.building_key)?.updated_at||0)-(pref.get(b.building_key)?.updated_at||0)));
 for(const row of rows){
  p=player(db,id);const cap=warehouseCapacity(p);let free=cap-resourceTotal(p);if(free<=0)break;
  const def=BUILDINGS[row.building_key],b=db.prepare('SELECT level,production_remainder FROM economy_buildings WHERE telegram_id=? AND building_key=?').get(id,row.building_key),w=db.prepare('SELECT workers FROM economy_workers WHERE telegram_id=? AND building_key=?').get(id,row.building_key),st=db.prepare('SELECT wage_debt,debt_hours,food_penalty FROM economy_state WHERE telegram_id=?').get(id);
  if(!def||!b||b.level<1||!w?.workers)continue;if((st?.wage_debt||0)>0&&(st?.debt_hours||0)>=48)continue;
  if(def.input&&Object.entries(def.input).some(([k,v])=>(p[k]||0)<Math.ceil(v*w.workers/def.workers)))continue;
  const debtFactor=(st?.wage_debt||0)>0&&(st?.debt_hours||0)>=12?.75:1,foodFactor=st?.food_penalty||1,levelFactor=1+Math.max(0,b.level-1)*.25,raw=def.base*w.workers*levelFactor*Math.min(debtFactor,foodFactor)+Number(b.production_remainder||0),out=Math.floor(raw),remainder=raw-out;
  db.prepare('UPDATE economy_buildings SET production_remainder=? WHERE telegram_id=? AND building_key=?').run(remainder,id,row.building_key);
  if(out<1){setPaused(db,id,row.building_key,def.resource||Object.keys(def.input||{})[0]||'resource',false,'На складі зʼявилося місце',Math.floor(Date.now()/1000));continue;}
  if(def.input){for(const [k,v] of Object.entries(def.input)){const req=Math.ceil(v*w.workers/def.workers);db.prepare(`UPDATE players SET ${k}=${k}-? WHERE telegram_id=?`).run(req,id);}}
  p=player(db,id);free=warehouseCapacity(p)-resourceTotal(p);if(free<=0)continue;
  const output=Math.min(out,free),resource=def.resource||Object.keys(def.input||{})[0]||'resource';db.prepare(`UPDATE players SET ${resource}=${resource}+? WHERE telegram_id=?`).run(output,id);
  setPaused(db,id,row.building_key,resource,false,'На складі зʼявилося місце',Math.floor(Date.now()/1000));
  p=player(db,id);if(resourceTotal(p)>=warehouseCapacity(p))setPaused(db,id,row.building_key,resource,true,'Склад заповнений',Math.floor(Date.now()/1000));
 }
}
function completeConstructions(db,id,at){const due=db.prepare('SELECT building_key FROM economy_constructions WHERE telegram_id=? AND ends_at<=?').all(id,at);for(const b of due){db.prepare('UPDATE economy_buildings SET level=1 WHERE telegram_id=? AND building_key=? AND level=0').run(id,b.building_key);db.prepare('DELETE FROM economy_constructions WHERE telegram_id=? AND building_key=?').run(id,b.building_key);}}
function completeUpgrades(db,id,at){const due=db.prepare('SELECT building_key,target_level FROM economy_upgrades WHERE telegram_id=? AND ends_at<=?').all(id,at);for(const u of due){db.prepare('UPDATE economy_buildings SET level=? WHERE telegram_id=? AND building_key=?').run(u.target_level,id,u.building_key);db.prepare('DELETE FROM economy_upgrades WHERE telegram_id=? AND building_key=?').run(id,u.building_key);}}
function settleEconomy(db, original){
 if(!original?.kingdom_name)return original;
 const now=Math.floor(Date.now()/1000);ensureKingdom(db,original,now);
 let p=player(db,original.telegram_id),st=db.prepare('SELECT * FROM economy_state WHERE telegram_id=?').get(p.telegram_id);
 // Upgrades are completed along the offline timeline, after the production hour in which they finish.
 let hours=Math.min(720,Math.floor(Math.max(0,now-(st.last_tick||now))/3600));
 if(hours<1){completeConstructions(db,p.telegram_id,now);completeUpgrades(db,p.telegram_id,now);updateFoodPenalty(db,p.telegram_id,now);flushReserve(db,p.telegram_id);refreshWarehouseStatuses(db,p.telegram_id);return player(db,p.telegram_id)}
 const first=(st.last_tick||now),start=first;let tickTime=start;
 for(let h=0;h<hours;h++){
  tickTime=start+(h+1)*3600; p=player(db,p.telegram_id); st=db.prepare('SELECT * FROM economy_state WHERE telegram_id=?').get(p.telegram_id);
  let wageDebt=Number(st.wage_debt||0);
  const assigned=db.prepare('SELECT building_key,workers FROM economy_workers WHERE telegram_id=?').all(p.telegram_id).filter(x=>x.workers>0);
  const workerCount=assigned.reduce((n,x)=>n+x.workers,0);
  const wages=workerCount;
  const dueWages=wageDebt+wages;
  const paid=Math.min(Math.max(0,p.gold||0),dueWages);
  if(paid>0)db.prepare('UPDATE players SET gold=gold-? WHERE telegram_id=?').run(paid,p.telegram_id);
  wageDebt=Math.max(0,dueWages-paid);
  const debtHours=wageDebt>0?Number(st.debt_hours||0)+1:0;
  db.prepare('UPDATE economy_state SET wage_debt=?,debt_hours=? WHERE telegram_id=?').run(wageDebt,debtHours,p.telegram_id);
  let productivity=debtHours>=48&&wageDebt>0?0:(debtHours>=12&&wageDebt>0?.75:1);
  const people=Math.max(0,p.population||0),foodNeed=people/100;
  // Preserve fractional consumption so small settlements do not lose a whole food unit every hour.
  const accumulatedNeed=foodNeed+Number(st.food_remainder||0),foodNeedWhole=Math.floor(accumulatedNeed);
  db.prepare('UPDATE economy_state SET food_remainder=? WHERE telegram_id=?').run(accumulatedNeed-foodNeedWhole,p.telegram_id);
  // Rotate food types so stock is consumed as a mix rather than exhausting one item first.
  let need=foodNeedWhole;const foodOrder=['bread','meat','milk','eggs','potato','carrot','wheat','apples'];const shift=Math.floor(tickTime/3600)%foodOrder.length;foodOrder.push(...foodOrder.splice(0,shift));
  for(const key of foodOrder){if(need<=0)break;const qty=Math.max(0,Number(p[key]||0));if(!qty)continue;const nutrition=FOOD[key]||1;const take=Math.min(qty,Math.ceil(need/nutrition));if(take>0){db.prepare(`UPDATE players SET ${key}=${key}-? WHERE telegram_id=?`).run(take,p.telegram_id);need=Math.max(0,need-take*nutrition);p[key]-=take;}}
  const foodFactor=updateFoodPenalty(db,p.telegram_id,tickTime);
  const cap=warehouseCapacity(p);let used=resourceTotal(p);
  const resourceProductionAllowed=h<24;
  const prefs=db.prepare('SELECT building_key,priority,updated_at FROM production_preferences WHERE telegram_id=?').all(p.telegram_id);const prefMap=new Map(prefs.map(x=>[x.building_key,x]));const rank={high:0,medium:1,low:2};
  const buildings=db.prepare('SELECT b.building_key,b.level,b.production_remainder,w.workers FROM economy_buildings b JOIN economy_workers w USING(telegram_id,building_key) WHERE b.telegram_id=?').all(p.telegram_id).filter(x=>x.level>0&&x.workers>0);
  buildings.sort((a,b)=>(rank[prefMap.get(a.building_key)?.priority||'medium']-rank[prefMap.get(b.building_key)?.priority||'medium'])||((prefMap.get(a.building_key)?.updated_at||0)-(prefMap.get(b.building_key)?.updated_at||0)));
  for(const job of buildings){const def=BUILDINGS[job.building_key];if(!def)continue;const resource=def.resource;const activeProductivity=Math.min(productivity,foodFactor);
    if(productivity===0){setPaused(db,p.telegram_id,job.building_key,resource,true,'Зарплатний борг понад 48 годин',tickTime);continue;}
    if(!resourceProductionAllowed)continue;
    if(def.input){let enough=true;for(const [k,v] of Object.entries(def.input)){const req=Math.ceil(v*job.workers/def.workers);if((p[k]||0)<req)enough=false;}if(!enough){setPaused(db,p.telegram_id,job.building_key,resource,true,'Недостатньо сировини або палива',tickTime);continue;}}
    const levelFactor=1+Math.max(0,job.level-1)*.25;const rawOut=def.base*job.workers*levelFactor*activeProductivity+Number(job.production_remainder||0);const out=Math.floor(rawOut);const remainder=rawOut-out;
    db.prepare('UPDATE economy_buildings SET production_remainder=? WHERE telegram_id=? AND building_key=?').run(remainder,p.telegram_id,job.building_key);
    if(out<1){if(used>=cap)setPaused(db,p.telegram_id,job.building_key,resource,true,'Склад заповнений',tickTime);else setPaused(db,p.telegram_id,job.building_key,resource,false,'Виробництво відновлено',tickTime);continue;}
    if(def.input){for(const [k,v] of Object.entries(def.input)){const req=Math.ceil(v*job.workers/def.workers);db.prepare(`UPDATE players SET ${k}=${k}-? WHERE telegram_id=?`).run(req,p.telegram_id);p[k]-=req;used-=req;}}
    if(used>=cap){setPaused(db,p.telegram_id,job.building_key,resource,true,'Склад заповнений',tickTime);continue;}
    setPaused(db,p.telegram_id,job.building_key,resource,false,'Виробництво відновлено',tickTime);
    const maxOut=Math.min(out,cap-used);
    if(maxOut>0){db.prepare(`UPDATE players SET ${resource}=${resource}+? WHERE telegram_id=?`).run(maxOut,p.telegram_id);p[resource]=(p[resource]||0)+maxOut;used+=maxOut;}
    if(used>=cap)setPaused(db,p.telegram_id,job.building_key,resource,true,'Склад заповнений',tickTime);
  }
  // Count only hours when both food and free housing are available.
  const latest=player(db,p.telegram_id),housingNow=Math.max(10,latest.houses*10+latest.townhall_level*20),growth=db.prepare('SELECT population_growth_hours FROM economy_state WHERE telegram_id=?').get(p.telegram_id).population_growth_hours||0;
  if(foodStock(latest)>0&&latest.population<housingNow){const g=growth+1;if(g>=6){db.prepare('UPDATE players SET population=MIN(?,population+?) WHERE telegram_id=?').run(housingNow,Math.floor(g/6),p.telegram_id);db.prepare('UPDATE economy_state SET population_growth_hours=? WHERE telegram_id=?').run(g%6,p.telegram_id);}else db.prepare('UPDATE economy_state SET population_growth_hours=? WHERE telegram_id=?').run(g,p.telegram_id);}
  flushReserve(db,p.telegram_id);
  refreshWarehouseStatuses(db,p.telegram_id);
  completeConstructions(db,p.telegram_id,tickTime);
  completeUpgrades(db,p.telegram_id,tickTime);
 }
 completeConstructions(db,p.telegram_id,now);completeUpgrades(db,p.telegram_id,now);
 const elapsedWhole=Math.floor(Math.max(0,now-first)/3600),newLast=elapsedWhole>720?now:first+hours*3600;
 db.prepare('UPDATE economy_state SET last_tick=? WHERE telegram_id=?').run(newLast,p.telegram_id);
 return player(db,p.telegram_id);
}
function foodStock(p){return Object.keys(FOOD).reduce((n,k)=>n+Math.max(0,Number(p[k]||0))*(FOOD[k]||1),0)}
function updateFoodPenalty(db,id,at=Math.floor(Date.now()/1000)){const p=player(db,id),st=db.prepare('SELECT food_penalty FROM economy_state WHERE telegram_id=?').get(id);if(!p||!st)return 1;const stock=foodStock(p),rate=Math.max(.01,Math.max(0,p.population||0)/100),hours=stock/rate,factor=(p.population>0&&stock<=0)?.5:(stock>0&&hours<12?.75:1);if(Number(st.food_penalty||1)!==factor){db.prepare('UPDATE economy_state SET food_penalty=? WHERE telegram_id=?').run(factor,id);const reason=factor===.5?'Запаси їжі вичерпано — продуктивність −50%':factor===.75?'Їжі менше ніж на 12 годин — продуктивність −25%':'Запаси їжі відновлено — штраф знято';db.prepare('INSERT INTO economy_notification_queue(telegram_id,building_key,resource_key,event_type,reason,created_at) VALUES(?,?,?,?,?,?)').run(id,'food_supply','food',factor<1?'stop':'resume',reason,at);}return factor;}
function flushReserve(db,id){const p=player(db,id);if(!p)return;let free=Math.max(0,warehouseCapacity(p)-resourceTotal(p));const rows=db.prepare('SELECT resource_key,amount FROM economy_reserve WHERE telegram_id=? AND amount>0 ORDER BY rowid').all(id);for(const r of rows){if(free<=0)break;const amount=Math.min(free,r.amount);db.prepare(`UPDATE players SET ${r.resource_key}=${r.resource_key}+? WHERE telegram_id=?`).run(amount,id);db.prepare('UPDATE economy_reserve SET amount=amount-? WHERE telegram_id=? AND resource_key=?').run(amount,id,r.resource_key);free-=amount;}}
function kyivDayKey(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return `${x.year}-${x.month}-${x.day}`;}
function getEconomyData(db,id){
 const p=player(db,id);if(!p)return null;
 const state=db.prepare('SELECT * FROM economy_state WHERE telegram_id=?').get(id)||{};
 const rank={high:0,medium:1,low:2};
 const buildings=db.prepare('SELECT b.building_key,b.level,b.created_at,w.workers,u.target_level,u.ends_at,c.ends_at AS construction_ends_at FROM economy_buildings b JOIN economy_workers w USING(telegram_id,building_key) LEFT JOIN economy_upgrades u USING(telegram_id,building_key) LEFT JOIN economy_constructions c USING(telegram_id,building_key) WHERE b.telegram_id=?').all(id).map(x=>{
  const def=BUILDINGS[x.building_key],pref=db.prepare('SELECT priority,updated_at FROM production_preferences WHERE telegram_id=? AND building_key=?').get(id,x.building_key),status=db.prepare('SELECT is_paused FROM production_status WHERE telegram_id=? AND building_key=?').get(id,x.building_key),last=db.prepare('SELECT reason,event_type FROM production_events WHERE telegram_id=? AND building_key=? ORDER BY created_at DESC,id DESC LIMIT 1').get(id,x.building_key);
  const upgradeRemaining=x.ends_at?Math.max(0,x.ends_at-Math.floor(Date.now()/1000)):0,constructionRemaining=x.construction_ends_at?Math.max(0,x.construction_ends_at-Math.floor(Date.now()/1000)):0;
  let statusText=constructionRemaining>0?'Будується':x.level===0?'Не збудовано':x.workers===0?'Немає працівників':status?.is_paused?(last?.reason||'Виробництво зупинено'): 'Працює';
  return {...def,...x,key:x.building_key,workers:x.workers,priority:pref?.priority||'medium',priorityUpdated:pref?.updated_at||0,isPaused:!!status?.is_paused,status:statusText,reason:status?.is_paused?(last?.reason||''): '',upgradeRemaining,constructionRemaining};
 }).sort((a,b)=>(rank[a.priority]-rank[b.priority])||(a.priorityUpdated-b.priorityUpdated)||a.created_at-b.created_at);
 const assigned=buildings.reduce((n,b)=>n+b.workers,0),foodTypes=['wheat','carrot','potato','apples','milk','eggs','meat'].filter(k=>(p[k]||0)>0).length;
 const foodHours=foodStock(p)/Math.max(.01,p.population/100),foodPercent=Math.min(100,Math.round(foodHours/24*100));
 const foodStatus=foodPercent<50?'Погане забезпечення':foodPercent<80?'Достатнє забезпечення':foodTypes>=5?'Збалансоване забезпечення':'Достатнє забезпечення';
 const used=resourceTotal(p),capacity=warehouseCapacity(p),exports=db.prepare('SELECT count FROM export_daily WHERE telegram_id=? AND day_key=?').get(id,kyivDayKey())?.count||0;
 return {population:p.population,populationCapacity:Math.max(10,p.houses*10+p.townhall_level*20),gold:p.gold,houses:p.houses,buildings,workers:{assigned,free:Math.max(0,p.population-assigned),perBuildingStartCap:10,perBuildingMaxCap:20},warehouse:{used,capacity,free:Math.max(0,capacity-used)},wages:{debt:state.wage_debt||0,debtHours:state.debt_hours||0},food:{stock:foodStock(p),hours:foodHours,types:foodTypes,percent:foodPercent,status:foodStatus,warning:foodHours<=0?'Їжі немає — продуктивність −50%, приріст населення зупинено.':foodHours<12?'Запас їжі менше ніж на 12 годин — продуктивність −25%.':foodHours<24?'Запасів їжі вистачить на 12–24 години — варто поповнити.':''},exportsRemaining:Math.max(0,10-exports),resources:Object.fromEntries(Object.keys(RESOURCE_FIELDS).map(k=>[k,p[k]||0]))};
}
function installEconomyRoutes({app,db,getUserId,currentPlayer}){
 app.get('/api/economy',(req,res)=>{try{const id=getUserId(req);currentPlayer(id);res.json(getEconomyData(db,id));}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/economy/assign',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),key=String(req.body.building||''),workers=Math.max(0,Math.trunc(Number(req.body.workers)||0)),def=BUILDINGS[key];if(!p||!def)return res.status(400).json({error:'Невідома будівля'});const row=db.prepare('SELECT level FROM economy_buildings WHERE telegram_id=? AND building_key=?').get(id,key);if(!row||row.level<1)return res.status(400).json({error:'Спочатку побудуй цю будівлю'});const assigned=db.prepare('SELECT COALESCE(SUM(workers),0) AS n FROM economy_workers WHERE telegram_id=? AND building_key<>?').get(id,key).n;if(assigned+workers>p.population)return res.status(400).json({error:'Недостатньо вільних жителів'});const cap=Math.min(20,10+Math.max(0,row.level-1)*2,p.population);if(workers>cap)return res.status(400).json({error:`Ліміт працівників цієї будівлі: ${cap}`});db.prepare('UPDATE economy_workers SET workers=? WHERE telegram_id=? AND building_key=?').run(workers,id,key);if(key==='logging')db.prepare('UPDATE players SET woodcutters=? WHERE telegram_id=?').run(workers,id);if(key==='quarry')db.prepare('UPDATE players SET miners=? WHERE telegram_id=?').run(workers,id);res.json(getEconomyData(db,id));}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/economy/build',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),key=String(req.body.building||''),def=BUILDINGS[key];if(!p||!def)return res.status(400).json({error:'Невідома будівля'});const row=db.prepare('SELECT level FROM economy_buildings WHERE telegram_id=? AND building_key=?').get(id,key);if(row.level>0)return res.status(400).json({error:'Будівлю вже збудовано; використай покращення'});if(db.prepare('SELECT 1 FROM economy_constructions WHERE telegram_id=? AND building_key=?').get(id,key))return res.status(400).json({error:'Ця будівля вже будується'});const cost=def.category==='Їжа'?{wood:20,stone:10}:def.category==='Виробництво'?{wood:35,stone:25}:{wood:25,stone:20};if(key==='logging'||key==='quarry')return res.status(400).json({error:'Це стартова безкоштовна будівля'});for(const [k,v] of Object.entries(cost))if((p[k]||0)<v)return res.status(400).json({error:`Недостатньо ресурсу: ${k}`});for(const [k,v] of Object.entries(cost))db.prepare(`UPDATE players SET ${k}=${k}-? WHERE telegram_id=?`).run(v,id);const seconds=def.category==='Виробництво'?1800:900;db.prepare('INSERT INTO economy_constructions(telegram_id,building_key,ends_at,cost_json) VALUES(?,?,?,?)').run(id,key,Math.floor(Date.now()/1000)+seconds,JSON.stringify(cost));flushReserve(db,id);refreshWarehouseStatuses(db,id);res.json(getEconomyData(db,id));}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/economy/upgrade',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),key=String(req.body.building||''),def=BUILDINGS[key],row=db.prepare('SELECT level FROM economy_buildings WHERE telegram_id=? AND building_key=?').get(id,key);if(!p||!def||!row||row.level<1)return res.status(400).json({error:'Будівлю не знайдено'});if(row.level>=def.max)return res.status(400).json({error:'Досягнуто максимального рівня'});if(db.prepare('SELECT 1 FROM economy_upgrades WHERE telegram_id=? AND building_key=?').get(id,key))return res.status(400).json({error:'Ця будівля вже покращується'});const factor=Math.pow(1.25,row.level-1),cost={wood:Math.ceil(20*factor),stone:Math.ceil(15*factor)};for(const [k,v] of Object.entries(cost))if((p[k]||0)<v)return res.status(400).json({error:`Недостатньо ресурсу: ${k}`});for(const [k,v] of Object.entries(cost))db.prepare(`UPDATE players SET ${k}=${k}-? WHERE telegram_id=?`).run(v,id);const seconds=Math.ceil(1800*factor);db.prepare('INSERT INTO economy_upgrades(telegram_id,building_key,target_level,ends_at,cost_json) VALUES(?,?,?,?,?)').run(id,key,row.level+1,Math.floor(Date.now()/1000)+seconds,JSON.stringify(cost));flushReserve(db,id);refreshWarehouseStatuses(db,id);res.json(getEconomyData(db,id));}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/economy/cancel-construction',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),key=String(req.body.building||''),c=db.prepare('SELECT cost_json FROM economy_constructions WHERE telegram_id=? AND building_key=?').get(id,key);if(!c)return res.status(400).json({error:'Немає активного будівництва'});const cost=JSON.parse(c.cost_json);let free=Math.max(0,warehouseCapacity(p)-resourceTotal(p));for(const [k,v] of Object.entries(cost)){const refund=Math.floor(v*.5),direct=Math.min(free,refund);if(direct){db.prepare(`UPDATE players SET ${k}=${k}+? WHERE telegram_id=?`).run(direct,id);free-=direct;}if(refund>direct)db.prepare('INSERT INTO economy_reserve(telegram_id,resource_key,amount) VALUES(?,?,?) ON CONFLICT(telegram_id,resource_key) DO UPDATE SET amount=amount+excluded.amount').run(id,k,refund-direct);}db.prepare('DELETE FROM economy_constructions WHERE telegram_id=? AND building_key=?').run(id,key);flushReserve(db,id);refreshWarehouseStatuses(db,id);res.json(getEconomyData(db,id));}catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/economy/cancel-upgrade',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),key=String(req.body.building||''),u=db.prepare('SELECT cost_json FROM economy_upgrades WHERE telegram_id=? AND building_key=?').get(id,key);if(!u)return res.status(400).json({error:'Немає активного покращення'});const cost=JSON.parse(u.cost_json);let free=Math.max(0,warehouseCapacity(p)-resourceTotal(p));for(const [k,v] of Object.entries(cost)){const refund=Math.floor(v*.5);const direct=Math.min(free,refund);if(direct){db.prepare(`UPDATE players SET ${k}=${k}+? WHERE telegram_id=?`).run(direct,id);free-=direct;}if(refund>direct)db.prepare('INSERT INTO economy_reserve(telegram_id,resource_key,amount) VALUES(?,?,?) ON CONFLICT(telegram_id,resource_key) DO UPDATE SET amount=amount+excluded.amount').run(id,k,refund-direct);}db.prepare('DELETE FROM economy_upgrades WHERE telegram_id=? AND building_key=?').run(id,key);flushReserve(db,id);res.json(getEconomyData(db,id));}catch(e){res.status(400).json({error:e.message})}});
}
async function flushNotifications(db, token){
 if(!token||typeof fetch!=='function')return;
 const cutoff=Math.floor(Date.now()/1000)-300;
 const ids=db.prepare('SELECT telegram_id FROM economy_notification_queue WHERE delivered=0 GROUP BY telegram_id HAVING MAX(created_at)<=?').all(cutoff);
 for(const item of ids){
  const rows=db.prepare('SELECT id,building_key,resource_key,event_type,reason,created_at FROM economy_notification_queue WHERE telegram_id=? AND delivered=0 ORDER BY created_at,id').all(item.telegram_id);
  if(!rows.length)continue;
  const grouped=new Map();for(const e of rows){const label=e.building_key==='food_supply'?'🍞 Харчування населення':(BUILDINGS[e.building_key]?.label||e.building_key);if(!grouped.has(label))grouped.set(label,[]);grouped.get(label).push(`${new Date(e.created_at*1000).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'})} — ресурс ${e.resource_key}; ${e.event_type==='stop'?'⏸️ зупинено':'▶️ відновлено'} (${e.reason})`);}
  const messages=[];let current='📜 Події виробництва Realm of Kings',currentLabel='';
  for(const [label,events] of grouped){
   for(const line of events){const addition=`\n${currentLabel===label?'':'\n'+label+'\n'}${line}`;if(current.length+addition.length>3500&&current.length>40){messages.push(current);current='📜 Події виробництва Realm of Kings';currentLabel='';}if(currentLabel!==label){current+=`\n\n${label}`;currentLabel=label;}current+=`\n${line}`;}
  }
  if(current.length>40)messages.push(current);
  let success=true;
  for(const text of messages){try{const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:item.telegram_id,text,disable_web_page_preview:true})});if(!r.ok){success=false;break;}}catch(_){success=false;break;}}
  if(success)db.prepare('UPDATE economy_notification_queue SET delivered=1 WHERE telegram_id=? AND delivered=0').run(item.telegram_id);
 }
}
module.exports={RESOURCE_FIELDS,BUILDINGS,FOOD,initEconomy,settleEconomy,getEconomyData,installEconomyRoutes,warehouseCapacity,resourceTotal,flushNotifications};
