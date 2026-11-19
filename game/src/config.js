// SOLMAR — semua angka tuning di satu tempat.
export const CFG = {
  // Dunia: jalan di x/z = ±31, ±93, ±155 (lebar 10); kota ±186; laut z > 200.
  roadAt: [-155, -93, -31, 31, 93, 155],
  roadW: 10,
  bound: 186,
  seaZ: 200,
  // Player jalan kaki.
  walk: 7, sprint: 11, jumpV: 8.5, gravity: 22,
  maxHp: 100, maxArmor: 100,
  // Mobil (top = m/detik, ~x3.6 = km/h).
  cars: [
    { key: 'pipit', name: 'Pipit', color: 0x3fa7d6, top: 30, accel: 14, grip: 2.6, price: 0 },
    { key: 'corto', name: 'Corto', color: 0xd64545, top: 36, accel: 16, grip: 2.8, price: 1200 },
    { key: 'cabrio', name: 'Cabrio Taxi', color: 0xf2c230, top: 33, accel: 15, grip: 2.7, price: 900 },
    { key: 'mule', name: 'Mule', color: 0x8a7f72, top: 28, accel: 12, grip: 2.4, price: 1500 },
    { key: 'vantara', name: 'Vantara', color: 0x7a2fd6, top: 46, accel: 22, grip: 3.4, price: 8000 },
    { key: 'hauler', name: 'Hauler', color: 0x3d7a3d, top: 26, accel: 11, grip: 2.2, price: 2200 },
  ],
  trafficN: 22, pedN: 36,
  // Wanted: naik per aksi; decay bila sembunyi 20 dtk.
  heatDecay: 20, heatPerSteal: 1, heatPerHit: 1, heatPerShot: 1, heatPerKill: 2,
  // Misi: hadiah $.
  missionReward: [500, 1500, 2500, 4000, 10000],
  // Boss: hp, damage per hit, kecepatan.
  bosses: {
    rico: { name: 'Rico Vane', title: 'Harbor Enforcer', hp: 300, dmg: 14, speed: 3.2, reward: 2000 },
    neonking: { name: 'Neon King', title: 'Street Race Champion', hp: 250, dmg: 12, speed: 5.2, reward: 3000 },
    kessler: { name: 'Dario Kessler', title: 'Harbor Boss', hp: 600, dmg: 18, speed: 3.6, reward: 10000 },
  },
  // Upgrade (12): 4 senjata, 4 mobil, 4 Mara.
  upgrades: [
    { id: 'w_dmg', name: 'Extended Barrels', kind: 'weapon', cost: 800, desc: '+35% weapon damage' },
    { id: 'w_mag', name: 'Drum Magazines', kind: 'weapon', cost: 700, desc: '+60% magazine size' },
    { id: 'w_rate', name: 'Rapid Trigger', kind: 'weapon', cost: 1200, desc: '+30% fire rate' },
    { id: 'w_armor_pierce', name: 'AP Rounds', kind: 'weapon', cost: 1500, desc: 'Shots pierce armor, +15% damage vs bosses' },
    { id: 'c_engine', name: 'Turbo Engine', kind: 'car', cost: 1500, desc: '+25% top speed, +20% accel' },
    { id: 'c_armor', name: 'Armored Plating', kind: 'car', cost: 1200, desc: 'Car takes 40% less damage' },
    { id: 'c_nitro', name: 'Nitro Kit', kind: 'car', cost: 1000, desc: 'Hold Shift in car: nitro boost' },
    { id: 'c_grip', name: 'Race Suspension', kind: 'car', cost: 900, desc: '+30% grip, tighter turns' },
    { id: 'm_health', name: 'Gym Membership', kind: 'mara', cost: 600, desc: '+50 max health' },
    { id: 'm_sprint', name: 'Runner Shoes', kind: 'mara', cost: 500, desc: '+25% sprint speed' },
    { id: 'm_vest', name: 'Kevlar Vest', kind: 'mara', cost: 1000, desc: 'Start each life with 50 armor' },
    { id: 'm_luck', name: 'Lucky Charm', kind: 'mara', cost: 800, desc: '+15% money from jobs and missions' },
  ],
  // 12 Sun Relics: tiap 3 = 1 perk permanen.
  relicPerks: [
    { n: 3, name: 'Sun Blessing I', desc: '+25 max HP' },
    { n: 6, name: 'Sun Blessing II', desc: 'Wanted cools down 2x faster' },
    { n: 9, name: 'Sun Blessing III', desc: '+20% money from all sources' },
    { n: 12, name: 'Sun Blessing IV', desc: 'All shops 30% cheaper' },
  ],
  credRanks: ['Rookie', 'Runner', 'Wheelman', 'Kingpin', 'Legend of Solmar'],
  credNeed: [0, 150, 400, 900, 1800],
  // Aktivitas: 6 race, 8 jump, 5 photo, courier, vigilante.
  raceReward: 600, jumpReward: 150, photoReward: 100, courierReward: 350, vigilanteReward: 800,
  taxiFare: 120, coinValue: 50,
  sprayCost: 150, gunCost: { pistol: 0, shotgun: 600, smg: 1500 },
  // Atmosfer: fase hari (detik per fase) + hujan.
  dayLength: 240, rainChance: 0.22,
  // Ekonomi.
  startMoney: 200,
};
