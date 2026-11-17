// SOLMAR city: procedural sun-soaked coastal city. A 7x7 block grid with
// roads, instanced buildings, palms, lamps, a beach and sea to the east, a
// port to the south-west and a neon avenue down the middle. Layout is fully
// deterministic from the seed. Exports the meshes plus the colliders, the road
// graph and the named places missions and shops use.
import * as THREE from "three";
import { CFG, PALETTE } from "./config.js";

export const ROAD_X = [];
export const ROAD_Z = [];
for (let i = 0; i <= CFG.blocks; i++) {
  const c = (i - CFG.blocks / 2) * CFG.pitch;
  ROAD_X.push(c);
  ROAD_Z.push(c);
}
const CITY_EDGE = CFG.blocks * CFG.pitch * 0.5 + CFG.roadHalf; // 225

// Named places (world coordinates) used by missions, shops and shots.
export const PLACES = {
  vossAuto: { x: 0, z: 124, label: "Voss Auto" },
  sprayShack: { x: 124, z: 0, label: "Spray Shack" },
  ironworks: { x: -62, z: 62, label: "Ironworks" },
  hospital: { x: -124, z: -62, label: "Solmar General" },
  warehouse: { x: -124, z: 124, label: "Kessler Warehouse" },
  kesslerHQ: { x: -186, z: 186, label: "Kessler HQ" },
  marina: { x: 252, z: -62, label: "Marina Bay" },
  port: { x: -155, z: 155, label: "Old Port" },
  spire: { x: 0, z: -62, label: "Solmar Spire" },
  neonStrip: { x: 0, z: -93, label: "Neon Strip" },
  beach: { x: 262, z: 40, label: "Solmar Beach" },
  plaza: { x: 62, z: -62, label: "Coral Plaza" },
};

export function isOnRoad(x, z) {
  const near = (v, list) => list.some((c) => Math.abs(v - c) <= CFG.roadHalf + 0.5);
  return near(x, ROAD_X) || near(z, ROAD_Z);
}

export function nearestRoadPoint(x, z) {
  let bx = ROAD_X[0];
  let bz = ROAD_Z[0];
  for (const c of ROAD_X) if (Math.abs(c - x) < Math.abs(bx - x)) bx = c;
  for (const c of ROAD_Z) if (Math.abs(c - z) < Math.abs(bz - z)) bz = c;
  return { x: bx, z: bz };
}

function canvasTexture(size, draw) {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  draw(cv.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture(rng) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = "#2b3542";
    g.fillRect(0, 0, s, s);
    for (let y = 8; y < s - 8; y += 22) {
      for (let x = 8; x < s - 8; x += 18) {
        const lit = rng.next() < 0.55;
        g.fillStyle = lit ? "#ffd489" : "#1a2230";
        g.fillRect(x, y, 11, 13);
      }
    }
  });
}

