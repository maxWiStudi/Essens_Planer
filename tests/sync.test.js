import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as db from '../src/db.js'
import { state, load, saveSettings, ensureWeek, toggleFavorite } from '../src/store.js'
import { syncNow, status } from '../src/sync/index.js'
import { checkRepo, readFile } from '../src/sync/github.js'

// An in-memory stand-in for the GitHub contents API.
function fakeGitHub({ isPrivate = true, canWrite = true } = {}) {
  const repo = { file: null, sha: null, commits: 0, conflictOnce: false }
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const fetch = vi.fn(async (url, init = {}) => {
    if (!String(init.headers?.Authorization).startsWith('Bearer ')) return json(401, {})
    const u = new URL(url)
    if (u.pathname === '/repos/me/daten') return json(200, { private: isPrivate, permissions: { push: canWrite }, default_branch: 'main' })
    if (!u.pathname.startsWith('/repos/me/daten/contents/')) return json(404, {})
    if (!init.method || init.method === 'GET') {
      return repo.file ? json(200, { sha: repo.sha, encoding: 'base64', content: repo.file }) : json(404, {})
    }
    const body = JSON.parse(init.body)
    if (repo.conflictOnce) {
      repo.conflictOnce = false
      return json(409, {})
    }
    if ((repo.sha ?? undefined) !== body.sha) return json(409, {})
    repo.file = body.content
    repo.sha = `sha${++repo.commits}`
    return json(200, { content: { sha: repo.sha } })
  })
  const read = () => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(repo.file), (c) => c.charCodeAt(0))))
  const write = (data) => {
    repo.file = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data))))
    repo.sha = `sha${++repo.commits}`
  }
  return { repo, fetch, read, write }
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  db.resetConnection()
  await load()
  await saveSettings({ onboarded: true, sync: { ...state.settings.sync, enabled: true, owner: 'me', repo: 'daten' } })
  await db.putSecret('githubToken', 'tok')
  status.error = null
})

describe('GitHub sync', () => {
  it('first sync creates the file with all data but without the token', async () => {
    const gh = fakeGitHub()
    globalThis.fetch = gh.fetch
    await ensureWeek('2026-11-02')
    await syncNow()
    expect(status.error).toBeNull()
    expect(gh.repo.commits).toBe(1)
    const remote = gh.read()
    expect(remote.weeks).toHaveLength(1)
    expect(JSON.stringify(remote)).not.toContain('tok')
  })

  it('no commit when nothing changed', async () => {
    const gh = fakeGitHub()
    globalThis.fetch = gh.fetch
    await syncNow()
    await syncNow()
    expect(gh.repo.commits).toBe(1)
  })

  it('pulls and merges changes from another device', async () => {
    const gh = fakeGitHub()
    globalThis.fetch = gh.fetch
    await ensureWeek('2026-11-02')
    await syncNow()
    // Another device adds a favourite and a week.
    const other = gh.read()
    other.recipeStats.push({ recipeId: 'shakshuka', favorite: true, excluded: false, rating: 0, updatedAt: new Date(Date.now() + 1000).toISOString() })
    other.weeks.push({ ...other.weeks[0], startDate: '2026-11-09', slots: [], updatedAt: new Date().toISOString() })
    gh.write(other)
    await syncNow()
    expect(state.stats.shakshuka?.favorite).toBe(true)
    expect(state.weeks.has('2026-11-09')).toBe(true)
    expect(state.weeks.has('2026-11-02')).toBe(true)
  })

  it('local changes win when they are newer', async () => {
    const gh = fakeGitHub()
    globalThis.fetch = gh.fetch
    await syncNow()
    await toggleFavorite('linseneintopf')
    await syncNow()
    expect(gh.read().recipeStats.find((s) => s.recipeId === 'linseneintopf').favorite).toBe(true)
  })

  it('retries after a write conflict', async () => {
    const gh = fakeGitHub()
    globalThis.fetch = gh.fetch
    await syncNow()
    await toggleFavorite('linseneintopf')
    gh.repo.conflictOnce = true
    await syncNow()
    expect(status.error).toBeNull()
    expect(gh.read().recipeStats.some((s) => s.recipeId === 'linseneintopf')).toBe(true)
  })

  it('reports a wrong token in plain German', async () => {
    const gh = fakeGitHub()
    globalThis.fetch = gh.fetch
    await db.putSecret('githubToken', '')
    await syncNow()
    expect(status.error).toMatch(/Kein Token/)
  })

  it('reports offline', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    await syncNow()
    expect(status.error).toMatch(/offline/)
  })

  it('checkRepo exposes private flag and write permission', async () => {
    globalThis.fetch = fakeGitHub({ isPrivate: false, canWrite: false }).fetch
    expect(await checkRepo({ owner: 'me', repo: 'daten' }, 'tok')).toEqual({ private: false, canWrite: false, defaultBranch: 'main' })
  })

  it('readFile returns null for a missing file and handles umlauts', async () => {
    const gh = fakeGitHub()
    globalThis.fetch = gh.fetch
    const cfg = { owner: 'me', repo: 'daten', path: 'essensplan.json', branch: 'main' }
    expect(await readFile(cfg, 'tok')).toBeNull()
    gh.write({ app: 'essensplan', name: 'Grüße, Äpfel & Soße 🍲' })
    expect((await readFile(cfg, 'tok')).json.name).toBe('Grüße, Äpfel & Soße 🍲')
  })
})
