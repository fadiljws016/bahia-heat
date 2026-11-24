// player.js — the runner in the green shirt: on-foot movement with real
// collision (buildings push back, cars are solid), entering and driving
// cars, health. Combat lives in combat.js; this file owns the body.

import { G } from './state.js';
import { clamp, lerpAngle, dist2d, collideCircleBox, collideCircleOBB } from './util.js';
import { buildPersonMesh, posePerson, showWeapon } from './people.js';
import { collidersNear } from './city.js';
import { input } from './input.js';
import { camYaw } from './camera.js';
import { driveCar, syncCarMesh, collideCarWithCars, damageCar, createCar } from './vehicles.js';
import { setEngine, sfx } from './audio.js';

export function spawnPlayer(x, z) {
  const mesh = buildPersonMesh({ skin: 0xa06a42, shirt: 0x35b06f, pants: 0x2c3a55, hair: 0x1d1410 });
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const p = {
    x, z, heading: 0, mesh, hp: 100, maxHp: 100, armor: 0,
    car: null, dead: false, phase: 0, pose: 'idle', fireCooldown: 0,
    radius: 0.45,
  };
  G.player = p;
  showWeapon(mesh, G.weapons.current, 'hip');
  return p;
}

export function findEnterableCar() {
  const p = G.player;
  if (!p) return null;
  let best = null;
  let bestD = 3.6;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist2d(p.x, p.z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function keepOutOfBuildings(p, radius) {
  if (!G.city) return;
  for (const c of collidersNear(G.city, p.x, p.z)) {
    const hit = collideCircleBox(p.x, p.z, radius, c);
    if (hit) { p.x = hit.x; p.z = hit.z; }
  }
}

export function keepOutOfCars(p) {
  for (const car of G.cars) {
    if (car === p.car) continue;
    const hit = collideCircleOBB(p.x, p.z, p.radius, car.x, car.z, car.heading, car.spec.W / 2, car.spec.L / 2);
    if (hit) { p.x = hit.x; p.z = hit.z; }
  }
}

function enterCar(p, car) {
  p.car = car;
  car.driver = p;
  car.parked = false;
  p.mesh.visible = false;
  sfx.door();
  sfx.enter();
}

function exitCar(p) {
  const car = p.car;
  p.car = null;
  if (car) {
    car.driver = null;
    const side = car.heading + Math.PI / 2;
    p.x = car.x + Math.sin(side) * 2.2;
    p.z = car.z + Math.cos(side) * 2.2;
    car.speed = 0;
  }
  p.mesh.visible = true;
  sfx.door();
  setEngine(false);
}

export function hurtPlayer(amount) {
  const p = G.player;
  if (!p || p.dead || G.shotMode) return;
  const absorbed = Math.min(p.armor, amount * 0.6);
  p.armor -= absorbed;
  p.hp -= (amount - absorbed);
  sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    if (!p.car) posePerson(p.mesh, 'down', 0);
    G.over = true;
  }
}

export function healPlayer(amount) {
  const p = G.player;
  if (!p) return;
  p.hp = clamp(p.hp + amount, 0, p.maxHp);
}

/** Staging helper: spawn a car and seat the player in it. Returns the car. */
export function putPlayerInCar(typeKey, x, z, heading, colorHex) {
  const p = G.player;
  const car = createCar(typeKey, x, z, heading, colorHex, Math.random);
  if (p) {
    p.car = car;
    car.driver = p;
    p.x = x;
    p.z = z;
    p.heading = heading;
    p.mesh.visible = false;
  }
  syncCarMesh(car, 0);
  return car;
}

export function updatePlayer(dt) {
  const p = G.player;
  if (!p || p.dead) return;
  if (G.dialogue || G.mapOpen || G.shotMode) {
    if (p.car) syncCarMesh(p.car, dt);
    return;
  }
  if (input.interact) {
    if (p.car) exitCar(p);
    else {
      const car = findEnterableCar();
      if (car) enterCar(p, car);
    }
  }
  if (p.car) {
    const car = p.car;
    const driveInput = {
      throttle: input.forward,
      steer: -input.strafe,
      brake: !!input.keys.Space,
    };
    const before = car.speed;
    driveCar(car, driveInput, dt);
    collideCarWithCars(car, G.cars, dt);
    // Cars are stopped by buildings too.
    if (G.city) {
      for (const c of collidersNear(G.city, car.x, car.z)) {
        const hit = collideCircleBox(car.x, car.z, 2.1, c);
        if (hit) {
          car.x = hit.x;
          car.z = hit.z;
          if (Math.abs(before) > 9) damageCar(car, Math.abs(before) * 0.7, true);
          car.speed *= 0.3;
        }
      }
    }
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    syncCarMesh(car, dt);
    setEngine(true, Math.abs(car.speed) / car.spec.topSpeed);
    return;
  }
  setEngine(false);
  // On foot: move relative to the camera yaw.
  const yaw = camYaw();
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = -fz;
  const rz = fx;
  let mx = fx * input.forward + rx * input.strafe;
  let mz = fz * input.forward + rz * input.strafe;
  const len = Math.hypot(mx, mz);
  const moving = len > 0.05;
  const sprint = input.sprint;
  const speed = sprint ? 6.4 : 3.6;
  if (moving) {
    mx /= len;
    mz /= len;
    p.heading = lerpAngle(p.heading, Math.atan2(mx, mz), dt * 12);
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    p.phase += dt * (sprint ? 11 : 8);
    p.pose = sprint ? 'run' : 'walk';
  } else {
    p.pose = G.weapons.current !== 'fists' && input.firing ? 'aim' : 'idle';
    p.phase += dt * 1.6;
  }
  keepOutOfBuildings(p, p.radius);
  keepOutOfCars(p);
  p.x = clamp(p.x, -250, 290);
  p.z = clamp(p.z, -306, 306);
  posePerson(p.mesh, p.pose, p.phase);
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}
