// city.js — Puerto Alba's layout and look: the surveyed grid, six districts,
// painted ground and facade canvases, the marina colonnade and its signs.
// Data (buildCityData) is pure and deterministic per seed; meshes are built
// from that data by buildCityMeshes so staging can reason about the city.

import { makeRng, randRange, randInt, pick, clamp } from './util.js';

export const ROAD_WIDTH = 14;
export const BOULEVARD_X = -212;
export const ROADS_X = [-160, -100, -40, 20, 80, 140, 200, 260];
export const ROADS_Z = [-280, -220, -160, -100, -40, 20, 80, 140, 200, 260];
export const CITY_BOUNDS = { minX: -252, maxX: 292, minZ: -308, maxZ: 308 };
export const BEACH_X = -228; // west of this line: sand, then sea

export const DISTRICTS = [
  { name: 'El Faro', minX: -252, maxX: -214, minZ: -308, maxZ: -208, tint: '#8a6fc9' },
  { name: 'Playa Brava', minX: -252, maxX: -214, minZ: -208, maxZ: 308, tint: '#e3c07a' },
  { name: 'Las Palmas', minX: -214, maxX: 292, minZ: -308, maxZ: -130, tint: '#69b06a' },
  { name: 'Marina Alta', minX: -214, maxX: -128, minZ: -130, maxZ: 110, tint: '#57c8d8' },
  { name: 'Centro Alba', minX: -128, maxX: 292, minZ: -130, maxZ: 110, tint: '#e08a7a' },
  { name: 'Viejo Puerto', minX: -214, maxX: 292, minZ: 110, maxZ: 308, tint: '#d8a84e' },
];

export const PLACES = {
  marisol: { x: -193.5, z: -7.3, label: 'Marisol' },
  garage: { x: -178, z: -70, label: "Dario's Garage" },
  dario: { x: -191, z: -64, label: 'Dario' },
  barLaOla: { x: -216, z: -130, label: 'Bar La Ola' },
  hospital: { x: 110, z: -130, label: 'Hospital' },
  papd: { x: 172, z: 52, label: 'PAPD' },
  clockTower: { x: -10, z: -10, label: 'Clock Tower' },
  lighthouse: { x: -238, z: -282, label: 'El Faro' },
  raceStart: { x: 236, z: -250, label: 'Street Crown' },
  tito: { x: 236, z: -250, label: 'Tito' },
  marina: { x: -246, z: 236, label: 'Marina docks' },
  marinaGate: { x: -212, z: 290, label: 'Marina gate' },
  alleyShootout: { x: 110, z: -70, label: 'Palma alley' },
};

const PASTEL_TINTS = [0xf6e3b4, 0xf2c184, 0xef9f7d, 0xe8dfc8, 0xbfe0d0, 0xf5a8c0, 0xa9cdea, 0xf7dd7e, 0xdcb98d, 0x93c9a4, 0xe89a5f, 0xfdf6ec];
const TOWER_TINTS = [0xd8e2e8, 0xb9c9d6, 0xe6d3ae, 0xaec6d8, 0xd8bf9e, 0xc3d2da];
const AWNING_COLORS = [0xc94f38, 0x2f7f8f, 0xe8a33c, 0x3f7d4e, 0x7a4a8f, 0xd84f78];
const STALL_COLORS = [0xd84f35, 0x2f8fae, 0xf2b13c, 0x3fae6a, 0xe86ab0];
export const SIGN_STYLES = {
  'MARINA ALTA': ['#0e5a68', '#ffedc2', '#ffb340'],
  'LAS PALMAS': ['#27693f', '#fdf3d0', '#ffb340'],
  'CENTRO ALBA': ['#274b63', '#ffedc2', '#57d7e8'],
  'VIEJO PUERTO': ['#a02c1e', '#ffe9b0', '#ffb340'],
  'EL FARO': ['#8a4d16', '#ffedc2', '#ffd23e'],
  'PLAYA BRAVA': ['#b83a5e', '#ffedc2', '#57d7e8'],
};

// ---------------------------------------------------------------------------
// Painted canvas textures. The city reads as painted, never as flat colour:
// slabs, tar seams, grime and shopfronts are all drawn here once per variant.
// ---------------------------------------------------------------------------

