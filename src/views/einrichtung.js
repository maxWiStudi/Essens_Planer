import { html } from '../lib/html.js'
import { state, saveSettings, ensureWeek, currentWeekStart, replanWeek } from '../store.js'
import { go } from '../router.js'
import {
  dietSection, excludeSection, mealsSection, householdSection, varietySection, kitchenSection,
  settingsActions, settingsInputs,
} from '../ui/settings-forms.js'

// S02: setup in a few short steps. Every answer is saved right away.
const STEPS = [dietSection, excludeSection, mealsSection, householdSection, kitchenSection, varietySection]

export default {
  title: 'Einrichtung',
  render({ parts }) {
    const n = Math.min(Math.max(Number(parts[1]) || 1, 1), STEPS.length)
    const last = n === STEPS.length
    return html`
      <div class="mb-6 flex items-center gap-3">
        <a href="${n > 1 ? `#/einrichtung/${n - 1}` : '#/start'}" class="btn-ghost -ml-3 px-3" aria-label="Zurück">←</a>
        <div class="flex flex-1 gap-1" aria-hidden="true">
          ${STEPS.map((_, i) => html`<span class="h-1.5 flex-1 rounded-full ${i < n ? 'bg-primary' : 'bg-line'}"></span>`)}
        </div>
        <span class="text-sm tabular-nums text-muted">${n} von ${STEPS.length}</span>
      </div>
      <form class="space-y-6" data-form="step" novalidate>
        ${STEPS[n - 1](state.settings)}
        <div class="flex gap-3 pt-2">
          ${last
            ? html`<button type="button" class="btn-primary flex-1 py-3 text-base" data-action="finish">Meinen Plan erstellen</button>`
            : html`<a href="#/einrichtung/${n + 1}" class="btn-primary flex-1 py-3 text-base">Weiter</a>`}
        </div>
        ${!last ? html`<p class="text-center text-xs text-muted">Alles lässt sich später unter „Du“ ändern.</p>` : ''}
      </form>`
  },
  actions: {
    ...settingsActions,
    finish: async () => {
      const first = !state.settings.onboarded
      await saveSettings({ onboarded: true })
      const start = currentWeekStart()
      // Re-running the setup re-plans the current week (keeping fixed and eaten meals).
      if (first || !state.weeks.has(start)) await ensureWeek(start)
      else await replanWeek(start)
      go('/woche')
    },
  },
  inputs: settingsInputs,
}
