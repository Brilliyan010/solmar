// SOLMAR — six original cars: their specs, procedural meshes and live state.
import * as THREE from 'three';
import { TUNE } from './config.js';

export const CAR_DEFS = TUNE.cars;

export function buildCarMesh(def) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: def.color });
  const trim = new THREE.MeshLambertMaterial({ color: 0x181c22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, emissive: 0x223344 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), paint);
  body.position.y = 0.65;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glass);
  cabin.position.set(0, 1.3, -0.2);
  car.add(cabin);
  if (def.key === 'vantara') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.4), trim);
    wing.position.set(0, 1.25, -2.1);
    car.add(wing);
  }
  if (def.key === 'mule' || def.key === 'hauler') {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 2.6), paint);
    cargo.position.set(0, 1.5, -0.8);
    car.add(cargo);
  }
  if (def.key === 'cabrio') {
    const roofSign = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.35, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x111111 }),
    );
    roofSign.position.set(0, 1.75, -0.2);
    car.add(roofSign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    car.add(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    lamp.position.set(x, 0.7, 2.22);
    car.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const x of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    lamp.position.set(x, 0.7, -2.22);
    car.add(lamp);
  }
  car.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return car;
}

export function spawnVehicle(def, x, z, angle = 0) {
  return {
    def,
    x,
    z,
    angle,
    speed: 0,
    steer: 0,
    mesh: buildCarMesh(def),
    damage: 0,
    nitro: 100,
  };
}

// Leave a car parked at the kerb (traffic props and stealable cars alike).
export function parkVehicle(scene, def, x, z, angle) {
  const v = spawnVehicle(def, x, z, angle);
  v.mesh.position.set(x, 0, z);
  v.mesh.rotation.y = angle;
  scene.add(v.mesh);
  return v;
}