function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = size[0]; c.height = size[1];
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function pavingTexture() {
  const rng = makeRng(4101);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#877c68'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = (rng() - 0.5) * 14;
      g.fillStyle = `rgb(${176 + v | 0},${166 + v | 0},${144 + v | 0})`;
      g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      for (let k = 0; k < 26; k++) {
        g.fillStyle = `rgba(90,80,64,${0.05 + rng() * 0.09})`;
        g.fillRect(i * 64 + 2 + rng() * 58, j * 64 + 2 + rng() * 58, 2, 2);
      }
    }
    for (let k = 0; k < 7; k++) {
      const x = rng() * 256, y = rng() * 256, r = 18 + rng() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(70,60,44,${0.10 + rng() * 0.08})`);
      gr.addColorStop(1, 'rgba(70,60,44,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
}

export function asphaltTexture() {
  const rng = makeRng(4202);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#3d3f45'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2600; k++) {
      const l = rng();
      g.fillStyle = l < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
      g.fillRect(rng() * 256, rng() * 256, 1.6, 1.6);
    }
    g.strokeStyle = 'rgba(18,18,22,0.55)'; g.lineWidth = 5;
    for (let k = 0; k < 4; k++) { // tar seams
      g.beginPath();
      const y = rng() * 256;
      g.moveTo(0, y); g.lineTo(256, y + (rng() - 0.5) * 22); g.stroke();
    }
    g.strokeStyle = 'rgba(12,12,16,0.7)'; g.lineWidth = 1.6;
    for (let k = 0; k < 6; k++) { // patched cracks
      g.beginPath();
      let x = rng() * 256, y = rng() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += (rng() - 0.5) * 44; y += (rng() - 0.5) * 44; g.lineTo(x, y); }
      g.stroke();
    }
    for (let k = 0; k < 5; k++) { // patch rectangles
      g.fillStyle = 'rgba(22,22,28,0.35)';
      g.fillRect(rng() * 200, rng() * 200, 26 + rng() * 40, 18 + rng() * 30);
    }
  });
}

export function sandTexture() {
  const rng = makeRng(4303);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#e0bd85'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 1500; k++) {
      g.fillStyle = rng() < 0.5 ? 'rgba(160,120,70,0.10)' : 'rgba(255,240,200,0.10)';
      g.fillRect(rng() * 256, rng() * 256, 2, 2);
    }
    g.strokeStyle = 'rgba(170,130,80,0.18)'; g.lineWidth = 2;
    for (let y = 8; y < 256; y += 16) { // wind ripples
      g.beginPath();
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 2.4);
      g.stroke();
    }
    for (let k = 0; k < 60; k++) { // shell speckle
      g.fillStyle = 'rgba(255,250,240,0.5)';
      g.fillRect(rng() * 256, rng() * 256, 2.4, 1.6);
    }
  });
}

export function facadeTexture(variant, shopFront) {
  const rng = makeRng(5000 + variant * 131);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#f6f1e5'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 7; k++) {
      g.fillStyle = `rgba(120,100,70,${0.03 + rng() * 0.05})`;
      g.fillRect(rng() * 200, rng() * 200, 30 + rng() * 60, 20 + rng() * 50);
    }
    // Upper floors: three 64px bands of windows (canvas top = building top).
    for (let f = 0; f < 3; f++) {
      const y = f * 64;
      g.fillStyle = 'rgba(90,80,70,0.16)'; g.fillRect(0, y + 58, 256, 3);
      for (let x = 12; x < 232; x += 42) {
        const lit = rng() < 0.24;
        g.fillStyle = lit ? '#ffd98a' : '#33505e';
        g.fillRect(x, y + 14, 24, 36);
        g.fillStyle = 'rgba(200,230,250,0.55)';
        g.fillRect(x + 3, y + 17, 8, 30);
        g.fillStyle = '#7a6a55'; // shutters
        g.fillRect(x - 5, y + 14, 4, 36); g.fillRect(x + 25, y + 14, 4, 36);
        if (rng() < 0.4) { g.fillStyle = '#9aa2a8'; g.fillRect(x + 4, y + 52, 14, 7); } // AC box
      }
    }
    // Ground floor.
    if (shopFront) {
      g.fillStyle = '#8a97a3'; g.fillRect(0, 192, 256, 14);
      for (let x = 10; x < 220; x += 58) {
        g.fillStyle = '#33505e'; g.fillRect(x, 210, 48, 40);
        g.fillStyle = 'rgba(180,225,245,0.5)'; g.fillRect(x + 4, 214, 18, 32);
      }
      g.fillStyle = '#5a4632'; g.fillRect(118, 206, 24, 44);
    } else {
      g.fillStyle = '#6e5136'; g.fillRect(112, 208, 30, 48);
      g.fillStyle = '#33505e'; g.fillRect(30, 216, 26, 30); g.fillRect(196, 216, 26, 30);
      g.fillStyle = 'rgba(200,230,250,0.5)';
      g.fillRect(33, 219, 9, 24); g.fillRect(199, 219, 9, 24);
    }
  });
}

export function signTexture(text, style, widePx) {
  const h = widePx === 1216 ? 200 : 168;
  return canvasTex([widePx, h], (g) => {
    const [bg, letters, accent] = style;
    g.fillStyle = bg; g.fillRect(0, 0, widePx, h);
    g.strokeStyle = accent; g.lineWidth = 7;
    g.strokeRect(12, 12, widePx - 24, h - 24);
    g.fillStyle = accent; g.fillRect(0, h - 26, widePx, 10);
    g.fillStyle = letters;
    g.font = `bold ${h * 0.46}px Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, widePx / 2, h / 2 + 2);
  });
}

