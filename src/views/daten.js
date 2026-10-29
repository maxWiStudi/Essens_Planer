import { html } from '../lib/html.js'
import * as db from '../db.js'
import { state, saveSettings, reloadFromDb } from '../store.js'
import { pageHeader } from '../ui/components.js'
import { icon } from '../ui/icons.js'
import { toast } from '../ui/toast.js'
import { checkRepo } from '../sync/github.js'
import { status as syncStatus, syncNow, isEnabled } from '../sync/index.js'
import { toISO } from '../lib/dates.js'

let hasToken = false
let persisted = null
let busy = false

const when = (iso) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : 'noch nie')

function syncCard() {
  const s = state.settings.sync
  const on = isEnabled()
  const statusLine = syncStatus.running
    ? 'Synchronisiere …'
    : syncStatus.error
      ? html`<span class="text-warn">Fehler: ${syncStatus.error}</span>`
      : `Zuletzt: ${when(syncStatus.lastAt)}${syncStatus.pending ? ' · Änderungen warten' : ''}`
  return html`
    <section class="card p-4" aria-labelledby="sync-h">
      <h2 id="sync-h" class="h2 flex items-center gap-2">${icon('cloud', 'size-5 text-primary')} Sync mit GitHub</h2>
      <p class="mt-1 text-sm text-muted">
        Speichert alles als Datei in deinem <strong>privaten</strong> GitHub-Repo. Jede Speicherung ist ein Commit – so hast du eine
        Versionsgeschichte und dieselben Daten auf Handy und Laptop.
      </p>
      ${on ? html`<p class="mt-3 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">Aktiv: ${s.owner}/${s.repo} → ${s.path}</p>` : ''}
      <p class="mt-2 text-sm">${statusLine}</p>

      <form class="mt-4 grid gap-3" data-form="sync" autocomplete="off">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="gh-owner">GitHub-Name</label>
            <input id="gh-owner" name="owner" class="field" value="${s.owner}" placeholder="dein-name" required autocapitalize="off" spellcheck="false" /></div>
          <div><label class="label" for="gh-repo">Privates Repo</label>
            <input id="gh-repo" name="repo" class="field" value="${s.repo}" placeholder="essens-planer-daten" required autocapitalize="off" spellcheck="false" /></div>
        </div>
        <div><label class="label" for="gh-token">Zugangs-Token ${hasToken ? html`<span class="font-normal text-muted">(gespeichert – leer lassen zum Behalten)</span>` : ''}</label>
          <input id="gh-token" name="token" type="password" class="field font-mono" placeholder="github_pat_…" autocapitalize="off" spellcheck="false" /></div>
        <details class="text-sm">
          <summary class="cursor-pointer font-medium text-primary">So richtest du das ein (3 Minuten)</summary>
          <ol class="mt-2 list-decimal space-y-1 pl-5 text-muted">
            <li>Auf github.com ein neues Repo anlegen, z. B. <code>essens-planer-daten</code>, Sichtbarkeit <strong>Private</strong>.</li>
            <li>Settings → Developer settings → Personal access tokens → <strong>Fine-grained tokens</strong> → Generate new token.</li>
            <li>Repository access: <strong>Only select repositories</strong> → nur das Daten-Repo.</li>
            <li>Permissions → Repository → <strong>Contents: Read and write</strong>. Ablaufdatum z. B. 1 Jahr.</li>
            <li>Token hier einfügen. Er bleibt nur auf diesem Gerät und wird nie exportiert.</li>
          </ol>
        </details>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="btn-primary" ${busy ? 'disabled' : ''}>${on ? 'Speichern & testen' : 'Verbinden'}</button>
          ${on ? html`
            <button type="button" class="btn-secondary" data-action="sync-now" ${syncStatus.running ? 'disabled' : ''}>${icon('refresh', 'size-4')} Jetzt synchronisieren</button>
            <button type="button" class="btn-ghost text-muted" data-action="sync-off">Ausschalten</button>` : ''}
        </div>
      </form>
    </section>`
}

