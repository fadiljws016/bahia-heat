// helicopter.js — FALCON-1, the PAPD air unit. At three stars and up it
// joins the hunt: a low-poly helicopter that orbits the suspect with
// blinking nav lights, and at dusk its searchlight cone pins the player
// to the road in a bright pool — under the light, the police always know
// where you are (G.heliSeesPlayer feeds the sight state in police.js).
// G.heli carries { active, x, z } for the minimap and the dispatch board.
//
// Two staging pins exist for the screenshot scenes, and only shots.js
// sets them: setHeliOrbit fixes the orbit phase, and setHeliAltitude
// lowers the hover (live flight bobs around y 30, which puts the whole
// airframe above the staged chase lens) so rotor, body, tail and skids
// all sit inside the frame. Live flight never sees either pin.
import { G } from './state.js';
import { sfx } from './audio.js';

let heli = null;
let rotor = null;
let tailRotor = null;
let beam = null;
let beamLight = null;
let pool = null;
let strobeMat = null;
let navRedMat = null;
let orbitAngle = 0.8;
let forcedOrbit = null; // screenshot staging pins the orbit phase
let forcedAltitude = null; // screenshot staging pins the hover height (round eight)

function buildHelicopter() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2b4a73 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 90 });

  const box = (mat, sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  box(bodyMat, 2.2, 1.9, 4.6, 0, 0, 0); // fuselage
  box(glassMat, 2.0, 1.1, 1.4, 0, 0.15, 2.2); // cockpit glass
  box(bodyMat, 0.7, 0.7, 4.4, 0, 0.3, -4.2); // tail boom
  box(bodyMat, 0.18, 1.5, 0.9, 0, 0.75, -6.3); // tail fin
  box(darkMat, 3.4, 0.14, 0.5, 0, -1.25, 0.4); // skid crossbar
  box(darkMat, 0.24, 0.5, 3.6, -1.5, -1.0, 0.3);
  box(darkMat, 0.24, 0.5, 3.6, 1.5, -1.0, 0.3);
  // A white belly stripe so the airframe reads against a dusk sky.
  box(new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 2.24, 0.4, 4.64, 0, -0.72, 0);

  // Nav lights: red port, green starboard, white strobe on the tail.
  navRedMat = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
  const navGreenMat = new THREE.MeshBasicMaterial({ color: 0x2eff5a });
  strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const nl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), navRedMat);
  nl.position.set(-1.2, 0.2, 1.4); group.add(nl);
  const nr = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), navGreenMat);
  nr.position.set(1.2, 0.2, 1.4); group.add(nr);
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), strobeMat);
  st.position.set(0, 1.6, -6.3); group.add(st);

  rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7), darkMat);
  rotor.position.y = 1.35;
  group.add(rotor);
  tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.3), darkMat);
  tailRotor.position.set(0.2, 0.75, -6.3);
  group.add(tailRotor);

  // The searchlight: a translucent cone + a real spotlight + a pool disc.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  beam = new THREE.Mesh(new THREE.ConeGeometry(6.5, 46, 14, 1, true), coneMat);
  beam.visible = false;
  G.scene.add(beam);
  beamLight = new THREE.SpotLight(0xfff2c0, 0, 90, 0.32, 0.5, 0.6);
  G.scene.add(beamLight);
  G.scene.add(beamLight.target);
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xfff6cf, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  pool = new THREE.Mesh(new THREE.CircleGeometry(6.2, 20), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.14;
  G.scene.add(pool);

  group.visible = false;
  G.scene.add(group);
  return group;
}

export function initHeli() {
  heli = buildHelicopter();
  G.heli = { active: false, x: 0, z: 0 };
}

/** Screenshot staging: pin the orbit phase so the air unit sits in frame. */
export function setHeliOrbit(angle) {
  forcedOrbit = angle;
  orbitAngle = angle;
}

/**
 * Screenshot staging: pin the hover height so the whole airframe —
 * rotor disc, fuselage, tail boom and skids — fits inside the staged
 * lens. Staging only: updateHeli reads the pin solely while it is
 * set, and only shots.js sets it, so live flight is untouched.
 */
export function setHeliAltitude(y) {
  forcedAltitude = y;
}

/** Orbit the player at 3★+; stand down (hide) below that. */
export function updateHeli(dt) {
  if (!heli) return;
  const active = G.wanted >= 2.8 && (G.mode === 'playing' || !!G.shotMode);
  heli.visible = active;
  if (G.heli) { G.heli.active = active; }
  beam.visible = active && G.isDusk;
  if (!active) {
    beamLight.intensity = 0;
    if (pool) pool.material.opacity = 0;
    G.heliSeesPlayer = false;
    return;
  }
  orbitAngle += dt * 0.32;
  const p = G.player;
  const r = 33; // one metre tighter than round three: the airframe fills a staged frame better
  const hx = p.x + Math.sin(orbitAngle) * r;
  const hz = p.z + Math.cos(orbitAngle) * r;
  // Live flight bobs around y 30; a staged frame may pin the hover
  // lower (setHeliAltitude) so the airframe fits its lens.
  const hy = forcedAltitude !== null ? forcedAltitude : 30 + Math.sin(G.elapsed * 0.6) * 2;
  heli.position.set(hx, hy, hz);
  heli.rotation.y = Math.atan2(p.x - hx, p.z - hz);
  heli.rotation.z = 0.16;
  if (G.heli) { G.heli.x = hx; G.heli.z = hz; }
  rotor.rotation.y += dt * 28;
  tailRotor.rotation.x += dt * 32;
  // Strobes: the tail light double-blinks; the port light pulses.
  const blink = (G.elapsed % 1.5) < 0.08 || ((G.elapsed + 0.18) % 1.5) < 0.08;
  strobeMat.color.setHex(blink ? 0xffffff : 0x333333);
  navRedMat.color.setHex(Math.floor(G.elapsed * 1.4) % 2 ? 0xff2a1e : 0x661008);

  // Under the beam, the PAPD has eyes on the player.
  G.heliSeesPlayer = true;

  // The beam hangs from the belly to the suspect; the pool sits on him.
  beam.position.set((hx + p.x) / 2, hy / 2, (hz + p.z) / 2);
  beam.lookAt(p.x, 0, p.z);
  // Cone direction matters: ConeGeometry puts the apex on +Y and the
  // wide base on −Y, and lookAt aims +Z at the suspect, so the flip
  // below is what makes the beam narrow at the airframe and spread as
  // it falls to the pool — a real searchlight's shape. (The reversed
  // sign once shipped: wide at the helicopter, pinched at the street.)
  beam.rotateX(-Math.PI / 2);
  beam.material.opacity = G.isDusk ? 0.16 : 0.05;
  beamLight.position.set(hx, hy, hz);
  beamLight.target.position.set(p.x, 0, p.z);
  beamLight.intensity = G.isDusk ? 2.7 : 0.7;
  pool.position.set(p.x, 0.14, p.z);
  pool.material.opacity = G.isDusk ? 0.38 : 0.1;
  if (Math.floor(G.elapsed * 2) !== Math.floor((G.elapsed - dt) * 2)) sfx.heliThump();
}
