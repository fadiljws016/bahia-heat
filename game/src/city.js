// city.js — Puerto Alba itself: the street grid, the six districts, the
// painted ground and facades, the market colonnade on the promenade and
// the named buildings every story in the game leans on. Round seventeen
// rebuilds the city from the locked survey: every texture below is a
// painted canvas (asphalt with aggregate and tar seams, paving slabs
// with grout and wear, facades with shutters and shopfronts), and the
// colonnade stands exactly where the cover camera has always found it —
// columns at x -187.2, the MARINA ALTA board on its west face at z -9.8,
// hung to be read whole from the beach side.
import { makeRng, randRange, pick } from './util.js';

export const ROAD_WIDTH = 14;
export const BOULEVARD_X = -212;
export const BOULEVARD_WIDTH = 20;
export const ROADS_X = [-160, -100, -40, 20, 80, 140, 200, 260];
export const ROADS_Z = [-280, -220, -160, -100, -40, 20, 80, 140, 200, 260];
export const CITY_BOUNDS = { minX: -252, maxX: 292, minZ: -308, maxZ: 308 };
export const BEACH_X = -228; // west of this line: sand, then sea

export const DISTRICTS = [
  { name: 'El Faro', minX: -252, maxX: -165, minZ: -308, maxZ: -70 },
  { name: 'Marina Alta', minX: -252, maxX: -165, minZ: -70, maxZ: 70 },
  { name: 'Playa Brava', minX: -252, maxX: -165, minZ: 70, maxZ: 308 },
  { name: 'Las Palmas', minX: -165, maxX: 130, minZ: -308, maxZ: -110 },
  { name: 'Centro Alba', minX: -165, maxX: 130, minZ: -110, maxZ: 110 },
  { name: 'Viejo Puerto', minX: -165, maxX: 130, minZ: 110, maxZ: 308 },
  { name: 'Viejo Puerto', minX: 130, maxX: 292, minZ: -110, maxZ: 308 },
  { name: 'Las Palmas', minX: 130, maxX: 292, minZ: -308, maxZ: -110 },
];

export const PLACES = {
  playerStart: { x: -198, z: 8 },
  marisolCorner: { x: -193.5, z: -7.3 },
  plaza: { x: 50, z: 50 },
  clockTower: { x: 36, z: 36 },
  garage: { x: -70, z: -78 },
  garagePad: { x: -70, z: -58 },
  hospital: { x: 170, z: -130 },
  policeStation: { x: 230, z: 50 },
  marinaGate: { x: -212, z: 290 },
  marinaDock: { x: -256, z: 224 },
  lighthouse: { x: -244, z: -268 },
  beachBar: { x: -196, z: 120 },
  raceStart: { x: 206, z: 140 },
  warehouse: { x: 110, z: 230 },
  alleyShootout: { x: 110, z: -70 },
};

const PASTEL_TINTS = [0xf6e3b4, 0xf2c184, 0xef9f7d, 0xe8dfc8, 0xbfe0d0, 0xf5a8c0, 0xa9cdea, 0xf7dd7e, 0xdcb98d, 0x93c9a4, 0xe89a5f, 0xfdf6ec];
const TOWER_TINTS = [0xd8e2e8, 0xb9c9d6, 0xe6d3ae, 0xaec6d8, 0xd8bf9e, 0xc3d2da];
export const AWNING_COLORS = [0xc94f38, 0x2f7f8f, 0xe8a33c, 0x3f7d4e, 0x7a4a8f, 0xd84f78];
const STALL_COLORS = [0xd84f35, 0x2f8fae, 0xf2b13c, 0x3fae6a, 0xe86ab0];

export const SIGN_STYLE = {
  'MARINA ALTA': ['#0e5a68', '#ffedc2', '#ffb340'],
  'LAS PALMAS': ['#27693f', '#fdf3d0', '#ffb340'],
  'CENTRO ALBA': ['#274b63', '#ffedc2', '#57d7e8'],
  'VIEJO PUERTO': ['#a02c1e', '#ffe9b0', '#ffb340'],
  'EL FARO': ['#8a4d16', '#ffedc2', '#ffd23e'],
  'PLAYA BRAVA': ['#b83a5e', '#ffedc2', '#57d7e8'],
};

/** The district name containing a point, or the city's own out of town. */
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d.name;
  }
  return 'Puerto Alba';
}

/** True when a point sits on a carriageway (a street or the boulevard). */
export function isOnRoad(x, z) {
  if (Math.abs(x - BOULEVARD_X) <= BOULEVARD_WIDTH / 2) return true;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
  for (const rz of ROADS_Z) if (Math.abs(z - rz) <= ROAD_WIDTH / 2) return true;
  return false;
}

/** Every crossing of a vertical and a horizontal street. */
export function intersections() {
  const out = [];
  for (const rx of [BOULEVARD_X, ...ROADS_X]) for (const rz of ROADS_Z) out.push({ x: rx, z: rz });
  return out;
}

