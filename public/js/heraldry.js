// ROK heraldry: flag editor, coats of arms, and emblem rendering.
// ROK v0.7 — illustrated herald assets with vector fallback for the remaining emblems.
const FLAG_SHAPES=[['rectangle','Прямокутний'],['swallowtail','Роздвоєний'],['triangle','Трикутний'],['vertical','Вертикальний'],['shield','Щитоподібний']];
const FLAG_COLORS=[['#b91c1c','Червоний'],['#1d4ed8','Синій'],['#047857','Зелений'],['#111827','Чорний'],['#f8fafc','Білий'],['#d4af37','Золотий'],['#7e22ce','Фіолетовий'],['#c2410c','Помаранчевий'],['#0f766e','Бірюзовий'],['#4d7c0f','Оливковий'],['#7f1d1d','Бордовий'],['#334155','Сланцевий']];
const FLAG_EMBLEMS=[
 ['sun','Сонце','☼'],['castle','Замок','♜'],['rose','Троянда','✿'],['moon','Місяць і зоря','☾'],['tower','Вежа','▥'],
 ['double_crown','Подвійна корона','♛'],['throne','Королівський трон','♜'],['fleurdelis','Геральдична лілія','⚜'],['heraldic_cross','Геральдичний хрест','✚'],
 ['sceptre','Королівський скіпетр','♜'],['crown','Корона','♛'],['spear','Спис','↑'],['sword','Меч','†'],['shield','Щит','◇'],['helmet','Шолом лицаря','♙'],
 ['axe','Бойова сокира','†'],['griffin','Грифон','G'],['fox','Лисиця','F'],['snake','Змія','S'],['horse','Кінь','♘'],['bear','Ведмідь','B'],
 ['stag','Олень','♞'],['wolf','Вовк','W'],['dragon','Дракон','D'],['lion','Лев','♌'],['eagle','Орел','A'],
 ['cross','Хрест','✚'],['oak','Дуб','♣'],['crossed_swords','Схрещені мечі','⚔']
];
const HERALD_ALIASES={
 crest_01:'sun',crest_02:'eagle',crest_03:'dragon',crest_04:'crown',crest_05:'wolf',crest_06:'stag',crest_07:'bear',crest_08:'horse',crest_09:'snake',crest_10:'fox',crest_11:'griffin',crest_12:'crossed_swords',crest_13:'axe',crest_14:'helmet',crest_15:'spear',crest_16:'sword',crest_17:'shield',crest_18:'spear',crest_19:'sceptre',crest_20:'heraldic_cross',crest_21:'fleurdelis',crest_22:'throne',crest_23:'double_crown',crest_24:'tower',crest_25:'moon',crest_26:'rose',crest_27:'castle',crest_28:'sun',crest_29:'oak',
 royal_shield_01:'sceptre',royal_shield_02:'heraldic_cross',royal_shield_03:'shield',royal_shield_04:'double_crown',royal_shield_05:'lion',royal_shield_06:'moon',royal_shield_07:'crown',royal_shield_08:'castle',royal_shield_09:'oak',royal_shield_10:'throne',royal_shield_11:'spear',royal_shield_12:'rose',royal_shield_13:'spear',royal_shield_14:'sun',royal_shield_15:'fleurdelis',
 griffin:'griffin',bow:'spear',crossed_swords:'crossed_swords',sword:'sword',shield:'shield',fleurdelis:'fleurdelis',double_crown:'double_crown',sceptre:'sceptre',stag:'stag',lion:'lion',eagle:'eagle',dragon:'dragon',wolf:'wolf',bear:'bear',horse:'horse',snake:'snake',fox:'fox',axe:'axe',helmet:'helmet',crown:'crown',throne:'throne',tower:'tower',moon:'moon',rose:'rose',castle:'castle',sun:'sun',oak:'oak',spear:'spear',cross:'cross',heraldic_cross:'heraldic_cross'
};
const FLAG_BORDERS=[['gold','Золота'],['silver','Срібна'],['black','Чорна'],['none','Без рамки']];
const FLAG_PATTERNS=[['plain','Однотонний'],['diagonal','Діагоналі'],['quartered','Поділ на 4'],['stripe','Смуги'],['cross','Хрест']];
const FLAG_IMAGE_EMBLEMS=new Set(FLAG_EMBLEMS.map(x=>x[0]));
 function emblemImage(id,mini=false){const canonical=HERALD_ALIASES[id]||id;return FLAG_IMAGE_EMBLEMS.has(canonical)?`<img class="emblem-image ${mini?'mini':''}" src="/heralds/${canonical}.png" alt="" loading="lazy">`:null}
 let flagDraft=null;
