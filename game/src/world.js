// world.js — the stage itself: renderer, a painted gradient sky with a sun
// glow and drifting clouds, the slow day cycle, the sea, palm avenues,
// streetlights that glow at dusk, and the beach dressing. city.js builds the
// streets and buildings; this file makes them feel like a golden-hour port —
// lamp halos, a wet sheen on the boulevard after dark, and the Ferris wheel
// turning over the bay. Round eight changes no light or grade: the
// dusk FALCON-1 now hangs in is this file's same golden hour, and the
// combat frame's warm 18:16 is the light it was always judged under. Round six changes no light or grade: the fascia's
// clearance from the orange trim is geometry (city.js), and the warm
// 18:15 light the combat frame is judged under is this file's, as was.
//
// Round three is the grade: ACES filmic tone mapping over the whole frame,
// a day palette pushed deeper and more saturated (azure into gold into
// rose, with a painted band between zenith and horizon), a warm sun against
// a cool blue hemisphere fill whose ground bounce warms at dusk, and less
// ambient wash so shadows hold their contrast. Round five keeps this
// grade untouched — it is the light the warmer, greyer gun smoke of the
// effects pass was tuned against.

// Round seven judges the mirrored combat frame under this file's
// same 18:15 golden light — no sky, grade or lamp changes; only the
// lens and the staging in shots.js moved.
import { G } from './state.js';
import { BOULEVARD_X, ROADS_X, ROADS_Z, CITY_BOUNDS, addCollider } from './city.js';
import { makeRng, lerp, clamp } from './util.js';

// Sky/fog/sun colours across the day. Puerto Alba lives near the warm end,
// and round three pushes every stop toward saturation: the midday azure is
// deeper, the golden hour hotter, the dusk band rose against teal shadow.
const DAY_STOPS = [
  { h: 0.0, sky: 0x131c31, skyTop: 0x0a1224, band: 0x1a2440, fog: 0x1b2740, sun: 0x223355, sunI: 0.12, hemiI: 0.25, amb: 0x2a3550, gnd: 0x1e2638 },
  { h: 5.5, sky: 0x27304f, skyTop: 0x131c38, band: 0x4a4468, fog: 0x353c5c, sun: 0x445588, sunI: 0.2, hemiI: 0.3, amb: 0x35405c, gnd: 0x2c3048 },
  { h: 7.0, sky: 0xf59a58, skyTop: 0x6a7cc4, band: 0xe88a7a, fog: 0xf5b878, sun: 0xffab5e, sunI: 0.9, hemiI: 0.48, amb: 0xffdcb0, gnd: 0x5c4a3c },
  { h: 12.0, sky: 0x54b6ec, skyTop: 0x2b6cd4, band: 0x6fc3ee, fog: 0xbfe0ea, sun: 0xfff2d8, sunI: 1.32, hemiI: 0.66, amb: 0xf4f9ff, gnd: 0x51624e },
  // The 16:30 stop deepened a shade in round four (0x63bcec → 0x58aee6):
  // the cover frame sits at 17:33, between here and the 18:00 gold, and
  // its sky read washed against the market's new sign.
  { h: 16.5, sky: 0x58aee6, skyTop: 0x3a78c8, band: 0x74c2e6, fog: 0xcfe4da, sun: 0xffe9bb, sunI: 1.22, hemiI: 0.6, amb: 0xfff0d8, gnd: 0x55624a },
  { h: 18.0, sky: 0xffab52, skyTop: 0x4c63b4, band: 0xf28a5e, fog: 0xf7ab66, sun: 0xff8438, sunI: 1.05, hemiI: 0.5, amb: 0xffd9a8, gnd: 0x6e4c34 },
  { h: 19.3, sky: 0x5f5296, skyTop: 0x2c2a55, band: 0xb05a7a, fog: 0x9c6a84, sun: 0xff7040, sunI: 0.42, hemiI: 0.34, amb: 0xc9a0c0, gnd: 0x4c3644 },
  { h: 20.3, sky: 0x1d2745, skyTop: 0x0d1428, band: 0x232c4c, fog: 0x27324e, sun: 0x334466, sunI: 0.14, hemiI: 0.27, amb: 0x303c5c, gnd: 0x1e2638 },
  { h: 24.0, sky: 0x131c31, skyTop: 0x0a1224, band: 0x1a2440, fog: 0x1b2740, sun: 0x223355, sunI: 0.12, hemiI: 0.25, amb: 0x2a3550, gnd: 0x1e2638 },
];

