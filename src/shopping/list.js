import { AISLES, AISLE_LABEL } from '../vocab.js'
import { portionsOf } from '../defaults.js'

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
export const itemKey = (name, aisle) => `${aisle}|${norm(name)}`

/** Scale factor for one planned slot: people at the table vs. the recipe's servings. */
export function slotScale(slot, recipe, settings) {
  return (portionsOf(settings) * (slot.factor ?? 1)) / recipe.servings
}

/**
 * Shopping list for a week, grouped by aisle.
 * Slots eaten out are skipped. Amounts with the same unit are added up.
 */
export function buildList(week, byId, settings) {
  const items = new Map()
  for (const slot of week.slots) {
    if (!slot.recipeId || slot.status === 'auswaerts') continue
    const r = byId.get(slot.recipeId)
    if (!r) continue
    const scale = slotScale(slot, r, settings)
    for (const ing of r.ingredients) {
      const key = itemKey(ing.name, ing.aisle)
      if (!items.has(key)) items.set(key, { key, name: ing.name, aisle: ing.aisle, amounts: new Map(), recipes: new Set() })
      const item = items.get(key)
      item.recipes.add(r.title)
      if (ing.qty == null) continue
      item.amounts.set(ing.unit, (item.amounts.get(ing.unit) ?? 0) + ing.qty * scale)
    }
  }
  return AISLES.map((aisle) => ({
    aisle,
    label: AISLE_LABEL[aisle],
    items: [...items.values()]
      .filter((i) => i.aisle === aisle)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((i) => ({ ...i, amountText: formatAmounts(i.amounts), recipes: [...i.recipes] })),
  })).filter((g) => g.items.length)
}

const num = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

export function formatAmount(qty, unit) {
  if (unit === 'g' || unit === 'ml') {
    if (qty >= 1000) return `${num(Math.round(qty / 100) / 10)} ${unit === 'g' ? 'kg' : 'l'}`
    const step = qty < 50 ? 5 : 10
    return `${Math.max(step, Math.round(qty / step) * step)} ${unit}`
  }
  // Pieces, spoons, bunches …: round up to halves so there is always enough.
  const rounded = Math.ceil(qty * 2) / 2
  return `${num(rounded)} ${unit}`
}

export function formatAmounts(amounts) {
  if (!amounts.size) return 'nach Bedarf'
  return [...amounts].map(([unit, qty]) => formatAmount(qty, unit)).join(' + ')
}

/** Plain text for sharing (messenger, notes). */
export function listAsText(groups, checked = {}, title = 'Einkaufsliste') {
  const lines = [title, '']
  for (const g of groups) {
    const open = g.items.filter((i) => !checked[i.key])
    if (!open.length) continue
    lines.push(`${g.label}:`)
    for (const i of open) lines.push(`• ${i.name} – ${i.amountText}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
