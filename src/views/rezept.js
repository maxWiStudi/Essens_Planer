import { html } from '../lib/html.js'
import { state, updateSlot, toggleFavorite, setExcluded, currentWeekStart, ensureWeek } from '../store.js'
import { formatDay } from '../lib/dates.js'
import { pageHeader, recipeChips, emptyState } from '../ui/components.js'
import { icon } from '../ui/icons.js'
import { toast } from '../ui/toast.js'
import { openSheet, closeSheet } from '../ui/sheet.js'
import { findSlot, openSwapSheet, slotActions } from './shared.js'
import { slotKey } from '../planner/generate.js'
import { portionsOf } from '../defaults.js'
import { formatAmount } from '../shopping/list.js'
import { MEAL_LABEL, PROTEIN_LABEL, BASE_LABEL, DIET_LABEL } from '../vocab.js'

const fmtPortions = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

function ingredientList(recipe, portions) {
  const scale = portions / recipe.servings
  return html`
    <ul class="divide-y divide-line">
      ${recipe.ingredients.map((i) => html`
        <li class="flex justify-between gap-4 py-2">
          <span>${i.name}</span>
          <span class="shrink-0 tabular-nums text-muted">${i.qty == null ? 'nach Geschmack' : formatAmount(i.qty * scale, i.unit)}</span>
        </li>`)}
    </ul>`
}

function slotPanel(slot) {
  const away = slot.status === 'auswaerts'
  const done = slot.status === 'erledigt'
  return html`
    <section class="card mb-6 p-4" aria-label="Im Plan">
      <p class="text-sm text-muted">${MEAL_LABEL[slot.meal]} am ${formatDay(slot.date)}${slot.locked ? ' · fixiert' : ''}</p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class="btn-primary" data-action="toggle-done" data-date="${slot.date}" data-meal="${slot.meal}" ${away ? 'disabled' : ''}>
          ${icon('check', 'size-4')} ${done ? 'Doch nicht gegessen' : 'Gegessen'}
        </button>
        <button type="button" class="btn-secondary" data-action="swap" data-date="${slot.date}" data-meal="${slot.meal}" ${done ? 'disabled' : ''}>
          ${icon('swap', 'size-4')} Tauschen
        </button>
        <button type="button" class="btn-secondary" data-action="toggle-lock" data-date="${slot.date}" data-meal="${slot.meal}" aria-pressed="${slot.locked}">
          ${icon(slot.locked ? 'lock' : 'unlock', 'size-4')} ${slot.locked ? 'Fixiert' : 'Fixieren'}
        </button>
        <button type="button" class="btn-secondary" data-action="away" data-date="${slot.date}" data-meal="${slot.meal}" ${done ? 'disabled' : ''}>
          ${icon('out', 'size-4')} ${away ? 'Doch zu Hause' : 'Auswärts essen'}
        </button>
      </div>
      <div class="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span>Menge für diese Mahlzeit</span>
        <span class="flex items-center gap-2">
          <button type="button" class="btn-secondary size-8 p-0" data-action="factor" data-step="-0.5" data-date="${slot.date}" data-meal="${slot.meal}" aria-label="Weniger" ${slot.factor <= 0.5 ? 'disabled' : ''}>−</button>
          <span class="w-12 text-center tabular-nums">${fmtPortions(slot.factor * 100)} %</span>
          <button type="button" class="btn-secondary size-8 p-0" data-action="factor" data-step="0.5" data-date="${slot.date}" data-meal="${slot.meal}" aria-label="Mehr" ${slot.factor >= 3 ? 'disabled' : ''}>+</button>
        </span>
      </div>
    </section>`
}

