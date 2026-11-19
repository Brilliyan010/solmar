// config.js — every tuning number for SOLMAR lives here, in one place.
export const CONFIG = {
  // World layout: streets run along x = +-31, +-93, +-155 (and the same on z).
  streetOffsets: [-155, -93, -31, 31, 93, 155],
  streetWidth: 12,
  sidewalkWidth: 3,
  worldHalf: 210,
  seaZ: -196,
  beachZ: -186,

  // Player on foot
  walkSpeed: 6,
  sprintSpeed: 10,
  jumpSpeed: 8,
  gravity: 22,
  playerRadius: 0.6,

  // Driving (arcade)
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 42, // m/s, scaled per car
  carReverseSpeed: 12,
  carTurn: 1.9,
  carGrip: 6,
  handbrakeGrip: 1.2,

  // Traffic & pedestrians
  trafficCount: 22,
  trafficSpeed: 11,
  pedCount: 36,
  pedSpeed: 1.6,
  pedFleeSpeed: 5,

  // Wanted
  wantedMax: 5,
  wantedDecaySeconds: 20,
  stealWanted: 1,
  hitPedWanted: 2,
  shootWanted: 1,
  policeChaseSpeed: 30,
  heliAtStars: 5,
  roadblockAtStars: 3,

  // Combat
  playerHealth: 100,
  pistolDamage: 34,
  shotgunDamage: 22, // per pellet, 6 pellets
  punchDamage: 12,
  guardHealth: 60,
  guardDamage: 9,

  // Economy
  missionRewards: [500, 1500, 2500, 4000, 10000],
  taxiFare: 120,
  sunCoinValue: 250,
  sprayCost: 150,
  pistolCost: 800,
  shotgunCost: 2500,
  garageSlots: 3,

  // Missions
  missionNames: [
    "M1 — First Delivery",
    "M2 — Hot Wheels",
    "M3 — Harbor Lights",
    "M4 — Neon Run",
    "M5 — Payback at the Port",
  ],

  // Time of day: golden hour, 18:00 start, 1 game minute per 3 real seconds.
  startClockMinutes: 18 * 60,
  clockRate: 20,

  // Cars: name, top speed multiplier, acceleration multiplier, colour, kind.
  cars: [
    { id: "pipit", name: "Pipit", kind: "hatch", speed: 0.78, accel: 0.85, color: 0x4fae5f, price: 0 },
    { id: "corto", name: "Corto", kind: "sedan", speed: 0.9, accel: 0.95, color: 0x3a6fd8, price: 0 },
    { id: "cabrio", name: "Cabrio Taxi", kind: "taxi", speed: 0.86, accel: 0.9, color: 0xffc21a, price: 0 },
    { id: "mule", name: "Mule", kind: "van", speed: 0.72, accel: 0.8, color: 0xd8d3c8, price: 0 },
    { id: "vantara", name: "Vantara", kind: "sport", speed: 1.25, accel: 1.2, color: 0xe23a5a, price: 0 },
    { id: "hauler", name: "Hauler", kind: "truck", speed: 0.66, accel: 0.7, color: 0x8a6f4d, price: 0 },
  ],

  // Sun Coin spots (10), spread across the districts.
  sunCoins: [
    [-150, -150], [150, -150], [-150, 150], [150, 150], [0, -170],
    [-120, 0], [120, 0], [0, 120], [-62, -62], [62, -120],
  ],

  seed: 20261117,
};
