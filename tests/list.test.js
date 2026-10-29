import { describe, it, expect } from 'vitest'
import { buildList, formatAmount, listAsText } from '../src/shopping/list.js'
import { defaultSettings } from '../src/defaults.js'

const recipe = (id, servings, ingredients) => ({ id, title: id, servings, ingredients: ingredients.map(([name, qty, unit, aisle]) => ({ name, qty, unit, aisle })) })
const byId = new Map([
  ['a', recipe('a', 2, [['Zwiebel', 1, 'Stk', 'obst-gemuese'], ['Reis', 150, 'g', 'trocken'], ['Salz', null, '', 'vorrat']])],
  ['b', recipe('b', 1, [['zwiebel', 1, 'Stk', 'obst-gemuese'], ['Reis', 900, 'g', 'trocken']])],
])

describe('buildList', () => {
  it('adds up the same ingredient across recipes and scales to the household', () => {
    const settings = { ...defaultSettings(), household: [{ name: 'A', factor: 1 }, { name: 'B', factor: 1 }] }
    const week = { slots: [
      { date: '2026-11-02', meal: 'abend', recipeId: 'a', status: 'geplant', factor: 1 },
      { date: '2026-11-03', meal: 'abend', recipeId: 'b', status: 'geplant', factor: 1 },
    ] }
    const groups = buildList(week, byId, settings)
    const items = groups.flatMap((g) => g.items)
    expect(items.find((i) => i.name === 'Zwiebel').amountText).toBe('3 Stk') // 1 + 1×2
    expect(items.find((i) => i.name === 'Reis').amountText).toBe('2 kg') // 150 + 1800 = 1950 g
    expect(items.find((i) => i.name === 'Salz').amountText).toBe('nach Bedarf')
    expect(groups.map((g) => g.aisle)).toEqual(['obst-gemuese', 'trocken', 'vorrat'])
  })

  it('skips meals eaten out', () => {
    const week = { slots: [{ date: '2026-11-02', meal: 'abend', recipeId: 'b', status: 'auswaerts', factor: 1 }] }
    expect(buildList(week, byId, defaultSettings())).toEqual([])
  })
})

describe('formatAmount', () => {
  it('rounds sensibly', () => {
    expect(formatAmount(12, 'g')).toBe('10 g')
    expect(formatAmount(2, 'g')).toBe('5 g')
    expect(formatAmount(1234, 'ml')).toBe('1,2 l')
    expect(formatAmount(0.3, 'Stk')).toBe('0,5 Stk')
    expect(formatAmount(1.25, 'EL')).toBe('1,5 EL')
  })
})

describe('listAsText', () => {
  it('leaves out checked items', () => {
    const groups = [{ label: 'Obst', items: [{ key: 'x', name: 'Apfel', amountText: '2 Stk' }, { key: 'y', name: 'Birne', amountText: '1 Stk' }] }]
    expect(listAsText(groups, { x: true })).toBe('Einkaufsliste\n\nObst:\n• Birne – 1 Stk')
  })
})
