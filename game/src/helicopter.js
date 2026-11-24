// helicopter.js — FALCON-1, the PAPD air unit. THE RECIPE IS LOCKED:
// orbit radius 33 m around the player, the orbit pin sets the angle
// outright (staging freezes the clock so -3.53 holds the airframe due
// north of the player), and the searchlight is a ConeGeometry hung from
// the belly by lookAt + rotateX(-PI/2) — apex at the helicopter, base
// widening down to the pool on the suspect. Do not improvise this.

import { G } from './state.js';

let heli = null;
let rotor = null;
let tailRotor = null;
let beam = null;
let beamLight = null;
let pool = null;
let strobeMat = null;
let navRedMat = null;
let orbitAngle = 0.8;
let forcedOrbit = null;
let forcedAltitude = null;

export function initHeli() {
  const scene = G.scene;
  heli = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x27313a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 5.6), bodyMat);
  body.castShadow = true;
  heli.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 1.4), new THREE.MeshPhongMaterial({ color: 0x1c2a36, shininess: 80 }));
  nose.position.set(0, -0.1, 3.2);
  heli.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 4.4), bodyMat);
  tail.position.set(0, 0.3, -4.6);
  heli.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.7), darkMat);
  fin.position.set(0, 0.7, -6.6);
  heli.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 5.64), darkMat);
  stripe.position.y = -0.3;
  heli.add(stripe);
  // Main rotor: two crossed blades on a mast.
  rotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.06, 0.5), bladeMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 11.4), bladeMat);
  rotor.add(b1);
  rotor.add(b2);
  rotor.position.y = 1.15;
  heli.add(rotor);
  tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.24), bladeMat);
  tailRotor.position.set(0.35, 0.7, -6.6);
  heli.add(tailRotor);
  // Skids.
  for (const sx of [-0.95, 0.95]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.6), darkMat);
    skid.position.set(sx, -1.25, 0.2);
    heli.add(skid);
    for (const sz of [-1.4, 1.4]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), darkMat);
      strut.position.set(sx, -0.9, sz);
      heli.add(strut);
    }
  }
  // Nav lights: white strobe + port red.
  strobeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const strobe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), strobeMat);
  strobe.position.set(0, 1.35, -6.6);
  heli.add(strobe);
  navRedMat = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
  const nav = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), navRedMat);
  nav.position.set(-1.15, 0, 0.6);
  heli.add(nav);
  heli.visible = false;
  scene.add(heli);

  // The beam: a translucent open cone + a real spotlight + a pool disc.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  beam = new THREE.Mesh(new THREE.ConeGeometry(6.5, 46, 14, 1, true), coneMat);
  beam.visible = false;
  scene.add(beam);
  beamLight = new THREE.SpotLight(0xfff2c0, 0, 90, 0.32, 0.5, 0.6);
  scene.add(beamLight);
  scene.add(beamLight.target);
  pool = new THREE.Mesh(
    new THREE.CircleGeometry(5.6, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  scene.add(pool);
  G.heli = { x: 0, z: 0, active: false };
}

export function setHeliOrbit(angle) {
  forcedOrbit = angle;
  orbitAngle = angle;
}

export function setHeliAltitude(y) {
  forcedAltitude = y;
}

export function updateHeli(dt) {
  if (!heli) return;
  const active = G.wanted >= 2.8 && (G.mode === 'playing' || !!G.shotMode);
  heli.visible = active;
  if (G.heli) G.heli.active = active;
  beam.visible = active && G.isDusk;
  if (!active) {
    beamLight.intensity = 0;
    if (pool) pool.material.opacity = 0;
    G.heliSeesPlayer = false;
    return;
  }
  if (forcedOrbit === null) orbitAngle += dt * 0.32;
  else orbitAngle = forcedOrbit;
  const p = G.player;
  if (!p) return;
  const r = 33;
  const hx = p.x + Math.sin(orbitAngle) * r;
  const hz = p.z + Math.cos(orbitAngle) * r;
  const hy = forcedAltitude !== null ? forcedAltitude : 30 + Math.sin(G.elapsed * 0.6) * 2;
  heli.position.set(hx, hy, hz);
  heli.rotation.y = Math.atan2(p.x - hx, p.z - hz);
  heli.rotation.z = 0.16;
  if (G.heli) { G.heli.x = hx; G.heli.z = hz; }
  rotor.rotation.y += dt * 28;
  tailRotor.rotation.x += dt * 32;
  const blink = (G.elapsed % 1.5) < 0.08 || ((G.elapsed + 0.18) % 1.5) < 0.08;
  strobeMat.color.setHex(blink ? 0xffffff : 0x333333);
  navRedMat.color.setHex(Math.floor(G.elapsed * 1.4) % 2 ? 0xff2a1e : 0x661008);
  G.heliSeesPlayer = true;
  // The beam hangs from the belly to the suspect; the pool sits on him.
  beam.position.set((hx + p.x) / 2, hy / 2, (hz + p.z) / 2);
  beam.lookAt(p.x, 0, p.z);
  beam.rotateX(-Math.PI / 2);
  beam.material.opacity = G.isDusk ? 0.16 : 0.05;
  beamLight.position.set(hx, hy - 1, hz);
  beamLight.target.position.set(p.x, 0, p.z);
  beamLight.intensity = G.isDusk ? 2.4 : 0.7;
  pool.position.set(p.x, 0.09, p.z);
  pool.material.opacity = G.isDusk ? 0.35 : 0.12;
}
