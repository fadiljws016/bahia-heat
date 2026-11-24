// player.js — the green-shirted runner of Puerto Alba: on-foot movement
// with solid cars and buildings, entering and driving cars, taking hits.

import { G } from './state.js';
import { clamp, lerpAngle, wrapAngle, dist2d, collideCircleOBB, collideCircleBox } from './util.js';
import { buildPersonMesh, posePerson, showWeapon } from './people.js';
import { collidersNear } from './city.js';
import { driveCar, syncCarMesh } from './vehicles.js';
import { input } from './input.js';

const PLAYER_GREEN = 0x35b06f;

export function spawnPlayer(x, z) {
  const mesh = buildPersonMesh({ skin: 0xa06a42, shirt: PLAYER_GREEN, pants: 0x2c3a55, hair: 0x1d1410, dress: false, cap: false, seed: 42 });
  mesh.position.set(x, 0, z);
  if (G.scene) G.scene.add(mesh);
  const player = {
    mesh, x, z, heading: 0, speed: 0,
    car: null, pose: 'stand', phase: 0,
    radius: 0.42, fireCooldown: 0,
  };
  G.player = player;
  refreshWeaponMesh();
  return player;
}

export function refreshWeaponMesh() {
  const p = G.player;
  if (!p) return;
  showWeapon(p.mesh, G.weapon, G.weapon === 'fists' ? 'none' : (p.pose === 'aim' || p.pose === 'fire' ? 'hand' : 'hip'));
}

export function findEnterableCar() {
  const p = G.player;
  if (!p || p.car) return null;
  let best = null, bestD = 3.4;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist2d(p.x, p.z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function hurtPlayer(amount) {
  if (G.shotMode || G.over) return;
  let dmg = amount;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, dmg * 0.6);
    G.armor -= absorbed;
    dmg -= absorbed;
  }
  G.health -= dmg;
  if (G.health <= 0) {
    G.health = 0;
    G.over = true;
  }
}

export function healPlayer(amount) {
  G.health = Math.min(100, G.health + amount);
}

function keepOutOfBuildings(p) {
  if (!G.city) return;
  for (const b of collidersNear(G.city, p.x, p.z)) {
    const res = collideCircleBox(p.x, p.z, p.radius, b);
    if (res.hit) { p.x = res.x; p.z = res.z; }
  }
}

// Cars are solid: walking into one stops you, it never ghosts through.
function keepOutOfCars(p) {
  for (const car of G.cars) {
    if (car === p.car) continue;
    const res = collideCircleOBB(p.x, p.z, p.radius, car.x, car.z, car.heading, car.type.W / 2, car.type.L / 2);
    if (res.hit) { p.x = res.x; p.z = res.z; }
  }
}

export function enterCar(car) {
  const p = G.player;
  p.car = car;
  car.driver = 'player';
  car.parked = false;
  p.mesh.visible = false;
}

export function exitCar() {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  car.driver = null;
  const side = car.heading + Math.PI / 2;
  p.x = car.x + Math.sin(side) * (car.type.W / 2 + 0.8);
  p.z = car.z + Math.cos(side) * (car.type.W / 2 + 0.8);
  p.heading = car.heading;
  p.mesh.visible = true;
  keepOutOfBuildings(p);
}

export function updatePlayer(dt) {
  const p = G.player;
  if (!p || G.shotMode) return;
  p.phase += dt * 2;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;

  if (p.car) {
    const car = p.car;
    const throttle = (input.keys['KeyW'] || input.keys['ArrowUp']) ? 1 : (input.keys['KeyS'] || input.keys['ArrowDown']) ? -0.55 : 0;
    const steer = (input.keys['KeyA'] || input.keys['ArrowLeft']) ? 1 : (input.keys['KeyD'] || input.keys['ArrowRight']) ? -1 : 0;
    driveCar(car, { throttle, steer }, dt);
    p.x = car.x; p.z = car.z; p.heading = car.heading;
    if (input.pressed['KeyE']) exitCar();
    return;
  }

  // On foot: move relative to the camera yaw.
  let mx = 0, mz = 0;
  if (input.keys['KeyW'] || input.keys['ArrowUp']) mz += 1;
  if (input.keys['KeyS'] || input.keys['ArrowDown']) mz -= 1;
  if (input.keys['KeyA'] || input.keys['ArrowLeft']) mx -= 1;
  if (input.keys['KeyD'] || input.keys['ArrowRight']) mx += 1;
  const running = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
  const speed = running ? 6.4 : 3.6;
  if (mx !== 0 || mz !== 0) {
    const camYaw = input.yaw || 0;
    const len = Math.hypot(mx, mz);
    const dx = (Math.sin(camYaw) * mz + Math.cos(camYaw) * mx) / len;
    const dz = (Math.cos(camYaw) * mz - Math.sin(camYaw) * mx) / len;
    p.x += dx * speed * dt;
    p.z += dz * speed * dt;
    p.heading = lerpAngle(p.heading, Math.atan2(dx, dz), Math.min(1, dt * 12));
    p.pose = running ? 'run' : 'walk';
  } else if (p.pose === 'walk' || p.pose === 'run') {
    p.pose = 'stand';
  }
  if (input.mouseDown && G.weapon !== 'fists') p.pose = 'aim';
  else if (p.pose === 'aim' && !input.mouseDown) p.pose = 'stand';

  p.x = clamp(p.x, -250, 290);
  p.z = clamp(p.z, -306, 306);
  keepOutOfBuildings(p);
  keepOutOfCars(p);

  if (input.pressed['KeyE']) {
    const car = findEnterableCar();
    if (car) { enterCar(car); return; }
  }
  posePerson(p.mesh, p.pose, p.phase * (p.pose === 'run' ? 1.6 : 1));
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}