function clockTexture() {
  return canvasTex([128, 128], (g) => {
    g.fillStyle = '#f8f3df'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.strokeStyle = '#4a3b28'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46);
      g.lineTo(64 + Math.cos(a) * 53, 64 + Math.sin(a) * 53);
      g.stroke();
    }
    g.lineWidth = 7; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 30); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(88, 74); g.stroke();
  });
}

// ---------------------------------------------------------------------------
// Layout data
// ---------------------------------------------------------------------------

function bands(lines, min, max, margin) {
  const out = [];
  let prev = min;
  for (const l of lines) { out.push([prev, l - margin]); prev = l + margin; }
  out.push([prev, max]);
  return out.filter(([a, b]) => b - a > 12);
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
  return DISTRICTS[4];
}

export function isOnRoad(x, z) {
  const half = ROAD_WIDTH / 2 + 1;
  if (Math.abs(x - BOULEVARD_X) < half + 3) return true;
  for (const lx of ROADS_X) if (Math.abs(x - lx) < half) return true;
  for (const lz of ROADS_Z) if (Math.abs(z - lz) < half) return true;
  return false;
}

export function intersections() {
  const pts = [];
  for (const lx of [...ROADS_X, BOULEVARD_X]) for (const lz of ROADS_Z) pts.push({ x: lx, z: lz });
  return pts;
}

// Lamps hug the corner kerbs at intersections — never the carriageway —
// with a mid-block run down both sides of the boulevard.
export function streetlightSpots() {
  const spots = [];
  const off = ROAD_WIDTH / 2 + 1.3;
  for (const { x, z } of intersections()) {
    spots.push({ x: x - off, z: z - off });
    spots.push({ x: x + off, z: z + off });
  }
  for (let z = -300; z <= 300; z += 45) {
    if (ROADS_Z.some((lz) => Math.abs(z - lz) < 12)) continue;
    spots.push({ x: BOULEVARD_X - off - 3, z });
    spots.push({ x: BOULEVARD_X + off + 3, z: z + 22 });
  }
  return spots;
}

export function randomRoadPoint(rng) {
  const onX = rng() < 0.5;
  if (onX) {
    const line = rng() < 0.3 ? BOULEVARD_X : pick(rng, ROADS_X);
    return { axis: 'x', line, dir: rng() < 0.5 ? 1 : -1, along: randRange(rng, CITY_BOUNDS.minZ + 20, CITY_BOUNDS.maxZ - 20) };
  }
  const line = pick(rng, ROADS_Z);
  return { axis: 'z', line, dir: rng() < 0.5 ? 1 : -1, along: randRange(rng, CITY_BOUNDS.minX + 20, CITY_BOUNDS.maxX - 20) };
}