// S08 (+ S10 swap, S11 eaten out): one recipe, optionally in the context of a planned slot.
export default {
  title: 'Rezept',
  render({ parts }) {
    // #/woche/:date/:meal  or  #/rezepte/:id
    const fromPlan = parts[0] === 'woche'
    const ctx = fromPlan ? findSlot(parts[1], parts[2]) : { slot: null }
    const recipe = state.byId.get(fromPlan ? ctx.slot?.recipeId : parts[1])
    if (!recipe) {
      return html`${pageHeader('Rezept', { back: fromPlan ? '#/woche' : '#/rezepte' })}
        ${emptyState({ title: 'Nicht gefunden', text: 'Dieses Rezept oder diese Mahlzeit gibt es nicht (mehr).' })}`
    }
    const stat = state.stats[recipe.id] ?? {}
    const portions = portionsOf(state.settings) * (ctx.slot?.factor ?? 1)
    const back = fromPlan ? `#/woche?start=${ctx.week.startDate}` : '#/rezepte'

    return html`
      ${pageHeader(recipe.title, {
        back,
        right: html`
          <button type="button" class="btn-ghost size-11 shrink-0 p-0 ${stat.favorite ? 'text-primary' : 'text-muted'}" data-action="favorite" data-id="${recipe.id}"
                  aria-pressed="${!!stat.favorite}" aria-label="${stat.favorite ? 'Aus Favoriten entfernen' : 'Als Favorit merken'}">
            ${icon('heart', `size-6 ${stat.favorite ? 'fill-current' : ''}`)}
          </button>`,
      })}
      <div class="-mt-3 mb-5 flex flex-wrap gap-1.5">
        ${recipeChips(recipe)}
        <span class="chip mt-1.5">${DIET_LABEL[recipe.diet]}</span>
        ${recipe.base !== 'keins' ? html`<span class="chip mt-1.5">${BASE_LABEL[recipe.base]}</span>` : ''}
        <span class="chip mt-1.5">${recipe.vegPortions} Gemüse-Portion${recipe.vegPortions === 1 ? '' : 'en'}</span>
      </div>

      ${ctx.slot ? slotPanel(ctx.slot) : html`
        <div class="mb-6"><button type="button" class="btn-secondary" data-action="add-to-plan" data-id="${recipe.id}">${icon('plus', 'size-4')} In den Plan setzen</button></div>`}

      <section class="mb-6" aria-labelledby="zutaten-h">
        <h2 id="zutaten-h" class="h2 mb-1">Zutaten</h2>
        <p class="mb-2 text-sm text-muted">Für ${fmtPortions(portions)} Portion${portions === 1 ? '' : 'en'}</p>
        ${ingredientList(recipe, portions)}
      </section>

      <section class="mb-8" aria-labelledby="schritte-h">
        <h2 id="schritte-h" class="h2 mb-3">Zubereitung</h2>
        <ol class="space-y-3">
          ${recipe.steps.map((s, i) => html`
            <li class="flex gap-3">
              <span class="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">${i + 1}</span>
              <span class="pt-0.5">${s}</span>
            </li>`)}
        </ol>
      </section>

      <div class="border-t border-line pt-4">
        ${stat.excluded
          ? html`<button type="button" class="btn-secondary" data-action="unexclude" data-id="${recipe.id}">Wieder in Pläne aufnehmen</button>`
          : html`<button type="button" class="btn-ghost text-muted" data-action="exclude" data-id="${recipe.id}"
                   data-date="${ctx.slot?.date ?? ''}" data-meal="${ctx.slot?.meal ?? ''}">${icon('ban', 'size-4')} Nicht für mich – nie wieder planen</button>`}
        <p class="mt-2 text-xs text-muted">Hauptzutat: ${PROTEIN_LABEL[recipe.protein]} · Küche: ${recipe.cuisine}</p>
      </div>`
  },
  actions: {
    ...slotActions,
    favorite: async (el) => {
      await toggleFavorite(el.dataset.id)
      toast(state.stats[el.dataset.id].favorite ? 'Als Favorit gemerkt – kommt öfter vor' : 'Aus Favoriten entfernt')
    },
    exclude: async (el) => {
      const id = el.dataset.id
      await setExcluded(id, true)
      toast('Wird nicht mehr geplant', { label: 'Rückgängig', run: () => setExcluded(id, false) })
      if (el.dataset.date) openSwapSheet(el.dataset.date, el.dataset.meal)
    },
    unexclude: async (el) => {
      await setExcluded(el.dataset.id, false)
      toast('Wird wieder geplant')
    },
    away: async (el) => {
      const { week, slot } = findSlot(el.dataset.date, el.dataset.meal)
      await updateSlot(week.startDate, slotKey(slot), { status: slot.status === 'auswaerts' ? 'geplant' : 'auswaerts' })
      toast(slot.status === 'auswaerts' ? 'Wieder eingeplant' : 'Auswärts – fällt aus der Einkaufsliste')
    },
    factor: async (el) => {
      const { week, slot } = findSlot(el.dataset.date, el.dataset.meal)
      const factor = Math.min(3, Math.max(0.5, (slot.factor ?? 1) + Number(el.dataset.step)))
      await updateSlot(week.startDate, slotKey(slot), { factor })
    },
    'add-to-plan': async (el) => {
      const recipe = state.byId.get(el.dataset.id)
      const week = await ensureWeek(currentWeekStart())
      const slots = week.slots.filter((s) => recipe.mealTypes.includes(s.meal) && s.status === 'geplant')
      openSheet({
        title: 'In welche Mahlzeit?',
        body: slots.length
          ? html`<ul class="space-y-2">${slots.map((s) => html`
              <li><button type="button" class="card w-full p-3 text-left hover:border-primary" data-action="place" data-key="${slotKey(s)}">
                <span class="text-xs font-semibold uppercase text-primary">${MEAL_LABEL[s.meal]} · ${formatDay(s.date)}</span>
                <span class="block text-sm text-muted">ersetzt: ${state.byId.get(s.recipeId)?.title ?? '–'}</span>
              </button></li>`)}</ul>`
          : html`<p class="text-sm text-muted">In dieser Woche ist keine passende Mahlzeit mehr offen.</p>`,
        actions: {
          place: async (btn) => {
            closeSheet()
            await updateSlot(week.startDate, btn.dataset.key, { recipeId: recipe.id, locked: true })
            toast('Eingeplant und fixiert')
          },
        },
      })
    },
  },
}
