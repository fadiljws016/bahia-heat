// vehicles.js — Puerto Alba traffic: five car types built from boxes and
// cylinders, a simple arcade drive model, OBB collision between cars and
// a damage ladder that ends in fire. The type table is locked — names,
// dimensions and performance are part of the game's identity.

import { G } from './state.js';
import { collideCircleOBB, clamp, dist2d } from './util.js';
import { burst, burstSmoke, explodeAt } from './effects.js';

export const CAR_TYPES = {
  sedan: { name: 'Alba Sedan', L: 4.4, W: 1.9, H: 0.62, cabinH: 0.55, topSpeed: 38, accel: 15, grip: 3.4, hp: 100, colors: [0xe0482e, 0x2478cc, 0xe8e3d5, 0x2aa864, 0xf5a623, 0x8a4fd0, 0x30363e] },
  sport: { name: 'Fuego GT', L: 4.2, W: 1.95, H: 0.5, cabinH: 0.42, topSpeed: 54, accel: 22, grip: 4.2, hp: 90, colors: [0xffcf3f, 0xff4438, 0x3ecfe8, 0xf2f2f2, 0x23272e] },
  taxi: { name: 'Taxi Alba', L: 4.4, W: 1.9, H: 0.62, cabinH: 0.58, topSpeed: 36, accel: 14, grip: 3.4, hp: 110, colors: [0xffb340] },
  truck: { name: 'Mulo Truck', L: 5.8, W: 2.2, H: 0.9, cabinH: 0.8, topSpeed: 30, accel: 10, grip: 2.8, hp: 170, colors: [0xb08954, 0x7a8a99, 0x54804e, 0xd84a30] },
  cruiser: { name: 'PAPD Interceptor', L: 4.6, W: 1.95, H: 0.6, cabinH: 0.55, topSpeed: 48, accel: 19, grip: 4.0, hp: 150, colors: [0xf2f2f2] },
};

export const HEADLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0x8a8578 });
export const LIGHTBAR_RED = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
export const LIGHTBAR_BLUE = new THREE.MeshBasicMaterial({ color: 0x2255aa });
export const HEADLIGHT_CONE_MAT = new THREE.MeshBasicMaterial({
  color: 0xfff2c0, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide,
});
export const GLOW_RED_MAT = new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0, depthWrite: false });
export const GLOW_BLUE_MAT = new THREE.MeshBasicMaterial({ color: 0x2a7fff, transparent: true, opacity: 0, depthWrite: false });

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17191d });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x1c2a36, shininess: 80, specular: 0x88aacc });

