import { html } from '../lib/html.js'

// S01: first launch.
export default {
  title: 'Willkommen',
  render: () => html`
    <section class="flex min-h-[70dvh] flex-col justify-center py-8">
      <img src="${import.meta.env.BASE_URL}icons/icon.svg" alt="" class="mb-6 size-16 rounded-2xl" />
      <h1 class="text-3xl font-bold tracking-tight">Jede Woche ein Plan,<br />der nicht langweilig wird.</h1>
      <p class="mt-4 max-w-md text-muted">
        Ein paar Fragen, dann stellt dir die App eine abwechslungsreiche, ausgewogene Woche zusammen –
        mit Rezepten und Einkaufsliste. Du kannst jedes Gericht tauschen oder fixieren.
      </p>
      <ul class="mt-6 space-y-2 text-sm">
        <li>✓ Kein Konto, kein Abo – alles bleibt auf deinem Gerät</li>
        <li>✓ Funktioniert offline</li>
        <li>✓ Fisch, Hülsenfrüchte und Gemüse in sinnvollem Maß</li>
      </ul>
      <a href="#/einrichtung/1" class="btn-primary mt-8 self-start px-6 py-3 text-base">Los geht's</a>
    </section>`,
}