function defaultFlag(){return {shape:'swallowtail',color:'#b91c1c',secondary:'#d4af37',emblem:'lion',border:'gold',pattern:'plain'}}
function currentFlag(){const f={...defaultFlag(),...(state?.flag||{})};f.emblem=HERALD_ALIASES[f.emblem]||f.emblem;return f}
function emblemSvg(id,color){
 const start=`<svg class="emblem-svg" viewBox="0 0 100 100" role="img" aria-hidden="true" style="color:${color}">`;
 const end='</svg>';
 const common=' fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
 const shapes={
 lion:'<path d="M23 35 15 22 32 25 40 13 51 24 66 17 66 32 80 38 72 49 80 61 64 63 59 80 47 70 34 82 31 65 17 61 25 49Z"/><path d="M37 39 Q48 28 59 39 L56 55 45 61 35 53Z" fill="#6b4423"/><path d="M43 43l4 3 4-3M43 51l6 3 5-3" fill="none" stroke="#6b4423" stroke-width="3"/>',
 eagle:'<path d="M50 23 45 35 50 44 55 35Z"/><path d="M45 35 8 19 20 43 9 48 33 58 17 66 43 66 50 55 57 66 83 66 67 58 91 48 80 43 92 19 55 35Z"/><path d="M46 57 38 83 50 75 62 83 54 57Z"/>',
 dragon:'<path d="M20 70 Q7 54 22 42 L39 43 49 30 63 34 76 24 72 42 89 49 72 58 66 76 54 69 47 84 39 67 26 80Z"/><path d="M40 43 27 24 48 32 61 15 65 35M65 47l12 1" fill="none" stroke-width="5"/>',
 crown:'<path d="M15 73 9 35 31 51 49 20 68 51 91 34 84 73Z"/><rect x="16" y="78" width="68" height="8" rx="2"/>',
 wolf:'<path d="M18 22 39 34 50 27 61 34 82 22 76 52 64 68 50 82 36 68 24 52Z"/><path d="M31 47 43 50M57 50 69 47M44 64 50 68 56 64" fill="none" stroke-width="4"/>',
 stag:'<path d="M39 39 33 52 38 76 50 83 62 76 67 52 61 39Z"/><path d="M39 43 26 30 23 15 16 11M27 31 13 29 8 20M61 43 74 30 77 15 84 11M73 31 87 29 92 20" fill="none" stroke-width="5"/>',
 bear:'<circle cx="31" cy="30" r="11"/><circle cx="69" cy="30" r="11"/><path d="M22 37 Q18 20 39 20 L61 20 Q82 20 78 37 L75 66 Q68 84 50 84 Q32 84 25 66Z"/><ellipse cx="50" cy="52" rx="17" ry="13" fill="#6b4423"/><circle cx="43" cy="49" r="2" fill="#fff"/><circle cx="57" cy="49" r="2" fill="#fff"/>',
 horse:'<path d="M26 83 30 55 21 37 27 16 44 28 57 27 73 42 70 58 59 62 53 83 44 83 44 58 37 57 36 83Z"/><path d="M28 19 18 10 21 30M60 31 72 24 82 35" fill="none" stroke-width="4"/>',
 snake:'<path d="M25 79 Q7 67 22 54 Q37 41 53 55 Q69 68 79 51 Q88 36 68 29 Q51 23 44 39 Q38 51 51 53 Q61 54 62 44" fill="none" stroke-width="12"/><path d="M63 23 78 24 85 33 73 39 65 33Z"/><circle cx="76" cy="29" r="2" fill="#111"/>',
 fox:'<path d="M20 18 43 31 57 31 80 18 74 54 63 72 50 84 37 72 26 54Z"/><path d="M32 49 43 53M57 53 68 49M43 66 50 71 57 66" fill="none" stroke-width="4"/>',
 griffin:'<path d="M50 20 42 37 27 28 8 17 18 43 8 57 31 55 39 70 50 62 61 70 69 55 92 57 82 43 92 17 73 28 58 37Z"/><path d="M40 39 50 31 60 39 56 55 44 55Z"/><path d="M45 48h2m7 0h2" stroke="#111" stroke-width="4"/>',
 crossed_swords:'<path d="M19 13 31 10 77 76 69 84Z"/><path d="M81 13 69 10 23 76 31 84Z"/><path d="M15 25 35 20M65 20 85 25" fill="none" stroke-width="6"/>',
 axe:'<path d="M48 20 55 23 43 85 36 84Z"/><path d="M49 19 Q68 8 83 25 L75 46 51 43Z"/>',
 helmet:'<path d="M19 53 Q15 20 50 15 Q85 20 81 53 L70 63 30 63Z"/><path d="M50 16 50 60M24 48 76 48M32 64 68 64 62 82 38 82Z" fill="none" stroke-width="5"/>',
 bow:'<path d="M27 13 Q84 50 27 87" fill="none" stroke-width="7"/><path d="M28 13 70 50 28 87M62 43 77 50 62 57" fill="none" stroke-width="3"/>',
 sword:'<path d="M50 8 61 61 50 73 39 61Z"/><path d="M31 61 69 61M50 72 50 91M40 89 60 89" fill="none" stroke-width="6"/>',
 shield:'<path d="M17 17 50 8 83 17 79 58 Q69 79 50 91 Q31 79 21 58Z"/><path d="M50 12V84M23 43H77" fill="none" stroke-width="4"/>',
 spear:'<path d="M50 8 67 35 54 34 54 89 46 89 46 34 33 35Z"/><path d="M34 45 66 45" fill="none" stroke-width="4"/>',
 sceptre:'<path d="M46 35 54 35 57 87 43 87Z"/><circle cx="50" cy="22" r="13"/><path d="M37 23 28 14 34 34M63 23 72 14 66 34" fill="none" stroke-width="4"/>',
 cross:'<path d="M40 10H60V38H86V58H60V88H40V58H14V38H40Z"/>',
 fleurdelis:'<path d="M50 12 Q29 30 43 43 Q23 42 25 61 Q38 67 48 54 L45 83 55 83 52 54 Q62 67 75 61 Q77 42 57 43 Q71 30 50 12Z"/><path d="M30 87H70" fill="none" stroke-width="5"/>',
 throne:'<path d="M22 15H78V47H68V35H32V47H22Z"/><rect x="29" y="48" width="42" height="10"/><path d="M33 58 28 86M67 58 72 86M20 87H80" fill="none" stroke-width="6"/>',
 double_crown:'<path d="M8 48 5 27 19 37 30 17 41 37 50 29 47 50Z M53 50 50 29 61 37 72 17 83 37 95 27 92 50Z"/><rect x="10" y="53" width="35" height="6"/><rect x="55" y="53" width="35" height="6"/>',
 tower:'<path d="M25 85V29H75V85Z"/><path d="M18 29 32 12 42 29 50 12 58 29 68 12 82 29Z"/><rect x="42" y="58" width="16" height="27" fill="#6b4423"/><rect x="34" y="39" width="8" height="12" fill="#6b4423"/><rect x="58" y="39" width="8" height="12" fill="#6b4423"/>',
 moon:'<path d="M70 13 Q34 16 29 48 Q24 78 54 87 Q20 92 12 61 Q4 28 35 13 Q54 5 70 13Z"/>',
 rose:'<circle cx="50" cy="42" r="10"/><circle cx="50" cy="25" r="13"/><circle cx="65" cy="36" r="13"/><circle cx="59" cy="53" r="13"/><circle cx="41" cy="53" r="13"/><circle cx="35" cy="36" r="13"/><path d="M50 55V88M50 72 35 63M50 78 65 68" fill="none" stroke-width="5"/>',
 castle:'<path d="M10 84V38H26V25H42V38H58V25H74V38H90V84Z"/><path d="M7 25 14 14 21 25 28 14 35 25M65 25 72 14 79 25 86 14 93 25"/><rect x="42" y="59" width="16" height="25" fill="#6b4423"/><rect x="18" y="49" width="8" height="10" fill="#6b4423"/><rect x="74" y="49" width="8" height="10" fill="#6b4423"/>',
 sun:'<circle cx="50" cy="50" r="20"/><path d="M50 7V22M50 78V93M7 50H22M78 50H93M20 20 31 31M69 69 80 80M80 20 69 31M31 69 20 80" fill="none" stroke-width="7"/>',
 oak:'<path d="M50 11 59 25 76 21 73 38 88 47 75 59 78 73 58 71 50 84 42 71 22 73 25 59 12 47 27 38 24 21 41 25Z"/><path d="M46 67V91M46 78 32 67M53 78 66 66" fill="none" stroke-width="5"/>'
 };
 return start+(shapes[id]||shapes.shield).replaceAll('currentColor',color)+end;
}

