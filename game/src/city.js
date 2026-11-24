// city.js — Puerto Alba: the surveyed grid, the painted ground, the
// painted facades, the colonnade and its signs. Two halves: buildCityData
// (pure data — buildings, colliders, places, props — shared by the live
// game, the minimap and the staging) and buildCityMeshes (the Three.js
// geometry that wears the painted canvas textures).

import { makeRng, pick, randRange, clamp } from './util.js';

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
  { name: 'Las Palmas', minX: -128, maxX: 292, minZ: -308, maxZ: -130 },
  { name: 'Centro Alba', minX: -128, maxX: 150, minZ: -130, maxZ: 70 },
  { name: 'Viejo Puerto', minX: -128, maxX: 292, minZ: 70, maxZ: 308 },
];

export const PLACES = {
  marinaGate: { x: -212, z: 290, label: 'Marina gate' },
  marina: { x: -240, z: 232, label: 'Marina docks' },
  garage: { x: -170, z: -64, label: "Dario's Garage" },
  hospital: { x: 230, z: 110, label: 'Hospital' },
  papd: { x: -2, z: 52, label: 'PAPD station' },
  lighthouse: { x: -240, z: -262, label: 'El Faro lighthouse' },
  raceStart: { x: 140, z: 200, label: 'Race start' },
  marisol: { x: -193.5, z: -7.3, label: 'Marisol' },
  alleyShootout: { x: 110, z: -70, label: 'Palma alley' },
  bar: { x: -196, z: 150, label: 'Bar La Ola' },
  crates: { x: -196, z: -252, label: 'El Faro crates' },
  safehouse: { x: -70, z: 235, label: 'Safehouse' },
  takedownYard: { x: 225, z: -185, label: 'Depot yard' },
  villa: { x: 250, z: 280, label: "Kingpin's villa" },
  fares: [
    { x: -196, z: 40 }, { x: 20, z: -160 }, { x: 140, z: 80 },
    { x: -40, z: 200 }, { x: 230, z: -40 }, { x: 80, z: 260 },
  ],
};

export const PASTEL_TINTS = [0xf6e3b4, 0xf2c184, 0xef9f7d, 0xe8dfc8, 0xbfe0d0, 0xf5a8c0, 0xa9cdea, 0xf7dd7e, 0xdcb98d, 0x93c9a4, 0xe89a5f, 0xfdf6ec];
export const TOWER_TINTS = [0xd8e2e8, 0xb9c9d6, 0xe6d3ae, 0xaec6d8, 0xd8bf9e, 0xc3d2da];
export const AWNING_COLORS = [0xc94f38, 0x2f7f8f, 0xe8a33c, 0x3f7d4e, 0x7a4a8f, 0xd84f78];
export const STALL_COLORS = [0xd84f35, 0x2f8fae, 0xf2b13c, 0x3fae6a, 0xe86ab0];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
  }
  return DISTRICTS[4];
}

export function isOnRoad(x, z) {
  if (Math.abs(x - BOULEVARD_X) <= ROAD_WIDTH / 2 + 1) return true;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2 + 1) return true;
  for (const rz of ROADS_Z) if (Math.abs(z - rz) <= ROAD_WIDTH / 2 + 1) return true;
  return false;
}

export function intersections() {
  const out = [];
  for (const rx of ROADS_X) for (const rz of ROADS_Z) out.push({ x: rx, z: rz });
  return out;
}

/** Lamp spots: intersection corners on the kerb, plus the boulevard run. */
export function streetlightSpots() {
  const spots = [];
  for (const rx of ROADS_X) {
    for (const rz of ROADS_Z) {
      const k = ROAD_WIDTH / 2 + 1.3;
      spots.push({ x: rx - k, z: rz - k });
      spots.push({ x: rx + k, z: rz + k });
    }
  }
  for (let z = -300; z <= 300; z += 40) {
    spots.push({ x: BOULEVARD_X - ROAD_WIDTH / 2 - 1.3, z });
    spots.push({ x: BOULEVARD_X + ROAD_WIDTH / 2 + 1.3, z: z + 20 });
  }
  return spots;
}

