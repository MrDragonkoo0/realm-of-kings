const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

let state = null;
let pollTimer = null;

async function api(url, options={}) {
    const headers = {'Content-Type':'application/json', ...(options.headers||{})};
    const initData = tg?.initData || '';
    headers['X-Telegram-Init-Data'] = initData;
    const res = await fetch(url, {...options, headers});
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || 'Помилка сервера');
    return data;
}

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

async function boot(){
    if (!tg || !tg.initData) {
        document.getElementById('game').innerHTML='<div class="error">📱 Відкрий ROK саме через Telegram Mini App.</div>';
        return;
    }
    try {
        state = await api('/api/state');
        if (state.registered) showKingdom();
        else showRegistration();
    } catch(e) {
        document.getElementById('game').innerHTML=`<div class="error">❌ ${esc(e.message)}</div>`;
    }
}

function showRegistration(){
    document.getElementById('registration').style.display='block';
    document.getElementById('game').style.display='none';
}
function nextStep(){
    if(!document.getElementById('kingdomName').value.trim()){alert('Введи назву королівства!');return;}
    document.getElementById('step1').style.display='none';
    document.getElementById('step2').style.display='block';
}
async function createKingdom(){
    const kingdom=document.getElementById('kingdomName').value.trim();
    const ruler=document.getElementById('rulerName').value.trim();
    if(!ruler){alert('Введи імʼя правителя!');return;}
    try{
        state=await api('/api/register',{method:'POST',body:JSON.stringify({kingdom,ruler})});
        document.getElementById('registration').style.display='none';
        document.getElementById('game').style.display='block';
        showKingdom();
    }catch(e){alert(e.message);}
}

function showKingdom(){
    const s=state;
    const b=s.building;
    document.getElementById('game').innerHTML=`
    <h1>🏰 МОЄ КОРОЛІВСТВО 🏰</h1>
    <div class="kingdom">
      <h2>🏰 ${esc(s.kingdom)}</h2><p>👑 ${esc(s.ruler)}</p>
      <div class="level"><span>📈 Рівень ${s.level}</span><span>${s.xp} / 100 XP</span></div>
      <div class="xp"><div class="xp-fill" style="width:${Math.min(s.xp,100)}%"></div></div>
    </div>
    <div class="stats">
      <div>👥<br><b>${s.population}</b></div><div>💰<br><b>${s.gold}</b></div><div>⚔️<br><b>${s.militaryPower}</b></div>
      <div>🏘️<br><b>${s.cities}</b></div><div>🏠<br><b>${s.houses}</b></div><div>💎<br><b>${s.gems}</b></div>
    </div>
    ${b?`<p>🔨 Будується: ${esc(b.name)} — ⏱️ ${formatTime(b.remaining)}</p>`:''}
    <div class="menu">
      <button onclick="showCities()">🏘️ МІСТА</button><button onclick="showVillages()">🏠 СЕЛА</button>
      <button onclick="showArmy()">⚔️ ВІЙСЬКА</button><button onclick="showTreasury()">💰 КАЗНА</button>
      <button onclick="showPopulation()">👥 ЛЮДИ</button><button onclick="showWarehouse()">📦 СКЛАД</button>
    </div>`;
}

function showCities(){document.getElementById('game').innerHTML=`<h1>🏘️ Міста</h1><div class="menu"><button onclick="showCapital()">🏰 Столиця</button><button>🏘️ Нове місто</button><button onclick="showKingdom()">⬅️ Назад</button></div>`;}
function showCapital(){document.getElementById('game').innerHTML=`<h1>🏰 Столиця</h1><p>👥 Населення: ${state.population}</p><p>🏛️ Ратуша I рівень</p><p>🏦 Казна I рівень</p><p>📦 Склад I рівень</p><p>🏪 Ринок I рівень</p><p>🏰 Стіни I рівень</p><p>🚪 Ворота I рівень</p><p>🏠 Будинки: ${state.houses}</p><div class="menu"><button onclick="showConstruction()">🔨 БУДІВНИЦТВО</button><button onclick="showCities()">⬅️ НАЗАД</button></div>`;}

const buildings={
house:{title:'🏠 Будинки',cost:{wood:15,stone:10,brick:10},labels:['🪵 Дерево: 15','🪨 Камінь: 10','🧱 Цегла: 10'],time:300,label:'5 хв'},
smithy:{title:'⚒️ Кузня',cost:{wood:10,stone:15,iron:5,clay:5},labels:['🪵 Дерево: 10','🪨 Камінь: 15','⛓️ Залізо: 5','🏺 Глина: 5'],time:1200,label:'20 хв'},
farm:{title:'🌾 Ферма',cost:{wood:5,stone:10,straw:25},labels:['🪵 Дерево: 5','🪨 Камінь: 10','🌾 Солома: 25'],time:900,label:'15 хв'},
stable:{title:'🐴 Конюшня',cost:{wood:30,stone:50,straw:25,iron:10,clay:10,brick:20},labels:['🪵 Дерево: 30','🪨 Камінь: 50','🌾 Солома: 25','⛓️ Залізо: 10','🏺 Глина: 10','🧱 Цегла: 20'],time:2400,label:'40 хв'},
barracks:{title:'🛡️ Казарми',cost:{wood:25,stone:30,iron:15},labels:['🪵 Дерево: 25','🪨 Камінь: 30','⛓️ Залізо: 15'],time:1800,label:'30 хв'},
range:{title:'🏹 Стрільбище',cost:{wood:20,stone:20,iron:10},labels:['🪵 Дерево: 20','🪨 Камінь: 20','⛓️ Залізо: 10'],time:1500,label:'25 хв'},
temple:{title:'⛪ Храм',cost:{wood:20,stone:35,brick:20},labels:['🪵 Дерево: 20','🪨 Камінь: 35','🧱 Цегла: 20'],time:2100,label:'35 хв'},
bakery:{title:'🍞 Пекарня',cost:{wood:15,stone:15,brick:15,clay:5},labels:['🪵 Дерево: 15','🪨 Камінь: 15','🧱 Цегла: 15','🏺 Глина: 5'],time:1200,label:'20 хв'},
workshop:{title:'🧵 Майстерня',cost:{wood:20,stone:15,iron:10},labels:['🪵 Дерево: 20','🪨 Камінь: 15','⛓️ Залізо: 10'],time:1500,label:'25 хв'},
hospital:{title:'🏥 Лікарня',cost:{wood:25,stone:30,brick:20},labels:['🪵 Дерево: 25','🪨 Камінь: 30','🧱 Цегла: 20'],time:2400,label:'40 хв'}
};

