// vehicles.js — the cars of Puerto Alba: low-poly box-built models in
// five flavours, with grilles, bumpers, mirrors, spoilers and light
// cones after dark. The paint palette sits inside the filmic grade —
// hotter reds, a truer racing yellow, a cyan that pops at dusk — and
// the glass is sharp so cabins catch the light. An arcade driving model
// (throttle, steering that bites with speed, handbrake slides),
// building collision, car-to-car collision, and a damage model that
// runs dented → smoking → burning → wreck. Brake lights are per-car,
// so a queue of traffic reads as traffic. Cars are solid in every
// direction of travel: collideCarWithCars answers for the driven car
// exactly the way a building does, and player.js keeps the walking
// runner out of their footprints — nobody ghosts through a fender.
import { G } from './state.js';
import { clamp, wrapAngle, collideCircleBox, collideCircleOBB, dist2d } from './util.js';
import { collidersNear } from './city.js';
import { burst, burstSmoke, explodeAt } from './effects.js';
import { sfx } from './audio.js';

export const CAR_TYPES = {
  sedan: { name: 'Alba Sedan', length: 4.4, width: 1.9, height: 0.62, cabinH: 0.55, topSpeed: 38, accel: 15, grip: 3.4, hp: 100, colors: [0xe0482e, 0x2478cc, 0xe8e3d5, 0x2aa864, 0xf5a623, 0x8a4fd0, 0x30363e] },
  sport: { name: 'Fuego GT', length: 4.2, width: 1.95, height: 0.5, cabinH: 0.42, topSpeed: 54, accel: 22, grip: 4.2, hp: 90, colors: [0xffcf3f, 0xff4438, 0x3ecfe8, 0xf2f2f2, 0x23272e] },
  taxi: { name: 'Taxi Alba', length: 4.4, width: 1.9, height: 0.62, cabinH: 0.58, topSpeed: 36, accel: 14, grip: 3.4, hp: 110, colors: [0xffb340] },
  truck: { name: 'Mulo Truck', length: 5.8, width: 2.2, height: 0.9, cabinH: 0.8, topSpeed: 30, accel: 10, grip: 2.8, hp: 170, colors: [0xb08954, 0x7a8a99, 0x54804e, 0xd84a30] },
  cruiser: { name: 'PAPD Interceptor', length: 4.6, width: 1.95, height: 0.6, cabinH: 0.55, topSpeed: 48, accel: 19, grip: 4.0, hp: 150, colors: [0xf2f2f2] },
};

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17191d });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a2e42, shininess: 110, specular: 0xaad4f0 });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0x9aa2a8 });
export const HEADLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0x8a8578 });
const TAIL_BASE = 0x7a1d16, TAIL_BRAKE = 0xff2a1e;
export const LIGHTBAR_RED = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
export const LIGHTBAR_BLUE = new THREE.MeshBasicMaterial({ color: 0x2255aa });
// The light pool a headlight throws on the road after dark (shared material,
// one opacity for the whole city, driven by world.js through main.js).
const coneGeo = new THREE.ConeGeometry(2.4, 9.5, 12, 1, true);
coneGeo.rotateX(-Math.PI / 2);
coneGeo.translate(0, 0, 4.75);
export const HEADLIGHT_CONE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
  depthWrite: false, side: THREE.DoubleSide, fog: false,
});
// The coloured wash a cruiser's lightbar throws on the asphalt.
export const GLOW_RED_MAT = new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0, depthWrite: false });
export const GLOW_BLUE_MAT = new THREE.MeshBasicMaterial({ color: 0x2a7fff, transparent: true, opacity: 0, depthWrite: false });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

let carSeq = 0;

