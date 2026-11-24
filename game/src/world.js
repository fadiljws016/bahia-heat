// world.js — renderer, sky, light and sea for Puerto Alba. The grade is
// pinned: ACES filmic at 1.12 over a painted gradient sky whose stops come
// from the DAY STOPS table — the wide warm horizon (0.55 → 1.0) is what
// keeps golden hour dusty instead of saturated.

import { G } from './state.js';
import { clamp, lerp, makeRng } from './util.js';
import { buildCityData, buildCityMeshes, ROADS_Z, BOULEVARD_X, CITY_BOUNDS } from './city.js';

// (h, sky, skyTop, band, fog, sun, sunI, hemiI, amb, gnd)
const DAY_STOPS = [
  { h: 0.0, sky: 0x131c31, skyTop: 0x0a1224, band: 0x1a2440, fog: 0x1b2740, sun: 0x223355, sunI: 0.12, hemiI: 0.25, amb: 0x2a3550, gnd: 0x1e2638 },
  { h: 5.5, sky: 0x27304f, skyTop: 0x131c38, band: 0x4a4468, fog: 0x353c5c, sun: 0x445588, sunI: 0.2, hemiI: 0.3, amb: 0x35405c, gnd: 0x2c3048 },
  { h: 7.0, sky: 0xf59a58, skyTop: 0x6a7cc4, band: 0xe88a7a, fog: 0xf5b878, sun: 0xffab5e, sunI: 0.9, hemiI: 0.48, amb: 0xffdcb0, gnd: 0x5c4a3c },
  { h: 12.0, sky: 0x54b6ec, skyTop: 0x2b6cd4, band: 0x6fc3ee, fog: 0xbfe0ea, sun: 0xfff2d8, sunI: 1.32, hemiI: 0.66, amb: 0xf4f9ff, gnd: 0x51624e },
  { h: 16.5, sky: 0x58aee6, skyTop: 0x3a78c8, band: 0x74c2e6, fog: 0xcfe4da, sun: 0xffe9bb, sunI: 1.22, hemiI: 0.6, amb: 0xfff0d8, gnd: 0x55624a },
  { h: 18.0, sky: 0xffab52, skyTop: 0x4c63b4, band: 0xf28a5e, fog: 0xf7ab66, sun: 0xff8438, sunI: 1.05, hemiI: 0.5, amb: 0xffd9a8, gnd: 0x6e4c34 },
  { h: 19.3, sky: 0x5f5296, skyTop: 0x2c2a55, band: 0xb05a7a, fog: 0x9c6a84, sun: 0xff7040, sunI: 0.42, hemiI: 0.34, amb: 0xc9a0c0, gnd: 0x4c3644 },
  { h: 20.3, sky: 0x1d2745, skyTop: 0x0d1428, band: 0x232c4c, fog: 0x27324e, sun: 0x334466, sunI: 0.14, hemiI: 0.27, amb: 0x303c5c, gnd: 0x1e2638 },
  { h: 24.0, sky: 0x131c31, skyTop: 0x0a1224, band: 0x1a2440, fog: 0x1b2740, sun: 0x223355, sunI: 0.12, hemiI: 0.25, amb: 0x2a3550, gnd: 0x1e2638 },
];

const _ca = new THREE.Color(), _cb = new THREE.Color();
function mixHex(a, b, t, target) {
  _ca.setHex(a); _cb.setHex(b);
  target.copy(_ca).lerp(_cb, t);
  return target;
}

function dayState(hours) {
  let i = 0;
  while (i < DAY_STOPS.length - 2 && DAY_STOPS[i + 1].h <= hours) i++;
  const A = DAY_STOPS[i], B = DAY_STOPS[i + 1];
  const t = clamp((hours - A.h) / (B.h - A.h || 1), 0, 1);
  const out = { t };
  for (const k of ['sky', 'skyTop', 'band', 'fog', 'sun', 'amb', 'gnd']) out[k] = new THREE.Color();
  for (const k of ['sky', 'skyTop', 'band', 'fog', 'sun', 'amb', 'gnd']) mixHex(A[k], B[k], t, out[k]);
  out.sunI = lerp(A.sunI, B.sunI, t);
  out.hemiI = lerp(A.hemiI, B.hemiI, t);
  return out;
}

