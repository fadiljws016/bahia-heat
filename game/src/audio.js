// audio.js — every sound in Bahia Heat is synthesized with WebAudio: engine
// hum, two-tone sirens, gunfire, explosions, traffic horns, the ocean, and
// three radio stations that are nothing but scheduled oscillator arpeggios.
// No audio files exist. The context is created lazily on the first user
// gesture (browser policy), and screenshot modes stay silent.

let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;
let radioTimer = null;
let radioStep = 0;
let oceanStarted = false;

export const STATIONS = [
  { name: 'Radio Alba 98.4', track: '“Sol de Medianoche” — Los Faros', root: 220, scale: [0, 3, 5, 7, 10, 12, 15], tempo: 0.21, wave: 'triangle' },
  { name: 'Costa FM 104.9', track: '“Neón y Sal” — Vera del Mar', root: 196, scale: [0, 2, 4, 7, 9, 12, 14], tempo: 0.17, wave: 'square' },
  { name: 'Noche 101.1', track: '“Muelle Oscuro” — DJ Faro', root: 164.8, scale: [0, 3, 5, 6, 10, 12, 13], tempo: 0.26, wave: 'sawtooth' },
];
let stationIndex = 0;

export function currentStation() { return STATIONS[stationIndex]; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    startOcean();
    startRadio();
  } catch { ctx = null; }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}
export function isMuted() { return muted; }

export function cycleStation() {
  stationIndex = (stationIndex + 1) % STATIONS.length;
  radioStep = 0;
  return STATIONS[stationIndex];
}

