import { html } from '../lib/html.js'
import { state, ensureWeek, currentWeekStart } from '../store.js'
import { addDays, today, formatDay, WEEKDAYS_SHORT, weekdayIndex, fromISO } from '../lib/dates.js'
import { mealRow, emptyState } from '../ui/components.js'
import { icon } from '../ui/icons.js'
import { slotActions, slotHref } from './shared.js'
import { MEALS, MEAL_LABEL } from '../vocab.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Hallo'
  return 'Guten Abend'
}

/** Which meal is "next" for today, by the clock. */
function nextMealOf(slots) {
  const h = new Date().getHours()
  const order = h < 10 ? MEALS : h < 15 ? ['mittag', 'abend'] : ['abend']
  return order.map((m) => slots.find((s) => s.meal === m && s.status === 'geplant')).find(Boolean) ?? null
}

// S06: today.
export default {
  title: 'Heute',
  async render({ query }) {
    const week = await ensureWeek(currentWeekStart())
    const day = query.tag && week.slots.some((s) => s.date === query.tag) ? query.tag : today()
    const isToday = day === today()
    const slots = week.slots.filter((s) => s.date === day)
    const done = slots.filter((s) => s.status === 'erledigt').length
    const next = isToday ? nextMealOf(slots) : null
    const nextRecipe = next && state.byId.get(next.recipeId)

    return html`
      <header class="mb-5">
        <p class="text-sm font-semibold text-primary">${greeting()}</p>
        <h1 class="h1 mt-1">${isToday ? (nextRecipe ? `Als Nächstes: ${MEAL_LABEL[next.meal]}` : 'Heute ist alles erledigt') : formatDay(day)}</h1>
        <p class="mt-1 text-sm text-muted">${isToday ? formatDay(day) : 'Vorschau auf einen anderen Tag'}</p>
      </header>

      ${nextRecipe ? html`
        <a href="${slotHref(next)}" class="mb-6 block rounded-card bg-primary p-5 text-primary-ink shadow-sm">
          <span class="text-xs font-semibold uppercase tracking-wide opacity-80">${MEAL_LABEL[next.meal]} · ${nextRecipe.minutes} Min.</span>
          <span class="mt-1 block text-xl font-bold leading-snug">${nextRecipe.title}</span>
          <span class="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Zum Rezept ${icon('right', 'size-4')}</span>
        </a>` : ''}

      <nav aria-label="Tage dieser Woche" class="mb-6 grid grid-cols-7 gap-1.5">
        ${Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i)).map((d) => {
          const daySlots = week.slots.filter((s) => s.date === d)
          const allDone = daySlots.length > 0 && daySlots.every((s) => s.status !== 'geplant')
          const active = d === day
          return html`
            <a href="#/heute?tag=${d}" aria-current="${active ? 'date' : 'false'}"
               class="flex flex-col items-center rounded-2xl border py-2 text-xs ${active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface'}">
              <span class="${active ? '' : 'text-muted'}">${WEEKDAYS_SHORT[weekdayIndex(d)]}</span>
              <span class="text-base font-bold tabular-nums">${fromISO(d).getDate()}</span>
              <span class="h-3 text-[10px] leading-3 ${active ? '' : 'text-ok'}">${allDone ? '✓' : d === today() ? '•' : ''}</span>
            </a>`
        })}
      </nav>

      <section aria-labelledby="meals-h">
        <div class="mb-3 flex items-baseline justify-between">
          <h2 id="meals-h" class="h2">${isToday ? 'Heutige Mahlzeiten' : 'Mahlzeiten'}</h2>
          ${slots.length ? html`<span class="text-sm text-muted">${done} von ${slots.length} gegessen</span>` : ''}
        </div>
        ${slots.length
          ? html`<div class="space-y-2">${slots.map((s) => mealRow(s, state.byId.get(s.recipeId), { href: slotHref(s) }))}</div>`
          : emptyState({
              title: 'An diesem Tag ist nichts geplant',
              text: 'Unter „Du“ legst du fest, an welchen Tagen welche Mahlzeit geplant wird.',
              action: html`<a href="#/du" class="btn-secondary">Einstellungen</a>`,
            })}
      </section>`
  },
  actions: slotActions,
}