/**
 * Lamp posts belong on corner kerbs, never in a carriageway: one post
 * per crossing, stepped diagonally off the corner by the road's half
 * width plus a kerb's breadth, alternating corners by crossing parity.
 */
export function streetlightSpots() {
  const spots = [];
  let n = 0;
  for (const ix of intersections()) {
    const half = (ix.x === BOULEVARD_X ? BOULEVARD_WIDTH : ROAD_WIDTH) / 2;
    const sx = n % 2 === 0 ? 1 : -1;
    const sz = n % 3 === 0 ? -1 : 1;
    spots.push({ x: ix.x + sx * (half + 1.4), z: ix.z + sz * (ROAD_WIDTH / 2 + 1.4) });
    n += 1;
  }
  return spots;
}

/** A random point on a random street, with its lane heading. */
export function randomRoadPoint(rng) {
  if (rng() < 0.55) {
    const line = pick(rng, [BOULEVARD_X, ...ROADS_X]);
    const dir = rng() < 0.5 ? 1 : -1;
    const z = randRange(rng, CITY_BOUNDS.minZ + 16, CITY_BOUNDS.maxZ - 16);
    return { x: line + dir * -3.4, z, heading: dir > 0 ? 0 : Math.PI, axis: 'z', line, dir };
  }
  const line = pick(rng, ROADS_Z);
  const dir = rng() < 0.5 ? 1 : -1;
  const x = randRange(rng, CITY_BOUNDS.minX + 16, CITY_BOUNDS.maxX - 16);
  return { x, z: line + dir * 3.4, heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'x', line, dir };
}

/** Register a solid AABB on the city data. */
export function addCollider(data, box) {
  data.colliders.push({ minX: box.minX, maxX: box.maxX, minZ: box.minZ, maxZ: box.maxZ });
  return box;
}

/** Colliders whose AABB comes within a few metres of a point. */
export function collidersNear(data, x, z) {
  if (!data) return [];
  const out = [];
  for (const c of data.colliders) {
    if (x >= c.minX - 6 && x <= c.maxX + 6 && z >= c.minZ - 6 && z <= c.maxZ + 6) out.push(c);
  }
  return out;
}

// ------------------------------------------------------------ city data
function blockGrid() {
  // Blocks are the cells between neighbouring street centrelines,
  // inset by each street's half width: buildings live inside them.
  const vLines = [BOULEVARD_X, ...ROADS_X];
  const vHalf = (x) => (x === BOULEVARD_X ? BOULEVARD_WIDTH : ROAD_WIDTH) / 2;
  const blocks = [];
  for (let i = 0; i < vLines.length - 1; i += 1) {
    for (let j = 0; j < ROADS_Z.length - 1; j += 1) {
      blocks.push({
        minX: vLines[i] + vHalf(vLines[i]) + 3, maxX: vLines[i + 1] - vHalf(vLines[i + 1]) - 3,
        minZ: ROADS_Z[j] + ROAD_WIDTH / 2 + 3, maxZ: ROADS_Z[j + 1] - ROAD_WIDTH / 2 - 3,
      });
    }
  }
  for (let j = 0; j < ROADS_Z.length - 1; j += 1) {
    blocks.push({
      minX: 260 + ROAD_WIDTH / 2 + 3, maxX: CITY_BOUNDS.maxX - 4,
      minZ: ROADS_Z[j] + ROAD_WIDTH / 2 + 3, maxZ: ROADS_Z[j + 1] - ROAD_WIDTH / 2 - 3,
    });
  }
  return blocks;
}

function buildingRecord(cx, cz, w, d, h, tint, opts = {}) {
  return {
    cx, cz, w, d, h, tint,
    roof: opts.roof ?? null,
    face: opts.face ?? 'S',
    balconies: opts.balconies ?? [],
    facade: opts.facade ?? 0,
    shopFront: !!opts.shopFront,
    name: opts.name ?? null,
    tower: !!opts.tower,
  };
}

