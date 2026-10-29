import { toString } from '../lib/html.js'

// A bottom sheet (dialog) with its own action handlers.
let current = null

export function openSheet({ title, body, actions = {} }) {
  closeSheet()
  const root = document.getElementById('sheet')
  root.innerHTML = `
    <div class="fixed inset-0 z-40 bg-black/40" data-sheet-close></div>
    <div class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
         role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="mb-4 flex items-start justify-between gap-4">
        <h2 id="sheet-title" class="h2">${toString(title)}</h2>
        <button type="button" class="btn-ghost -mr-2 -mt-1 px-3" data-sheet-close aria-label="Schließen">✕</button>
      </div>
      <div data-sheet-body>${toString(body)}</div>
    </div>`
  const onClick = (e) => {
    if (e.target.closest('[data-sheet-close]')) return closeSheet()
    const el = e.target.closest('[data-action]')
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el, e)
  }
  const onKey = (e) => e.key === 'Escape' && closeSheet()
  root.addEventListener('click', onClick)
  document.addEventListener('keydown', onKey)
  current = { root, onClick, onKey, opener: document.activeElement }
  root.querySelector('[role=dialog] button, [role=dialog] input')?.focus()
}

export function closeSheet() {
  if (!current) return
  current.root.removeEventListener('click', current.onClick)
  document.removeEventListener('keydown', current.onKey)
  current.root.innerHTML = ''
  current.opener?.focus?.()
  current = null
}
