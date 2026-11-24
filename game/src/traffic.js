// traffic.js — ambient traffic: cars that pick a road, hold their lane and
// cruise the grid, respawning at the edges so the city never empties.

import { G } from './state.js';
import { makeRng, pick, clamp, dist2d } from './util.js';
import { createCar, driveCar, removeCar, CAR_TYPES } from './vehicles.js';
import { randomRoadPoint, CITY_BOUNDS } from './city.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'truck'];
const LANE = 3.5;
let _rng = makeRng(808);

function lanePose(pt) {
  // Right-hand traffic: the lane sits to the right of the direction of travel.
  if (pt.axis === 'x') {
    return {
      x: pt.line + (pt.dir > 0 ? LANE : -LANE),
      z: pt.along,
      heading: pt.dir > 0 ? 0 : Math.PI,
    };
  }
  return {
    x: pt.along,
    z: pt.line + (pt.dir > 0 ? -LANE : LANE),
    heading: pt.dir > 0 ? Math.PI / 2 : -Math.PI / 2,
  };
}

function spawnTrafficCar() {
  const pt = randomRoadPoint(_rng);
  const pose = lanePose(pt);
  if (G.player && dist2d(pose.x, pose.z, G.player.x, G.player.z) < 24) return null;
  const type = pick(_rng, TRAFFIC_TYPES);
  const car = createCar(type, pose.x, pose.z, pose.heading, undefined, _rng);
  car.driver = 'traffic';
  car.trafficPt = pt;
  car.speed = car.type.topSpeed * 0.45;
  return car;
}

export function initTraffic() {
  for (let i = 0; i < 14; i++) spawnTrafficCar();
}

function recycle(car) {
  const pt = randomRoadPoint(_rng);
  const pose = lanePose(pt);
  car.x = pose.x; car.z = pose.z; car.heading = pose.heading;
  car.trafficPt = pt;
  car.speed = car.type.topSpeed * 0.45;
  car.hp = car.type.hp; car.dead = false;
}

export function updateTraffic(dt) {
  if (G.shotMode) return;
  const traffic = G.cars.filter((c) => c.driver === 'traffic');
  if (traffic.length < 14) spawnTrafficCar();
  for (const car of traffic) {
    if (car.dead) continue;
    const pt = car.trafficPt;
    // Drive along the current road; at the bounds, pick a fresh road.
    let throttle = 0.62;
    // Slow for the car ahead in the same lane.
    for (const o of G.cars) {
      if (o === car) continue;
      const ahead = (o.x - car.x) * Math.sin(car.heading) + (o.z - car.z) * Math.cos(car.heading);
      const side = Math.abs((o.x - car.x) * Math.cos(car.heading) - (o.z - car.z) * Math.sin(car.heading));
      if (ahead > 0 && ahead < 7 && side < 1.6) { throttle = 0; break; }
    }
    driveCar(car, { throttle, steer: 0 }, dt);
    // Hold the lane line.
    if (pt.axis === 'x') car.x += clamp((pt.line + (pt.dir > 0 ? LANE : -LANE)) - car.x, -dt * 2, dt * 2);
    else car.z += clamp((pt.line + (pt.dir > 0 ? -LANE : LANE)) - car.z, -dt * 2, dt * 2);
    const out = car.x < CITY_BOUNDS.minX + 4 || car.x > CITY_BOUNDS.maxX - 4 || car.z < CITY_BOUNDS.minZ + 4 || car.z > CITY_BOUNDS.maxZ - 4;
    const far = G.player && dist2d(car.x, car.z, G.player.x, G.player.z) > 190;
    if (out || far) recycle(car);
  }
}
