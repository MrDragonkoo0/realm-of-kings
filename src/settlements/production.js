'use strict';

// Base output per hour at level 1. Building levels add 25% per level.
const OUTPUTS = {
  logging_camp:{wood:10}, stone_quarry:{stone:6}, iron_mine:{iron:4}, copper_mine:{copper:3}, coal_mine:{coal:4},
  clay_pit:{clay:5}, sand_pit:{sand:5}, silver_mine:{silver:1}, gold_mine:{gold_ore:1}, salt_mine:{salt:3}, gem_mine:{gemstones:1}, sulfur_mine:{sulfur:2},
  wheat_farm:{wheat:6,food:6}, vegetable_farm:{carrot:4,food:4}, potato_field:{potato:5,food:5}, orchard:{apples:3,food:3}, vineyard:{grapes:3}, apiary:{honey:2},
  cattle_farm:{meat:2,milk:3,food:2}, sheep_farm:{wool:3,meat:1,food:1}, pig_farm:{meat:4,food:4}, chicken_coop:{eggs:4,food:2}, dairy:{milk:5},
  sawmill:{planks:4}, smelter:{metal:3}, brickworks:{brick:4}, glassworks:{glass:3}
};
const RESOURCE_NAMES = {
  wood:'Деревина',stone:'Камінь',iron:'Залізо',copper:'Мідь',coal:'Вугілля',clay:'Глина',sand:'Пісок',silver:'Срібло',gold_ore:'Золота руда',salt:'Сіль',gemstones:'Самоцвіти',sulfur:'Сірка',
  wheat:'Пшениця',carrot:'Морква',potato:'Картопля',apples:'Яблука',grapes:'Виноград',honey:'Мед',wool:'Вовна',meat:'М’ясо',milk:'Молоко',eggs:'Яйця',food:'Харчі',bread:'Хліб',
  planks:'Дошки',metal:'Метал',brick:'Цегла',glass:'Скло'
};
// Each unit of these resources counts as one food ration for consumption.
const FOOD_KEYS = ['food','bread','wheat','carrot','potato','apples','milk','eggs','meat'];
function initProductionSchema(db) {
  const cols = db.prepare('PRAGMA table_info(settlements)').all().map(x=>x.name);
  if (!cols.includes('last_production_at')) db.exec("ALTER TABLE settlements ADD COLUMN last_production_at INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes('food_consumption_remainder')) db.exec('ALTER TABLE settlements ADD COLUMN food_consumption_remainder REAL NOT NULL DEFAULT 0');
  db.exec("UPDATE settlements SET last_production_at=strftime('%s','now') WHERE last_production_at=0");
}
function capacityFor(db, settlementId) {
  const s=db.prepare('SELECT warehouse_capacity FROM settlements WHERE id=?').get(settlementId);
  const level=db.prepare("SELECT COALESCE(SUM(level),0) n FROM settlement_buildings WHERE settlement_id=? AND building_key='warehouse' AND status='built'").get(settlementId).n;
  return Math.floor((s?.warehouse_capacity||1000)*(1+0.5*level));
}
function inventoryTotal(db,sid){return db.prepare('SELECT COALESCE(SUM(amount),0) n FROM settlement_resources WHERE settlement_id=?').get(sid).n;}
function resourceAmount(db,sid,key){return Number(db.prepare('SELECT amount FROM settlement_resources WHERE settlement_id=? AND resource_key=?').get(sid,key)?.amount||0);}
function foodStock(db,sid){return db.prepare(`SELECT COALESCE(SUM(amount),0) n FROM settlement_resources WHERE settlement_id=? AND resource_key IN (${FOOD_KEYS.map(()=>'?').join(',')})`).get(sid,...FOOD_KEYS).n;}
function addResource(db,sid,key,amount,capacity){
  if(amount<=0)return 0;
  const free=Math.max(0,capacity-inventoryTotal(db,sid)),accepted=Math.min(free,amount);
  if(accepted)db.prepare(`INSERT INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?) ON CONFLICT(settlement_id,resource_key) DO UPDATE SET amount=amount+excluded.amount`).run(sid,key,accepted);
  return accepted;
}
function consumeFood(db,sid,needed){
  let remaining=needed,consumed=0;
  // Consume generic rations first, then varied foods. Never make a stock negative.
  for(const key of FOOD_KEYS){if(remaining<=0)break;const have=resourceAmount(db,sid,key);if(have<=0)continue;const take=Math.min(have,remaining);db.prepare('UPDATE settlement_resources SET amount=amount-? WHERE settlement_id=? AND resource_key=?').run(take,sid,key);remaining-=take;consumed+=take;}
  return {consumed,shortage:Math.max(0,remaining)};
}
function foodMetrics(db,s){
  const total=foodStock(db,s.id),rate=Math.max(0,Number(s.population||0)/100),hours=rate>0?total/rate:(total>0?Infinity:0);
  const distinct=db.prepare(`SELECT COUNT(*) n FROM settlement_resources WHERE settlement_id=? AND resource_key IN (${FOOD_KEYS.filter(k=>k!=='food').map(()=>'?').join(',')}) AND amount>0`).get(s.id,...FOOD_KEYS.filter(k=>k!=='food')).n;
  let penalty=0,status='Немає їжі';
  if(total>0){if(hours<12) {penalty=0.25;status='Критично мало';}else if(hours<24){status='Мало запасів';}else if(distinct>=5){status='Різноманітне харчування';}else status='Запаси є';}
  return {foodStock:Math.floor(total),foodConsumptionPerHour:rate,foodHoursRemaining:Number.isFinite(hours)?Math.round(hours*10)/10:null,foodStatus:status,foodDiversity:distinct,foodProductivityPenalty:penalty,foodProductivityMultiplier:total<=0?0.5:1-penalty};
}
function tickProduction(db,now=Math.floor(Date.now()/1000)){
  for(const s of db.prepare('SELECT * FROM settlements').all()){
    const last=s.last_production_at||now,hours=Math.min(24,Math.max(0,Math.floor((now-last)/3600)));
    if(!hours)continue;
    const capacity=capacityFor(db,s.id);
    const buildings=db.prepare("SELECT id,building_key,level FROM settlement_buildings WHERE settlement_id=? AND status='built' AND level>0 ORDER BY id").all(s.id);
    const priorityRows=db.prepare('SELECT building_key,priority,updated_at FROM settlement_production_preferences WHERE settlement_id=?').all(s.id);
    const priorityMap=new Map(priorityRows.map(x=>[x.building_key,x]));
    const rank={high:0,medium:1,low:2};
    buildings.sort((a,b)=>{const pa=priorityMap.get(a.building_key)||{priority:'medium',updated_at:0},pb=priorityMap.get(b.building_key)||{priority:'medium',updated_at:0};return(rank[pa.priority]-rank[pb.priority])||(pa.updated_at-pb.updated_at)||(a.id-b.id)});
    let remainder=Number(s.food_consumption_remainder||0),totalConsumed=0,totalShortage=0;
    // Process each offline/online hour in sequence so food shortages affect that hour's output.
    for(let hour=0;hour<hours;hour++){
      const stockBefore=foodStock(db,s.id),populationRate=Math.max(0,Number(s.population||0)/100),stockHours=populationRate>0?stockBefore/populationRate:(stockBefore>0?Infinity:0);
      const productivity=stockBefore<=0?0.5:(stockHours<12?0.75:1);
      for(const b of buildings){const outputs=OUTPUTS[b.building_key];if(!outputs)continue;const mult=1+0.25*Math.max(0,b.level-1);for(const [resource,rate] of Object.entries(outputs))addResource(db,s.id,resource,Math.floor(rate*mult*productivity),capacity);}
      remainder+=Math.max(0,Number(s.population||0)/100);
      const due=Math.floor(remainder);
      if(due>0){const result=consumeFood(db,s.id,due);totalConsumed+=result.consumed;totalShortage+=result.shortage;remainder-=due;}
    }
    const food=resourceAmount(db,s.id,'food');
    db.prepare('UPDATE settlements SET food=?,food_consumption_remainder=?,last_production_at=? WHERE id=?').run(food,remainder,now,s.id);
    if(totalConsumed>0||totalShortage>0){db.prepare('INSERT INTO settlement_history(settlement_id,event,details,created_at) VALUES(?,?,?,?)').run(s.id,'food_consumption',`Спожито харчів: ${Math.floor(totalConsumed)}; нестача: ${Math.ceil(totalShortage)} за ${hours} год.`,now);}
    db.prepare('INSERT INTO settlement_history(settlement_id,event,details,created_at) VALUES(?,?,?,?)').run(s.id,'production_tick',`Виробництво оброблено за ${hours} год. офлайн/онлайн`,now);
  }
}
module.exports={OUTPUTS,RESOURCE_NAMES,FOOD_KEYS,initProductionSchema,tickProduction,capacityFor,inventoryTotal,foodStock,foodMetrics};
