// city.js — Puerto Alba's layout and its built form. The layout is pure data
// (road lines, building boxes, districts, named places) generated once from
// a fixed seed, so traffic, pedestrians, the minimap and the missions all
// read the same map the player sees. Round eight builds nothing new:
// the boulevard FALCON-1 now overflies in full and the Viejo Puerto
// corner where a sixth officer takes his post are this same fixed
// city, read by the staging exactly as the player reads it. Blocks are filled with rows of
// small-lot buildings, every facade wears a painted window texture (lit
// windows, shutters, AC boxes, storefronts), shops carry their names on an
// atlas of signs, and roofs, balconies, awnings and street props are merged
// or instanced so the city can be dense without drowning the renderer. The
// Mercado del Puerto lines the promenade, and a Ferris wheel turns over
// Playa Brava.
//
// Round three paves the city: no large flat ground plane survives. The
// asphalt is a painted canvas — aggregate speckle, patched cracks, tar
// seams — the plazas and promenade are slab grids with grout and stains,
// the beach ripples, and a clutter layer of paper, leaves, stones, painted
// kerbs, tactile paving, drain grates and dusk puddles sits over it all.
// The pastel palette deepens a step toward the grade in world.js.
//
// Round four names the quarters in the world itself: a MARINA ALTA fascia
// board over the market colonnade and a gateway sign at the way into every
// other district, painted in the sign atlas's manner — district colours,
// cream letters big enough to read from the street.

// Round seven photographs the Callejón de las Redes shootout across
// this file's fixed geometry: the deep crate stack stands on the
// second-line officer's first sightline, and his re-spread in shots.js
// is measured against the streets and props laid out here.
import { makeRng, randRange, pick } from './util.js';

export const ROAD_WIDTH = 14;
export const BOULEVARD_X = -212;
export const ROADS_X = [-160, -100, -40, 20, 80, 140, 200, 260];
export const ROADS_Z = [-280, -220, -160, -100, -40, 20, 80, 140, 200, 260];
export const CITY_BOUNDS = { minX: -252, maxX: 292, minZ: -308, maxZ: 308 };
export const BEACH_X = -228; // west of this line: sand, then sea

export const DISTRICTS = [
  { name: 'El Faro', minX: -252, maxX: -214, minZ: -308, maxZ: -208 },
  { name: 'Playa Brava', minX: -252, maxX: -214, minZ: -208, maxZ: 308 },
  { name: 'Marina Alta', minX: -214, maxX: -128, minZ: -130, maxZ: 70 },
  { name: 'Las Palmas', minX: -214, maxX: 92, minZ: -308, maxZ: -130 },
  { name: 'Centro Alba', minX: 92, maxX: 292, minZ: -130, maxZ: 120 },
  { name: 'Viejo Puerto', minX: -128, maxX: 292, minZ: 70, maxZ: 308 },
];

// Named places the story and systems point at.
export const PLACES = {
  playerStart: { x: -196, z: -18 },
  garage: { x: -186, z: -64, name: "Dario's Garage" },
  garagePad: { x: -196, z: -64 },
  marisolCorner: { x: -196, z: -14, name: 'Marina Alta corner' },
  marinaDock: { x: -238, z: 232, name: 'Marina del Sur docks' },
  marinaGate: { x: -200, z: 232 },
  lighthouse: { x: -238, z: -282, name: 'El Faro lighthouse' },
  plaza: { x: 50, z: 50, name: 'Plaza del Reloj' },
  clockTower: { x: 56, z: 44 },
  hospital: { x: 110, z: -70, name: 'Hospital Santa Alba' },
  policeStation: { x: -70, z: 150, name: 'PAPD Viejo Puerto station' },
  raceStart: { x: -206, z: 120, name: 'Boulevard south lights' },
  alleyShootout: { x: -58, z: 196, name: 'Callejón de las Redes' },
  warehouse: { x: 236, z: 236, name: 'Almacén 9 warehouse' },
  beachBar: { x: -222, z: -140, name: 'Bar La Ola' },
  chopShop: { x: 248, z: -196, name: 'Tito’s yard' },
};

const PASTEL_TINTS = [0xf6e3b4, 0xf2c184, 0xef9f7d, 0xe8dfc8, 0xbfe0d0, 0xf5a8c0, 0xa9cdea, 0xf7dd7e, 0xdcb98d, 0x93c9a4, 0xe89a5f, 0xfdf6ec];
const TOWER_TINTS = [0xd8e2e8, 0xb9c9d6, 0xe6d3ae, 0xaec6d8, 0xd8bf9e, 0xc3d2da];
const SHOP_NAMES = [
  'Café Ola', 'Panadería Sol', 'Hotel Miramar', 'Farmacia Puerto', 'Joyas del Mar',
  'Tabacos El Faro', 'Heladería Brisa', 'Banco del Puerto', 'Librería Marea',
  'Pescadería Azul', 'Ropa Brisa', 'Cervecería Faro', 'Floristería Alba',
  'Óptica Sol', 'Carnicería Puerto', 'Zapatería Ola', 'Vinos del Muelle',
  'Viajes Mar', 'Dulces Alba', 'Peluquería Nilo', 'Juguetes Brisa', 'Foto Puerto',
];
const AWNING_COLORS = [0xc94f38, 0x2f7f8f, 0xe8a33c, 0x3f7d4e, 0x7a4a8f, 0xd84f78];

/**
 * Generate the city layout: buildings with facade and roof records, the
 * market stalls, benches, props, parking spots and a coarse collider grid
 * so the per-frame collision checks only visit nearby boxes.
 */
