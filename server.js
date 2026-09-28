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

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  telegram_id INTEGER PRIMARY KEY,
  kingdom_name TEXT,
  ruler_name TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  population INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 0,
  gems INTEGER NOT NULL DEFAULT 0,
  cities INTEGER NOT NULL DEFAULT 0,
  villages INTEGER NOT NULL DEFAULT 0,
  houses INTEGER NOT NULL DEFAULT 0,
  smithy INTEGER NOT NULL DEFAULT 0,
  farm INTEGER NOT NULL DEFAULT 0,
  stable INTEGER NOT NULL DEFAULT 0,
  barracks INTEGER NOT NULL DEFAULT 0,
  range INTEGER NOT NULL DEFAULT 0,
  temple INTEGER NOT NULL DEFAULT 0,
  bakery INTEGER NOT NULL DEFAULT 0,
  workshop INTEGER NOT NULL DEFAULT 0,
  hospital INTEGER NOT NULL DEFAULT 0,
  military_power INTEGER NOT NULL DEFAULT 0,
  stone INTEGER NOT NULL DEFAULT 0,
  wood INTEGER NOT NULL DEFAULT 0,
  iron INTEGER NOT NULL DEFAULT 0,
  straw INTEGER NOT NULL DEFAULT 0,
  brick INTEGER NOT NULL DEFAULT 0,
  clay INTEGER NOT NULL DEFAULT 0,
  sand INTEGER NOT NULL DEFAULT 0,
  bread INTEGER NOT NULL DEFAULT 0,
  meat INTEGER NOT NULL DEFAULT 0,
  flour INTEGER NOT NULL DEFAULT 0,
  carrot INTEGER NOT NULL DEFAULT 0,
  potato INTEGER NOT NULL DEFAULT 0,
  water INTEGER NOT NULL DEFAULT 0,
  apples INTEGER NOT NULL DEFAULT 0,
  swordsmen INTEGER NOT NULL DEFAULT 0,
  archers INTEGER NOT NULL DEFAULT 0,
  shieldmen INTEGER NOT NULL DEFAULT 0,
  cavalry INTEGER NOT NULL DEFAULT 0,
  knights INTEGER NOT NULL DEFAULT 0,
  building_type TEXT,
  building_ends_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
