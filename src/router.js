// Hash routes work on GitHub Pages without server rewrites: #/woche/2026-11-02/abend?x=1

export function parseHash(hash = location.hash) {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  return { parts, query: Object.fromEntries(new URLSearchParams(query)) }
}

export function go(path) {
  if (location.hash === `#${path}`) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else location.hash = path
}
