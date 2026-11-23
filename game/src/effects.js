// effects.js — everything the eye uses to believe a gunfight: pooled
// particles in two flavours (hard sparks that bounce, soft puffs that
// hang), tracer dashes, muzzle stars, ejected brass and explosion rings.
// Nothing here allocates in the frame loop; every system is a fixed pool
// with a cursor, and dead particles park far below the city.
//
// The gunfire recipe is the owner's, settled over several reviewed
// frames and not open to reinterpretation: a tracer is a SHORT warm dash
// caught part-way along its path (never a beam spanning the street), a
// muzzle flash is a small orange star living two frames at the barrel
// tip (never a white blob), powder smoke is a warm mid-grey (0x8a7f70)
// and impact dust a grey-brown (0x99876c) — pale smoke stacked into
// steam clouds once hid the very men a frame existed to show. combat.js,
// officers.js and pedestrians.js all fire through gunshotFx so every
// shot in Puerto Alba speaks this one language.
import { G } from './state.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- pools
const SPARK_COUNT = 1800;
const PUFF_COUNT = 900;
const TRACER_COUNT = 110;
const STAR_COUNT = 26;
const BRASS_COUNT = 84;

let sparks = null;      // { points, pos, col, parts, cursor }
let puffs = null;       // same shape, softer material
let tracerSlots = [];   // { mesh, life, span }
let starSlots = [];     // { sprite, life, span }
let brass = null;       // { mesh, items, dummy }
let sharedLight = null; // the one point light every muzzle borrows
const shockRings = [];  // { mesh, life, span, radius }
const paint = new THREE.Color(); // scratch colour, reused by every spawn

// ------------------------------------------------------------- textures
/** A radial-gradient dot. Unmapped THREE.Points are squares; a street of
 *  square smoke reads as floating panels, so every point wears this. */
function dotTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.62)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/** The muzzle star: a four-point flame of deep yellow and orange. The
 *  arms die before the sprite's edge and nothing in it approaches white,
 *  because the sprite is drawn small and must stay a star, not a glow. */
function starTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(255,122,26,0.9)';
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(36.5, 27.5); g.lineTo(58, 32); g.lineTo(36.5, 36.5);
  g.lineTo(32, 58); g.lineTo(27.5, 36.5); g.lineTo(6, 32); g.lineTo(27.5, 27.5);
  g.closePath(); g.fill();
  const core = g.createRadialGradient(32, 32, 1, 32, 32, 13);
  core.addColorStop(0, 'rgba(255,214,90,1)');
  core.addColorStop(0.55, 'rgba(255,166,48,0.95)');
  core.addColorStop(1, 'rgba(255,110,26,0)');
  g.fillStyle = core;
  g.fillRect(19, 19, 26, 26);
  return new THREE.CanvasTexture(cv);
}

/** One points cloud with its particle records; `extra` names the
 *  per-particle field the two flavours disagree on (grav vs rise). */
function makeCloud(scene, count, material, extraField) {
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(count * 3);
  const colArr = new Float32Array(count * 3);
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    posArr[i * 3 + 1] = -999; // parked under the city until spawned
    const rec = { life: 0, span: 1, vx: 0, vy: 0, vz: 0, drag: 0 };
    rec[extraField] = 0;
    parts.push(rec);
  }
  const pos = new THREE.BufferAttribute(posArr, 3);
  const col = new THREE.BufferAttribute(colArr, 3);
  geo.setAttribute('position', pos);
  geo.setAttribute('color', col);
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);
  return { points, pos, col, parts, cursor: 0, count };
}

