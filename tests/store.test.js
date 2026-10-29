import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, beforeEach } from 'vitest'
import * as db from '../src/db.js'
import {
  state, load, saveSettings, ensureWeek, replanWeek, updateSlot, swapSlot, toggleAway,
  deleteWeek, toggleChecked, setExcluded, toggleFavorite, onDataChange, updateWeekSlots,
} from '../src/store.js'
import { slotKey } from '../src/planner/generate.js'
import { buildList } from '../src/shopping/list.js'

const START = '2026-11-02'

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  db.resetConnection()
  await load()
  await saveSettings({ onboarded: true })
})

const keyOf = slotKey
const reste = () => saveSettings({ prep: { ...state.settings.prep, mode: 'reste', leftoverMax: 3 } })

describe('store + IndexedDB', () => {
  it('persists a generated week and reloads it unchanged', async () => {
    const w = await ensureWeek(START)
    await load()
    expect(state.weeks.get(START).slots.map((s) => s.recipeId)).toEqual(w.slots.map((s) => s.recipeId))
  })

  it('ensureWeek does not re-plan an existing week', async () => {
    const a = await ensureWeek(START)
    const b = await ensureWeek(START)
    expect(b).toBe(a)
  })

  it('marks meals as eaten and notifies change listeners', async () => {
    let calls = 0
    const off = onDataChange(() => calls++)
    const w = await ensureWeek(START)
    await updateSlot(START, keyOf(w.slots[0]), { status: 'erledigt' })
    off()
    expect(state.weeks.get(START).slots[0].status).toBe('erledigt')
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('swapping a dish with leftovers moves the leftovers along; undo restores', async () => {
    await reste()
    const w = await ensureWeek(START)
    const parent = w.slots.find((s) => w.slots.some((k) => k.leftoverOf === keyOf(s)))
    const snapshot = w.slots
    await swapSlot(START, keyOf(parent), 'chili-sin-carne')
    const after = state.weeks.get(START).slots
    for (const k of after.filter((s) => s.leftoverOf === keyOf(parent))) expect(k.recipeId).toBe('chili-sin-carne')
    await updateWeekSlots(START, snapshot)
    expect(state.weeks.get(START).slots).toEqual(snapshot)
  })

  it('swapping a leftover slot cooks it fresh (unlinks it)', async () => {
    await reste()
    const w = await ensureWeek(START)
    const kid = w.slots.find((s) => s.leftoverOf)
    await swapSlot(START, keyOf(kid), 'linsen-dal-spinat')
    const now = state.weeks.get(START).slots.find((s) => keyOf(s) === keyOf(kid))
    expect(now.leftoverOf).toBeNull()
    expect(now.recipeId).toBe('linsen-dal-spinat')
  })

  it('eating out on a cooking day turns its leftovers into fresh meals; shopping list follows', async () => {
    await reste()
    const w = await ensureWeek(START)
    const parent = w.slots.find((s) => w.slots.some((k) => k.leftoverOf === keyOf(s)))
    await toggleAway(START, keyOf(parent))
    const slots = state.weeks.get(START).slots
    expect(slots.find((s) => keyOf(s) === keyOf(parent)).status).toBe('auswaerts')
    expect(slots.filter((s) => s.leftoverOf === keyOf(parent))).toHaveLength(0)
    // The away slot is no longer in the list, the former leftover still is.
    const recipe = state.byId.get(parent.recipeId)
    const items = buildList(state.weeks.get(START), state.byId, state.settings).flatMap((g) => g.items)
    expect(items.some((i) => i.recipes.includes(recipe.title))).toBe(true)
    await toggleAway(START, keyOf(parent))
    expect(state.weeks.get(START).slots.find((s) => keyOf(s) === keyOf(parent)).status).toBe('geplant')
  })

  it('shopping list counts the cooking day plus its leftovers', async () => {
    await reste()
    const w = await ensureWeek(START)
    const parent = w.slots.find((s) => w.slots.some((k) => k.leftoverOf === keyOf(s)))
    const only = { ...w, slots: w.slots.filter((s) => keyOf(s) === keyOf(parent) || s.leftoverOf === keyOf(parent)) }
    const r = state.byId.get(parent.recipeId)
    const first = r.ingredients.find((i) => i.qty != null && i.unit === 'g')
    if (!first) return
    const items = buildList(only, state.byId, state.settings).flatMap((g) => g.items)
    const item = items.find((i) => i.name === first.name)
    // 1 person × 2 meals / recipe servings
    const expected = (first.qty * 2) / r.servings
    expect(item.amounts.get('g')).toBeCloseTo(expected)
  })

  it('re-planning keeps locked and eaten meals', async () => {
    const w = await ensureWeek(START)
    await updateSlot(START, keyOf(w.slots[1]), { locked: true })
    await updateSlot(START, keyOf(w.slots[2]), { status: 'erledigt' })
    const again = await replanWeek(START)
    expect(again.slots[1].recipeId).toBe(w.slots[1].recipeId)
    expect(again.slots[2].recipeId).toBe(w.slots[2].recipeId)
  })

  it('excluded recipes never come back when re-planning', async () => {
    const w = await ensureWeek(START)
    const id = w.slots[3].recipeId
    await setExcluded(id, true)
    for (let i = 0; i < 3; i++) {
      const again = await replanWeek(START)
      expect(again.slots.map((s) => s.recipeId)).not.toContain(id)
    }
  })

  it('favorites persist', async () => {
    await toggleFavorite('shakshuka')
    await load()
    expect(state.stats.shakshuka.favorite).toBe(true)
  })

  it('shopping checks persist per week', async () => {
    await ensureWeek(START)
    await toggleChecked(START, 'obst-gemuese|zwiebel')
    await load()
    expect(state.weeks.get(START).shoppingChecked['obst-gemuese|zwiebel']).toBe(true)
  })

  it('deleting a week leaves a tombstone for sync', async () => {
    await ensureWeek(START)
    await deleteWeek(START)
    expect(state.weeks.has(START)).toBe(false)
    const data = await db.exportData()
    expect(data.tombstones[START]).toBeTruthy()
  })

  it('export → wipe → import restores everything except secrets', async () => {
    await ensureWeek(START)
    await toggleFavorite('linseneintopf')
    await db.putSecret('githubToken', 'geheim')
    const data = await db.exportData()
    expect(JSON.stringify(data)).not.toContain('geheim')
    await db.clearAll()
    await load()
    expect(state.weeks.size).toBe(0)
    await db.importData(JSON.parse(JSON.stringify(data)))
    await load()
    expect(state.weeks.get(START).slots).toEqual(data.weeks[0].slots)
    expect(state.stats.linseneintopf.favorite).toBe(true)
    expect(state.settings.onboarded).toBe(true)
  })

  it('rejects foreign or newer files on import', async () => {
    await expect(db.importData({ foo: 1 })).rejects.toThrow(/keine Essens-Planer-Datei/)
    await expect(db.importData({ app: 'essensplan', schemaVersion: 99 })).rejects.toThrow(/neueren App-Version/)
  })

  it('settings written by an older version get new defaults', async () => {
    const s = { ...state.settings }
    delete s.prep
    await db.putSettings(s)
    await load()
    expect(state.settings.prep.mode).toBe('frisch')
  })
})
