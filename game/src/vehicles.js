// vehicles.js — Puerto Alba's rolling stock: five types built from
// boxes and intent (the Alba sedan, the taxi, the Fuego GT, the
// Carguero truck and the PAPD cruiser with its lightbar), an arcade
// drive model any system can steer with { throttle, steer, handbrake },
// and the damage ladder that takes a car from showroom to smoking to
// burning to gone. Cars are solid: a driven car answers to
// collideCarWithCars, the pairwise pass treats every hull as an
// oriented box, and a parked car is a wall with wheels. Headlights and
// their cones share two materials the dusk can switch for the whole
// fleet at once; the cruiser's lightbar glow does the same trick in
// red and blue, flashed by police.js and the staged scenes alike.
import { G } from './state.js';
import { collidersNear } from './city.js';
import { clamp, collideCircleBox, collideCircleOBB, dist2d, makeRng } from './util.js';
import { burst, burstSmoke, explodeAt } from './effects.js';

export const CAR_TYPES = {
  sedan: {
    name: 'Alba Sedan', width: 1.9, length: 4.4, topSpeed: 33, accel: 13,
    colors: [0xd84f35, 0x2f7fd0, 0xe8e3d5, 0x35b06f, 0x8a9db5, 0x30363e, 0xc94f78, 0xf5f0e6, 0x7a4a8f, 0xe89a5f],
  },
  taxi: {
    name: 'Taxi Alba', width: 1.9, length: 4.4, topSpeed: 32, accel: 13,
    colors: [0xf2b13c],
  },
  sport: {
    name: 'Fuego GT', width: 1.95, length: 4.5, topSpeed: 45, accel: 19,
    colors: [0xff5347, 0xffcf3f, 0x2f7fd0, 0x35b06f, 0x181c22, 0xf5f0e6],
  },
  truck: {
    name: 'Carguero', width: 2.3, length: 6.6, topSpeed: 26, accel: 9,
    colors: [0xb9c9d6, 0xd8cfc0, 0x8a9db5, 0xc94f38, 0x3f7d4e],
  },
  cruiser: {
    name: 'PAPD Cruiser', width: 1.95, length: 4.7, topSpeed: 41, accel: 17,
    colors: [0xf2f2f2],
  },
};

// Shared light materials: one switch lights the whole fleet at dusk,
// and the lightbar glows flash in alternation for every cruiser at once.
export const HEADLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0x8a8578 });
export const LIGHTBAR_RED = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
export const LIGHTBAR_BLUE = new THREE.MeshBasicMaterial({ color: 0x2255aa });
export const HEADLIGHT_CONE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffe9a3, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
});
export const GLOW_RED_MAT = new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0, depthWrite: false });
export const GLOW_BLUE_MAT = new THREE.MeshBasicMaterial({ color: 0x2a7fff, transparent: true, opacity: 0, depthWrite: false });

const glassMat = new THREE.MeshPhongMaterial({ color: 0x1d2733, shininess: 70, specular: 0x557788 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x1b1d20 });
const trimMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
const fallbackRng = makeRng(999);

let nextCarId = 1;

