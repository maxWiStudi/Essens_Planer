import { test as base, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// A fixed "now": Wednesday, 4 Nov 2026, 12:00 Berlin time.
export const NOW = new Date('2026-11-04T12:00:00+01:00')
export const WEEK_START = '2026-11-02'

/** Fails the test on console errors, page errors and failed same-origin requests. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = []
    page.on('console', (m) => {
      // GitHub answers 404 for a data file that does not exist yet; that is expected.
      if (m.type() === 'error' && !m.location().url?.startsWith('https://api.github.com/')) problems.push(`console: ${m.text()}`)
    })
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().startsWith('http://localhost:4173/')) problems.push(`${r.status()} ${r.url()}`)
    })
    await page.clock.install({ time: NOW })
    await use(page)
    expect(problems, 'Konsolenfehler oder fehlgeschlagene Requests').toEqual([])
  },
})
export { expect }

/** Accessibility scan (WCAG 2 A/AA) of what is on screen. */
export async function expectAccessible(page, label = '') {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('#toast').analyze()
  const summary = result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target}`)
  expect(summary, `axe ${label}`).toEqual([])
}

/** No horizontal scrolling on the current page. */
export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/**
 * Run the setup. `answers` is called on each step to change defaults.
 * Returns once the week is shown.
 */
export async function onboard(page, answers = {}) {
  await page.goto('./')
  await page.getByRole('link', { name: "Los geht's" }).click()
  for (let step = 1; step <= 7; step++) {
    await expect(page.getByText(`${step} von 7`)).toBeVisible()
    if (answers[step]) await answers[step](page)
    if (step < 7) await page.getByRole('link', { name: 'Weiter' }).click()
  }
  await page.getByRole('button', { name: 'Meinen Plan erstellen' }).click()
  await expect(page.getByRole('heading', { name: 'Woche', level: 1 })).toBeVisible()
}

export const main = (page) => page.locator('main')
export const toast = (page) => page.locator('#toast')
export const sheet = (page) => page.getByRole('dialog')