const cA = new THREE.Color(), cB = new THREE.Color();
function lerpColor(target, hexA, hexB, t) {
  cA.setHex(hexA); cB.setHex(hexB);
  target.copy(cA).lerp(cB, t);
}

let oceanTex = null;
let lampMat = null;
let lampGlowMat = null;
let boatsRef = [];
let ferrisRef = null;
let skyTex = null;
let skyCtx = null;
let skyCanvas = null;
let skyHourDrawn = -1;

export function setBoats(boats) { boatsRef = boats; }
export function setFerris(ferris) { ferrisRef = ferris; }

/** Create renderer, scene, camera and all dressing. Returns the renderer. */
export function initWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The grade: filmic tone mapping rolls the highlights off and deepens
  // the midtones everywhere at once — sky, paint, skin, asphalt.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7ab66, 170, 820);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
  camera.position.set(-190, 8, 30);

  const hemi = new THREE.HemisphereLight(0xffe4bb, 0x4a5a48, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9440, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  Object.assign(G, { renderer, scene, camera, sun, hemi });
  G.sunTarget = sun.target;

  buildSky(scene);
  buildOcean(scene);
  buildPalms(scene);
  buildStreetlights(scene);
  buildBeachLife(scene);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  applyDayCycle(); // first paint matches the clock
  return renderer;
}

/**
 * The sky: a big inverted sphere wearing a canvas gradient — zenith at the
 * top, a saturated band of the hour's colour beneath it, horizon colour at
 * the bottom, a soft sun glow where the sun rides, and a few flat cloud
 * smudges. Repainted only when the hour moves on.
 */
function buildSky(scene) {
  skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1024; skyCanvas.height = 512;
  skyCtx = skyCanvas.getContext('2d');
  skyTex = new THREE.CanvasTexture(skyCanvas);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  scene.add(dome);
  G.skyDome = dome;
}

function paintSky(topHex, bandHex, horHex, sunElev, sunAzim01, warm) {
  const g = skyCtx;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  const top = `#${new THREE.Color(topHex).getHexString()}`;
  const band = `#${new THREE.Color(bandHex).getHexString()}`;
  const hor = `#${new THREE.Color(horHex).getHexString()}`;
  grad.addColorStop(0, top);
  grad.addColorStop(0.34, band);
  grad.addColorStop(0.55, hor);
  grad.addColorStop(0.62, hor);
  grad.addColorStop(1, hor);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // The sun's glow, wrapped around the horizon at its azimuth.
  const sx = ((sunAzim01 % 1) + 1) % 1 * 1024;
  const sy = 300 - sunElev * 190;
  for (const ox of [-1024, 0, 1024]) {
    const glow = g.createRadialGradient(sx + ox, sy, 8, sx + ox, sy, 300);
    glow.addColorStop(0, `rgba(255,238,196,${0.9 * warm})`);
    glow.addColorStop(0.25, `rgba(255,192,112,${0.5 * warm})`);
    glow.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = glow;
    g.fillRect(sx + ox - 300, sy - 300, 600, 600);
  }
  // Cloud smudges, tinted by the hour's warmth.
  g.fillStyle = `rgba(255,${Math.floor(230 - warm * 60)},${Math.floor(225 - warm * 90)},0.20)`;
  const rng = makeRng(77);
  for (let i = 0; i < 16; i += 1) {
    const cx = rng() * 1024, cy = 40 + rng() * 190, w = 90 + rng() * 200;
    g.beginPath();
    g.ellipse(cx, cy, w, 9 + rng() * 13, 0, 0, Math.PI * 2);
    g.fill();
  }
  skyTex.needsUpdate = true;
}

