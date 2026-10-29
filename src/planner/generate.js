import { MEALS, MEAL_LABEL, PROTEIN_LABEL } from '../vocab.js'
import { addDays, weekdayIndex } from '../lib/dates.js'
import { createRng } from '../lib/rng.js'
import { candidatesFor, buildHistory, canBatch } from './filter.js'
import { evaluate, fishAllowed } from './score.js'

export const slotKey = (s) => `${s.date}:${s.meal}`
const mealOrder = (m) => MEALS.indexOf(m)
const bySlotOrder = (a, b) => (a.date === b.date ? mealOrder(a.meal) - mealOrder(b.meal) : a.date < b.date ? -1 : 1)

/** Empty slots for the week, from the per-weekday meal settings. */
export function skeleton(startDate, settings) {
  const slots = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i)
    const wd = weekdayIndex(date)
    for (const meal of MEALS) {
      if (settings.meals[meal]?.[wd]) {
        slots.push({ date, meal, recipeId: null, factor: 1, status: 'geplant', locked: false, leftoverOf: null })
      }
    }
  }
  return slots
}

/** Slots the planner must not touch when re-planning. */
export const isKept = (s) => s.locked || s.status === 'erledigt' || s.status === 'auswaerts'

/** Slots that eat the dish cooked in `slot`. */
export const childrenOf = (slots, slot) => slots.filter((s) => s.leftoverOf === slotKey(slot))

/**
 * Which free slots share one cooked dish, according to the prep settings.
 * Returns groups of slot indices; the first index of a group is where it gets cooked.
 */
export function buildGroups(slots, free, settings) {
  const prep = settings.prep ?? { mode: 'frisch' }
  const freeSet = new Set(free)
  const at = new Map(slots.map((s, i) => [slotKey(s), i]))
  const grouped = new Set()
  const groups = []

  if (prep.mode === 'reste') {
    // Dinner on day d, rest of it for lunch on d+1. Weekday lunches first (work, school).
    const pairs = []
    for (const i of free) {
      const s = slots[i]
      if (s.meal !== 'abend') continue
      const j = at.get(`${addDays(s.date, 1)}:mittag`)
      if (j !== undefined && freeSet.has(j)) pairs.push([i, j])
    }
    pairs.sort((a, b) => (weekdayIndex(slots[a[1]].date) < 5 ? 0 : 1) - (weekdayIndex(slots[b[1]].date) < 5 ? 0 : 1) || a[0] - b[0])
    for (const [i, j] of pairs.slice(0, prep.leftoverMax)) {
      groups.push([i, j])
      grouped.add(i).add(j)
    }
  } else if (prep.mode === 'mealprep') {
    const size = Math.max(2, prep.batchSize)
    const same = free.filter((i) => slots[i].meal === prep.meal).sort((a, b) => bySlotOrder(slots[a], slots[b]))
    for (let k = 0; k < same.length; k += size) {
      const chunk = same.slice(k, k + size)
      if (chunk.length > 1) {
        groups.push(chunk)
        chunk.forEach((i) => grouped.add(i))
      }
    }
  }
  for (const i of free) if (!grouped.has(i)) groups.push([i])
  return groups
}

/**
 * Plan (or re-plan) a week.
 * previous: an existing week; its locked, done and eaten-out slots are kept,
 *   together with the leftovers that belong to a kept dish.
 * weeks: all stored weeks, for the cross-week cooldown.
 */
