// Round fourteen note: the gunfire language is final and untouched —
// thin warm tracer dashes, small orange muzzle-tip stars, sparks,
// casings, and warm-grey smoke (0x8a7f70 muzzle, 0x99876c dust, opacity
// near 0.32). This round changes no effect, only records that fact.
// effects.js — visual feedback, all pooled, the hot loop allocates nothing.
// Two particle systems (hard sparks and soft smoke/dust), tracer streaks
// built from stretched glowing boxes so a gunfight reads across the street,
// muzzle-flash sprites with a shared point light, ejected shell casings that
// bounce on the asphalt, and the explosion shockwave rings. Round
// eight touches nothing in this file's behaviour — the recipe the
// owner approved (thin warm dashes, small warm stars, sparks and
// casings) is exactly what the two newly-firing staged officers now
// speak through gunshotFx; this note is the whole change here. combat.js, the
// officers and the rival crews all speak through gunshotFx so every shot in
// Puerto Alba looks the same: flash, streak, impact. Round six keeps the
// round-four/five recipe — compact warm muzzle stars, thin warm tracer
// dashes, warm-grey smoke — and verifies it from the combat shot's new
// angle, where the runner's flash now sits visibly on his muzzle instead
// of hiding behind him.
//
// Round three turns a firefight up: the pools grow by half again, tracers
// burn longer and thicker, muzzle flashes scale with the weapon and throw
// real light, every shot leaves a wisp of smoke hanging at the muzzle, and
// impacts answer harder — ricochet fans off asphalt and bodywork, dust
// blooms off masonry, casings by the dozen.
//
// Round four pulls the light back to the guns themselves, on the owner's
// word: the big soft flash sprites read as white blobs that hid the fight,
// and a tracer stretched the whole way read as a beam. Now a muzzle flash
// is a compact star of warm orange flame that lives for two frames at the
// barrel tip and nowhere else, and a tracer is a short, thin, warm dash
// caught mid-flight — the fight reads from the dashes, the sparks, the
// casings and the smoke, not from the glare.

// Round seven changes NO gunfire parameter in this file: tracer
// dashes, muzzle stars, sparks, casings and the round-five warm-grey
// smoke colours stay exactly as the owner approved them. The staged
// combat scene's thinner air is a staging decision in shots.js (half
// volley cadence, a whisper of car smoke), not a change here.
import { G } from './state.js';
import { sfx } from './audio.js';

// ------------------------------------------------------------- spark pool
const SPARKS = 1800;
let sparkPts = null, sparkPos = null, sparkCol = null;
const sparkParts = [];
let sparkCursor = 0;

// ------------------------------------------------------------- smoke pool
const SMOKES = 900;
let smokePts = null, smokePos = null, smokeCol = null;
const smokeParts = [];
let smokeCursor = 0;

const colorTmp = new THREE.Color();
let flashLight = null;
const rings = [];

// ------------------------------------------------------------- tracers
const TRACER_POOL = 110;
const tracerPool = []; // { mesh, life, maxLife }

// ------------------------------------------------------------- muzzle sprites
const FLASH_POOL = 26;
const flashPool = []; // { sprite, life, maxLife }

// ------------------------------------------------------------- shell casings
const CASING_POOL = 84;
let casingMesh = null;
const casings = []; // { x,y,z, vx,vy,vz, rot, vr, life }
let casingObj = null; // a reusable Object3D for composing casing matrices

/**
 * A soft round dot for the particle points. THREE.Points draws square
 * points unless a map says otherwise — unmapped, a 1.8 m smoke puff is a
 * hard-edged white BOX, and a street full of them reads as floating
 * panels. The radial alpha makes every point a puff instead; the vertex
 * colours still carry the tint.
 */
function makeSoftDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.62)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  // A compact four-point star of real gunfire colours: a small hot core in
  // deep yellow, arms of orange that die before they reach the edge. No
  // wide radial glow and nothing near white — the sprite is drawn small at
  // the muzzle, and what little halo it has stays inside its own frame.
  g.fillStyle = 'rgba(255,122,26,0.9)';
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(36.5, 27.5); g.lineTo(58, 32); g.lineTo(36.5, 36.5);
  g.lineTo(32, 58); g.lineTo(27.5, 36.5); g.lineTo(6, 32); g.lineTo(27.5, 27.5);
  g.closePath(); g.fill();
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 13);
  grad.addColorStop(0, 'rgba(255,214,90,1)');
  grad.addColorStop(0.55, 'rgba(255,166,48,0.95)');
  grad.addColorStop(1, 'rgba(255,110,26,0)');
  g.fillStyle = grad;
  g.fillRect(19, 19, 26, 26);
  return new THREE.CanvasTexture(c);
}

export function initEffects(scene) {
  const dotTex = makeSoftDotTexture();
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
      size: 0.36, map: dotTex, vertexColors: true, transparent: true, opacity: 0.97, depthWrite: false,
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
      // Opacity trimmed 0.36 → 0.32 in round five: overlapping puffs in a
      // sustained fight should haze the air, not pile into solid clouds.
      size: 1.55, map: dotTex, vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false,
    }));
    smokePts.frustumCulled = false;
    scene.add(smokePts);
  }

  // The flash light hugs the gun now: a short warm flicker that tints the
  // shooter's hands and the wall beside him, not a wash over the street.
  flashLight = new THREE.PointLight(0xffb35e, 0, 15);
  flashLight.position.set(0, 3, 0);
  scene.add(flashLight);

  // Tracer streaks: thin unit boxes, drawn as short dashes part-way along
  // the bullet's path (tracer() does the placing) — a volley still leaves
  // several in the air at once, but each one is a bullet, not a beam.
  const tGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const m = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({
      color: 0xffb347, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false;
    scene.add(m);
    tracerPool.push({ mesh: m, life: 0, maxLife: 0.09 });
  }

  // Muzzle flash sprites: small stars at the barrel tip, gone in two frames.
  const fTex = makeFlashTexture();
  for (let i = 0; i < FLASH_POOL; i += 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(0.4, 0.4, 1);
    sp.visible = false;
    scene.add(sp);
    flashPool.push({ sprite: sp, life: 0, maxLife: 0.05 });
  }

  // Shell casings: one instanced mesh, simulated by hand.
  casingMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.04, 0.028, 0.085),
    new THREE.MeshBasicMaterial({ color: 0xe0aa40 }), CASING_POOL);
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

/**
 * A gunshot tracer: not the whole path — a short warm dash caught in
 * flight, its head about three quarters of the way to the target. From a
 * volley of these the eye still draws the line of fire, but no single
 * streak ever spans the street.
 */
export function tracer(x1, y1, z1, x2, y2, z2, colorHex = 0xffb347) {
  const slot = tracerPool.find((t) => t.life <= 0) ?? tracerPool[0];
  if (!slot) return;
  const m = slot.mesh;
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.max(0.1, Math.hypot(dx, dy, dz));
  const dash = Math.min(3.4, Math.max(1.1, len * 0.3));
  const head = 0.78; // where along the path the dash's nose sits
  const cx = x1 + dx * head - (dx / len) * dash / 2;
  const cy = y1 + dy * head - (dy / len) * dash / 2;
  const cz = z1 + dz * head - (dz / len) * dash / 2;
  m.position.set(cx, cy, cz);
  m.lookAt(x2, y2, z2);
  m.scale.set(1, 1, dash);
  m.material.color.setHex(colorHex);
  m.material.opacity = 0.92;
  m.visible = true;
  slot.life = slot.maxLife;
}

/**
 * Muzzle flash: a small star sprite pinned to the barrel tip plus the
 * shared light's brief flicker. `scale` follows the weapon — a shotgun's
 * star is broader than a pistol's snap, and both stay under half a metre.
 */
