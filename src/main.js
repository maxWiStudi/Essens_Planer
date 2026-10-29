import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { html, toString } from './lib/html.js'
import { state, load, subscribe } from './store.js'
import { parseHash, go } from './router.js'
import { requestPersistence, getMeta, putMeta } from './db.js'
import { icon } from './ui/icons.js'
import { toast } from './ui/toast.js'
import { initSync } from './sync/index.js'

import start from './views/start.js'
import einrichtung from './views/einrichtung.js'
import heute from './views/heute.js'
import woche from './views/woche.js'
import rezept from './views/rezept.js'
import liste from './views/liste.js'
import rezepte from './views/rezepte.js'
import du from './views/du.js'
import daten from './views/daten.js'

const TABS = [
  ['heute', 'Heute', '#/heute'],
  ['woche', 'Woche', '#/woche'],
  ['liste', 'Liste', '#/liste'],
  ['rezepte', 'Rezepte', '#/rezepte'],
  ['du', 'Du', '#/du'],
]

function resolve({ parts }) {
  const [first] = parts
  if (!state.settings.onboarded && first !== 'einrichtung') return { view: start, tab: null }
  switch (first) {
    case 'start': return { view: start, tab: null }
    case 'einrichtung': return { view: einrichtung, tab: null }
    case 'woche': return { view: parts.length >= 3 ? rezept : woche, tab: 'woche' }
    case 'liste': return { view: liste, tab: 'liste' }
    case 'rezepte': return { view: parts.length >= 2 ? rezept : rezepte, tab: 'rezepte' }
    case 'du': return { view: du, tab: 'du' }
    case 'daten': return { view: daten, tab: 'du' }
    case 'heute': return { view: heute, tab: 'heute' }
    default: return null
  }
}

// ---------- shell ----------

const app = document.getElementById('app')
app.innerHTML = toString(html`
  <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2">Zum Inhalt</a>
  <div id="banner"></div>
  <main id="main" tabindex="-1" class="mx-auto w-full max-w-xl px-4 pb-[calc(var(--spacing-tabbar)+2rem+env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] outline-none"></main>
  <nav id="tabbar" aria-label="Hauptnavigation"
       class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"></nav>
  <div id="toast" class="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+1rem+env(safe-area-inset-bottom))] z-50 px-4"></div>
  <div id="sheet"></div>`)

const main = document.getElementById('main')
const tabbar = document.getElementById('tabbar')
let current = null
let renderId = 0

function renderTabs(active) {
  tabbar.hidden = !active
  tabbar.innerHTML = toString(html`
    <ul class="mx-auto flex h-[var(--spacing-tabbar)] max-w-xl">
      ${TABS.map(([id, label, href]) => html`
        <li class="flex-1">
          <a href="${href}" aria-current="${id === active ? 'page' : 'false'}"
             class="flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${id === active ? 'text-primary' : 'text-muted'}">
            ${icon(id, 'size-6')}${label}
          </a>
        </li>`)}
    </ul>`)
}

/** Render the current route. Keeps focus and scroll when re-rendering the same page. */
async function render({ routeChanged = false } = {}) {
  if (!state.ready) return
  const route = parseHash()
  const resolved = resolve(route)
  if (!resolved) return go('/heute')
  const id = ++renderId
  const focusedId = document.activeElement?.id
  const selection = focusedId && 'selectionStart' in document.activeElement
    ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null
  const scroll = window.scrollY

  let content
  try {
    content = await resolved.view.render(route)
  } catch (e) {
    console.error(e)
    content = html`<div class="card p-5"><p class="h2">Da ist etwas schiefgegangen.</p><p class="mt-2 text-sm text-muted">${e.message}</p></div>`
  }
  if (id !== renderId) return // a newer render started meanwhile
  current = { ...resolved, route }
  main.innerHTML = toString(content)
  renderTabs(resolved.tab)
  document.title = `${resolved.view.title} · Essens Planer`

  if (routeChanged) {
    window.scrollTo(0, 0)
    main.focus({ preventScroll: true })
  } else {
    window.scrollTo(0, scroll)
    const el = focusedId && document.getElementById(focusedId)
    if (el) {
      el.focus({ preventScroll: true })
      if (selection) try { el.setSelectionRange(...selection) } catch { /* not a text field */ }
    }
  }
}

const rerender = () => render()

// ---------- events (delegated) ----------

main.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]')
  const handler = el && current?.view.actions?.[el.dataset.action]
  if (!handler) return
  e.preventDefault()
  try {
    await handler(el, e, rerender)
  } catch (err) {
    console.error(err)
    toast(err.message || 'Fehler')
  }
})

async function onInput(e) {
  const el = e.target.closest('[data-input]')
  const handler = el && current?.view.inputs?.[el.dataset.input]
  if (!handler) return
  // Live inputs (search) react to every keystroke, the rest on change.
  if ((e.type === 'input') !== ('live' in el.dataset)) return
  try {
    await handler(el, rerender)
  } catch (err) {
    console.error(err)
    toast(err.message || 'Fehler')
  }
}
main.addEventListener('input', onInput)
main.addEventListener('change', onInput)

main.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]')
  if (!form) return
  e.preventDefault()
  await current?.view.forms?.[form.dataset.form]?.(form, rerender)
})

window.addEventListener('hashchange', () => render({ routeChanged: true }))
subscribe(() => render())

// ---------- install hint (iOS has no install prompt) ----------

async function installHint() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
  if (!ios || standalone || (await getMeta('installHintSeen'))) return
  const banner = document.getElementById('banner')
  banner.innerHTML = toString(html`
    <div class="mx-auto mt-3 flex max-w-xl items-start gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm">
      ${icon('share', 'size-5 shrink-0 text-primary')}
      <p class="flex-1">Für die App-Version und damit iOS deine Daten nicht löscht: unten auf <strong>Teilen</strong> tippen und <strong>„Zum Home-Bildschirm“</strong> wählen.</p>
      <button type="button" class="font-semibold" data-dismiss>OK</button>
    </div>`)
  banner.querySelector('[data-dismiss]').addEventListener('click', async () => {
    banner.innerHTML = ''
    await putMeta('installHintSeen', true)
  })
}

// ---------- service worker updates ----------

const updateSW = registerSW({
  onNeedRefresh() {
    toast('Neue Version verfügbar', { label: 'Aktualisieren', run: () => updateSW(true) })
  },
  onOfflineReady() {
    toast('Bereit für die Nutzung ohne Internet')
  },
})

// ---------- start ----------

;(async () => {
  try {
    await load()
  } catch (e) {
    main.innerHTML = toString(html`<div class="card p-5"><p class="h2">Speicher nicht verfügbar</p>
      <p class="mt-2 text-sm text-muted">Der Browser erlaubt keinen lokalen Speicher (privater Modus?). ${e.message}</p></div>`)
    return
  }
  if (!location.hash) history.replaceState(null, '', state.settings.onboarded ? '#/heute' : '#/start')
  await render({ routeChanged: true })
  requestPersistence().then((ok) => (state.persistent = ok))
  installHint()
  initSync()
})()
