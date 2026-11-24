// vehicles.js — the Puerto Alba car table and everything cars do: build,
// drive, collide, burn. One construction recipe for all five types so the
// fleet reads consistently in frame: wheels, body, glass cabin, roof panel,
// mirrors, grille, bumpers — plus lightbars and glows on the cruiser.

import { G } from './state.js';
import { clamp, collideCircleOBB, dist2d } from './util.js';
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
  color: 0xffe9b0, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide,
});
export const GLOW_RED_MAT = new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0, depthWrite: false });
export const GLOW_BLUE_MAT = new THREE.MeshBasicMaterial({ color: 0x2a7fff, transparent: true, opacity: 0, depthWrite: false });

const _wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
const _wheelMat = new THREE.MeshLambertMaterial({ color: 0x17191d });
const _glassMat = new THREE.MeshPhongMaterial({ color: 0x1c2a38, shininess: 80, specular: 0x88aacc });
let _nextCarId = 1;

function cbox(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function makeCarMesh(typeKey, colorHex) {
  const t = CAR_TYPES[typeKey];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex }); // unique per car: wrecks burn black
  const body = cbox(t.W, t.H, t.L, bodyMat, 0, 0.36 + t.H / 2, 0);
  body.castShadow = true;
  g.add(body);
  const cabin = cbox(t.W * 0.82, t.cabinH, t.L * 0.46, _glassMat, 0, 0.36 + t.H + t.cabinH / 2 - 0.04, -t.L * 0.04);
  cabin.castShadow = true;
  g.add(cabin);
  g.add(cbox(t.W * 0.8, 0.07, t.L * 0.4, bodyMat, 0, 0.36 + t.H + t.cabinH + 0.015, -t.L * 0.04)); // roof panel
  // Grille, bumpers, mirrors, lights.
  const dark = new THREE.MeshLambertMaterial({ color: 0x22242a });
  g.add(cbox(t.W * 0.7, 0.16, 0.1, dark, 0, 0.52, t.L / 2 + 0.03));
  g.add(cbox(t.W + 0.06, 0.18, 0.16, bodyMat, 0, 0.3, t.L / 2 + 0.04));
  g.add(cbox(t.W + 0.06, 0.18, 0.16, bodyMat, 0, 0.3, -t.L / 2 - 0.04));
  g.add(cbox(0.1, 0.08, 0.16, bodyMat, -t.W / 2 - 0.06, 0.36 + t.H + 0.18, t.L * 0.14));
  g.add(cbox(0.1, 0.08, 0.16, bodyMat, t.W / 2 + 0.06, 0.36 + t.H + 0.18, t.L * 0.14));
  const hl = new THREE.Mesh(new THREE.BoxGeometry(t.W * 0.62, 0.1, 0.05), HEADLIGHT_MAT);
  hl.position.set(0, 0.62, t.L / 2 + 0.06);
  g.add(hl);
  const wheels = [];
  const wx = t.W / 2 - 0.05, wz = t.L / 2 - 0.85;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(_wheelGeo, _wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * wx, 0.36, sz * wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  if (typeKey === 'taxi') {
    g.add(cbox(0.5, 0.16, 0.3, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), 0, 0.36 + t.H + t.cabinH + 0.12, -t.L * 0.04));
  }
  if (typeKey === 'truck') {
    g.add(cbox(t.W, 1.5, t.L * 0.45, new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }), 0, 1.35, -t.L * 0.26));
  }
  if (typeKey === 'cruiser') {
    const barY = 0.36 + t.H + t.cabinH + 0.1;
    const red = cbox(0.5, 0.14, 0.34, LIGHTBAR_RED, -0.28, barY, -t.L * 0.04);
    const blue = cbox(0.5, 0.14, 0.34, LIGHTBAR_BLUE, 0.28, barY, -t.L * 0.04);
    red.name = 'lightbarRed'; blue.name = 'lightbarBlue';
    g.add(red); g.add(blue);
    const glowR = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), GLOW_RED_MAT);
    glowR.position.set(-0.6, barY, -t.L * 0.04); glowR.rotation.x = -Math.PI / 2;
    g.add(glowR);
    const glowB = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), GLOW_BLUE_MAT);
    glowB.position.set(0.6, barY, -t.L * 0.04); glowB.rotation.x = -Math.PI / 2;
    g.add(glowB);
    // PAPD door roundels.
    const doorMat = new THREE.MeshBasicMaterial({ color: 0x274b63 });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), doorMat);
      d.position.set(sx * (t.W / 2 + 0.01), 0.36 + t.H / 2, 0.1);
      d.rotation.y = sx * Math.PI / 2;
      g.add(d);
    }
  }
  g.userData = { wheels, bodyMat, typeKey };
  return g;
}