export function buildCityData(seed) {
  const rng = makeRng(seed);
  const data = { buildings: [], colliders: [], benches: [], stalls: [], parking: [], plazas: [] };
  const addBuilding = (b) => {
    data.buildings.push(b);
    addCollider(data, { minX: b.cx - b.w / 2, maxX: b.cx + b.w / 2, minZ: b.cz - b.d / 2, maxZ: b.cz + b.d / 2 });
    return b;
  };

  // The named buildings go in first, at their surveyed footprints.
  addBuilding(buildingRecord(PLACES.garage.x, PLACES.garage.z, 26, 20, 9, 0xe8b48c, { name: 'garage', shopFront: true, facade: 1 }));
  addBuilding(buildingRecord(PLACES.hospital.x, PLACES.hospital.z, 30, 22, 16, 0xf2f4f4, { name: 'hospital', facade: 2 }));
  addBuilding(buildingRecord(PLACES.policeStation.x, PLACES.policeStation.z, 28, 20, 13, 0xb9cbd8, { name: 'police', facade: 3 }));
  addBuilding(buildingRecord(PLACES.clockTower.x, PLACES.clockTower.z, 8, 8, 34, 0xe8d9b0, { name: 'clocktower', tower: true, facade: 4 }));
  addBuilding(buildingRecord(PLACES.warehouse.x, PLACES.warehouse.z, 34, 24, 11, 0xcbb79a, { name: 'almacen', shopFront: true, facade: 5 }));
  addBuilding(buildingRecord(PLACES.beachBar.x + 6, PLACES.beachBar.z, 14, 10, 6, 0xf2c184, { name: 'bar', shopFront: true, facade: 0 }));

  // The combat corner house: south face to the alley yard, its low
  // balconies over the staged seat (shots.js folds them away), and a
  // taller one above the frame left alone.
  const at = PLACES.alleyShootout;
  addBuilding(buildingRecord(at.x - 11, at.z - 11, 11, 11, 12, 0xef9f7d, {
    face: 'S', facade: 1,
    balconies: [{ y: 3.1, off: 1.5 }, { y: 4.3, off: 1.5 }, { y: 7.5, off: 1.5 }],
  }));

  const namedSpots = [PLACES.garage, PLACES.hospital, PLACES.policeStation, PLACES.clockTower,
    PLACES.warehouse, PLACES.plaza, at];
  const nearNamed = (x, z, r) => namedSpots.some((p) => Math.abs(p.x - x) < r && Math.abs(p.z - z) < r);

  // Generic fill: each block splits into lots; most grow a building,
  // some stay open courts or planted plaza green.
  for (const blk of blockGrid()) {
    const bw = blk.maxX - blk.minX, bd = blk.maxZ - blk.minZ;
    if (bw < 18 || bd < 18) continue;
    const cx = (blk.minX + blk.maxX) / 2, cz = (blk.minZ + blk.maxZ) / 2;
    // The strip between the boulevard and the first street is the
    // open promenade: the colonnade, the market and the sea wall
    // own it — no building ever rises there.
    if (blk.maxX <= -165) continue;
    if (nearNamed(cx, cz, 30)) {
      if (!nearNamed(cx, cz, 12)) {
        const cand = buildingRecord(blk.minX + 8, blk.minZ + 8, 12, 12, randRange(rng, 7, 11),
          pick(rng, PASTEL_TINTS), { facade: Math.floor(rng() * 6), shopFront: rng() < 0.4 });
        const overlaps = data.buildings.some((b) =>
          Math.abs(b.cx - cand.cx) < (b.w + cand.w) / 2 && Math.abs(b.cz - cand.cz) < (b.d + cand.d) / 2);
        if (!overlaps) addBuilding(cand);
      }
      continue;
    }
    const lotsX = bw > 34 ? 2 : 1, lotsZ = bd > 34 ? 2 : 1;
    for (let li = 0; li < lotsX; li += 1) for (let lj = 0; lj < lotsZ; lj += 1) {
      const lx = blk.minX + (li + 0.5) * (bw / lotsX);
      const lz = blk.minZ + (lj + 0.5) * (bd / lotsZ);
      const roll = rng();
      if (roll < 0.1) { data.plazas.push({ x: lx, z: lz, r: 12 }); continue; }
      if (roll < 0.2) continue;
      const district = districtAt(lx, lz);
      const tower = district === 'Centro Alba' && rng() < 0.4;
      const w = Math.min(bw / lotsX - 5, randRange(rng, 13, 20));
      const d = Math.min(bd / lotsZ - 5, randRange(rng, 13, 20));
      const h = tower ? randRange(rng, 19, 32) : randRange(rng, 7, 15);
      const tint = tower ? pick(rng, TOWER_TINTS) : pick(rng, PASTEL_TINTS);
      const balconies = [];
      if (!tower && rng() < 0.5) {
        const off = randRange(rng, -w / 4, w / 4);
        balconies.push({ y: 3.1, off }, { y: 6.1, off });
      }
      addBuilding(buildingRecord(lx, lz, w, d, h, tint, {
        facade: Math.floor(rng() * 6), tower,
        shopFront: rng() < 0.45, face: pick(rng, ['S', 'N', 'E', 'W']), balconies,
      }));
    }
  }

  // Parking: kerb spots along every street, gathered after the
  // buildings stand so the relocation pass can drop any spot a
  // footprint swallows — no car is ever parked inside a wall.
  const spotFree = (x, z) => !data.buildings.some((b) =>
    x > b.cx - b.w / 2 - 3 && x < b.cx + b.w / 2 + 3 && z > b.cz - b.d / 2 - 3 && z < b.cz + b.d / 2 + 3);
  const addSpots = (fixed, along, isX, offset, heading) => {
    for (let a = along[0]; a <= along[1]; a += 13) {
      const x = isX ? fixed + offset : a;
      const z = isX ? a : fixed + offset;
      const nearCrossing = [...ROADS_X, BOULEVARD_X].some((r) => Math.abs((isX ? z : x) - r) < 11)
        || ROADS_Z.some((r) => Math.abs((isX ? x : z) - r) < 11);
      if (nearCrossing) continue;
      if (spotFree(x, z)) data.parking.push({ x, z, heading });
    }
  };
  for (const rx of ROADS_X) {
    addSpots(rx, [CITY_BOUNDS.minZ + 14, CITY_BOUNDS.maxZ - 14], true, 8.45, 0);
    addSpots(rx, [CITY_BOUNDS.minZ + 20, CITY_BOUNDS.maxZ - 14], true, -8.45, Math.PI);
  }
  addSpots(BOULEVARD_X, [CITY_BOUNDS.minZ + 14, CITY_BOUNDS.maxZ - 14], true, 10.6, Math.PI);
  for (const rz of ROADS_Z) {
    addSpots(rz, [CITY_BOUNDS.minX + 20, CITY_BOUNDS.maxX - 14], false, 8.45, Math.PI / 2);
    addSpots(rz, [CITY_BOUNDS.minX + 26, CITY_BOUNDS.maxX - 14], false, -8.45, -Math.PI / 2);
  }

  // Promenade benches face the sea; the cover frame's sitter takes
  // the one at (-200.3, -20).
  for (let z = -62; z <= 168; z += 13.5) {
    data.benches.push({ x: -200.3, z: Math.round(z * 10) / 10, heading: -Math.PI / 2, takenBy: null });
  }
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    data.benches.push({ x: PLACES.plaza.x + Math.cos(a) * 11, z: PLACES.plaza.z + Math.sin(a) * 11, heading: a + Math.PI, takenBy: null });
  }

  // The market row under the colonnade.
  for (let z = -38; z <= 38; z += 8.5) {
    if (Math.abs(z + 9.8) < 5) continue;
    data.stalls.push({ x: -183.5, z, color: pick(rng, STALL_COLORS) });
  }
  return data;
}

