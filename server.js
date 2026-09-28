const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = process.env.DB_PATH || path.join(__dirname, 'rok.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

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
 water INTEGER NOT NULL DEFAULT 0, apples INTEGER NOT NULL DEFAULT 0,
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

const columns = [
 ['gold','INTEGER NOT NULL DEFAULT 100'],['cities','INTEGER NOT NULL DEFAULT 1'],
 ['wheat','INTEGER NOT NULL DEFAULT 0'],['townhall_level','INTEGER NOT NULL DEFAULT 1'],
 ['warehouse_level','INTEGER NOT NULL DEFAULT 1'],['market_level','INTEGER NOT NULL DEFAULT 1'],
 ['walls_level','INTEGER NOT NULL DEFAULT 1'],['gate_level','INTEGER NOT NULL DEFAULT 1'],
 ['field_count','INTEGER NOT NULL DEFAULT 0'],['last_tax_at','INTEGER NOT NULL DEFAULT 0'],
 ['last_gather_at','INTEGER NOT NULL DEFAULT 0']
];
for (const [name,def] of columns) { try { db.exec(`ALTER TABLE players ADD COLUMN ${name} ${def}`); } catch (_) {} }

const V05_COLUMNS = [
 ['sawmill','INTEGER NOT NULL DEFAULT 0'],['mine','INTEGER NOT NULL DEFAULT 0'],
 ['woodcutters','INTEGER NOT NULL DEFAULT 0'],['miners','INTEGER NOT NULL DEFAULT 0'],
 ['last_extraction_at','INTEGER NOT NULL DEFAULT 0']
];
for (const [name,def] of V05_COLUMNS) { try { db.exec(`ALTER TABLE players ADD COLUMN ${name} ${def}`); } catch (_) {} }

const BUILDINGS = {
 house:{name:'🏠 Будинки',seconds:300,column:'houses'}, smithy:{name:'⚒️ Кузня',seconds:1200,column:'smithy'},
 farm:{name:'🌾 Ферма',seconds:900,column:'farm'}, stable:{name:'🐴 Конюшня',seconds:2400,column:'stable'},
 barracks:{name:'🛡️ Казарми',seconds:1800,column:'barracks'}, range:{name:'🏹 Стрільбище',seconds:1500,column:'range'},
 temple:{name:'⛪ Храм',seconds:2100,column:'temple'}, bakery:{name:'🍞 Пекарня',seconds:1200,column:'bakery'},
 workshop:{name:'🧵 Майстерня',seconds:1500,column:'workshop'}, hospital:{name:'🏥 Лікарня',seconds:2400,column:'hospital'},
 sawmill:{name:'🪚 Лісопилка',seconds:1200,column:'sawmill'}, mine:{name:'⛏️ Шахта',seconds:1800,column:'mine'}
};
const BUILDING_COSTS = {
 house:{wood:15,stone:10,brick:10}, smithy:{wood:10,stone:15,iron:5,clay:5},
 farm:{wood:5,stone:10,straw:25}, stable:{wood:30,stone:50,straw:25,iron:10,clay:10,brick:20},
 barracks:{wood:25,stone:30,iron:15}, range:{wood:20,stone:20,iron:10},
 temple:{wood:20,stone:35,brick:20}, bakery:{wood:15,stone:15,brick:15,clay:5},
 workshop:{wood:20,stone:15,iron:10}, hospital:{wood:25,stone:30,brick:20}, sawmill:{wood:20,stone:15}, mine:{wood:30,stone:40}
};
const UPGRADES = {
 townhall:{name:'🏛️ Ратуша',column:'townhall_level',base:{stone:40,wood:30,brick:20},time:900},
 warehouse:{name:'📦 Склад',column:'warehouse_level',base:{wood:25,stone:20},time:600},
 market:{name:'🏪 Ринок',column:'market_level',base:{wood:30,stone:20,brick:15},time:900},
 walls:{name:'🏰 Стіни',column:'walls_level',base:{stone:50,brick:30},time:1200},
 gate:{name:'🚪 Ворота',column:'gate_level',base:{wood:40,iron:20,stone:20},time:1200}
};
const TROOPS = {
 swordsmen:{name:'🗡️ Мечники',power:1,cost:{gold:20,iron:1}},
 archers:{name:'🏹 Лучники',power:3,cost:{gold:35,wood:1}},
 shieldmen:{name:'🛡️ Щитоносці',power:2,cost:{gold:30,iron:1}},
 cavalry:{name:'🐎 Легка кіннота',power:7,cost:{gold:70,iron:2}},
 knights:{name:'🛡️ Лицарі',power:15,cost:{gold:150,iron:3}}
};
const MARKET = {wood:4,stone:5,iron:12,straw:3,brick:10,clay:6,sand:3,wheat:8,bread:15,meat:20};

function verifyTelegram(initData){
 if(!initData || !process.env.BOT_TOKEN) throw new Error('Telegram авторизація не налаштована');
 const p=new URLSearchParams(initData), hash=p.get('hash'); if(!hash) throw new Error('Немає Telegram hash');
 p.delete('hash'); const dataCheck=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=crypto.createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();
 const expected=crypto.createHmac('sha256',secret).update(dataCheck).digest('hex');
 if(hash.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(expected))) throw new Error('Невірна Telegram авторизація');
 const user=JSON.parse(p.get('user')||'{}'); if(!user.id) throw new Error('Не знайдено Telegram ID'); return user;
}
function getUserId(req){ return verifyTelegram(req.headers['x-telegram-init-data']).id; }
function getPlayer(id){ return db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id); }
function settleConstruction(p){
 if(!p?.building_type || !p.building_ends_at || p.building_ends_at>Date.now()/1000) return p;
 const b=BUILDINGS[p.building_type];
 if(b) db.prepare(`UPDATE players SET ${b.column}=${b.column}+1, building_type=NULL, building_ends_at=NULL WHERE telegram_id=?`).run(p.telegram_id);
 else db.prepare('UPDATE players SET building_type=NULL,building_ends_at=NULL WHERE telegram_id=?').run(p.telegram_id);
 return getPlayer(p.telegram_id);
}

