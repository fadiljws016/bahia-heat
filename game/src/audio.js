// audio.js — everything is synthesized WebAudio: three radio stations
// (chord loops with a bass line), an engine hum tied to speed, a siren
// that swells as cruisers close in, and one-shot sfx for shots, hits,
// cash and doors. No audio files, no network.

let ctx = null;
let master = null;
let muted = false;
let stationIndex = 0;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let radioTimer = null;

export const STATIONS = [
  { name: 'Radio Alba 98.4', style: 'Sol de Medianoche — Los Faros', root: 220, chords: [[0, 4, 7], [-4, 0, 3], [-2, 2, 5], [-7, -3, 0]], tempo: 92 },
  { name: 'Onda Brava 101.1', style: 'Neón y Sal — Vera Cruz', root: 196, chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-2, 2, 5]], tempo: 104 },
  { name: 'Puerto Jazz 88.0', style: 'Turno de Noche — El Cuarteto Alba', root: 262, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-5, -1, 2, 5], [-7, -3, 0, 4]], tempo: 76 },
];

export function currentStation() { return STATIONS[stationIndex]; }

function ensureCtx() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch {
    return false;
  }
  return true;
}

function tone(freq, t, dur, type, vol, dest) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(dest || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function radioStep() {
  if (!ctx || muted) return;
  const st = STATIONS[stationIndex];
  const beat = 60 / st.tempo;
  const bar = Math.floor(ctx.currentTime / (beat * 4));
  const chord = st.chords[bar % st.chords.length];
  const t = ctx.currentTime + 0.05;
  for (const n of chord) {
    tone(st.root * Math.pow(2, n / 12), t, beat * 3.6, 'triangle', 0.05);
  }
  tone(st.root / 2, t, beat * 1.8, 'sine', 0.09);
  tone(st.root / 2 * Math.pow(2, (chord[0] + 7) / 12), t + beat * 2, beat * 1.8, 'sine', 0.07);
}

export function initAudio() {
  if (!ensureCtx()) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (!radioTimer) radioTimer = window.setInterval(radioStep, 900);
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    engineOsc.connect(lp);
    lp.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }
  if (!sirenOsc) {
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() { return muted; }

export function cycleStation() {
  stationIndex = (stationIndex + 1) % STATIONS.length;
  return STATIONS[stationIndex];
}

function blip(freqA, freqB, dur, type, vol) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqA, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, freq) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export const sfx = {
  shot(kind) { noiseBurst(kind === 'shotgun' ? 0.22 : 0.11, 0.5, kind === 'smg' ? 1500 : 900); blip(160, 50, 0.1, 'square', 0.12); },
  dryFire() { blip(900, 700, 0.04, 'square', 0.06); },
  hit() { noiseBurst(0.06, 0.25, 2400); },
  hurt() { blip(220, 90, 0.18, 'sawtooth', 0.14); },
  cash() { blip(880, 1320, 0.12, 'sine', 0.12); window.setTimeout(() => blip(1320, 1760, 0.14, 'sine', 0.1), 70); },
  door() { blip(140, 90, 0.12, 'sine', 0.16); },
  enter() { blip(300, 420, 0.09, 'sine', 0.1); },
  checkpoint() { blip(660, 990, 0.16, 'sine', 0.14); },
  fail() { blip(320, 110, 0.4, 'sawtooth', 0.12); },
  busted() { blip(520, 130, 0.7, 'square', 0.1); },
  explosion() { noiseBurst(0.7, 0.8, 160); blip(90, 34, 0.7, 'sine', 0.5); },
  splash() { noiseBurst(0.3, 0.2, 700); },
};

export function setEngine(on, speedRatio = 0) {
  if (!engineOsc) return;
  const t = ctx.currentTime;
  engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.05 : 0, t, 0.1);
  engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, t, 0.1);
}

export function setSiren(near) {
  if (!sirenOsc) return;
  const t = ctx.currentTime;
  sirenGain.gain.setTargetAtTime(near > 0 ? 0.012 + near * 0.03 : 0, t, 0.2);
  sirenOsc.frequency.setTargetAtTime(680 + Math.sin(t * 2.4) * 190, t, 0.05);
}