/** A buffer of white noise, reused by every noise-based sound. */
let noiseBuffer = null;
function getNoise() {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noiseBurst({ dur = 0.2, freq = 1200, q = 0.8, gain = 0.4, type = 'bandpass', sweepTo = null }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = getNoise();
  const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.setValueAtTime(freq, t); filter.Q.value = q;
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

function tone({ freq = 440, dur = 0.15, type = 'sine', gain = 0.25, sweepTo = null, delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator(); osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

export const sfx = {
  shot() { noiseBurst({ dur: 0.11, freq: 2600, gain: 0.5 }); tone({ freq: 160, dur: 0.08, type: 'square', gain: 0.12, sweepTo: 60 }); },
  shotgun() { noiseBurst({ dur: 0.24, freq: 1100, gain: 0.7 }); tone({ freq: 120, dur: 0.18, type: 'square', gain: 0.2, sweepTo: 45 }); },
  dryFire() { tone({ freq: 1900, dur: 0.03, type: 'square', gain: 0.08 }); },
  click() { tone({ freq: 1500, dur: 0.03, type: 'square', gain: 0.07 }); },
  swing() { noiseBurst({ dur: 0.13, freq: 900, gain: 0.16, type: 'lowpass', sweepTo: 240 }); },
  punch() { noiseBurst({ dur: 0.07, freq: 500, gain: 0.3, type: 'lowpass' }); },
  hit() { tone({ freq: 200, dur: 0.1, type: 'sine', gain: 0.3, sweepTo: 70 }); },
  crash(big = false) { noiseBurst({ dur: big ? 0.4 : 0.18, freq: 700, gain: big ? 0.6 : 0.3, type: 'lowpass' }); },
  explosion() {
    noiseBurst({ dur: 0.9, freq: 300, gain: 0.9, type: 'lowpass', sweepTo: 60 });
    tone({ freq: 90, dur: 0.8, type: 'sine', gain: 0.7, sweepTo: 30 });
  },
  chime() { tone({ freq: 880, dur: 0.12, gain: 0.2 }); tone({ freq: 1318, dur: 0.2, gain: 0.2, delay: 0.09 }); },
  cash() { tone({ freq: 1568, dur: 0.07, type: 'square', gain: 0.1 }); tone({ freq: 2093, dur: 0.12, type: 'square', gain: 0.1, delay: 0.06 }); },
  fail() { tone({ freq: 220, dur: 0.3, type: 'sawtooth', gain: 0.18, sweepTo: 110 }); },
  ui() { tone({ freq: 660, dur: 0.05, type: 'sine', gain: 0.12 }); },
  door() { tone({ freq: 140, dur: 0.09, type: 'sine', gain: 0.25, sweepTo: 80 }); },
  sirenBlip() { tone({ freq: 960, dur: 0.14, type: 'square', gain: 0.1 }); tone({ freq: 720, dur: 0.14, type: 'square', gain: 0.1, delay: 0.15 }); },
  horn() { tone({ freq: 370, dur: 0.22, type: 'square', gain: 0.09 }); tone({ freq: 466, dur: 0.22, type: 'square', gain: 0.07 }); },
  pop() { noiseBurst({ dur: 0.08, freq: 500, gain: 0.5, type: 'lowpass' }); tone({ freq: 220, dur: 0.12, type: 'sine', gain: 0.3, sweepTo: 50 }); },
  radioChatter() {
    tone({ freq: 1240, dur: 0.05, type: 'square', gain: 0.06 });
    noiseBurst({ dur: 0.16, freq: 1800, gain: 0.05 });
    tone({ freq: 980, dur: 0.05, type: 'square', gain: 0.06, delay: 0.2 });
  },
  heliThump() { tone({ freq: 58, dur: 0.16, type: 'sine', gain: 0.16, sweepTo: 40 }); },
};

/** Engine loop: a sawtooth whose pitch follows the player's car speed. */
export function setEngine(on, speedRatio = 0) {
  if (!ctx) return;
  if (on && !engineNodes) {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const sub = ctx.createOscillator(); sub.type = 'square';
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.0;
    osc.connect(filter); sub.connect(filter); filter.connect(g).connect(master);
    osc.start(); sub.start();
    engineNodes = { osc, sub, filter, g };
  }
  if (engineNodes) {
    const f = 55 + speedRatio * 165;
    engineNodes.osc.frequency.value = f;
    engineNodes.sub.frequency.value = f / 2;
    engineNodes.filter.frequency.value = 320 + speedRatio * 700;
    engineNodes.g.gain.value = muted ? 0 : (on ? 0.05 + speedRatio * 0.05 : 0);
    if (!on) { const n = engineNodes; engineNodes = null; setTimeout(() => { try { n.osc.stop(); n.sub.stop(); } catch { /* done */ } }, 250); }
  }
}

/** Siren loop while police are close; `near` is 0..1 loudness. */
export function setSiren(near) {
  if (!ctx) return;
  if (near > 0.02 && !sirenNodes) {
    const osc = ctx.createOscillator(); osc.type = 'triangle';
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.frequency.value = 830;
    const g = ctx.createGain(); g.gain.value = 0;
    osc.connect(g).connect(master);
    osc.start(); lfo.start();
    sirenNodes = { osc, lfo, g };
  }
  if (sirenNodes) {
    sirenNodes.g.gain.value = muted ? 0 : near * 0.055;
    if (near <= 0.02) { const n = sirenNodes; sirenNodes = null; setTimeout(() => { try { n.osc.stop(); n.lfo.stop(); } catch { /* done */ } }, 300); }
  }
}

function startOcean() {
  if (!ctx || oceanStarted) return;
  oceanStarted = true;
  const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
  const g = ctx.createGain(); g.gain.value = 0.035;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.018;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(filter).connect(g).connect(master);
  src.start(); lfo.start();
}

/** The radio: a step sequencer playing each station's scale as an arpeggio. */
function startRadio() {
  if (!ctx || radioTimer) return;
  const tick = () => {
    if (!muted && ctx) {
      const st = STATIONS[stationIndex];
      const degree = [0, 2, 4, 1, 3, 5, 4, 2][radioStep % 8];
      const semis = st.scale[degree % st.scale.length] + (radioStep % 16 >= 8 ? 12 : 0);
      const freq = st.root * Math.pow(2, semis / 12);
      tone({ freq, dur: st.tempo * 1.8, type: st.wave, gain: 0.045 });
      if (radioStep % 4 === 0) tone({ freq: st.root / 2, dur: st.tempo * 2.6, type: 'sine', gain: 0.06 });
      radioStep += 1;
      radioTimer = setTimeout(tick, st.tempo * 1000);
    } else {
      radioTimer = setTimeout(tick, 300);
    }
  };
  tick();
}
