// camera.js — the third-person camera: a mouse-orbit follow on foot,
// close enough that the player and whatever he is holding fill the frame
// while a street fight stays readable, and a smoothed chase camera in a
// car that widens with speed and settles behind the vehicle unless the
// mouse argues. Screenshot modes bypass all of it: shots.js places the
// lens through stageCamera() (its own staging helper), and this file's
// stageCamera export below serves the same purpose for any caller that
// wants the orbit state kept consistent with the placed lens.
import { G } from './state.js';
import { input } from './input.js';
import { clamp, lerp } from './util.js';

const lookTarget = new THREE.Vector3();
const desired = new THREE.Vector3();

/** Crosshair aim point: project the screen centre into the world at chest height. */
function updateAimPoint() {
  const cam = G.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const p = G.player;
  // Walk the ray to the point closest to the player's chest line.
  const t = Math.max(6, ((p.x - cam.position.x) * dir.x + (p.z - cam.position.z) * dir.z) / (dir.x * dir.x + dir.z * dir.z + 1e-6));
  G.aimPoint = {
    x: cam.position.x + dir.x * t,
    z: cam.position.z + dir.z * t,
  };
}

export function updateCamera(dt) {
  const p = G.player;
  const cam = G.camera;
  if (!cam) return;

  // Mouse orbit accumulates into yaw/pitch.
  G.camYaw -= input.mouseDX * 0.0032;
  G.camPitch = clamp(G.camPitch + input.mouseDY * 0.0028, -0.12, 0.95);

  let dist, height;
  if (p.inCar) {
    const speed = Math.abs(p.inCar.speed);
    dist = 7.4 + speed * 0.045; // tight chase framing, still readable
    height = 2.9 + speed * 0.012;
    // In a car the camera settles behind the vehicle unless the mouse argues.
    if (Math.abs(input.mouseDX) < 0.5) {
      const behind = p.inCar.heading + Math.PI;
      let diff = behind - G.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      G.camYaw += diff * Math.min(1, dt * (1.4 + speed * 0.03));
    }
  } else {
    dist = 5.0;
    height = 2.3;
  }

  const back = new THREE.Vector3(Math.sin(G.camYaw), 0, Math.cos(G.camYaw));
  desired.set(
    p.x + back.x * Math.cos(G.camPitch) * dist,
    height + Math.sin(G.camPitch) * dist * 0.7,
    p.z + back.z * Math.cos(G.camPitch) * dist,
  );
  const k = 1 - Math.pow(0.0001, dt); // frame-rate independent smoothing
  cam.position.lerp(desired, p.inCar ? Math.min(1, k * 0.8) : k);
  if (cam.position.y < 0.7) cam.position.y = 0.7;

  lookTarget.set(p.x, 1.6, p.z);
  cam.lookAt(lookTarget);

  // Impact shake decays.
  if (G.cameraShake > 0) {
    cam.position.x += (Math.random() - 0.5) * G.cameraShake * 0.5;
    cam.position.y += (Math.random() - 0.5) * G.cameraShake * 0.4;
    G.cameraShake = Math.max(0, G.cameraShake - dt * 1.8);
  }
  updateAimPoint();
}

/** Place the camera exactly (screenshot staging). Also fixes the aim point. */
export function stageCamera(x, y, z, lookX, lookY, lookZ) {
  const cam = G.camera;
  cam.position.set(x, y, z);
  cam.lookAt(lookX, lookY, lookZ);
  G.camYaw = Math.atan2(x - lookX, z - lookZ);
  // Keep the orbit pitch roughly where the staged lens points, so a shot
  // scene handed back to the live camera doesn't snap upright.
  G.camPitch = clamp(Math.atan2(y - lookY, Math.hypot(x - lookX, z - lookZ)), -0.12, 0.95);
  G.aimPoint = { x: lookX, z: lookZ };
}