function buildOcean(scene) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2d7ea8'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    g.beginPath();
    const y = i * 16 + 4;
    g.moveTo(0, y);
    for (let x = 0; x <= 128; x += 16) g.lineTo(x, y + Math.sin(x * 0.2 + i) * 2.5);
    g.stroke();
  }
  oceanTex = new THREE.CanvasTexture(c);
  oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping;
  oceanTex.repeat.set(10, 60);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(340, 680),
    new THREE.MeshPhongMaterial({ color: 0x9fd4e8, map: oceanTex, shininess: 90, specular: 0x99ccee }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-430, -0.4, 0);
  scene.add(sea);
}

function buildPalms(scene) {
  const rng = makeRng(99);
  const spots = [];
  for (let z = -300; z < 310; z += 11) {
    spots.push({ x: BOULEVARD_X - 10.8, z: z + rng() * 4, lean: (rng() - 0.5) * 0.16, s: 0.85 + rng() * 0.45 });
    if (rng() < 0.75) spots.push({ x: BOULEVARD_X + 10.8, z: z + 6, lean: (rng() - 0.5) * 0.16, s: 0.85 + rng() * 0.45 });
    if (rng() < 0.55) spots.push({ x: -240 + rng() * 7, z, lean: (rng() - 0.5) * 0.24, s: 0.8 + rng() * 0.5 });
  }
  // Palms along the promenade and around the plaza and marina.
  for (let z = -120; z < 130; z += 15) {
    if (rng() < 0.7) spots.push({ x: -202 + rng() * 3, z, lean: (rng() - 0.5) * 0.2, s: 0.8 + rng() * 0.4 });
  }
  for (const rz of ROADS_Z) for (let i = 0; i < 3; i += 1) {
    spots.push({ x: -140 + rng() * 380, z: rz + (rng() < 0.5 ? -10.8 : 10.8), lean: (rng() - 0.5) * 0.1, s: 0.8 + rng() * 0.35 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, 7.5, 6);
  trunkGeo.translate(0, 3.75, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
  // A fan of fronds reads far better than the old cone: five crossed planes
  // of painted fronds at the crown, instanced as one geometry.
  const frondTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#2f8f3e'; g.lineWidth = 5; g.lineCap = 'round';
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      g.beginPath();
      g.moveTo(64, 64);
      g.quadraticCurveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 30 - 12, 64 + Math.cos(a) * 60, 64 + Math.sin(a) * 56 + 14);
      g.stroke();
    }
    return new THREE.CanvasTexture(c);
  })();
  const crownGeo = new THREE.PlaneGeometry(6.4, 6.4);
  crownGeo.translate(0, 7.7, 0);
  const crownMat = new THREE.MeshLambertMaterial({ map: frondTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crownsA = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const crownsB = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach((p, i) => {
    e.set(p.lean, rng() * Math.PI, p.lean * 0.6);
    q.setFromEuler(e);
    const sc = new THREE.Vector3(p.s, p.s, p.s);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, sc);
    trunks.setMatrixAt(i, m4);
    crownsA.setMatrixAt(i, m4);
    e.y += Math.PI / 3;
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, sc);
    crownsB.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  scene.add(trunks); scene.add(crownsA); scene.add(crownsB);
}

function buildStreetlights(scene) {
  const spots = [];
  for (let z = -300; z < 310; z += 40) { spots.push([BOULEVARD_X - 8.6, z]); spots.push([BOULEVARD_X + 8.6, z + 20]); }
  for (const rx of ROADS_X) for (let z = -280; z < 300; z += 80) spots.push([rx + 8.6, z]);
  for (const rz of ROADS_Z) for (let x = -140; x < 290; x += 80) spots.push([x, rz - 8.6]);
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 5);
  poleGeo.translate(0, 2.8, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  lampMat = new THREE.MeshBasicMaterial({ color: 0x554e33 });
  const lampGeo = new THREE.BoxGeometry(0.7, 0.22, 0.7);
  lampGeo.translate(0, 5.6, 0);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z], i) => { m4.setPosition(x, 0, z); poles.setMatrixAt(i, m4); lamps.setMatrixAt(i, m4); });
  scene.add(poles); scene.add(lamps);

  // The dusk halo: one Points cloud of soft sprites at every lamp head.
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,220,150,0.9)');
  grad.addColorStop(0.4, 'rgba(255,190,100,0.35)');
  grad.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(c);
  const pos = new Float32Array(spots.length * 3);
  spots.forEach(([x, z], i) => { pos[i * 3] = x; pos[i * 3 + 1] = 5.6; pos[i * 3 + 2] = z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lampGlowMat = new THREE.PointsMaterial({
    size: 5.2, map: glowTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const glow = new THREE.Points(geo, lampGlowMat);
  glow.frustumCulled = false;
  scene.add(glow);
}

function buildBeachLife(scene) {
  const rng = makeRng(2024);
  // Umbrellas and loungers down Playa Brava, denser than round one.
  const umbTones = [0xff5a4d, 0xffb340, 0x57d7e8, 0xff7ab0, 0xf2e13c, 0x7be382];
  const umbGeo = new THREE.ConeGeometry(2.0, 0.75, 8);
  const umb = new THREE.InstancedMesh(umbGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 38);
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0xdddddd }), 38);
  const loungerGeo = new THREE.BoxGeometry(0.7, 0.16, 1.9);
  const loungers = new THREE.InstancedMesh(loungerGeo, new THREE.MeshLambertMaterial({ color: 0xf2ead8 }), 38);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 38; i += 1) {
    const x = -234 + rng() * 9, z = -278 + i * 15.2 + rng() * 8;
    m4.setPosition(x, 2.5, z); umb.setMatrixAt(i, m4);
    umb.setColorAt(i, col.setHex(umbTones[i % umbTones.length]));
    m4.setPosition(x, 1.25, z); poles.setMatrixAt(i, m4);
    e.set(-0.35, rng() * 0.8 - 0.4, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x + 1.4, 0.28, z + 0.8), q, one);
    loungers.setMatrixAt(i, m4);
  }
  scene.add(umb); scene.add(poles); scene.add(loungers);
  // Beach towels: bright rectangles of a lazy afternoon, instanced.
  const towelGeo = new THREE.BoxGeometry(0.95, 0.04, 1.9);
  const towels = new THREE.InstancedMesh(towelGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 26);
  for (let i = 0; i < 26; i += 1) {
    const x = -236 + rng() * 10, z = -270 + i * 21 + rng() * 10;
    e.set(0, rng() * 0.9 - 0.45, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 0.1, z), q, one);
    towels.setMatrixAt(i, m4);
    towels.setColorAt(i, col.setHex(umbTones[(i * 2 + 1) % umbTones.length]));
  }
  scene.add(towels);

  // Crates by the marina and the warehouse — a few of them solid.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xb08954 });
  const crateSpots = [];
  for (let i = 0; i < 16; i += 1) crateSpots.push({ x: -196 + rng() * 30 - 15, z: 214 + rng() * 40, s: 1.4 + rng() * 1.2 });
  for (let i = 0; i < 12; i += 1) crateSpots.push({ x: 222 + rng() * 30, z: 222 + rng() * 30, s: 1.4 + rng() * 1.2 });
  const crates = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), crateMat, crateSpots.length);
  crateSpots.forEach((p, i) => {
    m4.makeRotationY(rng() * Math.PI);
    m4.scale(new THREE.Vector3(p.s, p.s, p.s));
    m4.setPosition(p.x, p.s / 2, p.z);
    crates.setMatrixAt(i, m4);
    if (G.city) addCollider(G.city, { minX: p.x - p.s / 2, maxX: p.x + p.s / 2, minZ: p.z - p.s / 2, maxZ: p.z + p.s / 2 });
  });
  crates.castShadow = true;
  scene.add(crates);

  // Hydrants sprinkled on sidewalks (visual only).
  const hydGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.8, 6);
  hydGeo.translate(0, 0.4, 0);
  const hydrants = new THREE.InstancedMesh(hydGeo, new THREE.MeshLambertMaterial({ color: 0xd8402e }), 44);
  for (let i = 0; i < 44; i += 1) {
    const onX = rng() < 0.5;
    const x = onX ? ROADS_X[Math.floor(rng() * ROADS_X.length)] + 9.4 : -180 + rng() * 420;
    const z = onX ? -280 + rng() * 560 : ROADS_Z[Math.floor(rng() * ROADS_Z.length)] + 9.4;
    m4.identity(); m4.setPosition(x, 0, z);
    hydrants.setMatrixAt(i, m4);
  }
  scene.add(hydrants);
}

