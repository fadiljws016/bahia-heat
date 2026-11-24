// input.js — keyboard and mouse state. `keys` is level-triggered,
// `pressed` is edge-triggered for the current frame (endFrame clears it),
// mouse movement feeds the camera yaw/pitch while the pointer is locked.

export const input = {
  keys: {},
  pressed: {},
  yaw: 0,
  pitch: 0.24,
  mouseDown: false,
  mouseX: 0,
  mouseY: 0,
  locked: false,
};

let _canvas = null;

export function initInput(canvas) {
  _canvas = canvas;
  window.addEventListener('keydown', (e) => {
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  window.addEventListener('blur', () => { input.keys = {}; input.mouseDown = false; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) input.mouseDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    if (input.locked) {
      input.yaw -= (e.movementX || 0) * 0.0026;
      input.pitch += (e.movementY || 0) * 0.0022;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
}

export function requestLock(canvas) {
  const target = canvas || _canvas;
  if (target && target.requestPointerLock) target.requestPointerLock();
}

export function endFrame() {
  input.pressed = {};
}
