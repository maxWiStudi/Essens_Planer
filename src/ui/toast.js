import { html, toString } from '../lib/html.js'

let timer

/** Short message at the bottom. Optional action button (e.g. "Rückgängig"). */
export function toast(message, action = null) {
  const el = document.getElementById('toast')
  clearTimeout(timer)
  el.innerHTML = toString(html`
    <div class="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg shadow-lg" role="status">
      <span class="flex-1">${message}</span>
      ${action ? html`<button type="button" class="font-semibold underline" data-toast-action>${action.label}</button>` : ''}
    </div>`)
  el.querySelector('[data-toast-action]')?.addEventListener('click', () => {
    action.run()
    el.innerHTML = ''
  })
  timer = setTimeout(() => (el.innerHTML = ''), action ? 6000 : 3000)
}
