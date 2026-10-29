import { MAIN_MEALS, MEALS, MEAT, SEAFOOD, DIETS } from '../vocab.js'
import { daysBetween } from '../lib/dates.js'

// Penalty weights. Higher = the planner tries harder to avoid it.
export const WEIGHTS = {
  duplicate: 100,
  recent: 40,
  sameProteinInRow: 10,
  sameBaseInRow: 3,
  sameBaseSameDay: 6,
  styleOver: 4,
  cuisineOver: 3,
  breakfastStyleOver: 2,
  breakfastSameProteinInRow: 3,
  baseOver: 2,
  fishMissing: 12,
  fishExtra: 8,
  legumesMissing: 10,
  meatExtra: 10,
  redMeatExtra: 5,
  lowVeg: 6,
  favorite: -3,
  ratingStep: -1.5,
}

const mealOrder = (m) => MEALS.indexOf(m)
const ordered = (slots) =>
  slots.slice().sort((a, b) => (a.date === b.date ? mealOrder(a.meal) - mealOrder(b.meal) : a.date < b.date ? -1 : 1))

export function fishAllowed(settings) {
  return DIETS.indexOf(settings.diet) >= DIETS.indexOf('pescetarisch') && !settings.allergens.includes('fisch')
}

/**
 * Cost of a (possibly partial) week. Lower is better.
 * ctx: { byId: Map, settings, history: Map, statsById }
 */
export function evaluate(slots, ctx) {
  const { byId, settings, history, statsById = {} } = ctx
  const v = settings.variety
  const active = ordered(slots).filter((s) => s.recipeId && s.status !== 'auswaerts' && byId.has(s.recipeId))
  let cost = 0

  const stats = {
    distinct: 0, duplicates: 0, recent: 0, fish: 0, legumes: 0, meat: 0, redMeat: 0, lowVeg: 0, mains: 0,
  }

  // Repeats inside the week.
  const counts = new Map()
  for (const s of active) counts.set(s.recipeId, (counts.get(s.recipeId) ?? 0) + 1)
  stats.distinct = counts.size
  for (const n of counts.values()) {
    if (n > 1) {
      stats.duplicates += n - 1
      cost += (n - 1) * WEIGHTS.duplicate
    }
  }

  // Repeats across weeks (cooldown), and personal preferences.
  for (const s of active) {
    const used = history.get(s.recipeId)
    if (used?.length) {
      const nearest = Math.min(...used.map((d) => Math.abs(daysBetween(d, s.date))))
      if (nearest < v.cooldownDays) {
        stats.recent++
        cost += WEIGHTS.recent * (1 - nearest / v.cooldownDays)
      }
    }
    const st = statsById[s.recipeId]
    if (st?.favorite) cost += WEIGHTS.favorite
    if (st?.rating) cost += (st.rating - 3) * WEIGHTS.ratingStep
  }

  // Main meals: rotation and balance.
  const mains = active.filter((s) => MAIN_MEALS.includes(s.meal))
  stats.mains = mains.length
  const styleCount = new Map(), cuisineCount = new Map(), baseCount = new Map()
  let prev = null
  for (const s of mains) {
    const r = byId.get(s.recipeId)
    if (prev) {
      const p = byId.get(prev.recipeId)
      if (r.protein !== 'keins' && r.protein === p.protein) cost += WEIGHTS.sameProteinInRow
      if (r.base !== 'keins' && r.base === p.base) {
        cost += prev.date === s.date ? WEIGHTS.sameBaseSameDay : WEIGHTS.sameBaseInRow
      }
    }
    styleCount.set(r.style, (styleCount.get(r.style) ?? 0) + 1)
    cuisineCount.set(r.cuisine, (cuisineCount.get(r.cuisine) ?? 0) + 1)
    if (r.base !== 'keins') baseCount.set(r.base, (baseCount.get(r.base) ?? 0) + 1)
    if (SEAFOOD.has(r.protein)) stats.fish++
    if (r.protein === 'huelsenfruechte') stats.legumes++
    if (MEAT.has(r.protein)) stats.meat++
    if (r.protein === 'rind' || r.protein === 'schwein') stats.redMeat++
    if (r.vegPortions < v.vegPerMainMin) {
      stats.lowVeg++
      cost += WEIGHTS.lowVeg
    }
    prev = s
  }
  // Allow more of one style/cuisine when there are many mains in the week.
  const styleCap = Math.max(2, Math.ceil(mains.length / 5))
  for (const n of styleCount.values()) if (n > styleCap) cost += (n - styleCap) * WEIGHTS.styleOver
  for (const n of cuisineCount.values()) if (n > styleCap) cost += (n - styleCap) * WEIGHTS.cuisineOver
  const baseCap = Math.max(2, Math.ceil(mains.length / 4))
  for (const n of baseCount.values()) if (n > baseCap) cost += (n - baseCap) * WEIGHTS.baseOver

  // Weekly targets apply in full from 7 planned mains and shrink below that.
  const scale = Math.min(1, mains.length / 7)
  const fishMin = Math.round(v.fishMin * scale)
  const legumesMin = Math.round(v.legumesMin * scale)
  if (fishAllowed(settings)) {
    if (stats.fish < fishMin) cost += (fishMin - stats.fish) * WEIGHTS.fishMissing
    if (stats.fish > v.fishMax) cost += (stats.fish - v.fishMax) * WEIGHTS.fishExtra
  }
  if (stats.legumes < legumesMin) cost += (legumesMin - stats.legumes) * WEIGHTS.legumesMissing
  if (stats.meat > v.meatMax) cost += (stats.meat - v.meatMax) * WEIGHTS.meatExtra
  if (stats.redMeat > 2) cost += (stats.redMeat - 2) * WEIGHTS.redMeatExtra

  // Breakfast: mostly about not eating the same kind every day.
  const bStyle = new Map()
  let prevBreakfast = null
  for (const s of active.filter((x) => x.meal === 'fruehstueck')) {
    const r = byId.get(s.recipeId)
    bStyle.set(r.style, (bStyle.get(r.style) ?? 0) + 1)
    if (prevBreakfast && r.protein !== 'keins' && r.protein === prevBreakfast.protein) cost += WEIGHTS.breakfastSameProteinInRow
    prevBreakfast = r
  }
  for (const n of bStyle.values()) if (n > 3) cost += (n - 3) * WEIGHTS.breakfastStyleOver

  return { cost, stats, targets: { fishMin, legumesMin } }
}
