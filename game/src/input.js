// Meridian Heat — keyboard and mouse input.
// WASD/arrows move, E enters/exits cars, F punches, mouse aims, click shoots,
// Space is the handbrake, M mutes, P pauses, Enter confirms menus.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 640, y: 400, down: false, clicked: false };
  const pressed = new Set();

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 1280;
    mouse.y = ((e.clientY - r.top) / r.height) * 800;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 1280;
    mouse.y = ((e.clientY - r.top) / r.height) * 800;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    keys,
    mouse,
    // True only on the frame the key went down.
    wasPressed(name) { return pressed.has(name); },
    isDown(name) { return keys.has(name); },
    axis() {
      let x = 0; let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      return { x, y };
    },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
