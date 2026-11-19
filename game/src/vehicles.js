// SOLMAR — 6 mobil original: definisi + mesh prosedural + state kendaraan.
import * as THREE from 'three';
import { CFG } from './config.js';

export const CARS = CFG.cars;

export function makeCarMesh(def) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x181c22 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, emissive: 0x223344 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  if (def.key === 'vantara') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.4), darkMat);
    spoiler.position.set(0, 1.25, -2.1); g.add(spoiler);
  }
  if (def.key === 'mule' || def.key === 'hauler') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 2.6), bodyMat);
    box.position.set(0, 1.5, -0.8); g.add(box);
  }
  if (def.key === 'cabrio') {
    const taxi = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    taxi.position.set(0, 1.75, -0.2); g.add(taxi);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), lightMat);
    l.position.set(x, 0.7, 2.22); g.add(l);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const x of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    l.position.set(x, 0.7, -2.22); g.add(l);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export function createVehicle(def, x, z, angle = 0) {
  return {
    def, x, z, angle, speed: 0, steer: 0,
    mesh: makeCarMesh(def),
    damage: 0, nitro: 100,
  };
}

// Parkir mobil di pinggir jalan (untuk traffic + mobil curian).
export function parkCar(scene, def, x, z, angle) {
  const v = createVehicle(def, x, z, angle);
  v.mesh.position.set(x, 0, z);
  v.mesh.rotation.y = angle;
  scene.add(v.mesh);
  return v;
}
