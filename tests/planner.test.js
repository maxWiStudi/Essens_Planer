import { describe, it, expect } from 'vitest'
import { BUNDLED } from '../src/recipes.js'
import { defaultSettings } from '../src/defaults.js'
import { planWeek, swapOptions, skeleton, slotKey } from '../src/planner/generate.js'
import { addDays } from '../src/lib/dates.js'
import { MEAT, SEAFOOD } from '../src/vocab.js'

const START = '2026-11-02' // a Monday
const byId = new Map(BUNDLED.map((r) => [r.id, r]))
const plan = (over = {}) => planWeek({ startDate: START, recipes: BUNDLED, settings: defaultSettings(), seed: 7, ...over })
const ids = (week) => week.slots.filter((s) => s.recipeId).map((s) => s.recipeId)

describe('planWeek', () => {
  it('fills every slot of a full week with 21 different dishes', () => {
    const week = plan()
    expect(week.slots).toHaveLength(21)
    expect(new Set(ids(week)).size).toBe(21)
    expect(week.explain.relaxed).toEqual([])
  })

  it('only uses recipes for the right meal type', () => {
    for (const s of plan().slots) expect(byId.get(s.recipeId).mealTypes).toContain(s.meal)
  })

  it('respects per-weekday meal settings', () => {
    const settings = defaultSettings()
    settings.meals.mittag = [false, false, false, false, false, true, true]
    settings.meals.fruehstueck = [false, false, false, false, false, false, false]
    const week = plan({ settings })
    expect(week.slots).toHaveLength(9)
    expect(week.slots.filter((s) => s.meal === 'mittag').map((s) => s.date)).toEqual([addDays(START, 5), addDays(START, 6)])
  })

  it('hits the balance targets in a full omni week', () => {
    const week = plan()
    const mains = week.slots.filter((s) => s.meal !== 'fruehstueck').map((s) => byId.get(s.recipeId))
    const fish = mains.filter((r) => SEAFOOD.has(r.protein)).length
    const legumes = mains.filter((r) => r.protein === 'huelsenfruechte').length
    const meat = mains.filter((r) => MEAT.has(r.protein)).length
    expect(fish).toBeGreaterThanOrEqual(1)
    expect(fish).toBeLessThanOrEqual(2)
    expect(legumes).toBeGreaterThanOrEqual(2)
    expect(meat).toBeLessThanOrEqual(3)
  })

  it('never serves the same protein in two mains in a row', () => {
    const week = plan()
    const mains = week.slots.filter((s) => s.meal !== 'fruehstueck').map((s) => byId.get(s.recipeId))
    for (let i = 1; i < mains.length; i++) {
      if (mains[i].protein !== 'keins') expect(mains[i].protein).not.toBe(mains[i - 1].protein)
    }
  })

  it('applies hard filters: vegan diet and allergens', () => {
    const settings = defaultSettings()
    settings.diet = 'vegan'
    settings.allergens = ['gluten']
    const week = plan({ settings })
    for (const id of ids(week)) {
      const r = byId.get(id)
      expect(r.diet).toBe('vegan')
      expect(r.allergens).not.toContain('gluten')
    }
  })

  it('reports honestly when the pool is too small', () => {
    const settings = defaultSettings()
    settings.diet = 'vegan'
    settings.allergens = ['gluten', 'soja']
    const week = plan({ settings })
    expect(week.explain.relaxed.length).toBeGreaterThan(0)
  })

  it('avoids dishes from the previous weeks (cooldown)', () => {
    const w1 = plan({ seed: 1 })
    const w2 = planWeek({ startDate: addDays(START, 7), recipes: BUNDLED, settings: defaultSettings(), weeks: [w1], seed: 2 })
    const w1Mains = new Set(w1.slots.filter((s) => s.meal !== 'fruehstueck').map((s) => s.recipeId))
    const repeated = w2.slots.filter((s) => s.meal !== 'fruehstueck' && w1Mains.has(s.recipeId))
    // 14 mains out of a ~60-recipe pool: a second week can be fully fresh.
    expect(repeated).toHaveLength(0)
  })

  it('keeps locked and done slots when re-planning', () => {
    const w1 = plan({ seed: 3 })
    w1.slots[0] = { ...w1.slots[0], locked: true }
    w1.slots[4] = { ...w1.slots[4], status: 'erledigt' }
    const again = plan({ previous: w1, seed: 99 })
    expect(again.slots.find((s) => slotKey(s) === slotKey(w1.slots[0])).recipeId).toBe(w1.slots[0].recipeId)
    expect(again.slots.find((s) => slotKey(s) === slotKey(w1.slots[4])).recipeId).toBe(w1.slots[4].recipeId)
  })

  it('is reproducible from its seed', () => {
    expect(ids(plan({ seed: 42 }))).toEqual(ids(plan({ seed: 42 })))
  })

  it('never uses a recipe marked "nicht für mich"', () => {
    const banned = plan().slots[5].recipeId
    const week = plan({ statsById: { [banned]: { excluded: true } }, seed: 11 })
    expect(ids(week)).not.toContain(banned)
  })

  it('runs fast enough for a phone', () => {
    const t = performance.now()
    plan({ seed: 5 })
    expect(performance.now() - t).toBeLessThan(1500)
  })
})

describe('swapOptions', () => {
  it('offers alternatives of the same meal type, best first, without the current dish', () => {
    const week = plan()
    const key = slotKey(week.slots.find((s) => s.meal === 'abend'))
    const current = week.slots.find((s) => slotKey(s) === key).recipeId
    const opts = swapOptions({ week, key, recipes: BUNDLED, settings: defaultSettings() })
    expect(opts.length).toBeGreaterThan(0)
    expect(opts.map((o) => o.recipe.id)).not.toContain(current)
    for (const o of opts) expect(o.recipe.mealTypes).toContain('abend')
    for (let i = 1; i < opts.length; i++) expect(opts[i].delta).toBeGreaterThanOrEqual(opts[i - 1].delta)
  })
})

describe('skeleton', () => {
  it('creates slots in date order for a non-Monday week start', () => {
    const s = skeleton('2026-11-01', defaultSettings())
    expect(s[0].date).toBe('2026-11-01')
    expect(s.at(-1).date).toBe('2026-11-07')
  })
})