export function randomRoadPoint(rng) {
  if (rng() < 0.3) {
    return { axis: 'z', line: BOULEVARD_X, dir: rng() < 0.5 ? 1 : -1 };
  }
  if (rng() < 0.5) {
    return { axis: 'z', line: pick(rng, ROADS_X), dir: rng() < 0.5 ? 1 : -1 };
  }
  return { axis: 'x', line: pick(rng, ROADS_Z), dir: rng() < 0.5 ? 1 : -1 };
}

// ------------------------------------------------------------ city data

export function addCollider(data, box) {
  data.colliders.push(box);
  return box;
}

export function collidersNear(data, x, z) {
  const out = [];
  for (const c of data.colliders) {
    if (x >= c.minX - 24 && x <= c.maxX + 24 && z >= c.minZ - 24 && z <= c.maxZ + 24) out.push(c);
  }
  return out;
}

function rectOf(cx, cz, w, d) {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

function overlaps(a, b, pad = 0) {
  return a.minX < b.maxX + pad && a.maxX > b.minX - pad && a.minZ < b.maxZ + pad && a.maxZ > b.minZ - pad;
}

function addBuilding(data, rng, spec) {
  const b = {
    x: spec.x, z: spec.z, w: spec.w, d: spec.d, h: spec.h,
    tint: spec.tint, face: spec.face || 'S',
    shopFront: !!spec.shopFront, tower: !!spec.tower, name: spec.name || null,
    variant: Math.floor(rng() * 6),
    balconies: spec.balconies || [],
    awning: spec.awning || null,
  };
  if (!spec.balconies && b.h >= 9) {
    const ys = [3.1, 4.3, 7.5].filter(() => rng() < 0.55);
    b.balconies = ys.map((y) => ({ y, off: (rng() - 0.5) * Math.max(2, Math.min(b.w, b.d) - 6) }));
  }
  data.buildings.push(b);
  addCollider(data, { ...rectOf(b.x, b.z, b.w, b.d), h: b.h, building: b });
  return b;
}

const NAMED = [
  { key: 'garage', x: -170, z: -64, w: 24, d: 20, h: 9, tint: 0xe8b48c, face: 'W', shopFront: true, awning: 0x8a2f1d, name: 'GARAGE' },
  { key: 'hospital', x: 230, z: 110, w: 30, d: 22, h: 16, tint: 0xf2f4f4, face: 'W', name: 'HOSPITAL' },
  { key: 'papd', x: -2, z: 52, w: 28, d: 20, h: 13, tint: 0xb9cbd8, face: 'S', name: 'PAPD' },
  { key: 'almacen', x: 170, z: 230, w: 34, d: 24, h: 11, tint: 0xcbb79a, face: 'N', shopFront: true, name: 'ALMACÉN 9' },
  { key: 'villa', x: 250, z: 280, w: 26, d: 20, h: 10, tint: 0xfdf6ec, face: 'W', name: 'VILLA' },
  { key: 'marinaOffice', x: -238, z: 250, w: 12, d: 10, h: 6, tint: 0xa9cdea, face: 'E', name: 'MARINA' },
];

export function buildCityData(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const data = {
    buildings: [], colliders: [], plazas: [], stalls: [], lamps: [],
    boats: [], ferris: { x: -240, z: -252 }, seed,
  };
  const reserved = [];
  for (const n of NAMED) {
    const b = addBuilding(data, rng, n);
    reserved.push({ ...rectOf(b.x, b.z, b.w, b.d) });
    if (n.key === 'garage') data.garageBuilding = b;
  }
  // Clock tower on its own plinth in Centro Alba.
  const tower = addBuilding(data, rng, { x: 50, z: -8, w: 8, d: 8, h: 34, tint: 0xe8d9b0, face: 'S', name: 'CLOCK' });
  reserved.push({ ...rectOf(tower.x, tower.z, tower.w, tower.d) });

  // The Palma alley block (roads 80..140 x -100..-40): a corner house with
  // staged balconies, low neighbours and an open yard at the anchor.
  const at = PLACES.alleyShootout;
  const corner = addBuilding(data, rng, {
    x: at.x + 16, z: at.z + 16, w: 18, d: 16, h: 11, tint: 0xf2c184, face: 'S',
    balconies: [{ y: 3.1, off: -3 }, { y: 4.3, off: 3 }, { y: 7.5, off: 0 }],
    name: 'CORNER',
  });
  reserved.push({ ...rectOf(corner.x, corner.z, corner.w, corner.d) });
  addBuilding(data, rng, { x: at.x - 22, z: at.z + 14, w: 14, d: 12, h: 7, tint: 0xef9f7d, face: 'E' });
  addBuilding(data, rng, { x: at.x + 20, z: at.z - 18, w: 16, d: 12, h: 8, tint: 0xbfe0d0, face: 'S' });

  // Plazas: three paved squares kept clear of buildings.
  data.plazas = [
    { minX: 28, maxX: 72, minZ: -32, maxZ: 12 },
    { minX: -92, maxX: -48, minZ: 148, maxZ: 192 },
    { minX: 148, maxX: 192, minZ: -92, maxZ: -48 },
  ];
  for (const p of data.plazas) reserved.push({ ...p });

  // Generic fill: subdivide every block into lots, skipping the promenade
  // strip west of the boulevard, the alley yard and anything reserved.
  const xs = [CITY_BOUNDS.minX, ...ROADS_X, CITY_BOUNDS.maxX];
  const zs = [CITY_BOUNDS.minZ, ...ROADS_Z, CITY_BOUNDS.maxZ];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < zs.length - 1; j += 1) {
      const bx0 = xs[i] + ROAD_WIDTH / 2 + 3;
      const bx1 = xs[i + 1] - ROAD_WIDTH / 2 - 3;
      const bz0 = zs[j] + ROAD_WIDTH / 2 + 3;
      const bz1 = zs[j + 1] - ROAD_WIDTH / 2 - 3;
      if (bx1 - bx0 < 16 || bz1 - bz0 < 16) continue;
      if (bx0 < -206) continue; // promenade / marina strip stays open
      let cx = bx0;
      while (cx < bx1 - 10) {
        const w = Math.min(randRange(rng, 15, 24), bx1 - cx);
        let cz = bz0;
        while (cz < bz1 - 10) {
          const d = Math.min(randRange(rng, 15, 24), bz1 - cz);
          const rect = rectOf(cx + w / 2, cz + d / 2, w - 1.5, d - 1.5);
          const blocked = reserved.some((r) => overlaps(rect, r, 2.5))
            || (Math.abs(cx + w / 2 - at.x) < 30 && Math.abs(cz + d / 2 - at.z) < 30);
          if (!blocked && rng() > 0.12) {
            const towerLot = rng() < 0.16;
            const h = towerLot ? randRange(rng, 18, 34) : randRange(rng, 6, 15);
            const face = ['S', 'N', 'E', 'W'][Math.floor(rng() * 4)];
            addBuilding(data, rng, {
              x: cx + w / 2, z: cz + d / 2, w: w - 1.5, d: d - 1.5, h,
              tint: towerLot ? pick(rng, TOWER_TINTS) : pick(rng, PASTEL_TINTS),
              face, tower: towerLot, shopFront: rng() < 0.4,
              awning: rng() < 0.3 ? pick(rng, AWNING_COLORS) : null,
            });
          }
          cz += d + 1.5;
        }
        cx += w + 1.5;
      }
    }
  }

  // Market stalls along the promenade.
  for (let z = -120; z <= 128; z += 16) {
    if (rng() < 0.25) continue;
    data.stalls.push({ x: -222.5, z: z + randRange(rng, -2, 2), color: pick(rng, STALL_COLORS), heading: Math.PI / 2 });
  }
  // The colonnade market: a tight row trading under the MARINA ALTA sign,
  // on the forecourt where the cover camera can see it work.
  for (let z = -26; z <= -12; z += 7) {
    data.stalls.push({ x: -193.5, z: z + randRange(rng, -1, 1), color: pick(rng, STALL_COLORS), heading: -Math.PI / 2 });
  }
  for (let z = -16; z <= 24; z += 8) {
    data.stalls.push({ x: -199.5, z: z + randRange(rng, -1, 1), color: pick(rng, STALL_COLORS), heading: -Math.PI / 2 });
  }
  data.lamps = streetlightSpots();
  // Marina berths: three staggered columns of moorings.
  for (let i = 0; i < 12; i += 1) {
    data.boats.push({ x: -254 - (i % 3) * 7.5, z: 194 + i * 12.5, heading: Math.PI / 2 + (rng() - 0.5) * 0.2 });
  }
  return data;
}

