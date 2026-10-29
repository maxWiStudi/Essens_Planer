# Bugs

### BUG-001: Grüne Chips („Gegessen“, Bilanz) mit zu wenig Kontrast
- Severity: S3 · Flow: F02/F06 · Screen: S06, S07, S10
- Steps: Plan erstellen → Woche ansehen. Expected: Kontrast ≥ 4,5:1. Actual: 4,36:1 (#2f7a4f auf #dcefe3); ebenso Primärfarbe auf Primär-hell 4,49:1.
- Evidence: axe color-contrast in F03-H1, PREP-H1
- Status: fixed (Farben #276a43 / #a83f18)

### BUG-002: Label der „Als Nächstes“-Karte mit zu wenig Kontrast
- Severity: S3 · Flow: F02 · Screen: S06
- Actual: Weiß mit 80 % Deckkraft auf Primärfarbe, 4,14:1. Evidence: axe in F02-H1
- Status: fixed (volle Deckkraft)

### BUG-003: Import fragt „Daten ersetzen?“ auch bei fremden Dateien
- Severity: S4 · Flow: F10 · Screen: S20
- Steps: Daten → Importieren → JSON ohne Essens-Planer-Inhalt wählen. Expected: sofort Fehlermeldung. Actual: erst Rückfrage, dann Fehler.
- Evidence: F10-N1 · Status: fixed (Prüfung vor der Rückfrage)

### BUG-004: Umschalter melden Screenreadern keinen Zustand
- Severity: S3 · Flow: alle · Screens: S02, S07, S13, S15, S21
- Actual: `aria-pressed=""` statt `"false"` – das Template rendert `false` als leeren Text. Evidence: A11Y-1, F07-E2
- Status: fixed (`ariaBool()`)

## Zu prüfen (nicht reproduziert)
- Zwei Tabs gleichzeitig offen: Änderungen im einen Tab erscheinen im anderen erst nach Neuladen.
