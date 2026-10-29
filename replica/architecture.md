# Architecture: Essensplan (Arbeitsname), ein Nachbau der Kernfunktionen von Mealbird

Stand: 2026-10-29, **Entwurf zur Freigabe**. Grundlage sind `recon.md` (inkl. „Entscheidungen des Nutzers“) und `features.csv`.

Leitlinie: kein Server, kein Konto, keine laufenden Kosten. Die App ist ein Ordner mit statischen Dateien auf GitHub Pages. Der Browser hält alle Daten. GitHub (Sync) und später Gemini (KI) sind **optionale** Dienste, die mit dem eigenen Token bzw. Key direkt aus dem Browser angesprochen werden.

## Stack

| layer | choice | why |
| --- | --- | --- |
| Build | **Vite** (aktuelle stabile Version, beim Bau festgepinnt) | erzeugt reine statische Dateien, schneller Dev-Server, setzt den GitHub-Pages-Unterpfad (`base`) an einer Stelle |
| UI | **Vanilla JS (ES-Module)** + kleiner eigener Store + Hash-Router | keine Framework-Lernkurve, ca. 15 Screens sind ohne Framework gut machbar; nichts zu warten |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | gewünscht; Build entfernt ungenutzte Klassen, das CSS ist offline cachebar |
| PWA | **vite-plugin-pwa** (Workbox, `generateSW`) + Web-Manifest | erzeugt Service Worker mit Precache aller Dateien, Update-Hinweis, korrekte Pfade unter `/repo/` |
| Lokale Daten | **IndexedDB** über `idb` (ca. 1 kB) | größer und robuster als localStorage, asynchron, Indizes; `navigator.storage.persist()` wird angefragt |
| Rezepte | **statisches JSON im Bundle** (`src/data/recipes.json`) + eigener Store für eigene/KI-Rezepte | Inhalt ist versioniert im Git, offline verfügbar |
| Sync (optional) | **GitHub REST API, Contents-Endpoint** in ein **privates** Daten-Repo, fine-grained Token mit nur „Contents: read/write“ auf dieses eine Repo | kostenlos, jede Speicherung ist ein Commit (gratis „Log“ und Versionshistorie), löst iOS-Datenverlust und Mehrgeräte |
| KI (später, optional) | **Gemini API** per REST mit eigenem Key, strukturierte JSON-Ausgabe gegen unser Rezeptschema | BYOK, kostenloses Kontingent; Modellname konfigurierbar, nicht fest verdrahtet |
| Tests | **Vitest** für Planer, Einkaufsliste, Migrationen, Sync-Merge | der Planer ist reine Logik und gut testbar |
| Hosting | **GitHub Pages**, Deploy per **GitHub Action** (`actions/deploy-pages`) | kostenlos; Push auf `main` → Build → live |

Nicht genutzt: Datenbank-Server, Auth, Payments, E-Mail, Cron-Jobs. Die Vorlage des Skills ist für Server-Apps gedacht; diese Zeilen entfallen hier bewusst.

**Wichtig zu GitHub:** GitHub Pages ist auf dem Gratis-Plan nur für **öffentliche** Repos verfügbar. Der App-Code liegt deshalb öffentlich, die **Daten in einem zweiten, privaten Repo** (z. B. `essensplan-daten`). Persönliche Daten kommen nie ins Pages-Repo.

## Schema

Kein SQL: IndexedDB-Datenbank `essensplan`, Version 1, mit **6 Object Stores**. Details und JSON-Formen in `replica/schema.md`.
Zugriffsregeln: Es gibt keine Mehrbenutzer-Situation; alles gehört dem einen Gerätenutzer. Die einzige Grenze ist der Sync-Token (siehe „Parts that bite“).

| store | key | indizes | inhalt |
| --- | --- | --- | --- |
| `settings` | `'main'` | – | Ernährungsweise, Ausschlüsse, Allergene, Haushalt, Mahlzeiten pro Tag, Abwechslungsregeln, Wochenstart, Sync-/KI-Konfiguration |
| `weeks` | `startDate` (`YYYY-MM-DD`) | `generatedAt` | ein Wochenplan inkl. Slots und Einkaufs-Haken (eingebettet) |
| `recipeStats` | `recipeId` | `favorite`, `excluded` | Favorit, ausgeschlossen, Bewertung, Nutzungsdaten |
| `userRecipes` | `id` | `source` | eigene und später KI-Rezepte im selben Schema wie das Bundle |
| `meta` | key | – | Schema-Version, Geräte-ID, letzter Sync (Commit-SHA, Zeit), Install-Hinweis gesehen |
| `secrets` | key | – | GitHub-Token, Gemini-Key (nur lokal, **nie** im Sync-File, nie im Export) |

