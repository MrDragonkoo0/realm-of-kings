const express = require('express');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { BUILDINGS: ECONOMY_BUILDINGS, initEconomy, settleEconomy, installEconomyRoutes, flushNotifications, resourceTotal: economyResourceTotal } = require('./economy');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = process.env.DB_PATH || path.join(__dirname, 'rok.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

const { initializeSchema } = require('./src/db/schema');
initializeSchema(db);
initEconomy(db);

// ROK v0.5.2: every kingdom starts with one free sawmill and one free mine.
// Existing v0.5 players receive them too if they do not have them yet.
db.exec('UPDATE players SET sawmill=1 WHERE sawmill=0');
db.exec('UPDATE players SET mine=1 WHERE mine=0');

const { BUILDINGS, BUILDING_COSTS, UPGRADES, TROOPS, MARKET } = require('./src/config/catalogs');
const { getUserId } = require('./src/auth/telegram');
function getPlayer(id){ return db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id); }
function settleConstruction(p){
 if(!p?.building_type || !p.building_ends_at || p.building_ends_at>Date.now()/1000) return p;
 const b=BUILDINGS[p.building_type];
 if(b) db.prepare(`UPDATE players SET ${b.column}=${b.column}+1, building_type=NULL, building_ends_at=NULL WHERE telegram_id=?`).run(p.telegram_id);
 else db.prepare('UPDATE players SET building_type=NULL,building_ends_at=NULL WHERE telegram_id=?').run(p.telegram_id);
 return getPlayer(p.telegram_id);
}

