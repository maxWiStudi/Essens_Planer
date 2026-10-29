import { MEALS } from './vocab.js'

const all = () => [true, true, true, true, true, true, true]

export function defaultSettings() {
  return {
    diet: 'omni',
    allergens: [],
    excludedIngredients: [],
    likedIngredients: [],
    household: [{ name: 'Ich', factor: 1 }],
    meals: Object.fromEntries(MEALS.map((m) => [m, all()])),
    maxMinutes: { fruehstueck: 20, mittag: 45, abend: 60 },
    equipment: ['herd', 'ofen', 'mixer'],
    weekStart: 1,
    variety: {
      cooldownDays: 21,
      fishMin: 1,
      fishMax: 2,
      legumesMin: 2,
      meatMax: 3,
      vegPerMainMin: 1,
    },
    sync: { enabled: false, owner: '', repo: '', path: 'essensplan.json', branch: 'main' },
    onboarded: false,
    updatedAt: new Date(0).toISOString(),
  }
}

/** Fill gaps after an app update added new settings fields. */
export function withDefaults(settings) {
  const d = defaultSettings()
  if (!settings) return d
  return {
    ...d,
    ...settings,
    meals: { ...d.meals, ...settings.meals },
    maxMinutes: { ...d.maxMinutes, ...settings.maxMinutes },
    variety: { ...d.variety, ...settings.variety },
    sync: { ...d.sync, ...settings.sync },
  }
}

export function portionsOf(settings) {
  const sum = settings.household.reduce((s, p) => s + (Number(p.factor) || 0), 0)
  return sum > 0 ? sum : 1
}
