// effects.js — visual feedback, all pooled, the hot loop allocates nothing.
// Two particle systems (hard sparks and soft smoke/dust), tracer streaks
// built from stretched glowing boxes so a gunfight reads across the street,
// muzzle-flash sprites with a shared point light, ejected shell casings that
// bounce on the asphalt, and the explosion shockwave rings. combat.js, the
// officers and the rival crews all speak through gunshotFx so every shot in
// Puerto Alba looks the same: flash, streak, impact.

import { G } from './state.js';
import { sfx } from './audio.js';

// ------------------------------------------------------------- spark pool
const SPARKS = 1200;
let sparkPts = null, sparkPos = null, sparkCol = null;
const sparkParts = [];
let sparkCursor = 0;

// ------------------------------------------------------------- smoke pool
const SMOKES = 520;
let smokePts = null, smokePos = null, smokeCol = null;
const smokeParts = [];
let smokeCursor = 0;

const colorTmp = new THREE.Color();
let flashLight = null;
const rings = [];

// ------------------------------------------------------------- tracers
const TRACER_POOL = 44;
const tracerPool = []; // { mesh, life, maxLife }

// ------------------------------------------------------------- muzzle sprites
const FLASH_POOL = 10;
const flashPool = []; // { sprite, life }

// ------------------------------------------------------------- shell casings
const CASING_POOL = 48;
let casingMesh = null;
const casings = []; // { x,y,z, vx,vy,vz, rot, vr, life }
let casingObj = null; // a reusable Object3D for composing casing matrices

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.35, 'rgba(255,190,90,0.85)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  // A four-point star over the glow reads as a flash at any distance.
  g.fillStyle = 'rgba(255,230,170,0.9)';
  g.beginPath();
  g.moveTo(32, 0); g.lineTo(36, 28); g.lineTo(64, 32); g.lineTo(36, 36);
  g.lineTo(32, 64); g.lineTo(28, 36); g.lineTo(0, 32); g.lineTo(28, 28);
  g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}

export function initEffects(scene) {
  // Sparks: small, fast, bright.
  {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SPARKS * 3);
    const col = new Float32Array(SPARKS * 3);
    for (let i = 0; i < SPARKS; i += 1) { pos[i * 3 + 1] = -999; sparkParts.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0 }); }
    sparkPos = new THREE.BufferAttribute(pos, 3);
    sparkCol = new THREE.BufferAttribute(col, 3);
    geo.setAttribute('position', sparkPos);
    geo.setAttribute('color', sparkCol);
    sparkPts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.34, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    sparkPts.frustumCulled = false;
    scene.add(sparkPts);
  }
  // Smoke and dust: big, slow, soft — what makes damage and gunfire linger.
  {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SMOKES * 3);
    const col = new Float32Array(SMOKES * 3);
    for (let i = 0; i < SMOKES; i += 1) { pos[i * 3 + 1] = -999; smokeParts.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, rise: 0, drag: 0 }); }
    smokePos = new THREE.BufferAttribute(pos, 3);
    smokeCol = new THREE.BufferAttribute(col, 3);
    geo.setAttribute('position', smokePos);
    geo.setAttribute('color', smokeCol);
    smokePts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.7, vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false,
    }));
    smokePts.frustumCulled = false;
    scene.add(smokePts);
  }

  flashLight = new THREE.PointLight(0xffc37a, 0, 30);
  flashLight.position.set(0, 3, 0);
  scene.add(flashLight);

  // Tracer streaks: unit boxes stretched between muzzle and target.
  const tGeo = new THREE.BoxGeometry(0.09, 0.09, 1);
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const m = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({
      color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false;
    scene.add(m);
    tracerPool.push({ mesh: m, life: 0, maxLife: 0.13 });
  }

  // Muzzle flash sprites.
  const fTex = makeFlashTexture();
  for (let i = 0; i < FLASH_POOL; i += 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(0.85, 0.85, 1);
    sp.visible = false;
    scene.add(sp);
    flashPool.push({ sprite: sp, life: 0 });
  }

  // Shell casings: one instanced mesh, simulated by hand.
  casingMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.035, 0.025, 0.075),
    new THREE.MeshBasicMaterial({ color: 0xd8a83c }), CASING_POOL);
  casingMesh.frustumCulled = false;
  casingObj = new THREE.Object3D();
  for (let i = 0; i < CASING_POOL; i += 1) {
    casings.push({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, life: 0 });
    casingObj.position.set(0, -50, 0);
    casingObj.updateMatrix();
    casingMesh.setMatrixAt(i, casingObj.matrix);
  }
  scene.add(casingMesh);
}