export function muzzle(x, y, z, scale = 1) {
  if (flashLight) { flashLight.position.set(x, y, z); flashLight.intensity = 1.15 + scale * 0.5; }
  const slot = flashPool.find((f) => f.life <= 0) ?? flashPool[0];
  if (slot) {
    const s = (0.3 + Math.random() * 0.09) * scale;
    slot.sprite.position.set(x, y, z);
    slot.sprite.scale.set(s, s, 1);
    slot.sprite.material.opacity = 0.95;
    slot.sprite.material.rotation = Math.random() * Math.PI;
    slot.sprite.visible = true;
    slot.life = slot.maxLife;
  }
  burst(x, y, z, 0xffb35e, 2, 0.9, { life: 0.1, up: 0.2 });
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
  c.life = 1.6;
}

/**
 * One complete gunshot, drawn: a scaled muzzle flash and a casing at the
 * origin, a tracer streak to the target, a breath of smoke that hangs at
 * the muzzle, and the right impact where it lands — a ricochet fan of
 * sparks off metal and asphalt ('spark'), a dust bloom off masonry and
 * ground ('dust'), a flinch of red off a person ('flesh').
 */
export function gunshotFx(x, y, z, tx, ty, tz, opts = {}) {
  muzzle(x, y, z, opts.flash ?? 1);
  if (opts.casing !== false) casing(x, y, z, opts.heading ?? 0);
  tracer(x, y, z, tx, ty, tz, opts.color ?? 0xffb347);
  // Powder smoke drifts out of the muzzle and stays a moment — a sustained
  // fight hazes its own air. Round five sets the colour: a warm mid-grey
  // (0x8a7f70), dusk-tinted. The old near-white 0xcfd2cd stacked a whole
  // volley's worth of wisps into bright steam clouds around the fight,
  // which the owner flagged twice — gun smoke is grey, never white.
  burstSmoke(x, y, z, 1, { color: 0x8a7f70, life: 1.1, rise: 0.55, power: 0.3 });
  if (opts.hit === 'spark') {
    burst(tx, ty, tz, 0xffcf5e, 9, 2.3, { life: 0.45 });
    burst(tx, ty, tz, 0xfff0b8, 4, 1.4, { life: 0.3 });
    // The ricochet: a flat fan skimming away along the surface.
    burst(tx, 0.12, tz, 0xffb84d, 5, 2.6, { life: 0.5, up: 0.22, baseVy: 0.15, spread: 1.4 });
  } else if (opts.hit === 'dust') {
    burst(tx, ty, tz, 0xcbb79a, 7, 1.5, { life: 0.55, up: 0.55 });
    // Impact dust: the same round-five rule as the muzzle smoke — a
    // deeper warm grey-brown (0x99876c), dust at dusk, not pale steam.
    burstSmoke(tx, ty, tz, 2, { color: 0x99876c, life: 1.15, rise: 0.55, power: 0.5 });
  } else if (opts.hit === 'flesh') {
    burst(tx, ty, tz, 0x9e2f26, 6, 1.6, { life: 0.45 });
  }
}

/** The full explosion: fireball, smoke column, shockwave ring, sound, shake. */
export function explodeAt(x, z, radius = 7, sourceCar = null) {
  burst(x, 1, z, 0xff7a2e, 38, 6.4, { life: 0.8, up: 1.4 });
  burst(x, 1.4, z, 0xffc37a, 24, 4.6, { life: 0.5, up: 1.2 });
  burst(x, 2, z, 0x2c2c2c, 16, 2.6, { life: 1.4, up: 1.4, grav: 1.0 });
  burstSmoke(x, 1.6, z, 12, { color: 0x3a3a3a, life: 2.8, rise: 1.7, power: 1.7 });
  burstSmoke(x, 1.2, z, 7, { color: 0x6e6e6e, life: 2.1, rise: 1.15, power: 2.3 });
  if (flashLight) { flashLight.position.set(x, 2.5, z); flashLight.intensity = 6; }
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
  if (flashLight && flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 34);

  for (const t of tracerPool) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.92;
    if (t.life <= 0) t.mesh.visible = false;
  }
  for (const f of flashPool) {
    if (f.life <= 0) continue;
    f.life -= dt;
    f.sprite.material.opacity = Math.max(0, f.life / f.maxLife) * 0.97;
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