export function initEffects(scene) {
  const dot = dotTexture();
  sparks = makeCloud(scene, SPARK_COUNT, new THREE.PointsMaterial({
    size: 0.36, map: dot, vertexColors: true, transparent: true, opacity: 0.97, depthWrite: false,
  }), 'grav');
  puffs = makeCloud(scene, PUFF_COUNT, new THREE.PointsMaterial({
    // 0.32, not more: overlapping puffs in a sustained fight should haze
    // the air, never pile into a solid wall of cloud.
    size: 1.55, map: dot, vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false,
  }), 'rise');

  // The shared flash light hugs the gun: a short warm flicker that tints
  // the shooter's hands and the wall beside him, not the whole street.
  sharedLight = new THREE.PointLight(0xffb35e, 0, 15);
  sharedLight.position.set(0, 3, 0);
  scene.add(sharedLight);

  // Tracer bodies: thin unit boxes, stretched and placed by tracer().
  const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
  for (let i = 0; i < TRACER_COUNT; i += 1) {
    const mesh = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({
      color: 0xffb347, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    mesh.visible = false;
    scene.add(mesh);
    tracerSlots.push({ mesh, life: 0, span: 0.09 });
  }

  // Muzzle stars: sprites, small at the tip and gone in two frames.
  const star = starTexture();
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: star, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.set(0.4, 0.4, 1);
    sprite.visible = false;
    scene.add(sprite);
    starSlots.push({ sprite, life: 0, span: 0.05 });
  }

  // Brass: one instanced mesh of tiny boxes, simulated by hand below.
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.04, 0.028, 0.085),
    new THREE.MeshBasicMaterial({ color: 0xe0aa40 }), BRASS_COUNT);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const items = [];
  for (let i = 0; i < BRASS_COUNT; i += 1) {
    items.push({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, life: 0 });
    dummy.position.set(0, -50, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mesh);
  brass = { mesh, items, dummy };
}

// -------------------------------------------------------------- spawners
/** Write one particle into a cloud at the cursor and advance the cursor. */
function emit(cloud, x, y, z, hex, shadeSpan) {
  const i = cloud.cursor;
  cloud.cursor = (cloud.cursor + 1) % cloud.count;
  const rec = cloud.parts[i];
  paint.setHex(hex);
  const shade = shadeSpan[0] + Math.random() * shadeSpan[1];
  cloud.pos.array[i * 3] = x;
  cloud.pos.array[i * 3 + 1] = y;
  cloud.pos.array[i * 3 + 2] = z;
  cloud.col.array[i * 3] = paint.r * shade;
  cloud.col.array[i * 3 + 1] = paint.g * shade;
  cloud.col.array[i * 3 + 2] = paint.b * shade;
  cloud.col.needsUpdate = true;
  return rec;
}

/** Hard particles: ricochets, flame tongues, debris — fast and bright. */
export function burst(x, y, z, colorHex, count = 6, power = 2, opts = {}) {
  if (!sparks) return;
  const spread = opts.spread ?? 1;
  for (let n = 0; n < count; n += 1) {
    const rec = emit(sparks, x, y, z, colorHex, [0.75, 0.4]);
    rec.span = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.7);
    rec.life = rec.span;
    rec.vx = (Math.random() - 0.5) * power * spread;
    rec.vz = (Math.random() - 0.5) * power * spread;
    rec.vy = Math.random() * power * (opts.up ?? 0.9) + (opts.baseVy ?? 0.4);
    rec.grav = opts.grav ?? -2.2;
    rec.drag = opts.drag ?? 0.6;
  }
}

/** Soft puffs: powder smoke and impact dust that climb and linger. */
export function burstSmoke(x, y, z, count = 4, opts = {}) {
  if (!puffs) return;
  const hex = opts.color ?? 0x8a8a8a;
  for (let n = 0; n < count; n += 1) {
    const rec = emit(puffs,
      x + (Math.random() - 0.5) * 0.5,
      y + (Math.random() - 0.5) * 0.3,
      z + (Math.random() - 0.5) * 0.5, hex, [0.8, 0.35]);
    rec.span = (opts.life ?? 1.8) * (0.7 + Math.random() * 0.6);
    rec.life = rec.span;
    rec.vx = (Math.random() - 0.5) * (opts.power ?? 0.7);
    rec.vz = (Math.random() - 0.5) * (opts.power ?? 0.7);
    rec.vy = 0;
    rec.rise = (opts.rise ?? 0.8) * (0.7 + Math.random() * 0.6);
    rec.drag = opts.drag ?? 0.5;
  }
}

/**
 * One tracer, drawn as a bullet caught mid-flight: a dash a few metres
 * long whose nose rides about three quarters of the way to the target.
 * A volley of these still lets the eye draw the line of fire, but no
 * single streak ever spans the street like a beam.
 */