/** Spawn `count` hard particles of one colour flying out of a point. */
export function burst(x, y, z, colorHex, count = 6, power = 2, opts = {}) {
  if (!sparkPts) return;
  colorTmp.setHex(colorHex);
  const spread = opts.spread ?? 1;
  for (let n = 0; n < count; n += 1) {
    const i = sparkCursor; sparkCursor = (sparkCursor + 1) % SPARKS;
    const p = sparkParts[i];
    p.maxLife = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.7);
    p.life = p.maxLife;
    p.vx = (Math.random() - 0.5) * power * spread;
    p.vz = (Math.random() - 0.5) * power * spread;
    p.vy = Math.random() * power * (opts.up ?? 0.9) + (opts.baseVy ?? 0.4);
    p.grav = opts.grav ?? -2.2;
    p.drag = opts.drag ?? 0.6;
    sparkPos.array[i * 3] = x; sparkPos.array[i * 3 + 1] = y; sparkPos.array[i * 3 + 2] = z;
    const shade = 0.75 + Math.random() * 0.4;
    sparkCol.array[i * 3] = colorTmp.r * shade;
    sparkCol.array[i * 3 + 1] = colorTmp.g * shade;
    sparkCol.array[i * 3 + 2] = colorTmp.b * shade;
  }
  sparkCol.needsUpdate = true;
}

/** Spawn soft smoke/dust puffs that climb and hang in the air. */
export function burstSmoke(x, y, z, count = 4, opts = {}) {
  if (!smokePts) return;
  colorTmp.setHex(opts.color ?? 0x8a8a8a);
  for (let n = 0; n < count; n += 1) {
    const i = smokeCursor; smokeCursor = (smokeCursor + 1) % SMOKES;
    const p = smokeParts[i];
    p.maxLife = (opts.life ?? 1.8) * (0.7 + Math.random() * 0.6);
    p.life = p.maxLife;
    p.vx = (Math.random() - 0.5) * (opts.power ?? 0.7);
    p.vz = (Math.random() - 0.5) * (opts.power ?? 0.7);
    p.vy = 0;
    p.rise = (opts.rise ?? 0.8) * (0.7 + Math.random() * 0.6);
    p.drag = opts.drag ?? 0.5;
    smokePos.array[i * 3] = x + (Math.random() - 0.5) * 0.5;
    smokePos.array[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
    smokePos.array[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
    const shade = 0.8 + Math.random() * 0.35;
    smokeCol.array[i * 3] = colorTmp.r * shade;
    smokeCol.array[i * 3 + 1] = colorTmp.g * shade;
    smokeCol.array[i * 3 + 2] = colorTmp.b * shade;
  }
  smokeCol.needsUpdate = true;
}

/** A gunshot tracer: a bright streak that lives for a blink. */
export function tracer(x1, y1, z1, x2, y2, z2, colorHex = 0xffd98a) {
  const slot = tracerPool.find((t) => t.life <= 0) ?? tracerPool[0];
  if (!slot) return;
  const m = slot.mesh;
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.max(0.1, Math.hypot(dx, dy, dz));
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  m.lookAt(x2, y2, z2);
  m.scale.set(1, 1, len);
  m.material.color.setHex(colorHex);
  m.material.opacity = 0.95;
  m.visible = true;
  slot.life = slot.maxLife;
}

/** Muzzle flash: a star sprite at the gun plus the shared light's flicker. */
export function muzzle(x, y, z) {
  if (flashLight) { flashLight.position.set(x, y, z); flashLight.intensity = 3.0; }
  const slot = flashPool.find((f) => f.life <= 0) ?? flashPool[0];
  if (slot) {
    slot.sprite.position.set(x, y, z);
    slot.sprite.material.opacity = 0.95;
    slot.sprite.material.rotation = Math.random() * Math.PI;
    slot.sprite.visible = true;
    slot.life = 0.055;
  }
  burst(x, y, z, 0xffc37a, 2, 1.0, { life: 0.1, up: 0.2 });
}

/** Eject one brass casing from a gun, arcing toward the shooter's right. */
export function casing(x, y, z, heading) {
  const c = casings.find((k) => k.life <= 0) ?? casings[0];
  if (!c) return;
  const rx = Math.cos(heading), rz = -Math.sin(heading);
  c.x = x; c.y = y; c.z = z;
  c.vx = rx * (0.9 + Math.random() * 0.7);
  c.vz = rz * (0.9 + Math.random() * 0.7);
  c.vy = 1.6 + Math.random() * 0.8;
  c.rot = Math.random() * 6;
  c.vr = (Math.random() - 0.5) * 18;
  c.life = 1.5;
}

/**
 * One complete gunshot, drawn: muzzle flash and a casing at the origin, a
 * tracer streak to the target, and the right impact where it lands —
 * 'spark' off metal, 'dust' off walls and ground, 'flesh' on a person.
 */
export function gunshotFx(x, y, z, tx, ty, tz, opts = {}) {
  muzzle(x, y, z);
  if (opts.casing !== false) casing(x, y, z, opts.heading ?? 0);
  tracer(x, y, z, tx, ty, tz, opts.color ?? 0xffd98a);
  if (opts.hit === 'spark') burst(tx, ty, tz, 0xffcf5e, 5, 1.9, { life: 0.4 });
  else if (opts.hit === 'dust') {
    burst(tx, ty, tz, 0xcbb79a, 4, 1.2, { life: 0.5, up: 0.5 });
    burstSmoke(tx, ty, tz, 1, { color: 0xbfae90, life: 0.9, rise: 0.5, power: 0.4 });
  } else if (opts.hit === 'flesh') {
    burst(tx, ty, tz, 0x9e2f26, 5, 1.5, { life: 0.45 });
  }
}

/** The full explosion: fireball, smoke column, shockwave ring, sound, shake. */
export function explodeAt(x, z, radius = 7, sourceCar = null) {
  burst(x, 1, z, 0xff7a2e, 34, 6, { life: 0.8, up: 1.4 });
  burst(x, 1.4, z, 0xffc37a, 22, 4.4, { life: 0.5, up: 1.2 });
  burst(x, 2, z, 0x2c2c2c, 14, 2.4, { life: 1.4, up: 1.4, grav: 1.0 });
  burstSmoke(x, 1.6, z, 10, { color: 0x3a3a3a, life: 2.6, rise: 1.6, power: 1.6 });
  burstSmoke(x, 1.2, z, 6, { color: 0x6e6e6e, life: 2.0, rise: 1.1, power: 2.2 });
  if (flashLight) { flashLight.position.set(x, 2.5, z); flashLight.intensity = 7; }
  if (G.scene) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd9a3, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.25, z);
    G.scene.add(ring);
    rings.push({ mesh: ring, life: 0.45, maxLife: 0.45, radius });
  }
  sfx.explosion();
  const pd = Math.hypot(G.player.x - x, G.player.z - z);
  G.cameraShake = Math.min(1, G.cameraShake + Math.max(0, (26 - pd) / 26) * 0.8);
  if (!G.blastQueue) G.blastQueue = [];
  G.blastQueue.push({ x, z, radius, power: 9, sourceCar });
}

