import { markExported } from '../storage/backup'
import { exportFileName, exportJson } from '../storage/transfer'
import { backup, persistNow, snapshot } from './data.svelte'

export type ExportResult = { ok: true; fileName: string } | { ok: false; cancelled: boolean }

/**
 * Fortschritt als JSON-Datei sichern: auf dem Handy über den Teilen-Dialog („In Dateien sichern“),
 * sonst als Download. Bei Erfolg wird der Zähler der Export-Erinnerung zurückgesetzt.
 */
export async function exportProgress(): Promise<ExportResult> {
  const file = new File([exportJson(snapshot())], exportFileName(), { type: 'application/json' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Gehörtraining Fortschritt' })
    } else {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }
  } catch (e) {
    return { ok: false, cancelled: e instanceof DOMException && e.name === 'AbortError' }
  }
  markExported(backup)
  await persistNow()
  return { ok: true, fileName: file.name }
}
