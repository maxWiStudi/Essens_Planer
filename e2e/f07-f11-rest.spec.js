import { readFileSync } from 'node:fs'
import { test, expect, onboard, expectAccessible, expectNoHorizontalScroll, main, toast } from './helpers.js'

test.describe('F07 Einkaufen', () => {
  test('F07-H1 abhaken, ausblenden, zurücksetzen', async ({ page }) => {
    await onboard(page)
    await page.getByRole('link', { name: 'Liste', exact: true }).click()
    await expectAccessible(page, 'Liste')
    await expectNoHorizontalScroll(page)
    const sub = page.locator('header p')
    const [open, total] = (await sub.textContent()).match(/(\d+) von (\d+)/).slice(1).map(Number)
    expect(open).toBe(total)
    const first = main(page).getByRole('checkbox').first()
    await first.check()
    await expect(sub).toContainText(`${total - 1} von ${total} offen`)
    await page.reload()
    await expect(sub).toContainText(`${total - 1} von ${total} offen`)
    await page.getByRole('button', { name: 'Erledigte ausblenden' }).click()
    await expect(main(page).getByRole('checkbox', { checked: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Haken zurücksetzen' }).click()
    await expect(sub).toContainText(`${total} von ${total} offen`)
  })

  test('F07-E1 Teilen kopiert die offene Liste als Text', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined }) })
    await onboard(page)
    await page.goto('./#/liste')
    await main(page).getByRole('checkbox').first().check()
    await page.getByRole('button', { name: 'Liste teilen' }).click()
    await expect(toast(page)).toContainText('Zwischenablage')
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toMatch(/^Einkaufsliste 2\. Nov\./)
    expect(text).toContain('Obst & Gemüse:')
  })

  test('F07-E2 Mengen wachsen mit dem Haushalt', async ({ page }) => {
    await onboard(page, { 3: (p) => p.getByRole('button', { name: 'Nur Abendessen' }).click() })
    const wholeWeek = async () => {
      await page.goto('./#/liste')
      const t = page.getByRole('button', { name: 'Nur ab heute' })
      if ((await t.getAttribute('aria-pressed')) === 'true') await t.click()
      await expect(t).toHaveAttribute('aria-pressed', 'false')
      return main(page).getByRole('listitem').allTextContents()
    }
    const one = await wholeWeek()
    await page.goto('./#/du')
    await page.getByRole('button', { name: '+ Person' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveCount(2)
    const two = await wholeWeek()
    expect(two).not.toEqual(one)
    expect(two.length).toBe(one.length)
  })
})