export function updateEffects(dt) {
  if (!sparkPts) return;
  // Sparks.
  {
    const arr = sparkPos.array;
    for (let i = 0; i < SPARKS; i += 1) {
      const p = sparkParts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { arr[i * 3 + 1] = -999; continue; }
      p.vy += p.grav * dt;
      const d = 1 - p.drag * dt;
      p.vx *= d; p.vz *= d;
      arr[i * 3] += p.vx * dt;
      arr[i * 3 + 1] += p.vy * dt;
      arr[i * 3 + 2] += p.vz * dt;
      if (arr[i * 3 + 1] < 0.05) { arr[i * 3 + 1] = 0.05; p.vy = 0; }
    }
    sparkPos.needsUpdate = true;
  }
  // Smoke.
  {
    const arr = smokePos.array;
    for (let i = 0; i < SMOKES; i += 1) {
      const p = smokeParts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { arr[i * 3 + 1] = -999; continue; }
      const d = 1 - p.drag * dt;
      p.vx *= d; p.vz *= d;
      arr[i * 3] += p.vx * dt;
      arr[i * 3 + 1] += p.rise * dt;
      arr[i * 3 + 2] += p.vz * dt;
    }
    smokePos.needsUpdate = true;
  }
  if (flashLight && flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 30);

  for (const t of tracerPool) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.95;
    if (t.life <= 0) t.mesh.visible = false;
  }
  for (const f of flashPool) {
    if (f.life <= 0) continue;
    f.life -= dt;
    f.sprite.material.opacity = Math.max(0, f.life / 0.055) * 0.95;
    if (f.life <= 0) f.sprite.visible = false;
  }
  // Casings: gravity, one bounce, then they lie in the street a moment.
  if (casingMesh && casingObj) {
    let dirty = false;
    for (let i = 0; i < CASING_POOL; i += 1) {
      const c = casings[i];
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.y > 0.04 || c.vy > 0) {
        c.vy -= 9.5 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        c.rot += c.vr * dt;
        if (c.y < 0.04) { c.y = 0.04; c.vy *= -0.35; c.vx *= 0.6; c.vz *= 0.6; c.vr *= 0.5; }
      }
      casingObj.position.set(c.x, c.y, c.z);
      casingObj.rotation.set(c.rot, c.rot * 0.7, 0);
      const s = c.life < 0.3 ? Math.max(0.01, c.life / 0.3) : 1;
      casingObj.scale.set(s, s, s);
      casingObj.updateMatrix();
      casingMesh.setMatrixAt(i, casingObj.matrix);
      if (c.life <= 0) {
        casingObj.position.set(0, -50, 0);
        casingObj.updateMatrix();
        casingMesh.setMatrixAt(i, casingObj.matrix);
      }
      dirty = true;
    }
    if (dirty) casingMesh.instanceMatrix.needsUpdate = true;
  }

  for (let i = rings.length - 1; i >= 0; i -= 1) {
    const r = rings[i];
    r.life -= dt;
    const t = 1 - r.life / r.maxLife;
    const s = 1 + t * r.radius * 2.2;
    r.mesh.scale.set(s, s, s);
    r.mesh.material.opacity = 0.75 * (1 - t);
    if (r.life <= 0) { G.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); rings.splice(i, 1); }
  }
}
