// world.js — the stage itself: the renderer and its filmic grade, the
// painted gradient sky with its sun glow and drifting clouds, the slow
// day cycle, the sea, the palm avenues and the streetlights that take
// over when the light goes. Round seventeen repaints the sky on the
// locked stops: the horizon colour holds from 0.55 of the canvas to
// its foot, and that wide warm band — not a saturated wash — is what
// keeps Puerto Alba's evenings dusty gold instead of pink.
import { G } from './state.js';
import { BOULEVARD_X, ROADS_X, ROADS_Z, CITY_BOUNDS, addCollider, streetlightSpots } from './city.js';
import { makeRng, lerp, clamp } from './util.js';

// (hour, sky, skyTop, band, fog, sun, sunI, hemiI, amb, gnd)
const DAY_STOPS = [
  [0.0, 0x131c31, 0x0a1224, 0x1a2440, 0x1b2740, 0x223355, 0.12, 0.25, 0x2a3550, 0x1e2638],
  [5.5, 0x27304f, 0x131c38, 0x4a4468, 0x353c5c, 0x445588, 0.2, 0.3, 0x35405c, 0x2c3048],
  [7.0, 0xf59a58, 0x6a7cc4, 0xe88a7a, 0xf5b878, 0xffab5e, 0.9, 0.48, 0xffdcb0, 0x5c4a3c],
  [12.0, 0x54b6ec, 0x2b6cd4, 0x6fc3ee, 0xbfe0ea, 0xfff2d8, 1.32, 0.66, 0xf4f9ff, 0x51624e],
  [16.5, 0x58aee6, 0x3a78c8, 0x74c2e6, 0xcfe4da, 0xffe9bb, 1.22, 0.6, 0xfff0d8, 0x55624a],
  [18.0, 0xffab52, 0x4c63b4, 0xf28a5e, 0xf7ab66, 0xff8438, 1.05, 0.5, 0xffd9a8, 0x6e4c34],
  [19.3, 0x5f5296, 0x2c2a55, 0xb05a7a, 0x9c6a84, 0xff7040, 0.42, 0.34, 0xc9a0c0, 0x4c3644],
  [20.3, 0x1d2745, 0x0d1428, 0x232c4c, 0x27324e, 0x334466, 0.14, 0.27, 0x303c5c, 0x1e2638],
  [24.0, 0x131c31, 0x0a1224, 0x1a2440, 0x1b2740, 0x223355, 0.12, 0.25, 0x2a3550, 0x1e2638],
];

let boatsRef = [];
let ferrisRef = null;
export function setBoats(boats) { boatsRef = boats; }
export function setFerris(ferris) { ferrisRef = ferris; }

const _ca = new THREE.Color(), _cb = new THREE.Color();
function lerpHex(a, b, t, out) {
  _ca.setHex(a); _cb.setHex(b);
  out.copy(_ca).lerp(_cb, t);
  return out;
}

function daySample(h) {
  let i = 0;
  while (i < DAY_STOPS.length - 2 && DAY_STOPS[i + 1][0] <= h) i += 1;
  const A = DAY_STOPS[i], B = DAY_STOPS[i + 1];
  const t = clamp((h - A[0]) / (B[0] - A[0]), 0, 1);
  const col = (idx, out) => lerpHex(A[idx], B[idx], t, out);
  return {
    sky: col(1, new THREE.Color()), skyTop: col(2, new THREE.Color()), band: col(3, new THREE.Color()),
    fog: col(4, new THREE.Color()), sun: col(5, new THREE.Color()),
    sunI: lerp(A[6], B[6], t), hemiI: lerp(A[7], B[7], t),
    amb: col(8, new THREE.Color()), gnd: col(9, new THREE.Color()),
  };
}

