# Recon map: Mealbird: Essensplan & Rezepte (Android/iOS) → statische PWA

Scope: Wochen-Essensplan, der automatisch entsteht, anpassbar ist, abwechslungsreich und ausgewogen, mit wenig Wiederholungen. Dazu Rezeptansicht, Einkaufsliste und Profil/Ziele. Läuft als reine statische PWA (GitHub Pages), ohne Server; alle Daten liegen lokal im Browser.
For: Annahme: zuerst Eigennutzung, deutschsprachig. Ein späterer Verkauf ist offen (das bestätigt der Nutzer in der Freigabe).
Date: 2026-10-29

Es wurden nur öffentliche Quellen genutzt: kein Login, kein Kauf, kein App-Code, kein Netzwerk-Mitschnitt. Die AGB des Originals (§7) verbieten „copy, scrape, resell, or redistribute the Service or its content“. Wir übernehmen deshalb **keine** Texte, Rezepte, Bilder, Maskottchen oder Namen. Nachgebaut werden nur Funktionen und UX-Muster, mit eigenem Code und eigenen Inhalten.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Google Play Listing (DE) | https://play.google.com/store/apps/details?id=app.mealbird&hl=de | Beschreibung, 8 Screenshots (→ `screens/`), 4,3★, ca. 1,7 Tsd. Bewertungen, 10.000+ Downloads, Update 26.10.2026 |
| 2 | Marketing-Site + FAQ | https://mealbird.app/ | vollständigste Feature-Liste: Ziele-Formel, Wiederholungen, Diäten/Allergene, Einkaufsliste, Haushalt, Preise |
| 3 | Support / Hilfe | https://mealbird.app/support | Planerstellung, „Redo the quiz“, „Not for me“, Swap, Konto, Restore, Datenlöschung |
| 4 | AGB | https://mealbird.app/terms | §7 verbietet Kopieren und Scraping von Inhalten, §8 Inhalte gehören Lusson LLC |
| 5 | App Store (US) | https://apps.apple.com/us/app/mealbird-macro-meal-planner/id6794577462 | gleiche App, Sprachen, Version 1.1.16 |
| 6 | Nutzerbewertungen | `replica/reviews.csv`, `replica/fixes.md` | 10 Bewertungen, wenig Belege; Hauptklage: Paywall ohne Test, Preis zu spät gezeigt |
| 7 | Changelog | Play „Neuerungen“ | nur „Kleine Fehlerbehebungen und Verbesserungen.“, kein öffentliches Roadmap-Board |

Nicht verfügbar: eigenes Konto des Nutzers (würde ein Abo erfordern), öffentliche Walkthrough-Videos (keine gefunden), öffentliche API-Doku (gibt es nicht).
Die Screens stammen deshalb aus den Store-Screenshots und den Website-Beschreibungen. Zustände wie leer oder Fehler sind teils **erschlossen**.

## Core loop

Ein paar Fragen beantworten → die App erstellt automatisch eine Woche (3 Mahlzeiten × 7 Tage), die jeden Tag die Eiweiß- und Kalorienziele trifft → einzelne Gerichte tauschen oder ausschließen → nach der Einkaufsliste einkaufen → Mahlzeiten abhaken.

