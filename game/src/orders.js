// Order tickets: what the dining room wants, how long it will wait, and
// what a served dish earns. One ticket per guest party.
import { RECIPES } from './recipes.js';
import { pick, range } from './random.js';

let nextOrderId = 1;

/** A fresh ticket for a recipe the current service's menu offers. */
export function makeOrder(rng, menu, patience) {
  const recipeId = pick(rng, menu);
  const recipe = RECIPES[recipeId];
  return {
    id: nextOrderId,
    recipeId,
    name: recipe.name,
    price: recipe.price,
    timeLeft: patience * range(rng, 0.9, 1.1),
    patience,
    born: 0,
  };
}

export function resetOrderIds() {
  nextOrderId = 1;
}

/**
 * Advance tickets one step. Expired tickets are removed and reported as
 * walk-outs; the caller decides what a walk-out costs.
 */
export function updateOrders(orders, dt) {
  const expired = [];
  for (let i = orders.length - 1; i >= 0; i -= 1) {
    orders[i].timeLeft -= dt;
    if (orders[i].timeLeft <= 0) {
      expired.push(orders[i]);
      orders.splice(i, 1);
    }
  }
  return expired;
}

/** The ticket whose dish the player is holding, if any. */
export function matchingOrder(orders, recipeId) {
  return orders.find((o) => o.recipeId === recipeId) ?? null;
}

/** Coins for serving a ticket: price plus a tip for speed. */
export function serveValue(order, tipPerSecond) {
  return order.price + Math.max(0, Math.floor(order.timeLeft * tipPerSecond));
}