function flagMarkup(f,mini=false){f={...defaultFlag(),...(f||{})};f.emblem=HERALD_ALIASES[f.emblem]||f.emblem;const e=FLAG_EMBLEMS.find(x=>x[0]===f.emblem)||FLAG_EMBLEMS[0];const borderColor=f.border==='silver'?'#cbd5e1':f.border==='black'?'#111827':f.border==='none'?'transparent':'#d4af37';const img=emblemImage(e[0],mini);return `<div class="${mini?'flag-mini':'flag-art'} ${esc(f.shape)} border-${esc(f.border)} pattern-${esc(f.pattern)}" style="--flag:${esc(f.color)};--secondary:${esc(f.secondary)};--border:${borderColor}" aria-label="Прапор: ${esc(e[1])}">${img||emblemSvg(e[0],f.secondary)}${mini?'':'<span class="flag-ribbon"></span>'}</div>`}
function optionButtons(items,selected,onClick,kind=''){return `<div class="option-grid">${items.map(x=>`<button class="option-btn ${selected===x[0]?'selected':''}" onclick="${onClick}('${x[0]}')">${kind==='color'?`<span class="color-chip" style="background:${x[0]};${x[0]==='#f8fafc'?'border-color:#888':''}"></span>`:''}${esc(x[1])}</button>`).join('')}</div>`}
function showFlagEditor(){flagDraft={...currentFlag()};renderFlagEditor()}
function setFlag(key,value){flagDraft[key]=value;renderFlagEditor()}
function renderFlagEditor(){
 const f=flagDraft||defaultFlag();
 game.innerHTML=`<h1>🏳️ Редактор прапора</h1><div class="flag-panel"><p>Створи власний герб королівства. Зміни одразу видно в попередньому перегляді.</p><div class="flag-preview-wrap">${flagMarkup(f,false)}</div><p style="text-align:center;color:#e8bd55">${esc(state.kingdom)} · ${esc(FLAG_EMBLEMS.find(x=>x[0]===f.emblem)?.[1]||'Герб')}</p></div>
 <div class="flag-panel"><div class="flag-section-title">1. Форма полотна</div>${optionButtons(FLAG_SHAPES,f.shape,'flagShape')}
 <div class="flag-section-title">2. Основний колір</div>${optionButtons(FLAG_COLORS,f.color,'flagColor','color')}
 <div class="flag-section-title">3. Колір герба та візерунка</div>${optionButtons(FLAG_COLORS,f.secondary,'flagSecondary','color')}
 <div class="flag-section-title">4. Герб — ${FLAG_EMBLEMS.length} символів</div><div class="option-grid">${FLAG_EMBLEMS.map(x=>`<button class="option-btn herald-option ${f.emblem===x[0]?'selected':''}" onclick="setFlag('emblem','${x[0]}')">${emblemImage(x[0])||`<span class="herald-glyph" style="color:${f.secondary}">${esc(x[2])}</span>`}<span>${esc(x[1])}</span></button>`).join('')}</div>
 <div class="flag-section-title">5. Рамка</div>${optionButtons(FLAG_BORDERS,f.border,'flagBorder')}
 <div class="flag-section-title">6. Візерунок полотна</div>${optionButtons(FLAG_PATTERNS,f.pattern,'flagPattern')}
 <button style="width:100%;margin-top:7px" onclick="saveFlag()">💾 Зберегти прапор</button><button style="width:100%;margin-top:7px" onclick="resetFlag()">↺ Скинути налаштування</button><button style="width:100%;margin-top:7px" onclick="showKingdom()">⬅️ Назад без змін</button></div>`;
}
function flagShape(v){setFlag('shape',v)}function flagColor(v){setFlag('color',v)}function flagSecondary(v){setFlag('secondary',v)}function flagBorder(v){setFlag('border',v)}function flagPattern(v){setFlag('pattern',v)}
function resetFlag(){flagDraft=defaultFlag();renderFlagEditor()}
async function saveFlag(){try{state=await api('/api/flag',{method:'POST',body:JSON.stringify({flag:flagDraft})});flagDraft=null;showKingdom();}catch(e){alert('Не вдалося зберегти прапор: '+e.message)}}
