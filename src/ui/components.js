import { html } from '../lib/html.js'
import { icon } from './icons.js'
import { MEAL_LABEL, PROTEIN_LABEL, DIET_LABEL } from '../vocab.js'

export function pageHeader(title, { sub = '', back = null, right = '' } = {}) {
  return html`
    <header class="mb-5 flex items-start gap-2">
      ${back ? html`<a href="${back}" class="btn-ghost -ml-3 px-3" aria-label="Zurück">${icon('left')}</a>` : ''}
      <div class="min-w-0 flex-1">
        <h1 class="h1 break-words">${title}</h1>
        ${sub ? html`<p class="mt-1 text-sm text-muted">${sub}</p>` : ''}
      </div>
      ${right}
    </header>`
}

export function emptyState({ title, text, action = '' }) {
  return html`
    <div class="card px-5 py-10 text-center">
      <p class="h2">${title}</p>
      <p class="mx-auto mt-2 max-w-sm text-sm text-muted">${text}</p>
      ${action ? html`<div class="mt-5">${action}</div>` : ''}
    </div>`
}

export function recipeChips(r, { showMinutes = true } = {}) {
  return html`
    <span class="mt-1.5 flex flex-wrap gap-1.5">
      ${showMinutes ? html`<span class="chip">${icon('clock', 'size-3.5')} ${r.minutes} Min.</span>` : ''}
      ${r.protein !== 'keins' ? html`<span class="chip">${PROTEIN_LABEL[r.protein]}</span>` : ''}
      ${r.diet === 'vegan' || r.diet === 'vegetarisch' ? html`<span class="chip">${DIET_LABEL[r.diet]}</span>` : ''}
    </span>`
}

function statusBadge(slot) {
  if (slot.status === 'erledigt') return html`<span class="chip mt-1.5 bg-ok-soft text-ok">${icon('check', 'size-3.5')} Gegessen</span>`
  if (slot.status === 'auswaerts') return html`<span class="chip mt-1.5">${icon('out', 'size-3.5')} Auswärts</span>`
  return ''
}

/** One planned meal. href opens the recipe; the round button marks it eaten. */
export function mealRow(slot, recipe, { href, showMeal = true, controls = '', note = '' }) {
  const done = slot.status === 'erledigt'
  if (!recipe) {
    return html`<div class="card p-4 text-sm text-muted">${MEAL_LABEL[slot.meal]}: kein passendes Rezept – bitte Einstellungen prüfen.</div>`
  }
  const away = slot.status === 'auswaerts'
  return html`
    <div class="card flex items-center gap-3 p-3 ${done ? 'opacity-75' : ''}">
      <button type="button"
              class="grid size-10 shrink-0 place-items-center rounded-full border-2 ${done ? 'border-ok bg-ok text-surface' : 'border-line text-transparent hover:text-muted'}"
              data-action="toggle-done" data-date="${slot.date}" data-meal="${slot.meal}" aria-pressed="${done}"
              aria-label="${done ? 'Nicht gegessen' : 'Gegessen'}: ${recipe.title}" ${away ? 'disabled' : ''}>
        ${icon('check')}
      </button>
      <a href="${href}" class="min-w-0 flex-1 rounded-lg">
        ${showMeal ? html`<span class="text-xs font-semibold uppercase tracking-wide text-primary">${MEAL_LABEL[slot.meal]}</span>` : ''}
        <span class="block font-semibold leading-snug ${away ? 'text-muted line-through' : ''}">${recipe.title}</span>
        <span class="flex flex-wrap items-center gap-1.5">${recipeChips(recipe)}${note}${statusBadge(slot)}</span>
      </a>
      ${controls}
    </div>`
}