export function addCollider(data, box) {
  data.colliders.push(box);
  return box;
}

export function collidersNear(data, x, z) {
  const out = [];
  for (const b of data.colliders) {
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    if (Math.abs(cx - x) < 46 && Math.abs(cz - z) < 46) out.push(b);
  }
  return out;
}

function addBuilding(data, b) {
  b.face = b.face || 'S';
  data.buildings.push(b);
  addCollider(data, { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 });
  return b;
}

export function buildCityData(seed) {
  const rng = makeRng(seed * 7919 + 17);
  const data = { seed, buildings: [], colliders: [], plazas: [], yards: [], stalls: [], trees: [], lamps: streetlightSpots() };
  const xBands = bands(ROADS_X, BEACH_X, CITY_BOUNDS.maxX, 9);
  const zBands = bands(ROADS_Z, CITY_BOUNDS.minZ, CITY_BOUNDS.maxZ, 9);

  // Named buildings first; generic fill skips their cells.
  const namedCells = new Set();
  const cellKey = (cx, cz) => `${cx.toFixed(0)},${cz.toFixed(0)}`;
  function claim(cx, cz) { namedCells.add(cellKey(cx, cz)); }

  addBuilding(data, { x: -178, z: -70, w: 24, d: 18, h: 8, tint: 0xe8b48c, roof: 0x9c8d7a, shopFront: true, variant: 1, name: 'garage', awning: 0x8a2f1d, face: 'W' });
  claim(-198.5, -70);
  addBuilding(data, { x: -216, z: -130, w: 14, d: 10, h: 6, tint: 0x2f8fae, roof: 0xb06a48, shopFront: true, variant: 2, name: 'bar', face: 'E' });
  addBuilding(data, { x: -196, z: 230, w: 34, d: 24, h: 11, tint: 0xcbb79a, roof: 0x9aa2a8, shopFront: false, variant: 3, name: 'almacen', face: 'W' });
  claim(-198.5, 230);
  claim(-198.5, -130);
  addBuilding(data, { x: 110, z: -130, w: 30, d: 22, h: 16, tint: 0xf2f4f4, roof: 0x9aa2a8, shopFront: false, variant: 4, name: 'hospital', face: 'S' });
  claim(110, -130);
  addBuilding(data, { x: 172, z: 52, w: 28, d: 20, h: 13, tint: 0xb9cbd8, roof: 0x9aa2a8, shopFront: false, variant: 5, name: 'papd', face: 'W' });
  claim(170, 50);
  // The Palma alley yard: a low block on its north edge, the corner house
  // with the shuttered balconies on its east side, open asphalt between.
  addBuilding(data, { x: 110, z: -84, w: 36, d: 10, h: 9, tint: 0xef9f7d, roof: 0xb06a48, shopFront: true, variant: 0, name: 'alleyNorth', face: 'S' });
  addBuilding(data, { x: 124, z: -58, w: 15, d: 13, h: 11, tint: 0xf2c184, roof: 0xb06a48, shopFront: false, variant: 2, name: 'cornerHouse', face: 'S', balconies: [{ y: 3.1, off: 0 }, { y: 4.3, off: 1.2 }, { y: 7.5, off: -1.1 }] });
  claim(110, -70);
  data.yards.push({ x: 108, z: -64, w: 46, d: 32 });

  // Plazas: the clock-tower square plus two green squares.
  data.plazas.push({ x: -10, z: -10, w: 40, d: 40, green: false });
  claim(-10, -10);
  data.plazas.push({ x: 50, z: -190, w: 38, d: 38, green: true });
  claim(50, -190);
  data.plazas.push({ x: 170, z: 170, w: 38, d: 38, green: true });
  claim(170, 170);
  for (const p of data.plazas) {
    if (!p.green) continue;
    for (let i = 0; i < 5; i++) data.trees.push({ x: p.x + randRange(rng, -15, 15), z: p.z + randRange(rng, -15, 15), s: randRange(rng, 0.8, 1.3) });
  }

  // Marina promenade stalls, along the colonnade's west side.
  const stallZ = [-26, -2, 22, 46, 70, 94, -122, -146];
  stallZ.forEach((z, i) => data.stalls.push({ x: -198, z, color: STALL_COLORS[i % STALL_COLORS.length], rot: Math.PI / 2 }));

  // Generic fill for every unclaimed cell.
  for (const [x0, x1] of xBands) {
    for (const [z0, z1] of zBands) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const bw = x1 - x0, bd = z1 - z0;
      if (namedCells.has(cellKey(cx, cz))) continue;
      // The marina promenade strip stays open: colonnade, stalls, paving.
      if (cx < -160 && cz > -115 && cz < 135) continue;
      const dist = districtAt(cx, cz).name;
      const towerish = (dist === 'Las Palmas' || dist === 'Centro Alba') && rng() < 0.34;
      const mk = (x, z, w, d) => {
        const tower = towerish && rng() < 0.7;
        const h = tower ? randRange(rng, 24, 40) : randRange(rng, 7.5, 17);
        addBuilding(data, {
          x, z, w, d, h,
          tint: tower ? pick(rng, TOWER_TINTS) : pick(rng, PASTEL_TINTS),
          roof: tower ? 0x9aa2a8 : (rng() < 0.5 ? 0xb06a48 : 0x9c8d7a),
          shopFront: rng() < 0.55,
          variant: randInt(rng, 0, 5),
          face: pick(rng, ['N', 'S', 'E', 'W']),
          balconies: (!tower && h > 10 && rng() < 0.3) ? [{ y: 3.1, off: 0 }, { y: 4.3, off: 1 }] : null,
        });
      };
      const layout = rng();
      if (layout < 0.42 || bw < 34 || bd < 34) {
        mk(cx, cz, bw * randRange(rng, 0.6, 0.78), bd * randRange(rng, 0.6, 0.78));
      } else if (layout < 0.74) {
        const alongX = bw >= bd;
        const off = (alongX ? bw : bd) / 4;
        if (alongX) { mk(cx - off, cz, bw * 0.4, bd * 0.66); mk(cx + off, cz, bw * 0.4, bd * 0.66); }
        else { mk(cx, cz - off, bw * 0.66, bd * 0.4); mk(cx, cz + off, bw * 0.66, bd * 0.4); }
      } else {
        const ox = bw / 4, oz = bd / 4;
        mk(cx - ox, cz - oz, bw * 0.38, bd * 0.38); mk(cx + ox, cz - oz, bw * 0.38, bd * 0.38);
        mk(cx - ox, cz + oz, bw * 0.38, bd * 0.38); mk(cx + ox, cz + oz, bw * 0.38, bd * 0.38);
      }
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Meshes
// ---------------------------------------------------------------------------

const _facadeTex = [null, null, null, null, null, null];
const _facadeTexShop = [null, null, null, null, null, null];
function facadeFor(variant, shop) {
  const cache = shop ? _facadeTexShop : _facadeTex;
  if (!cache[variant]) cache[variant] = facadeTexture(variant, shop);
  return cache[variant];
}

// Scale a box's side-face UVs so windows stay window-sized at any footprint:
// uvMode 'facade' with winScale metres per texture tile.
function scaleFacadeUVs(geo, w, h, d, winScale) {
  const uv = geo.attributes.uv;
  const faceW = [d, d, w, w, w, d]; // px, nx, py, ny, pz, nz
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (faceW[f] / winScale), uv.getY(i) * (h / winScale));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

export function buildCityMeshes(scene, data, seed) {
  const rng = makeRng(seed * 31337 + 5);
  const group = new THREE.Group();
  scene.add(group);
  const B = CITY_BOUNDS;
  const cxm = (B.minX + B.maxX) / 2, czm = (B.minZ + B.maxZ) / 2;

  // Ground: paving under the city, sand on the beach strip.
  const pave = new THREE.Mesh(
    new THREE.PlaneGeometry(B.maxX - BEACH_X, B.maxZ - B.minZ),
    new THREE.MeshLambertMaterial({ map: pavingTexture() }));
  pave.material.map.repeat.set(120, 142);
  pave.rotation.x = -Math.PI / 2;
  pave.position.set((BEACH_X + B.maxX) / 2, 0, czm);
  pave.receiveShadow = true;
  group.add(pave);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(64, B.maxZ - B.minZ),
    new THREE.MeshLambertMaterial({ map: sandTexture() }));
  sand.material.map.repeat.set(10, 96);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X - 32, -0.02, czm);
  sand.receiveShadow = true;
  group.add(sand);
  // Yard patches (the Palma alley) get asphalt, not plaza paving.
  const yardTex = asphaltTexture();
  for (const y of data.yards) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(y.w, y.d), new THREE.MeshLambertMaterial({ map: yardTex }));
    m.material = m.material.clone(); m.material.map = yardTex.clone(); m.material.map.repeat.set(3, 2); m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2; m.position.set(y.x, 0.03, y.z);
    m.receiveShadow = true;
    group.add(m);
  }

  // Roads: sidewalk slab, asphalt carriageway, centre dashes, kerb segments.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b1a1 });
  const roadTex = asphaltTexture();
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const dashes = [];
  function road(cx, cz, len, vertical) {
    const w = ROAD_WIDTH + 5;
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? w : len, vertical ? len : w), walkMat);
    slab.rotation.x = -Math.PI / 2; slab.position.set(cx, 0.02, cz); slab.receiveShadow = true;
    group.add(slab);
    const tex = roadTex.clone(); tex.needsUpdate = true;
    tex.repeat.set(vertical ? 1 : len / 16, vertical ? len / 16 : 1);
    const asp = new THREE.Mesh(
      new THREE.PlaneGeometry(vertical ? ROAD_WIDTH : len, vertical ? len : ROAD_WIDTH),
      new THREE.MeshLambertMaterial({ map: tex }));
    asp.rotation.x = -Math.PI / 2; asp.position.set(cx, 0.045, cz); asp.receiveShadow = true;
    group.add(asp);
    for (let t = -len / 2 + 6; t < len / 2 - 4; t += 7) dashes.push(vertical ? [cx, cz + t] : [cx + t, cz]);
  }
  for (const lx of ROADS_X) road(lx, czm, B.maxZ - B.minZ, true);
  for (const lz of ROADS_Z) road(cxm, lz, B.maxX - B.minX, false);
  road(BOULEVARD_X, czm, B.maxZ - B.minZ, true);
  const dashGeo = new THREE.BoxGeometry(0.35, 0.02, 2.4);
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  dashes.forEach(([x, z], i) => { P.set(x, 0.06, z); M.compose(P, Q, S); dashMesh.setMatrixAt(i, M); });
  group.add(dashMesh);
  // Kerbs: alternating segments along the boulevard edges.
  const kerbGeo = new THREE.BoxGeometry(0.5, 0.14, 6);
  const kerbA = new THREE.MeshLambertMaterial({ color: 0xd8d5cc });
  const kerbB = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  let ki = 0;
  for (let z = B.minZ + 3; z < B.maxZ - 3; z += 6, ki++) {
    for (const sx of [-1, 1]) {
      const k = box(0.5, 0.14, 6, ki % 2 ? kerbA : kerbB, BOULEVARD_X + sx * (ROAD_WIDTH / 2 + 0.6), 0.07, z);
      group.add(k);
    }
  }

  // Buildings.
  const roofMats = {};
  const roofMat = (tone) => roofMats[tone] || (roofMats[tone] = new THREE.MeshLambertMaterial({ color: tone }));
  const underMat = new THREE.MeshLambertMaterial({ color: 0x6a6258 });
  for (const b of data.buildings) {
    const geo = scaleFacadeUVs(new THREE.BoxGeometry(b.w, b.h, b.d), b.w, b.h, b.d, 12);
    const side = new THREE.MeshLambertMaterial({ map: facadeFor(b.variant, b.shopFront), color: b.tint });
    const mesh = new THREE.Mesh(geo, [side, side, roofMat(b.roof), underMat, side, side]);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    b.mesh = mesh;
    // Cornice trim.
    const trim = box(b.w + 0.5, 0.28, b.d + 0.5, roofMat(0xf2ead8), b.x, b.h - 0.4, b.z);
    group.add(trim);
    if (b.awning) {
      const awn = box(0.18, 1.1, b.d * 0.7, new THREE.MeshLambertMaterial({ color: b.awning }), b.x - b.w / 2 - 0.5, 3.1, b.z);
      awn.rotation.z = 0.5;
      group.add(awn);
    }
    if (b.balconies) {
      b.balconyMeshes = [];
      const bMat = new THREE.MeshLambertMaterial({ color: 0xe8e0cc });
      for (const bal of b.balconies) {
        const slabB = box(b.w * 0.34, 0.16, 1.0, bMat, b.x + (bal.off || 0), bal.y, b.z + b.d / 2 + 0.5);
        slabB.name = 'balcony';
        group.add(slabB);
        b.balconyMeshes.push(slabB);
        const rail = box(b.w * 0.34, 0.5, 0.08, bMat, b.x + (bal.off || 0), bal.y + 0.3, b.z + b.d / 2 + 0.95);
        rail.name = 'balcony';
        group.add(rail);
        b.balconyMeshes.push(rail);
      }
    }
  }

  buildColonnade(group);
  buildSigns(group, rng);

  // Market stalls on the promenade.
  for (const s of data.stalls) {
    const st = new THREE.Group();
    const cMat = new THREE.MeshLambertMaterial({ color: s.color });
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    st.add(box(3.4, 0.18, 2.0, wood, 0, 1.0, 0));
    for (const [px, pz] of [[-1.5, -0.85], [1.5, -0.85], [-1.5, 0.85], [1.5, 0.85]]) st.add(box(0.14, 2.3, 0.14, wood, px, 1.15, pz));
    const canopy = box(3.9, 0.1, 2.5, cMat, 0, 2.42, 0);
    canopy.rotation.z = 0.07;
    st.add(canopy);
    st.add(box(3.0, 0.5, 1.4, new THREE.MeshLambertMaterial({ color: 0xd8cfc0 }), 0, 0.55, 0));
    st.position.set(s.x, 0, s.z);
    st.rotation.y = s.rot;
    group.add(st);
  }

  // Street lamps: slim poles with a warm head that reads at dusk.
  const lampGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.4, 5);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, data.lamps.length);
  const headGeo = new THREE.SphereGeometry(0.22, 6, 5);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, data.lamps.length);
  data.lamps.forEach((l, i) => {
    P.set(l.x, 2.7, l.z); M.compose(P, Q, S); lamps.setMatrixAt(i, M);
    P.set(l.x, 5.45, l.z); M.compose(P, Q, S); heads.setMatrixAt(i, M);
  });
  group.add(lamps); group.add(heads);

  // Plaza trees.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d4e });
  for (const t of data.trees) {
    const tr = new THREE.Group();
    tr.add(box(0.24, 1.8, 0.24, trunkMat, 0, 0.9, 0));
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), leafMat);
    blob.position.y = 2.9; blob.castShadow = true;
    tr.add(blob);
    const blob2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), leafMat);
    blob2.position.set(0.7, 2.2, 0.3);
    tr.add(blob2);
    tr.position.set(t.x, 0, t.z);
    tr.scale.setScalar(t.s);
    group.add(tr);
  }

  // Clock tower.
  const tower = new THREE.Group();
  const tMat = new THREE.MeshLambertMaterial({ map: facadeFor(1, false), color: 0xe8d9b0 });
  const tBody = new THREE.Mesh(scaleFacadeUVs(new THREE.BoxGeometry(8, 34, 8), 8, 34, 8, 12), tMat);
  tBody.position.y = 17; tBody.castShadow = true;
  tower.add(tBody);
  const clock = clockTexture();
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), new THREE.MeshBasicMaterial({ map: clock }));
    const a = (i / 4) * Math.PI * 2;
    face.position.set(Math.sin(a) * 4.06, 28.5, Math.cos(a) * 4.06);
    face.rotation.y = a;
    tower.add(face);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(6.4, 5, 4), new THREE.MeshLambertMaterial({ color: 0x8a4d16 }));
  spire.position.y = 36.5; spire.rotation.y = Math.PI / 4;
  tower.add(spire);
  tower.position.set(PLACES.clockTower.x, 0, PLACES.clockTower.z);
  group.add(tower);

  // Lighthouse at El Faro point.
  const lh = new THREE.Group();
  const lhWhite = new THREE.MeshLambertMaterial({ color: 0xf4f1e8 });
  const lhRed = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.5 - i * 0.22, 2.7 - i * 0.22, 5, 10), i % 2 ? lhRed : lhWhite);
    seg.position.y = 2.5 + i * 5;
    seg.castShadow = true;
    lh.add(seg);
  }
  const lampRoom = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lampRoom.position.y = 21.4;
  lh.add(lampRoom);
  lh.position.set(PLACES.lighthouse.x, 0, PLACES.lighthouse.z);
  group.add(lh);

  // Marina piers reaching into the bay.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a7355 });
  for (let i = 0; i < 8; i++) {
    const pier = box(17, 0.5, 2.6, pierMat, -260, 0.35, 194 + i * 12.5);
    group.add(pier);
  }
  return group;
}

