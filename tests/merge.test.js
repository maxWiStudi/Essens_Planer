import { describe, it, expect } from 'vitest'
import { mergeData, sameContent } from '../src/sync/merge.js'

const base = (over = {}) => ({ app: 'essensplan', schemaVersion: 1, settings: null, weeks: [], recipeStats: [], userRecipes: [], tombstones: {}, ...over })
const week = (startDate, updatedAt, note = '') => ({ startDate, updatedAt, slots: [], note })

describe('mergeData', () => {
  it('keeps weeks from both sides and the newer copy of the same week', () => {
    const local = base({ weeks: [week('2026-11-02', '2026-11-03T10:00Z', 'lokal'), week('2026-11-09', '2026-11-03T10:00Z')] })
    const remote = base({ weeks: [week('2026-11-02', '2026-11-03T12:00Z', 'remote'), week('2026-10-26', '2026-10-27T10:00Z')] })
    const merged = mergeData(local, remote)
    expect(merged.weeks.map((w) => w.startDate).sort()).toEqual(['2026-10-26', '2026-11-02', '2026-11-09'])
    expect(merged.weeks.find((w) => w.startDate === '2026-11-02').note).toBe('remote')
  })

  it('respects deletions via tombstones', () => {
    const local = base({ weeks: [], tombstones: { '2026-11-02': '2026-11-04T00:00Z' } })
    const remote = base({ weeks: [week('2026-11-02', '2026-11-03T12:00Z')] })
    expect(mergeData(local, remote).weeks).toEqual([])
  })

  it('keeps a week that was re-created after its deletion', () => {
    const local = base({ tombstones: { '2026-11-02': '2026-11-04T00:00Z' } })
    const remote = base({ weeks: [week('2026-11-02', '2026-11-05T12:00Z')] })
    expect(mergeData(local, remote).weeks).toHaveLength(1)
  })

  it('takes the newer settings and merges recipe stats per recipe', () => {
    const local = base({
      settings: { diet: 'vegan', updatedAt: '2026-11-01T00:00Z' },
      recipeStats: [{ recipeId: 'a', favorite: true, updatedAt: '2026-11-01T00:00Z' }],
    })
    const remote = base({
      settings: { diet: 'omni', updatedAt: '2026-11-02T00:00Z' },
      recipeStats: [{ recipeId: 'a', favorite: false, updatedAt: '2026-10-01T00:00Z' }, { recipeId: 'b', excluded: true, updatedAt: '2026-10-01T00:00Z' }],
    })
    const merged = mergeData(local, remote)
    expect(merged.settings.diet).toBe('omni')
    expect(merged.recipeStats.find((s) => s.recipeId === 'a').favorite).toBe(true)
    expect(merged.recipeStats.find((s) => s.recipeId === 'b').excluded).toBe(true)
  })

  it('returns local data when there is no remote file yet', () => {
    const local = base({ weeks: [week('2026-11-02', 'x')] })
    expect(mergeData(local, null)).toBe(local)
  })
})

describe('sameContent', () => {
  it('ignores export metadata', () => {
    expect(sameContent(base({ exportedAt: '1', deviceId: 'a' }), base({ exportedAt: '2', deviceId: 'b' }))).toBe(true)
    expect(sameContent(base(), base({ weeks: [week('2026-11-02', 'x')] }))).toBe(false)
  })
})