function box(mat, sx, sy, sz, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/**
 * Build one car's mesh: hull, cabin, wheels (fronts steer, all spin),
 * lights and — for the cruiser — the lightbar with its glow planes.
 * Forward is +z, matching the heading convention (atan2(dx, dz)).
 * Returns the group; per-car materials ride in group.userData.
 */
export function makeCarMesh(typeKey, colorHex) {
  const def = CAR_TYPES[typeKey];
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const W = def.width, L = def.length;
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
  const addWheel = (x, z) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.34, z);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    pivot.add(tyre);
    grp.add(pivot);
    wheels.push(pivot);
    return pivot;
  };

  if (typeKey === 'truck') {
    box(bodyMat, W, 0.95, 1.7, 0, 0.85, L / 2 - 0.85, grp); // cab
    box(glassMat, W - 0.15, 0.55, 0.1, 0, 1.05, L / 2 - 0.12, grp); // windshield
    box(new THREE.MeshLambertMaterial({ color: 0xe8e4da }), W + 0.1, 2.0, L - 2.0, 0, 1.55, -0.9, grp); // cargo
    box(trimMat, W, 0.3, L, 0, 0.32, 0, grp); // chassis
    addWheel(-W / 2, L / 2 - 1.1); addWheel(W / 2, L / 2 - 1.1);
    addWheel(-W / 2, -L / 2 + 1.0); addWheel(W / 2, -L / 2 + 1.0);
  } else {
    const low = typeKey === 'sport';
    const bodyH = low ? 0.55 : 0.68;
    box(bodyMat, W, bodyH, L, 0, 0.32 + bodyH / 2, 0, grp); // hull
    box(trimMat, W + 0.04, 0.16, L - 0.4, 0, 0.38, 0, grp); // skirt line
    const cabin = box(glassMat, W - 0.35, low ? 0.42 : 0.52, L * 0.46, 0, 0.32 + bodyH + (low ? 0.2 : 0.25), low ? -0.25 : -0.1, grp);
    cabin.castShadow = true;
    if (typeKey === 'cruiser') {
      box(new THREE.MeshLambertMaterial({ color: 0x22345e }), W + 0.02, 0.3, L * 0.5, 0, 0.62, 0, grp); // navy band
      const bar = new THREE.Group();
      bar.position.set(0, 0.32 + bodyH + 0.52 + 0.07, -0.1);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.3), LIGHTBAR_RED);
      red.position.x = -0.3; bar.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.3), LIGHTBAR_BLUE);
      blue.position.x = 0.3; bar.add(blue);
      const glowR = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), GLOW_RED_MAT);
      glowR.position.set(-0.3, 0.05, 0); glowR.rotation.x = -Math.PI / 2; bar.add(glowR);
      const glowB = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), GLOW_BLUE_MAT);
      glowB.position.set(0.3, 0.05, 0); glowB.rotation.x = -Math.PI / 2; bar.add(glowB);
      grp.add(bar);
    }
    if (typeKey === 'taxi') {
      box(new THREE.MeshLambertMaterial({ color: 0xfff2cc }), 0.62, 0.16, 0.3, 0, 0.32 + bodyH + 0.52 + 0.06, -0.1, grp); // roof sign
    }
    if (low) {
      box(bodyMat, W - 0.2, 0.07, 0.4, 0, 0.98, -L / 2 + 0.25, grp); // spoiler
      box(trimMat, 0.08, 0.16, 0.3, -W / 2 + 0.25, 0.86, -L / 2 + 0.25, grp);
      box(trimMat, 0.08, 0.16, 0.3, W / 2 - 0.25, 0.86, -L / 2 + 0.25, grp);
    }
    addWheel(-W / 2, L / 2 - 0.95); addWheel(W / 2, L / 2 - 0.95);
    addWheel(-W / 2, -L / 2 + 0.95); addWheel(W / 2, -L / 2 + 0.95);
  }

  // Headlights and their dusk cones; tail lights on a per-car material
  // so the brake flare is one car's own.
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x8a1f18 });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), HEADLIGHT_MAT);
    hl.position.set(side * (W / 2 - 0.3), 0.72, L / 2 + 0.01);
    grp.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.06), tailMat);
    tl.position.set(side * (W / 2 - 0.3), 0.74, -L / 2 - 0.01);
    grp.add(tl);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6.5, 10, 1, true), HEADLIGHT_CONE_MAT);
    cone.position.set(side * (W / 2 - 0.3), 0.55, L / 2 + 3.1);
    cone.rotation.x = Math.PI / 2 + 0.1; // apex at the lamp, opening down the road
    grp.add(cone);
  }

  grp.userData = { wheels, frontWheels: [wheels[0], wheels[1]], bodyMat, tailMat };
  return grp;
}

