// vehicles.js — procedural car models. Every car is built from boxes and
// cylinders in three.js, so no model files are needed. Six original
// models, each with its own silhouette, plus a police cruiser variant.
import * as THREE from "three";
import { CONFIG } from "./config.js";

export function carDef(id) {
  return CONFIG.cars.find((c) => c.id === id);
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function wheel(x, z) {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12),
    new THREE.MeshLambertMaterial({ color: 0x141414 }),
  );
  w.rotation.z = Math.PI / 2;
  w.position.set(x, 0.34, z);
  return w;
}

// Build a car mesh for a definition. Returns { group, wheels, bodyMat }.
// The group faces -z when heading = 0 (three.js forward), matching the
// driving code, which rotates the group by its heading.
export function makeCarMesh(def, opts = {}) {
  const g = new THREE.Group();
  const color = opts.color ?? def.color;
  const kind = def.kind;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });

  let bodyLen = 4.2;
  let bodyW = 1.9;
  let bodyH = 0.62;
  if (kind === "van" || kind === "truck") { bodyLen = 5.0; bodyW = 2.0; bodyH = 0.9; }
  if (kind === "sport") { bodyLen = 4.4; bodyW = 2.0; bodyH = 0.5; }
  if (kind === "hatch") { bodyLen = 3.6; bodyW = 1.8; bodyH = 0.66; }

  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);

  // Cabin / cargo.
  if (kind === "van" || kind === "truck") {
    const cargo = box(bodyW - 0.1, 1.5, bodyLen * 0.55, color, 0, 1.75, 0.7);
    g.add(cargo);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.2, 0.9, 1.1), glassMat);
    cab.position.set(0, 1.35, -1.7);
    g.add(cab);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.3, 0.55, bodyLen * 0.45), glassMat);
    cabin.position.set(0, 1.18, kind === "sport" ? 0.25 : 0.1);
    cabin.castShadow = true;
    g.add(cabin);
  }

  // Sport spoiler, taxi sign, truck bed rails.
  if (kind === "sport") {
    g.add(box(1.9, 0.07, 0.35, 0x141414, 0, 1.25, 2.05));
    g.add(box(0.1, 0.3, 0.1, 0x141414, -0.8, 1.05, 2.05));
    g.add(box(0.1, 0.3, 0.1, 0x141414, 0.8, 1.05, 2.05));
  }
  if (kind === "taxi") {
    const sign = box(0.7, 0.22, 0.4, 0xffc21a, 0, 1.62, 0);
    sign.material = new THREE.MeshBasicMaterial({ color: 0xffe14d });
    g.add(sign);
  }

  // Headlights (warm) and taillights (red), always on at golden hour.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.06), headMat);
    h.position.set(sx * (bodyW / 2 - 0.35), 0.66, -bodyLen / 2 - 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.06), tailMat);
    t.position.set(sx * (bodyW / 2 - 0.35), 0.66, bodyLen / 2 + 0.02);
    g.add(t);
  }

  const wheels = [];
  const wz = bodyLen / 2 - 0.75;
  const wx = bodyW / 2 - 0.05;
  for (const [x, z] of [[-wx, -wz], [wx, -wz], [-wx, wz], [wx, wz]]) {
    const w = wheel(x, z);
    g.add(w);
    wheels.push(w);
  }

  // Police light bar for cruisers.
  let lightBar = null;
  if (opts.police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    red.position.x = -0.3;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }),
    );
    blue.position.x = 0.3;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.5, 0);
    lightBar.userData.red = red;
    lightBar.userData.blue = blue;
    g.add(lightBar);
  }

  return { group: g, wheels, bodyMat, lightBar };
}

// A parked / drivable car entity in the world.
export function createCar(def, x, z, heading = 0, opts = {}) {
  const { group, wheels, bodyMat, lightBar } = makeCarMesh(def, opts);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    def,
    mesh: group,
    wheels,
    bodyMat,
    lightBar,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    damaged: 0, // 0..1, smoke above 0.6
    owned: !!opts.owned, // player's own (garage) car
    driver: opts.driver ?? null, // "player" | "traffic" | "police" | null (parked)
  };
}
