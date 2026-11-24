// effects.js — pooled particles and the gunfire language of Bahia Heat.
// The gunfire look is FINAL and pinned: thin warm tracer dashes, small
// orange muzzle-tip star flashes, sparks, ejected casings, and warm-grey
// smoke (muzzle 0x8a7f70, dust 0x99876c, opacity ~0.32). Do not restyle.

import { clamp } from './util.js';

let _scene = null;
const _particles = [];   // { mesh, vx, vy, vz, life, maxLife, grav, drag, spin, fade }
const _pool = [];
const _boxGeo = new THREE.BoxGeometry(1, 1, 1);
const _smokeTex = makeSmokeTexture();

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.38)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function initEffects(scene) {
  _scene = scene;
}

function spawn(mesh, vx, vy, vz, life, opts = {}) {
  mesh.visible = true;
  if (_scene && !mesh.parent) _scene.add(mesh);
  _particles.push({
    mesh, vx, vy, vz, life, maxLife: life,
    grav: opts.grav !== undefined ? opts.grav : 0,
    drag: opts.drag || 0,
    spin: opts.spin || 0,
    grow: opts.grow || 0,
    baseOpacity: opts.opacity !== undefined ? opts.opacity : 1,
    baseScale: mesh.scale.x,
  });
  return mesh;
}

function obtain(geo, mat) {
  for (let i = _pool.length - 1; i >= 0; i--) {
    if (_pool[i].geometry === geo && _pool[i].material === mat) {
      return _pool.splice(i, 1)[0];
    }
  }
  return new THREE.Mesh(geo, mat);
}

const _mats = {};
function colorMat(hex, opacity) {
  const key = `${hex}/${opacity}`;
  if (!_mats[key]) {
    _mats[key] = new THREE.MeshBasicMaterial({
      color: hex, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
    });
  }
  return _mats[key];
}

// Generic burst of small coloured shards (sparks, debris, confetti of war).
export function burst(x, y, z, colorHex, count = 6, power = 2, opts = {}) {
  if (!_scene) return;
  const mat = colorMat(colorHex, 1);
  for (let i = 0; i < count; i++) {
    const s = 0.05 + Math.random() * 0.09;
    const m = obtain(_boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    const a = Math.random() * Math.PI * 2;
    const up = opts.up !== undefined ? opts.up : 0.6;
    spawn(m,
      Math.cos(a) * power * (0.3 + Math.random() * 0.7),
      Math.random() * power * up + power * 0.3,
      Math.sin(a) * power * (0.3 + Math.random() * 0.7),
      0.35 + Math.random() * 0.4, { grav: -7, spin: 6 });
  }
}

// Warm-grey smoke puffs: soft sprites that rise, swell and thin out.
export function burstSmoke(x, y, z, count = 4, opts = {}) {
  if (!_scene) return;
  const color = opts.color !== undefined ? opts.color : 0x8a7f70;
  const key = `smoke/${color}`;
  if (!_mats[key]) {
    _mats[key] = new THREE.MeshBasicMaterial({
      map: _smokeTex, color, transparent: true, opacity: 0.32, depthWrite: false,
    });
  }
  const mat = _mats[key];
  for (let i = 0; i < count; i++) {
    const m = obtain(_smokePlaneGeo, mat);
    m.position.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.2, z + (Math.random() - 0.5) * 0.3);
    const s = 0.35 + Math.random() * 0.4;
    m.scale.set(s, s, 1);
    m.material = mat;
    spawn(m,
      (Math.random() - 0.5) * 0.5 + (opts.vx || 0),
      0.7 + Math.random() * 0.7,
      (Math.random() - 0.5) * 0.5 + (opts.vz || 0),
      0.8 + Math.random() * 0.7, { grow: 1.6, opacity: 0.32, drag: 0.6 });
  }
}
const _smokePlaneGeo = new THREE.PlaneGeometry(1, 1);

// A tracer: a thin warm dash stretched between muzzle and target, gone in a
// blink. Length reads as speed; the colour never changes.
const _tracerGeo = new THREE.BoxGeometry(0.045, 0.045, 1);
export function tracer(x1, y1, z1, x2, y2, z2, colorHex = 0xffb347) {
  if (!_scene) return;
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.5) return;
  const mat = colorMat(colorHex, 0.95);
  const m = obtain(_tracerGeo, mat);
  // Show the dash over the last stretch of the path, like a moving round.
  const frac = Math.min(1, 2.6 / len);
  m.position.set(x2 - dx * frac * 0.5, y2 - dy * frac * 0.5, z2 - dz * frac * 0.5);
  m.scale.set(1, 1, len * frac);
  m.lookAt(x2, y2, z2);
  spawn(m, 0, 0, 0, 0.07, {});
}

