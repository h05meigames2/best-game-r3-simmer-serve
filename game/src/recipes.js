// The menu: every dish is a set of prepared components. A component is made
// by taking a raw ingredient from the pantry and preparing it once:
//   chop  -> chopping board,  cook -> stove,  plain -> used as it comes.
// A plate on the plating counter is finished when its components match a
// recipe exactly, in any order.
export const COMPONENTS = {
  lettuceChopped: { id: 'lettuceChopped', name: 'Chopped Lettuce', from: 'lettuce', prep: 'chop', color: '#4f9d5d' },
  tomatoChopped: { id: 'tomatoChopped', name: 'Chopped Tomato', from: 'tomato', prep: 'chop', color: '#d94f3d' },
  pattyCooked: { id: 'pattyCooked', name: 'Grilled Patty', from: 'patty', prep: 'cook', color: '#6b4226' },
  tomatoSoup: { id: 'tomatoSoup', name: 'Tomato Soup', from: 'tomato', prep: 'soup', color: '#c65a2e' },
  bun: { id: 'bun', name: 'Bun', from: 'bun', prep: 'plain', color: '#e0a458' },
  cheese: { id: 'cheese', name: 'Cheese', from: 'cheese', prep: 'plain', color: '#f2c94c' },
};

/** Raw ingredients the pantry bins hand out. What each becomes depends on
 *  the station it is taken to (board chops, stove grills or simmers). */
export const INGREDIENTS = {
  lettuce: { id: 'lettuce', name: 'Lettuce', color: '#4f9d5d' },
  tomato: { id: 'tomato', name: 'Tomato', color: '#d94f3d' },
  patty: { id: 'patty', name: 'Patty', color: '#8a5a3b' },
  bun: { id: 'bun', name: 'Bun', color: '#e0a458' },
  cheese: { id: 'cheese', name: 'Cheese', color: '#f2c94c' },
};

export const RECIPES = {
  salad: {
    id: 'salad',
    name: 'Garden Salad',
    price: 12,
    needs: ['lettuceChopped', 'tomatoChopped'],
    color: '#4f9d5d',
    blurb: 'Crisp lettuce, fresh tomato.',
  },
  burger: {
    id: 'burger',
    name: 'Classic Burger',
    price: 18,
    needs: ['bun', 'pattyCooked', 'lettuceChopped'],
    color: '#b87333',
    blurb: 'Bun, grilled patty, lettuce.',
  },
  soup: {
    id: 'soup',
    name: 'Tomato Soup',
    price: 16,
    needs: ['tomatoSoup'],
    color: '#c65a2e',
    blurb: 'Slow-simmered, served steaming.',
  },
  stack: {
    id: 'stack',
    name: 'Double Stack',
    price: 26,
    needs: ['bun', 'pattyCooked', 'pattyCooked', 'cheese', 'tomatoChopped'],
    color: '#8a5a2e',
    blurb: 'Two patties, cheese, tomato.',
  },
};

/** True when the components on a plate are exactly one recipe's needs. */
export function recipeFor(components) {
  const sorted = [...components].sort().join('|');
  for (const recipe of Object.values(RECIPES)) {
    if ([...recipe.needs].sort().join('|') === sorted) return recipe;
  }
  return null;
}

/** True when `component` is still wanted by some order, given what is
 *  already on the plate and what is already being prepared. The plate's
 *  contents must all belong to that order's recipe: soup never joins a
 *  half-built salad. */
export function wantedByOrders(component, plate, orders, inFlight) {
  for (const order of orders) {
    const recipe = RECIPES[order.recipeId];
    const needs = [...recipe.needs];
    let fits = true;
    for (const onPlate of plate) {
      const i = needs.indexOf(onPlate);
      if (i === -1) {
        fits = false;
        break;
      }
      needs.splice(i, 1);
    }
    if (!fits) continue;
    if (needs.includes(component) && !inFlight.includes(component)) return true;
  }
  return false;
}
