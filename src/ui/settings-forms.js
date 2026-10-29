import { html } from '../lib/html.js'
import {
  MEALS, MEAL_LABEL, DIETS, DIET_LABEL, ALLERGENS, ALLERGEN_LABEL, EQUIPMENT, EQUIPMENT_LABEL,
} from '../vocab.js'
import { WEEKDAYS, WEEKDAYS_SHORT } from '../lib/dates.js'
import { saveSettings, state } from '../store.js'

// Settings sections, shared by the first-run setup and the "Du" page.
// Every control saves immediately.

const toggle = (pressed, action, value, label) =>
  html`<button type="button" class="toggle" aria-pressed="${pressed}" data-action="${action}" data-value="${value}">${label}</button>`

export function dietSection(s) {
  return html`
    <fieldset>
      <legend class="h2 mb-1">Wie isst du?</legend>
      <p class="mb-3 text-sm text-muted">Der Plan nimmt nur Rezepte, die dazu passen.</p>
      <div class="grid grid-cols-2 gap-2">
        ${DIETS.slice().reverse().map((d) => toggle(s.diet === d, 'set-diet', d, DIET_LABEL[d]))}
      </div>
    </fieldset>`
}

export function excludeSection(s) {
  return html`
    <fieldset>
      <legend class="h2 mb-1">Unverträglichkeiten</legend>
      <p class="mb-3 text-sm text-muted">Rezepte mit diesen Allergenen kommen nie in den Plan.</p>
      <div class="flex flex-wrap gap-2">
        ${ALLERGENS.map((a) => toggle(s.allergens.includes(a), 'toggle-allergen', a, ALLERGEN_LABEL[a]))}
      </div>
    </fieldset>
    <div class="mt-6">
      <label class="label" for="excluded">Das esse ich nicht</label>
      <input id="excluded" class="field" data-input="excluded" value="${s.excludedIngredients.join(', ')}"
             placeholder="z. B. Pilze, Oliven, Koriander" autocomplete="off" />
      <p class="mt-1 text-xs text-muted">Mit Komma trennen. Rezepte mit solchen Zutaten werden übersprungen.</p>
    </div>`
}

export function mealsSection(s) {
  return html`
    <fieldset>
      <legend class="h2 mb-1">Wann soll geplant werden?</legend>
      <p class="mb-3 text-sm text-muted">Tippe an, welche Mahlzeit an welchem Wochentag in den Plan soll.</p>
      <div class="mb-3 flex flex-wrap gap-2">
        <button type="button" class="btn-secondary py-1.5 text-xs" data-action="meals-preset" data-value="alle">Alles</button>
        <button type="button" class="btn-secondary py-1.5 text-xs" data-action="meals-preset" data-value="abends">Nur Abendessen</button>
        <button type="button" class="btn-secondary py-1.5 text-xs" data-action="meals-preset" data-value="arbeit">Werktags abends, Wochenende alles</button>
      </div>
      <div class="-mx-1 overflow-x-auto">
        <table class="w-full border-separate border-spacing-1 text-center text-sm">
          <thead>
            <tr>
              <th class="w-24"><span class="sr-only">Mahlzeit</span></th>
              ${WEEKDAYS_SHORT.map((d, i) => html`<th scope="col" class="font-medium text-muted"><abbr title="${WEEKDAYS[i]}" class="no-underline">${d}</abbr></th>`)}
            </tr>
          </thead>
          <tbody>
            ${MEALS.map((m) => html`
              <tr>
                <th scope="row" class="pr-1 text-left text-xs font-medium sm:text-sm">${MEAL_LABEL[m]}</th>
                ${s.meals[m].map((on, i) => html`
                  <td><button type="button" class="toggle size-9 p-0 text-xs" aria-pressed="${on}" data-action="toggle-meal"
                       data-meal="${m}" data-day="${i}" aria-label="${MEAL_LABEL[m]} am ${WEEKDAYS[i]}">${on ? '✓' : ''}</button></td>`)}
              </tr>`)}
          </tbody>
        </table>
      </div>
    </fieldset>`
}

const FACTORS = [[0.5, 'Kind'], [1, 'Erwachsen'], [1.5, 'Großer Hunger']]