/** Advance the clock and repaint sky, fog, sun and lamps for the new hour. */
export function updateWorld(dt) {
  G.timeHours = (G.timeHours + (dt / G.dayLengthSec) * 24) % 24;
  G.elapsed += dt;
  applyDayCycle();
  if (oceanTex) oceanTex.offset.x = (G.elapsed * 0.008) % 1;
  if (G.skyDome) { // the dome follows the camera so the horizon never nears
    G.skyDome.position.set(G.camera.position.x, 0, G.camera.position.z);
  }
  for (let i = 0; i < boatsRef.length; i += 1) {
    const b = boatsRef[i];
    b.position.y = Math.sin(G.elapsed * 0.7 + i * 1.7) * 0.16;
    b.rotation.z = Math.sin(G.elapsed * 0.5 + i) * 0.02;
  }
  if (ferrisRef) {
    ferrisRef.spinner.rotation.x += dt * 0.14;
    for (const cab of ferrisRef.cabins) cab.rotation.x = -ferrisRef.spinner.rotation.x;
  }
}

function applyDayCycle() {
  const h = G.timeHours;
  let a = DAY_STOPS[0], b = DAY_STOPS[DAY_STOPS.length - 1];
  for (let i = 0; i < DAY_STOPS.length - 1; i += 1) {
    if (h >= DAY_STOPS[i].h && h <= DAY_STOPS[i + 1].h) { a = DAY_STOPS[i]; b = DAY_STOPS[i + 1]; break; }
  }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const scene = G.scene;
  if (!scene) return;
  lerpColor(scene.fog.color, a.fog, b.fog, t);
  lerpColor(G.sun.color, a.sun, b.sun, t);
  G.sun.intensity = lerp(a.sunI, b.sunI, t);
  G.hemi.intensity = lerp(a.hemiI, b.hemiI, t);
  lerpColor(G.hemi.color, a.amb, b.amb, t);
  lerpColor(G.hemi.groundColor, a.gnd, b.gnd, t);

  // Sun path: rises in the east (+x), arcs south, and sets in the west over
  // the sea (-x) — so evening facades that face the water catch the gold.
  const dayT = clamp((h - 6) / 13, 0, 1);
  const sunAng = dayT * Math.PI;
  const elev = Math.sin(sunAng) * 0.92 + 0.05;
  const px = G.player ? G.player.x : 0, pz = G.player ? G.player.z : 0;
  G.sun.position.set(px + Math.cos(sunAng) * 280, elev * 300 + 12, pz + 70);
  G.sunTarget.position.set(px, 0, pz);

  const dusk = h > 17.4 || h < 6.4;
  if (lampMat) lampMat.color.setHex(dusk ? 0xffd98a : 0x554e33);
  if (lampGlowMat) lampGlowMat.opacity = dusk ? 0.75 : 0;
  if (G.city?.wetStripMat) G.city.wetStripMat.opacity = dusk ? 0.33 : 0.05;
  if (G.city?.puddleMat) G.city.puddleMat.opacity = dusk ? 0.5 : 0.14;
  if (G.city?.stringLightsMat) G.city.stringLightsMat.opacity = dusk ? 0.95 : 0;
  G.isDusk = dusk;

  // Repaint the sky dome when the hour has moved enough to matter.
  if (skyCtx && Math.abs(h - skyHourDrawn) > 0.06) {
    skyHourDrawn = h;
    const topC = new THREE.Color(), bandC = new THREE.Color(), horC = new THREE.Color();
    lerpColor(topC, a.skyTop, b.skyTop, t);
    lerpColor(bandC, a.band, b.band, t);
    lerpColor(horC, a.sky, b.sky, t);
    const warm = clamp(G.sun.intensity, 0, 1.2) * (h > 15 || h < 8 ? 1 : 0.45);
    paintSky(topC.getHex(), bandC.getHex(), horC.getHex(), elev, 0.78 - dayT * 0.52, warm);
  }
}

/** Keep a point inside the playable bounds (sea blocks the west). */
export function clampToCity(p) {
  p.x = clamp(p.x, CITY_BOUNDS.minX, CITY_BOUNDS.maxX);
  p.z = clamp(p.z, CITY_BOUNDS.minZ, CITY_BOUNDS.maxZ);
  return p;
}
