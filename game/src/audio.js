// audio.js — all sound is synthesized: three radio stations playing soft
// chord pads, an engine hum, a distant siren, and one-shot effects. No
// audio files, no network — the Web Audio graph is built on first use.

export const STATIONS = [
  { name: 'Radio Alba 98.4', song: '"Sol de Medianoche" — Los Faros', root: 220.0, mood: [0, 3, 7, 10] },
  { name: 'Onda Palma 101.1', song: '"Brisa" — DJ Coral', root: 261.6, mood: [0, 4, 7, 11] },
  { name: 'Radio Puerto 88.9', song: '"Marea Alta" — Trío Alba', root: 196.0, mood: [0, 3, 7, 9] },
];

let stationIndex = 0;
let _ctx = null;
let _master = null;
let _muted = false;
let _radioNodes = null;
let _engineOsc = null, _engineGain = null;
let _sirenOsc = null, _sirenGain = null;
let _chordTimer = 0;

export function currentStation() { return STATIONS[stationIndex]; }

export function initAudio() {
  if (_ctx) return;
  try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    _ctx = null;
    return;
  }
  _master = _ctx.createGain();
  _master.gain.value = 0.5;
  _master.connect(_ctx.destination);
  startRadio();
  startEngine();
  startSiren();
}

export function toggleMute() {
  _muted = !_muted;
  if (_master) _master.gain.value = _muted ? 0 : 0.5;
  return _muted;
}

export function isMuted() { return _muted; }

export function cycleStation() {
  stationIndex = (stationIndex + 1) % STATIONS.length;
  startRadio();
  return currentStation();
}

function pad(freq, t, dur, gainPeak) {
  const osc = _ctx.createOscillator();
  const g = _ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainPeak, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g); g.connect(_master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

function startRadio() {
  if (!_ctx) return;
  _chordTimer = 0;
  _radioNodes = { next: _ctx.currentTime + 0.1, step: 0 };
}

// Called from the main loop; schedules the station's chord loop ahead.
export function updateAudio(dt) {
  if (!_ctx || _muted) return;
  _chordTimer -= dt;
  if (_radioNodes && _chordTimer <= 0) {
    const st = currentStation();
    const t = Math.max(_ctx.currentTime, _radioNodes.next);
    const chord = st.mood;
    for (const semi of chord) pad(st.root * Math.pow(2, semi / 12), t, 2.6, 0.05);
    pad(st.root / 2, t, 2.6, 0.07);
    _radioNodes.next = t + 2.4;
    _radioNodes.step++;
    _chordTimer = 0.4;
  }
  if (_sirenOsc) {
    _sirenOsc.frequency.value = 720 + Math.sin(_ctx.currentTime * 4.4) * 140;
  }
}

function startEngine() {
  if (!_ctx) return;
  _engineOsc = _ctx.createOscillator();
  _engineOsc.type = 'sawtooth';
  _engineOsc.frequency.value = 55;
  const filter = _ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  _engineGain = _ctx.createGain();
  _engineGain.gain.value = 0;
  _engineOsc.connect(filter); filter.connect(_engineGain); _engineGain.connect(_master);
  _engineOsc.start();
}

function startSiren() {
  if (!_ctx) return;
  _sirenOsc = _ctx.createOscillator();
  _sirenOsc.type = 'sine';
  _sirenOsc.frequency.value = 720;
  _sirenGain = _ctx.createGain();
  _sirenGain.gain.value = 0;
  _sirenOsc.connect(_sirenGain); _sirenGain.connect(_master);
  _sirenOsc.start();
}

export function setEngine(on, speedRatio = 0) {
  if (!_ctx || !_engineOsc) return;
  const t = _ctx.currentTime;
  _engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.05 : 0, t, 0.12);
  _engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, t, 0.1);
}

export function setSiren(near) {
  if (!_ctx || !_sirenGain) return;
  _sirenGain.gain.setTargetAtTime(near ? 0.016 : 0, _ctx.currentTime, 0.3);
}

function blip(freqA, freqB, dur, type, gainPeak, slide = true) {
  if (!_ctx || _muted) return;
  const t = _ctx.currentTime;
  const osc = _ctx.createOscillator();
  const g = _ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqA, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
  g.gain.setValueAtTime(gainPeak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(_master);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, gainPeak, lowpass) {
  if (!_ctx || _muted) return;
  const t = _ctx.currentTime;
  const len = Math.max(1, (_ctx.sampleRate * dur) | 0);
  const buf = _ctx.createBuffer(1, len, _ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = _ctx.createBufferSource();
  src.buffer = buf;
  const filter = _ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = _ctx.createGain();
  g.gain.value = gainPeak;
  src.connect(filter); filter.connect(g); g.connect(_master);
  src.start(t);
}

export const sfx = {
  shot() { noiseBurst(0.14, 0.25, 2400); blip(220, 60, 0.1, 'square', 0.08); },
  dryFire() { blip(900, 500, 0.04, 'square', 0.05); },
  hit() { noiseBurst(0.08, 0.16, 1200); },
  crash() { noiseBurst(0.3, 0.3, 700); blip(120, 40, 0.28, 'sawtooth', 0.1); },
  explosion() { noiseBurst(0.8, 0.5, 420); blip(90, 28, 0.7, 'sine', 0.4); },
  pickup() { blip(660, 990, 0.12, 'sine', 0.1, false); },
  cash() { blip(880, 1320, 0.1, 'triangle', 0.1, false); },
  ui() { blip(520, 520, 0.05, 'triangle', 0.06, false); },
  busted() { blip(320, 110, 0.7, 'sawtooth', 0.14); },
  sirenPass() { blip(700, 940, 0.3, 'sine', 0.03); },
};
