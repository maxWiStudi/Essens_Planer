import { DIETS, SEAFOOD } from '../vocab.js'

const dietRank = (d) => DIETS.indexOf(d)

function mentionsExcluded(recipe, words) {
  if (!words.length) return false
  const haystack = [recipe.title, ...recipe.ingredients.map((i) => i.name)].join(' ').toLowerCase()
  return words.some((w) => w && haystack.includes(w.toLowerCase().trim()))
}

/** Hard rules: a recipe that fails one of these never enters a plan. */
export function fitsSettings(recipe, settings, statsById = {}) {
  if (dietRank(recipe.diet) > dietRank(settings.diet)) return false
  if (recipe.allergens.some((a) => settings.allergens.includes(a))) return false
  if (statsById[recipe.id]?.excluded) return false
  if (mentionsExcluded(recipe, settings.excludedIngredients)) return false
  if (recipe.equipment.some((e) => !settings.equipment.includes(e))) return false
  return true
}

export function candidatesFor(meal, recipes, settings, statsById = {}) {
  const max = settings.maxMinutes?.[meal] ?? Infinity
  return recipes.filter(
    (r) => r.mealTypes.includes(meal) && r.minutes <= max && fitsSettings(r, settings, statsById),
  )
}

/** recipeId -> dates it was planned in other weeks (for the cooldown rule). */
export function buildHistory(weeks, exceptStartDate) {
  const history = new Map()
  for (const w of weeks) {
    if (w.startDate === exceptStartDate) continue
    for (const s of w.slots) {
      if (!s.recipeId || s.status === 'auswaerts') continue
      if (!history.has(s.recipeId)) history.set(s.recipeId, [])
      history.get(s.recipeId).push(s.date)
    }
  }
  return history
}

const BATCH_STYLES = new Set(['eintopf', 'suppe', 'auflauf', 'bowl', 'ofen'])

/** Can this dish be cooked once and eaten again later (reheated or from the fridge)? */
export function canBatch(recipe) {
  if (recipe.leftoverFriendly) return true
  return BATCH_STYLES.has(recipe.style) && !SEAFOOD.has(recipe.protein)
}