Bewusster Unterschied zum Original: Mealbird wiederholt Gerichte absichtlich (Screenshot 6: „11 dishes across 21 meals“, ein Gericht 4× pro Woche). Gewünscht ist hier das Gegenteil: **Abwechslung als Standard**, Meal-Prep-Wiederholung nur optional.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Start / Willkommen | erster Aufruf | App erklären, Onboarding starten | Hero, Button | filled (erschlossen) |
| S02 | Onboarding-Quiz (Schrittfolge) | S01 → „Los“ | Ziel, Körperdaten, Ernährungsweise, Allergene, Ausschlüsse, Kochzeit, Geräte, Haushalt, Wiederholungswunsch, (Markt/Budget) | Stepper „1 of 18“, Fortschrittsbalken, Auswahlkacheln, Zahl-Eingaben, Einheiten-Toggle | filled, Validierung (erschlossen) |
| S03 | Ziele | Quiz-Schritt 7 | berechnete kcal- und Eiweißziele, offengelegte Formel, editierbar | große Zahlen, Formel-Tabelle | filled (Screenshot 8) |
| S04 | Plan wird erstellt | nach Quiz | Fortschritt der Generierung | Stufen-Liste, Spinner | loading (lt. Support) |
| S05 | Plan-Übersicht nach Erstellung | nach S04 | 7 Tage mit ✓ und Lage im Zielbereich | Tagesliste, Band-Anzeige | filled |
| S06 | Heute / Home | Tab „Heute“ | Begrüßung, nächste Mahlzeit, Tagesstand kcal/Eiweiß, Streak, Wochenleiste, heutige Mahlzeiten abhaken | Wochen-Chips, Mahlzeit-Karte, Fortschrittsbalken, Stat-Pills | filled, teilweise erledigt (Screenshot 1) |
| S07 | Woche | S06 → „The whole week“ | alle 21 Mahlzeiten, Tages-Summen, Hinweis auf Wiederholungen | Zusammenfassung „n Gerichte / 21 Mahlzeiten“, Tagesgruppen, Listenzeilen mit ×n-Badge | filled (Screenshot 6) |
| S08 | Rezept-Detail | Mahlzeit antippen | Foto, Makros, Zutaten in Gramm, Schritte, Aktionen | Makro-Pills, Favorit-Herz, „Tauschen“, „Auswärts essen“, „Nicht für mich“ | filled (Screenshot 3) |
| S09 | Die Rechnung | S08 → „So rechnen wir“ | Nährwerte je Zutat Zeile für Zeile mit Datenquelle | Bottom-Sheet, Monospace-Zeilen | filled (Screenshot 7) |
| S10 | Tausch-Vorschau | S08 → „Tauschen“ | Alternativen und Auswirkung auf die Tageswerte, vor dem Übernehmen | Kandidatenliste, Vorher/Nachher-Werte | erschlossen (Website: „see what changes first“) |
| S11 | Auswärts essen | S08 → „Auswärts essen“ | Mahlzeit als auswärts markieren, Rest des Tages bleibt | Bestätigungs-Sheet | erschlossen |
| S12 | Woche ändern | S07 / Menü | Tage oder Starttag ändern, Rest der Woche neu erstellen | Optionsliste | erschlossen (Website) |
| S13 | Einkaufsliste | Tab „Liste“ | nach Gängen sortiert, Packungsgrößen, abhaken, g/oz, teilen, Budgetkarte | Summenkarte, Toggle, Checkbox-Zeilen, Haltbarkeits-Badge, Teilen-Button | filled (Screenshot 5) |
| S14 | „Warum zwei Kosten?“ | S13 | Erklärung Verzehr- vs. Kassenpreis | Info-Sheet | filled |
| S15 | Profil / Du | Tab „Du“ | Quiz wiederholen, Ziele, Einheiten, Abo, Login | Einstellungsliste | erschlossen (Support) |
| S16 | Plan nicht machbar | nach S04 | welche Tage das Ziel wie stark verfehlen, Änderungsvorschläge | Hinweis-Karte, Buttons | erschlossen (Support) |
| S17 | Haushalt teilen | S15 | Haushaltscode, Portionen pro Person | Code-Anzeige | erschlossen (Listing) |
| S18 | Paywall | nach S03 | Abo | — | skip |
| S19 | Lieferung (DoorDash) | S13 | Liste an DoorDash übergeben | — | skip |

Nur im Nachbau, ohne Gegenstück im Original:

| ID | screen | purpose |
| --- | --- | --- |
| S20 | Daten & Backup | JSON-Export/-Import, Speicher-Status, alles löschen |
| S21 | Rezeptbuch | alle Rezepte durchsuchen, Favoriten, ausgeschlossene Gerichte verwalten |

## Flows