// --- Sky dome: a painted 1024x512 gradient, repainted only on hour change.
let _skyCanvas, _skyCtx, _skyTex, _skyHour = -1;
function paintSky(state, hours) {
  const g = _skyCtx;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, `#${state.skyTop.getHexString()}`);
  grad.addColorStop(0.34, `#${state.band.getHexString()}`);
  grad.addColorStop(0.55, `#${state.sky.getHexString()}`);
  grad.addColorStop(0.62, `#${state.sky.getHexString()}`);
  grad.addColorStop(1, `#${state.sky.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // Sun glow: warmth follows the sun's height; the disc sits low at dusk.
  const dayFrac = ((hours - 6) / 12 + 1) % 1;
  const sunX = 140 + dayFrac * 744;
  const sunY = 300 - Math.sin(clamp((hours - 6) / 12, 0, 1) * Math.PI) * 190;
  const warm = clamp(state.sunI, 0, 1);
  const glow = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  glow.addColorStop(0, `rgba(255,238,196,${0.9 * warm})`);
  glow.addColorStop(0.25, `rgba(255,192,112,${0.5 * warm})`);
  glow.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 1024, 512);
  // Flat cloud smudges, tinted by the hour.
  const rng = makeRng(99);
  g.fillStyle = `rgba(255,235,220,${0.10 + warm * 0.08})`;
  for (let i = 0; i < 9; i++) {
    const x = rng() * 1024, y = 40 + rng() * 150, w = 90 + rng() * 200;
    g.beginPath();
    g.ellipse(x, y, w, 9 + rng() * 10, 0, 0, 7);
    g.fill();
  }
  _skyTex.needsUpdate = true;
}

let _sun, _hemi, _amb, _ocean, _skyMesh;
let _boatsRef = null, _ferrisRef = null;
export function setBoats(boats) { _boatsRef = boats; }
export function setFerris(ferris) { _ferrisRef = ferris; }

export function initWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7ab66, 170, 820);
  const camera = new THREE.PerspectiveCamera(58, (container.clientWidth || 1280) / (container.clientHeight || 720), 0.1, 1600);
  camera.position.set(-196, 2, 4);
  camera.lookAt(-190, 1.2, -6);
  scene.userData.camera = camera;

  G.renderer = renderer;
  G.scene = scene;
  G.camera = camera;

  _hemi = new THREE.HemisphereLight(0xffe4bb, 0x4a5a48, 0.55);
  scene.add(_hemi);
  _amb = new THREE.AmbientLight(0xffd9a8, 0.35);
  scene.add(_amb);
  _sun = new THREE.DirectionalLight(0xff9440, 1.0);
  _sun.castShadow = true;
  _sun.shadow.mapSize.set(2048, 2048);
  _sun.shadow.camera.left = -90; _sun.shadow.camera.right = 90;
  _sun.shadow.camera.top = 90; _sun.shadow.camera.bottom = -90;
  _sun.shadow.camera.far = 700;
  _sun.shadow.bias = -0.0006;
  scene.add(_sun);
  scene.add(_sun.target);

  // Sky dome.
  _skyCanvas = document.createElement('canvas');
  _skyCanvas.width = 1024; _skyCanvas.height = 512;
  _skyCtx = _skyCanvas.getContext('2d');
  _skyTex = new THREE.CanvasTexture(_skyCanvas);
  _skyTex.colorSpace = THREE.SRGBColorSpace;
  _skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 24, 14),
    new THREE.MeshBasicMaterial({ map: _skyTex, side: THREE.BackSide, fog: false }));
  scene.add(_skyMesh);

  // The city itself.
  const data = buildCityData(7);
  G.city = data;
  buildCityMeshes(scene, data, 7);

  // Ocean: a bright phong sheet west of the beach.
  _ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 900),
    new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 90, specular: 0x99ccee }));
  _ocean.rotation.x = -Math.PI / 2;
  _ocean.position.set(-610, -0.25, 0);
  scene.add(_ocean);

  buildPalms(scene);
  buildBoatsAndFerris(scene);
  applyHour(G.timeHours, true);
  return { renderer, scene, camera };
}

// Palms: bent-segment trunks are faked with a straight tapered cylinder and
// a painted frond crown — two crossed instanced planes per palm.
function buildPalms(scene) {
  const rng = makeRng(2024);
  const spots = [];
  for (let z = -120; z <= 130; z += 15) {
    if (rng() < 0.7) spots.push({ x: -202 + rng() * 3, z, lean: (rng() - 0.5) * 0.2, s: 0.8 + rng() * 0.4 });
  }
  for (const rz of ROADS_Z) {
    for (let i = 0; i < 3; i++) {
      spots.push({ x: -140 + rng() * 380, z: rz + (rng() < 0.5 ? -10.8 : 10.8), lean: (rng() - 0.5) * 0.1, s: 0.8 + rng() * 0.35 });
    }
  }
  for (let z = -285; z <= 285; z += 30) {
    if (ROADS_Z.some((lz) => Math.abs(z - lz) < 13)) continue;
    spots.push({ x: BOULEVARD_X, z, lean: (rng() - 0.5) * 0.08, s: 0.85 + rng() * 0.3 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, 7.5, 6);
  trunkGeo.translate(0, 3.75, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  trunks.castShadow = true;
  // Painted fronds: nine arcing strokes on a 128px canvas.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#2f8f3e';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 30 - 12, 64 + Math.cos(a) * 60, 64 + Math.sin(a) * 56 + 14);
    g.stroke();
  }
  const frondTex = new THREE.CanvasTexture(c);
  const crownGeo = new THREE.PlaneGeometry(6.4, 6.4);
  crownGeo.translate(0, 7.7, 0);
  const crownMat = new THREE.MeshLambertMaterial({ map: frondTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const crownsA = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const crownsB = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const E = new THREE.Euler(), Q = new THREE.Quaternion();
  spots.forEach((sp, i) => {
    P.set(sp.x, 0, sp.z);
    E.set(sp.lean, i * 1.7, sp.lean * 0.6); Q.setFromEuler(E);
    S.setScalar(sp.s);
    M.compose(P, Q, S);
    trunks.setMatrixAt(i, M);
    crownsA.setMatrixAt(i, M);
    E.set(sp.lean, i * 1.7 + Math.PI / 2, sp.lean * 0.6); Q.setFromEuler(E);
    M.compose(P, Q, S);
    crownsB.setMatrixAt(i, M);
  });
  scene.add(trunks); scene.add(crownsA); scene.add(crownsB);
}

function buildBoatsAndFerris(scene) {
  const boats = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f0e8 });
  const trimMats = [0xd84f35, 0x2f8fae, 0xf2b13c].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 5.2), hullMat);
    hull.position.y = 0.3;
    b.add(hull);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.24, 5.3), trimMats[i % 3]);
    trim.position.y = 0.72;
    b.add(trim);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.8), hullMat);
    cabin.position.set(0, 1.0, -0.5);
    b.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 5), trimMats[i % 3]);
    mast.position.set(0, 2.2, 0.9);
    b.add(mast);
    b.position.set(-254 - (i % 3) * 7.5, 0, 194 + i * 12.5);
    b.userData.phase = i * 1.3;
    boats.add(b);
  }
  scene.add(boats);
  setBoats(boats);

  // The Playa Brava ferris wheel, turning slowly over the sand.
  const ferris = new THREE.Group();
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xf5a8c0 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.3, 6, 28), rimMat);
  ferris.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.18, 21, 0.18), rimMat);
    spoke.rotation.z = a;
    ferris.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), trimMats[i % 3]);
    cab.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0);
    cab.userData.cabin = true;
    ferris.add(cab);
  }
  const legMat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 13, 0.4), legMat);
    leg.position.set(sx * 4.4, -11.5, 0);
    leg.rotation.z = sx * 0.36;
    ferris.add(leg);
  }
  ferris.position.set(-240, 12.5, 44);
  scene.add(ferris);
  setFerris(ferris);
}

const _sunDir = new THREE.Vector3();
function applyHour(hours, force = false) {
  const state = dayState(hours);
  const hourInt = Math.floor(hours * 4);
  if (force || hourInt !== _skyHour) {
    _skyHour = hourInt;
    paintSky(state, hours);
  }
  if (_skyMesh && G.camera) _skyMesh.position.copy(G.camera.position);
  G.scene.fog.color.copy(state.fog);
  G.scene.background = state.sky;
  _hemi.color.copy(state.amb);
  _hemi.groundColor.copy(state.gnd);
  _hemi.intensity = state.hemiI + 0.3;
  _amb.color.copy(state.amb);
  _amb.intensity = 0.32;
  _sun.color.copy(state.sun);
  _sun.intensity = state.sunI + 0.25;
  // Sun path: east at dawn, west at dusk, low and warm at both ends.
  const ang = ((hours - 6) / 12) * Math.PI;
  _sunDir.set(Math.cos(ang) * 0.8, Math.sin(ang) * 0.9 + 0.08, 0.42).normalize();
  const focus = G.player ? G.player : { x: -190, z: 0 };
  _sun.position.set(focus.x + _sunDir.x * 260, _sunDir.y * 260 + 40, focus.z + _sunDir.z * 260);
  _sun.target.position.set(focus.x, 0, focus.z);
  G.isDusk = hours >= 16.5 || hours <= 5.5;
}

let _time = 0;
export function updateWorld(dt) {
  _time += dt;
  if (!G.shotMode) {
    G.timeHours = (G.timeHours + (dt / G.dayLength) * 24) % 24;
  }
  applyHour(G.timeHours);
  if (_ocean) {
    _ocean.position.y = -0.25 + Math.sin(_time * 0.7) * 0.05;
  }
  if (_boatsRef) {
    for (const b of _boatsRef.children) {
      b.position.y = Math.sin(_time * 0.9 + b.userData.phase) * 0.12;
      b.rotation.z = Math.sin(_time * 0.7 + b.userData.phase) * 0.03;
    }
  }
  if (_ferrisRef) {
    _ferrisRef.rotation.z += dt * 0.05;
    for (const cab of _ferrisRef.children) {
      if (cab.userData.cabin) cab.rotation.z = -_ferrisRef.rotation.z;
    }
  }
}

export function clampToCity(p) {
  p.x = clamp(p.x, CITY_BOUNDS.minX + 1, CITY_BOUNDS.maxX - 1);
  p.z = clamp(p.z, CITY_BOUNDS.minZ + 1, CITY_BOUNDS.maxZ - 1);
  return p;
}
