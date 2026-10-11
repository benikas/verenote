import { migrate, type AppData } from './schema'

/** Export/Import als JSON-Datei (rein, ohne Browser-API). */

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export type ImportResult = { ok: true; data: AppData } | { ok: false; error: string }

/** Importtext prüfen und ins aktuelle Format bringen. Fehler als Text für die Anzeige. */
export function parseImport(text: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' }
  }
  const { data, status } = migrate(raw)
  if (status === 'fresh' || status === 'invalid') {
    return { ok: false, error: 'Die Datei enthält keine Daten dieser App.' }
  }
  if (status === 'newer') {
    return { ok: false, error: 'Die Datei stammt aus einer neueren Version der App. Bitte die App aktualisieren.' }
  }
  return { ok: true, data }
}

/** Dateiname für den Export, z. B. gehoertraining-2026-10-11.json */
export function exportFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `gehoertraining-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}
