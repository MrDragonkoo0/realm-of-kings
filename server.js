const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Railway Volume: set DB_PATH=/data/rok.db
const dbPath = process.env.DB_PATH || path.join(__dirname, 'rok.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

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
  house:{name:'🏠 Будинки',seconds:300},
  smithy:{name:'⚒️ Кузня',seconds:1200},
  farm:{name:'🌾 Ферма',seconds:900},
  stable:{name:'🐴 Конюшня',seconds:2400},
  barracks:{name:'🛡️ Казарми',seconds:1800},
  range:{name:'🏹 Стрільбище',seconds:1500},
  temple:{name:'⛪ Храм',seconds:2100},
  bakery:{name:'🍞 Пекарня',seconds:1200},
  workshop:{name:'🧵 Майстерня',seconds:1500},
  hospital:{name:'🏥 Лікарня',seconds:2400}
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

  const secret=crypto
    .createHmac('sha256','WebAppData')
    .update(process.env.BOT_TOKEN)
    .digest();

  const expected=crypto
    .createHmac('sha256',secret)
    .update(dataCheck)
    .digest('hex');

  if(hash.length !== expected.length ||
     !crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(expected)))
    throw new Error('Невірна Telegram авторизація');

  const user=JSON.parse(p.get('user')||'{}');
  if(!user.id) throw new Error('Не знайдено Telegram ID');

  return user;
}

function getUserId(req){
  return verifyTelegram(req.headers['x-telegram-init-data']).id;
}

function publicUser(r){
  const remaining = r.building_type && r.building_ends_at
    ? Math.max(0, Math.ceil((r.building_ends_at * 1000 - Date.now()) / 1000))
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

function getPlayer(id){
  return db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
}

app.get('/api/me',(req,res)=>{
  try{
    const id=getUserId(req);
    const player=getPlayer(id);
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
        INSERT INTO players (telegram_id, kingdom_name, ruler_name)
        VALUES (?, ?, ?)
      `).run(id, kingdom, ruler);

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

    const player=getPlayer(id);
    if(!player)
      return res.status(400).json({error:'Спочатку створи королівство'});

    // One construction at a time.
    if(player.building_type && player.building_ends_at){
      const remaining=Math.ceil((player.building_ends_at*1000-Date.now())/1000);

      if(remaining>0)
        return res.status(400).json({error:'Зараз уже будується інша будівля'});

      db.prepare(`
        UPDATE players
        SET building_type=NULL, building_ends_at=NULL
        WHERE telegram_id=?
      `).run(id);
    }

    const endsAt=Math.floor(Date.now()/1000)+BUILDINGS[type].seconds;

    db.prepare(`
      UPDATE players
      SET building_type=?, building_ends_at=?
      WHERE telegram_id=?
    `).run(type, endsAt, id);

    res.json(publicUser(getPlayer(id)));
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

// Finish completed construction when the player requests data.
// The end time itself is stored in SQLite, so restart/redeploy does not reset it.
function settleConstruction(player){
  if(!player || !player.building_type || !player.building_ends_at)
    return player;

  if(player.building_ends_at > Math.floor(Date.now()/1000))
    return player;

  const type=player.building_type;

  const tx=db.transaction(()=>{
    const changes={building_type:null,building_ends_at:null};

    if(type==='house'){
      db.prepare(`
        UPDATE players
        SET houses=houses+1, building_type=NULL, building_ends_at=NULL
        WHERE telegram_id=?
      `).run(player.telegram_id);
    }else{
      db.prepare(`
        UPDATE players
        SET building_type=NULL, building_ends_at=NULL
        WHERE telegram_id=?
      `).run(player.telegram_id);
    }
  });

  tx();
  return getPlayer(player.telegram_id);
}

const oldGetPlayer=getPlayer;
function getCurrentPlayer(id){
  return settleConstruction(oldGetPlayer(id));
}

app.get('/api/state',(req,res)=>{
  try{
    const id=getUserId(req);
    const player=getCurrentPlayer(id);
    if(!player) return res.json({registered:false});
    res.json(publicUser(player));
  }catch(e){
    res.status(401).json({error:e.message});
  }
});

app.get('*',(req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`ROK v0.2 SQLite server on ${PORT}`));