function signTexture(text, color) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext("2d");
  g.fillStyle = "#140a18";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = color;
  g.font = "bold 34px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture() {
  const S = 2048;
  const HALF = CFG.groundSize / 2;
  const px = (v) => ((v + HALF) / CFG.groundSize) * S;
  const m = S / CFG.groundSize; // px per metre
  return canvasTexture(S, (g) => {
    g.fillStyle = "#a89f92"; // sidewalk / block base
    g.fillRect(0, 0, S, S);
    // Beach sand (east strip) and sea handled by a separate plane; sand here.
    g.fillStyle = "#e8c98f";
    g.fillRect(px(238), 0, px(306) - px(238), S);
    // Parks / plaza / port concrete, drawn per block below.
    // Roads: dark asphalt strips.
    g.fillStyle = "#3a3f46";
    for (const c of ROAD_X) g.fillRect(px(c - CFG.roadHalf), 0, CFG.roadHalf * 2 * m, S);
    for (const c of ROAD_Z) g.fillRect(0, px(c - CFG.roadHalf), S, CFG.roadHalf * 2 * m);
    // Lane dashes (centre line, yellow).
    g.fillStyle = "#d8b13c";
    for (const c of ROAD_X) {
      for (let z = -HALF + 8; z < HALF - 8; z += 12) g.fillRect(px(c) - 1, px(z), 2, 5 * m);
    }
    for (const c of ROAD_Z) {
      for (let x = -HALF + 8; x < HALF - 8; x += 12) g.fillRect(px(x), px(c) - 1, 5 * m, 2);
    }
    // Crosswalks at every intersection.
    g.fillStyle = "#e8e8e8";
    for (const cx of ROAD_X) {
      for (const cz of ROAD_Z) {
        for (let k = -3; k <= 3; k++) {
          g.fillRect(px(cx + k * 2.2) - 2, px(cz - CFG.roadHalf - 1.5), 4, 3 * m);
          g.fillRect(px(cx + k * 2.2) - 2, px(cz + CFG.roadHalf - 1.5), 4, 3 * m);
        }
      }
    }
    // Block interiors: parks (green), plaza (tan), port (grey), parking.
    g.fillStyle = "#5d8a4a";
    for (const [bx, bz] of [[-2, -2], [2, 1], [-1, 3], [3, -3]]) {
      g.fillRect(px(bx * 62 - 21), px(bz * 62 - 21), 42 * m, 42 * m);
    }
    g.fillStyle = "#c9b18c";
    g.fillRect(px(62 - 21), px(-62 - 21), 42 * m, 42 * m); // Coral Plaza
    g.fillStyle = "#8d8d8d";
    g.fillRect(px(-217), px(93), 124 * m, 124 * m); // Old Port concrete
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = "city";

  // Golden-hour sky dome: gradient + sun glow baked into a tiny shader.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(880, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(PALETTE.skyTop) },
        horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
        sunDir: { value: new THREE.Vector3(0.55, 0.28, -0.35).normalize() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vDir; uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir;
        void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.6));
        float s = max(dot(normalize(vDir), sunDir), 0.0); c += vec3(1.0, 0.75, 0.4) * pow(s, 90.0) * 0.9 + vec3(1.0,0.6,0.25) * pow(s, 8.0) * 0.25;
        gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 850);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(260, 150, -190);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -280;
  sun.shadow.camera.right = 280;
  sun.shadow.camera.top = 280;
  sun.shadow.camera.bottom = -280;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd0a0, 0x3a2f28, 1.05));

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Sea (east) + sand is in the ground texture; water plane with a gentle
  // teal material sits just past the beach.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(320, CFG.groundSize),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(300 + 160, -0.05, 0);
  group.add(sea);

  // Buildings: one instanced box mesh, window texture, per-instance tint.
  const winTex = windowTexture(rng);
  const bMat = new THREE.MeshStandardMaterial({
    map: winTex,
    emissiveMap: winTex,
    emissive: new THREE.Color(0xffc070),
    emissiveIntensity: 0.4,
    roughness: 0.85,
  });
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const placements = [];
  const tints = [0xd8c8b8, 0xb8c4d0, 0xd0a890, 0xc8b8a0, 0xa8b8c8, 0xe0d0c0];
  const neonBlocks = new Set(["0,-2", "0,-1", "0,0"]);
  for (let bi = 0; bi < CFG.blocks; bi++) {
    for (let bj = 0; bj < CFG.blocks; bj++) {
      const cx = (bi - 3) * CFG.pitch;
      const cz = (bj - 3) * CFG.pitch;
      const key = `${bi - 3},${bj - 3}`;
      if (key === "0,-1") continue; // Spire block
      if (key === "0,2") continue; // Voss Auto yard
      if (key === "2,-1") continue; // Coral Plaza
      if ([[-2, -2], [2, 1], [-1, 3], [3, -3]].some(([a, b]) => a === bi - 3 && b === bj - 3)) continue; // parks
      if (bi <= 1 && bj >= 5) continue; // port: containers instead
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(16, 30);
        const d = rng.range(16, 30);
        const h = rng.range(9, 18) + (Math.abs(cx) < 70 && Math.abs(cz) < 70 ? rng.range(0, 34) : 0);
        const ox = n === 1 ? 0 : rng.range(-8, 8);
        const oz = n === 1 ? 0 : rng.range(-8, 8);
        const x = cx + ox;
        const z = cz + oz;
        placements.push({ x, z, w, h, d, neon: neonBlocks.has(key) });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }
  const inst = new THREE.InstancedMesh(bGeo, bMat, placements.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();
  placements.forEach((p, i) => {
    pos.set(p.x, 0, p.z);
    sc.set(p.w, p.h, p.d);
    m4.compose(pos, q, sc);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.setHex(rng.pick(tints)));
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  group.add(inst);

  // Solmar Spire landmark.
  const spire = new THREE.Group();
  const spireMat = new THREE.MeshStandardMaterial({ color: 0x9fb4cc, roughness: 0.4, metalness: 0.5, emissive: 0x223344, emissiveIntensity: 0.4 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 96, 12), spireMat);
  tower.position.y = 48;
  tower.castShadow = true;
  spire.add(tower);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xff4466, emissive: 0xff2244, emissiveIntensity: 2 }),
  );
  beacon.position.y = 98;
  spire.add(beacon);
  spire.position.set(PLACES.spire.x, 0, PLACES.spire.z);
  group.add(spire);
  colliders.push({ minX: -8, maxX: 8, minZ: -70, maxZ: -54 });

  // Neon signs along the Strip (emissive canvas-text planes).
  const signs = [
    ["NEON", "#ff2fd6", 0, -124],
    ["HOTEL SOLMAR", "#22e6ff", 0, -62],
    ["CASINO", "#ffd23c", 0, -186],
    ["PIER 9", "#7dff5e", 0, -31],
  ];
  for (const [text, color, x, z] of signs) {
    const sm = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 5.5),
      new THREE.MeshBasicMaterial({ map: signTexture(text, color), side: THREE.DoubleSide }),
    );
    sm.position.set(x + 17, 16, z);
    sm.rotation.y = Math.PI / 2; // face east, toward the Strip's road
    group.add(sm);
  }

  // Port: stacked containers + two cranes.
  const contGeo = new THREE.BoxGeometry(12, 2.6, 2.6);
  const contCols = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
  const contMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2 });
  const conts = [];
  for (let i = 0; i < 26; i++) {
    const x = -200 + rng.range(0, 90);
    const z = 110 + rng.range(0, 90);
    const y = rng.chance(0.4) ? 2.6 : 0;
    conts.push({ x, z, y, c: rng.pick(contCols), ry: rng.chance(0.5) ? 0 : Math.PI / 2 });
  }
  const contInst = new THREE.InstancedMesh(contGeo, contMat, conts.length);
  conts.forEach((c, i) => {
    pos.set(c.x, c.y + 1.3, c.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.ry);
    sc.set(1, 1, 1);
    m4.compose(pos, q, sc);
    contInst.setMatrixAt(i, m4);
    contInst.setColorAt(i, col.setHex(c.c));
    colliders.push({ minX: c.x - 6, maxX: c.x + 6, minZ: c.z - 1.6, maxZ: c.z + 1.6 });
  });
  contInst.castShadow = true;
  group.add(contInst);
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, roughness: 0.6, metalness: 0.4 });
  for (const [cx, cz] of [[-170, 120], [-140, 170]]) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), craneMat);
    leg.position.set(-5, 13, 0);
    const leg2 = leg.clone();
    leg2.position.x = 5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 3), craneMat);
    top.position.y = 26;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(26, 1.5, 1.5), craneMat);
    jib.position.set(10, 25, 0);
    crane.add(leg, leg2, top, jib);
    crane.position.set(cx, 0, cz);
    crane.castShadow = true;
    group.add(crane);
    colliders.push({ minX: cx - 7, maxX: cx + 7, minZ: cz - 2, maxZ: cz + 2 });
  }

  // Marina piers + boats.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 });
  for (const pz of [-93, -31, 31]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 6), pierMat);
    pier.position.set(300, 0.4, pz);
    group.add(pier);
  }
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 });
  for (const [bx, bz] of [[315, -80], [318, -18], [312, 44]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3.4), boatMat);
    hull.position.y = 0.4;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2.6), new THREE.MeshStandardMaterial({ color: 0x2471a3 }));
    cab.position.set(-1, 2, 0);
    boat.add(hull, cab);
    boat.position.set(bx, 0, bz);
    group.add(boat);
  }

  // Palms along sidewalks and in parks.
  const palmSpots = [];
  for (let i = 0; i < 130; i++) {
    const onX = rng.chance(0.5);
    const road = rng.pick(ROAD_X);
    const along = rng.range(-210, 210);
    const off = (rng.chance(0.5) ? 1 : -1) * (CFG.roadHalf + 2.5);
    palmSpots.push(onX ? { x: road + off, z: along } : { x: along, z: road + off });
  }
  for (const [bx, bz] of [[-2, -2], [2, 1], [-1, 3], [3, -3]]) {
    for (let i = 0; i < 8; i++) palmSpots.push({ x: bx * 62 + rng.range(-18, 18), z: bz * 62 + rng.range(-18, 18) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 5.4, 6);
  trunkGeo.translate(0, 2.7, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownGeo = new THREE.IcosahedronGeometry(2.1, 0);
  crownGeo.scale(1, 0.45, 1);
  crownGeo.translate(0, 5.8, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3d, roughness: 0.9 });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach((p, i) => {
    pos.set(p.x, 0, p.z);
    q.identity();
    sc.set(1, rng.range(0.85, 1.3), 1);
    m4.compose(pos, q, sc);
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
  });
  group.add(trunks, crowns);

  // Street lamps (instanced poles + emissive heads).
  const lampSpots = [];
  for (const c of ROAD_X) for (let z = -200; z <= 200; z += 62) lampSpots.push({ x: c + CFG.roadHalf + 1.5, z, ry: 0 });
  for (const c of ROAD_Z) for (let x = -200; x <= 200; x += 62) lampSpots.push({ x, z: c + CFG.roadHalf + 1.5, ry: 0 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6);
  poleGeo.translate(0, 3.2, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.6, metalness: 0.6 }), lampSpots.length);
  const headGeo = new THREE.BoxGeometry(0.9, 0.25, 0.35);
  headGeo.translate(0, 6.4, 0);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 1.6 }), lampSpots.length);
  lampSpots.forEach((p, i) => {
    pos.set(p.x, 0, p.z);
    q.identity();
    sc.set(1, 1, 1);
    m4.compose(pos, q, sc);
    poles.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
  });
  group.add(poles, heads);

  // Traffic lights at four big intersections.
  const trafficLights = [];
  const tlCols = [
    { x: 0, z: 0 }, { x: 0, z: -124 }, { x: -124, z: 0 }, { x: 124, z: 124 },
  ];
  for (const p of tlCols) {
    const g2 = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    pole.position.y = 2.7;
    g2.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    box.position.y = 5.2;
    g2.add(box);
    const mk = (color, y) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }));
      s.position.set(0, y, 0.26);
      g2.add(s);
      return s;
    };
    const red = mk(0xff2222, 5.6);
    const green = mk(0x22ff44, 4.8);
    g2.position.set(p.x + CFG.roadHalf + 1, 0, p.z + CFG.roadHalf + 1);
    group.add(g2);
    trafficLights.push({ x: p.x, z: p.z, red, green, nsGreen: true, timer: 0 });
  }

  scene.add(group);
  return { group, colliders, trafficLights, sun };
}
