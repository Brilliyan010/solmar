// SOLMAR — ekonomi: uang, taksi sampingan, Spray Shack, Ironworks, garasi.
import { CFG } from './config.js';
import { CARS } from './vehicles.js';

export function createEconomy(ctx) {
  const e = { money: CFG.startMoney, taxi: null, garage: ['pipit'], coins: 0 };
  function add(n, why) {
    e.money += Math.round(n);
    ctx.hud?.flashMoney?.();
    return e.money;
  }
  function spend(n) {
    if (e.money < n) { ctx.hud?.toast(`Not enough money ($${n} needed)`); return false; }
    e.money -= n;
    return true;
  }
  function startTaxi() {
    if (e.taxi) return false;
    const dest = ctx.city.roadPos(ctx.rng);
    e.taxi = { x: dest.x, z: dest.z, fare: CFG.taxiFare };
    ctx.hud?.setObjective('TAXI — drive the passenger to the marker');
    ctx.hud?.toast(`TAXI JOB — fare $${CFG.taxiFare}`);
    return true;
  }
  function sprayPaint() {
    const cost = CFG.sprayCost;
    if (!spend(cost)) return false;
    const v = ctx.driving?.vehicle;
    if (v) {
      v.mesh.children[0].material = v.mesh.children[0].material.clone();
      v.mesh.children[0].material.color.setHex([0xd64545, 0x3fa7d6, 0x7a2fd6, 0xf2c230][Math.floor(Math.random() * 4)]);
      v.damage = 0;
    }
    if (ctx.police) { ctx.police.wanted = 0; ctx.police.hidden = 0; }
    ctx.hud?.toast(`SPRAY SHACK — repainted + repaired, wanted cleared ($${cost})`);
    ctx.audio?.sting('spray');
    return true;
  }
  function buyGun(key) {
    const cost = CFG.gunCost[key];
    if (cost === undefined) return false;
    if (!spend(cost)) return false;
    ctx.combat?.giveWeapon(key);
    ctx.hud?.toast(`IRONWORKS — bought ${key.toUpperCase()} ($${cost})`);
    return true;
  }
  function buyCar(key) {
    const def = CARS.find((c) => c.key === key);
    if (!def || e.garage.includes(key)) return false;
    if (!spend(def.price)) return false;
    e.garage.push(key);
    ctx.hud?.toast(`GARAGE — ${def.name} added to your garage ($${def.price})`);
    return true;
  }
  function collectCoin() {
    e.coins++;
    add(CFG.coinValue, 'Sun Coin');
    ctx.upgrades?.addCred(20);
    ctx.hud?.toast(`Sun Coin ${e.coins}/10 +$${CFG.coinValue}`);
  }
  function update(dt) {
    // Taksi: sampai tujuan.
    if (e.taxi) {
      const p = ctx.player;
      if (Math.hypot(e.taxi.x - p.x, e.taxi.z - p.z) < 7) {
        const fare = Math.round(e.taxi.fare * (ctx.upgrades?.relicPerk('money') ? 1.2 : 1));
        add(fare, 'taxi');
        ctx.upgrades?.addCred(30);
        ctx.hud?.toast(`TAXI DONE +$${fare}`);
        e.taxi = null;
        ctx.missions?.refreshObjective?.();
      }
    }
  }
  e.add = add; e.spend = spend; e.startTaxi = startTaxi; e.sprayPaint = sprayPaint;
  e.buyGun = buyGun; e.buyCar = buyCar; e.collectCoin = collectCoin; e.update = update;
  return e;
}
