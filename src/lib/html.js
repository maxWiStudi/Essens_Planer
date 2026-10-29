// Tiny templating: html`` escapes every interpolated value unless it is raw().

const RAW = Symbol('raw')

export function raw(str) {
  return { [RAW]: true, value: String(str) }
}

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function render(value) {
  if (value == null || value === false) return ''
  if (Array.isArray(value)) return value.map(render).join('')
  if (typeof value === 'object' && value[RAW]) return value.value
  return escape(value)
}

export function html(strings, ...values) {
  let out = strings[0]
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1]
  })
  return raw(out)
}

export function toString(fragment) {
  return render(fragment)
}

/** "true"/"false" for ARIA state attributes (a plain false would render as an empty string). */
export const ariaBool = (value) => (value ? 'true' : 'false')
