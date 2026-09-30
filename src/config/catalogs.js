// Game catalogs and balance constants for Realm of Kings.
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
const MARKET = {wood:4,stone:5,iron:12,straw:3,brick:10,clay:6,sand:3,wheat:8,bread:15,meat:20,carrot:6,potato:6,apples:7,milk:8,eggs:7,copper:10,coal:4,silver:35,gold_ore:45,salt:5,gemstones:80,planks:8,glass:14,metal:20,copper_bars:18,tools:25,flour:10};

module.exports = { BUILDINGS, BUILDING_COSTS, UPGRADES, TROOPS, MARKET };
