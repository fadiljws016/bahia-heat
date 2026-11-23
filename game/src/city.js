// city.js — Puerto Alba itself: the grid, the districts, the named
// places, and every stone the other systems stand on. buildCityData
// turns a seed into the city's facts — building lots with their faces
// and balconies, colliders, benches, market stalls, plazas, kerb
// parking and the lamp map — and buildCityMeshes turns those facts
// into a handful of merged meshes: painted facade texture on every
// building (dense window grids, lit panes at dusk), pastel and tower
// tints, awnings, shop signs, balconies, palms, the market colonnade
// under its MARINA ALTA fascia, the marina's piers and boats, the
// lighthouse point and the Plaza del Reloj fountain. The layout rules
// are the city's laws: no lamp stands in a roadway (intersection
// lamps slide to the corner kerb), no parked car sleeps inside a
// building (kerb lanes sit 8.45 m from the road's centre, inside the
// 10 m building line), and a relocation pass keeps every spawn point
// out of the architecture.
import { makeRng, pick, randRange, clamp } from './util.js';

export const ROAD_WIDTH = 14;
export const BOULEVARD_X = -212;
export const ROADS_X = [-160, -100, -40, 20, 80, 140, 200, 260];
export const ROADS_Z = [-280, -220, -160, -100, -40, 20, 80, 140, 200, 260];
export const CITY_BOUNDS = { minX: -252, maxX: 292, minZ: -308, maxZ: 308 };
export const BEACH_X = -228; // west of this line: sand, then sea

export const DISTRICTS = [
  { name: 'El Faro', minX: -252, maxX: -100, minZ: -308, maxZ: -160 },
  { name: 'Las Palmas', minX: -100, maxX: 292, minZ: -308, maxZ: -100 },
  { name: 'Marina Alta', minX: -252, maxX: -100, minZ: -160, maxZ: 20 },
  { name: 'Playa Brava', minX: -252, maxX: -100, minZ: 20, maxZ: 160 },
  { name: 'Centro Alba', minX: -100, maxX: 292, minZ: -100, maxZ: 80 },
  { name: 'Viejo Puerto', minX: -100, maxX: 292, minZ: 80, maxZ: 308 },
  { name: 'Viejo Puerto', minX: -252, maxX: -100, minZ: 160, maxZ: 308 },
];

/** The named places the story and the chart both point at. */
export const PLACES = {
  playerStart: { x: -191.9, z: -5.0 },
  marisolCorner: { x: -193.5, z: -7.3 },
  garage: { x: -186, z: -57 },
  garagePad: { x: -200, z: -57 },
  policeStation: { x: -6, z: 92 },
  hospital: { x: 110, z: -68 },
  plaza: { x: 50, z: 48 },
  clockTower: { x: 50, z: 40 },
  lighthouse: { x: -226, z: -290 },
  raceStart: { x: -212, z: 58 },
  marinaDock: { x: -246, z: 202 },
  marinaGate: { x: -208.5, z: 156 },
  alleyShootout: { x: -58, z: 178 },
  barLaOla: { x: -186, z: 66 },
};

const PASTEL_TINTS = [0xf6e3b4, 0xf2c184, 0xef9f7d, 0xe8dfc8, 0xbfe0d0, 0xf5a8c0, 0xa9cdea, 0xf7dd7e, 0xdcb98d, 0x93c9a4, 0xe89a5f, 0xfdf6ec];
const TOWER_TINTS = [0xd8e2e8, 0xb9c9d6, 0xe6d3ae, 0xaec6d8, 0xd8bf9e, 0xc3d2da];
const AWNING_COLORS = [0xc94f38, 0x2f7f8f, 0xe8a33c, 0x3f7d4e, 0x7a4a8f, 0xd84f78];
const STALL_COLORS = [0xd84f35, 0x2f8fae, 0xf2b13c, 0x3fae6a, 0xe86ab0];
const SHOP_NAMES = ['CAFÉ SOL', 'PANADERÍA', 'REGATA', 'FARMACIA', 'HOTEL BRISA', 'PESCADERÍA', 'LIBRERÍA', 'TALLER', 'JOYERÍA', 'FLORISTERÍA', 'BAR DEL MAR', 'DULCERÍA'];

// Face tables: the outward normal and yaw of each named building face.
// shots.js mirrors this exact math to find the corner house's balconies.
const FACE_NORMAL = { S: [0, -1], N: [0, 1], W: [-1, 0], E: [1, 0] };
const FACE_ANGLE = { S: Math.PI, N: 0, W: -Math.PI / 2, E: Math.PI / 2 };

const V_LINES = [BOULEVARD_X, ...ROADS_X];

/** The blocks of the grid: inner rects between neighbouring road lines. */
function blockRects() {
  const rects = [];
  for (let i = 0; i < V_LINES.length - 1; i += 1) {
    for (let j = 0; j < ROADS_Z.length - 1; j += 1) {
      rects.push({
        minX: V_LINES[i] + (V_LINES[i] === BOULEVARD_X ? 9.5 : ROAD_WIDTH / 2) + 1.4,
        maxX: V_LINES[i + 1] - ROAD_WIDTH / 2 - 1.4,
        minZ: ROADS_Z[j] + ROAD_WIDTH / 2 + 1.4,
        maxZ: ROADS_Z[j + 1] - ROAD_WIDTH / 2 - 1.4,
        col: i, row: j,
      });
    }
  }
  // The last column east of ROADS_X's end and the last row south.
  for (let j = 0; j < ROADS_Z.length - 1; j += 1) {
    rects.push({
      minX: ROADS_X[ROADS_X.length - 1] + ROAD_WIDTH / 2 + 1.4, maxX: CITY_BOUNDS.maxX - 6,
      minZ: ROADS_Z[j] + ROAD_WIDTH / 2 + 1.4, maxZ: ROADS_Z[j + 1] - ROAD_WIDTH / 2 - 1.4,
      col: V_LINES.length - 1, row: j,
    });
  }
  return rects;
}

function districtRectAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
  return null;
}

/** The district a point stands in (the HUD's location line). */
export function districtAt(x, z) {
  const d = districtRectAt(x, z);
  return d ? d.name : 'Puerto Alba';
}