function showConstruction(){
 let h='<h1>🔨 Будівництво</h1><div class="menu">';
 for(const [id,b] of Object.entries(buildings)){
   const timer=state.building?.type===id?` ⏱️ ${formatTime(state.building.remaining)}`:'';
   h+=`<button onclick="showBuilding('${id}')">${b.title}${timer}</button>`;
 }
 h+=`<button onclick="showCapital()">⬅️ НАЗАД</button></div>`;
 document.getElementById('game').innerHTML=h;
}

function showBuilding(id){
 const b=buildings[id];
 const resources=state.resources;
 const costText=b.labels.map((label,i)=>{
   const keys=Object.keys(b.cost);
   const key=keys[i];
   return `<p>${label} — є: ${resources[key] ?? 0}</p>`;
 }).join('');
 const busy=!!state.building;
 document.getElementById('game').innerHTML=`
   <h1>${b.title}</h1>
   ${costText}
   <hr>
   <p>⏱️ Час будівництва: ${b.label}</p>
   <div class="menu">
     <button ${busy?'disabled':''} onclick="startBuilding('${id}')">🔨 ПОБУДУВАТИ</button>
     <button onclick="showConstruction()">⬅️ НАЗАД</button>
   </div>`;
}

async function startBuilding(type){
 try{
   state=await api('/api/build',{method:'POST',body:JSON.stringify({type})});
   showConstruction();
   startPolling();
 }catch(e){alert(e.message);}
}

function formatTime(sec){sec=Math.max(0,Math.floor(sec));const m=Math.floor(sec/60),s=sec%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}

async function refresh(){
 try{
   state=await api('/api/state');
   const active=document.querySelector('#game h1')?.textContent;
   if(active==='🔨 Будівництво') showConstruction();
   else if(active==='🏰 МОЄ КОРОЛІВСТВО 🏰') showKingdom();
   if(!state.building && pollTimer){clearInterval(pollTimer);pollTimer=null;}
 }catch(e){}
}
function startPolling(){if(pollTimer)return;pollTimer=setInterval(refresh,1000);}

function showWarehouse(){
 document.getElementById('game').innerHTML=`
 <h1>📦 Склад</h1>
 <h2>🏗️ Ресурси</h2>
 <p>🪨 Камінь: ${state.resources.stone}</p>
 <p>🪵 Дерево: ${state.resources.wood}</p>
 <p>⛓️ Залізо: ${state.resources.iron}</p>
 <p>🌾 Солома: ${state.resources.straw}</p>
 <p>🧱 Цегла: ${state.resources.brick}</p>
 <p>🏺 Глина: ${state.resources.clay}</p>
 <p>🏖️ Пісок: ${state.resources.sand}</p>
 <hr>
 <h2>🍎 Їжа</h2>
 <p>🍞 Хліб: ${state.resources.bread}</p>
 <p>🥩 М'ясо: ${state.resources.meat}</p>
 <p>🌾 Борошно: ${state.resources.flour}</p>
 <p>🥕 Морква: ${state.resources.carrot}</p>
 <p>🥔 Картопля: ${state.resources.potato}</p>
 <p>💧 Вода: ${state.resources.water}</p>
 <p>🍎 Яблука: ${state.resources.apples}</p>
 <button onclick="showKingdom()">⬅️ Назад</button>`;
}

function showArmy(){document.getElementById('game').innerHTML=`<h1>⚔️ Армія</h1><p>🗡️ Мечники: ${state.army.swordsmen}</p><p>🏹 Лучники: ${state.army.archers}</p><p>🛡️ Щитоносці: ${state.army.shieldmen}</p><p>🐎 Легка кіннота: ${state.army.cavalry}</p><p>🛡️ Лицарі: ${state.army.knights}</p><hr><p>💪 Військова сила: ${state.militaryPower}</p><button onclick="showKingdom()">⬅️ Назад</button>`;}
function showVillages(){document.getElementById('game').innerHTML=`<h1>🏠 Села</h1><p>🏠 Сіл: ${state.villages}</p><button onclick="showKingdom()">⬅️ Назад</button>`;}
function showTreasury(){document.getElementById('game').innerHTML=`<h1>💰 Казна</h1><p>💰 Золото: ${state.gold}</p><button onclick="showKingdom()">⬅️ Назад</button>`;}
function showPopulation(){document.getElementById('game').innerHTML=`<h1>👥 Населення</h1><p>👥 Населення: ${state.population}</p><button onclick="showKingdom()">⬅️ Назад</button>`;}

boot();
