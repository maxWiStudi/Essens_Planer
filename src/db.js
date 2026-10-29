import { openDB } from 'idb'

export const DB_NAME = 'essensplan'
export const SCHEMA_VERSION = 1

let dbPromise

export function db() {
  dbPromise ??= openDB(DB_NAME, SCHEMA_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('settings')
        const weeks = d.createObjectStore('weeks', { keyPath: 'startDate' })
        weeks.createIndex('generatedAt', 'generatedAt')
        d.createObjectStore('recipeStats', { keyPath: 'recipeId' })
        const ur = d.createObjectStore('userRecipes', { keyPath: 'id' })
        ur.createIndex('source', 'source')
        d.createObjectStore('meta')
        d.createObjectStore('secrets')
      }
    },
  })
  return dbPromise
}

/** For tests: forget the cached connection. */
export function resetConnection() {
  dbPromise = undefined
}

export const getSettings = async () => (await db()).get('settings', 'main')
export const putSettings = async (s) => (await db()).put('settings', s, 'main')

export const allWeeks = async () => (await db()).getAll('weeks')
export const putWeek = async (w) => (await db()).put('weeks', w)
export const deleteWeek = async (startDate) => (await db()).delete('weeks', startDate)

export const allStats = async () => (await db()).getAll('recipeStats')
export const putStat = async (s) => (await db()).put('recipeStats', s)

export const allUserRecipes = async () => (await db()).getAll('userRecipes')
export const putUserRecipe = async (r) => (await db()).put('userRecipes', r)
export const deleteUserRecipe = async (id) => (await db()).delete('userRecipes', id)

export const getMeta = async (k) => (await db()).get('meta', k)
export const putMeta = async (k, v) => (await db()).put('meta', v, k)

export const getSecret = async (k) => (await db()).get('secrets', k)
export const putSecret = async (k, v) => (await db()).put('secrets', v, k)
export const deleteSecret = async (k) => (await db()).delete('secrets', k)

/** Everything except secrets, in the export/sync file format. */
export async function exportData() {
  const [settings, weeks, recipeStats, userRecipes, deviceId, tombstones] = await Promise.all([
    getSettings(), allWeeks(), allStats(), allUserRecipes(), getMeta('deviceId'), getMeta('tombstones'),
  ])
  return {
    app: 'essensplan',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId,
    settings: settings ?? null,
    weeks,
    recipeStats,
    userRecipes,
    tombstones: tombstones ?? {},
  }
}

/** Replace all non-secret data with the given export. */
export async function importData(data) {
  const migrated = migrate(data)
  const d = await db()
  const tx = d.transaction(['settings', 'weeks', 'recipeStats', 'userRecipes', 'meta'], 'readwrite')
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('weeks').clear(),
    tx.objectStore('recipeStats').clear(),
    tx.objectStore('userRecipes').clear(),
  ])
  if (migrated.settings) await tx.objectStore('settings').put(migrated.settings, 'main')
  for (const w of migrated.weeks) await tx.objectStore('weeks').put(w)
  for (const s of migrated.recipeStats) await tx.objectStore('recipeStats').put(s)
  for (const r of migrated.userRecipes) await tx.objectStore('userRecipes').put(r)
  await tx.objectStore('meta').put(migrated.tombstones, 'tombstones')
  await tx.done
}

/** Bring an export from an older app version up to the current format. */
export function migrate(data) {
  if (!data || data.app !== 'essensplan') throw new Error('Das ist keine Essens-Planer-Datei.')
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Die Datei stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.')
  }
  // Version 1 is the first format; future migrations go here, one step per version.
  return {
    ...data,
    weeks: data.weeks ?? [],
    recipeStats: data.recipeStats ?? [],
    userRecipes: data.userRecipes ?? [],
    tombstones: data.tombstones ?? {},
  }
}

export async function clearAll() {
  const d = await db()
  for (const name of d.objectStoreNames) await d.clear(name)
}

export async function ensureDeviceId() {
  let id = await getMeta('deviceId')
  if (!id) {
    id = crypto.randomUUID()
    await putMeta('deviceId', id)
  }
  return id
}

/** Ask the browser not to evict our data. Returns whether it is persistent. */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