function part(parent, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function makeCarMesh(typeKey, colorHex) {
  const t = CAR_TYPES[typeKey];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = part(g, bodyMat, t.W, t.H, t.L, 0, 0.36 + t.H / 2, 0);
  body.castShadow = true;
  const cabin = part(g, glassMat, t.W * 0.82, t.cabinH, t.L * 0.46, 0, 0.36 + t.H + t.cabinH / 2 - 0.04, -t.L * 0.04);
  cabin.castShadow = true;
  part(g, bodyMat, t.W * 0.8, 0.07, t.L * 0.4, 0, 0.36 + t.H + t.cabinH + 0.0, -t.L * 0.04); // roof panel
  // Bumpers, grille, mirrors.
  part(g, bodyMat, t.W * 0.96, 0.16, 0.24, 0, 0.42, t.L / 2 + 0.04);
  part(g, bodyMat, t.W * 0.96, 0.16, 0.24, 0, 0.42, -t.L / 2 - 0.04);
  part(g, new THREE.MeshLambertMaterial({ color: 0x22262c }), t.W * 0.6, 0.14, 0.06, 0, 0.52, t.L / 2 + 0.15);
  part(g, bodyMat, 0.2, 0.07, 0.12, t.W / 2 + 0.06, 0.36 + t.H + 0.12, t.L * 0.16);
  part(g, bodyMat, 0.2, 0.07, 0.12, -t.W / 2 - 0.06, 0.36 + t.H + 0.12, t.L * 0.16);
  // Headlights + tail lights.
  part(g, HEADLIGHT_MAT, 0.34, 0.1, 0.05, t.W * 0.3, 0.55, t.L / 2 + 0.13);
  part(g, HEADLIGHT_MAT, 0.34, 0.1, 0.05, -t.W * 0.3, 0.55, t.L / 2 + 0.13);
  part(g, LIGHTBAR_RED, 0.34, 0.08, 0.05, t.W * 0.3, 0.55, -t.L / 2 - 0.13).visible = false;
  // Wheels.
  const wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx * (t.W / 2 - 0.05), 0.36, wz * (t.L / 2 - 0.85));
    g.add(w);
    wheels.push(w);
  }
  let lightbar = null;
  if (typeKey === 'cruiser') {
    lightbar = new THREE.Group();
    const red = part(lightbar, LIGHTBAR_RED, 0.55, 0.12, 0.3, -0.3, 0, 0);
    const blue = part(lightbar, LIGHTBAR_BLUE, 0.55, 0.12, 0.3, 0.3, 0, 0);
    lightbar.position.set(0, 0.36 + t.H + t.cabinH + 0.1, -t.L * 0.04);
    g.add(lightbar);
    g.userData.barRed = red;
    g.userData.barBlue = blue;
    part(g, new THREE.MeshLambertMaterial({ color: 0x27313a }), t.W * 0.99, t.H * 0.5, t.L * 0.7, 0, 0.36 + t.H * 0.45, 0); // PAPD band
  }
  if (typeKey === 'taxi') {
    part(g, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), 0.5, 0.12, 0.24, 0, 0.36 + t.H + t.cabinH + 0.08, -t.L * 0.04);
  }
  if (typeKey === 'truck') {
    part(g, bodyMat, t.W, 1.1, t.L * 0.52, 0, 0.36 + t.H + 0.55, -t.L * 0.22);
  }
  g.userData.wheels = wheels;
  g.userData.bodyMat = bodyMat;
  g.userData.lightbar = lightbar;
  return g;
}

let nextCarId = 1;

export function createCar(typeKey, x, z, heading, colorHex, rng) {
  const t = CAR_TYPES[typeKey];
  const color = colorHex !== undefined ? colorHex : t.colors[Math.floor((rng ? rng() : Math.random()) * t.colors.length)];
  const mesh = makeCarMesh(typeKey, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    id: nextCarId, type: typeKey, spec: t, x, z, heading,
    speed: 0, steer: 0, color, mesh, hp: t.hp, dead: false,
    driver: null, parked: false, smokeT: 0, fireT: 0, wheelSpin: 0,
  };
  nextCarId += 1;
  G.cars.push(car);
  return car;
}

export function removeCar(car) {
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
  if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
}

/** Parked cars hug the kerb at 8.45 m from the road centre — clear of the
 * 10 m building line, clear of the carriageway. */
export function spawnParkedCars(rng) {
  const spots = [];
  const ROADS_XL = [-160, -100, -40, 20, 80, 140, 200, 260];
  const ROADS_ZL = [-280, -220, -160, -100, -40, 20, 80, 140, 200, 260];
  for (const rx of ROADS_XL) {
    for (let z = -296; z < 300; z += 23) {
      if (ROADS_ZL.some((rz) => Math.abs(z - rz) < 13)) continue;
      if (rng() < 0.45) spots.push({ x: rx - 8.45, z: z + rng() * 6, heading: Math.PI });
      if (rng() < 0.45) spots.push({ x: rx + 8.45, z: z + rng() * 6, heading: 0 });
    }
  }
  for (const s of spots) {
    if (G.city && G.city.colliders.some((c) => s.x > c.minX - 2 && s.x < c.maxX + 2 && s.z > c.minZ - 2 && s.z < c.maxZ + 2)) continue;
    const type = ['sedan', 'sedan', 'sport', 'taxi', 'truck'][Math.floor(rng() * 5)];
    const car = createCar(type, s.x, s.z, s.heading, undefined, rng);
    car.parked = true;
  }
}

