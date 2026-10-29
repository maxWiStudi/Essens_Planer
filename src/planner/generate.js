import { MEALS, MEAL_LABEL, PROTEIN_LABEL } from '../vocab.js'
import { addDays, weekdayIndex } from '../lib/dates.js'
import { createRng } from '../lib/rng.js'
import { candidatesFor, buildHistory } from './filter.js'
import { evaluate, fishAllowed } from './score.js'

export const slotKey = (s) => `${s.date}:${s.meal}`

/** Empty slots for the week, from the per-weekday meal settings. */
export function skeleton(startDate, settings) {
  const slots = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i)
    const wd = weekdayIndex(date)
    for (const meal of MEALS) {
      if (settings.meals[meal]?.[wd]) {
        slots.push({ date, meal, recipeId: null, factor: 1, status: 'geplant', locked: false })
      }
    }
  }
  return slots
}

/** Slots the planner must not touch when re-planning. */
export const isKept = (s) => s.locked || s.status === 'erledigt' || s.status === 'auswaerts'

/**
 * Plan (or re-plan) a week.
 * previous: an existing week; its locked, done and eaten-out slots are kept.
 * weeks: all stored weeks, for the cross-week cooldown.
 */
export function planWeek({ startDate, recipes, settings, weeks = [], statsById = {}, previous = null, seed = 1, iterations = 600 }) {
  const rng = createRng(seed)
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const history = buildHistory(weeks, startDate)
  const ctx = { byId, settings, history, statsById }

  const kept = new Map((previous?.slots ?? []).filter(isKept).map((s) => [slotKey(s), s]))
  const slots = skeleton(startDate, settings).map((s) => kept.get(slotKey(s)) ?? s)
  for (const [k, s] of kept) if (!slots.some((x) => slotKey(x) === k)) slots.push(s)

  const pools = Object.fromEntries(MEALS.map((m) => [m, candidatesFor(m, recipes, settings, statsById)]))
  const free = slots.map((s, i) => i).filter((i) => !isKept(slots[i]))
  for (const i of free) {
    slots[i] = { ...slots[i], recipeId: null, status: pools[slots[i].meal].length ? 'geplant' : 'leer' }
  }
  const movable = free.filter((i) => pools[slots[i].meal].length)

  const costOf = () => evaluate(slots, ctx).cost

  // 1. Greedy start: fill slots in a shuffled order, picking among the 3 best.
  for (const i of rng.shuffle(movable)) {
    const scored = pools[slots[i].meal].map((r) => {
      slots[i].recipeId = r.id
      return { id: r.id, cost: costOf() }
    })
    scored.sort((a, b) => a.cost - b.cost)
    slots[i].recipeId = rng.pick(scored.slice(0, 3)).id
  }

  // 2. Local search: random replacements and swaps, keep what is not worse.
  let current = costOf()
  for (let it = 0; it < iterations && movable.length; it++) {
    const i = rng.pick(movable)
    if (rng.next() < 0.7) {
      const old = slots[i].recipeId
      slots[i].recipeId = rng.pick(pools[slots[i].meal]).id
      const c = costOf()
      if (c <= current) current = c
      else slots[i].recipeId = old
    } else {
      const same = movable.filter((j) => j !== i && slots[j].meal === slots[i].meal)
      if (!same.length) continue
      const j = rng.pick(same)
      ;[slots[i].recipeId, slots[j].recipeId] = [slots[j].recipeId, slots[i].recipeId]
      const c = costOf()
      if (c <= current) current = c
      else [slots[i].recipeId, slots[j].recipeId] = [slots[j].recipeId, slots[i].recipeId]
    }
  }

  // 3. Polish: best single replacement per slot, twice.
  for (let pass = 0; pass < 2; pass++) {
    for (const i of movable) {
      let best = slots[i].recipeId
      for (const r of pools[slots[i].meal]) {
        slots[i].recipeId = r.id
        const c = costOf()
        if (c < current) {
          current = c
          best = r.id
        }
      }
      slots[i].recipeId = best
    }
  }

  const result = evaluate(slots, ctx)
  return {
    startDate,
    generatedAt: new Date().toISOString(),
    seed,
    slots,
    explain: explain(result, settings, pools, slots),
    shoppingChecked: previous?.shoppingChecked ?? {},
    updatedAt: new Date().toISOString(),
  }
}

/** Plain-language summary of what the plan achieved and which rules had to bend. */
export function explain({ stats, targets }, settings, pools, slots) {
  const v = settings.variety
  const met = [], relaxed = []
  const planned = slots.filter((s) => s.recipeId).length

  if (stats.duplicates === 0) met.push(`${stats.distinct} verschiedene Gerichte, keins doppelt`)
  else relaxed.push(`${stats.duplicates}× musste ein Gericht doppelt vorkommen – zu wenige passende Rezepte`)

  if (stats.recent === 0) met.push(`Nichts aus den letzten ${v.cooldownDays} Tagen`)
  else relaxed.push(`${stats.recent} Gericht(e) gab es vor kurzem schon`)

  if (fishAllowed(settings) && stats.mains) {
    if (stats.fish >= targets.fishMin && stats.fish <= v.fishMax) met.push(`Fisch ${stats.fish}×`)
    else relaxed.push(`Fisch ${stats.fish}× (Ziel ${targets.fishMin}–${v.fishMax})`)
  }
  if (stats.mains) {
    if (stats.legumes >= targets.legumesMin) met.push(`${PROTEIN_LABEL.huelsenfruechte} ${stats.legumes}×`)
    else relaxed.push(`${PROTEIN_LABEL.huelsenfruechte} nur ${stats.legumes}× (Ziel ${targets.legumesMin})`)
    if (stats.meat <= v.meatMax) { if (stats.meat) met.push(`Fleisch ${stats.meat}×`) }
    else relaxed.push(`Fleisch ${stats.meat}× (Ziel höchstens ${v.meatMax})`)
    if (stats.lowVeg) relaxed.push(`${stats.lowVeg} Hauptmahlzeit(en) mit wenig Gemüse`)
    else met.push('Gemüse in jeder Hauptmahlzeit')
  }
  for (const m of MEALS) {
    if (slots.some((s) => s.meal === m) && !pools[m].length) {
      relaxed.push(`Kein passendes Rezept für ${MEAL_LABEL[m]} – Filter prüfen`)
    }
  }
  if (!planned) relaxed.push('Keine Mahlzeiten eingeplant – in den Einstellungen Tage auswählen')
  return { met, relaxed }
}

/** Best alternatives for one slot, ranked by how the whole week would score. */
export function swapOptions({ week, key, recipes, settings, weeks = [], statsById = {}, limit = 6 }) {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const ctx = { byId, settings, history: buildHistory(weeks, week.startDate), statsById }
  const slots = week.slots.map((s) => ({ ...s }))
  const idx = slots.findIndex((s) => slotKey(s) === key)
  if (idx < 0) return []
  const before = evaluate(slots, ctx).cost
  const current = slots[idx].recipeId
  const options = candidatesFor(slots[idx].meal, recipes, settings, statsById)
    .filter((r) => r.id !== current)
    .map((r) => {
      slots[idx].recipeId = r.id
      return { recipe: r, delta: evaluate(slots, ctx).cost - before }
    })
  options.sort((a, b) => a.delta - b.delta)
  return options.slice(0, limit)
}
