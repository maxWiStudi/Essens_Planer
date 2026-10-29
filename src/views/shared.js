import { html } from '../lib/html.js'
import { state, updateSlot, swapSlot, updateWeekSlots, getWeek, currentWeekStart } from '../store.js'
import { weekStartOf, fromISO, WEEKDAYS_SHORT, weekdayIndex } from '../lib/dates.js'
import { swapOptions, slotKey, childrenOf } from '../planner/generate.js'
import { icon } from '../ui/icons.js'
import { openSheet, closeSheet } from '../ui/sheet.js'
import { toast } from '../ui/toast.js'
import { recipeChips } from '../ui/components.js'
import { MEAL_LABEL } from '../vocab.js'

export const slotHref = (slot) => `#/woche/${slot.date}/${slot.meal}`

const dayShort = (iso) => WEEKDAYS_SHORT[weekdayIndex(iso)]

/** Leftover / meal-prep relations of a slot. */
export function prepInfo(week, slot) {
  if (!week || !slot) return { parent: null, children: [] }
  const parent = slot.leftoverOf ? week.slots.find((s) => slotKey(s) === slot.leftoverOf) ?? null : null
  return { parent, children: childrenOf(week.slots, slot) }
}

/** Small chip for lists: "Rest von Mo." or "für 3 Mahlzeiten kochen". */
export function prepNote(week, slot) {
  const { parent, children } = prepInfo(week, slot)
  if (parent) return html`<span class="chip mt-1.5 bg-primary-soft text-primary">${icon('refresh', 'size-3.5')} Rest von ${dayShort(parent.date)}. ${MEAL_LABEL[parent.meal]}</span>`
  if (children.length) return html`<span class="chip mt-1.5 bg-primary-soft text-primary">${icon('plus', 'size-3.5')} für ${children.length + 1} Mahlzeiten kochen</span>`
  return ''
}

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
  const { parent, children } = prepInfo(week, slot)
  const intro = parent
    ? 'Statt der Reste etwas frisch kochen – die besten Alternativen:'
    : children.length
      ? `Die Reste (${children.length}×) wechseln mit. Nur Gerichte, die sich zum Vorkochen eignen:`
      : 'Die besten Alternativen für diesen Tag – nach Abwechslung und Ausgewogenheit sortiert.'
  openSheet({
    title: `${MEAL_LABEL[meal]} tauschen`,
    body: options.length
      ? html`
        <p class="mb-3 text-sm text-muted">${intro}</p>
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
        const snapshot = week.slots
        await swapSlot(week.startDate, slotKey(slot), btn.dataset.id)
        toast('Getauscht', {
          label: 'Rückgängig',
          run: () => updateWeekSlots(week.startDate, snapshot),
        })
      },
    },
  })
}

export const isCurrentWeek = (startDate) => startDate === currentWeekStart()
