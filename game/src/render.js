// Everything the player sees, drawn on one canvas with plain 2D shapes:
// the kitchen, the tickets, the chef, the HUD and every menu screen.
// No images, no fonts from the network — only the system font stack.
import { FIELD, SERVICE, PALETTE, FONT, UPGRADES, WALKOUTS_TO_LOSE } from './config.js';
import { SCREEN } from './world.js';
import { COMPONENTS, INGREDIENTS, RECIPES } from './recipes.js';
import { nearestStation } from './kitchen.js';
import { PLAYER } from './config.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, weight = '700', align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** A small food icon, drawn from shapes. `id` is an ingredient, component or recipe. */
export function drawFood(ctx, id, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  if (id === 'lettuce' || id === 'lettuceChopped') {
    ctx.fillStyle = '#4f9d5d';
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.55, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = '#7cc48a';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#357a42'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0); ctx.stroke();
  } else if (id === 'tomato' || id === 'tomatoChopped') {
    ctx.fillStyle = '#d94f3d';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8705f';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.45, 0, TAU); ctx.fill();
    ctx.fillStyle = '#357a42';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.lineTo(-r * 0.35, -r * 1.05); ctx.lineTo(0, -r * 0.8);
    ctx.lineTo(r * 0.35, -r * 1.05); ctx.lineTo(0, -r * 0.7);
    ctx.fill();
  } else if (id === 'patty' || id === 'pattyCooked') {
    ctx.fillStyle = '#6b4226';
    rr(ctx, -r, -r * 0.55, r * 2, r * 1.1, r * 0.5);
    ctx.fill();
    ctx.fillStyle = '#8a5a3b';
    rr(ctx, -r * 0.7, -r * 0.3, r * 1.4, r * 0.45, r * 0.2);
    ctx.fill();
  } else if (id === 'bun') {
    ctx.fillStyle = '#e0a458';
    ctx.beginPath(); ctx.arc(0, r * 0.15, r, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c98a3e';
    rr(ctx, -r, r * 0.1, r * 2, r * 0.35, r * 0.15);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    [[-0.4, -0.35], [0.1, -0.55], [0.5, -0.3]].forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.arc(dx * r, dy * r, r * 0.09, 0, TAU); ctx.fill();
    });
  } else if (id === 'cheese') {
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.7); ctx.lineTo(r, r * 0.7); ctx.lineTo(r, -r * 0.4); ctx.lineTo(0, -r * 0.9); ctx.lineTo(-r, -r * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9a91c';
    [[-0.35, 0.2], [0.3, 0.25], [0, -0.35]].forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.arc(dx * r, dy * r, r * 0.12, 0, TAU); ctx.fill();
    });
  } else if (id === 'tomatoSoup') {
    ctx.fillStyle = '#fdfbf6';
    ctx.beginPath(); ctx.arc(0, r * 0.1, r, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c65a2e';
    ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.85, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8a91c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.7); ctx.quadraticCurveTo(-r * 0.6, -r * 1.1, -r * 0.4, -r * 1.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.7); ctx.quadraticCurveTo(r * 0.1, -r * 1.1, r * 0.3, -r * 1.3); ctx.stroke();
  } else if (id === 'salad' || id === 'burger' || id === 'soup' || id === 'stack') {
    // A finished dish: a plate with its components peeking out.
    ctx.fillStyle = '#fdfbf6';
    ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 1.05, r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d9c9a8'; ctx.lineWidth = 2; ctx.stroke();
    const recipe = RECIPES[id];
    if (recipe) {
      const n = recipe.needs.length;
      recipe.needs.forEach((need, i) => {
        drawFood(ctx, need, (i - (n - 1) / 2) * r * 0.55, -r * 0.25, r * 0.42);
      });
    }
  } else {
    ctx.fillStyle = '#999';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawStationBase(ctx, station, highlight) {
  const { x, y, w, h } = station;
  ctx.fillStyle = PALETTE.counter;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.counterTop;
  rr(ctx, x + 3, y + 3, w - 6, 14, 6);
  ctx.fill();
  if (highlight) {
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    rr(ctx, x - 5, y - 5, w + 10, h + 10, 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  text(ctx, station.label, x + w / 2, y + h + 14, 12, PALETTE.muted, '700', 'center');
}

function drawSlot(ctx, slot, x, y, r, label) {
  // The slot's well.
  ctx.fillStyle = '#3a2a1a22';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (slot.item) {
    drawFood(ctx, slot.item.yields === 'plate' ? 'plate' : slot.item.yields, x, y, r * 0.8);
    if (slot.burnt) {
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill();
      text(ctx, '!', x, y, 20, '#fff', '800', 'center');
    } else if (!slot.done) {
      ctx.strokeStyle = slot.item.yields === 'plate' ? '#6aa9d8' : '#e8a91c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + slot.progress * TAU);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#2e7d46';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.stroke();
      text(ctx, '✓', x + r * 0.75, y - r * 0.75, 16, '#2e7d46', '800', 'center');
    }
  } else if (label) {
    text(ctx, label, x, y, 12, PALETTE.muted, '600', 'center');
  }
}

function drawKitchen(ctx, world) {
  // Floor: warm checker tiles.
  for (let ty = 0; ty < 9; ty += 1) {
    for (let tx = 0; tx < 16; tx += 1) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floor : PALETTE.floorDark;
      ctx.fillRect(tx * 80, 96 + ty * 72, 80, 72);
    }
  }
  // Top wall band (behind the pantry) and bottom band.
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 96, FIELD.width, 8);
  ctx.fillRect(0, 548, FIELD.width, 8);
  ctx.fillStyle = PALETTE.wallTrim;
  ctx.fillRect(0, 100, FIELD.width, 4);
  ctx.fillRect(0, 548, FIELD.width, 4);

  const near = world.screen === SCREEN.PLAY
    ? nearestStation(world.stations, world.player.x, world.player.y, PLAYER.interactRange) : null;

  for (const station of world.stations) {
    const highlight = near === station;
    drawStationBase(ctx, station, highlight);
    if (station.kind === 'pantry') {
      drawFood(ctx, station.ingredient, station.x + station.w / 2, station.y + station.h / 2 + 2, 20);
    } else if (station.kind === 'board') {
      station.slots.forEach((slot, i) => {
        const cx = station.x + 42 + i * 66;
        drawSlot(ctx, slot, cx, station.y + station.h / 2, 22, 'CHOP');
      });
    } else if (station.kind === 'stove') {
      station.slots.forEach((slot, i) => {
        const cx = station.x + 40 + i * 62;
        drawSlot(ctx, slot, cx, station.y + station.h / 2, 22, 'COOK');
      });
    } else if (station.kind === 'window') {
      ctx.fillStyle = '#2b2b2b';
      rr(ctx, station.x + 8, station.y + 8, station.w - 16, station.h - 16, 8);
      ctx.fill();
      ctx.fillStyle = '#f7ead7';
      ctx.fillRect(station.x + 8, station.y + 8, station.w - 16, 10);
      text(ctx, 'SERVE', station.x + station.w / 2, station.y + station.h / 2 + 6, 15, '#f7ead7', '800', 'center');
      ctx.fillStyle = '#e8a91c';
      ctx.beginPath(); ctx.arc(station.x + station.w / 2, station.y + 26, 5, 0, TAU); ctx.fill();
    } else if (station.kind === 'plate') {
      // The plate on the counter, with its components so far.
      const cx = station.x + station.w / 2;
      const cy = station.y + station.h / 2;
      ctx.fillStyle = PALETTE.plate;
      ctx.beginPath(); ctx.ellipse(cx, cy, 46, 20, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d9c9a8'; ctx.lineWidth = 2; ctx.stroke();
      if (station.dish) {
        drawFood(ctx, station.dish, cx, cy - 8, 26);
        text(ctx, 'READY!', cx, cy - 44, 13, '#2e7d46', '800', 'center');
      } else {
        station.components.forEach((comp, i) => {
          drawFood(ctx, comp, cx + (i - (station.components.length - 1) / 2) * 30, cy - 8, 13);
        });
        if (station.components.length === 0) {
          text(ctx, 'PLATE HERE', cx, cy - 2, 11, PALETTE.muted, '600', 'center');
        }
      }
      // Clean plates stacked beside the counter.
      for (let i = 0; i < Math.min(world.platesClean, 3); i += 1) {
        ctx.fillStyle = PALETTE.plate;
        ctx.beginPath(); ctx.ellipse(station.x + 26 + i * 4, station.y + station.h - 8 - i * 3, 16, 5, 0, 0, TAU); ctx.fill();
      }
    } else if (station.kind === 'sink') {
      drawSlot(ctx, station.slots[0], station.x + station.w / 2, station.y + station.h / 2, 24, 'WASH');
      text(ctx, `dirty: ${world.platesDirty}`, station.x + station.w / 2, station.y + station.h + 28, 12, '#6aa9d8', '700', 'center');
    } else if (station.kind === 'bin') {
      ctx.fillStyle = '#5a4632';
      rr(ctx, station.x + station.w / 2 - 18, station.y + 10, 36, 42, 6);
      ctx.fill();
      ctx.fillStyle = '#7a6248';
      ctx.fillRect(station.x + station.w / 2 - 22, station.y + 6, 44, 8);
    }
  }
}

function drawChef(ctx, world) {
  const p = world.player;
  const bob = p.moving ? Math.sin(p.walkPhase) * 3 : 0;
  const x = p.x;
  const y = p.y + bob * 0.3;
  // Shadow.
  ctx.fillStyle = '#3a2a1a33';
  ctx.beginPath(); ctx.ellipse(x, p.y + 22, 22, 7, 0, 0, TAU); ctx.fill();
  // Body: white apron over a tomato-red shirt.
  ctx.fillStyle = '#d94f3d';
  ctx.beginPath(); ctx.arc(x, y + 6, 19, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fdfbf6';
  rr(ctx, x - 13, y - 2, 26, 22, 8);
  ctx.fill();
  // Head + chef hat.
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(x, y - 18, 13, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fdfbf6';
  ctx.beginPath(); ctx.arc(x - 7, y - 28, 7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - 31, 8, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 7, y - 28, 7, 0, TAU); ctx.fill();
  ctx.fillRect(x - 12, y - 28, 24, 6);
  // Eyes look where the chef faces.
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath(); ctx.arc(x - 4 + p.facing * 2, y - 18, 1.8, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4 + p.facing * 2, y - 18, 1.8, 0, TAU); ctx.fill();
  // What the chef carries, held high.
  if (p.hands) {
    drawFood(ctx, p.hands.id, x, y - 52, 15);
    text(ctx, p.hands.name, x, y - 74, 12, PALETTE.ink, '700', 'center');
  }
}

function drawTickets(ctx, world) {
  const startX = 246;
  world.orders.forEach((order, i) => {
    const x = startX + i * 196;
    const y = 8;
    const w = 186;
    const h = 84;
    const frac = Math.max(0, order.timeLeft / order.patience);
    const urgent = frac < 0.35;
    ctx.fillStyle = PALETTE.ticket;
    rr(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = urgent ? '#c0392b' : '#d9b98a';
    ctx.lineWidth = urgent ? 3 : 2;
    ctx.stroke();
    drawFood(ctx, order.recipeId, x + 30, y + 26, 18);
    text(ctx, order.name, x + 54, y + 18, 14, PALETTE.ink, '800');
    text(ctx, `$${order.price}`, x + 54, y + 40, 13, '#b87333', '700');
    // Countdown bar.
    ctx.fillStyle = '#e8dcc4';
    rr(ctx, x + 12, y + h - 20, w - 24, 10, 5);
    ctx.fill();
    ctx.fillStyle = urgent ? '#c0392b' : frac < 0.6 ? '#e8a91c' : '#4f9d5d';
    rr(ctx, x + 12, y + h - 20, (w - 24) * frac, 10, 5);
    ctx.fill();
    // Seconds left, readable over the bar and the ticket alike.
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3a2a1a';
    ctx.strokeText(`${Math.ceil(order.timeLeft)}s`, x + w - 12, y + h - 15);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.ceil(order.timeLeft)}s`, x + w - 12, y + h - 15);
  });
  if (world.orders.length === 0) {
    text(ctx, 'No orders — get ready…', startX + 10, 50, 15, PALETTE.muted, '600');
  }
}

function drawHud(ctx, world) {
  // Top-left info panel.
  ctx.fillStyle = PALETTE.panel;
  rr(ctx, 8, 8, 228, 84, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, `SERVICE ${world.service}/3`, 20, 26, 15, '#b87333', '800');
  text(ctx, `🪙 ${world.serviceCoins} / ${SERVICE.goal[world.service - 1]}`, 20, 50, 17, PALETTE.ink, '800');
  const clock = Math.max(0, Math.ceil(world.serviceTimeLeft));
  text(ctx, `⏱ ${clock}s`, 20, 74, 14, clock <= 15 ? '#c0392b' : PALETTE.muted, '700');
  // Walk-outs as hearts lost, at the panel's right edge.
  for (let i = 0; i < WALKOUTS_TO_LOSE; i += 1) {
    const lost = i < world.walkouts;
    ctx.fillStyle = lost ? '#c0392b' : '#d94f3d';
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(lost ? '✕' : '♥', 168 + i * 20, 26);
  }
  text(ctx, `total $${world.totalCoins}`, 128, 74, 13, PALETTE.muted, '600');

  // Bottom hint bar.
  ctx.fillStyle = '#3a2a1acc';
  rr(ctx, FIELD.width / 2 - 330, FIELD.height - 34, 660, 26, 13);
  ctx.fill();
  const hint = world.screen === SCREEN.PLAY
    ? 'WASD / arrows move · E or click a station to use it · P pause · M mute'
    : '';
  if (hint) text(ctx, hint, FIELD.width / 2, FIELD.height - 21, 13, '#f7ead7', '600', 'center');
  if (world.notice) {
    text(ctx, world.notice, FIELD.width / 2, FIELD.height - 52, 15, '#c0392b', '800', 'center');
  }
  // Floating feedbacks.
  for (const fb of world.feedbacks) {
    ctx.globalAlpha = Math.min(1, fb.ttl);
    text(ctx, fb.text, fb.x, fb.y, 20, fb.color, '800', 'center');
    ctx.globalAlpha = 1;
  }
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = '#3a2a1add';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.panel;
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function render(ctx, world, best) {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  if (world.screen === SCREEN.TITLE) {
    drawKitchen(ctx, world);
    drawChef(ctx, world);
    drawPanel(ctx, 290, 130, 700, 440);
    text(ctx, 'SIMMER & SERVE', 640, 190, 52, '#d94f3d', '800', 'center');
    text(ctx, 'a dinner-rush kitchen arcade', 640, 232, 20, PALETTE.muted, '600', 'center');
    drawFood(ctx, 'burger', 480, 290, 30);
    drawFood(ctx, 'salad', 640, 290, 30);
    drawFood(ctx, 'soup', 800, 290, 30);
    text(ctx, 'Tickets arrive. Chop it, grill it, plate it, serve it —', 640, 350, 17, PALETTE.ink, '600', 'center');
    text(ctx, 'before the guest walks out. Clear the coin target to open', 640, 376, 17, PALETTE.ink, '600', 'center');
    text(ctx, 'the next service. Three walk-outs, or closing time with', 640, 402, 17, PALETTE.ink, '600', 'center');
    text(ctx, 'the target unmet, ends the night.', 640, 428, 17, PALETTE.ink, '600', 'center');
    text(ctx, 'WASD / arrows to move · E or click to use a station', 640, 470, 15, '#b87333', '700', 'center');
    text(ctx, '▶  Press ENTER or click to start cooking', 640, 516, 19, '#2e7d46', '800', 'center');
    if (best > 0) text(ctx, `Best night so far: $${best}`, 640, 548, 14, PALETTE.muted, '600', 'center');
    return;
  }

  drawKitchen(ctx, world);
  drawTickets(ctx, world);
  drawHud(ctx, world);
  drawChef(ctx, world);

  if (world.screen === SCREEN.UPGRADE) {
    drawPanel(ctx, 190, 150, 900, 400);
    text(ctx, `Service ${world.service} cleared!  🪙 ${world.serviceCoins} earned`, 640, 200, 26, '#2e7d46', '800', 'center');
    text(ctx, 'Pick one upgrade for the next service:', 640, 238, 18, PALETTE.ink, '600', 'center');
    UPGRADES.forEach((up, i) => {
      const x = 230 + i * 290;
      const y = 270;
      const owned = world.upgrades.has(up.id);
      ctx.fillStyle = owned ? '#e8dcc4' : '#fffdf5';
      rr(ctx, x, y, 260, 190, 12);
      ctx.fill();
      ctx.strokeStyle = owned ? '#c9b48a' : '#b87333';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, `${i + 1}`, x + 130, y + 34, 22, '#b87333', '800', 'center');
      text(ctx, up.name, x + 130, y + 72, 17, PALETTE.ink, '800', 'center');
      // Word-wrap the description.
      const words = up.desc.split(' ');
      let line = '';
      let ly = y + 106;
      for (const word of words) {
        if ((line + word).length > 22) {
          text(ctx, line.trim(), x + 130, ly, 13, PALETTE.muted, '600', 'center');
          ly += 20;
          line = '';
        }
        line += `${word} `;
      }
      text(ctx, line.trim(), x + 130, ly, 13, PALETTE.muted, '600', 'center');
      text(ctx, owned ? 'OWNED' : 'press 1 / 2 / 3 or click', x + 130, y + 166, 12, owned ? '#999' : '#2e7d46', '700', 'center');
    });
    return;
  }

  if (world.screen === SCREEN.PAUSED) {
    drawPanel(ctx, 440, 250, 400, 180);
    text(ctx, 'PAUSED', 640, 300, 36, PALETTE.ink, '800', 'center');
    text(ctx, 'P or Esc to resume · R to restart', 640, 348, 16, PALETTE.muted, '600', 'center');
    text(ctx, 'M to mute sound', 640, 378, 16, PALETTE.muted, '600', 'center');
    return;
  }

  if (world.screen === SCREEN.WIN) {
    drawPanel(ctx, 340, 130, 600, 440);
    text(ctx, '🎉  SERVICE COMPLETE!', 640, 190, 34, '#2e7d46', '800', 'center');
    text(ctx, 'Three services, no guest left hungry.', 640, 232, 18, PALETTE.ink, '600', 'center');
    text(ctx, `Total earned:  $${world.totalCoins}`, 640, 300, 24, '#b87333', '800', 'center');
    text(ctx, `Dishes served:  ${world.served}`, 640, 340, 19, PALETTE.ink, '700', 'center');
    text(ctx, `Walk-outs:  ${world.walkouts}`, 640, 370, 19, PALETTE.ink, '700', 'center');
    if (best > 0) text(ctx, `Best night: $${best}`, 640, 410, 16, PALETTE.muted, '600', 'center');
    text(ctx, '▶  Press R or click to cook again', 640, 480, 19, '#2e7d46', '800', 'center');
    return;
  }

  if (world.screen === SCREEN.LOSS) {
    drawPanel(ctx, 340, 130, 600, 440);
    text(ctx, '🌙  KITCHEN CLOSED', 640, 190, 34, '#c0392b', '800', 'center');
    const reason = world.lossReason === 'walkouts'
      ? 'Three guests walked out hungry.'
      : 'Closing time came with the target unmet.';
    text(ctx, reason, 640, 232, 18, PALETTE.ink, '600', 'center');
    text(ctx, `Service reached:  ${world.service} / 3`, 640, 300, 20, PALETTE.ink, '700', 'center');
    text(ctx, `Coins this service:  ${world.serviceCoins} / ${SERVICE.goal[world.service - 1]}`, 640, 336, 19, PALETTE.ink, '700', 'center');
    text(ctx, `Total earned:  $${world.totalCoins}`, 640, 372, 19, '#b87333', '700', 'center');
    text(ctx, `Dishes served:  ${world.served}`, 640, 408, 18, PALETTE.ink, '600', 'center');
    if (best > 0) text(ctx, `Best night: $${best}`, 640, 444, 16, PALETTE.muted, '600', 'center');
    text(ctx, '▶  Press R or click to try again', 640, 500, 19, '#2e7d46', '800', 'center');
  }
}
