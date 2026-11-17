// SOLMAR — Streets of Solmar. Every tuning number lives here so the whole
// game can be balanced from one file. All distances in metres, speeds in m/s,
// money in dollars, time in seconds.
export const CFG = {
  // City
  pitch: 62, // distance between road centrelines
  blocks: 7, // blocks per side (roads = blocks + 1 per axis)
  roadHalf: 8, // half the road width
  blockHalf: 23, // half the block size (pitch - 2*roadHalf) / 2
  groundSize: 760,
  // Player on foot
  walkSpeed: 5.2,
  sprintSpeed: 8.6,
  jumpSpeed: 7.5,
  gravity: 22,
  playerRadius: 0.55,
  // Driving
  driveAccel: 16,
  driveBrake: 34,
  driveReverseMax: 11,
  driveGrip: 2.6, // steering authority
  handbrakeTurn: 1.9,
  // Traffic / pedestrians
  trafficCount: 22,
  pedCount: 36,
  trafficSpeed: 11,
  // Wanted
  wantedMax: 5,
  wantedDecayDelay: 18, // seconds without crime before stars start falling
  wantedDecayStep: 9, // seconds per star lost while hidden
  wantedForSteal: 1,
  wantedForHitPed: 1,
  wantedForHitCar: 1,
  wantedForShot: 1,
  wantedForKillCop: 2,
  bustedFine: 200,
  // Combat
  playerHealth: 100,
  playerArmorMax: 100,
  fistDamage: 18,
  fistRange: 2.4,
  pistolDamage: 26,
  pistolRate: 0.22,
  pistolRange: 70,
  shotgunDamage: 9,
  shotgunPellets: 6,
  shotgunRate: 0.8,
  shotgunRange: 26,
  guardHealth: 60,
  bossHealth: 220,
  // Economy
  startMoney: 150,
  taxiFareMin: 80,
  taxiFareMax: 160,
  coinValue: 100,
  coinCount: 10,
  sprayCost: 150,
  pistolCost: 800,
  shotgunCost: 1500,
  armorCost: 300,
  // Missions
  missionRewards: [500, 1500, 2500, 4000, 10000],
  // Clock: one game hour per 150 real seconds, starting at golden hour.
  clockStartHour: 17.6,
  clockRate: 1 / 150,
  // Rendering / loop
  fixedStep: 1 / 60,
  minimapSize: 200,
};

// Sun-soaked palette: sand, coral, teal sea, neon magenta/cyan.
export const PALETTE = {
  skyTop: 0x2e4a7a,
  skyHorizon: 0xff9a56,
  sun: 0xffd9a0,
  fog: 0xf2a56b,
  sea: 0x1f7f8c,
  sand: 0xe8c98f,
  road: 0x3a3f46,
  sidewalk: 0x9a938a,
  grass: 0x5d8a4a,
  plaza: 0xb8a88e,
};
