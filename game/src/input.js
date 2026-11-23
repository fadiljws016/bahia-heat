// input.js — keyboard and mouse state, polled by the systems. `keys` is
// the held set; `pressed` is the edge-triggered set for one-shot actions
// (interact, weapon slots, map, pause), cleared by endFrame each frame.
// Mouse orbit deltas accumulate here for camera.js; `mouse.clicked` is
// the edge of a left press, for semi-auto fire; `wheelDelta` carries
// weapon cycling, so the wheel over the canvas never scrolls the page.
// Pointer lock is requested by main.js on canvas click during play;
// screenshot modes never lock — shots.js drives the camera directly.

export const input = {
  keys: new Set(),
  pressed: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  wheelDelta: 0,
  mouse: { down: false, rightDown: false, clicked: false },
  locked: false,
};

let installed = false;

/** Attach the listeners (once). Safe in headless screenshot runs too. */
export function initInput(canvas) {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys.delete(e.code); });
  // Losing focus also drops the banked orbit and wheel deltas: a stale
  // mouseDX saved before an alt-tab would otherwise dump into the
  // camera as one hard snap on the first frame back.
  window.addEventListener('blur', () => {
    input.keys.clear(); input.mouse.down = false;
    input.mouseDX = 0; input.mouseDY = 0; input.wheelDelta = 0;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouse.down = true; input.mouse.clicked = true; }
    if (e.button === 2) input.mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
    if (e.button === 2) input.mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.mouseDX += e.movementX || 0;
    input.mouseDY += e.movementY || 0;
  });
  window.addEventListener('wheel', (e) => {
    input.wheelDelta += Math.sign(e.deltaY);
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
}

/** Ask for pointer lock (must come from a user gesture). */
export function requestLock(canvas) {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
}

/** Clear the per-frame edges; main.js calls this at the end of every frame. */
export function endFrame() {
  input.pressed.clear();
  input.mouse.clicked = false;
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.wheelDelta = 0;
}
