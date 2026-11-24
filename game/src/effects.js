// effects.js — gunfire and damage feedback. THE RECIPE IS LOCKED (owner
// approved, rounds 4-5): two THREE.Points pools wearing a soft round dot
// texture — sparks small and bright (size 0.36, pool 1800), smoke big and
// slow but THIN (size 1.55, opacity 0.32, pool 900) — short warm tracer
// dashes caught mid-flight (0xffb347, never a full beam), compact star
// muzzle flashes, brass casings. Per gunshot the smoke counts are tiny on
// purpose: 1 wisp at the muzzle, 2 dust at the impact. Anything bigger
// piles into solid clouds and the fight stops reading.

const SPARKS = 1800;
const SMOKES = 900;
const TRACERS = 64;
const FLASHES = 24;
const CASINGS = 128;

let sparkPts = null;
let sparkPos = null;
let sparkCol = null;
const sparkParts = [];
let sparkCursor = 0;
let smokePts = null;
let smokePos = null;
let smokeCol = null;
const smokeParts = [];
let smokeCursor = 0;
const tracerPool = [];
const flashPool = [];
let casingMesh = null;
const casings = [];
let casingObj = null;
let flashLight = null;
const colorTmp = new THREE.Color();

function makeSoftDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  // Compact star polygon.
  g.beginPath();
  const spikes = [[32, 2], [36.5, 27.5], [58, 32], [36.5, 36.5], [32, 58], [27.5, 36.5], [6, 32], [27.5, 27.5]];
  spikes.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 13);
  grad.addColorStop(0, 'rgba(255,214,90,1)');
  grad.addColorStop(0.55, 'rgba(255,166,48,0.95)');
  grad.addColorStop(1, 'rgba(255,110,26,0)');
  g.fillStyle = grad;
  g.fill();
  return new THREE.CanvasTexture(c);
}

export function initEffects(scene) {
  const dotTex = makeSoftDotTexture();
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
      size: 1.55, map: dotTex, vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false,
    }));
    smokePts.frustumCulled = false;
    scene.add(smokePts);
  }
  // Tracer dashes: short stretched boxes in a pool.
  const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
  for (let i = 0; i < TRACERS; i += 1) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false;
    scene.add(m);
    tracerPool.push({ mesh: m, life: 0, maxLife: 0.09 });
  }
  // Muzzle flash sprites.
  const flashTex = makeFlashTexture();
  for (let i = 0; i < FLASHES; i += 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.visible = false;
    scene.add(s);
    flashPool.push({ sprite: s, life: 0, maxLife: 0.055 });
  }
  flashLight = new THREE.PointLight(0xffb35e, 0, 15);
  scene.add(flashLight);
  // Shell casings: one instanced mesh of little brass boxes.
  casingMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 0.09), new THREE.MeshBasicMaterial({ color: 0xe0aa40 }), CASINGS);
  casingMesh.frustumCulled = false;
  casingObj = new THREE.Object3D();
  for (let i = 0; i < CASINGS; i += 1) casings.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, life: 0 });
  scene.add(casingMesh);
}

export function burst(x, y, z, colorHex, count = 6, power = 2, opts = {}) {
  colorTmp.setHex(colorHex);
  for (let n = 0; n < count; n += 1) {
    const i = sparkCursor;
    sparkCursor = (sparkCursor + 1) % SPARKS;
    const p = sparkParts[i];
    p.maxLife = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.7);
    p.life = p.maxLife;
    p.vx = (Math.random() - 0.5) * power * 2;
    p.vy = Math.random() * power * 1.4 + 0.5;
    p.vz = (Math.random() - 0.5) * power * 2;
    p.grav = opts.grav ?? 5;
    p.drag = opts.drag ?? 0.6;
    sparkPos.array[i * 3] = x;
    sparkPos.array[i * 3 + 1] = y;
    sparkPos.array[i * 3 + 2] = z;
    const shade = 0.75 + Math.random() * 0.4;
    sparkCol.array[i * 3] = colorTmp.r * shade;
    sparkCol.array[i * 3 + 1] = colorTmp.g * shade;
    sparkCol.array[i * 3 + 2] = colorTmp.b * shade;
  }
}