function addBox(group, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

/** Build the three.js model for a car type. The body material is unique per car so wrecks can burn black. */
export function makeCarMesh(typeKey, colorHex) {
  const t = CAR_TYPES[typeKey];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = addBox(group, bodyMat, t.width, t.height, t.length, 0, 0.36 + t.height / 2, 0);
  body.castShadow = true;

  const cabin = addBox(group, glassMat, t.width * 0.82, t.cabinH, t.length * 0.46, 0, 0.36 + t.height + t.cabinH / 2 - 0.04, -t.length * 0.04);
  cabin.castShadow = true;
  // Roof panel in body colour over the glasshouse, mirrors, grille, bumpers.
  addBox(group, bodyMat, t.width * 0.8, 0.07, t.length * 0.4, 0, 0.36 + t.height + t.cabinH + 0.02, -t.length * 0.04);
  for (const sx of [-1, 1]) {
    addBox(group, bodyMat, 0.16, 0.09, 0.22, sx * (t.width / 2 + 0.07), 0.36 + t.height + 0.18, t.length * 0.12);
  }
  addBox(group, chromeMat, t.width * 0.62, 0.16, 0.08, 0, 0.62, t.length / 2 + 0.02);
  addBox(group, chromeMat, t.width + 0.06, 0.2, 0.14, 0, 0.42, t.length / 2 + 0.03);
  addBox(group, chromeMat, t.width + 0.06, 0.2, 0.14, 0, 0.42, -t.length / 2 - 0.03);

  if (typeKey === 'sport') {
    addBox(group, bodyMat, t.width * 0.92, 0.07, 0.34, 0, 0.36 + t.height + 0.22, -t.length / 2 + 0.1);
    for (const sx of [-1, 1]) addBox(group, bodyMat, 0.09, 0.2, 0.09, sx * t.width * 0.36, 0.36 + t.height + 0.08, -t.length / 2 + 0.1);
  }
  if (typeKey === 'truck') {
    const bed = addBox(group, new THREE.MeshLambertMaterial({ color: 0x6b6f75 }), t.width * 0.94, 0.5, t.length * 0.42, 0, 0.36 + t.height + 0.1, t.length * 0.27);
    bed.castShadow = true;
    addBox(group, bodyMat, t.width * 0.96, 0.1, t.length * 0.44, 0, 0.36 + t.height + 0.4, t.length * 0.27);
  }
  if (typeKey === 'taxi') {
    addBox(group, new THREE.MeshBasicMaterial({ color: 0xffe9a3 }), 0.7, 0.18, 0.34, 0, 0.36 + t.height + t.cabinH + 0.12, -t.length * 0.04);
    addBox(group, new THREE.MeshLambertMaterial({ color: 0x22242a }), t.width + 0.02, 0.22, t.length * 0.98, 0, 0.5, 0);
  }
  if (typeKey === 'cruiser') {
    addBox(group, new THREE.MeshLambertMaterial({ color: 0x1d3a5f }), t.width + 0.02, 0.3, t.length * 0.98, 0, 0.62, 0);
    addBox(group, chromeMat, t.width * 0.8, 0.24, 0.12, 0, 0.44, t.length / 2 + 0.1); // push bar
    const barR = addBox(group, LIGHTBAR_RED, 0.55, 0.16, 0.4, -0.32, 0.36 + t.height + t.cabinH + 0.1, -t.length * 0.04);
    const barB = addBox(group, LIGHTBAR_BLUE, 0.55, 0.16, 0.4, 0.32, 0.36 + t.height + t.cabinH + 0.1, -t.length * 0.04);
    barR.castShadow = false; barB.castShadow = false;
    // Asphalt glow halves under the car, flashed by police.js.
    const glowGeo = new THREE.PlaneGeometry(1.75, 5.4);
    const glowR = new THREE.Mesh(glowGeo, GLOW_RED_MAT);
    glowR.rotation.x = -Math.PI / 2; glowR.position.set(-0.88, 0.07, 0);
    const glowB = new THREE.Mesh(glowGeo, GLOW_BLUE_MAT);
    glowB.rotation.x = -Math.PI / 2; glowB.position.set(0.88, 0.07, 0);
    group.add(glowR); group.add(glowB);
  }

  const wheels = [];
  const wx = t.width / 2 - 0.05, wz = t.length / 2 - 0.85;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(sx * wx, 0.36, sz * wz);
    group.add(w);
    wheels.push(w);
  }
  // Headlights and taillights; the tails are per-car so braking shows.
  const tailMat = new THREE.MeshBasicMaterial({ color: TAIL_BASE });
  for (const sx of [-1, 1]) {
    addBox(group, HEADLIGHT_MAT, 0.34, 0.14, 0.06, sx * t.width * 0.32, 0.72, t.length / 2 + 0.01);
    addBox(group, tailMat, 0.34, 0.12, 0.06, sx * t.width * 0.32, 0.76, -t.length / 2 - 0.01);
  }
  // The headlight cone, apex at the lamps, widening down the road.
  const cone = new THREE.Mesh(coneGeo, HEADLIGHT_CONE_MAT);
  cone.position.set(0, 0.62, t.length / 2 - 0.3);
  cone.rotation.x = 0.055;
  group.add(cone);

  group.userData = { wheels, bodyMat, bodyBaseColor: colorHex, tailMat };
  return group;
}

