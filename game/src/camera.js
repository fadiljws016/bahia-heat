// camera.js — third-person follow camera for live play, plus the staged
// camera staging locks onto for the screenshot scenes.

import { G } from './state.js';
import { clamp, lerp } from './util.js';
import { input } from './input.js';

let _smoothX = 0, _smoothY = 2, _smoothZ = 0, _init = false;

// Pin the camera to an exact seat and look target (screenshot staging).
export function stageCamera(x, y, z, lookX, lookY, lookZ) {
  G.stagedCam = { x, y, z, lookX, lookY, lookZ };
  if (G.camera) {
    G.camera.position.set(x, y, z);
    G.camera.lookAt(lookX, lookY, lookZ);
  }
}

export function clearStagedCamera() {
  G.stagedCam = null;
  _init = false;
}

export function updateCamera(dt) {
  const cam = G.camera;
  if (!cam) return;
  if (G.stagedCam) {
    const s = G.stagedCam;
    cam.position.set(s.x, s.y, s.z);
    cam.lookAt(s.lookX, s.lookY, s.lookZ);
    return;
  }
  const p = G.player;
  if (!p) return;
  // Mouse orbit around the player; the car pulls the camera back and down.
  const yaw = input.yaw;
  const pitch = clamp(input.pitch, -0.12, 0.62);
  const dist = p.car ? 9.5 : 6.2;
  const height = p.car ? 3.2 : 2.4;
  const tx = (p.car ? p.car.x : p.x) - Math.sin(yaw) * Math.cos(pitch) * dist;
  const tz = (p.car ? p.car.z : p.z) - Math.cos(yaw) * Math.cos(pitch) * dist;
  const ty = height + Math.sin(pitch) * dist;
  if (!_init) { _smoothX = tx; _smoothY = ty; _smoothZ = tz; _init = true; }
  const k = Math.min(1, dt * (p.car ? 5 : 8));
  _smoothX = lerp(_smoothX, tx, k);
  _smoothY = lerp(_smoothY, Math.max(0.7, ty), k);
  _smoothZ = lerp(_smoothZ, tz, k);
  cam.position.set(_smoothX, _smoothY, _smoothZ);
  const lookX = (p.car ? p.car.x : p.x) + Math.sin(yaw) * 4;
  const lookZ = (p.car ? p.car.z : p.z) + Math.cos(yaw) * 4;
  cam.lookAt(lookX, 1.3, lookZ);
}