// ------------------------------------------------------- painted textures

function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = size[0];
  c.height = size[1];
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  return tex;
}

/** The facade recipe: cream plaster, grime, four floors of windows. */
export function facadeTexture(variant) {
  const rng = makeRng(4000 + variant * 131);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#f6f1e5';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 7; i += 1) {
      g.fillStyle = `rgba(120,100,70,${0.03 + rng() * 0.05})`;
      g.fillRect(rng() * 220, rng() * 220, 30 + rng() * 60, 20 + rng() * 50);
    }
    // Upper floors: three 64px bands of windows (canvas top = roof line).
    for (let f = 0; f < 3; f += 1) {
      const y = f * 64;
      for (let x = 14; x < 226; x += 42) {
        const lit = rng() < 0.3;
        g.fillStyle = lit ? '#ffd98a' : '#33505e';
        g.fillRect(x, y + 14, 24, 34);
        g.fillStyle = 'rgba(180,225,245,0.5)';
        g.fillRect(x + 3, y + 17, 8, 28);
        g.fillStyle = '#7a6a52'; // shutter slats
        g.fillRect(x - 5, y + 14, 4, 34);
        g.fillRect(x + 25, y + 14, 4, 34);
        if (rng() < 0.4) { // AC box under a window
          g.fillStyle = '#b9c0c4';
          g.fillRect(x + 4, y + 50, 16, 9);
        }
      }
      g.fillStyle = 'rgba(90,80,64,0.35)';
      g.fillRect(0, y + 62, 256, 2);
    }
    // Ground floor.
    const gy = 192;
    const shop = variant % 2 === 0;
    if (shop) {
      g.fillStyle = '#8a97a3';
      g.fillRect(0, gy, 256, 14);
      for (let x = 10; x < 220; x += 58) {
        g.fillStyle = '#33505e';
        g.fillRect(x, gy + 16, 48, 40);
        g.fillStyle = 'rgba(180,225,245,0.5)';
        g.fillRect(x + 4, gy + 20, 18, 32);
      }
      g.fillStyle = '#5a4632';
      g.fillRect(118, gy + 16, 24, 44);
    } else {
      g.fillStyle = '#6e5136';
      g.fillRect(112, gy + 12, 30, 48);
      for (let x = 16; x < 220; x += 58) {
        g.fillStyle = '#33505e';
        g.fillRect(x, gy + 18, 26, 30);
      }
    }
  }, true);
}