/** Create a car record + mesh and add it to the scene. */
export function createCar(typeKey, x, z, heading, colorHex, rng) {
  const t = CAR_TYPES[typeKey];
  const color = colorHex ?? t.colors[Math.floor((rng ? rng() : Math.random()) * t.colors.length)];
  const mesh = makeCarMesh(typeKey, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    id: (carSeq += 1), type: typeKey, def: t, mesh,
    x, z, heading, speed: 0, steerVis: 0,
    hp: t.hp, maxHp: t.hp, dead: false, burning: 0, smokeAcc: 0,
    driver: 'parked', // parked | traffic | police | player | target | rival
    route: null, stuckTimer: 0, honkAt: 0, brakeLight: false,
    engineLevel: 0, armorLevel: 0, flatTire: 0,
    colorHex: color,
  };
  mesh.userData.car = car;
  return car;
}

export function removeCar(car) {
  if (car.mesh.parent) car.mesh.parent.remove(car.mesh);
  car.dead = true;
}

/** Spawn the parked cars of the city (stealable) from the layout's parking spots. */
export function spawnParkedCars(rng) {
  const types = ['sedan', 'sedan', 'sport', 'taxi', 'truck'];
  for (const spot of G.city.parkingSpots) {
    if (rng() < 0.1) continue;
    const type = types[Math.floor(rng() * types.length)];
    const car = createCar(type, spot.x, spot.z, spot.heading, null, rng);
    G.parkedCars.push(car);
  }
}

/**
 * The arcade driving model. input: { throttle -1..1, steer -1..1, handbrake }.
 * Mutates car.speed/heading, then integrates and resolves collisions.
 */
export function driveCar(car, input, dt) {
  if (car.dead) return;
  const t = car.def;
  car.brakeLight = input.throttle < -0.05 || !!input.handbrake;
  const engineMul = 1 + car.engineLevel * 0.12;
  const topSpeed = t.topSpeed * engineMul * (car.flatTire > 0 ? 0.45 : 1);
  const topReverse = 11;

  if (input.throttle > 0) car.speed += t.accel * engineMul * input.throttle * dt;
  else if (input.throttle < 0) {
    if (car.speed > 0.5) car.speed -= 30 * dt; // brake
    else car.speed += t.accel * 0.6 * input.throttle * dt; // reverse
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.35 * dt;
  if (input.handbrake) car.speed -= car.speed * 1.6 * dt;
  car.speed = clamp(car.speed, -topReverse, topSpeed);
  if (Math.abs(car.speed) < 0.12 && input.throttle === 0) car.speed = 0;

  // Steering: more authority at low speed, less at the top end; slides on handbrake.
  const steerAuthority = clamp(Math.abs(car.speed) / 6, 0, 1) * (1 - clamp(Math.abs(car.speed) / (topSpeed * 1.6), 0, 0.45));
  const turnRate = input.steer * t.grip * 0.62 * steerAuthority * (input.handbrake ? 1.5 : 1);
  car.heading += turnRate * dt * (car.speed < 0 ? -1 : 1);
  car.steerVis = input.steer;

  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;

  // Building collision: two circles, nose and tail.
  const impact = collideCarWithWorld(car, nx, nz);
  if (impact) {
    const impactSpeed = Math.abs(car.speed);
    if (impactSpeed > 7) {
      damageCar(car, (impactSpeed - 6) * 1.6, true);
      sfx.crash(impactSpeed > 16);
      G.cameraShake = Math.min(0.7, G.cameraShake + impactSpeed * 0.012);
      burst(car.x + fx * 2, 0.8, car.z + fz * 2, 0xffcf5e, 9, 2.6);
      burstSmoke(car.x + fx * 2, 0.7, car.z + fz * 2, 3, { color: 0xbfae90, life: 0.9, rise: 0.45 });
    }
    car.speed *= -0.18;
    nx = car.x; nz = car.z;
  }
  car.x = clamp(nx, -250, 290);
  car.z = clamp(nz, -306, 306);

  syncCarMesh(car, dt);
  updateCarDamageFx(car, dt);
}

function collideCarWithWorld(car, nx, nz) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const half = car.def.length / 2 - 0.5;
  const boxes = collidersNear(G.city, nx, nz);
  for (const [ox, oz] of [[fx * half, fz * half], [-fx * half, -fz * half]]) {
    for (const box of boxes) {
      const hit = collideCircleBox(nx + ox, nz + oz, 1.05, box);
      if (hit) return true;
    }
  }
  return false;
}

