import { html } from '../lib/html.js'
import { state, updateSlot, getWeek, currentWeekStart } from '../store.js'
import { weekStartOf } from '../lib/dates.js'
import { swapOptions, slotKey } from '../planner/generate.js'
import { openSheet, closeSheet } from '../ui/sheet.js'
import { toast } from '../ui/toast.js'
import { recipeChips } from '../ui/components.js'
import { MEAL_LABEL } from '../vocab.js'

export const slotHref = (slot) => `#/woche/${slot.date}/${slot.meal}`

export function findSlot(date, meal) {
  const week = getWeek(weekStartOf(date, state.settings.weekStart))
  return { week, slot: week?.slots.find((s) => s.date === date && s.meal === meal) ?? null }
}

/** Handlers used wherever planned meals are listed. */
export const slotActions = {
  'toggle-done': async (el) => {
    const { week, slot } = findSlot(el.dataset.date, el.dataset.meal)
    if (!slot) return
    await updateSlot(week.startDate, slotKey(slot), { status: slot.status === 'erledigt' ? 'geplant' : 'erledigt' })
  },
  'toggle-lock': async (el) => {
    const { week, slot } = findSlot(el.dataset.date, el.dataset.meal)
    if (!slot) return
    await updateSlot(week.startDate, slotKey(slot), { locked: !slot.locked })
    toast(slot.locked ? 'Nicht mehr fixiert' : 'Fixiert – bleibt beim Neuplanen stehen')
  },
  swap: (el) => openSwapSheet(el.dataset.date, el.dataset.meal),
}

function hint(delta) {
  if (delta <= 0) return html`<span class="text-xs font-medium text-ok">passt gut in die Woche</span>`
  if (delta <= 12) return html`<span class="text-xs font-medium text-muted">etwas weniger Abwechslung</span>`
  return html`<span class="text-xs font-medium text-warn">bricht eine Regel (z. B. doppelt oder kürzlich gegessen)</span>`
}

/** Bottom sheet with the best alternatives for one slot. */
export function openSwapSheet(date, meal) {
  const { week, slot } = findSlot(date, meal)
  if (!slot) return
  const options = swapOptions({
    week, key: slotKey(slot), recipes: state.recipes, settings: state.settings,
    weeks: [...state.weeks.values()], statsById: state.stats,
  })
  const before = slot.recipeId
  openSheet({
    title: `${MEAL_LABEL[meal]} tauschen`,
    body: options.length
      ? html`
        <p class="mb-3 text-sm text-muted">Die besten Alternativen für diesen Tag – nach Abwechslung und Ausgewogenheit sortiert.</p>
        <ul class="space-y-2">
          ${options.map((o) => html`
            <li>
              <button type="button" class="card w-full p-3 text-left hover:border-primary" data-action="pick" data-id="${o.recipe.id}">
                <span class="block font-semibold">${o.recipe.title}</span>
                ${recipeChips(o.recipe)}
                <span class="mt-1 block">${hint(o.delta)}</span>
              </button>
            </li>`)}
        </ul>`
      : html`<p class="text-sm text-muted">Keine anderen Rezepte passen zu deinen Einstellungen.</p>`,
    actions: {
      pick: async (btn) => {
        closeSheet()
        await updateSlot(week.startDate, slotKey(slot), { recipeId: btn.dataset.id, status: 'geplant' })
        toast('Getauscht', {
          label: 'Rückgängig',
          run: () => updateSlot(week.startDate, slotKey(slot), { recipeId: before }),
        })
      },
    },
  })
}

export const isCurrentWeek = (startDate) => startDate === currentWeekStart()
