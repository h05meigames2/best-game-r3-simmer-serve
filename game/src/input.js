// Keyboard and mouse input, kept apart from the rules so the world can be
// driven by a scripted autopilot too (screenshots, tests).
export function createInput() {
  return {
    keys: new Set(),
    /** Click target in logical field coordinates, consumed once. */
    click: null,
    /** Keys pressed since the last poll, consumed once. */
    pressed: new Set(),
  };
}

export function attachInput(input, canvas, toLogical) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.key.toLowerCase());
    input.keys.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.click = toLogical(event.clientX - rect.left, event.clientY - rect.top);
  });
}

/** Movement axes from WASD or arrow keys: -1, 0 or 1 each. */
export function moveAxes(input) {
  const k = input.keys;
  const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  const y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
  return { x, y };
}

/** True once for a key pressed since the last poll. */
export function wasPressed(input, ...names) {
  for (const name of names) {
    if (input.pressed.has(name)) return true;
  }
  return false;
}

export function endFrame(input) {
  input.pressed.clear();
  input.click = null;
}
