import { html } from '../lib/html.js'
import { state } from '../store.js'
import { pageHeader } from '../ui/components.js'
import { icon } from '../ui/icons.js'
import {
  dietSection, excludeSection, mealsSection, householdSection, varietySection, kitchenSection, prepSection,
  settingsActions, settingsInputs,
} from '../ui/settings-forms.js'

// S15: settings. Changes apply to the next plan (or "Neu planen").
export default {
  title: 'Du',
  render() {
    const s = state.settings
    const card = (content) => html`<section class="card p-4">${content}</section>`
    return html`
      ${pageHeader('Einstellungen', { sub: 'Änderungen gelten ab dem nächsten Planen – in der Woche auf „Neu planen“ tippen.' })}
      <div class="space-y-4">
        <a href="#/daten" class="card flex items-center gap-3 p-4 hover:border-primary">
          ${icon('cloud', 'size-6 text-primary')}
          <span class="flex-1"><span class="block font-semibold">Daten &amp; Sicherung</span>
            <span class="text-sm text-muted">Export, Import und Sync mit GitHub</span></span>
          ${icon('right', 'size-4 text-muted')}
        </a>
        ${card(mealsSection(s))}
        ${card(prepSection(s))}
        ${card(dietSection(s))}
        ${card(excludeSection(s))}
        ${card(householdSection(s))}
        ${card(varietySection(s))}
        ${card(kitchenSection(s))}
        <p class="px-1 text-xs text-muted">
          Essens Planer ${import.meta.env.APP_VERSION ?? ''} · Kein Konto, keine Werbung. Die Pläne sind Vorschläge für eine abwechslungsreiche Ernährung,
          keine medizinische oder Ernährungsberatung.
        </p>
      </div>`
  },
  actions: settingsActions,
  inputs: settingsInputs,
}