function settleExtraction(p){
 if(!p) return p;
 const now=Math.floor(Date.now()/1000);
 const last=p.last_extraction_at||now;
 const elapsed=Math.max(0, now-last);
 const cycles=Math.floor(elapsed/60);
 if(cycles<1) return p;
 let woodGain=0, stoneGain=0, ironGain=0;
 if(p.woodcutters>0 && p.sawmill>0) woodGain=p.woodcutters*2*cycles*p.sawmill;
 if(p.miners>0 && p.mine>0){ stoneGain=p.miners*1*cycles*p.mine; ironGain=p.miners*1*cycles*p.mine; }
 if(woodGain||stoneGain||ironGain){
   db.prepare('UPDATE players SET wood=wood+?,stone=stone+?,iron=iron+?,last_extraction_at=? WHERE telegram_id=?').run(woodGain,stoneGain,ironGain,last+cycles*60,p.telegram_id);
 } else {
   db.prepare('UPDATE players SET last_extraction_at=? WHERE telegram_id=?').run(last+cycles*60,p.telegram_id);
 }
 return getPlayer(p.telegram_id);
}
function publicUser(r){
 const remaining=r.building_type&&r.building_ends_at?Math.max(0,Math.ceil(r.building_ends_at-Date.now()/1000)):0;
 const capacity=Math.max(10,r.houses*10 + r.townhall_level*20);
 const defense=r.walls_level*20+r.gate_level*15+r.military_power;
 return {registered:!!r.kingdom_name,kingdom:r.kingdom_name||'',ruler:r.ruler_name||'',level:r.level,xp:r.xp,population:r.population,populationCapacity:capacity,gold:r.gold,gems:r.gems,cities:r.cities,villages:r.villages,houses:r.houses,militaryPower:r.military_power,defense,fieldCount:r.field_count,
 buildings:{house:r.houses,smithy:r.smithy,farm:r.farm,stable:r.stable,barracks:r.barracks,range:r.range,temple:r.temple,bakery:r.bakery,workshop:r.workshop,hospital:r.hospital,sawmill:r.sawmill,mine:r.mine},
 workers:{woodcutters:r.woodcutters,miners:r.miners,free:Math.max(0,r.population-r.woodcutters-r.miners)},
 extraction:{woodcutters:r.woodcutters,miners:r.miners,sawmill:r.sawmill,mine:r.mine},
 sites:{forest:true,stone:true,iron:true},
 capital:{townhall:r.townhall_level,warehouse:r.warehouse_level,market:r.market_level,walls:r.walls_level,gate:r.gate_level},
 resources:{stone:r.stone,wood:r.wood,iron:r.iron,straw:r.straw,brick:r.brick,clay:r.clay,sand:r.sand,bread:r.bread,meat:r.meat,flour:r.flour,carrot:r.carrot,potato:r.potato,water:r.water,apples:r.apples,wheat:r.wheat},
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
app.post('/api/register',(req,res)=>{try{const id=getUserId(req),kingdom=String(req.body.kingdom||'').trim(),ruler=String(req.body.ruler||'').trim();if(!kingdom||!ruler)return res.status(400).json({error:'Заповни обидва поля'});if(kingdom.length>32||ruler.length>32)return res.status(400).json({error:'Максимум 32 символи'});let p=getPlayer(id);if(!p){db.prepare('INSERT INTO players(telegram_id,kingdom_name,ruler_name,gold,cities) VALUES(?,?,?,100,1)').run(id,kingdom,ruler);p=getPlayer(id);}res.json(publicUser(p));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/build',(req,res)=>{try{const id=getUserId(req),type=String(req.body.type||''),p=currentPlayer(id);if(!BUILDINGS[type])return res.status(400).json({error:'Невідома будівля'});if(!p)return res.status(400).json({error:'Спочатку створи королівство'});if(p.building_type)return res.status(400).json({error:'Зараз уже будується інша будівля'});const cost=BUILDING_COSTS[type];if(!canPay(p,cost))return res.status(400).json({error:'Недостатньо ресурсів'});deduct(id,cost);db.prepare('UPDATE players SET building_type=?,building_ends_at=? WHERE telegram_id=?').run(type,Math.floor(Date.now()/1000)+BUILDINGS[type].seconds,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/upgrade',(req,res)=>{try{const id=getUserId(req),type=String(req.body.type||''),p=currentPlayer(id),u=UPGRADES[type];if(!p||!u)return res.status(400).json({error:'Невідоме покращення'});if(p.building_type)return res.status(400).json({error:'Спочатку заверши поточне будівництво'});const level=p[u.column],cost=costForLevel(u.base,level);if(!canPay(p,cost))return res.status(400).json({error:'Недостатньо ресурсів'});deduct(id,cost);db.prepare(`UPDATE players SET ${u.column}=${u.column}+1, xp=xp+10 WHERE telegram_id=?`).run(id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/gather',(req,res)=>res.status(400).json({error:'Ручний збір ресурсів прибрано у ROK v0.5. Призначай робітників у ліс або шахту.'}));
app.post('/api/workers',(req,res)=>{try{
 const id=getUserId(req),p=currentPlayer(id),type=String(req.body.type||''),delta=Math.trunc(Number(req.body.delta)||0);
 if(!p)return res.status(400).json({error:'Немає королівства'});
 if(!['woodcutters','miners'].includes(type) || ![-1,1].includes(delta)) return res.status(400).json({error:'Невірне призначення'});
 const total=p.woodcutters+p.miners;
 const current=p[type]||0;
 if(delta>0 && total>=p.population) return res.status(400).json({error:'Усі доступні жителі вже працюють'});
 if(delta<0 && current<1) return res.status(400).json({error:'Немає кого зняти з роботи'});
 const b=type==='woodcutters'?p.sawmill:p.mine;
 if(delta>0 && b<1) return res.status(400).json({error:type==='woodcutters'?'Потрібна лісопилка':'Потрібна шахта'});
 db.prepare(`UPDATE players SET ${type}=${type}+?, last_extraction_at=? WHERE telegram_id=?`).run(delta,Math.floor(Date.now()/1000),id);
 res.json(publicUser(currentPlayer(id)));
}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/extraction',(req,res)=>{try{const p=currentPlayer(getUserId(req));if(!p)return res.status(400).json({error:'Немає королівства'});res.json({forest:{available:true,workers:p.woodcutters,production:p.woodcutters*2*p.sawmill},stoneMine:{available:p.mine>0,workers:p.miners,production:p.miners*p.mine},ironMine:{available:p.mine>0,workers:p.miners,production:p.miners*p.mine}});}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/field',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p||p.gold<100)return res.status(400).json({error:'Потрібно 100 золота'});db.prepare('UPDATE players SET gold=gold-100,field_count=field_count+1 WHERE telegram_id=?').run(id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/harvest',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p||p.farm<1||p.field_count<1)return res.status(400).json({error:'Потрібна хоча б 1 ферма і поле'});const wheat=20*p.farm;db.prepare('UPDATE players SET wheat=wheat+?,straw=straw+?,xp=xp+5 WHERE telegram_id=?').run(wheat,10*p.farm,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/tax',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),now=Math.floor(Date.now()/1000);if(!p)return res.status(400).json({error:'Немає королівства'});if(now-p.last_tax_at<60)return res.status(400).json({error:`Податки можна збирати раз на хвилину`});const amount=Math.max(10,p.population*2+p.houses*5+p.villages*10);db.prepare('UPDATE players SET gold=gold+?,last_tax_at=?,xp=xp+3 WHERE telegram_id=?').run(amount,now,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/market',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),action=String(req.body.action||''),resource=String(req.body.resource||''),amount=Math.max(1,Math.min(100,Number(req.body.amount)||1));const price=MARKET[resource];if(!p||!price)return res.status(400).json({error:'Невідомий товар'});if(action==='buy'){const total=price*amount;if(p.gold<total)return res.status(400).json({error:'Недостатньо золота'});db.prepare(`UPDATE players SET gold=gold-?,${resource}=${resource}+? WHERE telegram_id=?`).run(total,amount,id);}else if(action==='sell'){if((p[resource]||0)<amount)return res.status(400).json({error:'Недостатньо товару'});db.prepare(`UPDATE players SET gold=gold+?,${resource}=${resource}-? WHERE telegram_id=?`).run(Math.floor(price*.8)*amount,amount,id);}else return res.status(400).json({error:'Невідома операція'});res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/train',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id),type=String(req.body.type||''),t=TROOPS[type];if(!p||!t)return res.status(400).json({error:'Невідомий тип війська'});if(p.barracks<1 && ['swordsmen','shieldmen'].includes(type))return res.status(400).json({error:'Побудуй казарми'});if(p.range<1&&type==='archers')return res.status(400).json({error:'Побудуй стрільбище'});if(p.stable<1&&['cavalry','knights'].includes(type))return res.status(400).json({error:'Побудуй конюшню'});if(!canPay(p,t.cost))return res.status(400).json({error:'Недостатньо ресурсів'});deduct(id,t.cost);db.prepare(`UPDATE players SET ${type}=${type}+1,military_power=military_power+?,xp=xp+4 WHERE telegram_id=?`).run(t.power,id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});

app.post('/api/village',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p||p.gold<100)return res.status(400).json({error:'Потрібно 100 золота'});db.prepare('UPDATE players SET gold=gold-100,villages=villages+1,population=population+5,xp=xp+5 WHERE telegram_id=?').run(id);res.json(publicUser(currentPlayer(id)));}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/world',(req,res)=>{try{const id=getUserId(req),p=currentPlayer(id);if(!p)return res.status(400).json({error:'Немає королівства'});const players=db.prepare('SELECT kingdom_name,ruler_name,cities,villages,military_power,population FROM players ORDER BY military_power DESC LIMIT 20').all();res.json({you:p.kingdom_name,players});}catch(e){res.status(400).json({error:e.message});}});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`ROK v0.4 SQLite server on ${PORT}`));