/** True when a point lies on any road (the boulevard runs wider). */
export function isOnRoad(x, z) {
  if (x < CITY_BOUNDS.minX - 20 || x > CITY_BOUNDS.maxX || z < CITY_BOUNDS.minZ || z > CITY_BOUNDS.maxZ) return false;
  for (const lx of V_LINES) {
    const half = lx === BOULEVARD_X ? 9.5 : ROAD_WIDTH / 2;
    if (Math.abs(x - lx) < half) return true;
  }
  for (const lz of ROADS_Z) if (Math.abs(z - lz) < ROAD_WIDTH / 2) return true;
  return false;
}

/** Every crossing of the grid. */
export function intersections() {
  const out = [];
  for (const x of V_LINES) for (const z of ROADS_Z) out.push({ x, z });
  return out;
}

/**
 * Where the streetlights stand: at intersections they slide to the
 * corner kerb — never in the roadway — and mid-block lamps hug the
 * same kerb line on alternating sides.
 */
export function streetlightSpots() {
  const spots = [];
  const off = (line) => (line === BOULEVARD_X ? 9.5 : ROAD_WIDTH / 2) + 1.3;
  intersections().forEach(({ x, z }, i) => {
    const sx = i % 2 === 0 ? 1 : -1;
    const sz = i % 3 === 0 ? -1 : 1;
    spots.push({ x: x + sx * off(x), z: z + sz * (ROAD_WIDTH / 2 + 1.3) });
  });
  for (const lx of V_LINES) {
    for (let j = 0; j < ROADS_Z.length - 1; j += 1) {
      const mid = (ROADS_Z[j] + ROADS_Z[j + 1]) / 2;
      spots.push({ x: lx + (j % 2 === 0 ? 1 : -1) * off(lx), z: mid });
    }
  }
  for (const lz of ROADS_Z) {
    for (let i = 0; i < V_LINES.length - 1; i += 1) {
      const mid = (V_LINES[i] + V_LINES[i + 1]) / 2;
      spots.push({ x: mid, z: lz + (i % 2 === 0 ? 1 : -1) * (ROAD_WIDTH / 2 + 1.3) });
    }
  }
  return spots;
}

/** A random point in a driving lane, with the route facts traffic needs. */
export function randomRoadPoint(rng) {
  if (rng() < 0.55) {
    const line = pick(rng, V_LINES);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = line === BOULEVARD_X ? 5 : 3.5;
    return {
      x: line + (dir > 0 ? lane : -lane), z: randRange(rng, -296, 296),
      heading: dir > 0 ? 0 : Math.PI, axis: 'z', line, dir,
    };
  }
  const line = pick(rng, ROADS_Z);
  const dir = rng() < 0.5 ? 1 : -1;
  return {
    x: randRange(rng, -238, 282), z: line + (dir > 0 ? -3.5 : 3.5),
    heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'x', line, dir,
  };
}

/** Register a collision box on the city data. */
export function addCollider(data, box) {
  data.colliders.push(box);
  return box;
}

/** The collision boxes near a point (a generous margin for movers). */
export function collidersNear(data, x, z) {
  if (!data) return [];
  const out = [];
  for (const b of data.colliders) {
    if (x > b.minX - 26 && x < b.maxX + 26 && z > b.minZ - 26 && z < b.maxZ + 26) out.push(b);
  }
  return out;
}

