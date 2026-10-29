import { test, expect, onboard, expectAccessible, expectNoHorizontalScroll, main, toast, sheet } from './helpers.js'

const firstDinnerOfToday = (page) => main(page).getByRole('link', { name: /Abendessen/ }).first()

test.describe('F02 Heute abhaken', () => {
  test('F02-H1 Mahlzeit abhaken, bleibt nach Neuladen', async ({ page }) => {
    await onboard(page)
    await page.getByRole('link', { name: 'Heute', exact: true }).click()
    await expect(page.getByText('Mittwoch, 4. November').first()).toBeVisible()
    await expect(page.getByText('0 von 3 gegessen')).toBeVisible()
    const btn = main(page).getByRole('button', { name: /^Gegessen:/ }).first()
    await btn.click()
    await expect(page.getByText('1 von 3 gegessen')).toBeVisible()
    await page.reload()
    await expect(page.getByText('1 von 3 gegessen')).toBeVisible()
    await main(page).getByRole('button', { name: /^Nicht gegessen:/ }).first().click()
    await expect(page.getByText('0 von 3 gegessen')).toBeVisible()
    await expectAccessible(page, 'Heute')
    await expectNoHorizontalScroll(page)
  })

  test('F02-E1 anderer Tag über die Wochenleiste', async ({ page }) => {
    await onboard(page)
    await page.goto('./#/heute')
    await page.getByRole('navigation', { name: 'Tage dieser Woche' }).getByRole('link').nth(5).click()
    await expect(page.getByRole('heading', { name: 'Samstag, 7. November' })).toBeVisible()
    await expect(page.getByText('Vorschau auf einen anderen Tag')).toBeVisible()
  })

  test('F02-E2 Doppelklick schaltet sauber hin und her', async ({ page }) => {
    await onboard(page)
    await page.goto('./#/heute')
    await main(page).getByRole('button', { name: /^Gegessen:/ }).first().dblclick()
    await expect(page.getByText(/[01] von 3 gegessen/)).toBeVisible()
  })
})

test.describe('F03 Gericht tauschen', () => {
  test('F03-H1 tauschen und rückgängig machen', async ({ page }) => {
    await onboard(page)
    const row = main(page).locator('section', { hasText: 'Mittwoch, 4. November' })
    const before = await row.getByRole('link').last().textContent()
    await row.getByRole('button', { name: 'Tauschen' }).last().click()
    await expect(sheet(page)).toBeVisible()
    await expectAccessible(page, 'Tausch-Sheet')
    const choice = sheet(page).getByRole('button').filter({ hasText: /Min\./ }).first()
    const newTitle = (await choice.locator('span').first().textContent()).trim()
    await choice.click()
    await expect(sheet(page)).toBeHidden()
    await expect(row.getByText(newTitle)).toBeVisible()
    await toast(page).getByRole('button', { name: 'Rückgängig' }).click()
    await expect(row.getByRole('link').last()).toHaveText(before)
  })

  test('F03-E1 Escape schließt das Sheet, Fokus geht zurück', async ({ page }) => {
    await onboard(page)
    const swap = main(page).getByRole('button', { name: 'Tauschen' }).first()
    await swap.click()
    await expect(sheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet(page)).toBeHidden()
    await expect(swap).toBeFocused()
  })
})

test.describe('F04 Nicht für mich', () => {
  test('F04-H1 ausschließen, Tausch anbieten, im Rezeptbuch wiederfinden und zurückholen', async ({ page }) => {
    await onboard(page)
    const link = main(page).getByRole('link').filter({ hasText: 'Abendessen' }).first()
    const title = (await link.locator('span').nth(1).textContent()).trim()
    await link.click()
    await page.getByRole('button', { name: /Nicht für mich/ }).click()
    await expect(sheet(page)).toBeVisible()
    await sheet(page).getByRole('button').filter({ hasText: /Min\./ }).first().click()
    await page.getByRole('link', { name: 'Rezepte', exact: true }).click()
    await page.getByRole('button', { name: 'Ausgeschlossen' }).click()
    await expect(main(page).getByRole('link', { name: new RegExp(title) })).toBeVisible()
    await main(page).getByRole('link', { name: new RegExp(title) }).click()
    await page.getByRole('button', { name: 'Wieder in Pläne aufnehmen' }).click()
    await expect(page.getByRole('button', { name: /Nicht für mich/ })).toBeVisible()
  })
})

