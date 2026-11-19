// city.js — builds the whole of Solmar: streets, blocks, buildings,
// landmarks, beach and sea. All geometry is procedural three.js; all
// textures are drawn on canvas at runtime, so the game loads no files.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeRng, range, rangeInt, pick } from "./rng.js";

const STREETS = CONFIG.streetOffsets;
const ROAD_W = CONFIG.streetWidth;

// A canvas texture with asphalt, a dashed yellow centre line and white edges.
function roadTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#2e2e33";
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = "#3a3a40";
  g.fillRect(0, 0, 64, 8);
  g.fillRect(0, 248, 64, 8);
  g.fillStyle = "#c8b23a";
  g.fillRect(30, 20, 4, 40);
  g.fillRect(30, 108, 4, 40);
  g.fillRect(30, 196, 4, 40);
  g.fillStyle = "#d8d8d8";
  g.fillRect(4, 0, 2, 256);
  g.fillRect(58, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 7);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Windows texture for a building face: lit and dark windows on a wall.
function facadeTexture(rng, base) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 240; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? (rng() < 0.7 ? "#ffd98a" : "#9fe8ff") : "#20242e";
      g.fillRect(x, y, 12, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textTexture(text, fg, bg, font = "bold 42px Verdana") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function neonTexture(text, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#14081f";
  g.fillRect(0, 0, 256, 512);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(10, 10, 236, 492);
  g.fillStyle = color;
  g.font = "bold 44px Verdana";
  g.textAlign = "center";
  const words = text.split(" ");
  words.forEach((w, i) => g.fillText(w, 128, 120 + i * 90));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function isOnRoad(x, z) {
  const on = (v) => STREETS.some((s) => Math.abs(v - s) <= ROAD_W / 2 + 1);
  return on(x) || on(z);
}

// Nearest street centre line to a coordinate (used to snap spawns to roads).
export function nearestStreet(v) {
  let best = STREETS[0];
  for (const s of STREETS) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  return best;
}

export function clampWorld(x, z) {
  const h = CONFIG.worldHalf - 4;
  return [Math.max(-h, Math.min(h, x)), Math.max(-h, Math.min(h, z))];
}

// Block intervals between streets (and the outer rim).
function blockIntervals() {
  const edges = [-CONFIG.worldHalf, ...STREETS.map((s) => s - ROAD_W / 2), CONFIG.worldHalf];
  // Build [min,max] pairs from consecutive street edges instead: use gaps.
  const gaps = [];
  const bounds = [-CONFIG.worldHalf, -161, -99, -37, 25, 87, 149, CONFIG.worldHalf];
  for (let i = 0; i < bounds.length - 1; i++) gaps.push([bounds[i] + 6, bounds[i + 1] - 6]);
  return gaps;
}

export function buildCity(scene) {
  const rng = makeRng(CONFIG.seed);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const addCollider = (x, z, w, d) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };

  // --- Lights: golden hour sun + warm sky fill.
  const sun = new THREE.DirectionalLight(0xffb36b, 2.6);
  sun.position.set(-120, 140, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x3a4a6b, 0.9));
  scene.fog = new THREE.Fog(0xf2a35e, 240, 520);

  // --- Ground: pavement base, beach, sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 440),
    new THREE.MeshLambertMaterial({ color: 0x9a938a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 26),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9a }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, CONFIG.beachZ - 6);
  scene.add(beach);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 90),
    new THREE.MeshLambertMaterial({ color: 0x1d7f9e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, CONFIG.seaZ - 40);
  scene.add(sea);

  // --- Roads.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const s of STREETS) {
    const along = new THREE.Mesh(new THREE.PlaneGeometry(430, ROAD_W), roadMat);
    along.rotation.x = -Math.PI / 2;
    along.position.set(0, 0.03, s);
    along.receiveShadow = true;
    scene.add(along);
    const across = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 430), roadMat.clone());
    across.material.map = roadTex.clone();
    across.material.map.rotation = Math.PI / 2;
    across.material.map.center.set(0.5, 0.5);
    across.rotation.x = -Math.PI / 2;
    across.position.set(s, 0.03, 0);
    across.receiveShadow = true;
    scene.add(across);
  }

  // --- Buildings, block by block.
  const palette = ["#c98f5f", "#b7a48e", "#8fa8b8", "#d8b48a", "#a88a7a", "#7a9a8a", "#c9a0a0"];
  const gaps = blockIntervals();
  const gapOf = (v) => gaps.findIndex(([a, b]) => v >= a && v <= b);
  const isPort = (ix, iz) => ix >= 4 && iz >= 1 && iz <= 3; // east blocks: Old Port
  const isMarina = (iz) => iz === 0; // north row: waterfront
  const isPlaza = (ix, iz) => ix === 3 && iz === 3; // centre block
  const isVoss = (ix, iz) => ix === 4 && iz === 5; // Voss Auto yard
  const isSpray = (ix, iz) => ix === 2 && iz === 5; // Spray Shack

  for (let ix = 0; ix < gaps.length; ix++) {
    for (let iz = 0; iz < gaps.length; iz++) {
      const [x0, x1] = gaps[ix];
      const [z0, z1] = gaps[iz];
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (isPlaza(ix, iz) || isVoss(ix, iz) || isSpray(ix, iz)) continue;
      if (isPort(ix, iz)) continue; // containers instead
      if (isMarina(iz) && iz === 0) {
        // Marina Bay: low beachfront buildings + pier handled below.
        if (ix === 3) continue;
      }
      // 2x2 buildings per block, seeded heights.
      const bw = (x1 - x0) / 2 - 6;
      const bd = (z1 - z0) / 2 - 6;
      for (const dx of [-1, 1]) {
        for (const dz of [-1, 1]) {
          if (rng() < 0.12) continue; // occasional empty lot / parking
          const h = range(rng, 10, ix === 3 || iz === 3 ? 55 : 34);
          const bx = cx + dx * (bw / 2 + 1);
          const bz = cz + dz * (bd / 2 + 1);
          const mat = new THREE.MeshLambertMaterial({
            map: facadeTexture(rng, pick(rng, palette)),
          });
          const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), mat);
          b.position.set(bx, h / 2, bz);
          b.castShadow = true;
          b.receiveShadow = true;
          scene.add(b);
          // Rooftop AC box.
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(3, 1.4, 2.4),
            new THREE.MeshLambertMaterial({ color: 0x666666 }),
          );
          ac.position.set(bx + bw / 4, h + 0.7, bz);
          scene.add(ac);
          addCollider(bx, bz, bw, bd);
        }
      }
    }
  }

  // --- Solmar Spire (centre plaza landmark) + plaza.
  const spireMat = new THREE.MeshLambertMaterial({ color: 0xd8c8a8 });
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, 95, 8), spireMat);
  spire.position.set(0, 47.5, 0);
  spire.castShadow = true;
  scene.add(spire);
  const spireTop = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5a3c }),
  );
  spireTop.position.set(0, 97, 0);
  scene.add(spireTop);
  const spireLight = new THREE.PointLight(0xff6a3c, 60, 120);
  spireLight.position.set(0, 96, 0);
  scene.add(spireLight);
  addCollider(0, 0, 16, 16);
  // Plaza fountain ring.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb8c9 }),
  );
  fountain.position.set(0, 0.6, 26);
  scene.add(fountain);
  addCollider(0, 26, 15, 15);

  // --- Voss Auto garage + yard (player HQ), block x 37..87, z 99..149.
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(24, 7, 12),
    new THREE.MeshLambertMaterial({ color: 0x5a6a7a }),
  );
  garage.position.set(62, 3.5, 106);
  garage.castShadow = true;
  scene.add(garage);
  addCollider(62, 106, 24, 12);
  const vossSign = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 5),
    new THREE.MeshBasicMaterial({ map: textTexture("VOSS AUTO", "#ffd76a", "#20304a") }),
  );
  vossSign.position.set(62, 6.2, 99.8);
  scene.add(vossSign);
  // Yard paving.
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 34),
    new THREE.MeshLambertMaterial({ color: 0x777777 }),
  );
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(62, 0.04, 130);
  scene.add(yard);

  // --- Spray Shack (south-west), Ironworks (north-west).
  const shack = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0x3a8a5f }),
  );
  shack.position.set(-62, 3, 124);
  shack.castShadow = true;
  scene.add(shack);
  addCollider(-62, 124, 14, 10);
  const shackSign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: textTexture("SPRAY SHACK", "#ffffff", "#1d5c38") }),
  );
  shackSign.position.set(-62, 5.2, 118.8);
  scene.add(shackSign);

  const iron = new THREE.Mesh(
    new THREE.BoxGeometry(16, 8, 12),
    new THREE.MeshLambertMaterial({ color: 0x4a4a52 }),
  );
  iron.position.set(-124, 4, -62);
  iron.castShadow = true;
  scene.add(iron);
  addCollider(-124, -62, 16, 12);
  const ironSign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: textTexture("IRONWORKS", "#ffd76a", "#222228") }),
  );
  ironSign.position.set(-124, 7, -55.8);
  scene.add(ironSign);

  // --- Old Port: containers + cranes (east blocks).
  const contColors = [0xc25a3a, 0x3a7fc2, 0x4fae5f, 0xd8a83a, 0x8a5fc2];
  for (let i = 0; i < 26; i++) {
    const cx = range(rng, 105, 195);
    const cz = range(rng, -25, 85);
    const stacked = rng() < 0.4;
    const h = stacked ? 5.4 : 2.7;
    const cont = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: pick(rng, contColors) }),
    );
    cont.position.set(cx, stacked ? 3.9 : 1.3, cz);
    cont.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
    cont.castShadow = true;
    scene.add(cont);
    addCollider(cx, cz, 12, 3);
  }
  // Kessler warehouse (M5 finale site).
  const warehouse = new THREE.Mesh(
    new THREE.BoxGeometry(30, 12, 20),
    new THREE.MeshLambertMaterial({ color: 0x6a3a3a }),
  );
  warehouse.position.set(150, 6, 31);
  warehouse.castShadow = true;
  scene.add(warehouse);
  addCollider(150, 31, 30, 20);
  const kesslerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 4),
    new THREE.MeshBasicMaterial({ map: textTexture("KESSLER PORT CO.", "#ffffff", "#4a2020") }),
  );
  kesslerSign.position.set(150, 10, 20.8);
  scene.add(kesslerSign);
  // Two harbour cranes.
  for (const [cx, cz] of [[120, -10], [170, 60]]) {
    const mast = new THREE.Mesh(
      new THREE.BoxGeometry(4, 34, 4),
      new THREE.MeshLambertMaterial({ color: 0xd8a83a }),
    );
    mast.position.set(cx, 17, cz);
    mast.castShadow = true;
    scene.add(mast);
    const jib = new THREE.Mesh(
      new THREE.BoxGeometry(34, 2, 2),
      new THREE.MeshLambertMaterial({ color: 0xd8a83a }),
    );
    jib.position.set(cx + 12, 32, cz);
    scene.add(jib);
    addCollider(cx, cz, 5, 5);
  }

  // --- Marina Bay pier (north, into the sea).
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 46),
    new THREE.MeshLambertMaterial({ color: 0x8a6f4d }),
  );
  pier.position.set(0, 0.6, -196);
  scene.add(pier);
  addCollider(0, -186, 10, 20);

  // --- Neon Strip signs along street x=31.
  const neonWords = [["NEON", "#ff2a7a"], ["SOLMAR", "#22e6ff"], ["TACOS", "#ffd23e"], ["HOTEL", "#ff7a2a"], ["BAR 24", "#c25aff"]];
  neonWords.forEach(([word, color], i) => {
    const z = -20 + i * 26;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 12),
      new THREE.MeshBasicMaterial({ map: neonTexture(word, color) }),
    );
    sign.position.set(38, 9, z);
    sign.rotation.y = -Math.PI / 2;
    scene.add(sign);
    const glow = new THREE.PointLight(new THREE.Color(color).getHex(), 18, 26);
    glow.position.set(36, 9, z);
    scene.add(glow);
  });

  // --- Palms (instanced) along sidewalks + beach.
  const palmTrunk = new THREE.CylinderGeometry(0.25, 0.4, 5, 6);
  const palmTop = new THREE.ConeGeometry(2.2, 3.4, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const topMat = new THREE.MeshLambertMaterial({ color: 0x2f8a4f });
  const palmSpots = [];
  for (let i = 0; i < 70; i++) {
    const s = pick(rng, STREETS);
    const along = range(rng, -180, 180);
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) palmSpots.push([s + side * 9, along]);
    else palmSpots.push([along, s + side * 9]);
  }
  for (let i = 0; i < 12; i++) palmSpots.push([range(rng, -170, 170), -182]);
  const trunks = new THREE.InstancedMesh(palmTrunk, trunkMat, palmSpots.length);
  const tops = new THREE.InstancedMesh(palmTop, topMat, palmSpots.length);
  const m4 = new THREE.Matrix4();
  palmSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 2.5, z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 6.2, z);
    tops.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  scene.add(trunks);
  scene.add(tops);

  // --- Street lamps (instanced poles + emissive heads).
  const lampSpots = [];
  for (const s of STREETS) {
    for (let v = -170; v <= 170; v += 34) {
      lampSpots.push([s + 8, v]);
      lampSpots.push([s - 8, v + 17]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 6.1, z);
    heads.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(heads);

  return { colliders, gapOf };
}