export function burstSmoke(x, y, z, count = 4, opts = {}) {
  colorTmp.setHex(opts.color ?? 0x8a8a8a);
  for (let n = 0; n < count; n += 1) {
    const i = smokeCursor;
    smokeCursor = (smokeCursor + 1) % SMOKES;
    const p = smokeParts[i];
    p.maxLife = (opts.life ?? 1.8) * (0.7 + Math.random() * 0.6);
    p.life = p.maxLife;
    const power = opts.power ?? 0.6;
    p.vx = (Math.random() - 0.5) * power;
    p.vy = (opts.rise ?? 0.5) * (0.6 + Math.random() * 0.6);
    p.vz = (Math.random() - 0.5) * power;
    p.drag = 0.4;
    smokePos.array[i * 3] = x + (Math.random() - 0.5) * 0.3;
    smokePos.array[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
    smokePos.array[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
    const shade = 0.85 + Math.random() * 0.3;
    smokeCol.array[i * 3] = colorTmp.r * shade;
    smokeCol.array[i * 3 + 1] = colorTmp.g * shade;
    smokeCol.array[i * 3 + 2] = colorTmp.b * shade;
  }
}

/** A short warm dash caught mid-flight between muzzle and target. */
export function tracer(x1, y1, z1, x2, y2, z2, colorHex = 0xffb347) {
  const slot = tracerPool.find((s) => s.life <= 0) || tracerPool[0];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz) || 1;
  const frac = Math.min(0.32, 3.2 / len); // the dash spans at most ~3.2 m
  const t0 = 0.35; // caught mid-flight, away from both ends
  slot.mesh.position.set(x1 + dx * (t0 + frac / 2), y1 + dy * (t0 + frac / 2), z1 + dz * (t0 + frac / 2));
  slot.mesh.lookAt(x2, y2, z2);
  slot.mesh.scale.set(1, 1, len * frac);
  slot.mesh.material.color.setHex(colorHex);
  slot.mesh.visible = true;
  slot.life = slot.maxLife;
}

export function muzzle(x, y, z, scale = 1) {
  const slot = flashPool.find((s) => s.life <= 0) || flashPool[0];
  slot.sprite.position.set(x, y, z);
  slot.sprite.scale.set(0.55 * scale, 0.55 * scale, 1);
  slot.sprite.material.rotation = Math.random() * Math.PI;
  slot.sprite.visible = true;
  slot.life = slot.maxLife;
  if (flashLight) {
    flashLight.position.set(x, y + 0.2, z);
    flashLight.intensity = 2.2 * scale;
  }
}

export function casing(x, y, z, heading) {
  const c = casings.find((k) => k.life <= 0) || casings[0];
  c.x = x;
  c.y = y;
  c.z = z;
  const side = heading + Math.PI / 2;
  c.vx = Math.sin(side) * (0.8 + Math.random() * 0.7);
  c.vz = Math.cos(side) * (0.8 + Math.random() * 0.7);
  c.vy = 1.6 + Math.random() * 0.8;
  c.rot = Math.random() * Math.PI;
  c.vr = (Math.random() - 0.5) * 14;
  c.life = 1.6;
}

/** One full gunshot: flash + dash + casing + the locked smoke counts. */
export function gunshotFx(x, y, z, tx, ty, tz, opts = {}) {
  muzzle(x, y, z, opts.flashScale ?? 1);
  tracer(x, y, z, tx, ty, tz, opts.color ?? 0xffb347);
  if (opts.casing !== false) casing(x, y - 0.1, z, opts.heading ?? 0);
  burstSmoke(x, y, z, 1, { color: 0x8a7f70, life: 1.1, rise: 0.55, power: 0.3 });
  burstSmoke(tx, ty, tz, 2, { color: 0x99876c, life: 1.15, rise: 0.55, power: 0.5 });
  burst(tx, ty, tz, 0xffcf7a, opts.sparks ?? 3, 1.6, { life: 0.4 });
}

export function explodeAt(x, z, radius = 7, sourceCar = null) {
  burst(x, 1.4, z, 0xffa63e, 46, 5, { life: 0.8 });
  burst(x, 1.4, z, 0xff5a2e, 30, 3.4, { life: 0.6 });
  burstSmoke(x, 1.6, z, 12, { color: 0x3a3a3a, life: 2.8, rise: 1.7, power: 1.7 });
  burstSmoke(x, 1.2, z, 7, { color: 0x6e6e6e, life: 2.1, rise: 1.15, power: 2.3 });
  muzzle(x, 1.5, z, 3.2);
}

export function updateEffects(dt) {
  for (let i = 0; i < SPARKS; i += 1) {
    const p = sparkParts[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { sparkPos.array[i * 3 + 1] = -999; continue; }
    p.vy -= p.grav * dt;
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d; p.vz *= d;
    sparkPos.array[i * 3] += p.vx * dt;
    sparkPos.array[i * 3 + 1] += p.vy * dt;
    sparkPos.array[i * 3 + 2] += p.vz * dt;
    if (sparkPos.array[i * 3 + 1] < 0.03) { sparkPos.array[i * 3 + 1] = 0.03; p.vy *= -0.4; }
  }
  sparkPos.needsUpdate = true;
  for (let i = 0; i < SMOKES; i += 1) {
    const p = smokeParts[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { smokePos.array[i * 3 + 1] = -999; continue; }
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d; p.vz *= d;
    smokePos.array[i * 3] += p.vx * dt;
    smokePos.array[i * 3 + 1] += p.vy * dt;
    smokePos.array[i * 3 + 2] += p.vz * dt;
  }
  smokePos.needsUpdate = true;
  for (const s of tracerPool) {
    if (s.life <= 0) { s.mesh.visible = false; continue; }
    s.life -= dt;
    s.mesh.material.opacity = Math.max(0, s.life / s.maxLife) * 0.9;
  }
  for (const s of flashPool) {
    if (s.life <= 0) { s.sprite.visible = false; continue; }
    s.life -= dt;
    s.sprite.material.opacity = Math.max(0, s.life / s.maxLife);
  }
  if (flashLight && flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 30);
  casings.forEach((c, i) => {
    if (c.life > 0) {
      c.life -= dt;
      c.vy -= 7 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.y < 0.04) { c.y = 0.04; c.vy *= -0.35; c.vx *= 0.6; c.vz *= 0.6; c.vr *= 0.5; }
      c.rot += c.vr * dt;
    }
    casingObj.position.set(c.x, Math.max(c.y, -99 * (c.life <= 0 ? 1 : 0)), c.z);
    if (c.life <= 0) casingObj.position.set(0, -99, 0);
    casingObj.rotation.set(c.rot, c.rot * 0.7, 0);
    casingObj.updateMatrix();
    casingMesh.setMatrixAt(i, casingObj.matrix);
  });
  casingMesh.instanceMatrix.needsUpdate = true;
}