/** Arcade drive model: input {throttle -1..1, steer -1..1, brake}. */
export function driveCar(car, input, dt) {
  if (car.dead) {
    car.speed *= Math.max(0, 1 - dt * 2);
    return;
  }
  const t = car.spec;
  const target = input.throttle > 0 ? t.topSpeed : input.throttle < 0 ? -12 : 0;
  const rate = input.brake ? 26 : t.accel;
  if (input.throttle !== 0 || input.brake) {
    car.speed += clamp(target - car.speed, -rate * dt, rate * dt);
  } else {
    car.speed -= clamp(car.speed, -8 * dt, 8 * dt);
  }
  const steerTarget = (input.steer || 0) * 0.55;
  car.steer += clamp(steerTarget - car.steer, -dt * 3, dt * 3);
  if (Math.abs(car.speed) > 0.1) {
    car.heading += car.steer * dt * t.grip * (car.speed / t.topSpeed) * (car.speed < 0 ? -1 : 1) * 1.6;
  }
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.wheelSpin += car.speed * dt / 0.36;
}

export function syncCarMesh(car, dt = 0) {
  if (!car.mesh) return;
  car.mesh.position.set(car.x, car.dead ? -0.06 : 0, car.z);
  car.mesh.rotation.y = car.heading;
  const wheels = car.mesh.userData.wheels || [];
  for (const w of wheels) w.rotation.x = car.wheelSpin;
}

export function collideCarWithCars(car, others, dt) {
  for (const o of others) {
    if (o === car) continue;
    const hit = collideCircleOBB(car.x, car.z, car.spec.L * 0.42, o.x, o.z, o.heading, o.spec.W / 2, o.spec.L / 2);
    if (hit) {
      const impact = Math.abs(car.speed) * 0.6;
      car.x = hit.x;
      car.z = hit.z;
      if (impact > 4) {
        damageCar(o, impact * 2, car === (G.player && G.player.car));
        damageCar(car, impact, false);
        car.speed *= -0.25;
      } else {
        car.speed *= 0.6;
      }
    }
  }
}

export function collideCars(cars, dt) {
  for (const car of cars) {
    if (car.parked || car.dead) continue;
    collideCarWithCars(car, cars, dt);
  }
}

export function damageCar(car, amount, byPlayerAction = false) {
  if (car.dead) return;
  car.hp -= amount;
  if (car.hp < car.spec.hp * 0.45 && car.smokeT <= 0) car.smokeT = 0.1;
  if (car.hp <= 0) {
    car.dead = true;
    car.speed = 0;
    if (car.mesh && car.mesh.userData.bodyMat) car.mesh.userData.bodyMat.color.setHex(0x17181c);
    explodeAt(car.x, car.z, 6, car);
    if (byPlayerAction) burst(car.x, 1.4, car.z, 0xffb347, 14, 3);
  }
}

export function flashLightbars(phase, strength = 1) {
  for (const car of G.cars) {
    if (car.type !== 'cruiser' || !car.mesh) continue;
    const red = car.mesh.userData.barRed;
    const blue = car.mesh.userData.barBlue;
    if (!red || !blue) continue;
    const on = Math.sin(phase * 14 + car.id) > 0;
    red.material = on ? LIGHTBAR_RED : LIGHTBAR_BLUE;
    blue.material = on ? LIGHTBAR_BLUE : LIGHTBAR_RED;
  }
}

export function nearestCarDistance(cars, x, z) {
  let best = Infinity;
  for (const c of cars) best = Math.min(best, dist2d(x, z, c.x, c.z));
  return best;
}
