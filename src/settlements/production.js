'use strict';

// Base production per hour at building level 1. Upgrades add 25% per level.
const OUTPUTS = {
  logging_camp: { wood: 10 }, stone_quarry: { stone: 6 },
  iron_mine: { iron: 4 }, copper_mine: { copper: 3 }, coal_mine: { coal: 4 },
  clay_pit: { clay: 5 }, sand_pit: { sand: 5 }, silver_mine: { silver: 1 },
  gold_mine: { gold_ore: 1 }, salt_mine: { salt: 3 }, gem_mine: { gemstones: 1 },
  sulfur_mine: { sulfur: 2 }, wheat_farm: { wheat: 6, food: 6 },
  vegetable_farm: { carrot: 4, food: 4 }, potato_field: { potato: 5, food: 5 },
  orchard: { apples: 3, food: 3 }, vineyard: { grapes: 3 }, apiary: { honey: 2 },
  cattle_farm: { meat: 2, milk: 3, food: 2 }, sheep_farm: { wool: 3, meat: 1, food: 1 },
  pig_farm: { meat: 4, food: 4 }, chicken_coop: { eggs: 4, food: 2 }, dairy: { milk: 5 },
  sawmill: { planks: 4 }, smelter: { metal: 3 }, brickworks: { brick: 4 }, glassworks: { glass: 3 }
};
const RESOURCE_NAMES = {
  wood:'Деревина', stone:'Камінь', iron:'Залізо', copper:'Мідь', coal:'Вугілля', clay:'Глина', sand:'Пісок',
  silver:'Срібло', gold_ore:'Золота руда', salt:'Сіль', gemstones:'Самоцвіти', sulfur:'Сірка', wheat:'Пшениця',
  carrot:'Морква', potato:'Картопля', apples:'Яблука', grapes:'Виноград', honey:'Мед', wool:'Вовна', meat:'М’ясо',
  milk:'Молоко', eggs:'Яйця', food:'Харчі', planks:'Дошки', metal:'Метал', brick:'Цегла', glass:'Скло'
};
function initProductionSchema(db) {
  const cols = db.prepare('PRAGMA table_info(settlements)').all().map(x=>x.name);
  if (!cols.includes('last_production_at')) db.exec("ALTER TABLE settlements ADD COLUMN last_production_at INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE settlements SET last_production_at=strftime('%s','now') WHERE last_production_at=0");
}
function capacityFor(db, settlementId) {
  const s = db.prepare('SELECT warehouse_capacity FROM settlements WHERE id=?').get(settlementId);
  const level = db.prepare("SELECT COALESCE(SUM(level),0) n FROM settlement_buildings WHERE settlement_id=? AND building_key='warehouse' AND status='built'").get(settlementId).n;
  return Math.floor((s?.warehouse_capacity || 1000) * (1 + 0.5 * level));
}
function inventoryTotal(db, sid) {
  return db.prepare('SELECT COALESCE(SUM(amount),0) n FROM settlement_resources WHERE settlement_id=?').get(sid).n;
}
function addResource(db, sid, key, amount, capacity) {
  if (amount <= 0) return 0;
  const free = Math.max(0, capacity - inventoryTotal(db, sid));
  const accepted = Math.min(free, amount);
  if (accepted) db.prepare(`INSERT INTO settlement_resources(settlement_id,resource_key,amount) VALUES(?,?,?)
    ON CONFLICT(settlement_id,resource_key) DO UPDATE SET amount=amount+excluded.amount`).run(sid,key,accepted);
  return accepted;
}
function tickProduction(db, now=Math.floor(Date.now()/1000)) {
  const settlements = db.prepare('SELECT * FROM settlements').all();
  for (const s of settlements) {
    const last = s.last_production_at || now;
    const hours = Math.min(24, Math.max(0, Math.floor((now-last)/3600)));
    if (!hours) continue;
    const capacity = capacityFor(db,s.id);
    const buildings = db.prepare("SELECT id,building_key,level FROM settlement_buildings WHERE settlement_id=? AND status='built' AND level>0 ORDER BY id").all(s.id);
    const priorityRows=db.prepare('SELECT building_key,priority,updated_at FROM settlement_production_preferences WHERE settlement_id=?').all(s.id);
    const priorityMap=new Map(priorityRows.map(x=>[x.building_key,x]));
    const rank={high:0,medium:1,low:2};
    buildings.sort((a,b)=>{const pa=priorityMap.get(a.building_key)||{priority:'medium',updated_at:0};const pb=priorityMap.get(b.building_key)||{priority:'medium',updated_at:0};return (rank[pa.priority]-rank[pb.priority])||(pa.updated_at-pb.updated_at)||(a.id-b.id)});
    for (const b of buildings) {
      const outputs = OUTPUTS[b.building_key]; if (!outputs) continue;
      const multiplier = 1 + 0.25 * Math.max(0,b.level-1);
      for (const [resource,rate] of Object.entries(outputs)) addResource(db,s.id,resource,Math.floor(rate*multiplier*hours),capacity);
    }
    const food = db.prepare("SELECT amount FROM settlement_resources WHERE settlement_id=? AND resource_key='food'").get(s.id)?.amount || 0;
    db.prepare('UPDATE settlements SET food=?,last_production_at=? WHERE id=?').run(food,now,s.id);
    db.prepare('INSERT INTO settlement_history(settlement_id,event,details,created_at) VALUES(?,?,?,?)').run(s.id,'production_tick',`Виробництво оброблено за ${hours} год. офлайн/онлайн`,now);
  }
}
module.exports = { OUTPUTS, RESOURCE_NAMES, initProductionSchema, tickProduction, capacityFor, inventoryTotal };