export function buildCityData(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const colliders = [];
  const parkingSpots = [];
  const plazas = [];
  const benches = [];
  const stalls = [];
  const props = [];
  let shopSeq = 0;

  const addBuilding = (cx, cz, w, d, h, color, kind, face = 'S', extra = {}) => {
    const b = {
      minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2,
      h, color, kind, cx, cz, w, d, face,
      facade: Math.floor(rng() * 6),
      balconies: [], roofProps: [],
      ...extra,
    };
    if (kind === 'shop' && extra.sign !== false && shopSeq < SHOP_NAMES.length * 3) {
      b.signName = SHOP_NAMES[shopSeq % SHOP_NAMES.length];
      b.awningColor = AWNING_COLORS[Math.floor(rng() * AWNING_COLORS.length)];
      shopSeq += 1;
    }
    // Balconies on the street face of taller houses, roofs with clutter.
    if ((kind === 'house' || kind === 'office') && h > 7.5) {
      for (let y = 3.6; y < h - 1.4; y += 3.1) {
        const n = rng() < 0.55 ? 1 : 2;
        for (let i = 0; i < n; i += 1) {
          const off = (rng() - 0.5) * (Math.min(w, d) - 3.4);
          b.balconies.push({ y, off });
        }
      }
    }
    if (kind !== 'tower' && rng() < 0.55) b.roofProps.push({ kind: 'ac', dx: randRange(rng, -w / 4, w / 4), dz: randRange(rng, -d / 4, d / 4) });
    if (kind !== 'tower' && rng() < 0.16) b.roofProps.push({ kind: 'tank', dx: randRange(rng, -w / 5, w / 5), dz: randRange(rng, -d / 5, d / 5) });
    if (rng() < 0.3) b.roofProps.push({ kind: 'antenna', dx: randRange(rng, -w / 4, w / 4), dz: randRange(rng, -d / 4, d / 4) });
    buildings.push(b);
    colliders.push(b);
    return b;
  };

  // One edge of a block, filled with small-lot buildings facing the street.
  const placeRow = (minX, maxX, minZ, maxZ, edge, zone) => {
    const depth = zone === 'shop' ? 10.5 : 12;
    let cursor = edge === 'S' || edge === 'N' ? minX : minZ;
    const end = edge === 'S' || edge === 'N' ? maxX : maxZ;
    while (cursor < end - 8) {
      const lot = randRange(rng, 10, 16.5);
      if (cursor + lot > end) break;
      if (rng() < 0.1) { cursor += randRange(rng, 2.5, 4); continue; } // an alley gap
      const c = cursor + lot / 2;
      const isShop = zone === 'shop' || (zone === 'mixed' && rng() < 0.4);
      const kind = isShop ? 'shop' : zone === 'office' ? 'office' : 'house';
      const h = isShop ? randRange(rng, 5.5, 8.5)
        : zone === 'office' ? randRange(rng, 12, 22) : randRange(rng, 7.5, 16);
      const tint = pick(rng, PASTEL_TINTS);
      if (edge === 'S') addBuilding(c, minZ + depth / 2, lot - 1.1, depth, h, tint, kind, 'S');
      else if (edge === 'N') addBuilding(c, maxZ - depth / 2, lot - 1.1, depth, h, tint, kind, 'N');
      else if (edge === 'W') addBuilding(minX + depth / 2, c, depth, lot - 1.1, h, tint, kind, 'W');
      else addBuilding(maxX - depth / 2, c, depth, lot - 1.1, h, tint, kind, 'E');
      cursor += lot;
    }
  };

  const xEdges = [BOULEVARD_X + 16, ...ROADS_X, 292];
  const zEdges = [-308, ...ROADS_Z, 308];
  for (let xi = 0; xi < xEdges.length - 1; xi += 1) {
    for (let zi = 0; zi < zEdges.length - 1; zi += 1) {
      const minX = xEdges[xi] + ROAD_WIDTH / 2 + 3, maxX = xEdges[xi + 1] - ROAD_WIDTH / 2 - 3;
      const minZ = zEdges[zi] + ROAD_WIDTH / 2 + 3, maxZ = zEdges[zi + 1] - ROAD_WIDTH / 2 - 3;
      const w = maxX - minX, d = maxZ - minZ;
      if (w < 14 || d < 14) continue;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const downtown = cx > 92 && cz > -130 && cz < 120;
      const marinaRow = xi === 0 && cz > -130 && cz < 70;
      const roll = rng();
      if (downtown && roll < 0.5) {
        // Tower on a podium: the podium fills the block, the tower climbs.
        addBuilding(cx, cz, w - 3, d - 3, randRange(rng, 6, 9), pick(rng, TOWER_TINTS), 'podium', 'S', { sign: false });
        addBuilding(cx + randRange(rng, -5, 5), cz + randRange(rng, -5, 5),
          randRange(rng, 15, 21), randRange(rng, 15, 21), randRange(rng, 36, 82),
          pick(rng, TOWER_TINTS), 'tower', 'S', { sign: false });
      } else if (downtown && roll < 0.62) {
        addBuilding(minX + w * 0.26, cz, w * 0.4, d - 6, randRange(rng, 30, 55), pick(rng, TOWER_TINTS), 'tower', 'S', { sign: false });
        addBuilding(minX + w * 0.74, cz, w * 0.4, d - 6, randRange(rng, 24, 44), pick(rng, TOWER_TINTS), 'tower', 'S', { sign: false });
      } else if (roll < 0.13) {
        // Parking lot: slab, a small kiosk sometimes, rows of parked cars.
        plazas.push({ minX, maxX, minZ, maxZ, parking: true });
        if (rng() < 0.5) addBuilding(maxX - 6, maxZ - 5, 9, 7, 4.5, pick(rng, PASTEL_TINTS), 'shop', 'N');
        const n = 5 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i += 1) {
          parkingSpots.push({
            x: minX + 6 + (i % 4) * ((w - 12) / 3), z: minZ + 8 + Math.floor(i / 4) * 13,
            heading: rng() < 0.5 ? 0 : Math.PI,
          });
        }
      } else if (roll < 0.22) {
        // Courtyard block: sparse perimeter, a plaza heart with benches.
        plazas.push({ minX, maxX, minZ, maxZ });
        placeRow(minX, maxX, minZ, maxZ, 'S', 'mixed');
        placeRow(minX, maxX, minZ, maxZ, 'N', 'mixed');
        for (let i = 0; i < 3; i += 1) {
          benches.push({ x: cx + randRange(rng, -w / 4, w / 4), z: cz + randRange(rng, -d / 4, d / 4), heading: rng() * Math.PI * 2 });
        }
        props.push({ kind: 'planter', x: cx - 6, z: cz, heading: 0 });
        props.push({ kind: 'planter', x: cx + 6, z: cz, heading: 0 });
      } else if (marinaRow) {
        // The market row: shopfronts face west onto the promenade, with
        // corner shops on the avenues when the block is deep enough.
        placeRow(minX, maxX, minZ, maxZ, 'W', 'shop');
        if (d >= 30) { placeRow(minX, maxX, minZ, maxZ, 'S', 'shop'); placeRow(minX, maxX, minZ, maxZ, 'N', 'shop'); }
      } else {
        const zone = downtown ? 'office' : 'mixed';
        if (w >= 26) { placeRow(minX, maxX, minZ, maxZ, 'W', zone); placeRow(minX, maxX, minZ, maxZ, 'E', zone); }
        if (d >= 26) { placeRow(minX, maxX, minZ, maxZ, 'S', zone); placeRow(minX, maxX, minZ, maxZ, 'N', zone); }
        if (w < 26 && d < 26) {
          addBuilding(cx, cz, w - 4, d - 4, randRange(rng, 8, 15), pick(rng, PASTEL_TINTS), 'house', 'S');
        }
      }
      // A dumpster in the block's lee, more often than not.
      if (rng() < 0.6) {
        const dp = { kind: 'dumpster', x: minX + 3.5, z: minZ + 3.5, heading: rng() * 0.6 };
        props.push(dp);
        colliders.push({ minX: dp.x - 1.4, maxX: dp.x + 1.4, minZ: dp.z - 0.9, maxZ: dp.z + 0.9 });
      }
    }
  }

  // The garage is a landmark, placed by hand in Marina Alta.
  const garage = addBuilding(PLACES.garage.x, PLACES.garage.z, 26, 20, 9, 0xe8b48c, 'garage', 'W');
  garage.signName = "DARIO'S GARAGE";
  garage.awningColor = 0x8a2f1d;
  addBuilding(PLACES.hospital.x, PLACES.hospital.z, 30, 22, 16, 0xf2f4f4, 'hospital', 'S')
    .signName = 'HOSPITAL SANTA ALBA';
  // The PLACES point is the station's front door on the kerb; the
  // building itself stands 10 m inside its block — centred on the door
  // point, its 20 m depth would straddle the avenue (its face reached
  // the road's centre line, and traffic drove through its front wall).
  addBuilding(PLACES.policeStation.x, PLACES.policeStation.z + 10, 28, 20, 13, 0xb9cbd8, 'station', 'S')
    .signName = 'PAPD · VIEJO PUERTO';
  addBuilding(PLACES.clockTower.x, PLACES.clockTower.z, 8, 8, 34, 0xe8d9b0, 'tower', 'S', { sign: false });
  // The warehouse the second job runs from.
  addBuilding(236, 224, 34, 24, 11, 0xcbb79a, 'podium', 'W', { sign: false }).signName = 'ALMACÉN 9';

  // --- the Mercado del Puerto: stalls down the promenade ------------------
  const stallColors = [0xd84f35, 0x2f8fae, 0xf2b13c, 0x3fae6a, 0xe86ab0];
  for (let z = -68; z <= 68; z += 11.3) {
    const side = (Math.round((z + 68) / 11.3) % 2 === 0) ? -1 : 1;
    const sx = -191 + side * 2.6 + randRange(rng, -0.5, 0.5);
    const sz = z + randRange(rng, -1.2, 1.2);
    if (sz > -78 && sz < -50) continue; // Dario's garage fronts this stretch
    stalls.push({ x: sx, z: sz, heading: side < 0 ? Math.PI / 2 : -Math.PI / 2, color: pick(rng, stallColors) });
    colliders.push({ minX: sx - 1.5, maxX: sx + 1.5, minZ: sz - 1, maxZ: sz + 1 });
  }
  // Benches face the sea along the promenade; café tables cluster by the plaza.
  for (let z = -104; z <= 108; z += 21) {
    if (z > -78 && z < -50) continue; // the garage frontage stays clear
    benches.push({ x: -200.3, z, heading: -Math.PI / 2 });
  }
  for (let i = 0; i < 6; i += 1) {
    props.push({ kind: 'table', x: 34 + rng() * 30, z: 34 + rng() * 30, heading: rng() * 3 });
  }
  for (let i = 0; i < 5; i += 1) {
    props.push({ kind: 'table', x: -196 + rng() * 5, z: -96 + rng() * 16, heading: rng() * 3 });
  }
  // Planters marching down both boulevard sidewalks.
  for (let z = -296; z < 300; z += 29) {
    if (rng() < 0.65) props.push({ kind: 'planter', x: BOULEVARD_X - 9.6, z, heading: 0 });
    if (rng() < 0.65) props.push({ kind: 'planter', x: BOULEVARD_X + 9.6, z: z + 13, heading: 0 });
  }
  // Bus stops and phone booths where people actually wait.
  for (const [x, z] of [[-202, -96], [-202, 88], [-50, -170], [70, 30], [150, -230], [-110, 190]]) {
    props.push({ kind: 'busstop', x, z, heading: rng() < 0.5 ? 0 : Math.PI });
  }
  for (const [x, z] of [[-188, -120], [44, 62], [-196, 210], [120, -60]]) {
    props.push({ kind: 'booth', x, z, heading: rng() * 3 });
    colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7 });
  }

  // Street parking along the boulevard and the avenues — most kerbs
  // filled. The boulevard spots keep their promenade offset (no building
  // stands within reach of them), but the avenue spots move in from
  // 10.6 m to the kerb lane at 8.45 m: at 10.6 a parked car's flank
  // crossed the building line at 10 m and sat inside the shopfronts —
  // the glitch-fix pass parks them on the road's edge instead, clear of
  // every facade and of the traffic lanes at ±3.5 m.
  for (let z = -292; z < 300; z += 24) {
    if (rng() < 0.66) parkingSpots.push({ x: BOULEVARD_X - 10.6, z, heading: 0 });
    if (rng() < 0.66) parkingSpots.push({ x: BOULEVARD_X + 10.6, z: z + 11, heading: Math.PI });
    if (rng() < 0.48) parkingSpots.push({ x: -40 - 8.45, z: z + 5, heading: 0 });
    if (rng() < 0.48) parkingSpots.push({ x: 80 + 8.45, z: z + 17, heading: Math.PI });
    if (rng() < 0.4) parkingSpots.push({ x: 140 - 8.45, z: z + 8, heading: 0 });
    if (rng() < 0.4) parkingSpots.push({ x: -100 + 8.45, z: z + 15, heading: Math.PI });
  }

  // Final pass, from the glitch-fix round: no parked car may touch a
  // building. The kerb-lane offsets keep street spots clear by
  // construction, but a hand-placed landmark can still land on a lot
  // spot the block loop dealt earlier (the clock tower did exactly
  // that). An offending spot shifts sideways in small steps until its
  // worst-case footprint — a Mulo truck, the biggest car a spot can
  // hold — clears every building and every spot already settled; a
  // spot with no clear shift in reach is dropped. Pure data: no rng
  // draws, so the rest of the city generates exactly as before.
  const settledSpots = [];
  for (let i = parkingSpots.length - 1; i >= 0; i -= 1) {
    const s = parkingSpots[i];
    const spotClear = (x, z) => {
      const minX = x - 1.15, maxX = x + 1.15, minZ = z - 2.95, maxZ = z + 2.95;
      for (const b of buildings) if (minX < b.maxX && maxX > b.minX && minZ < b.maxZ && maxZ > b.minZ) return false;
      for (const o of settledSpots) if (Math.abs(o.x - x) < 2.3 && Math.abs(o.z - z) < 5.9) return false;
      return true;
    };
    if (spotClear(s.x, s.z)) { settledSpots.push(s); continue; }
    let moved = null;
    outer: for (const dx of [-4, 4, -8, 8, -12, 12]) {
      for (const dz of [0, -4, 4, -8, 8]) {
        if (spotClear(s.x + dx, s.z + dz)) { moved = { ...s, x: s.x + dx, z: s.z + dz }; break outer; }
      }
    }
    if (moved) { parkingSpots[i] = moved; settledSpots.push(moved); }
    else parkingSpots.splice(i, 1);
  }

  // A coarse grid over the colliders: cell 32 m, so a collision query only
  // ever touches the boxes in the caller's own and neighbouring cells.
  const grid = new Map();
  const cellKey = (x, z) => `${Math.floor(x / 32)},${Math.floor(z / 32)}`;
  for (const b of colliders) {
    const x0 = Math.floor(b.minX / 32), x1 = Math.floor(b.maxX / 32);
    const z0 = Math.floor(b.minZ / 32), z1 = Math.floor(b.maxZ / 32);
    for (let gx = x0; gx <= x1; gx += 1) for (let gz = z0; gz <= z1; gz += 1) {
      const k = `${gx},${gz}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(b);
    }
  }

  return {
    buildings, colliders, parkingSpots, plazas, benches, stalls, props, garage,
    colliderGrid: grid,
    ferris: { x: -247, z: -148 },
    pier: { z: 118, fromX: -250, toX: -298 },
  };
}

/** Add a collider after the grid exists (landmarks, crates): list + index. */
export function addCollider(data, box) {
  data.colliders.push(box);
  const x0 = Math.floor(box.minX / 32), x1 = Math.floor(box.maxX / 32);
  const z0 = Math.floor(box.minZ / 32), z1 = Math.floor(box.maxZ / 32);
  for (let gx = x0; gx <= x1; gx += 1) for (let gz = z0; gz <= z1; gz += 1) {
    const k = `${gx},${gz}`;
    if (!data.colliderGrid.has(k)) data.colliderGrid.set(k, []);
    data.colliderGrid.get(k).push(box);
  }
}

/** Colliders in the cells around a point — the only ones worth testing. */
export function collidersNear(data, x, z) {
  const out = [];
  const gx = Math.floor(x / 32), gz = Math.floor(z / 32);
  for (let ix = gx - 1; ix <= gx + 1; ix += 1) {
    for (let iz = gz - 1; iz <= gz + 1; iz += 1) {
      const cell = data.colliderGrid.get(`${ix},${iz}`);
      if (cell) for (const b of cell) if (!out.includes(b)) out.push(b);
    }
  }
  return out;
}

/** Which named district a point falls in (first match wins). */
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d.name;
  return 'Puerto Alba';
}

/** True when a point is on a road surface (either axis, or the boulevard). */
export function isOnRoad(x, z) {
  if (Math.abs(x - BOULEVARD_X) <= ROAD_WIDTH / 2 + 1) return true;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2 + 1) return true;
  for (const rz of ROADS_Z) if (Math.abs(z - rz) <= ROAD_WIDTH / 2 + 1) return true;
  return false;
}

/** All intersection points of the road grid, boulevard crossings included. */
export function intersections() {
  const pts = [];
  for (const rz of ROADS_Z) pts.push({ x: BOULEVARD_X, z: rz });
  for (const rx of ROADS_X) for (const rz of ROADS_Z) pts.push({ x: rx, z: rz });
  return pts;
}

/**
 * Where the streetlights stand. The pattern is the one the city was
 * born with — staggered pairs down the boulevard, a lamp every block
 * along the avenues and cross streets, always 8.6 m off the road's
 * centre line, on the kerb — with one correction from the glitch-fix
 * pass: a lamp whose kerb spot falls on a CROSSING road (every lamp
 * dealt onto an intersection was standing in the middle of the cross
 * street) slides along its own street to the far kerb of the crossing,
 * the corner where a real lamp would stand. No spot this returns is on
 * a road cell; world.js plants the poles exactly here.
 */
export function streetlightSpots() {
  const raw = [];
  for (let z = -300; z < 310; z += 40) { raw.push({ x: BOULEVARD_X - 8.6, z, along: 'z' }); raw.push({ x: BOULEVARD_X + 8.6, z: z + 20, along: 'z' }); }
  for (const rx of ROADS_X) for (let z = -280; z < 300; z += 80) raw.push({ x: rx + 8.6, z, along: 'z' });
  for (const rz of ROADS_Z) for (let x = -140; x < 290; x += 80) raw.push({ x, z: rz - 8.6, along: 'x' });
  const CLEAR = ROAD_WIDTH / 2 + 2.4; // past the crossing road's far kerb
  const out = [];
  const seen = new Set();
  for (const s of raw) {
    let { x, z } = s;
    if (isOnRoad(x, z)) {
      if (s.along === 'z') {
        const rz = ROADS_Z.reduce((best, c) => (Math.abs(c - z) < Math.abs(best - z) ? c : best), ROADS_Z[0]);
        z = rz + (z >= rz ? CLEAR : -CLEAR);
      } else {
        const roads = [BOULEVARD_X, ...ROADS_X];
        const rx = roads.reduce((best, c) => (Math.abs(c - x) < Math.abs(best - x) ? c : best), roads[0]);
        x = rx + (x >= rx ? CLEAR : -CLEAR);
      }
    }
    const key = `${x.toFixed(1)},${z.toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([x, z]);
  }
  return out;
}

/** A random point on a random road lane, for traffic and police spawns. */
export function randomRoadPoint(rng) {
  const vertical = rng() < 0.55;
  if (vertical) {
    const roads = [BOULEVARD_X, ...ROADS_X];
    const rx = roads[Math.floor(rng() * roads.length)];
    const dir = rng() < 0.5 ? 1 : -1;
    return { x: rx + (dir > 0 ? -3.5 : 3.5), z: -300 + rng() * 600, heading: dir > 0 ? 0 : Math.PI, axis: 'z', line: rx, dir };
  }
  const rz = ROADS_Z[Math.floor(rng() * ROADS_Z.length)];
  const dir = rng() < 0.5 ? 1 : -1;
  return { x: -200 + rng() * 480, z: rz + (dir > 0 ? 3.5 : -3.5), heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'x', line: rz, dir };
}

// ============================================================ mesh building

/**
 * A batch of boxes merged into one geometry, with per-box colour and
 * per-face UV scaling (so facade windows stay window-sized at any building
 * size). The whole static city lands in a dozen of these.
 */
class GeoBatch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  addBox(w, h, d, x, y, z, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uvA = geo.attributes.uv;
    const mode = opts.uvMode ?? 'facade';
    const ws = opts.winScale ?? 12;
    for (let i = 0; i < uvA.count; i += 1) {
      const face = Math.floor(i / 4);
      const u = uvA.getX(i), v = uvA.getY(i);
      if (mode === 'facade') {
        let su = w / ws, sv = h / ws;
        if (face <= 1) su = d / ws;
        else if (face <= 3) { su = w / ws; sv = d / ws; }
        uvA.setXY(i, u * su + (opts.uOff ?? 0), v * sv + (opts.vOff ?? 0));
      } else if (mode === 'cell' && opts.cell) {
        const [cx, cy, cw, ch] = opts.cell;
        uvA.setXY(i, cx + u * cw, cy + v * ch);
      }
    }
    let m;
    if (opts.matrix) m = opts.matrix.clone();
    else {
      m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0));
      m.setPosition(x, y, z);
    }
    geo.applyMatrix4(m);
    const p = geo.attributes.position, nrm = geo.attributes.normal;
    const c = new THREE.Color(opts.color ?? 0xffffff);
    for (let i = 0; i < p.count; i += 1) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      this.uv.push(uvA.getX(i), uvA.getY(i));
      this.col.push(c.r, c.g, c.b);
    }
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 1) this.idx.push(idx[i] + this.n);
    this.n += p.count;
    geo.dispose();
  }
  build(material, shadows = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

/** A painted low-rise facade: window grid, shutters, AC boxes, storefront. */
function makeFacadeTexture(rng, shopFront) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f1e5'; g.fillRect(0, 0, 256, 256);
  // Weathering: soft blotches so no two walls read as flat colour.
  for (let i = 0; i < 7; i += 1) {
    g.fillStyle = `rgba(120,100,70,${0.03 + rng() * 0.05})`;
    g.fillRect(rng() * 200, rng() * 200, 30 + rng() * 60, 20 + rng() * 50);
  }
  const floors = 4;
  for (let f = 0; f < floors; f += 1) {
    const yTop = f * 64; // canvas top = building top (texture flipY)
    const isGround = f === floors - 1;
    if (isGround && shopFront) {
      // Storefront: glass panes and a door under the sign band.
      g.fillStyle = '#8a97a3'; g.fillRect(0, yTop, 256, 14);
      for (let x = 10; x < 240; x += 58) {
        g.fillStyle = '#33505e'; g.fillRect(x, yTop + 20, 48, 40);
        g.fillStyle = 'rgba(180,225,245,0.5)'; g.fillRect(x + 4, yTop + 24, 18, 32);
      }
      g.fillStyle = '#5a4632'; g.fillRect(118, yTop + 20, 24, 44);
      continue;
    }
    if (isGround) {
      g.fillStyle = '#6e5136'; g.fillRect(112, yTop + 16, 30, 48); // a house door
    }
    for (let x = 14; x < 236; x += 55) {
      if (isGround && x > 96 && x < 160) continue; // the door takes this slot
      const lit = rng() < 0.4;
      g.fillStyle = '#46525e'; g.fillRect(x, yTop + 14, 30, 38);
      g.fillStyle = lit ? '#ffca7a' : '#2e3d4a';
      g.fillRect(x + 3, yTop + 17, 24, 32);
      if (lit) { g.fillStyle = 'rgba(255,240,200,0.55)'; g.fillRect(x + 3, yTop + 17, 24, 10); }
      if (rng() < 0.35) { // shutters in faded green or blue
        g.fillStyle = rng() < 0.5 ? '#7d9b84' : '#7d8fa8';
        g.fillRect(x - 9, yTop + 14, 7, 38); g.fillRect(x + 32, yTop + 14, 7, 38);
      }
      if (rng() < 0.3) { // an AC box humming under the window
        g.fillStyle = '#b9bec2'; g.fillRect(x + 4, yTop + 54, 20, 9);
        g.fillStyle = '#7e858c'; g.fillRect(x + 6, yTop + 56, 16, 2); g.fillRect(x + 6, yTop + 59, 16, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** A tower facade: a tighter, taller grid with lit office bands. */
function makeTowerTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#dfe3e6'; g.fillRect(0, 0, 256, 256);
  for (let y = 6; y < 248; y += 20) {
    const bandLit = rng() < 0.3;
    for (let x = 8; x < 244; x += 24) {
      const lit = bandLit || rng() < 0.3;
      g.fillStyle = lit ? '#ffd98a' : '#33424f';
      g.fillRect(x, y, 17, 13);
    }
  }
  g.fillStyle = 'rgba(90,100,110,0.35)';
  for (let x = 0; x < 256; x += 48) g.fillRect(x, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------ ground paint
/** Asphalt: aggregate speckle, tar seams, patched cracks, oil stains. */
function makeAsphaltTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#35393f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i += 1) { // the aggregate
    const v = 46 + rng() * 42;
    g.fillStyle = `rgba(${v + 14},${v + 16},${v + 20},${0.16 + rng() * 0.2})`;
    g.fillRect(rng() * 256, rng() * 256, 1.6, 1.6);
  }
  for (let i = 0; i < 9; i += 1) { // patched repairs, a shade off the road
    g.fillStyle = `rgba(18,20,24,${0.05 + rng() * 0.07})`;
    g.fillRect(rng() * 200, rng() * 200, 34 + rng() * 60, 22 + rng() * 44);
  }
  g.strokeStyle = 'rgba(16,18,21,0.5)'; g.lineWidth = 1.6; // cracks wander
  for (let i = 0; i < 6; i += 1) {
    g.beginPath();
    let x = rng() * 256, y = rng() * 256;
    g.moveTo(x, y);
    for (let s = 0; s < 5; s += 1) { x += (rng() - 0.5) * 52; y += (rng() - 0.5) * 52; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 5; i += 1) { // oil stains near where cars wait
    const gr = g.createRadialGradient(0, 0, 1, 0, 0, 16 + rng() * 14);
    gr.addColorStop(0, 'rgba(10,12,16,0.20)'); gr.addColorStop(1, 'rgba(10,12,16,0)');
    g.save(); g.translate(rng() * 256, rng() * 256); g.fillStyle = gr;
    g.fillRect(-32, -32, 64, 64); g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Paving: a 4×4 slab grid with grout lines, per-slab tone and stains. */
function makePavingTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#877c68'; g.fillRect(0, 0, 256, 256); // the grout
  for (let sx = 0; sx < 4; sx += 1) for (let sy = 0; sy < 4; sy += 1) {
    const v = (rng() - 0.5) * 14;
    g.fillStyle = `rgb(${176 + v},${166 + v},${144 + v})`;
    g.fillRect(sx * 64 + 2, sy * 64 + 2, 60, 60);
    for (let i = 0; i < 26; i += 1) { // wear speckle inside the slab
      g.fillStyle = `rgba(90,80,64,${0.05 + rng() * 0.09})`;
      g.fillRect(sx * 64 + 3 + rng() * 56, sy * 64 + 3 + rng() * 56, 2, 2);
    }
  }
  for (let i = 0; i < 7; i += 1) { // stains that survive the rain
    const gr = g.createRadialGradient(0, 0, 1, 0, 0, 18 + rng() * 22);
    gr.addColorStop(0, `rgba(70,60,44,${0.10 + rng() * 0.08})`); gr.addColorStop(1, 'rgba(70,60,44,0)');
    g.save(); g.translate(rng() * 256, rng() * 256); g.fillStyle = gr;
    g.fillRect(-44, -44, 88, 88); g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Beach sand: wind ripples and shell speckle over warm grain. */
function makeSandTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e2c78f'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 9) { // ripple lines, light then shadow
    g.strokeStyle = 'rgba(255,244,205,0.20)'; g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.11 + y) * 2.2);
    g.stroke();
    g.strokeStyle = 'rgba(160,128,78,0.16)';
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + 3.4 + Math.sin(x * 0.11 + y) * 2.2);
    g.stroke();
  }
  for (let i = 0; i < 700; i += 1) {
    g.fillStyle = `rgba(${140 + rng() * 90},${110 + rng() * 70},${70 + rng() * 40},${0.10 + rng() * 0.16})`;
    g.fillRect(rng() * 256, rng() * 256, 1.6, 1.6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** The block interiors: packed dirt and scrub under the buildings. */
function makeDirtTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8271'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i += 1) { // scrub patches and worn earth
    g.fillStyle = rng() < 0.5 ? `rgba(106,124,78,${0.10 + rng() * 0.13})` : `rgba(112,94,66,${0.10 + rng() * 0.12})`;
    g.beginPath();
    g.ellipse(rng() * 256, rng() * 256, 14 + rng() * 34, 10 + rng() * 24, rng() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 1500; i += 1) {
    const v = 96 + rng() * 60;
    g.fillStyle = `rgba(${v},${v - 6},${v - 22},${0.12 + rng() * 0.16})`;
    g.fillRect(rng() * 256, rng() * 256, 1.8, 1.8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * A district name board, painted the way the shop signs are: the district's
 * own deep colour, a cream double border with a gold inner line, the
 * port's diamond markers at both ends, and the name set large — but with
 * real headroom above the glyphs. Round six insists on that padding: set
 * as large as the board allowed, the lettering's tops rode so close to
 * the board's top edge that the colonnade's orange roof trim, crossing
 * just above, ate the crossbar of the T in ALTA and left it reading as
 * an I. The glyphs now sit lower in the board with air above them, so
 * every letterform stays complete whatever runs overhead. Round four
 * puts these over the market colonnade and at the gateways between
 * districts, so a screenshot can name its own quarter.
 */
function makeDistrictSignTexture(name, bg, fg, accent, canvasW = 1024) {
  const c = document.createElement('canvas');
  c.width = canvasW; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, canvasW, 192);
  g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(0, 0, canvasW, 30); // sun-bleached top band
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(12, 12, canvasW - 24, 168);
  g.strokeStyle = accent; g.lineWidth = 2.5; g.strokeRect(26, 26, canvasW - 52, 140);
  g.fillStyle = accent;
  for (const cx of [64, canvasW - 64]) { // the port's diamonds
    g.save(); g.translate(cx, 96); g.rotate(Math.PI / 4); g.fillRect(-17, -17, 34, 34); g.restore();
  }
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // Round six: the cap is 100, not 118, and the line sits a touch below
  // centre — glyph tops land ~68 px under the canvas top instead of ~58,
  // which on the fascia board is the air that keeps the roof trim out of
  // the letterforms (see the note above).
  let size = 100;
  g.font = `900 ${size}px Arial, sans-serif`;
  while (g.measureText(name).width > canvasW - 230 && size > 40) { size -= 6; g.font = `900 ${size}px Arial, sans-serif`; }
  g.fillText(name, canvasW / 2, 104);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

const FACE_NORMAL = { S: [0, -1], N: [0, 1], W: [-1, 0], E: [1, 0] };
const FACE_ANGLE = { S: Math.PI, N: 0, W: -Math.PI / 2, E: Math.PI / 2 };

/** Turn the layout into meshes: ground, roads, buildings, market, landmarks. */
export function buildCityMeshes(scene, data, seed) {
  const rng = makeRng(seed + 7);
  const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const plain = new GeoBatch(); // roofs, trim, stalls, props — one draw call
  const boxAt = (batch, w, h, d, x, y, z, color, opts = {}) => batch.addBox(w, h, d, x, y, z, { color, uvMode: 'flat', ...opts });

  // The ground batches: one textured batch per surface family, UV-scaled
  // by the facade rule so a texture tile spans a fixed number of metres.
  const groundTexRng = makeRng(seed + 101);
  const dirtBatch = new GeoBatch();
  const sandBatch = new GeoBatch();
  const paveBatch = new GeoBatch();
  const roadBatch = new GeoBatch();
  const texBox = (batch, w, h, d, x, y, z, ws) => batch.addBox(w, h, d, x, y, z, { color: 0xffffff, uvMode: 'facade', winScale: ws });

  // Ground, sand, promenade and plaza slabs — textured, every one.
  texBox(dirtBatch, 560, 0.1, 660, 20, -0.06, 0, 18);
  texBox(sandBatch, 34, 0.12, 660, -232, -0.02, 0, 12);
  texBox(paveBatch, 19, 0.1, 640, -192.5, 0.0, 0, 9);
  for (const pz of data.plazas) {
    texBox(pz.parking ? roadBatch : paveBatch, pz.maxX - pz.minX + 4, 0.1, pz.maxZ - pz.minZ + 4,
      (pz.minX + pz.maxX) / 2, 0.0, (pz.minZ + pz.maxZ) / 2, pz.parking ? 15 : 9);
  }
  // Roads: paved sidewalk border under painted asphalt.
  const roadSet = (cx, cz, w, d) => {
    texBox(paveBatch, w + 6, 0.08, d + 6, cx, 0.0, cz, 9);
    texBox(roadBatch, w, 0.12, d, cx, 0.02, cz, 15);
  };
  roadSet(BOULEVARD_X, 0, ROAD_WIDTH, 640);
  for (const rx of ROADS_X) roadSet(rx, 0, ROAD_WIDTH, 624);
  for (const rz of ROADS_Z) roadSet(20, rz, 516, ROAD_WIDTH);
  scene.add(dirtBatch.build(new THREE.MeshLambertMaterial({ map: makeDirtTexture(groundTexRng), vertexColors: true })));
  scene.add(sandBatch.build(new THREE.MeshLambertMaterial({ map: makeSandTexture(groundTexRng), vertexColors: true })));
  scene.add(paveBatch.build(new THREE.MeshLambertMaterial({ map: makePavingTexture(groundTexRng), vertexColors: true })));
  scene.add(roadBatch.build(new THREE.MeshLambertMaterial({ map: makeAsphaltTexture(groundTexRng), vertexColors: true })));

  for (const rz of [-100, -40, 20, 80]) {
    for (let i = 0; i < 5; i += 1) {
      boxAt(plain, 0.9, 0.13, 2.4, BOULEVARD_X - 5 + i * 2.6, 0.03, rz, 0xd8d5cc);
    }
  }
  // Painted crosswalks at every grid crossing, and manhole covers dotted
  // down the avenues — the ground should read as a worked street, not a slab.
  for (const rx of ROADS_X) {
    for (const rz of ROADS_Z) {
      for (let i = 0; i < 4; i += 1) {
        boxAt(plain, 2.2, 0.13, 0.85, rx - 4.6 + i * 3.1, 0.03, rz - ROAD_WIDTH / 2 - 1.6, 0xd8d5cc);
      }
    }
  }
  {
    const holeGeo = new THREE.CircleGeometry(0.55, 10);
    holeGeo.rotateX(-Math.PI / 2);
    const holes = new THREE.InstancedMesh(holeGeo, new THREE.MeshLambertMaterial({ color: 0x24262a }), 60);
    const m4 = new THREE.Matrix4();
    let hi = 0;
    for (const rx of [BOULEVARD_X, ...ROADS_X]) {
      for (let z = -270; z < 290 && hi < 60; z += 46) {
        m4.setPosition(rx + ((hi % 3) - 1) * 2.2, 0.095, z + (hi % 5) * 3);
        holes.setMatrixAt(hi, m4); hi += 1;
      }
    }
    holes.count = hi;
    scene.add(holes);
  }

  // --- the clutter layer: a lived-in street sheds paper and leaves -------
  {
    const crng = makeRng(seed + 55);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color();
    // Fallen paper, flyers and leaves on sidewalks, plazas and promenade.
    const litterTones = [0xf2ead8, 0xd8cfc0, 0xe8e2d2, 0x7a8a3a, 0xa86a2e, 0xe86ab0, 0x57d7e8, 0xc9b896];
    const litter = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.46, 0.32),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 260);
    const litterSpots = [];
    for (let i = 0; i < 150; i += 1) { // along the streets, past the kerb
      const vertical = crng() < 0.6;
      if (vertical) {
        const roads = [BOULEVARD_X, ...ROADS_X];
        litterSpots.push({ x: roads[Math.floor(crng() * roads.length)] + (crng() < 0.5 ? -1 : 1) * (8.2 + crng() * 2.6), z: -300 + crng() * 600 });
      } else {
        litterSpots.push({ x: -210 + crng() * 480, z: ROADS_Z[Math.floor(crng() * ROADS_Z.length)] + (crng() < 0.5 ? -1 : 1) * (8.2 + crng() * 2.6) });
      }
    }
    for (let i = 0; i < 60; i += 1) litterSpots.push({ x: -206 + crng() * 26, z: -120 + crng() * 240 }); // promenade drift
    for (let i = 0; i < 50; i += 1) litterSpots.push({ x: 32 + crng() * 36, z: 32 + crng() * 36 }); // plaza drift
    litterSpots.forEach((s, i) => {
      e.set(-Math.PI / 2 + (crng() - 0.5) * 0.35, 0, crng() * Math.PI);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(s.x, 0.1, s.z), q, one);
      litter.setMatrixAt(i, m4);
      litter.setColorAt(i, col.setHex(litterTones[i % litterTones.length]));
    });
    litter.count = litterSpots.length;
    scene.add(litter);
    // Small stones scattered where the sand meets the promenade.
    const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.12, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x9a958a }), 46);
    for (let i = 0; i < 46; i += 1) {
      e.set(0, crng() * Math.PI, 0); q.setFromEuler(e);
      const s = 0.7 + crng() * 0.9;
      m4.compose(new THREE.Vector3(-226 + crng() * 16, 0.08, -290 + crng() * 580), q, new THREE.Vector3(s, s, s));
      stones.setMatrixAt(i, m4);
    }
    scene.add(stones);
    // Painted kerbs down the boulevard: white, then no-parking red.
    const kerbGeo = new THREE.BoxGeometry(0.34, 0.15, 5.6);
    const kerbSpots = [];
    for (let z = -308; z < 312; z += 6.2) { kerbSpots.push([BOULEVARD_X - 10.15, z]); kerbSpots.push([BOULEVARD_X + 10.15, z + 3.1]); }
    const kerbs = new THREE.InstancedMesh(kerbGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), kerbSpots.length);
    kerbSpots.forEach(([x, z], i) => {
      m4.identity(); m4.setPosition(x, 0.075, z);
      kerbs.setMatrixAt(i, m4);
      kerbs.setColorAt(i, col.setHex(Math.floor(i / 2) % 2 === 0 ? 0xd8d5cc : 0xc23b2e));
    });
    scene.add(kerbs);
    // Tactile paving pads where the crosswalks land.
    const tactSpots = [];
    for (const rz of ROADS_Z) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      tactSpots.push([BOULEVARD_X + sx * (ROAD_WIDTH / 2 + 1.5), rz + sz * (ROAD_WIDTH / 2 + 1.5), 0]);
    }
    for (const rx of ROADS_X) for (const rz of [-100, -40, 20, 80]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      tactSpots.push([rx + sx * (ROAD_WIDTH / 2 + 1.5), rz + sz * (ROAD_WIDTH / 2 + 1.5), sx]);
    }
    const tact = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.035, 0.8),
      new THREE.MeshLambertMaterial({ color: 0xd8b13c }), tactSpots.length);
    tactSpots.forEach(([x, z], i) => { m4.identity(); m4.setPosition(x, 0.075, z); tact.setMatrixAt(i, m4); });
    scene.add(tact);
    // Drain grates along the avenue kerbs.
    const grateSpots = [];
    for (const rx of [BOULEVARD_X, ...ROADS_X]) for (let z = -280; z < 300; z += 37) grateSpots.push([rx - 6.4, z + (rx % 5)]);
    const grates = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.03, 1.15),
      new THREE.MeshLambertMaterial({ color: 0x24262a }), grateSpots.length);
    grateSpots.forEach(([x, z], i) => { m4.identity(); m4.setPosition(x, 0.088, z); grates.setMatrixAt(i, m4); });
    scene.add(grates);
    // Puddles: still discs that catch the sky — faint by day, mirrors at
    // dusk (world.js drives the opacity through data.puddleMat).
    const puddleMat = new THREE.MeshBasicMaterial({ color: 0x39506b, transparent: true, opacity: 0.14, depthWrite: false });
    const puddleGeo = new THREE.CircleGeometry(1, 12);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddles = new THREE.InstancedMesh(puddleGeo, puddleMat, 26);
    for (let i = 0; i < 26; i += 1) {
      const onRoad = crng() < 0.6;
      const px = onRoad ? [BOULEVARD_X, ...ROADS_X][Math.floor(crng() * 9)] + (crng() - 0.5) * 9 : 30 + crng() * 40;
      const pz = onRoad ? -280 + crng() * 560 : 30 + crng() * 40;
      e.set(0, crng() * Math.PI, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(px, 0.088, pz), q, new THREE.Vector3(1.4 + crng() * 2.2, 1, 0.9 + crng() * 1.2));
      puddles.setMatrixAt(i, m4);
    }
    scene.add(puddles);
    data.puddleMat = puddleMat;
  }

  // The wet-look strip down the boulevard: a warm sheen that fades in at
  // dusk (world.js drives the opacity through G.wetStripMat).
  {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, 'rgba(255,170,90,0)');
    grad.addColorStop(0.5, 'rgba(255,190,110,0.55)');
    grad.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(11, 636), mat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(BOULEVARD_X, 0.09, 0);
    scene.add(strip);
    data.wetStripMat = mat;
  }

  // Boulevard centre dashes.
  {
    const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5d76e, emissive: 0x554411 });
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.05, 4), dashMat, 90);
    const m4 = new THREE.Matrix4();
    let di = 0;
    for (let z = -312; z < 316 && di < 90; z += 7) { m4.setPosition(BOULEVARD_X, 0.1, z); dashes.setMatrixAt(di, m4); di += 1; }
    dashes.count = di;
    scene.add(dashes);
  }

  // --- facades -------------------------------------------------------------
  const facadeTex = [];
  for (let i = 0; i < 6; i += 1) facadeTex.push(makeFacadeTexture(rng, i < 3));
  const towerTex = [makeTowerTexture(rng), makeTowerTexture(rng)];
  const facadeBatches = facadeTex.map(() => new GeoBatch());
  const towerBatches = towerTex.map(() => new GeoBatch());
  const signJobs = [];

  for (const b of data.buildings) {
    const isTower = b.kind === 'tower' || b.kind === 'hospital' || b.kind === 'station';
    const batch = isTower ? towerBatches[b.facade % 2] : facadeBatches[b.facade];
    batch.addBox(b.w, b.h, b.d, b.cx, b.h / 2, b.cz, {
      color: b.color, uvMode: 'facade', winScale: isTower ? 17 : 12, uOff: (b.facade % 3) * 0.37,
    });
    // Roof: a parapet cap in a flat tone, a stepped crown on some.
    const roofTone = b.kind === 'tower' ? 0x9aa2a8 : (b.facade % 2 ? 0xb06a48 : 0x9c8d7a);
    boxAt(plain, b.w + 0.35, 0.5, b.d + 0.35, b.cx, b.h + 0.2, b.cz, roofTone);
    if (!isTower && b.facade % 3 === 0 && b.h > 9) {
      boxAt(plain, b.w * 0.55, 1.6, b.d * 0.55, b.cx, b.h + 1.2, b.cz, roofTone);
    }
    // Cornice line under the roof on the nicer blocks.
    if (b.kind === 'office' || b.kind === 'house') {
      boxAt(plain, b.w + 0.22, 0.26, b.d + 0.22, b.cx, b.h - 0.4, b.cz, 0xf2ead8);
    }
    // Balconies on the street face.
    const [nx, nz] = FACE_NORMAL[b.face];
    for (const bal of b.balconies) {
      const fx = b.cx + nx * (Math.abs(nx) > 0 ? b.w / 2 : 0) + (nx === 0 ? bal.off : 0);
      const fz = b.cz + nz * (Math.abs(nz) > 0 ? b.d / 2 : 0) + (nz === 0 ? bal.off : 0);
      const ry = FACE_ANGLE[b.face];
      const mSlab = new THREE.Matrix4().makeRotationY(ry);
      mSlab.setPosition(fx + nx * 0.45, bal.y, fz + nz * 0.45);
      plain.addBox(1.9, 0.12, 0.9, 0, 0, 0, { matrix: mSlab, color: 0xd8cfc0, uvMode: 'flat' });
      const mRail = new THREE.Matrix4().makeRotationY(ry);
      mRail.setPosition(fx + nx * 0.85, bal.y + 0.3, fz + nz * 0.85);
      plain.addBox(1.9, 0.55, 0.06, 0, 0, 0, { matrix: mRail, color: 0x5a6672, uvMode: 'flat' });
    }
    // Awnings and signs on shopfronts.
    if (b.signName) {
      const fx = b.cx + nx * (Math.abs(nx) > 0 ? b.w / 2 : 0);
      const fz = b.cz + nz * (Math.abs(nz) > 0 ? b.d / 2 : 0);
      const ry = FACE_ANGLE[b.face];
      if (b.awningColor) {
        const mAw = new THREE.Matrix4().makeRotationY(ry)
          .multiply(new THREE.Matrix4().makeRotationX(-0.32));
        mAw.setPosition(fx + nx * 0.85, 3.15, fz + nz * 0.85);
        plain.addBox(Math.min(b.w * 0.85, 11), 0.14, 2.0, 0, 0, 0, { matrix: mAw, color: b.awningColor, uvMode: 'flat' });
      }
      signJobs.push({ b, fx, fz, nx, nz, ry });
    }
    // Rooftop clutter.
    for (const rp of b.roofProps) {
      if (rp.kind === 'ac') boxAt(plain, 1.3, 0.7, 0.95, b.cx + rp.dx, b.h + 0.8, b.cz + rp.dz, 0xb9bec2);
    }
  }
  facadeBatches.forEach((batch, i) => {
    scene.add(batch.build(new THREE.MeshLambertMaterial({ map: facadeTex[i], vertexColors: true }), true));
  });
  towerBatches.forEach((batch, i) => {
    scene.add(batch.build(new THREE.MeshLambertMaterial({ map: towerTex[i], vertexColors: true }), true));
  });

  // Shop signs: every name painted into one atlas, one merged mesh.
  if (signJobs.length) {
    const atlas = document.createElement('canvas');
    atlas.width = 1024; atlas.height = 1024;
    const g = atlas.getContext('2d');
    const signBatch = new GeoBatch();
    const signPalette = ['#c94f38', '#1f6f8f', '#e8a33c', '#2e7d4f', '#7a4a8f', '#22384f', '#d84f78', '#8a5a2b'];
    signJobs.forEach((job, i) => {
      const col = i % 4, row = Math.floor(i / 4) % 16;
      const x0 = col * 256, y0 = row * 64;
      g.fillStyle = signPalette[i % signPalette.length];
      g.fillRect(x0, y0, 256, 64);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x0, y0, 256, 8);
      g.fillStyle = '#fff8ea';
      g.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = 34;
      while (g.measureText(job.b.signName).width > 236 && size > 15) { size -= 2; g.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`; }
      g.fillText(job.b.signName.toUpperCase(), x0 + 128, y0 + 34);
      // Canvas row 0 is the TOP of the texture image; UV v runs the other
      // way, so the cell's v window is measured from the bottom.
      const cell = [col / 4, 1 - (row + 1) / 16, 1 / 4, 1 / 16];
      const wSign = Math.min(job.b.w * 0.82, 11);
      signBatch.addBox(wSign, 1.05, 0.16, job.fx + job.nx * 0.14, 3.95, job.fz + job.nz * 0.14,
        { ry: job.ry, uvMode: 'cell', cell, color: 0xffffff });
    });
    const tex = new THREE.CanvasTexture(atlas);
    tex.anisotropy = 4;
    const signMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
    scene.add(signBatch.build(signMat));
    // Blade signs: half the shops also hang a perpendicular board over the
    // pavement, the way real market streets stack their names.
    const bladeBatch = new GeoBatch();
    signJobs.forEach((job, i) => {
      if (i % 2 !== 0) return;
      const col = i % 4, row = Math.floor(i / 4) % 16;
      const cell = [col / 4, 1 - (row + 1) / 16, 1 / 4, 1 / 16];
      bladeBatch.addBox(1.5, 0.95, 0.14, job.fx + job.nx * 0.85, 3.6, job.fz + job.nz * 0.85,
        { ry: job.ry + Math.PI / 2, uvMode: 'cell', cell, color: 0xffffff });
      boxAt(plain, 0.08, 0.08, 0.9, job.fx + job.nx * 0.45, 3.95, job.fz + job.nz * 0.45, 0x3c4248, { ry: job.ry });
    });
    scene.add(bladeBatch.build(signMat));
  }

  // Rooftop water towers and antennas, instanced.
  {
    const tanks = [], ants = [];
    for (const b of data.buildings) for (const rp of b.roofProps) {
      if (rp.kind === 'tank') tanks.push([b.cx + rp.dx, b.h + 0.45, b.cz + rp.dz]);
      if (rp.kind === 'antenna') ants.push([b.cx + rp.dx, b.h + 0.45, b.cz + rp.dz]);
    }
    const m4 = new THREE.Matrix4();
    if (tanks.length) {
      const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.95, 0.95, 2.3, 8),
        new THREE.MeshLambertMaterial({ color: 0x8a6844 }), tanks.length);
      const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(1.15, 0.8, 8),
        new THREE.MeshLambertMaterial({ color: 0x6e5136 }), tanks.length);
      tanks.forEach(([x, y, z], i) => {
        m4.makeRotationY(i * 1.3); m4.setPosition(x, y + 1.5, z); body.setMatrixAt(i, m4);
        m4.setPosition(x, y + 3.05, z); roof.setMatrixAt(i, m4);
      });
      body.castShadow = true;
      scene.add(body); scene.add(roof);
    }
    if (ants.length) {
      const ant = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 4),
        new THREE.MeshLambertMaterial({ color: 0x3c4248 }), ants.length);
      ants.forEach(([x, y, z], i) => { m4.identity(); m4.setPosition(x, y + 1.7, z); ant.setMatrixAt(i, m4); });
      scene.add(ant);
    }
  }

  // The colonnade along the promenade's market row: columns and a long beam.
  {
    const colGeo = new THREE.CylinderGeometry(0.26, 0.3, 3.8, 7);
    const cols = new THREE.InstancedMesh(colGeo, new THREE.MeshLambertMaterial({ color: 0xe8dcc4 }), 34);
    const m4 = new THREE.Matrix4();
    let ci = 0;
    for (let z = -99; z <= 99 && ci < 34; z += 6) {
      if (z > -80 && z < -48) continue; // the garage breaks the arcade
      m4.setPosition(-187.2, 1.9, z); cols.setMatrixAt(ci, m4); ci += 1;
    }
    cols.count = ci;
    cols.castShadow = true;
    scene.add(cols);
    boxAt(plain, 1.4, 0.5, 21, -187.2, 4.0, -89.5, 0xdcc7ae);
    boxAt(plain, 3.6, 0.16, 21, -187.2, 4.32, -89.5, 0xc94f38);
    boxAt(plain, 1.4, 0.5, 147, -187.2, 4.0, 25.5, 0xdcc7ae);
    boxAt(plain, 3.6, 0.16, 147, -187.2, 4.32, 25.5, 0xc94f38);
  }

  // --- district name signs --------------------------------------------------
  // The quarter names itself in the world, not just on the map: a long
  // fascia board rides the market colonnade's west face over Marisol's
  // corner, and a two-post gateway board stands at the way into every
  // other district, lettered to be read from a moving car — or a thumbnail.
  {
    const postMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
    const backMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    const SIGN_STYLE = {
      'MARINA ALTA': ['#0e5a68', '#ffedc2', '#ffb340'],
      'LAS PALMAS': ['#27693f', '#fdf3d0', '#ffb340'],
      'CENTRO ALBA': ['#274b63', '#ffedc2', '#57d7e8'],
      'VIEJO PUERTO': ['#a02c1e', '#ffe9b0', '#ffb340'],
      'EL FARO': ['#8a4d16', '#ffedc2', '#ffd23e'],
      'PLAYA BRAVA': ['#b83a5e', '#ffedc2', '#57d7e8'],
    };
    const signFace = (name, w, h, wide) => {
      const [bg, fg, accent] = SIGN_STYLE[name];
      const tex = makeDistrictSignTexture(name, bg, fg, accent, wide ? 1216 : 1024);
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    };

    // MARINA ALTA: the colonnade fascia. The board hangs on the beam's west
    // face above the stalls, over Marisol's corner. Round five re-sized it
    // for the cover camera, which looks along the arcade at a glancing
    // angle: the round-four board (12 m, centred z −8.5) sent its near end
    // — and the name's last letter — past the frame's right edge, and its
    // top corner out of the top. The board is 11 m, centred at z −9.8
    // (spanning −15.3 to −4.3), so the whole name sits inside the frame
    // with air on both sides while the board stays wall-large.
    // Round six drops the whole board on the face — centre y 3.9 → 3.30,
    // so its top edge (face 4.175, backing 4.225) clears the underside of
    // the orange roof trim slab (y 4.24) that juts west past the sign
    // face. At the old height the trim's near edge projected straight
    // across the glyph tops and the T of ALTA lost its crossbar to the
    // orange line; with the board lower and the texture's new headroom
    // (makeDistrictSignTexture), the trim passes above the board's own
    // top border and every letter stands clear below it. Its back is
    // lettered too, for the walkers under the arcade.
    {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.85, 11.4), backMat);
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
      for (const sz of [-14.2, -5.4]) { // mounting stubs up to the roof slab
        const stub = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), postMat);
        stub.position.set(-187.7, 4.4, sz);
        scene.add(stub);
      }
    }

    // The gateways: two steel posts and a double-faced board at the first
    // corner inside each district, front turned to the road it names for.
    const gateway = (name, x, z, ry) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      grp.rotation.y = ry;
      for (const lx of [-3.4, 3.4]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.8, 0.2), postMat);
        post.position.set(lx, 1.9, 0);
        post.castShadow = true;
        grp.add(post);
        // The posts are solid: register each one's world footprint.
        addCollider(data, {
          minX: x + lx * Math.cos(ry) - 0.22, maxX: x + lx * Math.cos(ry) + 0.22,
          minZ: z - lx * Math.sin(ry) - 0.22, maxZ: z - lx * Math.sin(ry) + 0.22,
        });
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(8.3, 1.7, 0.12), backMat);
      back.position.set(0, 2.95, 0);
      back.castShadow = true;
      grp.add(back);
      const front = signFace(name, 8, 1.5, false);
      front.position.set(0, 2.95, 0.075);
      grp.add(front);
      const rear = signFace(name, 8, 1.5, false);
      rear.rotation.y = Math.PI;
      rear.position.set(0, 2.95, -0.075);
      grp.add(rear);
      scene.add(grp);
    };
    gateway('LAS PALMAS', -91.3, -136, -Math.PI / 2); // up the −100 avenue
    gateway('CENTRO ALBA', 99, 29.3, Math.PI); // east along the z 20 road
    gateway('VIEJO PUERTO', -31.3, 78, -Math.PI / 2); // down the −40 avenue
    gateway('EL FARO', -202.3, -216, -Math.PI / 2); // the boulevard's south end
    gateway('PLAYA BRAVA', -202.3, -56, -Math.PI / 2); // the promenade gate
  }

  // --- the market stalls ----------------------------------------------------
  {
    const stripeTex = (base, stripe) => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 32;
      const g = c.getContext('2d');
      for (let x = 0; x < 128; x += 32) { g.fillStyle = base; g.fillRect(x, 0, 16, 32); g.fillStyle = stripe; g.fillRect(x + 16, 0, 16, 32); }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping;
      return t;
    };
    const canopyBatches = new Map();
    const goodsColors = [0xff5347, 0xffb340, 0x7be382, 0x57d7e8, 0xff7ab0, 0xf2e13c];
    for (const s of data.stalls) {
      const key = s.color;
      if (!canopyBatches.has(key)) canopyBatches.set(key, new GeoBatch());
      const cos = Math.cos(s.heading), sin = Math.sin(s.heading);
      const local = (lx, lz) => [s.x + lx * cos + lz * sin, s.z - lx * sin + lz * cos];
      // Table, legs and a striped canopy on four poles.
      boxAt(plain, 2.7, 0.14, 1.5, s.x, 0.95, s.z, 0x8a6844, { ry: s.heading });
      for (const [lx, lz] of [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]]) {
        const [px, pz] = local(lx, lz);
        boxAt(plain, 0.09, 2.3, 0.09, px, 1.15, pz, 0x6e5136);
      }
      const mCan = new THREE.Matrix4().makeRotationY(s.heading)
        .multiply(new THREE.Matrix4().makeRotationX(0.1));
      mCan.setPosition(s.x, 2.42, s.z);
      canopyBatches.get(key).addBox(3.1, 0.1, 2.0, 0, 0, 0, { matrix: mCan, uvMode: 'flat', color: 0xffffff });
      // The goods: bright little piles that read as fruit and cloth.
      for (let gi = 0; gi < 4; gi += 1) {
        const [gx, gz] = local(-0.9 + gi * 0.6, (gi % 2 ? 0.3 : -0.3));
        boxAt(plain, 0.5, 0.34, 0.5, gx, 1.2, gz, goodsColors[(gi + Math.floor(s.z)) % goodsColors.length], { ry: s.heading + gi });
      }
      const [cx2, cz2] = local(1.7, 0.8);
      boxAt(plain, 0.8, 0.8, 0.8, cx2, 0.4, cz2, 0xb08954, { ry: s.heading });
    }
    for (const [colorHex, batch] of canopyBatches) {
      const tex = stripeTex('#f5efe2', `#${colorHex.toString(16).padStart(6, '0')}`);
      scene.add(batch.build(new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }), true));
    }
  }

  // --- benches, planters, dumpsters, booths, bus stops, café tables --------
  for (const bch of data.benches) {
    boxAt(plain, 1.9, 0.1, 0.5, bch.x, 0.48, bch.z, 0x7a5c3e, { ry: bch.heading });
    boxAt(plain, 1.9, 0.55, 0.09, bch.x - Math.sin(bch.heading) * 0.24, 0.78, bch.z - Math.cos(bch.heading) * 0.24, 0x7a5c3e, { ry: bch.heading });
    boxAt(plain, 0.12, 0.48, 0.45, bch.x - 0.8, 0.24, bch.z, 0x4a4f55, { ry: bch.heading });
    boxAt(plain, 0.12, 0.48, 0.45, bch.x + 0.8, 0.24, bch.z, 0x4a4f55, { ry: bch.heading });
  }
  for (const p of data.props) {
    if (p.kind === 'planter') {
      boxAt(plain, 1.7, 0.55, 0.8, p.x, 0.28, p.z, 0xa8563c, { ry: p.heading });
      boxAt(plain, 1.55, 0.4, 0.65, p.x, 0.72, p.z, 0x3f7d3a, { ry: p.heading });
    } else if (p.kind === 'dumpster') {
      boxAt(plain, 2.7, 1.35, 1.7, p.x, 0.68, p.z, 0x3d6e46, { ry: p.heading });
      boxAt(plain, 2.8, 0.12, 1.8, p.x, 1.4, p.z, 0x2e5636, { ry: p.heading });
    } else if (p.kind === 'booth') {
      boxAt(plain, 1.2, 2.5, 1.2, p.x, 1.25, p.z, 0xc23b2e, { ry: p.heading });
      boxAt(plain, 1.35, 0.14, 1.35, p.x, 2.58, p.z, 0x8a2f1d, { ry: p.heading });
    } else if (p.kind === 'busstop') {
      boxAt(plain, 0.09, 2.6, 0.09, p.x - 1.4, 1.3, p.z, 0x3c4248, { ry: p.heading });
      boxAt(plain, 0.09, 2.6, 0.09, p.x + 1.4, 1.3, p.z, 0x3c4248, { ry: p.heading });
      boxAt(plain, 3.4, 0.1, 1.1, p.x, 2.62, p.z, 0x57d7e8, { ry: p.heading });
      boxAt(plain, 1.8, 0.09, 0.45, p.x, 0.5, p.z, 0x7a5c3e, { ry: p.heading });
    } else if (p.kind === 'table') {
      boxAt(plain, 1.05, 0.07, 1.05, p.x, 0.74, p.z, 0xf2ead8, { ry: p.heading });
      boxAt(plain, 0.09, 0.74, 0.09, p.x, 0.37, p.z, 0x4a4f55);
      boxAt(plain, 0.09, 2.3, 0.09, p.x, 1.15, p.z, 0xdddddd);
    }
  }
  // Café umbrellas over the tables, instanced cones with per-instance colour.
  {
    const tables = data.props.filter((p) => p.kind === 'table');
    if (tables.length) {
      const umb = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 0.6, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff }), tables.length);
      const m4 = new THREE.Matrix4();
      const col = new THREE.Color();
      const tones = [0xff5a4d, 0xffb340, 0x57d7e8, 0xff7ab0];
      tables.forEach((p, i) => {
        m4.setPosition(p.x, 2.42, p.z);
        umb.setMatrixAt(i, m4);
        umb.setColorAt(i, col.setHex(tones[i % 4]));
      });
      scene.add(umb);
    }
  }

  scene.add(plain.build(plainMat, true));

  // Plaza fountain: basin, pillar and a bright water disc.
  {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 0.8, 14),
      new THREE.MeshLambertMaterial({ color: 0xd8cfc0 }));
    basin.position.set(PLACES.plaza.x, 0.4, PLACES.plaza.z);
    scene.add(basin);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.2, 8),
      new THREE.MeshLambertMaterial({ color: 0xcbbfa8 }));
    pillar.position.set(PLACES.plaza.x, 1.4, PLACES.plaza.z);
    scene.add(pillar);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.1, 14),
      new THREE.MeshPhongMaterial({ color: 0x57b8d8, shininess: 120, specular: 0xbfeaff }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(PLACES.plaza.x, 0.82, PLACES.plaza.z);
    scene.add(water);
    addCollider(data, { minX: PLACES.plaza.x - 3.6, maxX: PLACES.plaza.x + 3.6, minZ: PLACES.plaza.z - 3.6, maxZ: PLACES.plaza.z + 3.6 });
  }

  // Marina piers, the long pleasure pier, and two dock cranes.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  const pierBatch = new GeoBatch();
  for (let i = 0; i < 4; i += 1) {
    pierBatch.addBox(26, 0.8, 4, -246, 0.4, 200 + i * 22, { color: 0x8a6844, uvMode: 'flat' });
  }
  pierBatch.addBox(data.pier.fromX - data.pier.toX, 0.8, 5, (data.pier.fromX + data.pier.toX) / 2, 0.4, data.pier.z, { color: 0x97744c, uvMode: 'flat' });
  scene.add(pierBatch.build(pierMat));
  for (const cz of [206, 252]) {
    const crane = new THREE.Group();
    const pillarM = new THREE.Mesh(new THREE.BoxGeometry(1.3, 15, 1.3), new THREE.MeshLambertMaterial({ color: 0xd86f35 }));
    pillarM.position.y = 7.5;
    crane.add(pillarM);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(13, 0.8, 0.8), pillarM.material);
    jib.position.set(-4.5, 14.4, 0);
    jib.rotation.z = 0.16;
    crane.add(jib);
    crane.position.set(-234, 0, cz);
    scene.add(crane);
    addCollider(data, { minX: -235, maxX: -233, minZ: cz - 1, maxZ: cz + 1 });
  }

  // Moored boats: hull + trim + cabin; world.js bobs them.
  const boats = [];
  {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xf0ede6 });
    const trimMats = [0xd84f35, 0x2f7fd0, 0x35b06f, 0xf2b13c].map((cc) => new THREE.MeshLambertMaterial({ color: cc }));
    for (let i = 0; i < 8; i += 1) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(boxGeo, hullMat); hull.scale.set(3.2, 1.1, 8); hull.position.y = 0.4; boat.add(hull);
      const trim = new THREE.Mesh(boxGeo, trimMats[i % 4]); trim.scale.set(3.4, 0.35, 8.2); trim.position.y = 0.95; boat.add(trim);
      const cabin = new THREE.Mesh(boxGeo, hullMat); cabin.scale.set(2.2, 1.2, 3); cabin.position.set(0, 1.5, -0.6); boat.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), hullMat);
      mast.position.set(0, 3.6, 1.4); boat.add(mast);
      boat.position.set(-254 - (i % 3) * 7.5, 0, 194 + i * 12.5);
      scene.add(boat);
      boats.push(boat);
    }
  }

  // The lighthouse at El Faro: striped cylinder + lamp room.
  {
    const lh = new THREE.Group();
    const stripeMats = [new THREE.MeshLambertMaterial({ color: 0xf2efe8 }), new THREE.MeshLambertMaterial({ color: 0xd8402e })];
    for (let i = 0; i < 5; i += 1) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.22, 2.8 - i * 0.22, 3.4, 10), stripeMats[i % 2]);
      seg.position.y = 1.7 + i * 3.4;
      seg.castShadow = true;
      lh.add(seg);
    }
    const lampMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
    lampMesh.position.y = 18.6;
    lh.add(lampMesh);
    const capCone = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a2f1d }));
    capCone.position.y = 20.2;
    lh.add(capCone);
    lh.position.set(PLACES.lighthouse.x, 0, PLACES.lighthouse.z);
    scene.add(lh);
    addCollider(data, { minX: PLACES.lighthouse.x - 3, maxX: PLACES.lighthouse.x + 3, minZ: PLACES.lighthouse.z - 3, maxZ: PLACES.lighthouse.z + 3 });
  }

  // The Ferris wheel over Playa Brava: A-frame legs, a spoked rim, cabins
  // that world.js keeps upright while the wheel turns.
  let ferris = null;
  {
    const grp = new THREE.Group();
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 13.5, 0.55), frameMat);
      leg.position.set(0, 5.8, sz * 3.4);
      leg.rotation.x = sz * 0.26;
      grp.add(leg);
    }
    const spinner = new THREE.Group();
    spinner.position.set(0, 11.6, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(10.4, 0.32, 8, 30),
      new THREE.MeshLambertMaterial({ color: 0xffcf5e }));
    rim.rotation.y = Math.PI / 2;
    spinner.add(rim);
    for (let i = 0; i < 4; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.16, 20.4, 0.16), frameMat);
      spoke.rotation.x = (i / 4) * Math.PI;
      spinner.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 8), frameMat);
    hub.rotation.z = Math.PI / 2;
    spinner.add(hub);
    const cabins = [];
    const cabinTones = [0xff5347, 0x57d7e8, 0xffb340, 0x7be382, 0xff7ab0, 0xf2e13c, 0x8a5fc0, 0xf2f2f2];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 1.7),
        new THREE.MeshLambertMaterial({ color: cabinTones[i] }));
      cab.position.set(0, Math.cos(a) * 10.4, Math.sin(a) * 10.4);
      spinner.add(cab);
      cabins.push(cab);
    }
    grp.add(spinner);
    grp.position.set(data.ferris.x, 0, data.ferris.z);
    scene.add(grp);
    addCollider(data, { minX: data.ferris.x - 2, maxX: data.ferris.x + 2, minZ: data.ferris.z - 5, maxZ: data.ferris.z + 5 });
    ferris = { spinner, cabins };
  }

  // Billboards with painted ads for invented Puerto Alba brands.
  {
    const ads = [
      { title: 'CERVEZA FARO', sub: 'la del puerto · bien fría', bg: '#b8352a', fg: '#ffe9b0' },
      { title: 'HOTEL MIRAMAR', sub: '★★★★ frente al mar', bg: '#1f5f7a', fg: '#ffffff' },
      { title: 'FUEGO GT', sub: 'siente el puerto', bg: '#22242a', fg: '#ffcf3f' },
      { title: 'CAFÉ OLA', sub: 'el primero de la mañana', bg: '#7a4a21', fg: '#ffe9c4' },
      { title: 'BANCO DEL PUERTO', sub: 'tu dinero, en casa', bg: '#274b63', fg: '#aee2ff' },
    ];
    const spots = [
      { x: -196, z: -196, ry: 0.5, y: 17 }, { x: 128, z: -96, ry: -0.4, y: 30 },
      { x: -188, z: 168, ry: 0.2, y: 13 }, { x: 236, z: 60, ry: -0.9, y: 24 },
      { x: 30, z: 236, ry: 2.6, y: 15 },
    ];
    spots.forEach((s, i) => {
      const ad = ads[i % ads.length];
      const c = document.createElement('canvas');
      c.width = 512; c.height = 192;
      const g = c.getContext('2d');
      g.fillStyle = ad.bg; g.fillRect(0, 0, 512, 192);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 512, 26);
      g.fillStyle = ad.fg;
      g.textAlign = 'center';
      g.font = '900 64px Arial, sans-serif';
      g.fillText(ad.title, 256, 92);
      g.font = 'italic 34px Arial, sans-serif';
      g.fillText(ad.sub, 256, 148);
      const tex = new THREE.CanvasTexture(c);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(15, 5.6),
        new THREE.MeshBasicMaterial({ map: tex }));
      board.position.set(s.x, s.y, s.z);
      board.rotation.y = s.ry;
      scene.add(board);
      const back = new THREE.Mesh(new THREE.BoxGeometry(15.4, 6, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x4a4f55 }));
      back.position.set(s.x - Math.sin(s.ry) * 0.25, s.y, s.z - Math.cos(s.ry) * 0.25);
      back.rotation.y = s.ry;
      scene.add(back);
      for (const off of [-5.5, 5.5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, s.y - 2.6, 6),
          new THREE.MeshLambertMaterial({ color: 0x3c4248 }));
        pole.position.set(s.x + Math.cos(s.ry) * off, (s.y - 2.6) / 2, s.z - Math.sin(s.ry) * off);
        scene.add(pole);
      }
    });
  }

  // --- wall posters: gig bills pasted on the old town's faces --------------
  {
    const designs = [
      { title: 'CONCIERTO', sub: 'LOS FAROS · SÁBADO 21H', bg: '#c94f38', fg: '#ffe9c4' },
      { title: 'CIRCO DEL MAR', sub: 'EN LA PLAYA · NIÑOS GRATIS', bg: '#1f6f8f', fg: '#ffffff' },
      { title: 'REGATA', sub: 'BAHÍA DE ALBA · DOMINGO', bg: '#274b63', fg: '#aee2ff' },
      { title: 'SE VENDE', sub: 'SOLAR EN LAS PALMAS', bg: '#e8a33c', fg: '#3a2a10' },
    ];
    const atlas = document.createElement('canvas');
    atlas.width = 512; atlas.height = 512;
    const g = atlas.getContext('2d');
    designs.forEach((d, i) => {
      const x0 = (i % 2) * 256, y0 = Math.floor(i / 2) * 256;
      g.fillStyle = d.bg; g.fillRect(x0, y0, 256, 256);
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x0, y0, 256, 40);
      g.fillStyle = d.fg; g.textAlign = 'center';
      g.font = '900 44px Arial, sans-serif';
      g.fillText(d.title, x0 + 128, y0 + 120);
      g.font = 'bold 25px Arial, sans-serif';
      const words = d.sub.split(' · ');
      words.forEach((w, wi) => g.fillText(w, x0 + 128, y0 + 168 + wi * 32));
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, y0 + 226, 256, 30);
    });
    const tex = new THREE.CanvasTexture(atlas);
    const posterBatch = new GeoBatch();
    const prng = makeRng(seed + 31);
    let placed = 0;
    for (const b of data.buildings) {
      if (placed >= 70) break;
      if (!['house', 'shop', 'office'].includes(b.kind) || prng() > 0.34) continue;
      const [nx, nz] = FACE_NORMAL[b.face];
      const fx = b.cx + nx * (Math.abs(nx) > 0 ? b.w / 2 : 0) + (nx === 0 ? (prng() - 0.5) * (b.w - 3) : 0);
      const fz = b.cz + nz * (Math.abs(nz) > 0 ? b.d / 2 : 0) + (nz === 0 ? (prng() - 0.5) * (b.d - 3) : 0);
      const cellIdx = Math.floor(prng() * 4);
      const cell = [(cellIdx % 2) / 2, 1 - (Math.floor(cellIdx / 2) + 1) / 2, 1 / 2, 1 / 2];
      posterBatch.addBox(1.15, 1.5, 0.06, fx + nx * 0.08, 1.95, fz + nz * 0.08,
        { ry: FACE_ANGLE[b.face], uvMode: 'cell', cell, color: 0xffffff });
      placed += 1;
    }
    scene.add(posterBatch.build(new THREE.MeshBasicMaterial({ map: tex, vertexColors: true })));
  }

  // --- festival banners strung across the boulevard ------------------------
  {
    const designs = [
      { text: 'FIESTA DEL PUERTO', bg: '#b8352a', fg: '#ffe9b0' },
      { text: 'REGATA DE LA BAHÍA', bg: '#1f5f7a', fg: '#ffffff' },
    ];
    designs.forEach((d, di) => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 48;
      const g = c.getContext('2d');
      g.fillStyle = d.bg; g.fillRect(0, 0, 1024, 48);
      for (let x = 0; x < 1024; x += 64) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x, 0, 32, 48); }
      g.fillStyle = d.fg; g.textAlign = 'center';
      g.font = '900 30px Arial, sans-serif';
      g.fillText(`${d.text}  ·  ${d.text}`, 512, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      [-160, -40, 80, 200].forEach((z, zi) => {
        if ((zi + di) % 2 !== 0) return;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(26, 1.15), mat);
        banner.position.set(BOULEVARD_X, 6.7, z);
        banner.rotation.y = Math.PI / 2;
        scene.add(banner);
      });
    });
  }

  // --- pennant strings over the old-port streets, bulbs over the market ----
  {
    // The main plain batch is already sealed, so the strings get their own.
    const stringBatch = new GeoBatch();
    const bulbPts = [];
    const stringLine = (x1, z1, x2, z2, y, withFlags) => {
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, sagY = y - 0.55;
      const seg = (ax, az, bx, bz, ay, by) => {
        const len = Math.hypot(bx - ax, bz - az, by - ay);
        const m = new THREE.Matrix4().makeRotationY(Math.atan2(bx - ax, bz - az));
        m.setPosition((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
        stringBatch.addBox(0.035, 0.035, len, 0, 0, 0, { matrix: m, color: 0x2a2d33, uvMode: 'flat' });
      };
      seg(x1, z1, mx, mz, y, sagY);
      seg(mx, mz, x2, z2, sagY, y);
      const flagTones = [0xff5347, 0xffb340, 0x57d7e8, 0x7be382, 0xff7ab0, 0xf2f2f2];
      const steps = Math.floor(Math.hypot(x2 - x1, z2 - z1) / 1.15);
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
        const py = y - Math.sin(t * Math.PI) * 0.55;
        if (withFlags) {
          stringBatch.addBox(0.44, 0.56, 0.03, px, py - 0.3, pz,
            { ry: Math.atan2(x2 - x1, z2 - z1), color: flagTones[i % flagTones.length], uvMode: 'flat' });
        } else {
          bulbPts.push(px, py - 0.12, pz);
        }
      }
    };
    // Laundry-day pennants across four Viejo Puerto / Las Palmas streets.
    stringLine(-100, 132.5, -100, 147.5, 5.6, true);
    stringLine(20, 132.5, 20, 147.5, 5.6, true);
    stringLine(140, 192.5, 140, 207.5, 5.6, true);
    stringLine(-40, 252.5, -40, 267.5, 5.6, true);
    stringLine(80, -167.5, 80, -152.5, 5.6, true);
    // Bulb strings over the market rows (lit at dusk via world.js).
    stringLine(-202, -44, -184, -44, 3.8, false);
    stringLine(-202, 4, -184, 4, 3.8, false);
    stringLine(-202, 48, -184, 48, 3.8, false);
    stringLine(-202, -96, -184, -96, 3.8, false);
    if (bulbPts.length) {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(16, 16, 1, 16, 16, 15);
      grad.addColorStop(0, 'rgba(255,230,170,1)');
      grad.addColorStop(0.4, 'rgba(255,200,110,0.5)');
      grad.addColorStop(1, 'rgba(255,190,100,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(bulbPts, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.9, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);
      data.stringLightsMat = mat;
    }
    scene.add(stringBatch.build(plainMat));
  }

  return { boats, ferris };
}
