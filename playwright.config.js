import { defineConfig, devices } from '@playwright/test'

// E2E tests run against the production build (with service worker), served
// under the same sub-path as on GitHub Pages. Uses the installed Edge, or
// Chromium when PW_CHANNEL is empty (CI).
const channel = process.env.PW_CHANNEL ?? 'msedge'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/Essens_Planer/',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobil', use: { ...devices['Pixel 7'], channel: channel || undefined } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, channel: channel || undefined } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Essens_Planer/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