export function createCar(typeKey, x, z, heading, colorHex, rng) {
  const t = CAR_TYPES[typeKey];
  const color = colorHex !== undefined ? colorHex : t.colors[Math.floor((rng ? rng() : Math.random()) * t.colors.length) % t.colors.length];
  const mesh = makeCarMesh(typeKey, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  if (G.scene) G.scene.add(mesh);
  const car = {
    id: _nextCarId++, typeKey, type: t, color,
    x, z, heading, speed: 0, steer: 0,
    hp: t.hp, maxHp: t.hp, dead: false, burning: 0,
    driver: null, parked: false, unit: 0,
    mesh, wheels: mesh.userData.wheels, bodyMat: mesh.userData.bodyMat,
    smokeTimer: 0, wheelSpin: 0,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(car) {
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
  if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
}

// Parked rows hug the kerb at 8.45 m from the road centre — clear of the
// carriageway, clear of the building line at 10 m.
export function spawnParkedCars(rng) {
  const made = [];
  const spots = [
    ['sedan', -222.6, 14, 0], ['truck', -201.4, 34, Math.PI],
    ['sedan', -151, -63, Math.PI / 2], ['sport', -49, 29, -Math.PI / 2],
    ['taxi', 29, -33, Math.PI / 2], ['sedan', 89, 87, -Math.PI / 2],
    ['truck', 149, -107, Math.PI / 2], ['sedan', 209, 147, -Math.PI / 2],
    ['sport', -109, 207, 0], ['sedan', 51, 227, Math.PI],
    ['taxi', -63, -227, Math.PI / 2], ['sedan', 171, -267, -Math.PI / 2],
    ['sedan', -168.45, -190, 0], ['sport', -168.45, 120, 0],
    ['truck', 231.5, 60, Math.PI / 2], ['sedan', -31.5, -190, Math.PI / 2],
  ];
  for (const [type, x, z, h] of spots) {
    const car = createCar(type, x, z, h, undefined, rng);
    car.parked = true;
    made.push(car);
  }
  return made;
}

// Arcade driving: throttle toward top speed, grip-limited steering, and a
// hard stop at city colliders so a car never ends a frame inside a building.
export function driveCar(car, input, dt) {
  if (car.dead) { car.speed *= Math.max(0, 1 - dt * 2); }
  else {
    const target = (input.throttle || 0) * car.type.topSpeed;
    const rate = target > car.speed ? car.type.accel : car.type.accel * 2.2;
    car.speed += clamp(target - car.speed, -rate * dt, rate * dt);
    const steerTarget = (input.steer || 0) * 0.55;
    car.steer += clamp(steerTarget - car.steer, -dt * 4, dt * 4);
    const speedRatio = Math.abs(car.speed) / car.type.topSpeed;
    car.heading += car.steer * car.type.grip * dt * (car.speed >= 0 ? 1 : -1) * (0.35 + speedRatio * 0.65);
  }
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.x = clamp(car.x, -250, 290);
  car.z = clamp(car.z, -306, 306);
  if (G.city) {
    const halfW = car.type.W / 2 + 0.2, halfL = car.type.L / 2;
    const rr = Math.max(halfW, halfL * 0.55);
    for (const b of G.city.colliders) {
      const fix = collideCircleOBB(car.x, car.z, rr, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 0, (b.maxX - b.minX) / 2, (b.maxZ - b.minZ) / 2);
      if (fix.hit) {
        car.x = fix.x; car.z = fix.z;
        if (Math.abs(car.speed) > 9) damageCar(car, 4, false);
        car.speed *= 0.4;
      }
    }
  }
  syncCarMesh(car, dt);
}

// Cars are solid: circle-vs-OBB push-out between every close pair.
export function collideCarWithCars(car, others, dt) {
  for (const o of others) {
    if (o === car) continue;
    const d = dist2d(car.x, car.z, o.x, o.z);
    const reach = car.type.L / 2 + o.type.L / 2 + 0.4;
    if (d > reach) continue;
    const res = collideCircleOBB(car.x, car.z, car.type.W / 2 + 0.25, o.x, o.z, o.heading, o.type.W / 2, o.type.L / 2);
    if (res.hit) {
      const impact = Math.abs(car.speed - o.speed);
      car.x = res.x; car.z = res.z;
      if (impact > 10) { damageCar(car, impact * 0.5, false); damageCar(o, impact * 0.4, false); }
      car.speed *= 0.55;
    }
  }
}

export function collideCars(cars, dt) {
  for (const car of cars) collideCarWithCars(car, cars, dt);
}

export function syncCarMesh(car, dt = 0) {
  if (!car.mesh) return;
  car.mesh.position.set(car.x, car.dead ? -0.04 : 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * dt * 1.4;
  for (const w of car.wheels) w.rotation.x = car.wheelSpin;
  if (car.smokeTimer > 0) car.smokeTimer -= dt;
  if (!car.dead && car.hp < car.maxHp * 0.45 && car.smokeTimer <= 0) {
    burstSmoke(car.x, 1.1, car.z, 2, {});
    car.smokeTimer = 0.16;
  }
  if (car.dead && car.burning > 0) {
    car.burning -= dt;
    if (Math.random() < 0.4) burst(car.x, 0.9, car.z, 0xff7a30, 2, 2.4, {});
    if (Math.random() < 0.25) burstSmoke(car.x, 1.3, car.z, 1, {});
  }
}

export function damageCar(car, amount, byPlayerAction = false) {
  if (car.dead) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.dead = true;
    car.burning = 2.6;
    car.bodyMat.color.setHex(0x17181c);
    explodeAt(car.x, car.z, 6.5, car);
    if (byPlayerAction && G.wanted !== undefined) { /* police.js reads crimes via addCrime */ }
  }
}

// Shared lightbar materials mean one call flashes every cruiser together.
export function flashLightbars(phase, strength = 1) {
  const on = phase % 1 < 0.5;
  LIGHTBAR_RED.color.setHex(on ? 0xff2a1e : 0x7a130c);
  LIGHTBAR_BLUE.color.setHex(on ? 0x2a7fff : 0x142c55);
  GLOW_RED_MAT.opacity = on ? 0.30 * strength : 0.02;
  GLOW_BLUE_MAT.opacity = on ? 0.02 : 0.30 * strength;
}

export function nearestCarDistance(cars, x, z) {
  let best = Infinity;
  for (const c of cars) best = Math.min(best, dist2d(x, z, c.x, c.z));
  return best;
}
