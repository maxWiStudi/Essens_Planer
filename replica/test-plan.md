# Testplan

Stand: 2026-10-29 · Build: siehe Commit „test: …“ · Browser: Edge (Playwright, Kanal msedge), Profile „mobil“ (Pixel 7) und „desktop“ (1440×900)
Feste Uhrzeit in E2E: Mi 4.11.2026, 12:00 Europe/Berlin.

Automatisch: `npm test` (Unit/Integration, Vitest + fake-indexeddb) · `npm run e2e` (Playwright, gegen den Produktions-Build mit Service Worker)
Jede E2E-Spec bricht ab bei Konsolenfehlern, Seitenfehlern und fehlgeschlagenen Requests; axe-Scan (WCAG 2 A/AA) auf jedem Screen.

| Fall | Was | Wo | Ergebnis |
| --- | --- | --- | --- |
| F01-H1 | Einrichtung mit Standardwerten → 21 Mahlzeiten, keine doppelt | e2e/f01 | ✓ |
| F01-E1 | jeder Einrichtungsschritt: axe, keine horizontale Scrollbar | e2e/f01 | ✓ |
| F01-E2 | Zurück-Button / Neuladen mitten in der Einrichtung behält Antworten | e2e/f01 | ✓ |
| F01-E3 | vegan + glutenfrei → nur passende Gerichte | e2e/f01, unit | ✓ |
| F01-E4/E5 | Mahlzeiten je Wochentag (Preset, einzelne Zelle) | e2e/f01, unit | ✓ |
| F01-E6 | gar nichts geplant → ehrlicher Hinweis | e2e/f01 | ✓ |
| F01-E7 | 60 Zeichen + Umlaute + Emoji im Namen | e2e/f01 | ✓ |
| F01-E8 | komplette Einrichtung nur mit Tastatur | e2e/f01 | ✓ |
| F01-N1 | Filter zu eng → Plan sagt, was nicht ging | unit | ✓ |
| F02-H1 | abhaken, bleibt nach Neuladen, rückgängig | e2e/f02 | ✓ |
| F02-E1/E2 | anderer Tag; Doppelklick | e2e/f02 | ✓ |
| F03-H1 | tauschen + rückgängig, axe im Sheet | e2e/f03 | ✓ |
| F03-E1 | Escape schließt Sheet, Fokus zurück | e2e/f03 | ✓ |
| F04-H1 | „Nicht für mich“ → Tausch, im Rezeptbuch, zurückholen | e2e/f04, unit | ✓ |
| F05-H1 | auswärts → fällt aus Einkaufsliste | e2e/f05, unit | ✓ |
| F06-H1 | neu planen behält fixierte + gegessene | e2e/f06, unit | ✓ |
| F06-E1 | Wochen vor/zurück, leere Wochen | e2e/f06 | ✓ |
| F07-H1 | Liste abhaken, ausblenden, zurücksetzen, nach Neuladen | e2e/f07 | ✓ |
| F07-E1 | Teilen → Text in Zwischenablage | e2e/f07 | ✓ |
| F07-E2 | Mengen wachsen mit dem Haushalt | e2e/f07, unit | ✓ |
| F08-H1 | Einstellungen ändern + neu planen (nur Abendessen, kein Fleisch) | e2e/f08 | ✓ |
| F08-E1/E2 | Einrichtung vorausgefüllt; Rezeptbuch Suche/Filter/Favorit, Fokus bleibt | e2e/f08 | ✓ |
| F09-H1 | nächste Woche ohne Hauptgerichte dieser Woche | e2e/f09, unit | ✓ |
| F09-E1 | zukünftigen Plan löschen (Tombstone für Sync) | e2e/f09, unit | ✓ |
| F10-H1 | Export → Import in frischem Browser | e2e/f10, unit | ✓ |
| F10-N1 | kaputte / fremde Datei abgelehnt, ohne Rückfrage | e2e/f10, unit | ✓ (BUG-003) |
| F10-E1 | alles löschen → Start | e2e/f10 | ✓ |
| F11-H1 | Manifest + Icons erreichbar | e2e/f11 | ✓ |
| F11-E1 | nach erstem Besuch offline nutzbar | e2e/f11 | ✓ |
| SYNC-H1/N1 | Sync-UI mit gemocktem GitHub: privat ok, öffentlich abgelehnt | e2e | ✓ |
| SYNC-U* | erster Push, kein Leer-Commit, Merge von anderem Gerät, Konflikt-Retry, offline, Umlaute | unit (sync.test) | ✓ |
| PREP-H1 | Reste: Kochtag ↔ Reste-Tag verknüpft, Mengen inkl. Reste, axe | e2e/prep, unit | ✓ |
| PREP-H2 | Meal Prep Mittag, 3 pro Gericht | e2e/prep, unit | ✓ |
| PREP-E1..E5 | Kochtag tauschen (Reste wandern mit), Reste frisch kochen, Kochtag auswärts, fixieren + neu planen, „Reste aufwärmen“ auf Heute | e2e/prep, unit | ✓ |
| A11Y-1 | gültige aria-pressed/aria-current-Werte | e2e | ✓ (BUG-004) |

Nicht automatisiert / offen:
- Echter GitHub-Sync gegen ein privates Repo (nur gemockt getestet).
- Echte Geräte: iPhone (Safari, Home-Bildschirm, Speicher-Löschung nach 7 Tagen), Android-Installation.
- Zwei Tabs gleichzeitig: beide schreiben in dieselbe IndexedDB; der zuletzt gespeicherte Stand gewinnt pro Woche. Nicht als Bug reproduziert, steht auf „zu prüfen“.
- Sommerzeit: Daten sind Kalendertage (keine Zeitstempel), Unit-Tests decken Wochenwechsel ab; Umstellungstag selbst nicht gesondert getestet.
