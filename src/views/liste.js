import { html } from '../lib/html.js'
import { state, getWeek, ensureWeek, currentWeekStart, toggleChecked, clearChecked } from '../store.js'
import { formatRange, weekStartOf, today } from '../lib/dates.js'
import { buildList, listAsText } from '../shopping/list.js'
import { pageHeader, emptyState } from '../ui/components.js'
import { icon } from '../ui/icons.js'
import { toast } from '../ui/toast.js'

const PREF = 'liste.hideChecked'
const readPref = () => { try { return localStorage.getItem(PREF) === '1' } catch { return false } }
const writePref = (v) => { try { localStorage.setItem(PREF, v ? '1' : '0') } catch { /* private mode */ } }

let fromToday = true

function weekFor(query) {
  const current = currentWeekStart()
  const start = query.start ? weekStartOf(query.start, state.settings.weekStart) : current
  return { start, isCurrent: start === current }
}

/** Only the meals from today on, for the current week (what is still to buy). */
function relevantWeek(week, isCurrent) {
  if (!isCurrent || !fromToday) return week
  return { ...week, slots: week.slots.filter((s) => s.date >= today() && s.status !== 'erledigt') }
}

// S13: shopping list.
export default {
  title: 'Einkaufsliste',
  async render({ query }) {
    const { start, isCurrent } = weekFor(query)
    const week = isCurrent ? await ensureWeek(start) : getWeek(start)
    if (!week) {
      return html`${pageHeader('Einkaufsliste', { sub: formatRange(start) })}
        ${emptyState({ title: 'Kein Plan für diese Woche', text: 'Erstelle zuerst einen Plan, dann entsteht hier die Liste.', action: html`<a class="btn-primary" href="#/woche?start=${start}">Zur Woche</a>` })}`
    }
    const groups = buildList(relevantWeek(week, isCurrent), state.byId, state.settings)
    const checked = week.shoppingChecked ?? {}
    const hide = readPref()
    const total = groups.reduce((n, g) => n + g.items.length, 0)
    const open = groups.reduce((n, g) => n + g.items.filter((i) => !checked[i.key]).length, 0)

    return html`
      ${pageHeader('Einkaufsliste', {
        sub: `${formatRange(start)} · ${open} von ${total} offen`,
        right: html`<button type="button" class="btn-secondary size-11 shrink-0 p-0" data-action="share" data-start="${start}" aria-label="Liste teilen">${icon('share')}</button>`,
      })}
      <div class="mb-5 flex flex-wrap gap-2 text-sm">
        ${isCurrent ? html`
          <button type="button" class="toggle" aria-pressed="${fromToday}" data-action="from-today">Nur ab heute</button>` : ''}
        <button type="button" class="toggle" aria-pressed="${hide}" data-action="hide">Erledigte ausblenden</button>
        <button type="button" class="btn-ghost py-2 text-muted" data-action="reset" data-start="${start}">Haken zurücksetzen</button>
      </div>
      ${total === 0
        ? emptyState({ title: 'Nichts mehr zu kaufen', text: 'Alle Mahlzeiten dieser Woche sind gegessen oder auswärts.' })
        : html`<div class="space-y-6">
          ${groups.map((g) => {
            const items = hide ? g.items.filter((i) => !checked[i.key]) : g.items
            if (!items.length) return ''
            return html`
              <section aria-label="${g.label}">
                <h2 class="mb-2 text-sm font-semibold text-muted">${g.label}</h2>
                <ul class="card divide-y divide-line">
                  ${items.map((i) => {
                    const on = !!checked[i.key]
                    return html`
                      <li>
                        <label class="flex cursor-pointer items-start gap-3 px-4 py-3">
                          <input type="checkbox" class="mt-1 size-5 accent-[var(--primary)]" data-input="check" data-key="${i.key}" data-start="${start}" ${on ? 'checked' : ''} />
                          <span class="min-w-0 flex-1 ${on ? 'text-muted line-through' : ''}">
                            <span class="font-medium">${i.name}</span>
                            <span class="block truncate text-xs text-muted">${i.recipes.join(' · ')}</span>
                          </span>
                          <span class="shrink-0 text-sm tabular-nums ${on ? 'text-muted' : ''}">${i.amountText}</span>
                        </label>
                      </li>`
                  })}
                </ul>
              </section>`
          })}
        </div>`}
      <p class="mt-6 text-xs text-muted">Mengen sind auf deinen Haushalt hochgerechnet und großzügig gerundet. Vorräte wie Öl und Gewürze kurz prüfen.</p>`
  },
  inputs: {
    check: (el) => toggleChecked(el.dataset.start, el.dataset.key),
  },
  actions: {
    hide: (_, __, rerender) => { writePref(!readPref()); rerender() },
    'from-today': (_, __, rerender) => { fromToday = !fromToday; rerender() },
    reset: (el) => clearChecked(el.dataset.start),
    share: async (el) => {
      const week = getWeek(el.dataset.start)
      const groups = buildList(relevantWeek(week, el.dataset.start === currentWeekStart()), state.byId, state.settings)
      const text = listAsText(groups, week.shoppingChecked, `Einkaufsliste ${formatRange(week.startDate)}`)
      try {
        if (navigator.share) await navigator.share({ title: 'Einkaufsliste', text })
        else {
          await navigator.clipboard.writeText(text)
          toast('Liste in die Zwischenablage kopiert')
        }
      } catch (e) {
        if (e?.name !== 'AbortError') toast('Teilen nicht möglich')
      }
    },
  },
}