Verlauf und Historie werden aus `weeks` abgeleitet (welches Rezept an welchem Datum). Es gibt keine eigene Log-Tabelle.

## Rezeptmodell (Herz der Abwechslung)

Nährwerte sind zweitrangig. Jedes Rezept trägt stattdessen **Lebensmittelgruppen-Tags**, mit denen der Planer Ausgewogenheit steuert:

```json
{
  "id": "linsen-dal-spinat",
  "title": "Linsen-Dal mit Spinat",
  "mealTypes": ["mittag", "abend"],
  "minutes": 30,
  "servings": 2,
  "diet": "vegan",
  "protein": "huelsenfruechte",
  "base": "reis",
  "vegPortions": 2,
  "cuisine": "indisch",
  "style": "eintopf",
  "allergens": [],
  "equipment": ["topf"],
  "ingredients": [{ "name": "rote Linsen", "qty": 150, "unit": "g", "aisle": "trocken" }],
  "steps": ["…"],
  "leftoverFriendly": true,
  "source": "bundle"
}
```

- `protein` ∈ huhn, rind, schwein, fisch, meeresfruechte, huelsenfruechte, ei, tofu, milchprodukt, keins
- `base` ∈ kartoffel, reis, nudeln, brot, getreide, keins
- `style` ∈ pfanne, ofen, eintopf, suppe, salat, bowl, auflauf, kalt, …
- `diet` ist der strengste passende Wert (vegan ⊂ vegetarisch ⊂ pescetarisch ⊂ omni)
- Optional später: `nutrition` (kcal, Eiweiß) als grober Schätzwert, nicht Pflicht

Die Rezepte lassen sich mit `npm run check:recipes` gegen ein JSON-Schema prüfen. Dasselbe Schema dient später als `responseSchema` für Gemini.

## Planer (reine Funktion, `src/planner/`)

`generateWeek({ recipes, settings, history, locked, seed }) → week`

1. **Harte Filter:** Ernährungsweise, Allergene, ausgeschlossene Zutaten oder Rezepte, Kochzeit pro Mahlzeitart, Geräte.
2. **Slots:** Mahlzeiten pro Tag sind einstellbar (z. B. nur Abendessen unter der Woche). Gesperrte und erledigte Slots bleiben fix.
3. **Score je Kandidat** (niedriger ist besser), alle Gewichte in den Einstellungen:
   - Wiederholung: gleiches Rezept in derselben Woche verboten (außer Modus „Reste“/Meal Prep); Strafe abnehmend mit den Tagen seit letzter Nutzung, Abklingzeit standardmäßig 21 Tage
   - gleiche Proteinquelle wie am Vortag oder in der Mahlzeit davor; gleiche `base` zweimal am Tag; gleicher `style` oder gleiche `cuisine` mehr als 2× pro Woche
   - Wochenziele (Standard, an DGE-Empfehlungen angelehnt, einstellbar): Fisch 1–2×, Hülsenfrüchte ≥ 2×, Fleisch ≤ 3×, jede Hauptmahlzeit ≥ 1 Gemüseportion
   - Bonus: Favorit, gute Bewertung, `leftoverFriendly` wenn Reste-Modus
4. **Verfahren:** gewichtete Zufallsauswahl mit Seed (reproduzierbar), danach 300–500 Runden lokale Suche (zwei Slots tauschen, einen Slot neu ziehen, behalten wenn besser). Läuft in < 50 ms.
5. **Ergebnis:** Plan plus **Erklärung**, warum diese Wahl („Fisch 2×, Hülsenfrüchte 3×, kein Gericht der letzten 3 Wochen“) und welche Ziele nicht erfüllbar waren, mit Grund (z. B. „Pool zu klein: nur 4 vegane Frühstücke“).

