// traffic.js — ambient traffic: cars spawn on the road graph (never
// inside a building), follow their lane, brake for the car ahead and
// despawn when far away. Lane discipline comes from randomRoadPoint:
// {axis, line, dir} — axis 'z' means the car travels along z on road x=line.

import { G } from './state.js';
import { makeRng, pick, dist2d } from './util.js';
import { randomRoadPoint, ROAD_WIDTH } from './city.js';
import { createCar, driveCar, syncCarMesh, removeCar } from './vehicles.js';

const rng = makeRng(555);
const TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'sport', 'truck'];
const TARGET = 15;

function laneOffset(dir) {
  return 3.5 * dir;
}

function spawnTrafficCar() {
  const p = G.player;
  const rp = randomRoadPoint(rng);
  let x;
  let z;
  let heading;
  if (rp.axis === 'z') {
    z = p ? p.z + (rng() < 0.5 ? -1 : 1) * (60 + rng() * 80) : rng() * 500 - 250;
    x = rp.line + laneOffset(rp.dir);
    heading = rp.dir > 0 ? 0 : Math.PI;
  } else {
    x = p ? p.x + (rng() < 0.5 ? -1 : 1) * (60 + rng() * 80) : rng() * 500 - 250;
    z = rp.line + laneOffset(rp.dir);
    heading = rp.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  if (x < -246 || x > 286 || z < -300 || z > 300) return;
  // Never spawn inside a building or on top of another car.
  if (G.city && G.city.colliders.some((c) => x > c.minX - 3 && x < c.maxX + 3 && z > c.minZ - 3 && z < c.maxZ + 3)) return;
  if (G.cars.some((c) => dist2d(x, z, c.x, c.z) < 8)) return;
  const type = pick(rng, TYPES);
  const car = createCar(type, x, z, heading, undefined, rng);
  car.traffic = { axis: rp.axis, line: rp.line, dir: rp.dir };
  car.speed = car.spec.topSpeed * (0.45 + rng() * 0.25);
}

export function initTraffic() {
  for (let i = 0; i < TARGET; i += 1) spawnTrafficCar();
}

export function updateTraffic(dt) {
  const p = G.player;
  let count = 0;
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (!car.traffic || car.dead || car.police) continue;
    count += 1;
    const t = car.traffic;
    // Brake for whatever is ahead in the lane.
    let throttle = 0.7;
    for (const o of G.cars) {
      if (o === car) continue;
      const ahead = t.axis === 'z'
        ? Math.abs(o.x - car.x) < 2.6 && (o.z - car.z) * t.dir > 0 && (o.z - car.z) * t.dir < 10
        : Math.abs(o.z - car.z) < 2.6 && (o.x - car.x) * t.dir > 0 && (o.x - car.x) * t.dir < 10;
      if (ahead) { throttle = -0.4; break; }
    }
    if (p && !p.car && dist2d(p.x, p.z, car.x, car.z) < 7) throttle = -0.6;
    driveCar(car, { throttle, steer: 0, brake: throttle < 0 }, dt);
    // Hold the lane line.
    if (t.axis === 'z') car.x += (t.line + laneOffset(t.dir) - car.x) * Math.min(1, dt * 2);
    else car.z += (t.line + laneOffset(t.dir) - car.z) * Math.min(1, dt * 2);
    syncCarMesh(car, dt);
    if (p && dist2d(p.x, p.z, car.x, car.z) > 190) {
      removeCar(car);
      count -= 1;
    }
  }
  if (count < TARGET && Math.random() < dt * 2) spawnTrafficCar();
  void ROAD_WIDTH;
}