export function householdSection(s) {
  return html`
    <fieldset>
      <legend class="h2 mb-1">Wer isst mit?</legend>
      <p class="mb-3 text-sm text-muted">Danach richten sich die Mengen in Rezepten und Einkaufsliste.</p>
      <ul class="space-y-2">
        ${s.household.map((p, i) => html`
          <li class="flex items-center gap-2">
            <label class="sr-only" for="person-${i}">Name</label>
            <input id="person-${i}" class="field min-w-0 flex-1" data-input="person-name" data-index="${i}" value="${p.name}" />
            <label class="sr-only" for="factor-${i}">Portion</label>
            <select id="factor-${i}" class="field w-36 shrink-0" data-input="person-factor" data-index="${i}">
              ${FACTORS.map(([f, l]) => html`<option value="${f}" ${Number(p.factor) === f ? 'selected' : ''}>${l}</option>`)}
            </select>
            <button type="button" class="btn-ghost shrink-0 px-3" data-action="remove-person" data-index="${i}"
                    aria-label="${p.name} entfernen" ${s.household.length < 2 ? 'disabled' : ''}>✕</button>
          </li>`)}
      </ul>
      <button type="button" class="btn-secondary mt-3" data-action="add-person">+ Person</button>
    </fieldset>`
}

function numSelect(id, label, value, options, input) {
  return html`
    <div>
      <label class="label" for="${id}">${label}</label>
      <select id="${id}" class="field" data-input="${input}">
        ${options.map(([v, l]) => html`<option value="${v}" ${String(value) === String(v) ? 'selected' : ''}>${l}</option>`)}
      </select>
    </div>`
}

const times = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, `${from + i}×`])

export function varietySection(s) {
  const v = s.variety
  return html`
    <fieldset>
      <legend class="h2 mb-1">Abwechslung und Ausgewogenheit</legend>
      <p class="mb-3 text-sm text-muted">Richtwerte pro Woche. Der Plan versucht sie zu treffen und sagt dir, wenn es nicht klappt.</p>
      <div class="grid grid-cols-2 gap-3">
        ${numSelect('cooldown', 'Gleiches Gericht frühestens nach', v.cooldownDays, [[7, '1 Woche'], [14, '2 Wochen'], [21, '3 Wochen'], [28, '4 Wochen'], [42, '6 Wochen']], 'variety-cooldownDays')}
        ${numSelect('meatMax', 'Fleisch höchstens', v.meatMax, times(0, 7), 'variety-meatMax')}
        ${numSelect('fishMin', 'Fisch mindestens', v.fishMin, times(0, 4), 'variety-fishMin')}
        ${numSelect('fishMax', 'Fisch höchstens', v.fishMax, times(0, 5), 'variety-fishMax')}
        ${numSelect('legumesMin', 'Hülsenfrüchte mindestens', v.legumesMin, times(0, 5), 'variety-legumesMin')}
        ${numSelect('weekStart', 'Woche beginnt am', s.weekStart, WEEKDAYS.map((d, i) => [i + 1, d]), 'weekStart')}
      </div>
    </fieldset>`
}

export function kitchenSection(s) {
  const mins = [[10, '10 Min.'], [15, '15 Min.'], [20, '20 Min.'], [30, '30 Min.'], [45, '45 Min.'], [60, '1 Std.'], [240, 'egal']]
  return html`
    <fieldset>
      <legend class="h2 mb-1">Küche und Zeit</legend>
      <p class="mb-3 text-sm text-muted">Höchstens so lange darf eine Mahlzeit dauern – und das hast du in der Küche.</p>
      <div class="grid grid-cols-3 gap-3">
        ${MEALS.map((m) => numSelect(`max-${m}`, MEAL_LABEL[m], s.maxMinutes[m], mins, `maxMinutes-${m}`))}
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        ${EQUIPMENT.map((e) => toggle(s.equipment.includes(e), 'toggle-equipment', e, EQUIPMENT_LABEL[e]))}
      </div>
    </fieldset>`
}