```
F01 Erster Plan
    S01 -> S02 (Schritte) -> S03 -> S04 -> S05 -> S06
    happy path clicks: Original ca. 18 Quizschritte + Paywall. Ziel: ≤ 8 Schritte, keine Paywall
    edge: unmögliche Kombi (vegan + 200 g Eiweiß + kleines Budget) -> S16; Werte ohne Körperdaten -> manuelle Ziele

F02 Heute abhaken
    S06 -> Karte "Erledigt"
    happy path clicks: 1
    edge: Tag vergangen, nicht abgehakt; Streak-Bruch

F03 Ein Gericht tauschen
    S06/S07 -> S08 -> S10 -> übernehmen
    happy path clicks: 3
    edge: kein passender Ersatz (Filter zu eng); Tausch drückt Tag unter Eiweißziel -> Warnung

F04 Gericht dauerhaft ausschließen ("Nicht für mich")
    S08 -> bestätigen -> optional sofort tauschen
    happy path clicks: 2
    edge: Ausschluss leert Pool einer Mahlzeitart

F05 Auswärts essen
    S08 -> S11 -> bestätigen
    happy path clicks: 2

F06 Woche neu erstellen / Rest der Woche neu würfeln
    S07 -> S12 -> neu erstellen
    happy path clicks: 2
    edge: abgehakte Tage bleiben unverändert; fixierte Gerichte bleiben stehen

F07 Einkaufen
    S13 -> abhaken -> teilen
    happy path clicks: 1 je Artikel
    edge: Gericht nach dem Einkauf getauscht -> Liste aktualisieren ohne Haken zu verlieren

F08 Ziele/Präferenzen ändern
    S15 -> S02 (vorausgefüllt) -> gilt ab nächster Woche
    happy path clicks: 3+

F09 Neue Woche
    automatisch beim Wochenwechsel oder per Button -> S04 -> S05
    edge: Variationsregel greift über die Wochen hinweg (Historie)

F10 Backup (nur Nachbau)
    S20 -> Export (Datei) / Import
    edge: Import einer älteren Datenversion -> Migration

F11 Installieren (nur Nachbau)
    Browser "Zum Startbildschirm" -> App startet offline
    edge: iOS ohne Install-Prompt -> Hinweis-Banner mit Anleitung
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary (dunkelgrün), secondary (outline), ghost, pill | default, pressed, disabled, loading | alle |
| Stepper-Header | Zurück + „n von N“ + Segmentbalken | aktiv, erledigt | S02, S03 |
| Auswahlkachel | einfach, mehrfach, mit Logo/Icon | default, selected (Rahmen + ✓) | S02 |
| Zahl-Eingabe mit Einheit | kg/lb, cm/ft | default, invalid | S02, S03 |
| Stat-Pill | kcal, Eiweiß, KH, Fett, Streak | — | S06, S08 |
| Wochen-Chip | Tag | heute, erledigt ✓, zukünftig | S06 |
| Mahlzeit-Karte | groß (Bild) / Listenzeile | offen, erledigt, auswärts | S06, S07 |
| Wiederholungs-Badge | „×n diese Woche“ | — | S06, S07, S08 |
| Fortschrittsbalken | Tag x/3, Zielband | — | S05, S06 |
| Bottom-Sheet | mit „Fertig“ | offen/zu | S09, S10, S11, S14 |
| Checkbox-Zeile | mit Emoji, Menge, Badge | offen, abgehakt | S13 |
| Segment-Toggle | g/oz | — | S13 |
| Summen-/Budgetkarte | im Budget / drüber | — | S13 |
| Tab-Bar | Heute, Woche, Liste, Du | aktiv | global |
| Toast | Info, Rückgängig | — | Tausch, Ausschluss |
| Hinweis-Karte | Warnung, Info | — | S16, Install-Hinweis |

## Inferred data model

```
Profile        goal (lose|keep|gain), sex, age, height_cm, weight_kg, activity, units
               evidence: Website-Rechner, Screenshot 8; confidence: high
Targets        kcal_per_day, protein_g_per_day, manual_override(bool), formula_steps
               evidence: Screenshot 8 ("edit either number"); confidence: high
Preferences    diet (omni|vegetarisch|vegan|pesce), allergens[], excluded_ingredients[],
               liked_ingredients[], equipment[], max_cook_minutes, household[{name, portion_factor}],
               repeat_level (keine|wenig|meal-prep), meals_cooked_by_user[]
               evidence: Listing "Deine Küche, deine Regeln", Website Diät-Liste; confidence: high
Ingredient     id, name_de, aisle, kcal/protein/carb/fat per 100 g, source_ref (USDA FDC id),
               pack_size_g, shelf_life_days, price_est (optional), allergens[]
               evidence: Screenshot 7, 5; confidence: high