/** Create a car record and its mesh, and put both in the world. */
export function createCar(typeKey, x, z, heading, colorHex, rng) {
  const def = CAR_TYPES[typeKey];
  const r = rng ?? fallbackRng;
  const color = colorHex ?? def.colors[Math.floor(r() * def.colors.length) % def.colors.length];
  const mesh = makeCarMesh(typeKey, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    id: nextCarId, type: typeKey, def, mesh,
    x, z, heading, speed: 0, colorHex: color,
    driver: 'parked', hp: 100, maxHp: 100, dead: false,
    burning: 0, flatTire: 0, brakeLight: false,
    engineLevel: 0, armorLevel: 0, anchored: false,
    tactic: null, tacticTimer: 0, stuckTimer: 0, honkAt: 0,
    cruise: 0, panicT: 0, route: null, smokeT: 0, steerVis: 0,
    bodyMat: mesh.userData.bodyMat, tailMat: mesh.userData.tailMat,
  };
  nextCarId += 1;
  return car;
}

/** Take a car out of the world entirely. */
export function removeCar(car) {
  if (car.mesh?.parent) car.mesh.parent.remove(car.mesh);
  car.dead = true;
}

/** Fill the city's marked kerb spots with parked cars. */
export function spawnParkedCars(rng) {
  const r = rng ?? fallbackRng;
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'sport', 'truck'];
  for (const spot of G.city?.parkingSpots ?? []) {
    if (r() > 0.5) continue;
    const car = createCar(types[Math.floor(r() * types.length)], spot.x, spot.z, spot.heading, null, r);
    car.driver = 'parked';
    G.parkedCars.push(car);
  }
}

/**
 * The arcade drive model: throttle feeds the engine against a soft
 * top-speed curve, steering bites harder the faster the car rolls,
 * walls answer through the city's colliders, and a hard arrival is
 * paid for in bodywork.
 */
export function driveCar(car, input, dt) {
  if (car.dead) { car.speed = 0; syncCarMesh(car, dt); return; }
  const def = car.def;
  const topSpeed = def.topSpeed * (1 + car.engineLevel * 0.1) * (car.flatTire > 0 ? 0.35 : 1);
  if (input.throttle > 0) {
    car.speed += def.accel * input.throttle * dt * Math.max(0.15, 1 - car.speed / (topSpeed * 1.25));
  } else if (input.throttle < 0) {
    car.speed += def.accel * 0.75 * input.throttle * dt;
    if (car.speed < -topSpeed * 0.32) car.speed = -topSpeed * 0.32;
  } else {
    car.speed -= car.speed * 0.55 * dt; // engine braking and drag
    if (Math.abs(car.speed) < 0.04) car.speed = 0;
  }
  if (input.handbrake) car.speed -= car.speed * 2.4 * dt;
  car.speed = clamp(car.speed, -topSpeed * 0.32, topSpeed);

  const bite = clamp(car.speed / 6, -1, 1);
  car.heading += input.steer * 1.8 * bite * dt * (input.handbrake ? 1.45 : 1);
  car.steerVis += ((input.steer * 0.45) - car.steerVis) * Math.min(1, dt * 8);

  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;

  // Walls: the hull's centre and nose against the building boxes.
  if (G.city) {
    const probeR = def.width / 2 + 0.1;
    for (const [px, pz] of [[car.x, car.z], [car.x + Math.sin(car.heading) * def.length * 0.32, car.z + Math.cos(car.heading) * def.length * 0.32]]) {
      for (const b of collidersNear(G.city, px, pz)) {
        const hit = collideCircleBox(px, pz, probeR, b);
        if (hit) {
          car.x += hit.x - px; car.z += hit.z - pz;
          if (Math.abs(car.speed) > 9) damageCar(car, (Math.abs(car.speed) - 8) * 1.1, false);
          car.speed *= -0.22;
          break;
        }
      }
    }
  }
  syncCarMesh(car, dt);
}

/**
 * One car against a crowd of hulls: an oriented-box push-out with a
 * speed exchange, so a chase ploughs through traffic instead of
 * ghosting through it — and a parked car does not move for anyone.
 */
