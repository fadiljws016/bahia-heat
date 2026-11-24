// camera.js — the follow camera and the staged camera. In shot mode the
// camera is whatever stageCamera last set; the follow rig stands down.

import { G } from './state.js';
import { lerp, lerpAngle, clamp } from './util.js';
import { input } from './input.js';

let yaw = 0;
let pitch = 0.32;
let staged = false;
const camPos = new THREE.Vector3(-195.9, 1.55, -3.1);
const camLook = new THREE.Vector3(-192.9, 1.2, -6.1);

export function camYaw() { return yaw; }

export function stageCamera(x, y, z, lookX, lookY, lookZ) {
  staged = true;
  camPos.set(x, y, z);
  camLook.set(lookX, lookY, lookZ);
  if (G.camera) {
    G.camera.position.copy(camPos);
    G.camera.lookAt(camLook);
  }
}

export function updateCamera(dt) {
  const cam = G.camera;
  if (!cam) return;
  if (G.shotMode || staged) {
    cam.position.copy(camPos);
    cam.lookAt(camLook);
    return;
  }
  const p = G.player;
  if (!p) return;
  yaw -= input.mouseDX * 0.0032;
  pitch = clamp(pitch + input.mouseDY * 0.0028, -0.1, 1.1);
  const inCar = !!p.car;
  const dist = inCar ? 8.6 : 5.4;
  const height = inCar ? 3.0 : 2.3;
  const anchorYaw = inCar ? p.car.heading : p.heading;
  if (input.mouseDX === 0 && (input.forward !== 0)) yaw = lerpAngle(yaw, anchorYaw + Math.PI, dt * 2.2);
  const tx = p.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const tz = p.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const ty = height + Math.sin(pitch) * dist;
  cam.position.x = lerp(cam.position.x, tx, 1 - Math.pow(0.0001, dt));
  cam.position.y = lerp(cam.position.y, Math.max(0.6, ty), 1 - Math.pow(0.0001, dt));
  cam.position.z = lerp(cam.position.z, tz, 1 - Math.pow(0.0001, dt));
  cam.lookAt(p.x, 1.4, p.z);
  // FOV kick at speed.
  const target = inCar ? 62 + Math.min(14, Math.abs(p.car.speed) * 0.28) : 58;
  if (Math.abs(cam.fov - target) > 0.1) {
    cam.fov = lerp(cam.fov, target, dt * 3);
    cam.updateProjectionMatrix();
  }
}
