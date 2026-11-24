// helicopter.js — FALCON-1, the PAPD air unit: a full helicopter model
// (body, rotor, tail, skids) whose spotlight cone is narrow at the airframe
// and widens down to a pool on the street. Staging pins it with
// setHeliAltitude / setHeliOrbit; in live play it hunts the player.

import { G } from './state.js';
import { clamp, lerp, lerpAngle } from './util.js';

let _heli = null;      // group
let _rotor = null;
let _tailRotor = null;
let _beam = null;
let _pool = null;
let _orbit = 0.8;      // current orbit angle around the player
const _aimVec = new THREE.Vector3();
const _downVec = new THREE.Vector3(0, -1, 0);
let _orbitPin = null;  // staging override
let _altitude = 26;
let _altPin = null;

export function setHeliOrbit(angle) { _orbitPin = angle; _orbit = angle; }
export function setHeliAltitude(y) { _altPin = y; _altitude = y; }

export function initHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8e6df });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x27313a });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0x274b63 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 4.6), bodyMat);
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.4), accentMat);
  nose.position.set(0, -0.15, 2.7);
  g.add(nose);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.0),
    new THREE.MeshPhongMaterial({ color: 0x14202c, shininess: 90, specular: 0x99ccee }));
  glass.position.set(0, 0.25, 2.5);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 4.4), bodyMat);
  tail.position.set(0, 0.25, -4.2);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.8), accentMat);
  fin.position.set(0, 0.8, -6.3);
  g.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.3, 4.64), accentMat);
  stripe.position.y = -0.45;
  g.add(stripe);

  _tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.18), darkMat);
  _tailRotor.position.set(0.3, 0.8, -6.3);
  g.add(_tailRotor);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), darkMat);
  mast.position.y = 1.05;
  g.add(mast);
  _rotor = new THREE.Group();
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x22242a });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 11.4), bladeMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.04, 0.34), bladeMat);
  _rotor.add(b1); _rotor.add(b2);
  _rotor.position.y = 1.32;
  g.add(_rotor);

  // Skids.
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x3c4248 });
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.4), skidMat);
    skid.position.set(sx * 1.05, -1.55, 0.2);
    g.add(skid);
    for (const sz of [-1.2, 1.2]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), skidMat);
      strut.position.set(sx * 1.0, -1.15, sz);
      strut.rotation.z = sx * 0.3;
      g.add(strut);
    }
  }

  // Spotlight cone: apex at the airframe, mouth widening down to the pool.
  // It lives in the scene, not on the airframe, so updateHeli can aim it at
  // the player and stretch it to the slant range.
  const beamGeo = new THREE.ConeGeometry(6.4, 24, 20, 1, true);
  beamGeo.translate(0, -12, 0);
  _beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0xfff3cf, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  _beam.visible = false;
  _pool = new THREE.Mesh(new THREE.CircleGeometry(6.2, 20), new THREE.MeshBasicMaterial({
    color: 0xfff3cf, transparent: true, opacity: 0.22, depthWrite: false,
  }));
  _pool.rotation.x = -Math.PI / 2;

  g.position.set(-212, 26, 60);
  if (G.scene) {
    G.scene.add(g);
    G.scene.add(_pool);
    G.scene.add(_beam);
  }
  _heli = g;
  G.heli = { group: g, orbit: _orbit, altitude: _altitude };
  return g;
}

export function updateHeli(dt) {
  if (!_heli) return;
  _rotor.rotation.y += dt * 22;
  _tailRotor.rotation.x += dt * 30;
  const p = G.player;
  const tx = p ? p.x : -212;
  const tz = p ? p.z : 0;
  const sees = G.heliSeesPlayer || (G.wanted >= 2 && !G.shotMode);
  if (_orbitPin === null && !G.shotMode) _orbit += dt * 0.16;
  const alt = _altPin !== null ? _altPin : (sees ? 24 : 34);
  _altitude = lerp(_altitude, alt, Math.min(1, dt * 1.5));
  const r = sees ? 34 : 40;
  const hx = tx + Math.sin(_orbit) * r;
  const hz = tz + Math.cos(_orbit) * r;
  _heli.position.x = lerp(_heli.position.x, hx, Math.min(1, dt * 1.8));
  _heli.position.z = lerp(_heli.position.z, hz, Math.min(1, dt * 1.8));
  _heli.position.y = lerp(_heli.position.y, _altitude, Math.min(1, dt * 1.8));
  // Nose toward the direction of travel / the player when it sees him.
  const face = sees ? Math.atan2(tx - _heli.position.x, tz - _heli.position.z)
    : Math.atan2(Math.cos(_orbit), -Math.sin(_orbit));
  _heli.rotation.y = lerpAngle(_heli.rotation.y, face, Math.min(1, dt * 2.4));
  _heli.rotation.z = clamp(Math.sin(_orbit * 2) * 0.04, -0.06, 0.06);
  // Beam and pool only at dusk/night, and only while it has eyes on him.
  const beamOn = G.isDusk && sees;
  _beam.visible = beamOn;
  _pool.visible = beamOn;
  if (beamOn) {
    _pool.position.set(tx, 0.12, tz);
    const flicker = 0.2 + Math.sin(performance.now() * 0.02) * 0.015;
    _pool.material.opacity = flicker;
    // Aim the cone from the airframe down to the pool on the player.
    _beam.position.set(_heli.position.x, _heli.position.y - 0.9, _heli.position.z);
    _aimVec.set(tx - _beam.position.x, 0.1 - _beam.position.y, tz - _beam.position.z);
    const len = _aimVec.length();
    _beam.scale.set(1, len / 24, 1);
    _aimVec.normalize();
    _beam.quaternion.setFromUnitVectors(_downVec, _aimVec);
  }
  if (G.heli) { G.heli.orbit = _orbit; G.heli.altitude = _altitude; }
}
