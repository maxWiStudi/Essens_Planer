import * as db from '../db.js'
import { state, onDataChange, reloadFromDb } from '../store.js'
import { readFile, writeFile } from './github.js'
import { mergeData, sameContent } from './merge.js'

// Sync engine: pull, merge, push. Runs on start, ~20 s after changes, and
// when the app goes to the background. Every push is one commit, so the
// repo's history is a full log of all versions.

const DEBOUNCE_MS = 20_000
export const status = { running: false, lastAt: null, error: null, pending: false }
const listeners = new Set()
let timer = null

export const onStatus = (fn) => (listeners.add(fn), () => listeners.delete(fn))
const emit = () => listeners.forEach((fn) => fn(status))

export const isEnabled = () => state.settings.sync.enabled && state.settings.sync.owner && state.settings.sync.repo

function config() {
  const { owner, repo, path, branch } = state.settings.sync
  return { owner: owner.trim(), repo: repo.trim(), path: path.trim() || 'essensplan.json', branch: branch.trim() || 'main' }
}

export async function syncNow({ attempt = 1 } = {}) {
  if (!isEnabled() || status.running) return
  const token = await db.getSecret('githubToken')
  if (!token) {
    status.error = 'Kein Token gespeichert'
    return emit()
  }
  clearTimeout(timer)
  status.running = true
  status.pending = false
  status.error = null
  emit()
  try {
    const cfg = config()
    const last = await db.getMeta('lastSync')
    const remote = await readFile(cfg, token)
    let local = await db.exportData()

    // Somebody else (another device) pushed since our last sync: merge it in.
    if (remote && remote.sha !== last?.sha) {
      const merged = mergeData(local, remote.json)
      if (!sameContent(merged, local)) {
        await db.importData(merged)
        await reloadFromDb({ silent: true })
        local = await db.exportData()
      }
    }

    let sha = remote?.sha ?? null
    if (!remote || !sameContent(local, remote.json)) {
      const message = `Essens Planer: Stand vom ${new Date().toLocaleString('de-DE')}`
      sha = await writeFile(cfg, token, local, remote?.sha, message)
    }
    const at = new Date().toISOString()
    await db.putMeta('lastSync', { sha, at })
    status.lastAt = at
  } catch (e) {
    // Another device pushed between our read and write: start over once.
    if ((e.status === 409 || e.status === 422) && attempt < 3) {
      status.running = false
      return syncNow({ attempt: attempt + 1 })
    }
    status.error = e.message
  } finally {
    status.running = false
    emit()
  }
}

export function scheduleSync() {
  if (!isEnabled()) return
  status.pending = true
  emit()
  clearTimeout(timer)
  timer = setTimeout(syncNow, DEBOUNCE_MS)
}

export async function initSync() {
  status.lastAt = (await db.getMeta('lastSync'))?.at ?? null
  onDataChange(scheduleSync)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && status.pending) syncNow()
  })
  window.addEventListener('online', () => status.pending && syncNow())
  if (isEnabled()) syncNow()
}