Tausch (F03): dieselbe Score-Funktion, auf einen Slot begrenzt. Sie liefert die Top 5 Alternativen mit Hinweis, was sich ändert.

## API

Es gibt keinen eigenen Server. Die „Routen“ sind clientseitige Hash-Routen (das funktioniert auf GitHub Pages ohne 404-Tricks). Dazu kommen genau zwei externe, offizielle APIs.

**Clientseitige Routen**

| route | does | screen | flow |
| --- | --- | --- | --- |
| `#/start` | Willkommen, Onboarding starten | S01 | F01 |
| `#/einrichtung/:schritt` | Ernährungsweise, Ausschlüsse, Haushalt, Mahlzeiten pro Tag, Abwechslung (≤ 6 Schritte) | S02 | F01, F08 |
| `#/heute` | nächste Mahlzeit, Tagesmahlzeiten, abhaken | S06 | F02 |
| `#/woche` | Wochenübersicht, Ausgewogenheits-Zusammenfassung, neu erstellen, fixieren | S05, S07, S12, S16 | F06, F09 |
| `#/woche/:datum/:mahlzeit` | Rezept im Slot, tauschen, auswärts, „nicht für mich“ | S08, S10, S11 | F03–F05 |
| `#/rezepte` / `#/rezepte/:id` | Rezeptbuch, Suche, Favoriten, Ausschlüsse, in Slot setzen | S21 | – |
| `#/liste` | Einkaufsliste nach Gängen, abhaken, teilen | S13 | F07 |
| `#/du` | Einstellungen, Einrichtung wiederholen | S15 | F08 |
| `#/daten` | Export/Import, Speicherstatus, GitHub-Sync, (später) Gemini-Key | S20 | F10 |

**Externe APIs (nur mit eigenem Token bzw. Key)**

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET https://api.github.com/repos/{owner}/{repo}/contents/{path}` | Daten-Datei laden (Inhalt base64 + `sha`) | Nutzer per fine-grained PAT | owner, repo, path | JSON + sha | Sync beim Start / manuell |
| `PUT https://api.github.com/repos/{owner}/{repo}/contents/{path}` | Daten-Datei speichern = 1 Commit | dito | content (base64), message, **sha** (Pflicht beim Überschreiben) | neuer sha | Sync nach Änderung (gebündelt) |
| `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | **später:** Rezeptvorschläge als JSON nach Schema | Nutzer per eigenem API-Key | Prompt + Einstellungen + `responseSchema` | Rezepte → Prüfung → `userRecipes` | „Neue Rezepte vorschlagen“ |

Webhooks: keine. Jobs: keine Server-Jobs. Im Client: Sync gebündelt 30 s nach der letzten Änderung, beim Öffnen und beim Schließen (`visibilitychange`); Wochenwechsel-Prüfung beim Öffnen.

**Sync-Datei** `essensplan.json` im privaten Repo: `{ schemaVersion, exportedAt, deviceId, settings (ohne secrets), weeks, recipeStats, userRecipes }`. Bei 1 Person und ein paar Jahren sind das < 1 MB.
Konfliktregel: Ist der Remote-`sha` neuer als der lokal bekannte, wird erst geladen und gemergt (Wochen und Rezept-Stats je Eintrag nach `updatedAt`, Einstellungen „neuer gewinnt“), dann gespeichert. Die Commit-Historie auf GitHub ist das gewünschte **Log**: jede alte Version lässt sich dort wiederherstellen.

## The parts that bite

- **Daten auf iOS:** Gelöst über drei Ebenen: (1) als Home-Screen-App installieren, (2) `storage.persist()`, (3) GitHub-Sync bzw. manueller Export. Der Sync ist die eigentliche Sicherung; die App zeigt „Letzte Sicherung: vor x Tagen“.
- **Token-Sicherheit:** Der GitHub-Token liegt im Browser des eigenen Geräts. Absicherung: fine-grained, **nur ein Repo**, nur Contents, Ablaufdatum (z. B. 1 Jahr). Er kommt nie in den Export oder ins Sync-File und nie ins öffentliche Repo. Gleiches gilt für den Gemini-Key.
- **Daten-Datei ≠ Pages-Repo:** Die Daten dürfen nicht im öffentlichen App-Repo liegen (siehe Stack).
- **Rate Limits:** Die GitHub API erlaubt 5.000 Anfragen pro Stunde mit Token. Durch das Bündeln entstehen ca. 10–30 Commits am Tag, unkritisch.
- **Konflikte/Rennen:** Zwei Geräte gleichzeitig: Der `sha`-Check verhindert stilles Überschreiben (GitHub antwortet 409), danach Merge und Retry.
- **Datum und Zeit:** Alle Plan-Daten sind lokale Kalendertage als `YYYY-MM-DD`-Strings, keine Timestamps. Das verhindert Sommerzeit- und Zeitzonen-Fehler. Der Wochenstart ist einstellbar (Standard Montag).
- **Service-Worker-Updates:** Eine neue Version wird erst nach Klick auf „Aktualisieren“ aktiv, damit keine halb alte, halb neue App läuft. Das Rezept-JSON ist Teil des Precache.
- **GitHub-Pages-Unterpfad:** Vite `base: '/<repo>/'`, Manifest `start_url`/`scope` relativ, Hash-Router. Kein Server-Rewrite nötig.
- **Schema-Migrationen:** `meta.schemaVersion` plus Migrationsfunktionen. Import und Sync laufen durch dieselbe Migration.
- **Leerer Pool:** Sind die Filter zu eng, erstellt der Planer trotzdem den bestmöglichen Plan, lockert die weichen Regeln und sagt welche. Er erfindet nichts.
- **Offline:** Alles außer Sync und KI funktioniert offline. Sync-Aufträge werden nachgeholt.
- **DSGVO:** Für sich selbst unkritisch. Daten liegen lokal bzw. im eigenen privaten Repo. Gemini (später) erhält nur Einstellungen, keine persönlichen Daten.

## Projektstruktur

```
essensplan-pwa/
  index.html
  vite.config.js            base, PWA-Plugin, Manifest
  src/
    main.js  router.js  store.js  db.js (idb + Migrationen)
    planner/  generate.js  score.js  swap.js  explain.js
    shopping/ list.js        Zutaten zusammenfassen, nach Gängen gruppieren
    sync/     github.js  merge.js
    ai/       gemini.js      (später)
    views/    heute.js woche.js rezept.js liste.js rezepte.js du.js daten.js einrichtung.js
    ui/       Komponenten (Button, Sheet, Chip, Toast …)
    data/     recipes.json  recipe.schema.json
    styles.css               @import "tailwindcss" + Tokens
  public/   icons/ (eigene), 
  tests/    planner.test.js  merge.test.js  list.test.js
  scripts/  check-recipes.js
  .github/workflows/deploy.yml
  replica/  (Recherche, wird nicht ausgeliefert)
