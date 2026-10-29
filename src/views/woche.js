import { html } from '../lib/html.js'
import { state, getWeek, ensureWeek, replanWeek, currentWeekStart, deleteWeek } from '../store.js'
import { addDays, formatDay, formatRange, weekStartOf } from '../lib/dates.js'
import { mealRow, emptyState, pageHeader } from '../ui/components.js'
import { icon } from '../ui/icons.js'
import { toast } from '../ui/toast.js'
import { slotActions, slotHref } from './shared.js'
import { go } from '../router.js'

function controls(slot) {
  if (slot.status !== 'geplant' || !slot.recipeId) return ''
  return html`
    <div class="flex shrink-0 flex-col gap-1">
      <button type="button" class="btn-ghost size-9 p-0 ${slot.locked ? 'text-primary' : 'text-muted'}" data-action="toggle-lock"
              data-date="${slot.date}" data-meal="${slot.meal}" aria-pressed="${slot.locked}"
              aria-label="${slot.locked ? 'Fixierung lösen' : 'Fixieren'}" title="${slot.locked ? 'Fixiert' : 'Fixieren'}">
        ${icon(slot.locked ? 'lock' : 'unlock', 'size-4')}
      </button>
      <button type="button" class="btn-ghost size-9 p-0 text-muted" data-action="swap" data-date="${slot.date}" data-meal="${slot.meal}"
              aria-label="Tauschen" title="Tauschen">${icon('swap', 'size-4')}</button>
    </div>`
}

function balance(week) {
  const { met = [], relaxed = [] } = week.explain ?? {}
  if (!met.length && !relaxed.length) return ''
  return html`
    <section class="card mb-6 p-4" aria-label="Ausgewogenheit">
      <div class="flex flex-wrap gap-1.5">
        ${met.map((m) => html`<span class="chip bg-ok-soft text-ok">${icon('check', 'size-3.5')} ${m}</span>`)}
      </div>
      ${relaxed.length ? html`
        <ul class="mt-3 space-y-1 text-sm text-warn">
          ${relaxed.map((r) => html`<li class="flex gap-2">${icon('info', 'size-4 mt-0.5 shrink-0')} ${r}</li>`)}
        </ul>` : ''}
    </section>`
}

// S05/S07/S12/S16: the week.
export default {
  title: 'Woche',
  async render({ query }) {
    const current = currentWeekStart()
    const start = query.start ? weekStartOf(query.start, state.settings.weekStart) : current
    const week = start === current ? await ensureWeek(start) : getWeek(start)
    const isPast = start < current
    const nav = html`
      <div class="flex shrink-0 gap-1">
        <a href="#/woche?start=${addDays(start, -7)}" class="btn-secondary size-10 p-0" aria-label="Vorherige Woche">${icon('left', 'size-4')}</a>
        <a href="#/woche?start=${addDays(start, 7)}" class="btn-secondary size-10 p-0" aria-label="Nächste Woche">${icon('right', 'size-4')}</a>
      </div>`
    const sub = `${formatRange(start)}${start === current ? ' · diese Woche' : ''}`

    if (!week) {
      return html`
        ${pageHeader('Woche', { sub, right: nav })}
        ${emptyState({
          title: isPast ? 'Für diese Woche gibt es keinen Plan' : 'Noch kein Plan für diese Woche',
          text: isPast ? 'Vergangene Wochen ohne Plan bleiben leer.' : 'Der Plan berücksichtigt, was du in den Wochen davor gegessen hast.',
          action: isPast ? '' : html`<button type="button" class="btn-primary" data-action="create" data-start="${start}">Plan erstellen</button>`,
        })}`
    }

    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    const planned = week.slots.filter((s) => s.recipeId)
    return html`
      ${pageHeader('Woche', { sub, right: nav })}
      ${balance(week)}
      <div class="mb-6 flex flex-wrap gap-2">
        <button type="button" class="btn-primary" data-action="replan" data-start="${start}">${icon('refresh', 'size-4')} Neu planen</button>
        <a href="#/liste?start=${start}" class="btn-secondary">${icon('liste', 'size-4')} Einkaufsliste</a>
        ${start !== current ? html`<button type="button" class="btn-ghost text-muted" data-action="delete" data-start="${start}">${icon('trash', 'size-4')} Plan löschen</button>` : ''}
      </div>
      <p class="mb-4 text-xs text-muted">
        ${planned.length} Mahlzeiten. „Neu planen“ ersetzt alles außer fixierten ${icon('lock', 'inline size-3 align-[-1px]')} und schon gegessenen Gerichten.
      </p>
      <div class="space-y-6">
        ${days.map((d) => {
          const slots = week.slots.filter((s) => s.date === d)
          if (!slots.length) return ''
          return html`
            <section aria-label="${formatDay(d)}">
              <h2 class="mb-2 text-sm font-semibold text-muted">${formatDay(d)}</h2>
              <div class="space-y-2">${slots.map((s) => mealRow(s, state.byId.get(s.recipeId), { href: slotHref(s), controls: controls(s) }))}</div>
            </section>`
        })}
      </div>`
  },
  actions: {
    ...slotActions,
    create: async (el) => {
      await ensureWeek(el.dataset.start)
      toast('Plan erstellt')
    },
    replan: async (el) => {
      await replanWeek(el.dataset.start)
      toast('Neu geplant')
    },
    delete: async (el) => {
      if (!confirm('Plan dieser Woche löschen?')) return
      await deleteWeek(el.dataset.start)
      go('/woche')
    },
  },
}
