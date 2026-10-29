// Merge two export files (this device and the copy on GitHub).
// Rule: per record, the newer updatedAt wins. Deleted weeks leave a tombstone
// so a delete on one device is not undone by the other device's old copy.

const newer = (a, b) => ((a?.updatedAt ?? '') >= (b?.updatedAt ?? '') ? a : b)

function mergeBy(key, a = [], b = []) {
  const out = new Map()
  for (const r of [...a, ...b]) {
    const k = r[key]
    out.set(k, out.has(k) ? newer(out.get(k), r) : r)
  }
  return [...out.values()]
}

function mergeTombstones(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) if (!out[k] || v > out[k]) out[k] = v
  return out
}

export function mergeData(local, remote) {
  if (!remote) return local
  if (!local) return remote
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones)
  const weeks = mergeBy('startDate', local.weeks, remote.weeks)
    .filter((w) => !tombstones[w.startDate] || tombstones[w.startDate] < (w.updatedAt ?? ''))
  return {
    ...local,
    schemaVersion: Math.max(local.schemaVersion ?? 1, remote.schemaVersion ?? 1),
    settings: local.settings && remote.settings ? newer(local.settings, remote.settings) : (local.settings ?? remote.settings),
    weeks,
    recipeStats: mergeBy('recipeId', local.recipeStats, remote.recipeStats),
    userRecipes: mergeBy('id', local.userRecipes, remote.userRecipes),
    tombstones,
  }
}

/** Content equality, ignoring export metadata. */
export function sameContent(a, b) {
  if (!a || !b) return false
  const strip = ({ exportedAt, deviceId, ...rest }) => rest
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}