// The marina colonnade — pinned geometry. The arcade runs at x = -187.2 with
// the garage breaking it; the MARINA ALTA board hangs on its west face.
function buildColonnade(group) {
  const colGeo = new THREE.CylinderGeometry(0.26, 0.3, 3.8, 7);
  const colMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc4 });
  const spots = [];
  for (let z = -99; z <= 99; z += 6) {
    if (z > -80 && z < -48) continue; // the garage breaks the arcade
    spots.push(z);
  }
  const cols = new THREE.InstancedMesh(colGeo, colMat, spots.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  spots.forEach((z, i) => { P.set(-187.2, 1.9, z); M.compose(P, Q, S); cols.setMatrixAt(i, M); });
  cols.castShadow = true;
  group.add(cols);
  const beamMat = new THREE.MeshLambertMaterial({ color: 0xdcc7ae });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xc94f38 });
  group.add(box(1.4, 0.5, 21, beamMat, -187.2, 4.0, -89.5));
  group.add(box(3.6, 0.16, 21, trimMat, -187.2, 4.32, -89.5));
  group.add(box(1.4, 0.5, 147, beamMat, -187.2, 4.0, 25.5));
  group.add(box(3.6, 0.16, 147, trimMat, -187.2, 4.32, 25.5));

  // MARINA ALTA board: back box, painted faces both sides, mounting stubs.
  const style = SIGN_STYLES['MARINA ALTA'];
  const tex = signTexture('MARINA ALTA', style, 1216);
  const back = box(0.16, 1.85, 11.4, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), -188.02, 3.3, -9.8);
  back.castShadow = true;
  group.add(back);
  const faceMat = new THREE.MeshBasicMaterial({ map: tex });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.75), faceMat);
  front.rotation.y = -Math.PI / 2;
  front.position.set(-188.13, 3.3, -9.8);
  group.add(front);
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.75), faceMat);
  rear.rotation.y = Math.PI / 2;
  rear.position.set(-187.91, 3.3, -9.8);
  group.add(rear);
  const stubMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  group.add(box(0.14, 0.45, 0.14, stubMat, -187.7, 4.4, -14.2));
  group.add(box(0.14, 0.45, 0.14, stubMat, -187.7, 4.4, -5.4));
}

// Gateway boards for the other five districts, same construction language.
function buildSigns(group, rng) {
  const postMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  const spots = [
    ['LAS PALMAS', 44, -136, 0],
    ['CENTRO ALBA', -60, -122, 0],
    ['VIEJO PUERTO', 60, 118, 0],
    ['EL FARO', -204, -216, Math.PI / 2],
    ['PLAYA BRAVA', -204, 96, Math.PI / 2],
  ];
  for (const [name, x, z, ry] of spots) {
    const g = new THREE.Group();
    const tex = signTexture(name, SIGN_STYLES[name], 1024);
    g.add(box(0.16, 3.4, 0.16, postMat, -3.4, 1.7, 0));
    g.add(box(0.16, 3.4, 0.16, postMat, 3.4, 1.7, 0));
    const back = box(7.6, 1.6, 0.14, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), 0, 3.1, 0);
    g.add(back);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 1.45), mat);
    face.position.set(0, 3.1, 0.1);
    g.add(face);
    const face2 = face.clone();
    face2.rotation.y = Math.PI;
    face2.position.z = -0.1;
    g.add(face2);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
  }
}