function kyivDayKey(date=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const v=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`;
}
function eventFor(id, building, resource, type, reason, now=Math.floor(Date.now()/1000)) {
 db.prepare('INSERT INTO production_events(telegram_id,building_key,resource_key,event_type,reason,created_at) VALUES(?,?,?,?,?,?)').run(id,building,resource,type,reason,now);
}
function resourceTotal(p) { return economyResourceTotal(p); }
function warehouseCapacity(p) { return Math.floor(1000 * Math.pow(1.5,Math.max(0,(p.warehouse_level||1)-1))); }
function setProductionPaused(id, building, resource, paused, reason, now) {
 const row=db.prepare('SELECT is_paused FROM production_status WHERE telegram_id=? AND building_key=?').get(id,building);
 const was=!!row?.is_paused;
 if(was===paused) return;
 db.prepare(`INSERT INTO production_status(telegram_id,building_key,is_paused,updated_at) VALUES(?,?,?,?)
 ON CONFLICT(telegram_id,building_key) DO UPDATE SET is_paused=excluded.is_paused,updated_at=excluded.updated_at`).run(id,building,paused?1:0,now);
 eventFor(id,building,resource,paused?'stop':'resume',reason,now);
}
function settleExtraction(p){ return settleEconomy(db,p); }

function publicUser(r){
 const remaining=r.building_type&&r.building_ends_at?Math.max(0,Math.ceil(r.building_ends_at-Date.now()/1000)):0;
 const capacity=Math.max(10,r.houses*10 + r.townhall_level*20);
 const defense=r.walls_level*20+r.gate_level*15+r.military_power;
 let flag={shape:'swallowtail',color:'#b91c1c',secondary:'#d4af37',emblem:'lion',border:'gold',pattern:'plain'};try{if(r.flag_json)flag={...flag,...JSON.parse(r.flag_json)}}catch(_){}
 const economyAssigned=db.prepare('SELECT COALESCE(SUM(workers),0) AS n FROM economy_workers WHERE telegram_id=?').get(r.telegram_id)?.n||0;
 return {registered:!!r.kingdom_name,kingdom:r.kingdom_name||'',ruler:r.ruler_name||'',flag,level:r.level,xp:r.xp,population:r.population,populationCapacity:capacity,gold:r.gold,gems:r.gems,cities:r.cities,villages:r.villages,houses:r.houses,militaryPower:r.military_power,defense,fieldCount:r.field_count,
 buildings:{house:r.houses,smithy:r.smithy,farm:r.farm,stable:r.stable,barracks:r.barracks,range:r.range,temple:r.temple,bakery:r.bakery,workshop:r.workshop,hospital:r.hospital,sawmill:r.sawmill,mine:r.mine},
 workers:{woodcutters:r.woodcutters,miners:r.miners,assigned:economyAssigned||r.woodcutters+r.miners,free:Math.max(0,r.population-(economyAssigned||r.woodcutters+r.miners))},
 extraction:{woodcutters:r.woodcutters,miners:r.miners,sawmill:r.sawmill,mine:r.mine},
 sites:{forest:true,stone:true,iron:true},
 capital:{townhall:r.townhall_level,warehouse:r.warehouse_level,market:r.market_level,walls:r.walls_level,gate:r.gate_level},
 resources:{stone:r.stone,wood:r.wood,iron:r.iron,straw:r.straw,brick:r.brick,clay:r.clay,sand:r.sand,bread:r.bread,meat:r.meat,flour:r.flour,carrot:r.carrot,potato:r.potato,water:r.water,apples:r.apples,milk:r.milk,eggs:r.eggs,wheat:r.wheat,copper:r.copper,coal:r.coal,silver:r.silver,gold_ore:r.gold_ore,salt:r.salt,gemstones:r.gemstones,planks:r.planks,glass:r.glass,metal:r.metal,copper_bars:r.copper_bars,tools:r.tools},
 army:{swordsmen:r.swordsmen,archers:r.archers,shieldmen:r.shieldmen,cavalry:r.cavalry,knights:r.knights},
 building:r.building_type?{type:r.building_type,name:BUILDINGS[r.building_type]?.name||r.building_type,remaining}:null};
}
function currentPlayer(id){ return settleExtraction(settleConstruction(getPlayer(id))); }
function changeResources(id,changes){
 const p=currentPlayer(id); const sets=[],vals=[];
 for(const [k,v] of Object.entries(changes)){sets.push(`${k}=?`);vals.push((p[k]||0)+v);}
 vals.push(id); db.prepare(`UPDATE players SET ${sets.join(',')} WHERE telegram_id=?`).run(...vals);
 return currentPlayer(id);
}
function costForLevel(base,level){ const factor=Math.max(1,level); return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,v*factor])); }
function canPay(p,cost){ return Object.entries(cost).every(([k,v])=>(p[k]||0)>=v); }
function deduct(id,cost){ const sets=[],vals=[]; for(const [k,v] of Object.entries(cost)){sets.push(`${k}=?`);vals.push((getPlayer(id)[k]||0)-v);} vals.push(id);db.prepare(`UPDATE players SET ${sets.join(',')} WHERE telegram_id=?`).run(...vals); }

app.get('/api/state',(req,res)=>{try{const p=currentPlayer(getUserId(req));if(!p)return res.json({registered:false});res.json(publicUser(p));}catch(e){res.status(401).json({error:e.message});}});
app.get('/api/me',(req,res)=>{try{const p=currentPlayer(getUserId(req));res.json(p?publicUser(p):{registered:false});}catch(e){res.status(401).json({error:e.message});}});
app.post('/api/register',(req,res)=>{try{const id=getUserId(req),kingdom=String(req.body.kingdom||'').trim(),ruler=String(req.body.ruler||'').trim();if(!kingdom||!ruler)return res.status(400).json({error:'Заповни обидва поля'});if(kingdom.length>32||ruler.length>32)return res.status(400).json({error:'Максимум 32 символи'});let p=getPlayer(id);if(!p){db.prepare('INSERT INTO players(telegram_id,kingdom_name,ruler_name,gold,cities,population,houses,sawmill,mine) VALUES(?,?,?,100,1,20,2,1,1)').run(id,kingdom,ruler);p=getPlayer(id);}res.json(publicUser(p));}catch(e){res.status(400).json({error:e.message});}});

const FLAG_SHAPES=new Set(['rectangle','swallowtail','triangle','vertical','shield']);
const FLAG_COLORS=new Set(['#b91c1c','#1d4ed8','#047857','#111827','#f8fafc','#d4af37','#7e22ce','#c2410c','#0f766e','#4d7c0f','#7f1d1d','#334155']);
const FLAG_EMBLEMS=new Set(['lion','eagle','dragon','crown','wolf','stag','bear','horse','snake','fox','griffin','crossed_swords','axe','helmet','bow','sword','shield','spear','sceptre','cross','fleurdelis','throne','double_crown','tower','moon','rose','castle','sun','oak',...Array.from({length:15},(_,i)=>`royal_shield_${String(i+1).padStart(2,'0')}`)]);
const FLAG_BORDERS=new Set(['none','gold','silver','black']);
const FLAG_PATTERNS=new Set(['plain','diagonal','quartered','stripe','cross']);
app.post('/api/flag',(req,res)=>{try{
 const id=getUserId(req),p=getPlayer(id);if(!p)return res.status(400).json({error:'Спочатку створи королівство'});
 const f=req.body.flag||{};
 if(!FLAG_SHAPES.has(f.shape)||!FLAG_COLORS.has(f.color)||!FLAG_COLORS.has(f.secondary)||!FLAG_EMBLEMS.has(f.emblem)||!FLAG_BORDERS.has(f.border)||!FLAG_PATTERNS.has(f.pattern))return res.status(400).json({error:'Невірні параметри прапора'});
 const flag={shape:f.shape,color:f.color,secondary:f.secondary,emblem:f.emblem,border:f.border,pattern:f.pattern};
 db.prepare('UPDATE players SET flag_json=? WHERE telegram_id=?').run(JSON.stringify(flag),id);
 res.json(publicUser(getPlayer(id)));
}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/build',(req,res)=>{try{const id=getUserId(req),type=String(req.body.type||''),p=currentPlayer(id);if(!BUILDINGS[type])return res.status(400).json({error:'Невідома будівля'});if(!p)return res.status(400).json({error:'Спочатку створи королівство'});if(p.building_type)return res.status(400).json({error:'Зараз уже будується інша будівля'});const cost=BUILDING_COSTS[type];if(!canPay(p,cost))return res.status(400).json({error:'Недостатньо ресурсів'});deduct(id,cost);db.prepare('UPDATE players SET building_type=?,building_ends_at=? WHERE telegram_id=?').run(type,Math.floor(Date.now()/1000)+BUILDINGS[type].seconds,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/upgrade',(req,res)=>{try{const id=getUserId(req),type=String(req.body.type||''),p=currentPlayer(id),u=UPGRADES[type];if(!p||!u)return res.status(400).json({error:'Невідоме покращення'});if(p.building_type)return res.status(400).json({error:'Спочатку заверши поточне будівництво'});const level=p[u.column],cost=costForLevel(u.base,level);if(!canPay(p,cost))return res.status(400).json({error:'Недостатньо ресурсів'});deduct(id,cost);db.prepare(`UPDATE players SET ${u.column}=${u.column}+1, xp=xp+10 WHERE telegram_id=?`).run(id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/gather',(req,res)=>res.status(400).json({error:'Ручний збір ресурсів прибрано у ROK v0.5. Призначай робітників у ліс або шахту.'}));
app.post('/api/workers',(req,res)=>{try{
 const id=getUserId(req),p=currentPlayer(id),type=String(req.body.type||''),delta=Math.trunc(Number(req.body.delta)||0);
 if(!p)return res.status(400).json({error:'Немає королівства'});
 if(!['woodcutters','miners'].includes(type) || ![-1,1].includes(delta)) return res.status(400).json({error:'Невірне призначення'});
 const total=db.prepare('SELECT COALESCE(SUM(workers),0) AS n FROM economy_workers WHERE telegram_id=?').get(id).n;
 const current=p[type]||0;
 const economyKey=type==='woodcutters'?'logging':'quarry';const buildingLevel=db.prepare('SELECT level FROM economy_buildings WHERE telegram_id=? AND building_key=?').get(id,economyKey)?.level||0;const workerCap=Math.min(20,10+Math.max(0,buildingLevel-1)*2,p.population);
 if(delta>0&&current>=workerCap)return res.status(400).json({error:`Ліміт працівників цієї будівлі: ${workerCap}`});
 if(delta>0 && total>=p.population) return res.status(400).json({error:'Усі доступні жителі вже працюють'});
 if(delta<0 && current<1) return res.status(400).json({error:'Немає кого зняти з роботи'});
 const b=type==='woodcutters'?p.sawmill:p.mine;
 if(delta>0 && b<1) return res.status(400).json({error:type==='woodcutters'?'Потрібна лісопилка':'Потрібна шахта'});
 db.prepare(`UPDATE players SET ${type}=${type}+?, last_extraction_at=? WHERE telegram_id=?`).run(delta,Math.floor(Date.now()/1000),id);
 db.prepare('UPDATE economy_workers SET workers=MAX(0,workers+?) WHERE telegram_id=? AND building_key=?').run(delta,id,economyKey);
 res.json(publicUser(currentPlayer(id)));
}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/extraction',(req,res)=>{try{const p=currentPlayer(getUserId(req));if(!p)return res.status(400).json({error:'Немає королівства'});res.json({forest:{available:true,workers:p.woodcutters,production:p.woodcutters*2*p.sawmill},stoneMine:{available:p.mine>0,workers:p.miners,production:p.miners*p.mine},ironMine:{available:p.mine>0,workers:p.miners,production:p.miners*p.mine}});}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/field',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p||p.gold<100)return res.status(400).json({error:'Потрібно 100 золота'});db.prepare('UPDATE players SET gold=gold-100,field_count=field_count+1 WHERE telegram_id=?').run(id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/harvest',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p||p.farm<1||p.field_count<1)return res.status(400).json({error:'Потрібна хоча б 1 ферма і поле'});const free=Math.max(0,warehouseCapacity(p)-resourceTotal(p)),wheat=Math.min(20*p.farm,free),straw=Math.min(10*p.farm,Math.max(0,free-wheat));if(wheat+straw===0)return res.status(400).json({error:'Склад заповнений'});db.prepare('UPDATE players SET wheat=wheat+?,straw=straw+?,xp=xp+5 WHERE telegram_id=?').run(wheat,straw,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/tax',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),now=Math.floor(Date.now()/1000);if(!p)return res.status(400).json({error:'Немає королівства'});if(now-p.last_tax_at<60)return res.status(400).json({error:`Податки можна збирати раз на хвилину`});const amount=Math.max(10,p.population*2+p.houses*5+p.villages*10);db.prepare('UPDATE players SET gold=gold+?,last_tax_at=?,xp=xp+3 WHERE telegram_id=?').run(amount,now,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/market',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),action=String(req.body.action||''),resource=String(req.body.resource||''),amount=Math.max(1,Math.min(100,Number(req.body.amount)||1));const price=MARKET[resource];if(!p||!price)return res.status(400).json({error:'Невідомий товар'});if(action==='buy'){const total=price*amount;if(p.gold<total)return res.status(400).json({error:'Недостатньо золота'});if(resourceTotal(p)+amount>warehouseCapacity(p))return res.status(400).json({error:'Склад заповнений. Звільни місце або покращ склад.'});db.prepare(`UPDATE players SET gold=gold-?,${resource}=${resource}+? WHERE telegram_id=?`).run(total,amount,id);}else if(action==='sell'){if((p[resource]||0)<amount)return res.status(400).json({error:'Недостатньо товару'});db.prepare(`UPDATE players SET gold=gold+?,${resource}=${resource}-? WHERE telegram_id=?`).run(Math.floor(price*.8)*amount,amount,id);}else return res.status(400).json({error:'Невідома операція'});res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/train',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),type=String(req.body.type||''),t=TROOPS[type];if(!p||!t)return res.status(400).json({error:'Невідомий тип війська'});if(p.barracks<1 && ['swordsmen','shieldmen'].includes(type))return res.status(400).json({error:'Побудуй казарми'});if(p.range<1&&type==='archers')return res.status(400).json({error:'Побудуй стрільбище'});if(p.stable<1&&['cavalry','knights'].includes(type))return res.status(400).json({error:'Побудуй конюшню'});if(!canPay(p,t.cost))return res.status(400).json({error:'Недостатньо ресурсів'});deduct(id,t.cost);db.prepare(`UPDATE players SET ${type}=${type}+1,military_power=military_power+?,xp=xp+4 WHERE telegram_id=?`).run(t.power,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/village',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p||p.gold<100)return res.status(400).json({error:'Потрібно 100 золота'});db.prepare('UPDATE players SET gold=gold-100,villages=villages+1,population=population+5,xp=xp+5 WHERE telegram_id=?').run(id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/world',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p)return res.status(400).json({error:'Немає королівства'});const players=db.prepare('SELECT kingdom_name,ruler_name,cities,villages,military_power,population,flag_json FROM players ORDER BY military_power DESC LIMIT 20').all();res.json({you:p.kingdom_name,players:players.map(x=>{let flag={shape:'swallowtail',color:'#b91c1c',secondary:'#d4af37',emblem:'lion',border:'gold',pattern:'plain'};try{if(x.flag_json)flag={...flag,...JSON.parse(x.flag_json)}}catch(_){}return {...x,flag}})});}catch(e){res.status(400).json({error:e.message});}});

const PROD_BUILDINGS=Object.fromEntries(Object.entries(ECONOMY_BUILDINGS).map(([key,b])=>[key,{label:b.label,resource:b.resource||Object.keys(b.input||{})[0]||'resource'}]));
// Legacy event labels kept so older v0.9.9/v0.10 history remains readable.
PROD_BUILDINGS.sawmill={label:'🪚 Лісозаготівля (старі записи)',resource:'wood'};PROD_BUILDINGS.mine={label:'⛏️ Шахта (старі записи)',resource:'stone'};
const RESOURCE_LABELS={wood:'деревина',stone:'камінь',iron:'залізо',straw:'солома',brick:'цегла',clay:'глина',sand:'пісок',bread:'хліб',meat:'м’ясо',flour:'борошно',carrot:'морква',potato:'картопля',water:'вода',apples:'яблука',milk:'молоко',eggs:'яйця',wheat:'зерно',copper:'мідь',coal:'вугілля',silver:'срібло',gold_ore:'золота руда',salt:'сіль',gemstones:'самоцвіти',planks:'дошки',glass:'скло',metal:'метал',copper_bars:'мідні злитки',tools:'інструменти'};
function ensureProductionDefaults(id){
 let order=Date.now();for(const key of Object.keys(PROD_BUILDINGS))db.prepare("INSERT OR IGNORE INTO production_preferences(telegram_id,building_key,priority,updated_at) VALUES(?,?,'medium',?)").run(id,key,order++);
}
function exportCount(id){const day=kyivDayKey();return db.prepare('SELECT count FROM export_daily WHERE telegram_id=? AND day_key=?').get(id,day)?.count||0;}
function consumeExport(id){const day=kyivDayKey();const count=exportCount(id);if(count>=10)throw new Error('Добовий ліміт експорту вичерпано. Спробуйте завтра.');db.prepare(`INSERT INTO export_daily(telegram_id,day_key,count) VALUES(?,?,1) ON CONFLICT(telegram_id,day_key) DO UPDATE SET count=count+1`).run(id,day);return 10-count-1;}
function safeDate(ts){return new Date(ts*1000).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'});}
function getProductionData(id){
 ensureProductionDefaults(id);
 const prefs=db.prepare('SELECT building_key,priority,updated_at FROM production_preferences WHERE telegram_id=?').all(id);
 const events=db.prepare('SELECT id,building_key,resource_key,event_type,reason,created_at FROM production_events WHERE telegram_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 500').all(id,Math.floor(Date.now()/1000)-7*86400);
 const archiveCount=db.prepare('SELECT COUNT(*) AS n FROM production_events WHERE telegram_id=? AND created_at<?').get(id,Math.floor(Date.now()/1000)-7*86400).n;
 const count=exportCount(id);
 return {buildings:Object.entries(PROD_BUILDINGS).map(([key,b])=>({key,label:b.label,resource:b.resource,priority:prefs.find(x=>x.building_key===key)?.priority||'medium'})),events,archiveCount,exportsRemaining:10-count,warehouse:{capacity:warehouseCapacity(getPlayer(id)),used:resourceTotal(getPlayer(id))}};
}
app.get('/api/production',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p)return res.status(400).json({error:'Спочатку створи королівство'});res.json(getProductionData(id));}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/production/priority',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),building=String(req.body.building||''),priority=String(req.body.priority||'');if(!p)return res.status(400).json({error:'Немає королівства'});if(!PROD_BUILDINGS[building]||!['high','medium','low'].includes(priority))return res.status(400).json({error:'Невірний пріоритет'});ensureProductionDefaults(id);const now=Date.now();db.prepare(`INSERT INTO production_preferences(telegram_id,building_key,priority,updated_at) VALUES(?,?,?,?) ON CONFLICT(telegram_id,building_key) DO UPDATE SET priority=excluded.priority,updated_at=excluded.updated_at`).run(id,building,priority,now);res.json(getProductionData(id));}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/production/stats',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p)return res.status(400).json({error:'Немає королівства'});const now=Math.floor(Date.now()/1000),days=Math.max(7,Math.min(30,Number(req.query.days)||7));const from=now-days*86400,prevFrom=from-days*86400;const rows=db.prepare('SELECT building_key,event_type,reason,created_at FROM production_events WHERE telegram_id=? AND created_at>=? ORDER BY created_at DESC').all(id,prevFrom);const sum=(arr)=>({stops:arr.filter(x=>x.event_type==='stop').length,resumes:arr.filter(x=>x.event_type==='resume').length,reasons:Object.entries(arr.filter(x=>x.event_type==='stop').reduce((a,x)=>(a[x.reason]=(a[x.reason]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]),byBuilding:Object.entries(arr.reduce((a,x)=>{const k=x.building_key;(a[k]??={stops:0,resumes:0});a[k][x.event_type==='stop'?'stops':'resumes']++;return a},{}))});const current=rows.filter(x=>x.created_at>=from),previous=rows.filter(x=>x.created_at<from);const cur=sum(current),prev=sum(previous),pct=(a,b)=>b===0?null:Math.round((a-b)/b*100),curB=Object.fromEntries(cur.byBuilding),prevB=Object.fromEntries(prev.byBuilding),keys=[...new Set([...Object.keys(curB),...Object.keys(prevB)])],byBuilding=keys.map(key=>({key,current:curB[key]||{stops:0,resumes:0},previous:prevB[key]||{stops:0,resumes:0},stops:pct((curB[key]||{stops:0}).stops,(prevB[key]||{stops:0}).stops),resumes:pct((curB[key]||{resumes:0}).resumes,(prevB[key]||{resumes:0}).resumes)})),reasonCount=a=>Object.fromEntries(a.filter(x=>x.event_type==='stop').reduce((m,x)=>(m[x.reason]=(m[x.reason]||0)+1,m),{})),cr=reasonCount(current),pr=reasonCount(previous),reasonKeys=[...new Set([...Object.keys(cr),...Object.keys(pr)])],reasons=reasonKeys.map(reason=>({reason,current:cr[reason]||0,previous:pr[reason]||0,change:pct(cr[reason]||0,pr[reason]||0)}));res.json({days,current:cur,previous:prev,comparison:{stops:pct(cur.stops,prev.stops),resumes:pct(cur.resumes,prev.resumes),byBuilding,reasons},events:current.map(x=>({...x,time:safeDate(x.created_at)}))});}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/production/archive',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p)return res.status(400).json({error:'Немає королівства'});const before=Math.floor(Date.now()/1000)-7*86400,offset=Math.max(0,Math.min(1000000,Number(req.query.offset)||0)),limit=Math.max(10,Math.min(100,Number(req.query.limit)||50)),building=String(req.query.building||''),type=String(req.query.type||''),search=String(req.query.search||'').slice(0,80),like='%'+search.toLowerCase()+'%',labelKeys=search?Object.entries(PROD_BUILDINGS).filter(([k,b])=>(b.label+' '+k).toLowerCase().includes(search.toLowerCase())).map(([k])=>k):[],resourceKeys=search?Object.entries(RESOURCE_LABELS).filter(([k,label])=>(label+' '+k).toLowerCase().includes(search.toLowerCase())).map(([k])=>k):[],labelSql=(labelKeys.length?` OR building_key IN (${labelKeys.map(()=>'?').join(',')})`:'')+(resourceKeys.length?` OR resource_key IN (${resourceKeys.map(()=>'?').join(',')})`:''),where=`telegram_id=? AND created_at<? AND (?='' OR building_key=?) AND (?='' OR event_type=?) AND (?='' OR lower(building_key||' '||resource_key||' '||reason) LIKE ?${labelSql})`,args=[id,before,building,building,type,type,search,like,...labelKeys,...resourceKeys];const total=db.prepare(`SELECT COUNT(*) AS n FROM production_events WHERE ${where}`).get(...args).n;const rows=db.prepare(`SELECT id,building_key,resource_key,event_type,reason,created_at FROM production_events WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...args,limit,offset);res.json({events:rows,total,offset,limit,hasMore:offset+rows.length<total,retainedForever:true});}catch(e){res.status(400).json({error:e.message});}});
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
app.get('/api/export/history',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p)return res.status(400).json({error:'Немає королівства'});const remaining=consumeExport(id);const building=String(req.query.building||''),type=String(req.query.type||''),search=String(req.query.search||'').slice(0,80);let rows=db.prepare('SELECT building_key,resource_key,event_type,reason,created_at FROM production_events WHERE telegram_id=? AND created_at>=? ORDER BY created_at DESC').all(id,Math.floor(Date.now()/1000)-7*86400);if(building)rows=rows.filter(x=>x.building_key===building);if(type)rows=rows.filter(x=>x.event_type===type);if(search)rows=rows.filter(x=>((PROD_BUILDINGS[x.building_key]?.label||x.building_key)+' '+x.building_key+' '+(RESOURCE_LABELS[x.resource_key]||x.resource_key)+' '+x.resource_key+' '+x.reason).toLowerCase().includes(search.toLowerCase()));const text=['Історія виробництва Realm of Kings',`Королівство: ${p.kingdom_name}`,`Експорт: ${safeDate(Math.floor(Date.now()/1000))}`,'',...rows.map(x=>`${safeDate(x.created_at)} | ${PROD_BUILDINGS[x.building_key]?.label||x.building_key} | ${RESOURCE_LABELS[x.resource_key]||x.resource_key} | ${x.event_type==='stop'?'Зупинка':'Відновлення'} | ${x.reason}`),'',`Залишилося експортів: ${remaining}/10`].join('\n');const filename=`production_history_${kyivDayKey()}.txt`;res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);res.setHeader('X-Exports-Remaining',String(remaining));res.send('\uFEFF'+text);}catch(e){res.status(e.message.includes('ліміт')?429:400).json({error:e.message});}});
app.get('/api/export/stats',(req,res)=>{try{
 const id=getUserId(req),p=currentPlayer(id);if(!p)return res.status(400).json({error:'Немає королівства'});
 const format=String(req.query.format||'txt');if(!['txt','csv'].includes(format))return res.status(400).json({error:'Невідомий формат'});
 const remaining=consumeExport(id),days=Math.max(7,Math.min(30,Number(req.query.days)||7)),now=Math.floor(Date.now()/1000),from=now-days*86400,prevFrom=from-days*86400;
 const rows=db.prepare('SELECT building_key,resource_key,event_type,reason,created_at FROM production_events WHERE telegram_id=? AND created_at>=? ORDER BY created_at DESC').all(id,prevFrom);
 const current=rows.filter(x=>x.created_at>=from),previous=rows.filter(x=>x.created_at<from),tally=a=>({stops:a.filter(x=>x.event_type==='stop').length,resumes:a.filter(x=>x.event_type==='resume').length});
 const c=tally(current),pr=tally(previous),pct=(a,b)=>b===0?'н/д':`${Math.round((a-b)/b*100)}%`;
 const keys=[...new Set(rows.map(x=>x.building_key))],byBuilding=keys.map(key=>{const ca=tally(current.filter(x=>x.building_key===key)),pa=tally(previous.filter(x=>x.building_key===key));return {key,ca,pa}});
 const reasonCount=a=>a.filter(x=>x.event_type==='stop').reduce((m,x)=>(m[x.reason]=(m[x.reason]||0)+1,m),{}),cr=reasonCount(current),prr=reasonCount(previous),reasonKeys=[...new Set([...Object.keys(cr),...Object.keys(prr)])];
 let content,filename;
 if(format==='csv'){
  const csvRows=[['Період','Показник','Значення'],[`${days} днів`,'Зупинки',c.stops],[`${days} днів`,'Відновлення',c.resumes],[`Попередні ${days} днів`,'Зупинки',pr.stops],[`Попередні ${days} днів`,'Відновлення',pr.resumes],['Порівняння',`Зміна зупинок`,pct(c.stops,pr.stops)],['Порівняння',`Зміна відновлень`,pct(c.resumes,pr.resumes)],[],['Будівля','Поточні зупинки','Попередні зупинки','Зміна зупинок','Поточні відновлення','Попередні відновлення','Зміна відновлень'],...byBuilding.map(x=>[PROD_BUILDINGS[x.key]?.label||x.key,x.ca.stops,x.pa.stops,pct(x.ca.stops,x.pa.stops),x.ca.resumes,x.pa.resumes,pct(x.ca.resumes,x.pa.resumes)]),[],['Причина','Поточний період','Попередній період','Зміна'],...reasonKeys.map(k=>[k,cr[k]||0,prr[k]||0,pct(cr[k]||0,prr[k]||0)]),[],['Дата і час','Будівля','Ресурс','Тип події','Причина'],...current.map(x=>[safeDate(x.created_at),PROD_BUILDINGS[x.building_key]?.label||x.building_key,RESOURCE_LABELS[x.resource_key]||x.resource_key,x.event_type==='stop'?'Зупинка':'Відновлення',x.reason])];
  content=csvRows.map(row=>row.map(csvCell).join(';')).join('\r\n');filename=`production_stats_${days}d_${kyivDayKey()}.csv`;res.setHeader('Content-Type','text/csv; charset=utf-8');
 }else{
  content=[`Статистика виробництва — ${p.kingdom_name}`,`Період: ${days} днів`,`Зупинки: ${c.stops} (попередній період: ${pr.stops}; зміна ${pct(c.stops,pr.stops)})`,`Відновлення: ${c.resumes} (попередній період: ${pr.resumes}; зміна ${pct(c.resumes,pr.resumes)})`,'','За будівлями:',...byBuilding.map(x=>`${PROD_BUILDINGS[x.key]?.label||x.key}: зупинки ${x.ca.stops}/${x.pa.stops} (${pct(x.ca.stops,x.pa.stops)}); відновлення ${x.ca.resumes}/${x.pa.resumes} (${pct(x.ca.resumes,x.pa.resumes)})`),'','Причини зупинок:',...reasonKeys.map(k=>`${k}: ${cr[k]||0} / ${prr[k]||0} (${pct(cr[k]||0,prr[k]||0)})`),'','Події:',...current.map(x=>`${safeDate(x.created_at)} | ${PROD_BUILDINGS[x.building_key]?.label||x.building_key} | ${RESOURCE_LABELS[x.resource_key]||x.resource_key} | ${x.event_type==='stop'?'Зупинка':'Відновлення'} | ${x.reason}`),'',`Залишилося експортів: ${remaining}/10`].join('\n');filename=`production_stats_${days}d_${kyivDayKey()}.txt`;res.setHeader('Content-Type','text/plain; charset=utf-8');
 }
 res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);res.setHeader('X-Exports-Remaining',String(remaining));res.send('\uFEFF'+content);
}catch(e){res.status(e.message.includes('ліміт')?429:400).json({error:e.message});}});

installEconomyRoutes({app,db,getUserId,currentPlayer});
setInterval(()=>{flushNotifications(db,process.env.BOT_TOKEN).catch(()=>{});},60*1000).unref();
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`ROK v0.10 SQLite server on ${PORT}`));
