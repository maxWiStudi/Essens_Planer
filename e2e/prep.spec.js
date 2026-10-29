import { test, expect, onboard, expectAccessible, expectNoHorizontalScroll, main, sheet } from './helpers.js'

const chooseReste = (p) => p.getByRole('button', { name: /Reste vom Vorabend/ }).click()

test.describe('PREP Reste und Meal Prep', () => {
  test('PREP-H1 Reste-Modus: Kochtag und Reste-Tag sind verknüpft', async ({ page }) => {
    await onboard(page, { 5: chooseReste })
    await expect(page.getByText(/kochen für 21 Mahlzeiten/)).toBeVisible()
    const restChips = main(page).getByText(/Rest von .+ Abendessen/)
    await expect(restChips).toHaveCount(3)
    await expect(main(page).getByText('für 2 Mahlzeiten kochen')).toHaveCount(3)
    await expectAccessible(page, 'Woche mit Resten')

    // Leftover page: banner, link back, recipe collapsed.
    await main(page).getByRole('link').filter({ has: page.getByText(/Rest von/) }).first().click()
    await expect(page.getByText(/Reste\s+vom Abendessen am/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Zutaten' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Fixieren' })).toHaveCount(0)
    await expectAccessible(page, 'Reste-Seite')
    await page.getByRole('link', { name: 'Zum Kochtag' }).click()
    await expect(page.getByText(/Gleich mehr kochen:/)).toBeVisible()
    await expect(page.getByText(/Portionen – inklusive Reste/)).toBeVisible()
    await expect(page.getByText('Für 2 Portionen – inklusive Reste')).toBeVisible()
  })

  test('PREP-H2 Meal Prep fürs Mittagessen, 3 pro Gericht', async ({ page }) => {
    await onboard(page, {
      5: async (p) => {
        await p.getByRole('button', { name: /Meal Prep/ }).click()
        await p.getByRole('combobox', { name: 'Ein Gericht reicht für' }).selectOption('3')
        await expectAccessible(p, 'Vorkochen-Schritt')
        await expectNoHorizontalScroll(p)
      },
    })
    await expect(main(page).getByText('für 3 Mahlzeiten kochen')).toHaveCount(2)
    await expect(main(page).getByText(/Rest von .+ Mittagessen/)).toHaveCount(4)
    await expect(page.getByText(/17× kochen für 21 Mahlzeiten/)).toBeVisible()
  })

  test('PREP-E1 Kochtag tauschen nimmt die Reste mit', async ({ page }) => {
    await onboard(page, { 5: chooseReste })
    const cook = main(page).getByRole('link').filter({ has: page.getByText('für 2 Mahlzeiten kochen') }).first()
    const href = await cook.getAttribute('href')
    await cook.click()
    await page.getByRole('button', { name: 'Tauschen' }).click()
    await expect(sheet(page).getByText(/Die Reste \(1×\) wechseln mit/)).toBeVisible()
    const pick = sheet(page).getByRole('button').filter({ hasText: /Min\./ }).first()
    const title = (await pick.locator('span').first().textContent()).trim()
    await pick.click()
    await page.goto('./#/woche')
    const rows = main(page).getByRole('link').filter({ hasText: title })
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('Rest von')
    expect(href).toBeTruthy()
  })

  test('PREP-E2 Reste frisch kochen löst die Verknüpfung', async ({ page }) => {
    await onboard(page, { 5: chooseReste })
    await main(page).getByRole('link').filter({ has: page.getByText(/Rest von/) }).first().click()
    await page.getByRole('button', { name: 'Frisch kochen' }).click()
    await expect(sheet(page).getByText(/Statt der Reste etwas frisch kochen/)).toBeVisible()
    await sheet(page).getByRole('button').filter({ hasText: /Min\./ }).first().click()
    await expect(page.getByText(/Reste\s+vom Abendessen/)).toHaveCount(0)
    await page.goto('./#/woche')
    await expect(main(page).getByText(/Rest von/)).toHaveCount(2)
  })

  test('PREP-E3 Kochtag auswärts: Reste werden frisch gekocht', async ({ page }) => {
    await onboard(page, { 5: chooseReste })
    await main(page).getByRole('link').filter({ has: page.getByText('für 2 Mahlzeiten kochen') }).first().click()
    await page.getByRole('button', { name: 'Auswärts essen' }).click()
    await expect(page.locator('#toast')).toContainText('frisch gekocht')
    await page.goto('./#/woche')
    await expect(main(page).getByText(/Rest von/)).toHaveCount(2)
  })

  test('PREP-E4 Kochtag fixieren, neu planen: Reste bleiben dran', async ({ page }) => {
    await onboard(page, { 5: chooseReste })
    const cookRow = main(page).locator('.card').filter({ hasText: 'für 2 Mahlzeiten kochen' }).first()
    const title = (await cookRow.getByRole('link').locator('span').nth(1).textContent()).trim()
    await cookRow.getByRole('button', { name: 'Fixieren' }).click()
    await page.getByRole('button', { name: 'Neu planen' }).click()
    await expect(main(page).getByRole('link').filter({ hasText: title })).toHaveCount(2)
  })

  test('PREP-E5 Heute zeigt „Reste aufwärmen“', async ({ page }) => {
    // Wed 12:00 → next meal is lunch; with leftovers on Tue–Thu the Wed lunch is a leftover.
    await onboard(page, { 5: chooseReste })
    await page.goto('./#/heute')
    await expect(page.getByText(/Mittagessen · Reste aufwärmen/)).toBeVisible()
  })
})
