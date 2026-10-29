import { MEALS, DIETS, PROTEINS, BASES, STYLES, ALLERGENS, AISLES, EQUIPMENT, UNITS } from './vocab.js'

/** Returns a list of problems; empty means the recipe is valid. Used by the CLI check and for imported/AI recipes. */
export function checkRecipe(r) {
  const p = []
  const need = (cond, msg) => { if (!cond) p.push(msg) }
  need(typeof r.id === 'string' && /^[a-z0-9-]+$/.test(r.id), 'id: nur a-z, 0-9 und -')
  need(typeof r.title === 'string' && r.title.length >= 3, 'title fehlt')
  need(Array.isArray(r.mealTypes) && r.mealTypes.length && r.mealTypes.every((m) => MEALS.includes(m)), 'mealTypes ungültig')
  need(Number.isFinite(r.minutes) && r.minutes > 0 && r.minutes <= 240, 'minutes ungültig')
  need(Number.isFinite(r.servings) && r.servings > 0, 'servings ungültig')
  need(DIETS.includes(r.diet), `diet ungültig: ${r.diet}`)
  need(PROTEINS.includes(r.protein), `protein ungültig: ${r.protein}`)
  need(BASES.includes(r.base), `base ungültig: ${r.base}`)
  need(Number.isInteger(r.vegPortions) && r.vegPortions >= 0 && r.vegPortions <= 5, 'vegPortions ungültig')
  need(typeof r.cuisine === 'string' && r.cuisine.length > 0, 'cuisine fehlt')
  need(STYLES.includes(r.style), `style ungültig: ${r.style}`)
  need(Array.isArray(r.allergens) && r.allergens.every((a) => ALLERGENS.includes(a)), 'allergens ungültig')
  need(Array.isArray(r.equipment) && r.equipment.every((e) => EQUIPMENT.includes(e)), 'equipment ungültig')
  need(Array.isArray(r.steps) && r.steps.length > 0 && r.steps.every((s) => typeof s === 'string' && s.length > 3), 'steps fehlen')
  need(Array.isArray(r.ingredients) && r.ingredients.length > 0, 'ingredients fehlen')
  for (const i of r.ingredients ?? []) {
    const [name, qty, unit, aisle] = Array.isArray(i) ? i : [i.name, i.qty, i.unit, i.aisle]
    need(typeof name === 'string' && name.length > 1, `Zutat ohne Namen in ${r.id}`)
    need(qty === null || (Number.isFinite(qty) && qty > 0), `Menge ungültig: ${name}`)
    need(qty === null ? unit === '' : UNITS.includes(unit), `Einheit ungültig: ${name} (${unit})`)
    need(AISLES.includes(aisle), `Gang ungültig: ${name} (${aisle})`)
  }
  // Consistency between diet and protein.
  if (['gefluegel', 'rind', 'schwein'].includes(r.protein)) need(r.diet === 'omni', 'Fleisch-Rezept muss diet omni haben')
  if (['fisch', 'meeresfruechte'].includes(r.protein)) need(['pescetarisch', 'omni'].includes(r.diet), 'Fisch-Rezept braucht pescetarisch/omni')
  return p
}
