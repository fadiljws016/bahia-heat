// vehicles.js — every car in Puerto Alba: the five nameplates, their
// modelled bodies (glasshouse, roof panel, mirrors, grille, bumpers),
// the arcade drive model, car-on-car and car-on-city collision, and
// the damage ladder that ends in fire and a blast the world feels.
// Round seventeen rebuilds the fleet on the locked spec sheet — the
// dimensions and colours below are the ones the staged frames were
// composed around.
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

export const HEADLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0x8a8578 });
export const LIGHTBAR_RED = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
export const LIGHTBAR_BLUE = new THREE.MeshBasicMaterial({ color: 0x2255aa });
export const HEADLIGHT_CONE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffe9a3, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
});
export const GLOW_RED_MAT = new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0, depthWrite: false });
export const GLOW_BLUE_MAT = new THREE.MeshBasicMaterial({ color: 0x2a7fff, transparent: true, opacity: 0, depthWrite: false });

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17191d });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x1d2b36, shininess: 90, specular: 0x99ccee });
const trimMat = new THREE.MeshLambertMaterial({ color: 0x24262a });

function addBox(group, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
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
  addBox(group, trimMat, t.width * 0.7, 0.16, 0.06, 0, 0.52, t.length / 2 + 0.01); // grille
  addBox(group, trimMat, t.width * 0.92, 0.14, 0.18, 0, 0.3, t.length / 2 + 0.04); // front bumper
  addBox(group, trimMat, t.width * 0.92, 0.14, 0.18, 0, 0.3, -t.length / 2 - 0.04); // rear bumper
  // Headlights and their dusk cones.
  for (const sx of [-1, 1]) {
    addBox(group, HEADLIGHT_MAT, 0.3, 0.12, 0.05, sx * t.width * 0.32, 0.62, t.length / 2 + 0.02);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 5.5, 10, 1, true), HEADLIGHT_CONE_MAT);
    cone.rotation.x = Math.PI / 2 + 0.1;
    cone.position.set(sx * t.width * 0.32, 0.55, t.length / 2 + 2.7);
    group.add(cone);
  }
  // Brake strip (its own material: braking cars light it).
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x5a130d });
  addBox(group, brakeMat, t.width * 0.7, 0.09, 0.05, 0, 0.66, -t.length / 2 - 0.02);
  // Wheels.
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(sx * (t.width / 2 - 0.02), 0.36, sz * (t.length / 2 - 0.78));
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  if (typeKey === 'cruiser') {
    addBox(group, LIGHTBAR_RED, 0.42, 0.13, 0.5, -0.24, 0.36 + t.height + t.cabinH + 0.1, -t.length * 0.04);
    addBox(group, LIGHTBAR_BLUE, 0.42, 0.13, 0.5, 0.24, 0.36 + t.height + t.cabinH + 0.1, -t.length * 0.04);
    const glowR = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), GLOW_RED_MAT);
    glowR.position.set(-0.5, 1.45, -t.length * 0.04);
    group.add(glowR);
    const glowB = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), GLOW_BLUE_MAT);
    glowB.position.set(0.5, 1.45, -t.length * 0.04);
    group.add(glowB);
    addBox(group, trimMat, t.width * 0.99, 0.3, t.length * 0.5, 0, 0.45, 0); // the PAPD flank band
  }
  if (typeKey === 'taxi') {
    addBox(group, new THREE.MeshBasicMaterial({ color: 0xffe9a3 }), 0.5, 0.14, 0.3, 0, 0.36 + t.height + t.cabinH + 0.1, -t.length * 0.04);
  }
  if (typeKey === 'truck') {
    addBox(group, bodyMat, t.width, 1.5, t.length * 0.52, 0, 0.36 + 0.75 + 0.45, -t.length * 0.22);
  }
  group.userData = { bodyMat, brakeMat, wheels };
  return group;
}

let unitCounter = 0;