test.describe('F05 Auswärts essen', () => {
  test('F05-H1 Mahlzeit fällt aus der Einkaufsliste', async ({ page }) => {
    await onboard(page, { 3: (p) => p.getByRole('button', { name: 'Nur Abendessen' }).click() })
    const link = main(page).getByRole('link').filter({ hasText: 'Abendessen' }).first()
    const title = (await link.locator('span').nth(1).textContent()).trim()
    await page.goto('./#/liste')
    const t = page.getByRole('button', { name: 'Nur ab heute' })
    if ((await t.getAttribute('aria-pressed')) === 'true') await t.click() // whole week
    await expect(main(page).getByText(title).first()).toBeVisible()
    await page.goBack()
    await link.click()
    await page.getByRole('button', { name: 'Auswärts essen' }).click()
    await expect(page.getByRole('button', { name: 'Doch zu Hause' })).toBeVisible()
    await page.goto('./#/liste')
    await expect(main(page).getByText(title)).toHaveCount(0)
  })
})

test.describe('F06 Neu planen', () => {
  test('F06-H1 fixierte und gegessene Gerichte bleiben', async ({ page }) => {
    await onboard(page)
    const monday = main(page).locator('section', { hasText: 'Montag, 2. November' })
    const locked = (await monday.getByRole('link').first().textContent()).trim()
    await monday.getByRole('button', { name: 'Fixieren' }).first().click()
    await expect(monday.getByRole('button', { name: 'Fixierung lösen' })).toBeVisible()
    await monday.getByRole('button', { name: /^Gegessen:/ }).nth(1).click()
    const eaten = (await monday.getByRole('link').nth(1).textContent()).trim()
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Neu planen' }).click()
    await expect(monday.getByRole('link').first()).toHaveText(locked)
    await expect(monday.getByRole('link').nth(1)).toHaveText(eaten)
  })

  test('F06-E1 Wochen vor und zurück, vergangene Woche ohne Plan', async ({ page }) => {
    await onboard(page)
    await page.getByRole('link', { name: 'Vorherige Woche' }).click()
    await expect(page.getByText('Für diese Woche gibt es keinen Plan')).toBeVisible()
    await page.getByRole('link', { name: 'Nächste Woche' }).click()
    await page.getByRole('link', { name: 'Nächste Woche' }).click()
    await expect(page.getByText('Noch kein Plan für diese Woche')).toBeVisible()
  })
})

test.describe('F09 Neue Woche', () => {
  test('F09-H1 nächste Woche wiederholt keine Hauptgerichte dieser Woche', async ({ page }) => {
    await onboard(page)
    const titles = async () => (await main(page).locator('a[href^="#/woche/"]').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim())
    const thisWeek = await titles()
    await page.getByRole('link', { name: 'Nächste Woche' }).click()
    await page.getByRole('button', { name: 'Plan erstellen' }).click()
    await expect(page.getByText('9. Nov. – 15. Nov.')).toBeVisible()
    const nextWeek = await titles()
    const mainsNext = nextWeek.filter((t) => /Mittagessen|Abendessen/.test(t)).map((t) => t.replace(/^(Mittagessen|Abendessen) /, '').split(' Min.')[0])
    const overlap = mainsNext.filter((t) => thisWeek.some((x) => x.includes(t.slice(0, 25))))
    expect(overlap).toEqual([])
  })

  test('F09-E1 zukünftigen Plan löschen', async ({ page }) => {
    await onboard(page)
    await page.getByRole('link', { name: 'Nächste Woche' }).click()
    await page.getByRole('button', { name: 'Plan erstellen' }).click()
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Plan löschen' }).click()
    await expect(page.getByRole('heading', { name: 'Woche', level: 1 })).toBeVisible()
    await expect(page.getByText('diese Woche')).toBeVisible()
  })
})
