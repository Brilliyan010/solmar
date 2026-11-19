// SOLMAR — a procedural coastal city: avenue grid, towers, landmarks, harbor, beach.
import * as THREE from 'three';
import { TUNE } from './config.js';

// A shop sign painted on a canvas, turned into a texture.
function signTexture(words, back, ink, w = 256, h = 64) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = back;
  g.fillRect(0, 0, w, h);
  g.fillStyle = ink;
  g.font = `bold ${h * 0.55}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(words, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A facade of windows, some lit, for the tower blocks.
function glassTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      g.fillStyle = Math.random() < 0.45 ? lit : '#20242c';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function raiseCity(scene, rng) {
  const A = TUNE.avenues;
  const E = TUNE.townEdge;
  const solids = [];
  const root = new THREE.Group();
  scene.add(root);

  // Ground, sea and sand.
  const dirt = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshLambertMaterial({ color: 0x8f8578 }),
  );
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(0, -0.05, 20);
  root.add(dirt);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 120),
    new THREE.MeshLambertMaterial({ color: 0x1e6f8e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, 260);
  root.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 22),
    new THREE.MeshLambertMaterial({ color: 0xe0c98f }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, 197);
  root.add(sand);

  // Avenues (asphalt) with pavements, both directions.
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const pavement = new THREE.MeshLambertMaterial({ color: 0x7d7468 });
  for (const x of A) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(TUNE.avenueWidth, E * 2 + 30), asphalt);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.03, 0);
    root.add(road);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(TUNE.avenueWidth + 6, E * 2 + 30), pavement);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(x, 0.015, 0);
    root.add(walk);
  }
  for (const z of A) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(E * 2 + 30, TUNE.avenueWidth), asphalt);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.03, z);
    root.add(road);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(E * 2 + 30, TUNE.avenueWidth + 6), pavement);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.015, z);
    root.add(walk);
  }
  // Dashes down the middle of every avenue.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  for (const x of A) {
    for (let z = -180; z < 180; z += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.05, z);
      root.add(dash);
    }
  }

  // Towers fill the blocks between avenues.
  const bounds = [-E, ...A, E];
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const facades = [
    new THREE.MeshLambertMaterial({ map: glassTexture('#5a5148', '#ffd27a'), emissive: 0x332211, emissiveMap: glassTexture('#000000', '#ffca6a') }),
    new THREE.MeshLambertMaterial({ map: glassTexture('#4a5a66', '#9fd8ff'), emissive: 0x112233, emissiveMap: glassTexture('#000000', '#7ec8ff') }),
    new THREE.MeshLambertMaterial({ map: glassTexture('#6b4a3a', '#ffb08a'), emissive: 0x221111, emissiveMap: glassTexture('#000000', '#ff9a6a') }),
  ];
  // Blocks kept open for the hand-built districts.
  const districtAt = (cx, cz) => {
    if (cx > -31 && cx < 31 && cz > 93 && cz < 155) return 'voss';
    if (cx < -155) return 'port';
    if (cz > 155 && cx > 31) return 'marina';
    if (Math.abs(cx + 124) < 1 && Math.abs(cz - 124) < 1) return 'park';
    if (Math.abs(cx + 62) < 1 && Math.abs(cz + 62) < 1) return 'spire';
    return null;
  };
  const towers = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    for (let j = 0; j < bounds.length - 1; j++) {
      const x0 = bounds[i] + 8;
      const x1 = bounds[i + 1] - 8;
      const z0 = bounds[j] + 8;
      const z1 = bounds[j + 1] - 8;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (districtAt(cx, cz)) continue;
      const count = rng.whole(1, 3);
      for (let k = 0; k < count; k++) {
        const w = rng.between(10, Math.max(12, (x1 - x0) / count - 4));
        const d = rng.between(10, Math.max(12, (z1 - z0) - 4));
        const h = rng.between(8, 42);
        const bx = rng.between(x0 + w / 2, x1 - w / 2);
        const bz = rng.between(z0 + d / 2, z1 - d / 2);
        const tower = new THREE.Mesh(unitBox, facades[rng.whole(0, 2)]);
        tower.scale.set(w, h, d);
        tower.position.set(bx, h / 2, bz);
        root.add(tower);
        towers.push(tower);
        solids.push({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2 });
        // Roof air-conditioning box.
        const ac = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x888888 }));
        ac.scale.set(2, 1, 2);
        ac.position.set(bx, h + 0.5, bz);
        root.add(ac);
      }
    }
  }

  // Solmar Spire, the landmark tower with its red beacon.
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 7, 90, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a4a5a, emissive: 0x111111 }),
  );
  spire.position.set(-62, 45, -62);
  root.add(spire);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  beacon.position.set(-62, 91, -62);
  beacon.name = 'beacon';
  root.add(beacon);

  // Old Port: stacked containers and two cranes.
  const containerCols = [0xc23b2e, 0x2e6fc2, 0x3fae5a, 0xd8a02e];
  for (let i = 0; i < 26; i++) {
    const box = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: containerCols[i % 4] }));
    const cx = rng.between(-182, -160);
    const cz = rng.between(-180, 180);
    const h = rng.odds(0.4) ? 5.4 : 2.7;
    box.scale.set(6, h, 2.6);
    box.position.set(cx, h / 2, cz);
    box.rotation.y = rng.odds(0.5) ? 0 : Math.PI / 2;
    root.add(box);
    solids.push({ x0: cx - 3.5, x1: cx + 3.5, z0: cz - 3.5, z1: cz + 3.5 });
  }
  for (const cz of [-90, 60]) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xd8a02e }));
    leg.scale.set(3, 34, 3);
    leg.position.y = 17;
    crane.add(leg);
    const jib = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xd8a02e }));
    jib.scale.set(26, 2, 2);
    jib.position.set(8, 33, 0);
    crane.add(jib);
    crane.position.set(-172, 0, cz);
    root.add(crane);
  }

  // Marina: wooden piers, and a lighthouse at the pier's end.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  for (let i = 0; i < 5; i++) {
    const pier = new THREE.Mesh(unitBox, pierMat);
    pier.scale.set(4, 0.6, 26);
    pier.position.set(50 + i * 22, 0.4, 196);
    root.add(pier);
  }
  const lighthouse = new THREE.Group();
  const lightTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 18, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8e0cc }),
  );
  lightTower.position.y = 9;
  lighthouse.add(lightTower);
  const lightRoom = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lightRoom.position.y = 18.6;
  lightRoom.name = 'lighthouse-lamp';
  lighthouse.add(lightRoom);
  lighthouse.position.set(148, 0, 202);
  root.add(lighthouse);

  // Voss Auto: the garage, its sign, and the yard where Mara starts.
  const garage = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x2f4a6b }));
  garage.scale.set(34, 9, 14);
  garage.position.set(0, 4.5, 100);
  root.add(garage);
  solids.push({ x0: -17, x1: 17, z0: 93, z1: 107 });
  const garageSign = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 5),
    new THREE.MeshBasicMaterial({ map: signTexture('VOSS AUTO', '#123a5c', '#ffd27a', 512, 128) }),
  );
  garageSign.position.set(0, 8.5, 92.8);
  garageSign.rotation.y = Math.PI;
  root.add(garageSign);

  // Spray Shack and Ironworks, the two shops.
  const sprayShop = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xc22e8a }));
  sprayShop.scale.set(12, 6, 10);
  sprayShop.position.set(40, 3, -40);
  root.add(sprayShop);
  solids.push({ x0: 34, x1: 46, z0: -45, z1: -35 });
  const spraySign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('SPRAY SHACK', '#40102e', '#ff7ad9', 512, 128) }),
  );
  spraySign.position.set(40, 6.5, -34.8);
  root.add(spraySign);
  const gunShop = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x4a4a52 }));
  gunShop.scale.set(12, 6, 10);
  gunShop.position.set(-40, 3, 40);
  root.add(gunShop);
  solids.push({ x0: -46, x1: -34, z0: 35, z1: 45 });
  const gunSign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('IRONWORKS', '#22222a', '#e8e8e8', 512, 128) }),
  );
  gunSign.position.set(-40, 6.5, 34.8);
  gunSign.rotation.y = Math.PI;
  root.add(gunSign);

  // Neon Strip: glowing boards along avenue x=93.
  const neonCols = [0xff2fb3, 0x2ee6ff, 0xffe14d, 0x7cff5a];
  const neonSigns = [];
  for (let i = 0; i < 10; i++) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(rng.between(6, 12), rng.between(2, 4)),
      new THREE.MeshBasicMaterial({ color: neonCols[i % 4] }),
    );
    board.position.set(93 + (i % 2 ? 8 : -8), rng.between(6, 12), -28 + i * 6.2);
    board.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
    board.name = 'neon';
    root.add(board);
    neonSigns.push(board);
  }

  // Palms and street lamps along the avenues.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 46; i++) {
    const x = rng.choose(A) + rng.choose([-9, 9]);
    const z = rng.between(-180, 180);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    root.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 7), palmMat);
    crown.position.set(x, 8.2, z);
    root.add(crown);
  }
  const lamps = [];
  for (const x of A) {
    for (let z = -170; z <= 170; z += 34) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x333333 }),
      );
      pole.position.set(x + 7, 3.5, z);
      root.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), bulbMat);
      bulb.position.set(x + 7, 7.1, z);
      bulb.name = 'lamp';
      root.add(bulb);
      lamps.push(bulb);
    }
  }

  // Palm Park: trees around the fountain.
  for (let i = 0; i < 8; i++) {
    const tree = new THREE.Mesh(new THREE.SphereGeometry(rng.between(2, 3.4), 8, 8), palmMat);
    tree.position.set(rng.between(-150, -100), 3, rng.between(100, 148));
    root.add(tree);
  }
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.6, 1.2, 12),
    new THREE.MeshLambertMaterial({ color: 0x9a8a7a }),
  );
  fountain.position.set(-124, 0.6, 124);
  root.add(fountain);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.4, 12),
    new THREE.MeshLambertMaterial({ color: 0x4aa8cc }),
  );
  fountainWater.position.set(-124, 1.1, 124);
  root.add(fountainWater);

  function blocked(x, z, r = 0.8) {
    if (Math.abs(x) > E + 8 || z < -E - 8 || z > 208) return true;
    for (const f of solids) {
      if (x > f.x0 - r && x < f.x1 + r && z > f.z0 - r && z < f.z1 + r) return true;
    }
    return false;
  }
  function onRoad(x, z) {
    for (const r of A) {
      if (Math.abs(x - r) < TUNE.avenueWidth / 2 + 1 || Math.abs(z - r) < TUNE.avenueWidth / 2 + 1) return true;
    }
    return false;
  }
  function roadPos(dice) {
    const rx = dice.choose(A);
    const rz = dice.between(-175, 175);
    return dice.odds(0.5) ? { x: rx, z: rz } : { x: dice.between(-175, 175), z: rx };
  }
  return {
    group: root,
    buildings: towers,
    footprints: solids,
    blocked,
    onRoad,
    roadPos,
    neonSigns,
    lamps,
    beacon,
    lighthouseLamp: lightRoom,
    landmarks: {
      spire: { x: -62, z: -62 },
      port: { x: -172, z: 0 },
      marina: { x: 94, z: 196 },
      neonStrip: { x: 93, z: 0 },
      vossAuto: { x: 0, z: 124 },
      sprayShack: { x: 40, z: -40 },
      ironworks: { x: -40, z: 40 },
      beach: { x: 60, z: 200 },
      park: { x: -124, z: 124 },
    },
  };
}