/** Create a car record and its mesh, placed and added to the scene. */
export function createCar(typeKey, x, z, heading, colorHex, rng) {
  const def = CAR_TYPES[typeKey] ?? CAR_TYPES.sedan;
  const color = colorHex ?? def.colors[Math.floor((rng ? rng() : Math.random()) * def.colors.length) % def.colors.length];
  const mesh = makeCarMesh(typeKey, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  return {
    type: typeKey, def, mesh, color,
    x, z, heading, speed: 0, steer: 0,
    hp: def.hp, maxHp: def.hp, driver: 'parked',
    dead: false, burning: 0, flatTire: 0,
    engineLevel: 0, armorLevel: 0, anchored: false, brakeLight: false,
    tactic: null, route: null, id: 800 + (unitCounter++ % 90),
  };
}

/** Remove a car from the scene and every fleet list that holds it. */
export function removeCar(car) {
  if (car.mesh?.parent) car.mesh.parent.remove(car.mesh);
  car.dead = true;
  for (const list of [G.trafficCars, G.policeCars, G.parkedCars]) {
    const i = list.indexOf(car);
    if (i >= 0) list.splice(i, 1);
  }
}

/** Fill the city's surveyed kerb spots with parked cars. */
export function spawnParkedCars(rng) {
  const spots = G.city?.parking ?? [];
  const types = ['sedan', 'sedan', 'sport', 'taxi', 'truck'];
  const stride = Math.max(1, Math.floor(spots.length / 60));
  for (let i = 0; i < spots.length; i += stride) {
    const s = spots[i];
    if (dist2d(s.x, s.z, G.player.x, G.player.z) < 12) continue;
    const type = types[Math.floor(rng() * types.length) % types.length];
    const car = createCar(type, s.x, s.z, s.heading, null, rng);
    car.driver = 'parked';
    G.parkedCars.push(car);
  }
}

/** Put the mesh where the record says, with its damage showing. */
export function syncCarMesh(car, dt = 0) {
  if (!car.mesh) return;
  car.mesh.position.set(car.x, car.dead ? -0.06 : 0, car.z);
  car.mesh.rotation.set(car.dead ? 0.04 : 0, car.heading, car.dead ? 0.05 : 0);
  const { brakeMat, wheels } = car.mesh.userData;
  if (brakeMat) brakeMat.color.setHex(car.brakeLight ? 0xff2a1e : 0x5a130d);
  if (wheels && dt > 0) {
    const spin = (car.speed * dt) / 0.36;
    for (const w of wheels) w.rotation.x += spin;
  }
  if (car.burning && dt > 0 && Math.random() < dt * 9) {
    burstSmoke(car.x, 1.2, car.z, 1, { color: 0x1d1d1d, life: 1.6, rise: 1.4, power: 0.7 });
    if (Math.random() < dt * 5) burst(car.x, 1.0, car.z, 0xff7a2e, 2, 1.4, { life: 0.4, up: 1.6 });
  }
}

/**
 * The arcade drive model: throttle, steer and handbrake in; position,
 * heading and speed out. Cars lean on the city's colliders and stay
 * inside the bounds; a dead car only rolls to a stop.
 */
export function driveCar(car, input, dt) {
  if (dt <= 0) { syncCarMesh(car, 0); return; }
  const def = car.def;
  if (car.dead || car.anchored) {
    car.speed *= Math.max(0, 1 - 2.2 * dt);
  } else {
    const top = def.topSpeed * (1 + 0.12 * (car.engineLevel ?? 0)) * (car.flatTire > 0 ? 0.55 : 1);
    const throttle = clamp(input.throttle ?? 0, -1, 1);
    if (throttle >= 0) car.speed += throttle * def.accel * dt;
    else car.speed += throttle * def.accel * 0.7 * dt;
    car.speed -= car.speed * 0.55 * dt; // drag and rolling resistance
    if (input.handbrake) car.speed -= car.speed * 3.2 * dt;
    car.speed = clamp(car.speed, -top * 0.35, top);
    const steer = clamp(input.steer ?? 0, -1, 1);
    car.steer = steer;
    const grip = def.grip * clamp(car.speed / 14, -1.15, 1.15);
    car.heading = wrapAngle(car.heading + steer * grip * dt * 0.62);
    if (car.flatTire > 0) car.heading += Math.sin(G.elapsed * 9 + car.id) * 0.12 * dt;
  }
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // Buildings push back: a car is a circle to the city's boxes.
  for (const box of collidersNear(G.city, car.x, car.z)) {
    const hit = collideCircleBox(car.x, car.z, 1.15, box);
    if (hit) {
      if (Math.abs(car.speed) > 9) { damageCar(car, Math.abs(car.speed) * 0.5, false); sfx.crash(); }
      car.x = hit.x; car.z = hit.z;
      car.speed *= -0.25;
    }
  }
  car.x = clamp(car.x, -250, 290);
  car.z = clamp(car.z, -306, 306);
  syncCarMesh(car, dt);
}

/** Push one car out of every other car's body, trading speed. */
export function collideCarWithCars(car, others, dt) {
  if (car.dead) return;
  for (const other of others) {
    if (other === car || other.dead) continue;
    const hit = collideCircleOBB(car.x, car.z, 1.05, other.x, other.z, other.heading, other.def.width / 2 + 0.15, other.def.length / 2);
    if (hit) {
      car.x = hit.x; car.z = hit.z;
      const closing = Math.abs(car.speed - other.speed);
      if (closing > 7) { damageCar(car, closing * 0.4, false); sfx.crash(); }
      car.speed = other.speed * 0.7 + car.speed * 0.2;
    }
  }
  syncCarMesh(car, dt);
}

/** Every pair in the fleet, once each. */
export function collideCars(cars, dt) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      if (a.dead || b.dead) continue;
      if (Math.abs(a.x - b.x) > 6 || Math.abs(a.z - b.z) > 6) continue;
      collideCarWithCars(a, [b], 0);
      collideCarWithCars(b, [a], 0);
    }
  }
}

/**
 * The damage ladder: panels crumple (hp), then it burns, then it
 * blows — and the blast goes on the queue for main.js to hand out.
 */
export function damageCar(car, amount, byPlayerAction = false) {
  if (car.dead) return;
  car.hp -= amount / (1 + 0.3 * (car.armorLevel ?? 0));
  if (car.hp <= 30 && !car.burning) car.burning = 1;
  if (car.hp <= 0) {
    car.dead = true;
    car.speed = 0;
    explodeAt(car.x, car.z, 7, car);
    G.blastQueue.push({ x: car.x, z: car.z, radius: 7, power: 5, sourceCar: car });
    const bodyMat = car.mesh?.userData?.bodyMat;
    if (bodyMat) bodyMat.color.setHex(0x17181c);
    sfx.boom();
  }
  syncCarMesh(car, 0);
}

/** Alternate the cruiser lightbar colours and their glow planes. */
export function flashLightbars(phase, strength = 1) {
  LIGHTBAR_RED.color.setHex(phase ? 0xff2a1e : 0x7a130c);
  LIGHTBAR_BLUE.color.setHex(phase ? 0x1d3f7a : 0x2a7fff);
  GLOW_RED_MAT.opacity = (phase ? 0.5 : 0.08) * strength;
  GLOW_BLUE_MAT.opacity = (phase ? 0.08 : 0.5) * strength;
}

/** Distance to the nearest car in a set (Infinity when empty). */
export function nearestCarDistance(cars, x, z) {
  let best = Infinity;
  for (const car of cars) {
    if (car.dead) continue;
    best = Math.min(best, dist2d(car.x, car.z, x, z));
  }
  return best;
}
