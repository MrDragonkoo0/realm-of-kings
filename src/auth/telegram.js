const crypto = require('crypto');

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

module.exports = { verifyTelegram, getUserId };