/** The paving recipe: grout, warm slabs, wear speckle, stains. */
export function pavingTexture() {
  const rng = makeRng(777);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#877c68';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        const v = (rng() - 0.5) * 14;
        g.fillStyle = `rgb(${176 + v},${166 + v},${144 + v})`;
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
        for (let s = 0; s < 26; s += 1) {
          g.fillStyle = `rgba(90,80,64,${0.05 + rng() * 0.09})`;
          g.fillRect(i * 64 + 2 + rng() * 58, j * 64 + 2 + rng() * 58, 2, 2);
        }
      }
    }
    for (let s = 0; s < 7; s += 1) {
      const x = rng() * 256;
      const y = rng() * 256;
      const r = 18 + rng() * 22;
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, `rgba(70,60,44,${0.10 + rng() * 0.08})`);
      grad.addColorStop(1, 'rgba(70,60,44,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, true);
}

/** The asphalt recipe: dark aggregate, patched cracks, tar seams. */
export function asphaltTexture() {
  const rng = makeRng(1234);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#3d3f45';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i += 1) {
      const l = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
      g.fillStyle = l;
      g.fillRect(rng() * 256, rng() * 256, 1.6, 1.6);
    }
    for (let i = 0; i < 5; i += 1) { // patched cracks
      g.strokeStyle = 'rgba(16,16,20,0.55)';
      g.lineWidth = 1.4;
      g.beginPath();
      let x = rng() * 256;
      let y = rng() * 256;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k += 1) {
        x += (rng() - 0.5) * 60;
        y += rng() * 34;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 3; i += 1) { // tar seams
      g.fillStyle = 'rgba(20,20,24,0.5)';
      if (rng() < 0.5) g.fillRect(0, rng() * 256, 256, 5 + rng() * 5);
      else g.fillRect(rng() * 256, 0, 5 + rng() * 5, 256);
    }
    for (let i = 0; i < 4; i += 1) { // patch rectangles
      g.fillStyle = 'rgba(70,72,80,0.35)';
      g.fillRect(rng() * 200, rng() * 200, 30 + rng() * 40, 22 + rng() * 30);
    }
  }, true);
}

