const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized:false } : false });

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
  if(!initData || !process.env.BOT_TOKEN) throw new Error('Telegram авторизація не налаштована');
  const p=new URLSearchParams(initData);
  const hash=p.get('hash'); if(!hash) throw new Error('Немає Telegram hash');
  p.delete('hash');
  const dataCheck=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();
  const expected=crypto.createHmac('sha256',secret).update(dataCheck).digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(expected))) throw new Error('Невірна Telegram авторизація');
  const user=JSON.parse(p.get('user')||'{}');
  if(!user.id) throw new Error('Не знайдено Telegram ID');
  return user;
}

function userId(req){return verifyTelegram(req.headers['x-telegram-init-data']).id;}

function publicUser(r){
  const building=r.building_type ? {
    type:r.building_type,
    name:BUILDINGS[r.building_type]?.name || r.building_type,
    remaining:Math.max(0,Math.ceil((new Date(r.building_ends_at).getTime()-Date.now())/1000))
  } : null;
  return {
    registered:!!r.kingdom_name,
    kingdom:r.kingdom_name||'', ruler:r.ruler_name||'', level:r.level, xp:r.xp,
    population:r.population, gold:r.gold, gems:r.gems, cities:r.cities,
    villages:r.villages, houses:r.houses, militaryPower:r.military_power,
    resources:{stone:r.stone,wood:r.wood,iron:r.iron,straw:r.straw,brick:r.brick,clay:r.clay,sand:r.sand,bread:r.bread,meat:r.meat,flour:r.flour,carrot:r.carrot,potato:r.potato,water:r.water,apples:r.apples},
    army:{swordsmen:r.swordsmen,archers:r.archers,shieldmen:r.shieldmen,cavalry:r.cavalry,knights:r.knights},
    building
  };
}

app.get('/api/me', async (req,res)=>{
  try{
    const id=userId(req);
    const q=await pool.query('SELECT * FROM players WHERE telegram_id=$1',[id]);
    if(!q.rows[0]) return res.json({registered:false});
    res.json(publicUser(q.rows[0]));
  }catch(e){res.status(401).json({error:e.message});}
});

app.post('/api/register', async (req,res)=>{
  try{
    const id=userId(req);
    const kingdom=String(req.body.kingdom||'').trim();
    const ruler=String(req.body.ruler||'').trim();
    if(!kingdom || !ruler) return res.status(400).json({error:'Заповни обидва поля'});
    if(kingdom.length>32 || ruler.length>32) return res.status(400).json({error:'Максимум 32 символи'});
    const exists=await pool.query('SELECT * FROM players WHERE telegram_id=$1',[id]);
    if(exists.rows[0]) return res.json(publicUser(exists.rows[0]));
    const q=await pool.query(`INSERT INTO players
      (telegram_id,kingdom_name,ruler_name) VALUES ($1,$2,$3) RETURNING *`,
      [id,kingdom,ruler]);
    res.json(publicUser(q.rows[0]));
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/build', async (req,res)=>{
  const client=await pool.connect();
  try{
    const id=userId(req);
    const type=String(req.body.type||'');
    if(!BUILDINGS[type]) return res.status(400).json({error:'Невідома будівля'});
    await client.query('BEGIN');
    const q=await client.query('SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE',[id]);
    const r=q.rows[0];
    if(!r) throw new Error('Спочатку створи королівство');
    if(r.building_type) {
      const remaining=Math.ceil((new Date(r.building_ends_at).getTime()-Date.now())/1000);
      if(remaining>0) throw new Error('Зараз уже будується інша будівля');
      await client.query('UPDATE players SET building_type=NULL,building_ends_at=NULL WHERE telegram_id=$1',[id]);
    }
    const ends=new Date(Date.now()+BUILDINGS[type].seconds*1000);
    await client.query('UPDATE players SET building_type=$1,building_ends_at=$2 WHERE telegram_id=$3',[type,ends,id]);
    await client.query('COMMIT');
    const fresh=await pool.query('SELECT * FROM players WHERE telegram_id=$1',[id]);
    res.json(publicUser(fresh.rows[0]));
  }catch(e){
    await client.query('ROLLBACK').catch(()=>{});
    res.status(400).json({error:e.message});
  }finally{client.release();}
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`ROK v0.2 server on ${PORT}`));
