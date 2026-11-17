// SOLMAR vehicles: six original cars, built procedurally from boxes and
// cylinders so no model file is needed. Each model has its own proportions,
// handling and colour. The same factory builds the player's cars, traffic
// and police cruisers (police get their own livery).
import * as THREE from "three";

export const MODELS = {
  pipit: { name: "Pipit", len: 3.6, wid: 1.7, hgt: 1.35, maxSpeed: 26, accel: 15, price: 900, colors: [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6] },
  corto: { name: "Corto", len: 4.4, wid: 1.85, hgt: 1.4, maxSpeed: 30, accel: 16, price: 2400, colors: [0x2c3e50, 0xc0c0c0, 0x7f8c8d, 0x1a5276] },
  cabrio: { name: "Cabrio Taxi", len: 4.4, wid: 1.85, hgt: 1.45, maxSpeed: 28, accel: 15, price: 0, colors: [0xf7c600] },
  mule: { name: "Mule", len: 5.0, wid: 2.0, hgt: 2.1, maxSpeed: 24, accel: 12, price: 3200, colors: [0xeeeeee, 0x5d6d7e, 0x935116] },
  vantara: { name: "Vantara", len: 4.3, wid: 1.95, hgt: 1.15, maxSpeed: 40, accel: 20, price: 18000, colors: [0xff2f6d, 0x111111, 0x00c8ff] },
  hauler: { name: "Hauler", len: 6.4, wid: 2.3, hgt: 2.6, maxSpeed: 22, accel: 11, price: 6500, colors: [0x922b21, 0x1e8449, 0x2e4053] },
  police: { name: "Interceptor", len: 4.5, wid: 1.9, hgt: 1.42, maxSpeed: 34, accel: 19, price: 0, colors: [0xf2f3f4] },
};

const paintMat = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
const lightFrontMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 1.4 });
const lightRearMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xdd1111, emissiveIntensity: 1.2 });

export function buildCarMesh(modelKey, colorOverride) {
  const m = MODELS[modelKey];
  const color = colorOverride ?? m.colors[0];
  const g = new THREE.Group();
  g.name = `car-${modelKey}`;
  const L = m.len;
  const W = m.wid;
  const H = m.hgt;
  const paint = paintMat(color);

  // Body + cabin. Low-poly but shaped: a lower body box, a cabin box, and a
  // hood/trunk slope suggested by a second box on sports models.
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H * 0.55, W), paint);
  body.position.y = H * 0.42;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, H * 0.42, W * 0.88), modelKey === "mule" || modelKey === "hauler" ? paint : glassMat);
  cabin.position.set(-L * 0.05, H * 0.55 + H * 0.21, 0);
  cabin.castShadow = true;
  g.add(cabin);
  if (modelKey === "vantara") {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, W * 0.95), darkMat);
    spoiler.position.set(-L * 0.48, H * 0.78, 0);
    g.add(spoiler);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.12, W * 1.02), darkMat);
    skirt.position.y = 0.14;
    g.add(skirt);
  }
  if (modelKey === "hauler") {
    const box = new THREE.Mesh(new THREE.BoxGeometry(L * 0.55, H * 0.9, W * 0.96), new THREE.MeshStandardMaterial({ color: 0xd5d8dc, roughness: 0.6, metalness: 0.3 }));
    box.position.set(-L * 0.2, H * 0.75, 0);
    box.castShadow = true;
    g.add(box);
  }
  if (modelKey === "cabrio") {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.9), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf7c600, emissiveIntensity: 0.9 }));
    sign.position.set(-L * 0.05, H * 1.02, 0);
    g.add(sign);
  }
  if (modelKey === "police") {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.3, W * 1.01), darkMat);
    stripe.position.y = H * 0.42;
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.1), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x2255ff, emissiveIntensity: 1.2 }));
    bar.position.set(-L * 0.05, H * 1.0, 0);
    g.add(bar);
    g.userData.lightBar = bar;
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[L * 0.32, W / 2], [L * 0.32, -W / 2], [-L * 0.32, W / 2], [-L * 0.32, -W / 2]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  // Headlights + taillights.
  for (const wz of [-W * 0.32, W * 0.32]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.34), lightFrontMat);
    hl.position.set(L / 2 + 0.01, H * 0.45, wz);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.34), lightRearMat);
    tl.position.set(-L / 2 - 0.01, H * 0.45, wz);
    g.add(tl);
  }
  g.userData.wheels = wheels;
  g.userData.model = modelKey;
  g.userData.length = L;
  g.userData.width = W;
  return g;
}

// A fresh arcade driving state for one car.
export function makeCarState(modelKey, x, z, heading) {
  const m = MODELS[modelKey];
  return {
    model: modelKey,
    x, z, heading,
    speed: 0,
    steer: 0,
    maxSpeed: m.maxSpeed,
    accel: m.accel,
    damage: 0,
    mesh: null,
  };
}