// ------------------------------------------------------------ the sky
let skyTex = null, skyMat = null, lastSkyPaint = -99;
function paintSky(h, sample) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, `#${sample.skyTop.getHexString()}`);
  grad.addColorStop(0.34, `#${sample.band.getHexString()}`);
  grad.addColorStop(0.55, `#${sample.sky.getHexString()}`);
  grad.addColorStop(0.62, `#${sample.sky.getHexString()}`);
  grad.addColorStop(1, `#${sample.sky.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // The sun's glow rides the horizon where the sun sits.
  const dayT = clamp((h - 6) / 12, 0, 1);
  const sunX = (1 - dayT) * 1024;
  // The glow follows the sun's elevation, not its light intensity:
  // once the sun is under the bay the sky keeps only the dusty
  // stops, with no warm wash laid over them.
  const warm = clamp(Math.sin(dayT * Math.PI), 0, 1);
  const glow = g.createRadialGradient(sunX, 300, 8, sunX, 300, 340);
  glow.addColorStop(0, `rgba(255,238,196,${0.9 * warm})`);
  glow.addColorStop(0.25, `rgba(255,192,112,${0.5 * warm})`);
  glow.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 1024, 512);
  // A few flat cloud smudges, tinted by the hour.
  const rng = makeRng(42);
  g.fillStyle = `#${sample.band.getHexString()}`;
  for (let i = 0; i < 14; i += 1) {
    const x = rng() * 1024, y = 40 + rng() * 150, w = 90 + rng() * 200;
    g.globalAlpha = 0.10 + rng() * 0.10;
    g.beginPath();
    g.ellipse(x, y, w, 9 + rng() * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  if (!skyTex) {
    skyTex = new THREE.CanvasTexture(c);
  } else {
    skyTex.image = c;
    skyTex.needsUpdate = true;
  }
  lastSkyPaint = h;
}

// ------------------------------------------------------------- palms
function buildPalms(scene) {
  const rng = makeRng(90210);
  const spots = [];
  for (let z = -120; z <= 130; z += 15) {
    if (rng() < 0.7) spots.push({ x: -202 + rng() * 3, z, lean: (rng() - 0.5) * 0.2, s: 0.8 + rng() * 0.4 });
  }
  for (const rz of ROADS_Z) for (let i = 0; i < 3; i += 1) {
    spots.push({ x: -140 + rng() * 380, z: rz + (rng() < 0.5 ? -10.8 : 10.8), lean: (rng() - 0.5) * 0.1, s: 0.8 + rng() * 0.35 });
  }
  for (let z = -288; z <= 300; z += 18) {
    if (ROADS_Z.some((rz) => Math.abs(z - rz) < 11)) continue;
    spots.push({ x: BOULEVARD_X, z, lean: (rng() - 0.5) * 0.12, s: 0.85 + rng() * 0.35 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, 7.5, 6);
  trunkGeo.translate(0, 3.75, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
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
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3();
  spots.forEach((sp, i) => {
    e.set(sp.lean, rng() * Math.PI, sp.lean * 0.6);
    q.setFromEuler(e);
    s3.set(sp.s, sp.s, sp.s);
    m4.compose(new THREE.Vector3(sp.x, 0, sp.z), q, s3);
    trunks.setMatrixAt(i, m4);
    crownsA.setMatrixAt(i, m4);
    e.y += Math.PI / 2;
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(sp.x, 0, sp.z), q, s3);
    crownsB.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  scene.add(trunks); scene.add(crownsA); scene.add(crownsB);
}

// -------------------------------------------------------- streetlights
let lampGlow = null;
function buildLights(scene) {
  const spots = streetlightSpots();
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 5.4, 6);
  poleGeo.translate(0, 2.7, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3236 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
  const headGeo = new THREE.BoxGeometry(0.7, 0.12, 0.3);
  headGeo.translate(0, 5.4, 0);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
  const m4 = new THREE.Matrix4();
  const glowPos = new Float32Array(spots.length * 3);
  spots.forEach((sp, i) => {
    m4.makeTranslation(sp.x, 0, sp.z);
    poles.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
    glowPos[i * 3] = sp.x; glowPos[i * 3 + 1] = 5.3; glowPos[i * 3 + 2] = sp.z;
    if (G.city) addCollider(G.city, { minX: sp.x - 0.25, maxX: sp.x + 0.25, minZ: sp.z - 0.25, maxZ: sp.z + 0.25 });
  });
  scene.add(poles); scene.add(heads);
  const glowTexC = document.createElement('canvas');
  glowTexC.width = 64; glowTexC.height = 64;
  const gg = glowTexC.getContext('2d');
  const grad = gg.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,220,150,0.9)');
  grad.addColorStop(1, 'rgba(255,220,150,0)');
  gg.fillStyle = grad; gg.fillRect(0, 0, 64, 64);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  lampGlow = new THREE.Points(glowGeo, new THREE.PointsMaterial({
    size: 3.4, map: new THREE.CanvasTexture(glowTexC), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(lampGlow);
}

// ------------------------------------------------------------ init/loop
let ambLight = null, ocean = null;

export function initWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The grade: filmic tone mapping rolls the highlights off and
  // deepens the warm end of the day — every frame the game has ever
  // been judged on was graded exactly here.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(-205, 12, 40);

  const sample = daySample(G.timeHours);
  scene.fog = new THREE.Fog(sample.fog.getHex(), 170, 820);
  paintSky(G.timeHours, sample);
  skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(760, 24, 16), skyMat);
  scene.add(skyDome);

  const sun = new THREE.DirectionalLight(sample.sun.getHex(), sample.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 420;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(sample.sky.getHex(), sample.gnd.getHex(), sample.hemiI);
  scene.add(hemi);
  ambLight = new THREE.AmbientLight(sample.amb.getHex(), 0.55);
  scene.add(ambLight);

  // The sea: a bright sheet west of the sand, catching specular sun.
  ocean = new THREE.Mesh(new THREE.PlaneGeometry(420, CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ + 260),
    new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 90, specular: 0x99ccee }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-252 - 190, -0.08, 0);
  scene.add(ocean);

  buildPalms(scene);
  buildLights(scene);

  G.renderer = renderer;
  G.scene = scene;
  G.camera = camera;
  G.sun = sun;
  G.sunTarget = sun.target;
  G.hemi = hemi;
  G.fog = scene.fog;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return renderer;
}

export function updateWorld(dt) {
  // The clock runs in live play; a staged scene holds its hour.
  if (!G.shotMode) {
    G.timeHours = (G.timeHours + (dt * 24) / G.dayLengthSec) % 24;
  }
  const h = G.timeHours;
  const sample = daySample(h);
  if (Math.abs(h - lastSkyPaint) > 0.03) paintSky(h, sample);
  G.fog.color.copy(sample.fog);
  G.hemi.color.copy(sample.sky);
  G.hemi.groundColor.copy(sample.gnd);
  G.hemi.intensity = sample.hemiI;
  if (ambLight) ambLight.color.copy(sample.amb);
  G.isDusk = h >= 17.35 || h <= 6.45;

  // The sun rides east to west; at the golden hours it hangs low
  // over the bay, west of the promenade.
  const az = ((h - 6) / 12) * Math.PI;
  const px = G.player ? G.player.x : 0, pz = G.player ? G.player.z : 0;
  const sx = Math.cos(az) * 260, sy = Math.max(Math.sin(az) * 210, 6), sz = 130;
  G.sun.position.set(px + sx, sy, pz + sz);
  G.sun.target.position.set(px, 0, pz);
  G.sun.color.copy(sample.sun);
  G.sun.intensity = sample.sunI;
  if (lampGlow) lampGlow.material.opacity = G.isDusk ? 0.8 : 0;

  // The harbour breathes: boats bob, the wheel turns.
  const t = G.elapsed;
  boatsRef.forEach((boat, i) => {
    boat.position.y = Math.sin(t * 0.9 + i * 1.7) * 0.1;
    boat.rotation.z = Math.sin(t * 0.7 + i) * 0.02;
  });
  if (ferrisRef) ferrisRef.rotation.z += dt * 0.12;
  if (ocean) ocean.position.y = -0.08 + Math.sin(t * 0.5) * 0.03;
}

/** Keep a position inside the city's bounds (world edge helper). */
export function clampToCity(p) {
  p.x = clamp(p.x, CITY_BOUNDS.minX, CITY_BOUNDS.maxX);
  p.z = clamp(p.z, CITY_BOUNDS.minZ, CITY_BOUNDS.maxZ);
  return p;
}
