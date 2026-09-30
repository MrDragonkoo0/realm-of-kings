'use strict';
const groups = {
 'Видобуток': [['logging_camp','Лісорубний табір'],['stone_quarry','Каменоломня'],['iron_mine','Залізна шахта'],['copper_mine','Мідна шахта'],['coal_mine','Вугільна шахта'],['clay_pit','Глиняний кар’єр'],['sand_pit','Піщаний кар’єр'],['silver_mine','Срібна шахта'],['gold_mine','Золота шахта'],['salt_mine','Соляна шахта'],['gem_mine','Рудник самоцвітів'],['sulfur_mine','Сірчана шахта']],
 'Сільське господарство': [['wheat_farm','Пшенична ферма'],['vegetable_farm','Овочева ферма'],['potato_field','Картопляне поле'],['orchard','Фруктовий сад'],['vineyard','Виноградник'],['apiary','Пасіка'],['cattle_farm','Скотарня'],['sheep_farm','Вівчарня'],['pig_farm','Свинарник'],['chicken_coop','Курник'],['dairy','Молочарня'],['mill','Млин']],
 'Ремесло й промисловість': [['sawmill','Лісопилка'],['smelter','Плавильня'],['blacksmith','Кузня'],['carpenter','Столярня'],['brickworks','Цегельня'],['glassworks','Склоробня'],['weaving_mill','Ткацька майстерня'],['tannery','Шкіряна майстерня'],['pottery','Гончарня'],['bakery','Пекарня'],['brewery','Броварня'],['toolmaker','Майстерня інструментів'],['jeweler','Ювелірна майстерня'],['shipyard','Верф']],
 'Економіка й торгівля': [['market','Ринок'],['trading_post','Торговий двір'],['merchant_guild','Гільдія купців'],['bank','Банк'],['caravanserai','Караван-сарай'],['customs_house','Митниця'],['auction_house','Аукціонний дім'],['warehouse','Склад'],['granary','Зерносховище'],['treasury','Скарбниця']],
 'Житло й управління': [['cottage','Хатина'],['house','Будинок'],['manor','Садиба'],['tenement','Міський будинок'],['town_hall','Ратуша'],['council_hall','Зала ради'],['courthouse','Суд'],['archive','Архів'],['school','Школа'],['university','Університет']],
 'Військо': [['barracks','Казарми'],['archery_range','Стрільбище'],['stables','Конюшні'],['knight_hall','Зала лицарів'],['armory','Арсенал'],['siege_workshop','Облогова майстерня'],['training_yard','Поле вишколу'],['watch_post','Вартовий пост'],['military_academy','Військова академія'],['commandery','Командування']],
 'Оборона': [['wooden_palisade','Дерев’яний частокіл'],['stone_wall','Кам’яна стіна'],['reinforced_wall','Посилена стіна'],['main_gate','Головна брама'],['iron_gate','Залізна брама'],['watchtower','Сторожова вежа'],['archer_tower','Лучна вежа'],['bastion','Бастіон']],
 'Релігія й культура': [['chapel','Каплиця'],['church','Церква'],['monastery','Монастир'],['cathedral','Собор'],['shrine','Святилище'],['theatre','Театр'],['library','Бібліотека'],['festival_square','Святкова площа']],
 'Інфраструктура': [['well','Криниця'],['road','Брукована дорога'],['bridge','Міст'],['stable_yard','Кінний двір'],['hospital','Лікарня'],['bathhouse','Лазня'],['fire_station','Пожежна варта'],['sewer','Каналізація'],['port','Порт']],
 'Королівські й особливі': [['castle','Замок'],['royal_palace','Королівський палац'],['keep','Цитадель'],['royal_garden','Королівський сад'],['mint','Монетний двір'],['heraldry_house','Геральдична палата'],['royal_guard','Королівська варта']]
};
// Costs and construction times vary by building/category; upgrades use a separate formula.
const categoryBase = {
 'Видобуток': {wood:35,stone:20,iron:0,gold:25,minutes:8},
 'Сільське господарство': {wood:30,stone:10,iron:0,gold:20,minutes:6},
 'Ремесло й промисловість': {wood:45,stone:35,iron:8,gold:45,minutes:15},
 'Економіка й торгівля': {wood:50,stone:45,iron:5,gold:65,minutes:18},
 'Житло й управління': {wood:40,stone:35,iron:0,gold:40,minutes:12},
 'Військо': {wood:55,stone:45,iron:15,gold:70,minutes:20},
 'Оборона': {wood:45,stone:65,iron:10,gold:55,minutes:22},
 'Релігія й культура': {wood:45,stone:60,iron:0,gold:80,minutes:25},
 'Інфраструктура': {wood:40,stone:50,iron:5,gold:50,minutes:16},
 'Королівські й особливі': {wood:90,stone:100,iron:25,gold:180,minutes:45}
};
const BUILDING_CATALOG = Object.entries(groups).flatMap(([category, items], groupIndex)=>items.map(([key,name], i)=>{
 const b=categoryBase[category]; const factor=1+(i%4)*0.18+(groupIndex%3)*0.12;
 const cost={}; for(const r of ['wood','stone','iron','gold']) cost[r]=Math.ceil(b[r]*factor);
 // A few basic buildings are cheaper so new kingdoms can develop gradually.
 if(key==='logging_camp'){cost.wood=15;cost.stone=0;cost.iron=0;cost.gold=10;}
 if(key==='stone_quarry'){cost.wood=20;cost.stone=5;cost.iron=0;cost.gold=10;}
 return {key,name,category,baseCost:cost,baseSeconds:Math.round(b.minutes*60*(1+(i%5)*0.16))};
})).slice(0,100);
module.exports={BUILDING_CATALOG, BUILDING_GROUPS:groups};
