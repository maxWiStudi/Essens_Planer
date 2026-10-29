// Validates every bundled recipe and prints a summary of the pool.
import { readFileSync, readdirSync } from 'node:fs'
import { checkRecipe } from '../src/recipe-check.js'

const dir = new URL('../src/data/recipes/', import.meta.url)
const recipes = readdirSync(dir).filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')))

let errors = 0
const ids = new Set()
for (const r of recipes) {
  const problems = checkRecipe(r)
  if (ids.has(r.id)) problems.push('doppelte id')
  ids.add(r.id)
  if (problems.length) {
    errors += problems.length
    console.error(`✗ ${r.id}: ${problems.join('; ')}`)
  }
}

const count = (pred) => recipes.filter(pred).length
const by = (key, pred = () => true) => {
  const m = {}
  for (const r of recipes.filter(pred)) m[r[key]] = (m[r[key]] ?? 0) + 1
  return m
}
const main = (r) => r.mealTypes.some((m) => m !== 'fruehstueck')
console.log(`${recipes.length} Rezepte · Frühstück ${count((r) => r.mealTypes.includes('fruehstueck'))} · Mittag ${count((r) => r.mealTypes.includes('mittag'))} · Abend ${count((r) => r.mealTypes.includes('abend'))}`)
console.log('Hauptgerichte nach Protein:', by('protein', main))
console.log('Hauptgerichte nach Ernährung:', by('diet', main))
console.log('Hauptgerichte nach Küche:', by('cuisine', main))
if (errors) {
  console.error(`${errors} Fehler`)
  process.exit(1)
}
console.log('Alles gültig.')
