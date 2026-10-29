import { test, expect, onboard, expectAccessible, expectNoHorizontalScroll, main } from './helpers.js'

test.describe('F01 Erster Plan', () => {
  test('F01-H1 Einrichtung mit Standardwerten erstellt eine volle Woche', async ({ page }) => {
    await onboard(page)
    await expect(page.getByText('2. Nov. – 8. Nov. · diese Woche')).toBeVisible()
    await expect(main(page).getByRole('link', { name: /.+/ }).filter({ has: page.locator('text=/Frühstück|Mittagessen|Abendessen/') })).toHaveCount(21)
    await expect(page.getByText('21 verschiedene Gerichte, keins doppelt')).toBeVisible()
  })

  test('F01-E1 jeder Schritt ist barrierefrei und passt auf das Display', async ({ page }) => {
    await page.goto('./')
    await expectAccessible(page, 'Start')
    await page.getByRole('link', { name: "Los geht's" }).click()
    for (let step = 1; step <= 7; step++) {
      await expect(page.getByText(`${step} von 7`)).toBeVisible()
      await expectAccessible(page, `Schritt ${step}`)
      await expectNoHorizontalScroll(page)
      if (step < 7) await page.getByRole('link', { name: 'Weiter' }).click()
    }
  })

  test('F01-E2 Antworten bleiben bei Zurück und Neuladen erhalten', async ({ page }) => {
    await page.goto('./#/einrichtung/1')
    await page.getByRole('button', { name: 'Vegan' }).click()
    await page.getByRole('link', { name: 'Weiter' }).click()
    await page.getByRole('button', { name: 'Gluten' }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Gluten' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('link', { name: 'Zurück' }).click()
    await expect(page.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'true')
    await page.goBack()
    await expect(page.getByRole('button', { name: 'Gluten' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('F01-E3 vegan + glutenfrei: nur passende Gerichte', async ({ page }) => {
    await onboard(page, {
      1: (p) => p.getByRole('button', { name: 'Vegan' }).click(),
      2: (p) => p.getByRole('button', { name: 'Gluten' }).click(),
    })
    // Every planned recipe page must say vegan and must not contain wheat products.
    const links = await main(page).locator('a[href^="#/woche/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    expect(links.length).toBeGreaterThan(0)
    for (const href of links.slice(0, 8)) {
      await page.goto(`./${href}`)
      await expect(main(page).getByText('Vegan').first()).toBeVisible()
      await expect(main(page).getByText(/Weizen|Spaghetti|Vollkornbrot|Haferflocken/)).toHaveCount(0)
    }
  })

  test('F01-E4 nur Abendessen unter der Woche, alles am Wochenende', async ({ page }) => {
    await onboard(page, { 3: (p) => p.getByRole('button', { name: 'Werktags abends, Wochenende alles' }).click() })
    await expect(page.getByText('11 verschiedene Gerichte, keins doppelt')).toBeVisible()
  })

  test('F01-E5 einzelne Mahlzeit an einem Wochentag abwählen', async ({ page }) => {
    await onboard(page, { 3: (p) => p.getByRole('button', { name: 'Frühstück am Montag' }).click() })
    await expect(page.getByText('20 verschiedene Gerichte, keins doppelt')).toBeVisible()
  })

  test('F01-E6 nichts geplant: ehrlicher Hinweis statt leerer Seite', async ({ page }) => {
    await onboard(page, {
      3: async (p) => {
        await p.getByRole('button', { name: 'Nur Abendessen' }).click()
        for (const d of ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']) {
          await p.getByRole('button', { name: `Abendessen am ${d}` }).click()
        }
      },
    })
    await expect(page.getByText(/Keine Mahlzeiten eingeplant/)).toBeVisible()
  })

  test('F01-E7 langer Name mit Umlauten und Emoji im Haushalt', async ({ page }) => {
    const name = 'Großmütterchen Ännchen-Lüdenscheid von Überlingen 🍲🥦'
    await onboard(page, {
      4: async (p) => {
        await p.getByRole('button', { name: '+ Person' }).click()
        const field = p.getByRole('textbox', { name: 'Name' }).nth(1)
        await field.fill(name)
        await field.blur()
        await expect(field).toHaveValue(name)
        await expectNoHorizontalScroll(p)
      },
    })
    await page.goto('./#/du')
    await expect(page.getByRole('textbox', { name: 'Name' }).nth(1)).toHaveValue(name)
  })

  test('F01-E8 nur mit Tastatur bis zum Plan', async ({ page }) => {
    await page.goto('./')
    const start = page.getByRole('link', { name: "Los geht's" })
    await expect(start).toBeVisible()
    // Tab through skip link and content until the start button has focus (max. 5 presses).
    for (let i = 0; i < 5 && !(await start.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(start).toBeFocused()
    await page.keyboard.press('Enter')
    for (let step = 1; step <= 6; step++) {
      await expect(page.getByText(`${step} von 7`)).toBeVisible()
      await page.getByRole('link', { name: 'Weiter' }).focus()
      await page.keyboard.press('Enter')
    }
    await page.getByRole('button', { name: 'Meinen Plan erstellen' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Woche', level: 1 })).toBeVisible()
  })
})