export function tracer(x1, y1, z1, x2, y2, z2, colorHex = 0xffb347) {
  const slot = tracerSlots.find((t) => t.life <= 0) ?? tracerSlots[0];
  if (!slot) return;
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.max(0.1, Math.hypot(dx, dy, dz));
  const dashLen = Math.min(3.4, Math.max(1.1, len * 0.3));
  const headAt = 0.78;
  const mesh = slot.mesh;
  mesh.position.set(
    x1 + dx * headAt - (dx / len) * dashLen / 2,
    y1 + dy * headAt - (dy / len) * dashLen / 2,
    z1 + dz * headAt - (dz / len) * dashLen / 2);
  mesh.lookAt(x2, y2, z2);
  mesh.scale.set(1, 1, dashLen);
  mesh.material.color.setHex(colorHex);
  mesh.material.opacity = 0.92;
  mesh.visible = true;
  slot.life = slot.span;
}

/**
 * The muzzle moment: a star sprite pinned to the barrel tip and the
 * shared light's flicker. `scale` follows the weapon — a shotgun's star
 * is broader than a pistol's snap — and both stay under half a metre.
 */
export function muzzle(x, y, z, scale = 1) {
  if (sharedLight) {
    sharedLight.position.set(x, y, z);
    sharedLight.intensity = 1.15 + scale * 0.5;
  }
  const slot = starSlots.find((f) => f.life <= 0) ?? starSlots[0];
  if (slot) {
    const s = (0.3 + Math.random() * 0.09) * scale;
    slot.sprite.position.set(x, y, z);
    slot.sprite.scale.set(s, s, 1);
    slot.sprite.material.opacity = 0.95;
    slot.sprite.material.rotation = Math.random() * Math.PI;
    slot.sprite.visible = true;
    slot.life = slot.span;
  }
  burst(x, y, z, 0xffb35e, 2, 0.9, { life: 0.1, up: 0.2 });
}

/** One brass casing out of the ejection port, arcing to the right. */
export function casing(x, y, z, heading) {
  const c = brass?.items.find((k) => k.life <= 0) ?? brass?.items[0];
  if (!c) return;
  const rx = Math.cos(heading), rz = -Math.sin(heading); // the shooter's right
  c.x = x; c.y = y; c.z = z;
  c.vx = rx * (0.9 + Math.random() * 0.7);
  c.vz = rz * (0.9 + Math.random() * 0.7);
  c.vy = 1.6 + Math.random() * 0.8;
  c.rot = Math.random() * 6;
  c.vr = (Math.random() - 0.5) * 18;
  c.life = 1.6;
}

/**
 * A whole gunshot in one call: flash and brass at the muzzle, a tracer
 * dash to the target, a breath of powder smoke that stays a moment, and
 * the impact the surface deserves — 'spark' a ricochet fan off metal or
 * asphalt, 'dust' a bloom off masonry and ground, 'flesh' a dark flinch.
 */
export function gunshotFx(x, y, z, tx, ty, tz, opts = {}) {
  muzzle(x, y, z, opts.flash ?? 1);
  if (opts.casing !== false) casing(x, y, z, opts.heading ?? 0);
  tracer(x, y, z, tx, ty, tz, opts.color ?? 0xffb347);
  // Powder smoke: warm mid-grey, dusk-tinted. The old near-white stacked
  // a volley's worth of wisps into bright steam around the fight.
  burstSmoke(x, y, z, 1, { color: 0x8a7f70, life: 1.1, rise: 0.55, power: 0.3 });
  if (opts.hit === 'spark') {
    burst(tx, ty, tz, 0xffcf5e, 9, 2.3, { life: 0.45 });
    burst(tx, ty, tz, 0xfff0b8, 4, 1.4, { life: 0.3 });
    // The ricochet proper: a flat fan skimming away along the surface.
    burst(tx, 0.12, tz, 0xffb84d, 5, 2.6, { life: 0.5, up: 0.22, baseVy: 0.15, spread: 1.4 });
  } else if (opts.hit === 'dust') {
    burst(tx, ty, tz, 0xcbb79a, 7, 1.5, { life: 0.55, up: 0.55 });
    // Impact dust obeys the same rule as muzzle smoke: warm grey-brown.
    burstSmoke(tx, ty, tz, 2, { color: 0x99876c, life: 1.15, rise: 0.55, power: 0.5 });
  } else if (opts.hit === 'flesh') {
    burst(tx, ty, tz, 0x9e2f26, 6, 1.6, { life: 0.45 });
  }
}

