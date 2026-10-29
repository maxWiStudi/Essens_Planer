# Datenschema (IndexedDB `essensplan`, Version 1)

Ersetzt das `schema.sql` der Skill-Vorlage: Es gibt keinen Datenbank-Server.
Konventionen: Daten sind lokale Kalendertage als `YYYY-MM-DD`; Zeitstempel sind ISO-Strings in UTC (`updatedAt`). Jeder veränderbare Datensatz hat `updatedAt`, das braucht der Sync-Merge.

## settings (key: 'main')

```js
{
  diet: 'omni' | 'pescetarisch' | 'vegetarisch' | 'vegan',
  allergens: string[],                 // z. B. ['gluten','laktose','nuss']
  excludedIngredients: string[],       // Freitext-Stichworte, z. B. 'pilze'
  likedIngredients: string[],
  household: [{ name: string, factor: number }],  // 1 = Erwachsene*r, 0.5 = Kind
  meals: { fruehstueck: boolean[7], mittag: boolean[7], abend: boolean[7] }, // je Wochentag
  maxMinutes: { fruehstueck: number, mittag: number, abend: number },
  equipment: string[],
  weekStart: 1,                        // 1 = Montag
  variety: {
    cooldownDays: 21,
    repeatMode: 'nie' | 'reste' | 'mealprep',
    fishPerWeek: [1, 2], legumesMin: 2, meatMax: 3, vegPerMainMin: 1
  },
  sync: { enabled: boolean, owner: string, repo: string, path: 'essensplan.json', branch: 'main' },
  ai:   { enabled: boolean, model: string },
  updatedAt: string
}
```

## weeks (key: startDate; index: generatedAt)

```js
{
  startDate: '2026-11-02',
  generatedAt: string, seed: number,
  slots: [{
    date: '2026-11-02',
    meal: 'fruehstueck' | 'mittag' | 'abend',
    recipeId: string,
    factor: number,                    // Portionen = Summe Haushalt × Faktor
    status: 'geplant' | 'erledigt' | 'auswaerts' | 'leer',
    locked: boolean,
    leftoverOf: string | null          // Slot-Referenz 'date:meal' wenn Reste
  }],
  explain: { met: string[], relaxed: string[] },
  shoppingChecked: { [itemKey: string]: boolean },
  updatedAt: string
}
```

## recipeStats (key: recipeId; indizes: favorite, excluded)

```js
{ recipeId, favorite: boolean, excluded: boolean, rating: 0|1|2|3|4|5, updatedAt }
```
„Zuletzt genutzt“ wird aus `weeks` berechnet und nicht gespeichert (eine Quelle der Wahrheit).

## userRecipes (key: id; index: source)

Gleiches Schema wie `src/data/recipes.json` (siehe `architecture.md`), plus `source: 'eigen' | 'gemini'`, `createdAt`, `updatedAt`.
IDs: `u-<uuid>`, damit sie nie mit Bundle-IDs kollidieren.

## meta (key: string)

`schemaVersion`, `deviceId`, `lastSync: { sha, at }`, `persistGranted`, `installHintSeen`.

## secrets (key: string)

`githubToken`, `geminiKey`. Wird **nie** exportiert, synchronisiert oder geloggt.

## Export / Sync-Datei

```js
{ app: 'essensplan', schemaVersion: 1, exportedAt, deviceId,
  settings /* ohne secrets */, weeks: [...], recipeStats: [...], userRecipes: [...] }
```