/** Beach sand: warm grain, wind ripples, shell speckle. */
export function sandTexture() {
  const rng = makeRng(99);
  return canvasTex([256, 256], (g) => {
    g.fillStyle = '#e8cf9e';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 9) {
      g.strokeStyle = `rgba(160,128,84,${0.08 + rng() * 0.08})`;
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.1 + y) * 2.4);
      g.stroke();
    }
    for (let i = 0; i < 700; i += 1) {
      g.fillStyle = rng() < 0.12 ? 'rgba(255,250,238,0.7)' : 'rgba(150,118,74,0.16)';
      g.fillRect(rng() * 256, rng() * 256, 1.6, 1.6);
    }
  }, true);
}

/** A district sign face: bg, accent frame, cream letters. */
export function signTexture(text, style, wide) {
  const w = wide ? 1216 : 1024;
  return canvasTex([w, 160], (g) => {
    g.fillStyle = style[0];
    g.fillRect(0, 0, w, 160);
    g.strokeStyle = style[2];
    g.lineWidth = 8;
    g.strokeRect(10, 10, w - 20, 140);
    g.fillStyle = style[1];
    g.font = `700 ${wide ? 104 : 96}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, 86);
  }, false);
}

// ------------------------------------------------------------ city meshes

const ROOF_TONES = [0xb06a48, 0x9c8d7a];

export function buildCityMeshes(scene, data, seed) {
  const rng = makeRng(seed * 31 + 7);
  const group = new THREE.Group();
  group.name = 'city';
  const balconyMeshes = [];

  const paving = pavingTexture();
  const asphalt = asphaltTexture();
  const sand = sandTexture();
  const landMat = new THREE.MeshLambertMaterial({ color: 0x666a58 });
  const sandMat = new THREE.MeshLambertMaterial({ map: sand });
  sandMat.map.repeat.set(10, 60);
  const pavingMat = new THREE.MeshLambertMaterial({ map: paving });
  const asphaltMat = new THREE.MeshLambertMaterial({ map: asphalt });

  function groundPlane(w, d, x, z, y, mat, rx, rz) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    if (rx) { m.material = mat.clone(); m.material.map = mat.map.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(rx, rz); }
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // Base land, sand shelf, promenade.
  groundPlane(560, 640, 16, 0, -0.02, landMat);
  groundPlane(96, 640, -276, 0, 0.0, sandMat);
  groundPlane(25, 624, -216.5, 0, 0.025, pavingMat, 3, 78);

  // The colonnade forecourt: one broad paved market apron.
  groundPlane(40, 150, -184, 0, 0.026, pavingMat, 5, 19);

  // Plazas wear the paving at full repeat.
  for (const p of data.plazas) {
    groundPlane(p.maxX - p.minX, p.maxZ - p.minZ, (p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2, 0.03, pavingMat, (p.maxX - p.minX) / 8, (p.maxZ - p.minZ) / 8);
  }

  // Sidewalk aprons then asphalt carriageways.
  const walkMat = new THREE.MeshLambertMaterial({ map: paving, color: 0xcfc8ba });
  function roadRun(len, x, z, alongZ, mat, rep) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? ROAD_WIDTH + 6 : len, 0.05, alongZ ? len : ROAD_WIDTH + 6), walkMat);
    apron.position.set(x, 0.025, z);
    apron.receiveShadow = true;
    group.add(apron);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(alongZ ? ROAD_WIDTH : len, alongZ ? len : ROAD_WIDTH), mat);
    top.rotation.x = -Math.PI / 2;
    if (!alongZ) top.rotation.z = Math.PI / 2;
    top.position.set(x, 0.055, z);
    top.receiveShadow = true;
    if (rep) { top.material = mat.clone(); top.material.map = asphalt.clone(); top.material.map.needsUpdate = true; top.material.map.repeat.set(rep[0], rep[1]); }
    group.add(top);
  }
  // The Palma alley apron: the shootout corner is asphalt, edged with a
  // paving strip on its south-west side where the player makes his stand.
  groundPlane(36, 32, PLACES.alleyShootout.x + 2, PLACES.alleyShootout.z + 2, 0.045, asphaltMat, 5, 5);
  groundPlane(36, 7, PLACES.alleyShootout.x + 2, PLACES.alleyShootout.z - 13.5, 0.05, pavingMat, 5, 1);

  for (const rx of ROADS_X) roadRun(616, rx, 0, true, asphaltMat, [2, 88]);
  for (const rz of ROADS_Z) roadRun(544, 0, rz, false, asphaltMat, [88, 2]);
  roadRun(616, BOULEVARD_X, 0, true, asphaltMat, [2, 88]);
  // Boulevard median.
  const median = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 616), new THREE.MeshLambertMaterial({ color: 0x9aa27a }));
  median.position.set(BOULEVARD_X, 0.11, 0);
  group.add(median);

  // Centre dashes (instanced, warm yellow, faint emissive).
  const dashGeo = new THREE.PlaneGeometry(0.35, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const dashSpots = [];
  for (const rx of ROADS_X) for (let z = -304; z <= 304; z += 9) {
    if (ROADS_Z.some((rz) => Math.abs(z - rz) < 10)) continue;
    dashSpots.push([rx, z, 0]);
  }
  for (const rz of ROADS_Z) for (let x = -248; x <= 288; x += 9) {
    if (ROADS_X.some((rx) => Math.abs(x - rx) < 10) || Math.abs(x - BOULEVARD_X) < 10) continue;
    dashSpots.push([x, rz, Math.PI / 2]);
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
  {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    dashSpots.forEach(([x, z, rot], i) => {
      e.set(-Math.PI / 2, 0, rot);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0.07, z), q, s);
      dashes.setMatrixAt(i, m4);
    });
  }
  group.add(dashes);

  // Puddles on the carriageways.
  const puddleMat = new THREE.MeshBasicMaterial({ color: 0x39506b, transparent: true, opacity: 0.14 });
  for (let i = 0; i < 14; i += 1) {
    const onX = rng() < 0.5;
    const px = onX ? pick(rng, ROADS_X) + randRange(rng, -4, 4) : randRange(rng, -200, 280);
    const pz = onX ? randRange(rng, -280, 280) : pick(rng, ROADS_Z) + randRange(rng, -4, 4);
    const p = new THREE.Mesh(new THREE.CircleGeometry(randRange(rng, 1.4, 3.4), 12), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, 0.065, pz);
    group.add(p);
  }

  // Buildings: painted facade on the flanks, flat roof tone on top.
  const facades = [];
  for (let v = 0; v < 6; v += 1) facades.push(facadeTexture(v));
  const roofMats = ROOF_TONES.map((t) => new THREE.MeshLambertMaterial({ color: t }));
  const towerRoofMat = new THREE.MeshLambertMaterial({ color: 0x9aa2a8 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
  const balconyMat = new THREE.MeshLambertMaterial({ color: 0xd8cfc0 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  function faceMaterial(b, faceW) {
    const tex = facades[b.variant].clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(faceW / 12)), Math.max(1, Math.round(b.h / 12)));
    tex.offset.set(b.variant * 0.13, 0);
    return new THREE.MeshLambertMaterial({ map: tex, color: b.tint });
  }

  for (const b of data.buildings) {
    const mesh = new THREE.Mesh(boxGeo, [
      faceMaterial(b, b.d), faceMaterial(b, b.d),
      b.tower ? towerRoofMat : roofMats[b.variant % 2], trimMat,
      faceMaterial(b, b.w), faceMaterial(b, b.w),
    ]);
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // Cornice trim.
    const trim = new THREE.Mesh(boxGeo, trimMat);
    trim.scale.set(b.w + 0.5, 0.35, b.d + 0.5);
    trim.position.set(b.x, b.h - 0.2, b.z);
    group.add(trim);
    // Balconies on the recorded face.
    for (const bal of b.balconies) {
      const bm = new THREE.Mesh(boxGeo, balconyMat);
      bm.scale.set(2.6, 0.18, 1.1);
      if (b.face === 'S') bm.position.set(b.x + bal.off, bal.y, b.z + b.d / 2 + 0.55);
      else if (b.face === 'N') bm.position.set(b.x + bal.off, bal.y, b.z - b.d / 2 - 0.55);
      else if (b.face === 'E') { bm.position.set(b.x + b.w / 2 + 0.55, bal.y, b.z + bal.off); bm.rotation.y = Math.PI / 2; }
      else { bm.position.set(b.x - b.w / 2 - 0.55, bal.y, b.z + bal.off); bm.rotation.y = Math.PI / 2; }
      bm.userData.building = b;
      group.add(bm);
      balconyMeshes.push(bm);
    }
    // Awning over a shopfront face.
    if (b.awning) {
      const am = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: b.awning }));
      const len = Math.min(b.w, b.d) * 0.72;
      am.scale.set(len, 0.14, 1.7);
      if (b.face === 'S') { am.position.set(b.x, 3.1, b.z + b.d / 2 + 0.8); }
      else if (b.face === 'N') { am.position.set(b.x, 3.1, b.z - b.d / 2 - 0.8); }
      else if (b.face === 'E') { am.position.set(b.x + b.w / 2 + 0.8, 3.1, b.z); am.rotation.y = Math.PI / 2; }
      else { am.position.set(b.x - b.w / 2 - 0.8, 3.1, b.z); am.rotation.y = Math.PI / 2; }
      am.rotation.x = 0.1;
      group.add(am);
    }
  }

  // ------------------------------------------------ the colonnade + signs
  const SIGN_STYLES = {
    'MARINA ALTA': ['#0e5a68', '#ffedc2', '#ffb340'],
    'LAS PALMAS': ['#27693f', '#fdf3d0', '#ffb340'],
    'CENTRO ALBA': ['#274b63', '#ffedc2', '#57d7e8'],
    'VIEJO PUERTO': ['#a02c1e', '#ffe9b0', '#ffb340'],
    'EL FARO': ['#8a4d16', '#ffedc2', '#ffd23e'],
    'PLAYA BRAVA': ['#b83a5e', '#ffedc2', '#57d7e8'],
  };
  const colMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc4 });
  const colGeo = new THREE.CylinderGeometry(0.26, 0.3, 3.8, 7);
  const colZ = [];
  for (let z = -99; z <= 99; z += 6) {
    if (z > -80 && z < -48) continue; // the garage gap
    colZ.push(z);
  }
  const columns = new THREE.InstancedMesh(colGeo, colMat, colZ.length);
  {
    const m4 = new THREE.Matrix4();
    colZ.forEach((z, i) => {
      m4.makeTranslation(-187.2, 1.9, z);
      columns.setMatrixAt(i, m4);
    });
  }
  columns.castShadow = true;
  group.add(columns);
  const beamMat = new THREE.MeshLambertMaterial({ color: 0xdcc7ae });
  const beamTrimMat = new THREE.MeshLambertMaterial({ color: 0xc94f38 });
  function beam(len, z) {
    const b = new THREE.Mesh(boxGeo, beamMat);
    b.scale.set(1.4, 0.5, len);
    b.position.set(-187.2, 4.0, z);
    group.add(b);
    const t = new THREE.Mesh(boxGeo, beamTrimMat);
    t.scale.set(3.6, 0.16, len);
    t.position.set(-187.2, 4.32, z);
    group.add(t);
  }
  beam(21, -89.5);
  beam(147, 25.5);

  // The MARINA ALTA board, hung over the arcade at z -9.8.
  const marinaTex = signTexture('MARINA ALTA', SIGN_STYLES['MARINA ALTA'], true);
  const boardBack = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
  boardBack.scale.set(0.16, 1.85, 11.4);
  boardBack.position.set(-188.02, 3.3, -9.8);
  boardBack.castShadow = true;
  group.add(boardBack);
  const faceGeo = new THREE.PlaneGeometry(11, 1.75);
  const faceMat = new THREE.MeshBasicMaterial({ map: marinaTex });
  const front = new THREE.Mesh(faceGeo, faceMat);
  front.rotation.y = -Math.PI / 2;
  front.position.set(-188.13, 3.3, -9.8);
  group.add(front);
  const rear = new THREE.Mesh(faceGeo, faceMat);
  rear.rotation.y = Math.PI / 2;
  rear.position.set(-187.91, 3.3, -9.8);
  group.add(rear);
  const stubMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  for (const sz of [-14.2, -5.4]) {
    const stub = new THREE.Mesh(boxGeo, stubMat);
    stub.scale.set(0.14, 0.45, 0.14);
    stub.position.set(-187.7, 4.4, sz);
    group.add(stub);
  }

  // Gateway boards for the other five districts.
  function gateway(text, x, z, rotY) {
    const g = new THREE.Group();
    const postMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
    for (const off of [-3.4, 3.4]) {
      const post = new THREE.Mesh(boxGeo, postMat);
      post.scale.set(0.18, 3.6, 0.18);
      post.position.set(off, 1.8, 0);
      g.add(post);
    }
    const board = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    board.scale.set(8.4, 1.7, 0.14);
    board.position.set(0, 2.7, 0);
    g.add(board);
    const tex = signTexture(text, SIGN_STYLES[text], false);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshBasicMaterial({ map: tex }));
    f.position.set(0, 2.7, 0.09);
    g.add(f);
    const bk = f.clone();
    bk.rotation.y = Math.PI;
    bk.position.z = -0.09;
    g.add(bk);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    group.add(g);
  }
  gateway('LAS PALMAS', 20, -138, Math.PI);
  gateway('CENTRO ALBA', -136, 20, Math.PI / 2);
  gateway('VIEJO PUERTO', 80, 78, 0);
  gateway('EL FARO', -204, -246, Math.PI / 2);
  gateway('PLAYA BRAVA', -204, 118, Math.PI / 2);

  // Streetlights: instanced poles + emissive heads.
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.6, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c3036 });
  const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, data.lamps.length);
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, data.lamps.length);
  {
    const m4 = new THREE.Matrix4();
    data.lamps.forEach((l, i) => {
      m4.makeTranslation(l.x, 2.8, l.z);
      lampMesh.setMatrixAt(i, m4);
      m4.makeTranslation(l.x, 5.65, l.z);
      headMesh.setMatrixAt(i, m4);
    });
  }
  group.add(lampMesh);
  group.add(headMesh);

  // Market stalls on the promenade.
  const stallBaseMat = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  for (const s of data.stalls) {
    const st = new THREE.Group();
    const base = new THREE.Mesh(boxGeo, stallBaseMat);
    base.scale.set(2.6, 1.1, 1.6);
    base.position.y = 0.55;
    st.add(base);
    const canopy = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: s.color }));
    canopy.scale.set(3.1, 0.12, 2.1);
    canopy.position.y = 2.05;
    canopy.rotation.z = 0.1;
    st.add(canopy);
    for (const px of [-1.3, 1.3]) {
      const post = new THREE.Mesh(boxGeo, stallBaseMat);
      post.scale.set(0.09, 2.0, 0.09);
      post.position.set(px, 1.0, 0.8);
      st.add(post);
    }
    st.position.set(s.x, 0, s.z);
    st.rotation.y = s.heading;
    group.add(st);
  }

  // Marina piers reaching into the bay.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6e5136 });
  for (let i = 0; i < 4; i += 1) {
    const pier = new THREE.Mesh(boxGeo, pierMat);
    pier.scale.set(20, 0.5, 2.6);
    pier.position.set(-262, 0.35, 200 + i * 37);
    group.add(pier);
  }

  group.userData.balconies = balconyMeshes;
  scene.add(group);
  return group;
}