// ------------------------------------------------------- painted canvas
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = size[0]; c.height = size[1];
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  tex.anisotropy = 4;
  return tex;
}

/** Paving: grout, toned slabs, wear speckle, rain stains. */
function makePavingTexture(rng) {
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#877c68'; g.fillRect(0, 0, 256, 256);
    for (let sx = 0; sx < 4; sx += 1) for (let sy = 0; sy < 4; sy += 1) {
      const v = (rng() - 0.5) * 14;
      g.fillStyle = `rgb(${176 + v},${166 + v},${144 + v})`;
      g.fillRect(sx * 64 + 2, sy * 64 + 2, 60, 60);
      for (let i = 0; i < 26; i += 1) {
        g.fillStyle = `rgba(90,80,64,${0.05 + rng() * 0.09})`;
        g.fillRect(sx * 64 + 3 + rng() * 56, sy * 64 + 3 + rng() * 56, 2, 2);
      }
    }
    for (let i = 0; i < 7; i += 1) {
      const x = rng() * 256, y = rng() * 256, r = 18 + rng() * 22;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, `rgba(70,60,44,${0.10 + rng() * 0.08})`);
      gr.addColorStop(1, 'rgba(70,60,44,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

/** Asphalt: dark aggregate, patched cracks, tar seams, oil blooms. */
function makeAsphaltTexture(rng) {
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#33373c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i += 1) {
      g.fillStyle = rng() < 0.5 ? `rgba(210,215,220,${0.04 + rng() * 0.07})` : `rgba(8,10,12,${0.05 + rng() * 0.08})`;
      g.fillRect(rng() * 256, rng() * 256, 1.6, 1.6);
    }
    g.strokeStyle = 'rgba(12,13,15,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      g.beginPath();
      let x = rng() * 256, y = rng() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s += 1) { x += (rng() - 0.5) * 60; y += (rng() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(10,10,12,0.5)';
    g.fillRect(0, 40 + rng() * 60, 256, 7);
    g.fillRect(0, 150 + rng() * 60, 256, 6);
    for (let i = 0; i < 8; i += 1) {
      const x = rng() * 256, y = rng() * 256, r = 8 + rng() * 16;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(5,6,8,0.20)'); gr.addColorStop(1, 'rgba(5,6,8,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

/** Beach sand: warm grain, wind ripples, shell speckle. */
function makeSandTexture(rng) {
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#d9b878'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i += 1) {
      g.fillStyle = rng() < 0.5 ? 'rgba(160,128,80,0.10)' : 'rgba(245,230,190,0.10)';
      g.fillRect(rng() * 256, rng() * 256, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(170,138,88,0.25)'; g.lineWidth = 2;
    for (let y = 8; y < 256; y += 18) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.11 + y) * 3);
      g.stroke();
    }
    for (let i = 0; i < 40; i += 1) {
      g.fillStyle = 'rgba(250,246,238,0.8)';
      g.fillRect(rng() * 256, rng() * 256, 2.4, 1.6);
    }
  });
}

/** One painted facade variant: grime, floors of windows, a ground floor. */
function makeFacadeTexture(rng, shopFront) {
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#f6f1e5'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 7; i += 1) {
      g.fillStyle = `rgba(120,100,70,${0.03 + rng() * 0.05})`;
      g.fillRect(rng() * 200, rng() * 200, 30 + rng() * 60, 20 + rng() * 50);
    }
    for (let f = 0; f < 4; f += 1) {
      const yTop = f * 64; // canvas top = building top (flipY)
      const isGround = f === 3;
      if (isGround && shopFront) {
        g.fillStyle = '#8a97a3'; g.fillRect(0, yTop, 256, 14);
        for (let x = 10; x + 48 <= 256; x += 58) {
          g.fillStyle = '#33505e'; g.fillRect(x, yTop + 20, 48, 40);
          g.fillStyle = 'rgba(180,225,245,0.5)'; g.fillRect(x + 4, yTop + 24, 18, 32);
        }
        g.fillStyle = '#5a4632'; g.fillRect(118, yTop + 20, 24, 44);
        continue;
      }
      if (isGround) { g.fillStyle = '#6e5136'; g.fillRect(112, yTop + 16, 30, 48); continue; }
      for (let x = 14; x + 30 <= 256; x += 44) {
        const lit = rng() < 0.3;
        g.fillStyle = lit ? '#ffd98a' : '#3c4a56';
        g.fillRect(x, yTop + 14, 30, 36);
        g.fillStyle = 'rgba(240,248,255,0.35)'; g.fillRect(x + 3, yTop + 17, 10, 14);
        g.fillStyle = '#7a6a52'; g.fillRect(x - 3, yTop + 50, 36, 5);
        if (rng() < 0.5) {
          g.fillStyle = '#5d7a68'; g.fillRect(x - 7, yTop + 14, 5, 36); g.fillRect(x + 32, yTop + 14, 5, 36);
        }
        if (rng() < 0.35) {
          g.fillStyle = '#b9bec2'; g.fillRect(x + 6, yTop + 55, 16, 8);
        }
      }
    }
  });
}