/**
 * One car against the rest, treated as solid: the player's car (the
 * caller passes it with the sets it must not ghost through). Two
 * circles, nose and tail, against each nearby car's oriented footprint;
 * on contact the moving car is pushed back out and answers exactly as
 * it does for a building — a bounce, and damage, sparks and a crash
 * past 7 m/s. The other cars are never shoved: a parked car stays
 * parked, a cruiser keeps its line. Added by the glitch-fix pass —
 * before it, the driven car had no collision with other cars at all
 * and drove straight through them.
 */
export function collideCarWithCars(car, others, dt) {
  if (car.dead) return false;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const half = car.def.length / 2 - 0.5;
  let impact = 0;
  for (const other of others) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const reach = half + other.def.length / 2 + 1.7;
    if (dx * dx + dz * dz > reach * reach) continue;
    for (const [ox, oz] of [[fx * half, fz * half], [-fx * half, -fz * half]]) {
      const hit = collideCircleOBB(car.x + ox, car.z + oz, 1.0, other.x, other.z, other.heading, other.def.width / 2, other.def.length / 2);
      if (hit) {
        car.x += hit.x - (car.x + ox);
        car.z += hit.z - (car.z + oz);
        impact = Math.max(impact, Math.abs(car.speed));
      }
    }
  }
  if (impact > 0) {
    if (impact > 7) {
      damageCar(car, (impact - 6) * 1.6, true);
      sfx.crash(impact > 16);
      G.cameraShake = Math.min(0.7, G.cameraShake + impact * 0.012);
      burst(car.x + fx * 2, 0.8, car.z + fz * 2, 0xffcf5e, 9, 2.6);
      burstSmoke(car.x + fx * 2, 0.7, car.z + fz * 2, 3, { color: 0xbfae90, life: 0.9, rise: 0.45 });
    }
    car.speed *= -0.18;
    syncCarMesh(car, dt);
  }
  return impact > 0;
}

/** Car-to-car: soft push apart plus damage on hard contact. Call once per frame for the active set. */
export function collideCars(cars, dt) {
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const d = dist2d(a.x, a.z, b.x, b.z);
      const minD = (a.def.length + b.def.length) / 2 * 0.72;
      if (d > minD || d === 0) continue;
      const push = (minD - d) / 2;
      const ux = (b.x - a.x) / d, uz = (b.z - a.z) / d;
      const relSpeed = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
      if (b.driver !== 'parked' || Math.abs(a.speed) > 2) { b.x += ux * push; b.z += uz * push; syncCarMesh(b, dt); }
      if (a.driver !== 'parked' || Math.abs(b.speed) > 2) { a.x -= ux * push; a.z -= uz * push; }
      if (relSpeed > 6) {
        damageCar(a, relSpeed * 0.7, false);
        damageCar(b, relSpeed * 0.7, false);
        sfx.crash(relSpeed > 14);
        burst((a.x + b.x) / 2, 0.8, (a.z + b.z) / 2, 0xffe1a6, 8, 2.2);
        if (a.driver === 'player' || b.driver === 'player') G.cameraShake = Math.min(0.6, G.cameraShake + 0.2);
      }
      const swap = (a.speed + b.speed) / 2;
      if (a.driver !== 'parked') a.speed = swap * 0.7;
      if (b.driver !== 'parked') b.speed = swap * 0.7;
    }
  }
}