// The muzzle flash: a small orange star of two crossed planes at the tip.
const _starGeo = new THREE.PlaneGeometry(0.34, 0.34);
const _starTex = makeStarTexture();
function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.fillStyle = 'rgba(255,170,60,1)';
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, -30); g.lineTo(5, -6); g.lineTo(-5, -6);
    g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,230,170,1)';
  g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
  return new THREE.CanvasTexture(c);
}
export function muzzle(x, y, z, scale = 1) {
  if (!_scene) return;
  const key = 'star';
  if (!_mats[key]) {
    _mats[key] = new THREE.MeshBasicMaterial({
      map: _starTex, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide,
    });
  }
  for (let i = 0; i < 2; i++) {
    const m = obtain(_starGeo, _mats[key]);
    m.position.set(x, y, z);
    m.scale.setScalar(scale * (0.8 + Math.random() * 0.4));
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    spawn(m, 0, 0, 0, 0.055, {});
  }
}

// A spent casing: a tiny brass box that pops sideways and falls.
export function casing(x, y, z, heading) {
  if (!_scene) return;
  const m = obtain(_boxGeo, colorMat(0xd8a83c, 1));
  m.position.set(x, y, z);
  m.scale.set(0.035, 0.035, 0.07);
  const side = heading + Math.PI / 2;
  spawn(m,
    Math.sin(side) * (0.7 + Math.random() * 0.5),
    1.4 + Math.random() * 0.6,
    Math.cos(side) * (0.7 + Math.random() * 0.5),
    0.55, { grav: -9, spin: 14 });
}

// One call for a whole shot: flash at the muzzle, tracer down the line,
// sparks and a breath of smoke where it lands.
export function gunshotFx(x, y, z, tx, ty, tz, opts = {}) {
  muzzle(x, y, z, opts.muzzleScale || 1);
  tracer(x, y, z, tx, ty, tz, opts.tracerColor || 0xffb347);
  casing(x, y - 0.08, z, opts.heading || 0);
  if (opts.impact !== false) {
    burst(tx, ty, tz, 0xffcf7a, 3, 1.4, {});
    if (Math.random() < 0.5) burstSmoke(tx, ty + 0.1, tz, 1, { color: 0x99876c });
  }
  burstSmoke(x, y, z, 1, { color: 0x8a7f70 });
}

// Explosions: fireball burst, a fast shockwave ring, dust and smoke column.
const _ringGeo = new THREE.TorusGeometry(1, 0.09, 6, 26);
export function explodeAt(x, z, radius = 7, sourceCar = null) {
  if (!_scene) return;
  const y = 0.7;
  burst(x, y, z, 0xff8a30, 16, 6, { up: 1 });
  burst(x, y, z, 0xffd23e, 10, 4.4, { up: 1.2 });
  burst(x, y, z, 0x3a3a40, 8, 3.4, { up: 0.9 });
  burstSmoke(x, y + 0.4, z, 7, { color: 0x5a5348 });
  burstSmoke(x, y, z, 5, { color: 0x99876c });
  const ring = obtain(_ringGeo, colorMat(0xffc37a, 0.8));
  ring.position.set(x, 0.35, z);
  ring.rotation.x = Math.PI / 2;
  ring.scale.setScalar(0.5);
  spawn(ring, 0, 0, 0, 0.4, { grow: radius * 3.2, opacity: 0.8 });
}

export function updateEffects(dt) {
  for (let i = _particles.length - 1; i >= 0; i--) {
    const p = _particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      p.mesh.visible = false;
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      _pool.push(p.mesh);
      _particles.splice(i, 1);
      continue;
    }
    p.vy += p.grav * dt;
    if (p.drag) {
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
    }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    if (p.mesh.position.y < 0.03 && p.grav < 0) {
      p.mesh.position.y = 0.03;
      p.vy = 0; p.vx *= 0.7; p.vz *= 0.7;
    }
    if (p.spin) p.mesh.rotation.x += p.spin * dt, p.mesh.rotation.z += p.spin * 0.7 * dt;
    if (p.grow) {
      const s = p.mesh.scale.x + p.grow * dt * p.baseScale;
      p.mesh.scale.set(s, p.mesh.geometry === _smokePlaneGeo ? s : p.mesh.scale.y, p.mesh.geometry === _ringGeo ? s : p.mesh.scale.z);
      if (p.mesh.geometry === _ringGeo) p.mesh.scale.set(s, s, s);
    }
    const fade = clamp(p.life / p.maxLife, 0, 1);
    if (p.mesh.material && p.mesh.material.transparent) {
      p.mesh.material.opacity = p.baseOpacity * Math.min(1, fade * 2);
    }
    // Smoke always faces the camera.
    if (p.mesh.geometry === _smokePlaneGeo && _scene && _scene.userData.camera) {
      p.mesh.quaternion.copy(_scene.userData.camera.quaternion);
    }
  }
}