/** A district sign face: board colour, cream letters, accent rule. */
export function makeDistrictSignTexture(name, bg, fg, accent, wide) {
  return canvasTex([wide ? 1216 : 1024, 160], (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, h - 14, w, 14);
    g.fillStyle = fg;
    g.font = `bold ${wide ? 104 : 96}px Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, w / 2, h / 2 - 4);
  }, false);
}

// ------------------------------------------------------------- geometry
// Merged batches at the world origin: the staged scenes fold balcony
// vertices out of these, so everything static a balcony belongs to
// must live here, positioned by its vertices, never by a matrix.
class Batch {
  constructor(material) {
    this.material = material;
    this.pos = []; this.nor = []; this.uv = []; this.col = [];
  }

  add(geo, matrix, colorHex, uvScale = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    const color = new THREE.Color(colorHex);
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      this.nor.push(v.x, v.y, v.z);
      let uu = u ? u.getX(i) : 0, vv = u ? u.getY(i) : 0;
      if (uvScale) { uu *= uvScale[0]; vv *= uvScale[1]; }
      this.uv.push(uu, vv);
      this.col.push(color.r, color.g, color.b);
    }
    if (g !== geo) g.dispose();
    return this;
  }

  box(cx, cy, cz, sx, sy, sz, colorHex, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry);
    m.setPosition(cx, cy, cz);
    return this.add(new THREE.BoxGeometry(sx, sy, sz), m, colorHex);
  }

  build(scene) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
}

/** A facade-textured building in its variant batch, UVs scaled per face. */
function addFacadeBox(batch, b, winScale = 12) {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed();
  const uv = geo.attributes.uv;
  // Face order after de-indexing: +x, -x, +y, -y, +z, -z, six verts each.
  const scales = [
    [b.d / winScale, b.h / winScale], [b.d / winScale, b.h / winScale],
    [0.001, 0.001], [0.001, 0.001],
    [b.w / winScale, b.h / winScale], [b.w / winScale, b.h / winScale],
  ];
  for (let f = 0; f < 6; f += 1) {
    for (let i = f * 6; i < f * 6 + 6; i += 1) {
      uv.setXY(i, uv.getX(i) * scales[f][0], uv.getY(i) * scales[f][1]);
    }
  }
  const m = new THREE.Matrix4();
  m.setPosition(b.cx, b.h / 2, b.cz);
  batch.add(geo, m, b.tint);
  geo.dispose();
}

const FACE_ANGLE = { S: Math.PI, N: 0, W: -Math.PI / 2, E: Math.PI / 2 };
const FACE_NORMAL = { S: [0, -1], N: [0, 1], W: [-1, 0], E: [1, 0] };

// ------------------------------------------------------------ the meshes
export function buildCityMeshes(scene, data, seed) {
  const rng = makeRng(seed ^ 0x5eed);
  const plain = new Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));

  // Ground: one paving skin under everything, then the worked streets.
  const pavingTex = makePavingTexture(rng);
  pavingTex.repeat.set(90, 100);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_BOUNDS.maxX - CITY_BOUNDS.minX + 80, CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ + 80),
    new THREE.MeshLambertMaterial({ map: pavingTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((CITY_BOUNDS.minX + CITY_BOUNDS.maxX) / 2, 0, (CITY_BOUNDS.minZ + CITY_BOUNDS.maxZ) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const asphaltTex = makeAsphaltTexture(rng);
  const addRoad = (cx, cz, w, l, alongZ) => {
    const tex = asphaltTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, l / 16);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshLambertMaterial({ map: tex }));
    mesh.rotation.x = -Math.PI / 2;
    if (!alongZ) mesh.rotation.z = Math.PI / 2;
    mesh.position.set(cx, 0.02, cz);
    mesh.receiveShadow = true;
    scene.add(mesh);
    const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5d76e, emissive: 0x554411 });
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.02, 3), dashMat, Math.floor(l / 9));
    const m4 = new THREE.Matrix4();
    let di = 0;
    for (let a = -l / 2 + 5; a < l / 2 - 4; a += 9) {
      if (alongZ) m4.makeTranslation(cx, 0.04, cz + a);
      else { m4.makeRotationY(Math.PI / 2); m4.setPosition(cx + a, 0.04, cz); }
      dashes.setMatrixAt(di, m4); di += 1;
    }
    dashes.count = di;
    scene.add(dashes);
    for (const s of [-1, 1]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.5 : l, 0.09, alongZ ? l : 0.5),
        new THREE.MeshLambertMaterial({ color: s < 0 ? 0xd8d5cc : 0xc23b2e }));
      kerb.position.set(alongZ ? cx + s * (w / 2 + 0.25) : cx, 0.045, alongZ ? cz : cz + s * (w / 2 + 0.25));
      kerb.receiveShadow = true;
      scene.add(kerb);
    }
  };
  const spanZ = CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ, spanX = CITY_BOUNDS.maxX - CITY_BOUNDS.minX;
  const midZ = (CITY_BOUNDS.minZ + CITY_BOUNDS.maxZ) / 2, midX = (CITY_BOUNDS.minX + CITY_BOUNDS.maxX) / 2;
  for (const rx of ROADS_X) addRoad(rx, midZ, ROAD_WIDTH, spanZ, true);
  addRoad(BOULEVARD_X, midZ, BOULEVARD_WIDTH, spanZ, true);
  for (const rz of ROADS_Z) addRoad(midX, rz, ROAD_WIDTH, spanX, false);

  // Puddles on the asphalt catch the sky.
  const puddleMat = new THREE.MeshLambertMaterial({ color: 0x39506b, transparent: true, opacity: 0.14 });
  for (let i = 0; i < 26; i += 1) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(randRange(rng, 1, 2.6), 10), puddleMat);
    p.rotation.x = -Math.PI / 2;
    if (rng() < 0.6) p.position.set(pick(rng, ROADS_X) + randRange(rng, -5, 5), 0.03, randRange(rng, -290, 290));
    else p.position.set(randRange(rng, -160, 280), 0.03, pick(rng, ROADS_Z) + randRange(rng, -5, 5));
    scene.add(p);
  }

  // Beach sand west of the promenade.
  const sandTex = makeSandTexture(rng);
  sandTex.repeat.set(10, 60);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(46, spanZ + 60), new THREE.MeshLambertMaterial({ map: sandTex }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X - 20, 0.01, midZ);
  sand.receiveShadow = true;
  scene.add(sand);

  // The Palma alley yard: a worn asphalt apron where the showdown
  // stands, laid over the paving skin.
  {
    const at = PLACES.alleyShootout;
    const yardTex = asphaltTex.clone();
    yardTex.needsUpdate = true;
    yardTex.repeat.set(2, 1.4);
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(36, 22), new THREE.MeshLambertMaterial({ map: yardTex }));
    yard.rotation.x = -Math.PI / 2;
    yard.rotation.z = 0.06;
    yard.position.set(at.x + 1, 0.025, at.z + 2);
    yard.receiveShadow = true;
    scene.add(yard);
  }

  // Plaza greens.
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x5d8a4a });
  const plazaGreen = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), grassMat);
  plazaGreen.rotation.x = -Math.PI / 2;
  plazaGreen.position.set(PLACES.plaza.x, 0.03, PLACES.plaza.z);
  plazaGreen.receiveShadow = true;
  scene.add(plazaGreen);
  for (const p of data.plazas) {
    const gmesh = new THREE.Mesh(new THREE.CircleGeometry(p.r, 14), grassMat);
    gmesh.rotation.x = -Math.PI / 2;
    gmesh.position.set(p.x, 0.03, p.z);
    scene.add(gmesh);
  }

  // Buildings: six facade batches (one per painted variant) over the
  // plain batch that carries roofs, trim and balconies.
  const facadeBatches = [];
  for (let v = 0; v < 6; v += 1) {
    facadeBatches.push(new Batch(new THREE.MeshLambertMaterial({ map: makeFacadeTexture(rng, v % 2 === 0), vertexColors: true })));
  }
  for (const b of data.buildings) {
    addFacadeBox(facadeBatches[b.facade % 6], b);
    const roofTone = b.tower ? 0x9aa2a8 : (Math.round(b.cx + b.cz) % 2 === 0 ? 0xb06a48 : 0x9c8d7a);
    plain.box(b.cx, b.h + 0.14, b.cz, b.w + 0.3, 0.28, b.d + 0.3, b.roof ?? roofTone);
    plain.box(b.cx, b.h - 0.18, b.cz, b.w + 0.36, 0.16, b.d + 0.36, 0xf2ead8);
    const [nx, nz] = FACE_NORMAL[b.face] ?? [0, -1];
    for (const bal of b.balconies) {
      const fx = b.cx + nx * (Math.abs(nx) > 0 ? b.w / 2 : 0) + (nx === 0 ? bal.off : 0);
      const fz = b.cz + nz * (Math.abs(nz) > 0 ? b.d / 2 : 0) + (nz === 0 ? bal.off : 0);
      const ry = FACE_ANGLE[b.face] ?? 0;
      const m = new THREE.Matrix4().makeRotationY(ry);
      m.setPosition(fx + nx * 0.45, bal.y, fz + nz * 0.45);
      plain.add(new THREE.BoxGeometry(1.9, 0.12, 0.9), m, 0xd8cfc0);
      const m2 = new THREE.Matrix4().makeRotationY(ry);
      m2.setPosition(fx + nx * 0.85, bal.y + 0.3, fz + nz * 0.85);
      plain.add(new THREE.BoxGeometry(1.9, 0.55, 0.06), m2, 0x8a7a5c);
    }
    if (b.name === 'garage') plain.box(b.cx, 3.4, b.cz + b.d / 2 + 1.1, 16, 0.18, 2.4, 0x8a2f1d);
    if (b.name === 'clocktower') {
      plain.box(b.cx, b.h + 2, b.cz, 5, 4, 5, 0xe8d9b0);
      plain.box(b.cx, b.h + 4.4, b.cz, 5.6, 0.5, 5.6, 0xb06a48);
    }
  }
  for (const fb of facadeBatches) fb.build(scene);

  // The market colonnade — surveyed, not improvised. Columns at
  // x -187.2 marching the promenade (the garage breaks the arcade);
  // beams and their red trim ride at y 4.0 / 4.32.
  {
    const colGeo = new THREE.CylinderGeometry(0.26, 0.3, 3.8, 7);
    const cols = new THREE.InstancedMesh(colGeo, new THREE.MeshLambertMaterial({ color: 0xe8dcc4 }), 34);
    const m4 = new THREE.Matrix4();
    let ci = 0;
    for (let z = -99; z <= 99 && ci < 34; z += 6) {
      if (z > -80 && z < -48) continue;
      m4.setPosition(-187.2, 1.9, z);
      cols.setMatrixAt(ci, m4); ci += 1;
    }
    cols.count = ci;
    cols.castShadow = true;
    scene.add(cols);
    plain.box(-187.2, 4.0, -89.5, 1.4, 0.5, 21, 0xdcc7ae);
    plain.box(-187.2, 4.32, -89.5, 3.6, 0.16, 21, 0xc94f38);
    plain.box(-187.2, 4.0, 25.5, 1.4, 0.5, 147, 0xdcc7ae);
    plain.box(-187.2, 4.32, 25.5, 3.6, 0.16, 147, 0xc94f38);
  }

  // Signs: the MARINA ALTA fascia on the colonnade's west face, and a
  // gateway board at the way into every other district.
  const postMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  const signFace = (name, w, h, wide) => {
    const [bg, fg, accent] = SIGN_STYLE[name];
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: makeDistrictSignTexture(name, bg, fg, accent, wide) }));
  };
  {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.85, 11.4),
      new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    back.position.set(-188.02, 3.3, -9.8);
    back.castShadow = true;
    scene.add(back);
    const front = signFace('MARINA ALTA', 11, 1.75, true);
    front.rotation.y = -Math.PI / 2;
    front.position.set(-188.13, 3.3, -9.8);
    scene.add(front);
    const rear = signFace('MARINA ALTA', 11, 1.75, true);
    rear.rotation.y = Math.PI / 2;
    rear.position.set(-187.91, 3.3, -9.8);
    scene.add(rear);
    for (const sz of [-14.2, -5.4]) {
      const stub = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), postMat);
      stub.position.set(-187.7, 4.4, sz);
      scene.add(stub);
    }
  }
  const gateway = (name, x, z, ry) => {
    const grp = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.85, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    back.position.y = 4.6;
    grp.add(back);
    const face = signFace(name, 11, 1.75, false);
    face.position.set(0, 4.6, -0.11);
    face.rotation.y = Math.PI;
    grp.add(face);
    const face2 = signFace(name, 11, 1.75, false);
    face2.position.set(0, 4.6, 0.11);
    grp.add(face2);
    for (const s of [-5.2, 5.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.6, 0.18), postMat);
      post.position.set(s, 2.3, 0);
      grp.add(post);
    }
    grp.position.set(x, 0, z);
    grp.rotation.y = ry;
    scene.add(grp);
  };
  gateway('LAS PALMAS', -70, -103, 0);
  gateway('CENTRO ALBA', 83, -43, Math.PI / 2);
  gateway('VIEJO PUERTO', 143, 60, Math.PI / 2);
  gateway('EL FARO', -196, -76, Math.PI / 2);
  gateway('PLAYA BRAVA', -196, 76, Math.PI / 2);

  // Market stalls and benches dress the promenade and the plaza.
  for (const s of data.stalls) {
    plain.box(s.x, 1.0, s.z, 2.6, 2.0, 2.2, 0xcbb79a);
    plain.box(s.x, 2.25, s.z, 3.2, 0.14, 2.8, s.color);
    for (const px of [-1.2, 1.2]) for (const pz of [-1.0, 1.0]) {
      plain.box(s.x + px, 1.05, s.z + pz, 0.12, 2.1, 0.12, 0x6e5136);
    }
  }
  for (const bn of data.benches) {
    const seat = new THREE.Matrix4().makeRotationY(bn.heading);
    seat.setPosition(bn.x, 0.48, bn.z);
    plain.add(new THREE.BoxGeometry(2.0, 0.09, 0.55), seat, 0x8a6a44);
    const backM = new THREE.Matrix4().makeRotationY(bn.heading);
    backM.setPosition(bn.x - Math.sin(bn.heading) * 0.26, 0.75, bn.z - Math.cos(bn.heading) * 0.26);
    plain.add(new THREE.BoxGeometry(2.0, 0.5, 0.08), backM, 0x8a6a44);
  }

  // The lighthouse at El Faro: a banded tower on the point.
  {
    const lh = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 13, 10),
      new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
    tower.position.y = 6.5; tower.castShadow = true;
    lh.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.0, 2.6, 10),
      new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
    band.position.y = 8.6;
    lh.add(band);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    lamp.position.y = 13.8;
    lh.add(lamp);
    lh.position.set(PLACES.lighthouse.x, 0, PLACES.lighthouse.z);
    scene.add(lh);
  }

  plain.build(scene);

  // Marina boats at their berths — world.js bobs them on the swell.
  const boats = [];
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f0e8 });
  const mastMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5c });
  for (let i = 0; i < 9; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 6.4), hullMat);
    hull.position.y = 0.35;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 2.0),
      new THREE.MeshLambertMaterial({ color: pick(rng, PASTEL_TINTS) }));
    cabin.position.set(0, 1.1, -0.6);
    boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.4, 5), mastMat);
    mast.position.set(0, 3.2, 0.9);
    boat.add(mast);
    boat.position.set(-254 - (i % 3) * 7.5, 0, 194 + i * 12.5);
    boat.rotation.y = (rng() - 0.5) * 0.14;
    scene.add(boat);
    boats.push(boat);
    const dock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 9),
      new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
    dock.position.set(boat.position.x + 3.4, 0.32, boat.position.z);
    scene.add(dock);
  }

  // The Playa Brava ferris wheel — world.js turns it.
  const ferris = new THREE.Group();
  {
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xe8e3d5 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.22, 6, 28), rimMat);
    ferris.add(rim);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 7.5, 0.14), rimMat);
      spoke.position.set(Math.cos(a) * 3.75, Math.sin(a) * 3.75, 0);
      spoke.rotation.z = a - Math.PI / 2;
      ferris.add(spoke);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshLambertMaterial({ color: pick(rng, AWNING_COLORS) }));
      cab.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0);
      ferris.add(cab);
    }
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.4, 0.4), postMat);
    legs.position.set(-2.6, -4.4, 0); legs.rotation.z = 0.28;
    ferris.add(legs);
    const legs2 = legs.clone();
    legs2.position.x = 2.6; legs2.rotation.z = -0.28;
    ferris.add(legs2);
    ferris.position.set(-200, 9.2, 168);
    scene.add(ferris);
  }

  return { boats, ferris };
}