export function syncCarMesh(car, dt = 0) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const { wheels, tailMat } = car.mesh.userData;
  if (tailMat) tailMat.color.setHex(car.brakeLight ? TAIL_BRAKE : TAIL_BASE);
  if (wheels) {
    const spin = car.speed * 0.28;
    for (let i = 0; i < wheels.length; i += 1) {
      wheels[i].rotation.x += spin * Math.max(dt, 0.016);
      if (i >= 2) wheels[i].rotation.y = -car.steerVis * 0.42;
    }
  }
  // Body roll/pitch flavour.
  car.mesh.rotation.z = -car.steerVis * clamp(Math.abs(car.speed) / 40, 0, 1) * 0.045;
  car.mesh.rotation.x = clamp(car.speed * 0.0012, -0.02, 0.03);
}

/** Apply damage; handles the burning → explosion → wreck chain. */
export function damageCar(car, amount, byPlayerAction = false) {
  if (car.dead) return;
  const armorMul = 1 - car.armorLevel * 0.15;
  car.hp -= amount * armorMul;
  if (car.hp <= 0 && car.burning <= 0) {
    car.burning = 1.5; // seconds of fire before it goes up — short, so a dense fight resolves a beat quicker
    if (byPlayerAction && car.driver === 'police') G.policeAggro = true;
  }
}

function updateCarDamageFx(car, dt) {
  const ratio = car.hp / car.maxHp;
  if (car.burning > 0) {
    car.burning -= dt;
    burst(car.x, 1.2, car.z, 0xff7a2e, 4, 1.7);
    burst(car.x, 1.5, car.z, 0xffc37a, 2, 1.2, { life: 0.35, up: 1.3 });
    burstSmoke(car.x, 1.6, car.z, 2, { color: 0x2e2e2e, life: 1.8, rise: 1.6, power: 0.8 });
    if (car.burning <= 0) {
      car.dead = true;
      car.speed = 0;
      explodeAt(car.x, car.z, 7, car);
      const { bodyMat } = car.mesh.userData;
      bodyMat.color.setHex(0x17181c);
      car.mesh.rotation.z = 0.06;
      // explodeAt itself queues the blast for main.js to drain.
    }
    return;
  }
  if (ratio < 0.45 && !car.dead) {
    car.smokeAcc += dt;
    if (car.smokeAcc > 0.11) {
      car.smokeAcc = 0;
      // A soft grey column, darker as the car gets closer to death.
      burstSmoke(car.x, 1.15, car.z, 1, {
        color: ratio < 0.22 ? 0x2c2c2c : 0x8f8f8f, life: 1.5, rise: 1.0, power: 0.35,
      });
    }
  }
}

/** Flash the cruiser lightbars and their asphalt wash (police.js phases it). */
export function flashLightbars(phase, strength = 1) {
  LIGHTBAR_RED.color.setHex(phase ? 0xff2a1e : 0x551512);
  LIGHTBAR_BLUE.color.setHex(phase ? 0x2255aa : 0x2a7fff);
  GLOW_RED_MAT.opacity = (phase ? 0.22 : 0.03) * strength;
  GLOW_BLUE_MAT.opacity = (phase ? 0.03 : 0.22) * strength;
}

/** Distance from a point to the nearest of a list of cars. */
export function nearestCarDistance(cars, x, z) {
  let best = Infinity;
  for (const c of cars) { const d = dist2d(c.x, c.z, x, z); if (d < best) best = d; }
  return best;
}