test.describe('F08 Einstellungen', () => {
  test('F08-H1 Einstellungen ändern und neu planen', async ({ page }) => {
    await onboard(page)
    await page.getByRole('link', { name: 'Du', exact: true }).click()
    await expectAccessible(page, 'Du')
    await expectNoHorizontalScroll(page)
    await page.getByRole('button', { name: 'Nur Abendessen' }).click()
    await page.getByRole('combobox', { name: 'Fleisch höchstens' }).selectOption('0')
    await page.getByRole('link', { name: 'Woche', exact: true }).click()
    await page.getByRole('button', { name: 'Neu planen' }).click()
    await expect(page.getByText(/7 verschiedene Gerichte/)).toBeVisible()
    await expect(main(page).getByText('Frühstück')).toHaveCount(0)
    await expect(main(page).getByText('Geflügel')).toHaveCount(0)
  })

  test('F08-E1 Einrichtung wiederholen ist vorausgefüllt', async ({ page }) => {
    await onboard(page, { 1: (p) => p.getByRole('button', { name: 'Pescetarisch' }).click() })
    await page.goto('./#/einrichtung/1')
    await expect(page.getByRole('button', { name: 'Pescetarisch' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('F08-E2 Rezeptbuch: suchen, filtern, Favorit', async ({ page }) => {
    await onboard(page)
    await page.getByRole('link', { name: 'Rezepte', exact: true }).click()
    await expectAccessible(page, 'Rezepte')
    await page.getByRole('searchbox', { name: 'Rezepte durchsuchen' }).fill('linsen')
    await expect(page.getByText(/\d+ Rezepte$/)).toBeVisible()
    await expect(page.getByRole('searchbox')).toBeFocused() // focus survives re-render
    await page.getByRole('searchbox').fill('xyzxyz')
    await expect(page.getByText('Nichts gefunden.')).toBeVisible()
    await page.getByRole('searchbox').fill('')
    await page.getByRole('button', { name: 'Favorit: Linseneintopf mit Kartoffeln und Möhren' }).click()
    await page.getByRole('button', { name: 'Favoriten' }).click()
    await expect(main(page).getByRole('listitem')).toHaveCount(1)
  })
})

test.describe('F10 Backup', () => {
  test('F10-H1 Export und Import in einem frischen Browser', async ({ page, browser }, info) => {
    await onboard(page)
    const firstTitle = (await main(page).locator('a[href^="#/woche/"]').first().textContent()).trim()
    await page.goto('./#/daten')
    await expectAccessible(page, 'Daten')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportieren' }).click()])
    const file = info.outputPath('backup.json')
    await download.saveAs(file)
    const data = JSON.parse(readFileSync(file, 'utf8'))
    expect(data.app).toBe('essensplan')
    expect(data.weeks).toHaveLength(1)

    const fresh = await browser.newPage()
    await fresh.clock.install({ time: new Date('2026-11-04T12:00:00+01:00') })
    await fresh.goto('./#/einrichtung/1')
    await fresh.goto('./#/daten')
    // not onboarded yet → setup is shown; finish quickly then import
    await fresh.goto('./')
    await fresh.getByRole('link', { name: "Los geht's" }).click()
    for (let s = 1; s < 7; s++) await fresh.getByRole('link', { name: 'Weiter' }).click()
    await fresh.getByRole('button', { name: 'Meinen Plan erstellen' }).click()
    await fresh.goto('./#/daten')
    fresh.once('dialog', (d) => d.accept())
    await fresh.locator('input[type=file]').setInputFiles(file)
    await expect(fresh.locator('#toast')).toContainText('Import abgeschlossen')
    await fresh.goto('./#/woche')
    await expect(fresh.locator('main a[href^="#/woche/"]').first()).toHaveText(firstTitle)
    await fresh.close()
  })

  test('F10-N1 kaputte Datei wird abgelehnt', async ({ page }, info) => {
    await onboard(page)
    await page.goto('./#/daten')
    await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{kaputt') })
    await expect(toast(page)).toContainText('kein gültiges JSON')
    // A foreign file must be rejected before asking to overwrite anything.
    const dialogs = []
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss() })
    await page.locator('input[type=file]').setInputFiles({ name: 'y.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') })
    await expect(toast(page)).toContainText('keine Essens-Planer-Datei')
    expect(dialogs).toEqual([])
  })

  test('F10-E1 Alles löschen führt zurück zum Start', async ({ page }) => {
    await onboard(page)
    await page.goto('./#/daten')
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Daten löschen' }).click()
    await expect(page.getByRole('link', { name: "Los geht's" })).toBeVisible()
  })
})

test.describe('Sync-Oberfläche (GitHub gemockt)', () => {
  const mock = async (page, { isPrivate }) => {
    let file = null, sha = null
    await page.route('https://api.github.com/**', async (route) => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      if (url.pathname === '/repos/max/daten') return route.fulfill({ json: { private: isPrivate, permissions: { push: true }, default_branch: 'main' } })
      if (method === 'GET') return file ? route.fulfill({ json: { sha, encoding: 'base64', content: file } }) : route.fulfill({ status: 404, json: {} })
      const body = route.request().postDataJSON()
      file = body.content
      sha = `s${Date.now()}`
      return route.fulfill({ json: { content: { sha } } })
    })
  }

  test('SYNC-N1 öffentliches Repo wird abgelehnt', async ({ page }) => {
    await mock(page, { isPrivate: false })
    await onboard(page)
    await page.goto('./#/daten')
    await page.getByRole('textbox', { name: 'GitHub-Name' }).fill('max')
    await page.getByRole('textbox', { name: 'Privates Repo' }).fill('daten')
    await page.getByLabel(/Zugangs-Token/).fill('github_pat_test')
    await page.getByRole('button', { name: 'Verbinden' }).click()
    await expect(toast(page)).toContainText('öffentlich')
  })

  test('SYNC-H1 privates Repo verbindet und synchronisiert', async ({ page }) => {
    await mock(page, { isPrivate: true })
    await onboard(page)
    await page.goto('./#/daten')
    await page.getByRole('textbox', { name: 'GitHub-Name' }).fill('max')
    await page.getByRole('textbox', { name: 'Privates Repo' }).fill('daten')
    await page.getByLabel(/Zugangs-Token/).fill('github_pat_test')
    await page.getByRole('button', { name: 'Verbinden' }).click()
    await expect(page.getByText('Aktiv: max/daten → essensplan.json')).toBeVisible()
    await expect(page.getByText(/Zuletzt: \d/)).toBeVisible()
    await expect(page.getByLabel(/Zugangs-Token/)).toHaveValue('')
    await expect(page.getByText('(gespeichert – leer lassen zum Behalten)')).toBeVisible()
  })
})

test.describe('F11 Installieren und offline', () => {
  test('F11-H1 Manifest ist gültig verlinkt', async ({ page, request }) => {
    await page.goto('./')
    const href = await page.locator('link[rel=manifest]').getAttribute('href')
    const res = await request.get(new URL(href, page.url()).toString())
    const m = await res.json()
    expect(m.display).toBe('standalone')
    expect(m.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    for (const icon of m.icons) expect((await request.get(new URL(icon.src, new URL(href, page.url())).toString())).ok()).toBe(true)
  })

  test('F11-E1 funktioniert nach dem ersten Besuch offline', async ({ page, context }) => {
    await onboard(page)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // now controlled by the service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Woche', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: 'Liste', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible()
    await context.setOffline(false)
  })
})

test.describe('A11Y', () => {
  test('A11Y-1 Umschalter haben gültige aria-pressed-Werte', async ({ page }) => {
    await onboard(page)
    for (const path of ['./#/du', './#/liste', './#/rezepte', './#/woche', './#/heute']) {
      await page.goto(path)
      await expect(page.locator('main')).not.toBeEmpty()
      const bad = await page.locator('[aria-pressed], [aria-current]').evaluateAll((els) =>
        els.filter((e) => !['true', 'false', 'page', 'date'].includes(e.getAttribute('aria-pressed') ?? e.getAttribute('aria-current'))).map((e) => e.outerHTML.slice(0, 80)))
      expect(bad, path).toEqual([])
    }
  })
})
