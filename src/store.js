import * as db from './db.js'
import { withDefaults } from './defaults.js'
import { allRecipes } from './recipes.js'
import { planWeek, slotKey } from './planner/generate.js'
import { newSeed } from './lib/rng.js'
import { today, weekStartOf } from './lib/dates.js'

// In-memory app state, mirrored to IndexedDB on every change.
export const state = {
  ready: false,
  settings: withDefaults(null),
  weeks: new Map(),
  stats: {},
  userRecipes: [],
  recipes: allRecipes(),
  byId: new Map(),
  persistent: false,
}

const listeners = new Set()
const changeListeners = new Set()

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Called after every data change that should be synced/backed up. */
export function onDataChange(fn) {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn(state)
}

function changed() {
  emit()
  for (const fn of changeListeners) fn()
}

function rebuildRecipes() {
  state.recipes = allRecipes(state.userRecipes)
  state.byId = new Map(state.recipes.map((r) => [r.id, r]))
}

export async function load() {
  await db.ensureDeviceId()
  const [settings, weeks, stats, userRecipes] = await Promise.all([
    db.getSettings(), db.allWeeks(), db.allStats(), db.allUserRecipes(),
  ])
  state.settings = withDefaults(settings)
  state.weeks = new Map(weeks.map((w) => [w.startDate, w]))
  state.stats = Object.fromEntries(stats.map((s) => [s.recipeId, s]))
  state.userRecipes = userRecipes
  rebuildRecipes()
  state.ready = true
  emit()
}

export const currentWeekStart = () => weekStartOf(today(), state.settings.weekStart)

// ---------- settings ----------

export async function saveSettings(patch) {
  state.settings = withDefaults({ ...state.settings, ...patch, updatedAt: new Date().toISOString() })
  await db.putSettings(state.settings)
  changed()
}

// ---------- weeks ----------

function plannerInput() {
  return {
    recipes: state.recipes,
    settings: state.settings,
    weeks: [...state.weeks.values()],
    statsById: state.stats,
  }
}

async function storeWeek(week) {
  week.updatedAt = new Date().toISOString()
  state.weeks.set(week.startDate, week)
  await db.putWeek(week)
  changed()
  return week
}

export function getWeek(startDate) {
  return state.weeks.get(startDate) ?? null
}

/** Create the plan for a week if it does not exist yet. */
export async function ensureWeek(startDate) {
  if (state.weeks.has(startDate)) return state.weeks.get(startDate)
  return storeWeek(planWeek({ ...plannerInput(), startDate, seed: newSeed() }))
}

/** Re-plan a week. Locked, done and eaten-out meals stay. */
export async function replanWeek(startDate) {
  const previous = state.weeks.get(startDate) ?? null
  return storeWeek(planWeek({ ...plannerInput(), startDate, previous, seed: newSeed() }))
}

export async function updateSlot(startDate, key, patch) {
  const week = state.weeks.get(startDate)
  if (!week) return
  const next = { ...week, slots: week.slots.map((s) => (slotKey(s) === key ? { ...s, ...patch } : s)) }
  return storeWeek(next)
}

/** Replace all slots of a week (used for undo). */
export async function updateWeekSlots(startDate, slots) {
  const week = state.weeks.get(startDate)
  if (week) return storeWeek({ ...week, slots })
}

/**
 * Put another dish into a slot. A dish with leftovers takes its leftovers along;
 * a leftover slot that gets its own dish is cooked fresh from then on.
 */
export async function swapSlot(startDate, key, recipeId) {
  const week = state.weeks.get(startDate)
  if (!week) return
  const slots = week.slots.map((s) => {
    if (slotKey(s) === key) return { ...s, recipeId, leftoverOf: null, status: 'geplant' }
    if (s.leftoverOf === key) return { ...s, recipeId }
    return s
  })
  return storeWeek({ ...week, slots })
}

/** Toggle "eaten out". Without the cooked dish there are no leftovers: they become fresh meals. */
export async function toggleAway(startDate, key) {
  const week = state.weeks.get(startDate)
  if (!week) return
  const slot = week.slots.find((s) => slotKey(s) === key)
  const away = slot.status !== 'auswaerts'
  const slots = week.slots.map((s) => {
    if (slotKey(s) === key) return { ...s, status: away ? 'auswaerts' : 'geplant' }
    if (away && s.leftoverOf === key) return { ...s, leftoverOf: null }
    return s
  })
  return storeWeek({ ...week, slots })
}

export async function deleteWeek(startDate) {
  state.weeks.delete(startDate)
  await db.deleteWeek(startDate)
  // Remember the deletion so a sync does not bring the week back.
  const tombstones = (await db.getMeta('tombstones')) ?? {}
  await db.putMeta('tombstones', { ...tombstones, [startDate]: new Date().toISOString() })
  changed()
}

export async function toggleChecked(startDate, itemKey) {
  const week = state.weeks.get(startDate)
  if (!week) return
  const shoppingChecked = { ...week.shoppingChecked, [itemKey]: !week.shoppingChecked?.[itemKey] }
  return storeWeek({ ...week, shoppingChecked })
}

export async function clearChecked(startDate) {
  const week = state.weeks.get(startDate)
  if (week) return storeWeek({ ...week, shoppingChecked: {} })
}

// ---------- recipe preferences ----------

async function updateStat(recipeId, patch) {
  const next = {
    recipeId, favorite: false, excluded: false, rating: 0,
    ...state.stats[recipeId], ...patch, updatedAt: new Date().toISOString(),
  }
  state.stats = { ...state.stats, [recipeId]: next }
  await db.putStat(next)
  changed()
}

export const toggleFavorite = (id) => updateStat(id, { favorite: !state.stats[id]?.favorite })
export const setExcluded = (id, excluded) => updateStat(id, { excluded })

// ---------- whole data set ----------

/** After an import (counts as a change) or a sync download (does not). */
export async function reloadFromDb({ silent = false } = {}) {
  await load()
  if (!silent) changed()
}
