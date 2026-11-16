// Boot and the frame loop: scale the 1280x720 kitchen to the window, read
// input, step the world on a fixed clock, and draw every frame.
import { FIELD, STEP, SERVICE, BEST_KEY } from './config.js';
import { SCREEN, createWorld, resetWorld, startGame, stepWorld, interact, applyUpgrade, clickTargetFor } from './world.js';
import { render } from './render.js';
import { createInput, attachInput, moveAxes, wasPressed, endFrame } from './input.js';
import { playSound, updateSizzle, toggleMute } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;

const world = createWorld(seed);
// A handle for automated play-testing; the game itself never reads it.
window.__simmer = world;
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
} catch {
  best = 0;
}

let shotScreen = null;
if (shotName) {
  const staged = stageShot(shotName, world);
  shotScreen = staged.screen;
  best = staged.best;
} else {
  startGame(world);
  world.screen = SCREEN.TITLE;
}

const input = createInput();
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  scale = Math.min(w / FIELD.width, h / FIELD.height);
  offsetX = (w - FIELD.width * scale) / 2;
  offsetY = (h - FIELD.height * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

attachInput(input, canvas, (px, py) => ({
  x: (px - offsetX) / scale,
  y: (py - offsetY) / scale,
}));

function saveBest() {
  if (world.totalCoins > best) {
    best = world.totalCoins;
    try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode */ }
  }
}

function setStatus() {
  if (!statusEl) return;
  const s = world.screen;
  statusEl.textContent = s === SCREEN.TITLE
    ? 'Simmer and Serve. Press Enter to start cooking.'
    : s === SCREEN.PLAY
      ? `Service ${world.service} of 3. ${world.serviceCoins} coins of ${SERVICE.goal[world.service - 1]} needed. ${world.orders.length} orders waiting.`
      : s === SCREEN.WIN
        ? `Service complete! You earned ${world.totalCoins} coins.`
        : s === SCREEN.LOSS
          ? 'Kitchen closed. Press R to try again.'
          : s === SCREEN.UPGRADE
            ? 'Service cleared. Pick an upgrade.'
            : 'Paused.';
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // Global keys.
  if (wasPressed(input, 'm')) toggleMute();
  if (world.screen === SCREEN.PLAY && wasPressed(input, 'p', 'escape')) {
    world.screenBeforePause = SCREEN.PLAY;
    world.screen = SCREEN.PAUSED;
    playSound('click');
  } else if (world.screen === SCREEN.PAUSED && wasPressed(input, 'p', 'escape', 'enter')) {
    world.screen = world.screenBeforePause;
    playSound('click');
  }

  if (world.screen === SCREEN.TITLE) {
    if (wasPressed(input, 'enter', ' ') || input.click) {
      startGame(world);
      playSound('click');
    }
  } else if (world.screen === SCREEN.UPGRADE) {
    const pick = wasPressed(input, '1') ? 'shoes' : wasPressed(input, '2') ? 'burner' : wasPressed(input, '3') ? 'patience' : null;
    if (pick) {
      if (applyUpgrade(world, pick)) playSound('upgrade');
    } else if (input.click) {
      const { x, y } = input.click;
      const cards = [
        { id: 'shoes', x: 230, y: 270, w: 260, h: 190 },
        { id: 'burner', x: 520, y: 270, w: 260, h: 190 },
        { id: 'patience', x: 810, y: 270, w: 260, h: 190 },
      ];
      for (const card of cards) {
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          if (applyUpgrade(world, card.id)) playSound('upgrade');
          break;
        }
      }
    }
  } else if (world.screen === SCREEN.WIN || world.screen === SCREEN.LOSS) {
    saveBest();
    if (wasPressed(input, 'r', 'enter', ' ') || input.click) {
      resetWorld(world, seed);
      startGame(world);
      world.screen = SCREEN.TITLE;
      playSound('click');
    }
  } else if (world.screen === SCREEN.PLAY) {
    if (wasPressed(input, 'r')) {
      resetWorld(world, seed);
      startGame(world);
      world.screen = SCREEN.TITLE;
    } else {
      if (input.click) {
        world.clickTarget = clickTargetFor(world, input.click.x, input.click.y);
      }
      accumulator += dt;
      const act = wasPressed(input, 'e', ' ');
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const move = moveAxes(input);
        const events = stepWorld(world, STEP, move, act);
        for (const e of events) playSound(e);
        if (world.screen === SCREEN.WIN) { playSound('win'); saveBest(); break; }
        if (world.screen === SCREEN.LOSS) { playSound('lose'); saveBest(); break; }
        if (world.screen === SCREEN.UPGRADE) { playSound('upgrade'); break; }
      }
      const cooking = world.stations.some((s) => s.kind === 'stove'
        && s.slots.some((slot) => slot.item && !slot.done));
      updateSizzle(cooking);
    }
  }

  // Draw: a staged screenshot scene freezes on its screen.
  const screenToDraw = shotScreen ?? world.screen;
  const drawWorld = shotScreen ? { ...world, screen: screenToDraw } : world;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#241a10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  render(ctx, drawWorld, best);

  setStatus();
  endFrame(input);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
