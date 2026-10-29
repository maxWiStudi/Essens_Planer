import fruehstueck from './data/recipes/fruehstueck.json'
import fleischFisch from './data/recipes/hauptgerichte-fleisch-fisch.json'
import vegetarisch from './data/recipes/hauptgerichte-vegetarisch.json'

// Ingredients are authored as [name, qty, unit, aisle] tuples to keep the
// JSON readable; the app works with objects.
export function normalizeRecipe(r, source = 'bundle') {
  return {
    leftoverFriendly: false,
    ...r,
    source: r.source ?? source,
    ingredients: r.ingredients.map((i) =>
      Array.isArray(i) ? { name: i[0], qty: i[1], unit: i[2], aisle: i[3] } : i,
    ),
  }
}

export const BUNDLED = [...fruehstueck, ...fleischFisch, ...vegetarisch].map((r) => normalizeRecipe(r))

export function allRecipes(userRecipes = []) {
  return [...BUNDLED, ...userRecipes.map((r) => normalizeRecipe(r, r.source ?? 'eigen'))]
}
