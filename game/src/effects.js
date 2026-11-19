// SOLMAR — particles: tire dust, crash smoke, muzzle flashes, screen shake.
import * as THREE from 'three';

function softDot() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function runFx(scene) {
  const tex = softDot();
  const parts = [];
  const e = { shakeMag: 0 };

  function spawn(x, y, z, color, n, spread, up, life) {
    for (let i = 0; i < n; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0.9 }),
      );
      sprite.position.set(
        x + (Math.random() - 0.5) * spread,
        y + Math.random() * 0.6,
        z + (Math.random() - 0.5) * spread,
      );
      sprite.scale.setScalar(0.8 + Math.random() * 0.8);
      scene.add(sprite);
      parts.push({
        m: sprite,
        vx: (Math.random() - 0.5) * 2,
        vy: up * (0.5 + Math.random()),
        vz: (Math.random() - 0.5) * 2,
        life: life * (0.6 + Math.random() * 0.6),
        max: life,
      });
    }
  }

  function dust(x, z) { spawn(x, 0.3, z, 0xcbb98f, 4, 1.6, 0.8, 0.7); }
  function smoke(x, z) { spawn(x, 1, z, 0x555555, 8, 1.4, 1.6, 1.4); }

  function flash(x, y, z) {
    spawn(x, y, z, 0xffd24d, 5, 0.4, 0.4, 0.18);
    e.shakeMag = Math.max(e.shakeMag, 0.12);
  }

  function shake(mag) { e.shakeMag = Math.max(e.shakeMag, mag); }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.m);
        p.m.material.dispose();
        parts.splice(i, 1);
        continue;
      }
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.m.material.opacity = (p.life / p.max) * 0.9;
      p.m.scale.setScalar(p.m.scale.x + dt * 1.4);
    }
    e.shakeMag = Math.max(0, e.shakeMag - dt * 0.5);
  }

  e.dust = dust;
  e.smoke = smoke;
  e.flash = flash;
  e.shake = shake;
  e.update = update;
  return e;
}