/** An explosion, complete: fireball, smoke column, ring, sound, shake,
 *  and a blast record main.js drains into real damage. */
export function explodeAt(x, z, radius = 7, sourceCar = null) {
  burst(x, 1, z, 0xff7a2e, 38, 6.4, { life: 0.8, up: 1.4 });
  burst(x, 1.4, z, 0xffc37a, 24, 4.6, { life: 0.5, up: 1.2 });
  burst(x, 2, z, 0x2c2c2c, 16, 2.6, { life: 1.4, up: 1.4, grav: 1.0 });
  burstSmoke(x, 1.6, z, 12, { color: 0x3a3a3a, life: 2.8, rise: 1.7, power: 1.7 });
  burstSmoke(x, 1.2, z, 7, { color: 0x6e6e6e, life: 2.1, rise: 1.15, power: 2.3 });
  if (sharedLight) { sharedLight.position.set(x, 2.5, z); sharedLight.intensity = 6; }
  if (G.scene) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.15, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd9a3, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.25, z);
    G.scene.add(ring);
    shockRings.push({ mesh: ring, life: 0.45, span: 0.45, radius });
  }
  sfx.explosion();
  const pd = Math.hypot(G.player.x - x, G.player.z - z);
  G.cameraShake = Math.min(1, G.cameraShake + Math.max(0, (26 - pd) / 26) * 0.8);
  if (!G.blastQueue) G.blastQueue = [];
  G.blastQueue.push({ x, z, radius, power: 9, sourceCar });
}

// ---------------------------------------------------------------- update
/** Step one points cloud: age, integrate, park the dead underground. */
function stepCloud(cloud, dt, isPuff) {
  const arr = cloud.pos.array;
  for (let i = 0; i < cloud.count; i += 1) {
    const p = cloud.parts[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { arr[i * 3 + 1] = -999; continue; }
    const keep = 1 - p.drag * dt;
    p.vx *= keep; p.vz *= keep;
    arr[i * 3] += p.vx * dt;
    arr[i * 3 + 2] += p.vz * dt;
    if (isPuff) {
      arr[i * 3 + 1] += p.rise * dt;
    } else {
      p.vy += p.grav * dt;
      arr[i * 3 + 1] += p.vy * dt;
      if (arr[i * 3 + 1] < 0.05) { arr[i * 3 + 1] = 0.05; p.vy = 0; }
    }
  }
  cloud.pos.needsUpdate = true;
}

export function updateEffects(dt) {
  if (!sparks) return;
  stepCloud(sparks, dt, false);
  stepCloud(puffs, dt, true);

  if (sharedLight && sharedLight.intensity > 0) {
    sharedLight.intensity = Math.max(0, sharedLight.intensity - dt * 34);
  }
  for (const t of tracerSlots) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / t.span) * 0.92;
    if (t.life <= 0) t.mesh.visible = false;
  }
  for (const f of starSlots) {
    if (f.life <= 0) continue;
    f.life -= dt;
    f.sprite.material.opacity = Math.max(0, f.life / f.span) * 0.97;
    if (f.life <= 0) f.sprite.visible = false;
  }

  // Brass: gravity, one bounce on the asphalt, a rest, then parked away.
  if (brass) {
    const { mesh, items, dummy } = brass;
    let dirty = false;
    for (let i = 0; i < items.length; i += 1) {
      const c = items[i];
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.y > 0.04 || c.vy > 0) {
        c.vy -= 9.5 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        c.rot += c.vr * dt;
        if (c.y < 0.04) { c.y = 0.04; c.vy *= -0.35; c.vx *= 0.6; c.vz *= 0.6; c.vr *= 0.5; }
      }
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(c.rot, c.rot * 0.7, 0);
      const s = c.life < 0.3 ? Math.max(0.01, c.life / 0.3) : 1;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (c.life <= 0) {
        dummy.position.set(0, -50, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      dirty = true;
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  }

  for (let i = shockRings.length - 1; i >= 0; i -= 1) {
    const r = shockRings[i];
    r.life -= dt;
    const t = 1 - r.life / r.span;
    const s = 1 + t * r.radius * 2.2;
    r.mesh.scale.set(s, s, s);
    r.mesh.material.opacity = 0.75 * (1 - t);
    if (r.life <= 0) {
      G.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
      shockRings.splice(i, 1);
    }
  }
}
