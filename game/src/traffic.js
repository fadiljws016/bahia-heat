// traffic.js — the ordinary drivers of Puerto Alba, more of them now:
// twenty-six cars following the grid lane by lane, brake lights flaring in
// queues, turns at intersections, and — new in round two — panic. Gunfire
// within earshot and the whole street puts its foot down, horns blaring,
// which is exactly the chaos a chase should plough through.

import { G } from './state.js';
import { ROADS_X, ROADS_Z, BOULEVARD_X, randomRoadPoint } from './city.js';
import { clamp, wrapAngle, dist2d, makeRng } from './util.js';
import { createCar, driveCar, removeCar } from './vehicles.js';
import { sfx } from './audio.js';

const rng = makeRng(20240);
const TARGET = 32;
const TYPES = ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'truck'];

function spawnTraffic() {
  const pt = randomRoadPoint(rng);
  const d = dist2d(pt.x, pt.z, G.player.x, G.player.z);
  if (d < 42) return null;
  const car = createCar(TYPES[Math.floor(rng() * TYPES.length)], pt.x, pt.z, pt.heading, null, rng);
  car.driver = 'traffic';
  car.route = { axis: pt.axis, line: pt.line, dir: pt.dir };
  car.cruise = 10 + rng() * 5;
  car.panicT = 0;
  G.trafficCars.push(car);
  return car;
}

export function initTraffic() {
  for (let i = 0; i < TARGET; i += 1) spawnTraffic();
}

/**
 * Is anything solid `look` metres ahead of the car (in its lane, roughly)?
 * Checks every car set plus the player's — a traffic queue behind a chase
 * reads as a queue because of this.
 */
function blockedAhead(car, allCars, look) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  for (const other of allCars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0.5 || ahead > look) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < 2.1) return other;
  }
  return null;
}

export function updateTraffic(dt) {
  if (G.trafficCars.length < TARGET && rng() < 0.06) spawnTraffic();
  const allCars = [...G.trafficCars, ...G.policeCars, ...G.parkedCars];
  if (G.player.inCar) allCars.push(G.player.inCar);
  const threatNear = G.elapsed - (G.lastShotAt ?? -99) < 3;

  for (let i = G.trafficCars.length - 1; i >= 0; i -= 1) {
    const car = G.trafficCars[i];
    if (car.dead) { G.trafficCars.splice(i, 1); continue; }
    const dPlayer = dist2d(car.x, car.z, G.player.x, G.player.z);
    if (dPlayer > 300) { removeCar(car); G.trafficCars.splice(i, 1); continue; }
    const r = car.route;
    if (!r) continue;

    // Panic: shooting nearby, or a cruiser screaming past, and they run.
    if (threatNear && dPlayer < 34) car.panicT = 2.6;
    if (car.panicT > 0) car.panicT -= dt;
    const panicking = car.panicT > 0;

    // Follow the current road line; turn when an intersection nears.
    let targetHeading = car.heading;
    if (r.axis === 'z') {
      targetHeading = r.dir > 0 ? 0 : Math.PI;
      let nextJunction = null;
      for (const rz of ROADS_Z) {
        const dz = (rz - car.z) * r.dir;
        if (dz > 2 && dz < 30 && (nextJunction === null || dz < nextJunction.d)) nextJunction = { line: rz, d: dz };
      }
      if (nextJunction && nextJunction.d < 9 && rng() < 0.012) {
        r.axis = 'x'; r.line = nextJunction.line;
        r.dir = rng() < 0.5 ? 1 : -1;
        car.z = nextJunction.line + (r.dir > 0 ? 3.5 : -3.5);
      }
    } else {
      targetHeading = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const verticals = [BOULEVARD_X, ...ROADS_X];
      let nextJunction = null;
      for (const rx of verticals) {
        const dx = (rx - car.x) * r.dir;
        if (dx > 2 && dx < 30 && (nextJunction === null || dx < nextJunction.d)) nextJunction = { line: rx, d: dx };
      }
      if (nextJunction && nextJunction.d < 9 && rng() < 0.012) {
        r.axis = 'z'; r.line = nextJunction.line;
        r.dir = rng() < 0.5 ? 1 : -1;
        car.x = nextJunction.line + (r.dir > 0 ? -3.5 : 3.5);
      }
    }

    const diff = wrapAngle(targetHeading - car.heading);
    const steer = clamp(diff * 2.0, -1, 1);
    const blocker = blockedAhead(car, allCars, panicking ? 6 : 8.5);
    let throttle = 0;
    car.brakeLight = !!blocker;
    if (blocker) {
      throttle = car.speed > 1 ? -0.7 : 0;
      car.brakeLight = true;
      if (car.speed < 0.5 && rng() < 0.004 && G.elapsed > (car.honkAt ?? 0)) { sfx.horn(); car.honkAt = G.elapsed + 6; }
    } else if (panicking) {
      throttle = 1;
      if (Math.abs(car.speed) > 24) throttle = 0.2;
      if (rng() < 0.01) sfx.horn();
    } else {
      throttle = Math.abs(car.speed) < car.cruise ? 0.75 : 0.05;
    }
    driveCar(car, { throttle, steer, handbrake: false }, dt);
    car.brakeLight = car.brakeLight || throttle < 0;
  }
}
