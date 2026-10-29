import { html } from '../lib/html.js'
import { state, toggleFavorite } from '../store.js'
import { fitsSettings } from '../planner/filter.js'
import { pageHeader, recipeChips } from '../ui/components.js'
import { icon } from '../ui/icons.js'
import { MEALS, MEAL_LABEL } from '../vocab.js'

const FILTERS = [['alle', 'Alle'], ...MEALS.map((m) => [m, MEAL_LABEL[m]]), ['favoriten', 'Favoriten'], ['aus', 'Ausgeschlossen']]

let filter = 'alle'
let search = ''

function matches(r) {
  const st = state.stats[r.id] ?? {}
  if (filter === 'favoriten' && !st.favorite) return false
  if (filter === 'aus' && !st.excluded) return false
  if (MEALS.includes(filter) && !r.mealTypes.includes(filter)) return false
  if (search) {
    const hay = `${r.title} ${r.ingredients.map((i) => i.name).join(' ')}`.toLowerCase()
    return search.toLowerCase().split(/\s+/).every((w) => hay.includes(w))
  }
  return true
}

function results() {
  const list = state.recipes.filter(matches).sort((a, b) => a.title.localeCompare(b.title, 'de'))
  if (!list.length) return html`<p class="py-8 text-center text-sm text-muted">Nichts gefunden.</p>`
  return html`
    <p class="mb-2 text-xs text-muted">${list.length} Rezepte</p>
    <ul class="space-y-2">
      ${list.map((r) => {
        const st = state.stats[r.id] ?? {}
        const fits = fitsSettings(r, state.settings, {})
        return html`
          <li class="card flex items-center gap-2 p-3 ${fits && !st.excluded ? '' : 'opacity-60'}">
            <a href="#/rezepte/${r.id}" class="min-w-0 flex-1 rounded-lg">
              <span class="block font-semibold leading-snug">${r.title}</span>
              ${recipeChips(r)}
              ${st.excluded ? html`<span class="mt-1 block text-xs text-muted">ausgeschlossen</span>`
                : !fits ? html`<span class="mt-1 block text-xs text-muted">passt nicht zu deinen Einstellungen</span>` : ''}
            </a>
            <button type="button" class="btn-ghost size-10 shrink-0 p-0 ${st.favorite ? 'text-primary' : 'text-muted'}" data-action="favorite" data-id="${r.id}"
                    aria-pressed="${!!st.favorite}" aria-label="Favorit: ${r.title}">${icon('heart', `size-5 ${st.favorite ? 'fill-current' : ''}`)}</button>
          </li>`
      })}
    </ul>`
}

// S21: recipe book.
export default {
  title: 'Rezepte',
  render() {
    return html`
      ${pageHeader('Rezepte', { sub: `${state.recipes.length} Rezepte – Favoriten kommen öfter in den Plan` })}
      <div class="relative mb-3">
        <label for="suche" class="sr-only">Rezepte durchsuchen</label>
        <span class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted">${icon('search', 'size-4')}</span>
        <input id="suche" type="search" class="field pl-9" placeholder="Gericht oder Zutat suchen" value="${search}" data-input="search" data-live autocomplete="off" />
      </div>
      <div class="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter">
        ${FILTERS.map(([v, l]) => html`<button type="button" class="toggle shrink-0" aria-pressed="${filter === v}" data-action="filter" data-value="${v}">${l}</button>`)}
      </div>
      <div id="results">${results()}</div>`
  },
  inputs: {
    search: (el, rerender) => { search = el.value; rerender() },
  },
  actions: {
    filter: (el, _, rerender) => { filter = el.dataset.value; rerender() },
    favorite: (el) => toggleFavorite(el.dataset.id),
  },
}
