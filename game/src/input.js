// input.js — keyboard + mouse state. Modules poll the `input` object;
// one-shot actions (interact, map, dialogue advance) read edge flags that
// endFrame() clears at the end of each tick.

export const input = {
  keys: {},
  forward: 0,
  strafe: 0,
  sprint: false,
  mouseDX: 0,
  mouseDY: 0,
  firing: false,
  clicked: false, // left button pressed this frame
  interact: false, // E pressed this frame
  mapToggle: false, // M pressed this frame
  advance: false, // E / click during dialogue
  pause: false,
  locked: false,
};

const EDGE = { KeyE: 'interact', KeyM: 'mapToggle', Escape: 'pause' };

export function initInput(canvas) {
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    input.keys[ev.code] = true;
    if (EDGE[ev.code]) input[EDGE[ev.code]] = true;
    if (ev.code === 'KeyE' || ev.code === 'Space') input.advance = true;
  });
  window.addEventListener('keyup', (ev) => { input.keys[ev.code] = false; });
  window.addEventListener('mousemove', (ev) => {
    if (!input.locked) return;
    input.mouseDX += ev.movementX || 0;
    input.mouseDY += ev.movementY || 0;
  });
  window.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) {
      input.firing = true;
      input.clicked = true;
      input.advance = true;
    }
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) input.firing = false;
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
}

export function requestLock(canvas) {
  if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
}

export function endFrame() {
  const k = input.keys;
  input.forward = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  input.strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  input.sprint = !!k.ShiftLeft || !!k.ShiftRight;
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.clicked = false;
  input.interact = false;
  input.mapToggle = false;
  input.advance = false;
  input.pause = false;
}