export function prepSection(s) {
  const p = s.prep
  const modes = [
    ['frisch', 'Jede Mahlzeit frisch', 'Jedes Gericht wird nur einmal gegessen.'],
    ['reste', 'Reste vom Vorabend', 'Abends doppelt kochen, am nächsten Tag gibt es den Rest zu Mittag.'],
    ['mealprep', 'Meal Prep', 'Ein Gericht vorkochen, das für mehrere Mahlzeiten reicht.'],
  ]
  return html`
    <fieldset>
      <legend class="h2 mb-1">Vorkochen</legend>
      <p class="mb-3 text-sm text-muted">Spart Zeit unter der Woche. Dafür kommen nur Gerichte infrage, die sich gut aufwärmen oder kalt halten.</p>
      <div class="grid gap-2">
        ${modes.map(([m, label, text]) => html`
          <button type="button" class="toggle text-left" aria-pressed="${p.mode === m}" data-action="prep-mode" data-value="${m}">
            <span class="block font-semibold">${label}</span>
            <span class="block text-xs font-normal text-muted">${text}</span>
          </button>`)}
      </div>
      ${p.mode === 'reste' ? html`
        <div class="mt-4 max-w-xs">
          ${numSelect('leftoverMax', 'Reste-Mittagessen pro Woche', p.leftoverMax, [[1, 'bis zu 1×'], [2, 'bis zu 2×'], [3, 'bis zu 3×'], [4, 'bis zu 4×'], [5, 'bis zu 5×'], [6, 'so oft es geht']], 'prep-leftoverMax')}
          <p class="mt-1 text-xs text-muted">Braucht ein Abendessen und am Folgetag ein Mittagessen im Plan.</p>
        </div>` : ''}
      ${p.mode === 'mealprep' ? html`
        <div class="mt-4 grid grid-cols-2 gap-3">
          ${numSelect('prepMeal', 'Für welche Mahlzeit?', p.meal, MEALS.map((m) => [m, MEAL_LABEL[m]]), 'prep-meal')}
          ${numSelect('batchSize', 'Ein Gericht reicht für', p.batchSize, [[2, '2 Mahlzeiten'], [3, '3 Mahlzeiten'], [4, '4 Mahlzeiten']], 'prep-batchSize')}
        </div>` : ''}
    </fieldset>`
}

const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
const week = (f) => Array.from({ length: 7 }, (_, i) => f(i))
const MEAL_PRESETS = {
  alle: () => ({ fruehstueck: week(() => true), mittag: week(() => true), abend: week(() => true) }),
  abends: () => ({ fruehstueck: week(() => false), mittag: week(() => false), abend: week(() => true) }),
  arbeit: () => ({ fruehstueck: week((i) => i >= 5), mittag: week((i) => i >= 5), abend: week(() => true) }),
}

/** Click handlers for all sections above. */
export const settingsActions = {
  'set-diet': (el) => saveSettings({ diet: el.dataset.value }),
  'toggle-allergen': (el) => saveSettings({ allergens: toggleIn(state.settings.allergens, el.dataset.value) }),
  'toggle-equipment': (el) => saveSettings({ equipment: toggleIn(state.settings.equipment, el.dataset.value) }),
  'toggle-meal': (el) => {
    const { meal, day } = el.dataset
    const row = state.settings.meals[meal].slice()
    row[day] = !row[day]
    return saveSettings({ meals: { ...state.settings.meals, [meal]: row } })
  },
  'prep-mode': (el) => saveSettings({ prep: { ...state.settings.prep, mode: el.dataset.value } }),
  'meals-preset': (el) => saveSettings({ meals: MEAL_PRESETS[el.dataset.value]() }),
  'add-person': () =>
    saveSettings({ household: [...state.settings.household, { name: `Person ${state.settings.household.length + 1}`, factor: 1 }] }),
  'remove-person': (el) =>
    saveSettings({ household: state.settings.household.filter((_, i) => i !== Number(el.dataset.index)) }),
}

const updatePerson = (el, patch) =>
  saveSettings({ household: state.settings.household.map((p, i) => (i === Number(el.dataset.index) ? { ...p, ...patch } : p)) })

/** change handlers for all inputs above. */
export const settingsInputs = {
  excluded: (el) => saveSettings({ excludedIngredients: el.value.split(',').map((w) => w.trim()).filter(Boolean) }),
  'person-name': (el) => updatePerson(el, { name: el.value.trim() || 'Person' }),
  'person-factor': (el) => updatePerson(el, { factor: Number(el.value) }),
  weekStart: (el) => saveSettings({ weekStart: Number(el.value) }),
}
for (const key of ['cooldownDays', 'meatMax', 'fishMin', 'fishMax', 'legumesMin']) {
  settingsInputs[`variety-${key}`] = (el) => saveSettings({ variety: { ...state.settings.variety, [key]: Number(el.value) } })
}
settingsInputs['prep-leftoverMax'] = (el) => saveSettings({ prep: { ...state.settings.prep, leftoverMax: Number(el.value) } })
settingsInputs['prep-meal'] = (el) => saveSettings({ prep: { ...state.settings.prep, meal: el.value } })
settingsInputs['prep-batchSize'] = (el) => saveSettings({ prep: { ...state.settings.prep, batchSize: Number(el.value) } })
for (const m of MEALS) {
  settingsInputs[`maxMinutes-${m}`] = (el) => saveSettings({ maxMinutes: { ...state.settings.maxMinutes, [m]: Number(el.value) } })
}
