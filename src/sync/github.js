// Minimal client for the official GitHub REST API (contents endpoint).
// The token is a fine-grained personal access token limited to one private
// repository with "Contents: Read and write". It never leaves this device
// except in the Authorization header to api.github.com.

const API = 'https://api.github.com'

export class GitHubError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

const enc = (path) => path.split('/').map(encodeURIComponent).join('/')

function toBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

async function request(url, token, init = {}) {
  let res
  try {
    res = await fetch(url, { ...init, headers: { ...headers(token), ...init.headers }, cache: 'no-store' })
  } catch {
    throw new GitHubError('Keine Verbindung zu GitHub (offline?)', 0)
  }
  if (res.ok) return res
  const messages = {
    401: 'Token ungültig oder abgelaufen',
    403: 'Keine Berechtigung – der Token braucht „Contents: Read and write“ für dieses Repo',
    404: 'Repo oder Datei nicht gefunden – Name prüfen und ob der Token Zugriff auf dieses Repo hat',
    409: 'Konflikt – die Datei wurde zwischendurch geändert',
    422: 'GitHub hat die Änderung abgelehnt (Version veraltet)',
  }
  throw new GitHubError(messages[res.status] ?? `GitHub-Fehler ${res.status}`, res.status)
}

/** Check token and repo. Returns { private, canWrite }. */
export async function checkRepo({ owner, repo }, token) {
  const res = await request(`${API}/repos/${enc(owner)}/${enc(repo)}`, token)
  const data = await res.json()
  return { private: !!data.private, canWrite: !!data.permissions?.push, defaultBranch: data.default_branch }
}

/** The data file, or null if it does not exist yet. */
export async function readFile({ owner, repo, path, branch }, token) {
  try {
    const res = await request(`${API}/repos/${enc(owner)}/${enc(repo)}/contents/${enc(path)}?ref=${encodeURIComponent(branch)}`, token)
    const data = await res.json()
    if (data.encoding !== 'base64') throw new GitHubError('Die Datei ist größer als 1 MB – bitte alte Wochen löschen.', 413)
    return { sha: data.sha, json: JSON.parse(fromBase64(data.content)) }
  } catch (e) {
    if (e.status === 404) {
      // Distinguish "file missing" (fine, first sync) from "repo missing".
      await checkRepo({ owner, repo }, token)
      return null
    }
    throw e
  }
}

/** Create or update the data file. Each call is one commit. Returns the new sha. */
export async function writeFile({ owner, repo, path, branch }, token, json, sha, message) {
  const body = { message, content: toBase64(JSON.stringify(json, null, 1)), branch }
  if (sha) body.sha = sha
  const res = await request(`${API}/repos/${enc(owner)}/${enc(repo)}/contents/${enc(path)}`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return (await res.json()).content.sha
}