// S20: data, backup and sync.
export default {
  title: 'Daten',
  async render() {
    hasToken = !!(await db.getSecret('githubToken'))
    persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null
    const lastExport = await db.getMeta('lastExport')
    return html`
      ${pageHeader('Daten & Sicherung', { back: '#/du', sub: `${state.weeks.size} Wochen · ${Object.keys(state.stats).length} Rezept-Markierungen` })}
      <div class="space-y-4">
        <section class="card p-4" aria-labelledby="speicher-h">
          <h2 id="speicher-h" class="h2">Speicher auf diesem Gerät</h2>
          <p class="mt-1 text-sm text-muted">
            ${persisted
              ? 'Der Browser hat zugesagt, die Daten nicht automatisch zu löschen.'
              : 'Der Browser darf die Daten bei Platzmangel löschen. Auf dem iPhone hilft „Zum Home-Bildschirm“ – und eine Sicherung.'}
          </p>
          ${persisted ? '' : html`<button type="button" class="btn-secondary mt-3" data-action="persist">Dauerhaft speichern anfragen</button>`}
        </section>

        ${syncCard()}

        <section class="card p-4" aria-labelledby="backup-h">
          <h2 id="backup-h" class="h2">Sicherung als Datei</h2>
          <p class="mt-1 text-sm text-muted">Letzter Export: ${when(lastExport)}. Die Datei enthält Pläne, Einstellungen und Markierungen – keine Tokens.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn-secondary" data-action="export">${icon('download', 'size-4')} Exportieren</button>
            <label class="btn-secondary">
              ${icon('upload', 'size-4')} Importieren
              <input type="file" accept="application/json,.json" class="sr-only" data-input="import" />
            </label>
          </div>
        </section>

        <section class="card border-warn/40 p-4" aria-labelledby="del-h">
          <h2 id="del-h" class="h2">Alles löschen</h2>
          <p class="mt-1 text-sm text-muted">Entfernt alle Daten auf diesem Gerät. Die Datei auf GitHub bleibt erhalten.</p>
          <button type="button" class="btn-ghost mt-2 text-warn" data-action="wipe">${icon('trash', 'size-4')} Daten löschen</button>
        </section>
      </div>`
  },
  actions: {
    persist: async (_, __, rerender) => {
      const ok = await db.requestPersistence()
      toast(ok ? 'Daten werden dauerhaft gespeichert' : 'Der Browser hat abgelehnt – bitte Sicherung nutzen')
      rerender()
    },
    export: async () => {
      const data = await db.exportData()
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `essens-planer-${toISO(new Date())}.json` })
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      await db.putMeta('lastExport', new Date().toISOString())
      toast('Sicherung heruntergeladen')
    },
    'sync-now': (_, __, rerender) => { syncNow().then(rerender); rerender() },
    'sync-off': async () => {
      await saveSettings({ sync: { ...state.settings.sync, enabled: false } })
      toast('Sync ausgeschaltet – der Token bleibt gespeichert')
    },
    wipe: async () => {
      if (!confirm('Wirklich alle Daten auf diesem Gerät löschen?')) return
      await db.clearAll()
      await db.ensureDeviceId()
      await reloadFromDb({ silent: true })
      location.hash = '#/start'
    },
  },
  inputs: {
    import: async (el) => {
      const file = el.files?.[0]
      if (!file) return
      try {
        const data = JSON.parse(await file.text())
        db.migrate(data) // reject foreign or too-new files before asking anything
        if (!confirm('Import ersetzt alle aktuellen Daten auf diesem Gerät. Fortfahren?')) return
        await db.importData(data)
        await reloadFromDb()
        toast('Import abgeschlossen')
      } catch (e) {
        toast(e instanceof SyntaxError ? 'Die Datei ist kein gültiges JSON.' : e.message)
      } finally {
        el.value = ''
      }
    },
  },
  forms: {
    sync: async (form, rerender) => {
      const fd = new FormData(form)
      const owner = String(fd.get('owner')).trim()
      const repo = String(fd.get('repo')).trim()
      const newToken = String(fd.get('token')).trim()
      const token = newToken || (await db.getSecret('githubToken'))
      if (!owner || !repo || !token) return toast('Bitte Name, Repo und Token angeben')
      busy = true
      rerender()
      try {
        const info = await checkRepo({ owner, repo }, token)
        if (!info.private) throw new Error('Das Repo ist öffentlich. Bitte ein privates Repo verwenden – deine Daten wären sonst für alle sichtbar.')
        if (!info.canWrite) throw new Error('Der Token darf nicht schreiben – „Contents: Read and write“ aktivieren.')
        if (newToken) await db.putSecret('githubToken', newToken)
        await saveSettings({ sync: { ...state.settings.sync, owner, repo, branch: info.defaultBranch || 'main', enabled: true } })
        toast('Verbunden – synchronisiere …')
        await syncNow()
      } catch (e) {
        toast(e.message)
      } finally {
        busy = false
        rerender()
      }
    },
  },
}