`);

const BUILDINGS = {
  house:{name:'🏠 Будинки',seconds:300,column:'houses'},
  smithy:{name:'⚒️ Кузня',seconds:1200,column:'smithy'},
  farm:{name:'🌾 Ферма',seconds:900,column:'farm'},
  stable:{name:'🐴 Конюшня',seconds:2400,column:'stable'},
  barracks:{name:'🛡️ Казарми',seconds:1800,column:'barracks'},
  range:{name:'🏹 Стрільбище',seconds:1500,column:'range'},
  temple:{name:'⛪ Храм',seconds:2100,column:'temple'},
  bakery:{name:'🍞 Пекарня',seconds:1200,column:'bakery'},
  workshop:{name:'🧵 Майстерня',seconds:1500,column:'workshop'},
  hospital:{name:'🏥 Лікарня',seconds:2400,column:'hospital'}
};

const BUILDING_COSTS = {
  house:{wood:15,stone:10,brick:10},
  smithy:{wood:10,stone:15,iron:5,clay:5},
  farm:{wood:5,stone:10,straw:25},
  stable:{wood:30,stone:50,straw:25,iron:10,clay:10,brick:20},
  barracks:{wood:25,stone:30,iron:15},
  range:{wood:20,stone:20,iron:10},
  temple:{wood:20,stone:35,brick:20},
  bakery:{wood:15,stone:15,brick:15,clay:5},
  workshop:{wood:20,stone:15,iron:10},
  hospital:{wood:25,stone:30,brick:20}
};

function verifyTelegram(initData){
  if(!initData || !process.env.BOT_TOKEN)
    throw new Error('Telegram авторизація не налаштована');

  const p=new URLSearchParams(initData);
  const hash=p.get('hash');
  if(!hash) throw new Error('Немає Telegram hash');

  p.delete('hash');
  const dataCheck=[...p.entries()]
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>`${k}=${v}`).join('\n');

  const secret=crypto.createHmac('sha256','WebAppData')
    .update(process.env.BOT_TOKEN).digest();

  const expected=crypto.createHmac('sha256',secret)
    .update(dataCheck).digest('hex');

  if(hash.length!==expected.length ||
     !crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(expected)))
    throw new Error('Невірна Telegram авторизація');

  const user=JSON.parse(p.get('user')||'{}');
  if(!user.id) throw new Error('Не знайдено Telegram ID');
  return user;
}

function getUserId(req){
  return verifyTelegram(req.headers['x-telegram-init-data']).id;
}

function getPlayer(id){
  return db.prepare('SELECT * FROM players WHERE telegram_id = ?').get(id);
}

function settleConstruction(player){
  if(!player || !player.building_type || !player.building_ends_at)
    return player;

  if(player.building_ends_at > Math.floor(Date.now()/1000))
    return player;

  const b=BUILDINGS[player.building_type];
  if(b){
    db.prepare(`
      UPDATE players
      SET ${b.column}=${b.column}+1,
          building_type=NULL,
          building_ends_at=NULL
      WHERE telegram_id=?
    `).run(player.telegram_id);
  } else {
    db.prepare(`
      UPDATE players
      SET building_type=NULL, building_ends_at=NULL
      WHERE telegram_id=?
    `).run(player.telegram_id);
  }
  return getPlayer(player.telegram_id);
}

function publicUser(r){
  const remaining = r.building_type && r.building_ends_at
    ? Math.max(0, Math.ceil(r.building_ends_at - Date.now()/1000))
    : 0;

  return {
    registered:!!r.kingdom_name,
    kingdom:r.kingdom_name||'',
    ruler:r.ruler_name||'',
    level:r.level,
    xp:r.xp,
    population:r.population,
    gold:r.gold,
    gems:r.gems,
    cities:r.cities,
    villages:r.villages,
    houses:r.houses,
    militaryPower:r.military_power,
    buildings:{
      house:r.houses,smithy:r.smithy,farm:r.farm,stable:r.stable,
      barracks:r.barracks,range:r.range,temple:r.temple,
      bakery:r.bakery,workshop:r.workshop,hospital:r.hospital
    },
    resources:{
      stone:r.stone,wood:r.wood,iron:r.iron,straw:r.straw,
      brick:r.brick,clay:r.clay,sand:r.sand,bread:r.bread,
      meat:r.meat,flour:r.flour,carrot:r.carrot,potato:r.potato,
      water:r.water,apples:r.apples
    },
    army:{
      swordsmen:r.swordsmen,archers:r.archers,
      shieldmen:r.shieldmen,cavalry:r.cavalry,knights:r.knights
    },
    building:r.building_type ? {
      type:r.building_type,
      name:BUILDINGS[r.building_type]?.name || r.building_type,
      remaining
    } : null
  };
}

function currentPlayer(id){
  return settleConstruction(getPlayer(id));
}

app.get('/api/me',(req,res)=>{
  try{
    const id=getUserId(req);
    const player=currentPlayer(id);
    if(!player) return res.json({registered:false});
    res.json(publicUser(player));
  }catch(e){
    res.status(401).json({error:e.message});
  }
});

app.get('/api/state',(req,res)=>{
  try{
    const id=getUserId(req);
    const player=currentPlayer(id);
    if(!player) return res.json({registered:false});
    res.json(publicUser(player));
  }catch(e){
    res.status(401).json({error:e.message});
  }
});

app.post('/api/register',(req,res)=>{
  try{
    const id=getUserId(req);
    const kingdom=String(req.body.kingdom||'').trim();
    const ruler=String(req.body.ruler||'').trim();

    if(!kingdom || !ruler)
      return res.status(400).json({error:'Заповни обидва поля'});

    if(kingdom.length>32 || ruler.length>32)
      return res.status(400).json({error:'Максимум 32 символи'});

    let player=getPlayer(id);

    if(!player){
      db.prepare(`
        INSERT INTO players (telegram_id,kingdom_name,ruler_name)
        VALUES (?,?,?)
      `).run(id,kingdom,ruler);
      player=getPlayer(id);
    }

    res.json(publicUser(player));
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.post('/api/build',(req,res)=>{
  try{
    const id=getUserId(req);
    const type=String(req.body.type||'');
    if(!BUILDINGS[type])
      return res.status(400).json({error:'Невідома будівля'});

    const player=currentPlayer(id);
    if(!player)
      return res.status(400).json({error:'Спочатку створи королівство'});

    if(player.building_type && player.building_ends_at)
      return res.status(400).json({error:'Зараз уже будується інша будівля'});

    const cost=BUILDING_COSTS[type];

    for(const [resource,amount] of Object.entries(cost)){
      if((player[resource]||0)<amount)
        return res.status(400).json({
          error:`Недостатньо ресурсу: ${resource}. Потрібно ${amount}, є ${player[resource]||0}`
        });
    }

    const fields=[];
    const values=[];

    for(const [resource,amount] of Object.entries(cost)){
      fields.push(`${resource}=?`);
      values.push((player[resource]||0)-amount);
    }

    fields.push('building_type=?','building_ends_at=?');
    values.push(type,Math.floor(Date.now()/1000)+BUILDINGS[type].seconds,id);

    db.prepare(`UPDATE players SET ${fields.join(',')} WHERE telegram_id=?`)
      .run(...values);

    res.json(publicUser(currentPlayer(id)));
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

app.get('*',(req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`ROK v0.3.1 SQLite server on ${PORT}`));
