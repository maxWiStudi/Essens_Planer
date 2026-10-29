# Essens Planer

Wochen-Essensplaner als statische Web-App (PWA): automatisch erstellte, abwechslungsreiche und
ausgewogene Wochenpläne mit Rezepten und Einkaufsliste. Kein Server, kein Konto – alle Daten
bleiben im Browser (IndexedDB). Optionaler Sync in ein eigenes privates GitHub-Repo.

Live: https://maxwistudi.github.io/Essens_Planer/

## Entwicklung

```bash
npm install
npm run dev            # http://localhost:5173/Essens_Planer/
npm test               # Planer, Einkaufsliste, Sync-Merge
npm run check:recipes  # Rezepte prüfen
npm run build          # Ausgabe in dist/
```

Push auf `main` baut und veröffentlicht automatisch über GitHub Actions
(Settings → Pages → Source: „GitHub Actions“).

## Rezepte

Liegen in `src/data/recipes/*.json`. Zutaten als `[Name, Menge, Einheit, Gang]`.
Felder und erlaubte Werte stehen in `src/vocab.js`; `npm run check:recipes` prüft alles.

## Hinweis

Die Pläne sind Vorschläge für eine abwechslungsreiche Ernährung, keine medizinische Beratung.
