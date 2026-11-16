// The chef: where they stand, what they carry, and how they move.
// Movement is axis-separated so the chef slides along counters instead of
// sticking on their corners.
import { FIELD, PLAYER } from './config.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: 400,
    vx: 0,
    vy: 0,
    facing: 1,
    /** What the chef is holding: null, or { kind, id, name, color }. */
    hands: null,
    moving: false,
    walkPhase: 0,
  };
}

/** Move the chef by (dx, dy) for dt seconds, kept out of counters and walls. */
export function movePlayer(player, dx, dy, dt, speed, solids) {
  const len = Math.hypot(dx, dy);
  player.moving = len > 0.01;
  if (!player.moving) {
    player.vx = 0;
    player.vy = 0;
    return;
  }
  const nx = dx / len;
  const ny = dy / len;
  if (nx !== 0) player.facing = nx;
  player.walkPhase += dt * 10;
  const r = PLAYER.radius;
  const stepX = nx * speed * dt;
  const stepY = ny * speed * dt;
  const tryX = player.x + stepX;
  if (!hitsSolid(tryX, player.y, r, solids)) player.x = tryX;
  const tryY = player.y + stepY;
  if (!hitsSolid(player.x, tryY, r, solids)) player.y = tryY;
  player.x = Math.min(FIELD.width - r - 4, Math.max(r + 4, player.x));
  player.y = Math.min(FIELD.height - r - 4, Math.max(r + 4, player.y));
}

function hitsSolid(x, y, r, solids) {
  for (const s of solids) {
    const cx = Math.min(s.x + s.w, Math.max(s.x, x));
    const cy = Math.min(s.y + s.h, Math.max(s.y, y));
    if (Math.hypot(x - cx, y - cy) < r - 2) return true;
  }
  return false;
}

/** Counter rectangles the chef cannot walk through. */
export function solidsOf(stations) {
  return stations.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h }));
}