/** Place one building record and its collider; returns the record. */
function placeBuilding(data, cx, cz, w, d, h, tint, kind, face, opts = {}) {
  const b = {
    cx, cz, w, d, h, tint, kind, face,
    balconies: opts.balconies ?? [],
    awning: opts.awning ?? null,
    signName: opts.signName ?? null,
  };
  data.buildings.push(b);
  addCollider(data, { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  return b;
}

/** Which face of a lot looks at the nearest street. */
function faceToward(cx, cz) {
  let best = 'S', bestD = Infinity;
  for (const lx of V_LINES) {
    const d = Math.abs(cx - lx);
    if (d < bestD) { bestD = d; best = cx < lx ? 'E' : 'W'; }
  }
  for (const lz of ROADS_Z) {
    const d = Math.abs(cz - lz);
    if (d < bestD) { bestD = d; best = cz < lz ? 'N' : 'S'; }
  }
  return best;
}

const HEIGHT_BANDS = {
  'El Faro': [6, 12], 'Playa Brava': [5, 10], 'Marina Alta': [7, 13],
  'Las Palmas': [9, 22], 'Centro Alba': [10, 25], 'Viejo Puerto': [6, 11],
};

/** Build the city's facts from a seed: lots, dressing, spawns, lamps. */
export function buildCityData(seed) {
  const rng = makeRng(seed);
  const data = {
    buildings: [], colliders: [], benches: [], stalls: [], plazas: [],
    parkingSpots: [], lamps: streetlightSpots(),
    pier: { fromX: -228, toX: -288, z: 150 },
    ferris: { x: -240, z: 118 },
    signs: [], cranes: [{ x: -238, z: 168, ry: 0.7 }, { x: -234, z: 226, ry: -0.4 }],
  };

  // ---- the named buildings first: the story's addresses.
  placeBuilding(data, PLACES.garage.x, PLACES.garage.z, 26, 20, 9, 0xe8b48c, 'garage', 'W', { awning: 0x8a2f1d, signName: 'TALLER DARIO' });
  placeBuilding(data, PLACES.hospital.x, PLACES.hospital.z, 30, 22, 16, 0xf2f4f4, 'hospital', 'S', { signName: 'HOSPITAL SANTA ALBA' });
  placeBuilding(data, PLACES.policeStation.x, PLACES.policeStation.z + 10, 28, 20, 13, 0xb9cbd8, 'station', 'S', { signName: 'PAPD' });
  placeBuilding(data, PLACES.clockTower.x, PLACES.clockTower.z, 8, 8, 34, 0xe8d9b0, 'tower', 'S', {});
  const podium = placeBuilding(data, 236, 224, 34, 24, 11, 0xcbb79a, 'podium', 'W', {});
  podium.signName = 'ALMACÉN 9';
  placeBuilding(data, PLACES.barLaOla.x, PLACES.barLaOla.z, 17, 12, 7, 0xf2c184, 'bar', 'W', { signName: 'BAR LA OLA', awning: 0x2f7f8f });
  // The market hall behind Marisol's colonnade.
  placeBuilding(data, -183, -21, 34, 14, 9, 0xf6e3b4, 'market', 'N', {});
  // The corner house at the Palma Showdown alley: its two low
  // balconies hang over the street the staged lens sits in.
  placeBuilding(data, -72, 186, 13, 11, 10.5, 0xef9f7d, 'house', 'S', {
    balconies: [{ y: 3.1, off: 3 }, { y: 4.3, off: 3 }, { y: 7.5, off: -3 }],
    awning: 0x3f7d4e,
  });

  // ---- the generic lots, block by block.
  const plazaPicks = new Set(['2,3', '5,6', '7,2', '3,8', '6,9', '1,6']);
  for (const blk of blockRects()) {
    const cx = (blk.minX + blk.maxX) / 2, cz = (blk.minZ + blk.maxZ) / 2;
    const district = districtRectAt(cx, cz)?.name ?? 'Centro Alba';
    const contains = (p, pad = 0) => cx > p.x - 40 - pad && cx < p.x + 40 + pad && cz > p.z - 40 - pad && cz < p.z + 40 + pad;
    if (contains(PLACES.plaza, -8)) {
      data.plazas.push({ minX: blk.minX, maxX: blk.maxX, minZ: blk.minZ, maxZ: blk.maxZ, parking: false });
      continue;
    }
    if (contains(PLACES.alleyShootout) || contains(PLACES.marisolCorner)
      || contains(PLACES.policeStation) || contains(PLACES.hospital) || contains(PLACES.garage)) continue;
    if (blk.minX < -160 && cz > 130 && cz < 270) continue; // the marina apron stays open
    if (plazaPicks.has(`${blk.col},${blk.row}`) && rng() < 0.8) {
      data.plazas.push({ minX: blk.minX, maxX: blk.maxX, minZ: blk.minZ, maxZ: blk.maxZ, parking: rng() < 0.5 });
      continue;
    }
    // Subdivide: one big lot, two halves, or four small lots.
    const bw = blk.maxX - blk.minX, bd = blk.maxZ - blk.minZ;
    const roll = rng();
    const lots = [];
    if (roll < 0.3) lots.push([blk.minX, blk.minZ, blk.maxX, blk.maxZ]);
    else if (roll < 0.65) {
      if (bw > bd) { const mid = (blk.minX + blk.maxX) / 2; lots.push([blk.minX, blk.minZ, mid, blk.maxZ], [mid, blk.minZ, blk.maxX, blk.maxZ]); }
      else { const mid = (blk.minZ + blk.maxZ) / 2; lots.push([blk.minX, blk.minZ, blk.maxX, mid], [blk.minX, mid, blk.maxX, blk.maxZ]); }
    } else {
      const mx = (blk.minX + blk.maxX) / 2, mz = (blk.minZ + blk.maxZ) / 2;
      lots.push([blk.minX, blk.minZ, mx, mz], [mx, blk.minZ, blk.maxX, mz], [blk.minX, mz, mx, blk.maxZ], [mx, mz, blk.maxX, blk.maxZ]);
    }
    for (const [lx0, lz0, lx1, lz1] of lots) {
      if (rng() < 0.08) continue; // the odd empty lot: a yard, a gap
      const w = (lx1 - lx0) - randRange(rng, 2.5, 5);
      const d = (lz1 - lz0) - randRange(rng, 2.5, 5);
      if (w < 8 || d < 8) continue;
      const bcx = (lx0 + lx1) / 2 + randRange(rng, -1, 1);
      const bcz = (lz0 + lz1) / 2 + randRange(rng, -1, 1);
      const [hLo, hHi] = HEIGHT_BANDS[district] ?? [7, 14];
      const h = randRange(rng, hLo, hHi);
      const tint = h > 17 ? pick(rng, TOWER_TINTS) : pick(rng, PASTEL_TINTS);
      const face = faceToward(bcx, bcz);
      const balconies = [];
      if (rng() < 0.45) {
        const ys = [3.1, 4.3, 5.5, 6.7].filter((y) => y < h - 1.2);
        const n = Math.min(ys.length, 1 + Math.floor(rng() * 3));
        for (let i = 0; i < n; i += 1) {
          const faceW = (face === 'S' || face === 'N') ? w : d;
          balconies.push({ y: ys[Math.floor(rng() * ys.length)], off: randRange(rng, -faceW / 2 + 2, faceW / 2 - 2) });
        }
      }
      placeBuilding(data, bcx, bcz, w, d, h, tint, 'block', face, {
        balconies,
        awning: rng() < 0.3 ? pick(rng, AWNING_COLORS) : null,
        signName: rng() < 0.32 ? pick(rng, SHOP_NAMES) : null,
      });
    }
  }

  // ---- kerb parking: lanes 8.45 m out (10.6 on the boulevard), never
  // inside a footprint, never across a crossing.
  const overlapsBuilding = (x, z, pad) => data.colliders.some((b) => x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad);
  for (const lx of V_LINES) {
    const off = lx === BOULEVARD_X ? 10.6 : 8.45;
    for (const side of [-1, 1]) {
      for (let z = -298; z <= 298; z += 12.5) {
        if (ROADS_Z.some((rz) => Math.abs(z - rz) < 11.5)) continue;
        const x = lx + side * off;
        if (x < CITY_BOUNDS.minX + 2 || overlapsBuilding(x, z, 2.6)) continue;
        data.parkingSpots.push({ x, z: z + (side > 0 ? 2 : -2), heading: side > 0 ? Math.PI : 0 });
      }
    }
  }
  for (const lz of ROADS_Z) {
    for (const side of [-1, 1]) {
      for (let x = -196; x <= 282; x += 12.5) {
        if (V_LINES.some((lx) => Math.abs(x - lx) < 11.5)) continue;
        const z = lz + side * 8.45;
        if (overlapsBuilding(x, z, 2.6)) continue;
        data.parkingSpots.push({ x: x + (side > 0 ? 2 : -2), z, heading: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
  }

  // ---- benches: the sea promenade, the plaza, the market front.
  for (let z = -276; z <= 276; z += 24) data.benches.push({ x: -224, z, heading: -Math.PI / 2, takenBy: null });
  for (const [bx, bz, hd] of [[38, 36, 2.4], [62, 36, -2.4], [38, 60, 0.8], [62, 60, -0.8], [-196, 4, Math.PI / 2], [-172, -12, -Math.PI / 2]]) {
    data.benches.push({ x: bx, z: bz, heading: hd, takenBy: null });
  }

  // ---- market stalls in two rows before the colonnade.
  let si = 0;
  for (let z = -14; z <= 10; z += 6) { data.stalls.push({ x: -199, z, color: STALL_COLORS[si % STALL_COLORS.length] }); si += 1; }
  for (let z = -10; z <= 8; z += 6) { data.stalls.push({ x: -174, z, color: STALL_COLORS[si % STALL_COLORS.length] }); si += 1; }
  for (const sx of [-197.5, -185, -179.5]) { data.stalls.push({ x: sx, z: -11.8, color: STALL_COLORS[si % STALL_COLORS.length] }); si += 1; }

  // ---- gateway signs where the boulevard crosses each district line.
  const gate = (x, z, name) => data.signs.push({ x, z, name });
  gate(BOULEVARD_X + 11.4, -163, 'LAS PALMAS');
  gate(BOULEVARD_X + 11.4, -100, 'MARINA ALTA');
  gate(BOULEVARD_X + 11.4, 23, 'PLAYA BRAVA');
  gate(BOULEVARD_X + 11.4, 163, 'VIEJO PUERTO');
  gate(BOULEVARD_X + 11.4, -252, 'EL FARO');
  gate(26, -43.4, 'CENTRO ALBA');

  return data;
}

// ------------------------------------------------------------ textures
function canvasTexture(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** The painted facade: a dense window grid, a third of the panes lit warm. */
function facadeTexture() {
  return canvasTexture((g, S) => {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#f8f4ec');
    grad.addColorStop(1, '#e7dfcd');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    const rng = makeRng(4242);
    const cols = 4, rows = 4, cw = S / cols, ch = S / rows;
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const lit = rng() < 0.34;
        const shades = ['#54687e', '#68809a', '#42566c', '#7d94ac'];
        g.fillStyle = lit ? (rng() < 0.5 ? '#ffc987' : '#ffd9a0') : shades[Math.floor(rng() * shades.length)];
        g.fillRect(i * cw + 9, j * ch + 9, cw - 18, ch - 17);
        g.strokeStyle = 'rgba(90,75,60,0.35)';
        g.lineWidth = 2;
        g.strokeRect(i * cw + 9, j * ch + 9, cw - 18, ch - 17);
        g.beginPath();
        g.moveTo(i * cw + cw / 2, j * ch + 7);
        g.lineTo(i * cw + cw / 2, j * ch + ch - 6);
        g.stroke();
      }
    }
  });
}

function asphaltTexture() {
  return canvasTexture((g, S) => {
    g.fillStyle = '#45484d';
    g.fillRect(0, 0, S, S);
    const rng = makeRng(1717);
    for (let i = 0; i < 1000; i += 1) {
      g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
      g.fillRect(rng() * S, rng() * S, 1.6, 1.6);
    }
    g.fillStyle = 'rgba(0,0,0,0.13)';
    g.fillRect(14, 60, 44, 26);
    g.fillRect(84, 12, 30, 20);
  });
}

function pavingTexture() {
  return canvasTexture((g, S) => {
    g.fillStyle = '#d3c3a2';
    g.fillRect(0, 0, S, S);
    const rng = makeRng(2323);
    for (let i = 0; i < 500; i += 1) {
      g.fillStyle = rng() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,250,235,0.06)';
      g.fillRect(rng() * S, rng() * S, 2.2, 2.2);
    }
    g.strokeStyle = '#9a8c6e';
    g.lineWidth = 3;
    g.strokeRect(0, 0, S / 2, S / 2); g.strokeRect(S / 2, 0, S / 2, S / 2);
    g.strokeRect(0, S / 2, S / 2, S / 2); g.strokeRect(S / 2, S / 2, S / 2, S / 2);
  });
}

function sandTexture() {
  return canvasTexture((g, S) => {
    g.fillStyle = '#edd9a3';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(190,160,100,0.4)';
    g.lineWidth = 2;
    for (let y = 8; y < S; y += 13) {
      g.beginPath();
      for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.22 + y) * 2.4);
      g.stroke();
    }
  });
}

function signTexture(text, bg, fg = '#fff8ea', diamond = false) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = '900 52px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  if (diamond) {
    for (const dx of [36, 476]) {
      g.save();
      g.translate(dx, 48);
      g.rotate(Math.PI / 4);
      g.fillStyle = '#ffcf6e';
      g.fillRect(-11, -11, 22, 22);
      g.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// --------------------------------------------------------------- batch
/** Scale a BoxGeometry's UVs per face so facade windows tile by size. */
function scaleFacadeUV(geo, w, h, d, ws) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f += 1) {
    for (let v = 0; v < 4; v += 1) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (dims[f][0] / ws), uv.getY(i) * (dims[f][1] / ws));
    }
  }
}