Recipe         id, title, meal_types[], cook_minutes, servings, steps[], tags (Küche, Proteinquelle,
               Hauptkomponente), diet_flags, equipment[], image (optional)
               evidence: Screenshot 3; confidence: high
RecipeIngredient recipe_id, ingredient_id, grams     confidence: high
WeekPlan       id, start_date, generated_at, seed, settings_snapshot
               evidence: "This week Sep 24 to Sep 30"; confidence: high
PlanSlot       week_id, date, meal_type (frühstück|mittag|abend|snack), recipe_id, portion_factor,
               status (geplant|erledigt|auswärts), locked(bool), batch_group (Meal-Prep)
               evidence: Screenshot 1, 6; confidence: high (locked = guess, eigene Ergänzung)
ShoppingCheck  week_id, ingredient_id, checked     (Liste selbst wird aus PlanSlots abgeleitet)
               confidence: medium
RecipeFeedback recipe_id, favorite(bool), excluded(bool), last_used_dates[]
               evidence: Herz + "Not for me"; Historie = eigene Ergänzung für Abwechslung
Streak         abgeleitet aus PlanSlot.status; confidence: medium
```

Relationships: Profile 1-1 Targets, Profile 1-1 Preferences, Recipe n-m Ingredient (über RecipeIngredient), WeekPlan 1-n PlanSlot, PlanSlot n-1 Recipe, WeekPlan 1-n ShoppingCheck.
Im Nachbau ist alles lokal: Rezepte und Zutaten als statisches JSON im Bundle, Nutzerdaten in IndexedDB.

## Feature matrix

See `features.csv`. Must: 19, should: 13, could: 12, skip: 10.

## Entscheidungen des Nutzers (2026-10-29)

1. Nur für den Eigengebrauch, auf Deutsch, metrisch.
2. Claude schreibt den Startbestand an Rezepten. Eine Gemini-Anbindung mit eigenem API-Key für neue Rezepte oder Plananpassung kommt eventuell später; das Rezeptschema wird von Anfang an KI-tauglich angelegt.
3. Tailwind-CLI-Build per GitHub Action ist in Ordnung.
4. v1 kommt ohne Budget/Preise und ohne Plan-Link.
5. **Nährwerte sind zweitrangig.** Ziel sind ausgewogene, abwechslungsreiche Mahlzeiten. Ausgewogenheit wird über Lebensmittelgruppen geregelt (Gemüse, Hülsenfrüchte, Fisch, Vollkorn, Fleisch begrenzt), nicht über kcal- oder Eiweißziele. Die Rezepte brauchen deshalb keine grammgenaue Nährwertzuordnung, und der Inhaltsaufwand sinkt deutlich.
6. Gewünscht: Daten in eine Datei auf GitHub speichern, damit sie auf iOS nicht verloren gehen. Umsetzung als optionaler Sync in ein privates Repo.

## Out of scope (cannot or should not be cloned)

- **Die Inhalte des Originals**: Rezepte, Texte, Fotos, Maskottchen, Name. Laut AGB §7/§8 geschützt. Wir schreiben eigene Rezepte; Bilder sind optional und eigene.
- **KI-Planerstellung auf dem Server**: Ohne Server gibt es keinen API-Key. Ersatz ist ein eigener, deterministischer Planer-Algorithmus im Browser (ist für dieses Ziel ohnehin besser prüfbar).
- **Login, geräteübergreifende Sync, Haushaltscode mit Live-Abgleich**: Das braucht ein Backend. Ersatz: Export/Import, Plan als Link teilen (im URL-Fragment kodiert).
- **Live- oder lokale Supermarktpreise, Händlerauswahl mit Logos**: Daten und Marken gehören Dritten. Optional: grobe eigene Preisschätzungen je Zutat, klar als Schätzung markiert.
- **DoorDash-Lieferung**: Partner-Deal, nur USA.
- **Foto-Erkennung „Auswärts essen“**: braucht ein KI-Backend; ohne Foto nachbaubar.
- **Push-Erinnerungen**: Web-Push braucht einen Server; lokale Benachrichtigungen sind unzuverlässig.
- **Paywall / Abo**: nicht gewünscht.

## Technische Grenzen der Zielarchitektur (statische PWA, GitHub Pages)

1. **Speicher kann verschwinden.** Safari auf iOS löscht Website-Daten nach ca. 7 Tagen ohne Nutzung. Für installierte Home-Screen-Apps gilt das nicht, aber auch dort kann bei Speicherknappheit gelöscht werden. Gegenmittel: `navigator.storage.persist()`, Export-Erinnerung, Backup-Datei.
2. **Keine Sync.** Handy und Laptop haben jeweils eigene Daten. Abhilfe: Export/Import, optional später ein Gist oder WebDAV des Nutzers (kostenlos, aber mit Aufwand).
3. **Tailwind ohne Server.** Das Play-CDN ist nicht für Produktion gedacht und schlecht offline cachebar. Empfehlung: Tailwind-CLI-Build (lokal oder per GitHub Action), Ergebnis ist reines statisches CSS. GitHub Pages bleibt kostenlos.
4. **Unterpfad bei GitHub Pages** (`/repo-name/`): `start_url`, `scope`, Service-Worker-Pfad und alle Links müssen relativ sein. Das ist eine bekannte Stolperfalle.
5. **iOS-Install**: Es gibt keinen automatischen Install-Prompt. Der Nutzer muss über Teilen → „Zum Home-Bildschirm“ gehen, die App braucht dafür einen Hinweis.
6. **Nährwertdaten**: USDA FoodData Central ist gemeinfrei und darf gebündelt werden. Der deutsche BLS hat Lizenzauflagen. Plan: kuratierte Teilmenge aus ca. 150–250 Zutaten mit deutschen Namen.
7. **Das eigentliche Nadelöhr ist der Inhalt, nicht der Code.** Für „abwechslungsreich, kaum Wiederholung“ bei 21 Mahlzeiten pro Woche und Filtern wie vegetarisch oder Allergenen braucht es grob **≥ 25 Frühstücke und ≥ 60 Mittag/Abend-Gerichte**, besser 150 gesamt. Jedes Rezept braucht Grammangaben, die auf Zutaten-IDs gemappt und auf Plausibilität geprüft sind.

## Planer-Algorithmus (Kernfunktion, Skizze für replica-architect)

- Pool je Mahlzeitart nach harten Filtern (Diät, Allergene, Ausschlüsse, Geräte, Kochzeit).
- Pro Tag Kombinationen mit Portionsfaktoren (0,75 / 1 / 1,25 / 1,5) so wählen, dass das Eiweiß-Minimum und das kcal-Band (±5–10 %) **pro Tag** getroffen werden.
- Abwechslung als Strafpunkte im Score: gleiches Gericht innerhalb von N Tagen oder Wochen (Historie), gleiche Proteinquelle an Folgetagen, gleiche Küche oder Hauptkomponente zu oft, Favoriten leicht bevorzugt.
- Ausgewogenheit: Makro-Verteilung, Gemüse- und Ballaststoff-Mindestanteil pro Tag (aus Zutatendaten), Fisch 1–2× pro Woche, rotes Fleisch begrenzt.
- Verfahren: greedy mit Zufalls-Seed, danach lokale Suche (Tauschen/Verbessern), einige Hundert Iterationen. Das läuft im Browser in Millisekunden.
- Gesperrte (fixierte) und erledigte Slots bleiben beim Neu-Würfeln unverändert. Bei Unmachbarkeit zeigt die App ehrlich an, welche Tage um wie viel verfehlt werden.

## Size

Screens: 15 nachzubauen (S01–S17 ohne S18/S19, plus S20/S21), Flows: 11, Entities: 10.
Hard parts: (1) eigene Rezeptdatenbank mit verlässlichen Nährwerten, (2) Planer-Algorithmus mit Abwechslung plus täglichen Zielen, (3) robuste lokale Datenhaltung und Offline-PWA auf iOS/Android unter GitHub-Pages-Unterpfad.
Size: **M** (einige Wochen). Code-MVP ca. 6–10 Arbeitstage, Rezeptinhalt (60–80 Rezepte) ca. 4–8 Arbeitstage inklusive Prüfung. Budget/Preise und Teilen-Links kommen danach.
Es ist ein Nachbau der Funktion, keine Kopie. Nährwerte sind Schätzungen aus Standarddaten, keine medizinische Beratung.