export function planWeek({ startDate, recipes, settings, weeks = [], statsById = {}, previous = null, seed = 1, iterations = 600 }) {
  const rng = createRng(seed)
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const history = buildHistory(weeks, startDate)
  const ctx = { byId, settings, history, statsById }

  const prevSlots = previous?.slots ?? []
  const keptKeys = new Set(prevSlots.filter(isKept).map(slotKey))
  // Leftovers of a kept dish stay with it.
  for (const s of prevSlots) if (s.leftoverOf && keptKeys.has(s.leftoverOf)) keptKeys.add(slotKey(s))
  const kept = new Map(prevSlots.filter((s) => keptKeys.has(slotKey(s))).map((s) => {
    // A kept leftover whose dish is being re-planned becomes a meal of its own.
    const orphan = s.leftoverOf && !keptKeys.has(s.leftoverOf)
    return [slotKey(s), orphan ? { ...s, leftoverOf: null } : s]
  }))
  const slots = skeleton(startDate, settings).map((s) => kept.get(slotKey(s)) ?? s)
  for (const [k, s] of kept) if (!slots.some((x) => slotKey(x) === k)) slots.push(s)
  slots.sort(bySlotOrder)

  const pools = Object.fromEntries(MEALS.map((m) => [m, candidatesFor(m, recipes, settings, statsById)]))
  const free = slots.map((_, i) => i).filter((i) => !keptKeys.has(slotKey(slots[i])))
  for (const i of free) {
    slots[i] = { ...slots[i], recipeId: null, leftoverOf: null, status: pools[slots[i].meal].length ? 'geplant' : 'leer' }
  }

  // Groups share one recipe. Multi-slot groups need dishes that keep well.
  const notes = []
  let groups = buildGroups(slots, free.filter((i) => pools[slots[i].meal].length), settings)
  const poolOf = (g) => {
    const base = pools[slots[g[0]].meal]
    return g.length > 1 ? base.filter(canBatch) : base
  }
  if (groups.some((g) => g.length > 1 && !poolOf(g).length)) {
    notes.push('Keine passenden Gerichte zum Vorkochen – alles wird frisch gekocht')
    groups = groups.flatMap((g) => (g.length > 1 && !poolOf(g).length ? g.map((i) => [i]) : [g]))
  }
  const groupPools = groups.map(poolOf)
  const poolSets = groupPools.map((p) => new Set(p.map((r) => r.id)))
  for (const g of groups) {
    const parent = slotKey(slots[g[0]])
    for (const i of g.slice(1)) slots[i].leftoverOf = parent
  }

  const assign = (gi, id) => { for (const i of groups[gi]) slots[i].recipeId = id }
  const costOf = () => evaluate(slots, ctx).cost
  const order = groups.map((_, gi) => gi)

  // 1. Greedy start: fill groups in a shuffled order, picking among the 3 best.
  for (const gi of rng.shuffle(order)) {
    const scored = groupPools[gi].map((r) => {
      assign(gi, r.id)
      return { id: r.id, cost: costOf() }
    })
    scored.sort((a, b) => a.cost - b.cost)
    assign(gi, rng.pick(scored.slice(0, 3)).id)
  }

  // 2. Local search: random replacements and swaps, keep what is not worse.
  let current = costOf()
  for (let it = 0; it < iterations && groups.length; it++) {
    const gi = rng.int(groups.length)
    const old = slots[groups[gi][0]].recipeId
    if (rng.next() < 0.7) {
      assign(gi, rng.pick(groupPools[gi]).id)
      const c = costOf()
      if (c <= current) current = c
      else assign(gi, old)
    } else {
      const meal = slots[groups[gi][0]].meal
      const partners = order.filter((gj) => gj !== gi && slots[groups[gj][0]].meal === meal)
      if (!partners.length) continue
      const gj = rng.pick(partners)
      const other = slots[groups[gj][0]].recipeId
      if (!poolSets[gi].has(other) || !poolSets[gj].has(old)) continue
      assign(gi, other)
      assign(gj, old)
      const c = costOf()
      if (c <= current) current = c
      else {
        assign(gi, old)
        assign(gj, other)
      }
    }
  }

  // 3. Polish: best single replacement per group, twice.
  for (let pass = 0; pass < 2; pass++) {
    for (const gi of order) {
      let best = slots[groups[gi][0]].recipeId
      for (const r of groupPools[gi]) {
        assign(gi, r.id)
        const c = costOf()
        if (c < current) {
          current = c
          best = r.id
        }
      }
      assign(gi, best)
    }
  }

  const result = evaluate(slots, ctx)
  const explanation = explain(result, settings, pools, slots)
  explanation.relaxed.push(...notes)
  return {
    startDate,
    generatedAt: new Date().toISOString(),
    seed,
    slots,
    explain: explanation,
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

  if (stats.cooked < stats.meals) met.push(`${stats.cooked}× kochen für ${stats.meals} Mahlzeiten`)

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

/**
 * Best alternatives for one slot, ranked by how the whole week would score.
 * For a dish with leftovers, the leftovers change with it (and only dishes that
 * keep well are offered). A leftover slot is offered fresh dishes of its own.
 */
export function swapOptions({ week, key, recipes, settings, weeks = [], statsById = {}, limit = 6 }) {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const ctx = { byId, settings, history: buildHistory(weeks, week.startDate), statsById }
  const slots = week.slots.map((s) => ({ ...s }))
  const idx = slots.findIndex((s) => slotKey(s) === key)
  if (idx < 0) return []
  const target = slots[idx]
  target.leftoverOf = null // swapping a leftover means cooking something fresh
  const group = [idx, ...slots.map((s, i) => (s.leftoverOf === key ? i : -1)).filter((i) => i >= 0)]
  const before = evaluate(slots, ctx).cost
  const current = target.recipeId
  let pool = candidatesFor(target.meal, recipes, settings, statsById).filter((r) => r.id !== current)
  if (group.length > 1) pool = pool.filter(canBatch)
  const options = pool.map((r) => {
    for (const i of group) slots[i].recipeId = r.id
    return { recipe: r, delta: evaluate(slots, ctx).cost - before }
  })
  options.sort((a, b) => a.delta - b.delta)
  return options.slice(0, limit)
}