/**
 * A merged-geometry bucket: boxes and cylinders land in world space at
 * the origin (the staged scenes' balcony fold depends on it), tinted
 * per vertex, and become one mesh per material.
 */
class Batch {
  constructor(material) {
    this.material = material;
    this.pos = []; this.nor = []; this.uv = []; this.col = [];
    this.tmp = new THREE.Color();
  }

  pushGeo(geo, matrix, colorHex) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(matrix);
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    this.tmp.setHex(colorHex);
    for (let i = 0; i < p.count; i += 1) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      this.col.push(this.tmp.r, this.tmp.g, this.tmp.b);
    }
    g.dispose();
    geo.dispose();
  }

  matrix(x, y, z, opts) {
    const e = new THREE.Euler(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0, 'YXZ');
    const m = new THREE.Matrix4().makeRotationFromEuler(e);
    m.setPosition(x, y, z);
    return m;
  }

  box(w, h, d, x, y, z, color, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (opts.facade) scaleFacadeUV(geo, w, h, d, opts.winScale ?? 3.4);
    if (opts.uvScale) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * opts.uvScale[0], uv.getY(i) * opts.uvScale[1]);
    }
    this.pushGeo(geo, this.matrix(x, y, z, opts), color);
  }

  cylinder(rt, rb, h, seg, x, y, z, color, opts = {}) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
    this.pushGeo(geo, this.matrix(x, y, z, opts), color);
  }

  build(scene, shadows = true) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }
}