```

## Build order

1. **Vertical Slice** (S07, S08; Store `weeks`, `settings`; `#/woche`): 15 Testrezepte → Planer v0 (Filter + Wiederholungssperre) → Wochenansicht → in IndexedDB speichern → als PWA auf GitHub Pages deployt und auf dem Handy installiert. Damit ist die ganze Kette inklusive Pages-Pfad und Service Worker bewiesen.
2. **Must-haves:**
   - a) Planer v1 mit Ausgewogenheits-Score, Historie, Erklärung, Tests
   - b) Tauschen, Fixieren, Neu würfeln, „Nicht für mich“ (S08, S10, S12)
   - c) Heute-Ansicht und Abhaken (S06)
   - d) Einrichtung (S01, S02)
   - e) Einkaufsliste (S13)
   - f) Export/Import (S20)
   - g) **Rezeptbestand auf ca. 80** (25 Frühstück, 55 Mittag/Abend), geprüft per `check:recipes`
3. **Should-haves:** GitHub-Sync, Rezeptbuch mit Suche und Favoriten (S21), Haushalt-Portionen, auswärts essen, Kochzeit/Geräte, Teilen der Liste, Quiz wiederholen, Unmachbar-Hinweis, iOS-Install-Hinweis.
4. **Could-haves:** Gemini-Anbindung, eigene Rezepte anlegen, Reste-/Meal-Prep-Modus, Streak, Dark Mode, grobe Nährwerte.
5. **Fixes aus der Bewertungsanalyse:** Keine Paywall und nichts Verstecktes sind durch das Konzept erledigt. Zu wenig Rezeptvielfalt adressieren Punkt 2g und die Abwechslungslogik.