export function collideCarWithCars(car, others, dt) {
  if (car.dead) return;
  for (const other of others) {
    if (other === car || other.dead) continue;
    const reach = (car.def.length + other.def.length) / 2 + 0.6;
    const dx = other.x - car.x, dz = other.z - car.z;
    if (dx * dx + dz * dz > reach * reach) continue;
    const hit = collideCircleOBB(car.x, car.z, car.def.width / 2 + 0.12, other.x, other.z, other.heading, other.def.width / 2, other.def.length / 2);
    if (!hit) continue;
    car.x = hit.x; car.z = hit.z;
    const closing = Math.abs(car.speed - other.speed);
    if (closing > 7) {
      const byPlayer = car.driver === 'player' || other.driver === 'player';
      damageCar(car, (closing - 6) * 1.05, byPlayer);
      damageCar(other, (closing - 6) * 0.8, byPlayer);
    }
    car.speed *= 0.45;
  }
}

/** The pairwise pass over a whole set (main.js hands it every car). */
export function collideCars(cars, dt) {
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const reach = (a.def.length + b.def.length) / 2 + 0.6;
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx * dx + dz * dz > reach * reach) continue;
      // Push the unanchored one (or split it) out of the other's hull.
      const mover = a.anchored && !b.anchored ? b : a;
      const anchor = mover === a ? b : a;
      const hit = collideCircleOBB(mover.x, mover.z, mover.def.width / 2 + 0.12, anchor.x, anchor.z, anchor.heading, anchor.def.width / 2, anchor.def.length / 2);
      if (hit) { mover.x = hit.x; mover.z = hit.z; mover.speed *= 0.5; }
    }
  }
}

/** Put the mesh where the record says, and run the damage theatre. */
export function syncCarMesh(car, dt = 0) {
  const mesh = car.mesh;
  if (!mesh) return;
  mesh.position.set(car.x, 0, car.z);
  mesh.rotation.y = car.heading;
  const u = mesh.userData;
  if (u.wheels) {
    const spin = car.speed * dt / 0.34;
    for (const w of u.wheels) w.children[0].rotation.x += spin;
    for (const w of u.frontWheels ?? []) w.rotation.y = car.steerVis ?? 0;
  }
  if (u.tailMat) u.tailMat.color.setHex(car.brakeLight ? 0xff4030 : 0x8a1f18);
  if (dt <= 0 || car.dead) return;

  // Smoke, then fire, then the end: the damage ladder made visible.
  car.smokeT -= dt;
  const noseX = car.x + Math.sin(car.heading) * car.def.length * 0.32;
  const noseZ = car.z + Math.cos(car.heading) * car.def.length * 0.32;
  if (car.hp < 55 && car.smokeT <= 0) {
    car.smokeT = car.hp < 26 ? 0.06 : 0.16;
    burstSmoke(noseX, 1.05, noseZ, 1, { color: car.hp < 26 ? 0x222222 : 0x555049, life: 1.6, rise: 1.25, power: 0.55 });
  }
  if (car.hp < 26) {
    car.burning += dt;
    if (car.smokeT <= 0.03) burst(noseX, 0.95, noseZ, 0xff7a2e, 2, 1.3, { life: 0.4, up: 1.5 });
    if (car.burning > 3.2) damageCar(car, 500, false);
  }
}

/**
 * Hurt a car. Armour plating soaks its share; at zero the car dies in
 * an explosion and stays in the street as a blackened hull.
 */
export function damageCar(car, amount, byPlayerAction = false) {
  if (car.dead) return;
  car.hp -= amount / (1 + car.armorLevel * 0.35);
  if (car.hp <= 0) {
    car.hp = 0;
    car.dead = true;
    car.speed = 0;
    if (car.bodyMat) car.bodyMat.color.setHex(0x2a2a2e);
    explodeAt(car.x, car.z, 7, car);
  }
}

/** Alternate the cruiser glow planes; strength fades them at day. */
export function flashLightbars(phase, strength = 1) {
  GLOW_RED_MAT.opacity = phase ? 0.5 * strength : 0;
  GLOW_BLUE_MAT.opacity = phase ? 0 : 0.5 * strength;
}

/** The closest hull in a list to a point (Infinity when the list is empty). */
export function nearestCarDistance(cars, x, z) {
  let best = Infinity;
  for (const car of cars) {
    if (car.dead) continue;
    const d = dist2d(car.x, car.z, x, z);
    if (d < best) best = d;
  }
  return best;
}