const BOAT_TRIMS = [0xd84f35, 0x2f7fd0, 0x35b06f, 0xf2b13c];
const LITTER_TONES = [0xf2ead8, 0xd8cfc0, 0xe8e2d2, 0x7a8a3a, 0xa86a2e, 0xe86ab0, 0x57d7e8, 0xc9b896];
const SIGN_BGS = ['#22345e', '#6e2a1e', '#1f4d3a', '#3a2a55', '#14586b'];

// -------------------------------------------------------------- meshes
/** Turn the city's facts into meshes. Returns { boats, ferris }. */
export function buildCityMeshes(scene, data, seed) {
  const rng = makeRng(seed + 77);
  const facade = new Batch(new THREE.MeshLambertMaterial({ map: facadeTexture(), vertexColors: true }));
  const plain = new Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const asphalt = new Batch(new THREE.MeshLambertMaterial({ map: asphaltTexture(), vertexColors: true }));
  const paving = new Batch(new THREE.MeshLambertMaterial({ map: pavingTexture(), vertexColors: true }));
  const sand = new Batch(new THREE.MeshLambertMaterial({ map: sandTexture(), vertexColors: true }));
  const glow = new Batch(new THREE.MeshBasicMaterial({ vertexColors: true }));

  // ---- ground: land base, block paving, plazas, beach, promenade.
  plain.box(580, 0.1, 660, 16, -0.06, 0, 0x8f8a76);
  for (const blk of blockRects()) {
    const w = blk.maxX - blk.minX, d = blk.maxZ - blk.minZ;
    const cx = (blk.minX + blk.maxX) / 2, cz = (blk.minZ + blk.maxZ) / 2;
    const pz = data.plazas.find((p) => Math.abs(p.minX - blk.minX) < 1 && Math.abs(p.minZ - blk.minZ) < 1);
    if (pz && !pz.parking) { plain.box(w, 0.05, d, cx, 0.005, cz, 0x5f9c4e); continue; }
    if (pz && pz.parking) { paving.box(w, 0.04, d, cx, 0.0, cz, 0xd8d5cc, { uvScale: [w / 7, d / 7] }); continue; }
    const tones = [0xf5efe2, 0xe9dfc8, 0xdfd3ba, 0xefe6d0];
    paving.box(w, 0.04, d, cx, 0.0, cz, tones[Math.floor(rng() * tones.length)], { uvScale: [w / 7, d / 7] });
  }
  sand.box(80, 0.04, 460, -266, 0.0, -90, 0xffffff, { uvScale: [10, 57] });
  sand.box(24, 0.04, 180, -238, 0.0, 230, 0xffffff, { uvScale: [3, 22] });
  paving.box(6.5, 0.04, 620, -224.8, 0.0, 0, 0xe9dfc8, { uvScale: [1, 88] }); // the promenade
  paving.box(44, 0.04, 130, -184, 0.0, 195, 0xd8d5cc, { uvScale: [6, 18] }); // marina apron

  // ---- roads, dashes, kerbs, grates, puddles.
  for (const lx of V_LINES) {
    const wdt = lx === BOULEVARD_X ? ROAD_WIDTH + 5 : ROAD_WIDTH;
    asphalt.box(wdt, 0.05, 628, lx, 0.013, 0, 0xffffff, { uvScale: [wdt / 9, 70] });
    for (let z = -304; z <= 304; z += 7) {
      if (ROADS_Z.some((rz) => Math.abs(z - rz) < 9.5)) continue;
      plain.box(0.28, 0.02, 3, lx, 0.045, z, lx === BOULEVARD_X ? 0xf5d76e : 0xd8d5cc);
    }
  }
  for (const lz of ROADS_Z) {
    asphalt.box(556, 0.05, ROAD_WIDTH, 16, 0.016, lz, 0xffffff, { uvScale: [62, ROAD_WIDTH / 9] });
    for (let x = -244; x <= 284; x += 7) {
      if (V_LINES.some((lx) => Math.abs(x - lx) < 9.5)) continue;
      plain.box(3, 0.02, 0.28, x, 0.048, lz, 0xd8d5cc);
    }
  }
  for (const { x, z } of intersections()) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const hw = (x === BOULEVARD_X ? 9.5 : ROAD_WIDTH / 2);
      for (let k = 0; k < 3; k += 1) {
        plain.box(1.05, 0.13, 0.85, x + sx * (hw + 0.7), 0.06, z + sz * (ROAD_WIDTH / 2 + 0.7) + (k - 1) * 1.15 * sz, (k % 2 === 0 ? 0xd8d5cc : 0xc23b2e));
      }
      plain.box(1.4, 0.03, 1.4, x + sx * (hw + 1.9), 0.045, z + sz * (ROAD_WIDTH / 2 + 1.9), 0xd8b13c); // tactile pad
      plain.box(1.1, 0.025, 0.7, x + sx * (hw - 1.2), 0.045, z + sz * (ROAD_WIDTH / 2 - 1.2), 0x24262a); // drain grate
    }
  }
  for (let i = 0; i < 26; i += 1) {
    const onV = rng() < 0.6;
    const px = onV ? pick(rng, V_LINES) + randRange(rng, -4, 4) : randRange(rng, -230, 280);
    const pz = onV ? randRange(rng, -290, 290) : pick(rng, ROADS_Z) + randRange(rng, -4, 4);
    plain.cylinder(randRange(rng, 1.1, 2.1), randRange(rng, 1.1, 2.1), 0.015, 12, px, 0.042, pz, 0x39506b);
  }
  // Fallen flyers and leaves: the city's confetti, settled.
  for (let i = 0; i < 240; i += 1) {
    const lx = randRange(rng, -248, 288), lz = randRange(rng, -304, 304);
    if (lx < -228 && lz > 140) continue;
    plain.box(randRange(rng, 0.25, 0.5), 0.012, randRange(rng, 0.25, 0.45), lx, 0.045, lz, pick(rng, LITTER_TONES), { ry: rng() * 3 });
  }

  // ---- buildings: facade, cornice, roof, balconies, awnings, props.
  const signMeshes = [];
  for (const b of data.buildings) {
    facade.box(b.w, b.h, b.d, b.cx, b.h / 2 + 0.02, b.cz, b.tint, { facade: true, winScale: b.kind === 'tower' ? 3.0 : 3.4 });
    plain.box(b.w + 0.24, 0.26, b.d + 0.24, b.cx, b.h - 0.38, b.cz, 0xf2ead8); // cornice trim
    const roofTone = b.kind === 'tower' ? 0x9aa2a8 : ((Math.round(b.cx + b.cz) % 2) ? 0xb06a48 : 0x9c8d7a);
    plain.box(b.w - 0.3, 0.2, b.d - 0.3, b.cx, b.h + 0.1, b.cz, roofTone);
    const [nx, nz] = FACE_NORMAL[b.face];
    const ry = FACE_ANGLE[b.face];
    for (const bal of b.balconies) {
      const fx = b.cx + nx * (Math.abs(nx) > 0 ? b.w / 2 : 0) + (nx === 0 ? bal.off : 0);
      const fz = b.cz + nz * (Math.abs(nz) > 0 ? b.d / 2 : 0) + (nz === 0 ? bal.off : 0);
      plain.box(1.9, 0.12, 0.9, fx + nx * 0.45, bal.y, fz + nz * 0.45, 0xd8cfc0, { ry });
      plain.box(1.9, 0.55, 0.06, fx + nx * 0.85, bal.y + 0.3, fz + nz * 0.85, 0x5a6672, { ry });
    }
    if (b.awning) {
      const fx = b.cx + nx * (Math.abs(nx) > 0 ? b.w / 2 : 0);
      const fz = b.cz + nz * (Math.abs(nz) > 0 ? b.d / 2 : 0);
      const faceW = (b.face === 'S' || b.face === 'N') ? b.w : b.d;
      plain.box(Math.min(faceW - 1, 7), 0.09, 1.7, fx + nx * 0.8, 2.55, fz + nz * 0.8, b.awning,
        { ry, rx: nz !== 0 ? -nz * 0.32 : 0, rz: nx !== 0 ? nx * 0.32 : 0 });
    }
    const brng = makeRng(Math.abs(Math.round(b.cx * 13 + b.cz * 7)) + 3);
    if (brng() < 0.4) plain.box(1.3, 0.7, 0.95, b.cx + randRange(brng, -b.w / 4, b.w / 4), b.h + 0.55, b.cz + randRange(brng, -b.d / 4, b.d / 4), 0xb9bec2); // roof AC
    if (brng() < 0.12 && b.h >= 9) { // a rooftop water tower
      const tx = b.cx + randRange(brng, -b.w / 5, b.w / 5), tz = b.cz + randRange(brng, -b.d / 5, b.d / 5);
      plain.cylinder(1.05, 1.05, 2.1, 9, tx, b.h + 1.6, tz, 0x9a7648);
      plain.cylinder(0.15, 1.25, 0.8, 9, tx, b.h + 3.05, tz, 0x6e4a26);
    }
    if (b.signName) {
      const fx = b.cx + nx * (Math.abs(nx) > 0 ? b.w / 2 : 0) + nx * 0.16;
      const fz = b.cz + nz * (Math.abs(nz) > 0 ? b.d / 2 : 0) + nz * 0.16;
      const tex = signTexture(b.signName, SIGN_BGS[Math.abs(Math.round(b.cx + b.cz)) % SIGN_BGS.length]);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.82),
        new THREE.MeshLambertMaterial({ map: tex }));
      sign.position.set(fx, 3.05, fz);
      sign.rotation.y = Math.atan2(nx, nz);
      scene.add(sign);
      signMeshes.push(sign);
    }
    if (b.kind === 'tower') { // the Plaza del Reloj clock face + spire
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20),
        new THREE.MeshBasicMaterial({ color: 0xfff8ea }));
      face.position.set(b.cx, 27, b.cz - b.d / 2 - 0.07);
      face.rotation.y = Math.PI;
      scene.add(face);
      plain.box(0.14, 1.2, 0.05, b.cx, 27.4, b.cz - b.d / 2 - 0.12, 0x26313d);
      plain.box(0.9, 0.14, 0.05, b.cx + 0.3, 27, b.cz - b.d / 2 - 0.12, 0x26313d);
      plain.cylinder(0.1, 2.4, 2.6, 4, b.cx, b.h + 1.4, b.cz, 0x9aa2a8, { ry: Math.PI / 4 });
    }
  }

  // ---- the market colonnade and its MARINA ALTA fascia.
  {
    plain.box(36, 0.35, 7.6, -183, 5.05, -10.4, 0xf2ead8); // porch roof
    plain.box(36, 0.55, 0.28, -183, 4.72, -6.75, 0xd86a2e); // orange fascia trim
    for (let x = -199; x <= -167; x += 4.6) plain.cylinder(0.17, 0.19, 5.0, 8, x, 2.5, -7.3, 0xf2ead8);
    const board = new THREE.Mesh(new THREE.BoxGeometry(13, 1.6, 0.22),
      new THREE.MeshLambertMaterial({ color: 0x17708a }));
    board.position.set(-186, 4.15, -6.72);
    board.castShadow = true;
    scene.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 1.45),
      new THREE.MeshBasicMaterial({ map: signTexture('MARINA ALTA', '#17708a', '#ffffff', true) }));
    face.position.set(-186, 4.15, -6.58);
    scene.add(face);
    // String lights under the porch roof, warm against the dusk.
    for (const [x0, x1] of [[-198, -184.5], [-181.5, -168]]) {
      for (let i = 0; i <= 13; i += 1) {
        const t = i / 13;
        glow.box(0.1, 0.1, 0.1, x0 + (x1 - x0) * t, 4.55 - Math.sin(t * Math.PI) * 0.45, -7.1, 0xffd9a3);
      }
    }
  }

  // ---- stalls, benches, lamps.
  for (const s of data.stalls) {
    for (const [ox, oz] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]]) {
      plain.box(0.08, 2.2, 0.08, s.x + ox, 1.1, s.z + oz, 0x6e4a26);
    }
    plain.box(2.5, 0.85, 1.25, s.x, 0.45, s.z, 0x9a7648);
    plain.box(2.9, 0.09, 1.7, s.x, 2.28, s.z, s.color, { rx: 0.1 });
    for (let gi = 0; gi < 3; gi += 1) {
      plain.box(0.42, 0.3, 0.42, s.x - 0.7 + gi * 0.7, 1.05, s.z, pick(rng, [0xd84f35, 0xf2b13c, 0x35b06f, 0xf5f0e6]));
    }
  }
  for (const bn of data.benches) {
    plain.box(1.9, 0.09, 0.5, bn.x, 0.46, bn.z, 0x9a7648, { ry: bn.heading });
    plain.box(1.9, 0.5, 0.08, bn.x - Math.sin(bn.heading) * 0.24, 0.78, bn.z - Math.cos(bn.heading) * 0.24, 0x8a6844, { ry: bn.heading });
    for (const s of [-0.7, 0.7]) {
      plain.box(0.09, 0.46, 0.44, bn.x + Math.cos(bn.heading) * s, 0.23, bn.z - Math.sin(bn.heading) * s, 0x5a4632, { ry: bn.heading });
    }
  }
  for (const lamp of data.lamps) {
    plain.cylinder(0.09, 0.11, 5.6, 7, lamp.x, 2.8, lamp.z, 0x2c2f36);
    let ax = 0, az = 0;
    let bd = Infinity;
    for (const lx of V_LINES) { const d = Math.abs(lamp.x - lx); if (d < bd) { bd = d; ax = Math.sign(lx - lamp.x); az = 0; } }
    for (const lz of ROADS_Z) { const d = Math.abs(lamp.z - lz); if (d < bd) { bd = d; ax = 0; az = Math.sign(lz - lamp.z); } }
    plain.box(Math.abs(ax) > 0 ? 1.5 : 0.12, 0.09, Math.abs(az) > 0 ? 1.5 : 0.12, lamp.x + ax * 0.7, 5.55, lamp.z + az * 0.7, 0x2c2f36);
    glow.box(0.52, 0.1, 0.26, lamp.x + ax * 1.35, 5.48, lamp.z + az * 1.35, 0xffe9a3, { ry: Math.atan2(ax, az) });
  }

  // ---- palms: the boulevard rows, the beach, the plaza corners.
  const palmAt = (x, z, prng) => {
    const lean = randRange(prng, 0, 0.5), la = prng() * Math.PI * 2;
    const lx = Math.sin(la) * lean, lz = Math.cos(la) * lean;
    for (let sgm = 0; sgm < 5; sgm += 1) {
      plain.cylinder(0.18 - sgm * 0.02, 0.2 - sgm * 0.02, 2.1, 7,
        x + lx * sgm * sgm * 0.09, 1.02 + sgm * 1.98, z + lz * sgm * sgm * 0.09, 0x9a7648);
    }
    const tx = x + lx * 1.5, tz = z + lz * 1.5, ty = 10.45;
    for (let f = 0; f < 8; f += 1) {
      const a = (f / 8) * Math.PI * 2 + prng() * 0.5;
      plain.box(0.62, 0.05, 4.2, tx + Math.sin(a) * 1.05, ty + 0.55, tz + Math.cos(a) * 1.05,
        f % 2 ? 0x3e7d46 : 0x4c8a4f, { ry: a, rx: 1.05 });
    }
    plain.box(0.17, 0.17, 0.17, tx + 0.14, ty - 0.12, tz + 0.1, 0x6e4a26);
    plain.box(0.15, 0.15, 0.15, tx - 0.15, ty - 0.14, tz - 0.08, 0x6e4a26);
  };
  for (let z = -292; z <= 292; z += 15) {
    if (ROADS_Z.some((rz) => Math.abs(z - rz) < 8.5)) continue;
    palmAt(BOULEVARD_X - 10.6, z + 4, rng);
    if (z > -26 && z < 4) continue; // the market frontage keeps its sign clear
    palmAt(BOULEVARD_X + 10.6, z, rng);
  }
  for (let i = 0; i < 42; i += 1) {
    const px = randRange(rng, -246, -231), pz = randRange(rng, -282, 282);
    if (Math.hypot(px - data.ferris.x, pz - data.ferris.z) < 13) continue;
    if (pz > 140 && px < -240) continue;
    palmAt(px, pz, rng);
  }
  for (const [px, pz] of [[32, 30], [68, 30], [32, 66], [68, 66], [-196, -24], [-170, -24]]) palmAt(px, pz, rng);

  // ---- the plaza fountain (and its collider, so nobody wades).
  {
    const fp = PLACES.plaza;
    plain.cylinder(4.2, 4.5, 0.7, 16, fp.x, 0.35, fp.z, 0xd8cfc0);
    plain.cylinder(3.7, 3.7, 0.12, 16, fp.x, 0.62, fp.z, 0x57b7d7);
    plain.cylinder(0.32, 0.45, 1.7, 10, fp.x, 1.1, fp.z, 0xd8cfc0);
    plain.cylinder(1.05, 0.7, 0.3, 12, fp.x, 2.0, fp.z, 0xd8cfc0);
    addCollider(data, { minX: fp.x - 4.4, maxX: fp.x + 4.4, minZ: fp.z - 4.4, maxZ: fp.z + 4.4 });
  }

  // ---- the lighthouse on the point.
  {
    const lp = PLACES.lighthouse;
    plain.cylinder(2.6, 3.0, 6, 14, lp.x, 3, lp.z, 0xf2f4f4);
    plain.cylinder(2.2, 2.45, 3, 14, lp.x, 7.5, lp.z, 0xd8402e);
    plain.cylinder(1.9, 2.1, 4, 14, lp.x, 11, lp.z, 0xf2f4f4);
    plain.cylinder(1.5, 1.5, 0.4, 12, lp.x, 13.2, lp.z, 0x26313d);
    glow.box(0.85, 0.9, 0.85, lp.x, 14.1, lp.z, 0xffd76a);
    plain.cylinder(0.1, 1.6, 1.3, 10, lp.x, 15.2, lp.z, 0x26313d);
    addCollider(data, { minX: lp.x - 3, maxX: lp.x + 3, minZ: lp.z - 3, maxZ: lp.z + 3 });
  }

  // ---- piers, boats, cranes, the Ferris wheel.
  for (let i = 0; i < 4; i += 1) plain.box(26, 0.35, 3.6, -246, 0.3, 198 + i * 22, 0x8a6844);
  plain.box(data.pier.fromX - data.pier.toX, 0.35, 5, (data.pier.fromX + data.pier.toX) / 2, 0.3, data.pier.z, 0x8a6844);
  const boats = [];
  for (let i = 0; i < 8; i += 1) {
    const bx = -254 - (i % 3) * 7.5, bz = 194 + i * 12.5;
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 6.2), new THREE.MeshLambertMaterial({ color: 0xf0ede6 }));
    hull.position.y = 0.32;
    boat.add(hull);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 6.3), new THREE.MeshLambertMaterial({ color: BOAT_TRIMS[i % 4] }));
    trim.position.y = 0.6;
    boat.add(trim);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.2), new THREE.MeshLambertMaterial({ color: 0xf0ede6 }));
    cabin.position.set(0, 0.95, -0.6);
    boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x6e4a26 }));
    mast.position.set(0, 2.2, 0.9);
    boat.add(mast);
    boat.position.set(bx, 0.1, bz);
    boat.userData.phase = i * 1.37;
    scene.add(boat);
    boats.push(boat);
  }
  for (const cr of data.cranes) {
    plain.box(2.4, 1.2, 2.4, cr.x, 0.6, cr.z, 0x5a4632);
    plain.box(0.45, 15, 0.45, cr.x, 8, cr.z, 0xc94f38);
    plain.box(11, 0.4, 0.4, cr.x + Math.sin(cr.ry) * 3.2, 14.6, cr.z + Math.cos(cr.ry) * 3.2, 0xc94f38, { ry: cr.ry });
    plain.box(1.1, 1.1, 1.1, cr.x - Math.sin(cr.ry) * 2.2, 14.2, cr.z - Math.cos(cr.ry) * 2.2, 0x5a4632);
  }
  const ferris = new THREE.Group();
  {
    const fp = data.ferris;
    plain.box(0.32, 10.6, 0.32, fp.x - 1.8, 4.9, fp.z, 0x5a6672, { rz: 0.3 });
    plain.box(0.32, 10.6, 0.32, fp.x + 1.8, 4.9, fp.z, 0x5a6672, { rz: -0.3 });
    const spin = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.2, 8, 28), new THREE.MeshLambertMaterial({ color: 0xe86a1e }));
    rim.castShadow = true;
    spin.add(rim);
    for (let s = 0; s < 6; s += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 16.6, 0.14), new THREE.MeshLambertMaterial({ color: 0xd8cfc0 }));
      spoke.rotation.z = (s / 6) * Math.PI;
      spin.add(spoke);
    }
    const cabinCols = [0xd84f35, 0x2f8fae, 0xf2b13c, 0x3fae6a, 0xe86ab0, 0x57d7e8, 0xf5f0e6, 0xff8c42];
    for (let ci = 0; ci < 8; ci += 1) {
      const a = (ci / 8) * Math.PI * 2;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.15, 1.0), new THREE.MeshLambertMaterial({ color: cabinCols[ci] }));
      cab.position.set(Math.sin(a) * 8.6, Math.cos(a) * 8.6, 0);
      cab.castShadow = true;
      spin.add(cab);
    }
    ferris.add(spin);
    ferris.userData.spin = spin;
    ferris.position.set(fp.x, 9.8, fp.z);
    ferris.rotation.y = Math.PI / 2;
    scene.add(ferris);
  }

  // ---- gateway signs, billboards, pennant strings.
  for (const s of data.signs) {
    const onBoulevard = Math.abs(s.x - BOULEVARD_X) < 20;
    const ry = onBoulevard ? -Math.PI / 2 : Math.PI;
    for (const offSide of [-1.7, 1.7]) {
      plain.cylinder(0.07, 0.07, 2.9, 6, s.x + (onBoulevard ? 0 : offSide), 1.45, s.z + (onBoulevard ? offSide : 0), 0x2c2f36);
    }
    const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 1.0),
      new THREE.MeshBasicMaterial({ map: signTexture(s.name, '#14586b', '#ffffff', true), side: THREE.DoubleSide }));
    boardMesh.position.set(s.x, 2.35, s.z);
    boardMesh.rotation.y = ry;
    scene.add(boardMesh);
  }
  const ADS = [['SOL', '#c94f38'], ['REGATA', '#14586b'], ['HOTEL BRISA', '#3a2a55']];
  [[BOULEVARD_X + 12.6, -120, -Math.PI / 2], [BOULEVARD_X + 12.6, 216, -Math.PI / 2], [150, -34.5, Math.PI]].forEach(([ax, az, ry], i) => {
    plain.cylinder(0.16, 0.2, 7.4, 8, ax, 3.7, az, 0x5a6672);
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.3, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x26313d }));
    boardMesh.position.set(ax, 8.6, az);
    boardMesh.rotation.y = ry;
    boardMesh.castShadow = true;
    scene.add(boardMesh);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 2.95),
      new THREE.MeshBasicMaterial({ map: signTexture(ADS[i][0], ADS[i][1]) }));
    face.position.set(ax + Math.sin(ry) * 0.14, 8.6, az + Math.cos(ry) * 0.14);
    face.rotation.y = ry;
    scene.add(face);
  });
  const pennantCols = [0xd84f35, 0xf2b13c, 0x35b06f, 0x57d7e8, 0xe86ab0];
  for (const [x0, z0, x1, z1] of [[-200, -6, -168, -6], [-88, 164, -46, 164], [-224, 96, -200, 96]]) {
    plain.cylinder(0.06, 0.06, 5, 6, x0, 2.5, z0, 0x5a4632);
    plain.cylinder(0.06, 0.06, 5, 6, x1, 2.5, z1, 0x5a4632);
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      plain.box(0.3, 0.38, 0.03, x0 + (x1 - x0) * t, 4.7 - Math.sin(t * Math.PI) * 0.7, z0 + (z1 - z0) * t,
        pennantCols[i % pennantCols.length], { ry: Math.atan2(x1 - x0, z1 - z0) });
    }
  }

  facade.build(scene);
  plain.build(scene);
  asphalt.build(scene, false);
  paving.build(scene, false);
  sand.build(scene, false);
  glow.build(scene, false);

  return { boats, ferris };
}
