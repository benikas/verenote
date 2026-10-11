import { DEFAULT_PERSISTED_SETTINGS, DATA_VERSION, emptyProgress, type AppData, type PersistedSettings, type Progress } from '../storage/schema'
import { idbStore, loadData, saveData, type Loaded, type KeyValueStore } from '../storage/store'

/**
 * Gemeinsamer, reaktiver Zustand: Einstellungen und Fortschritt.
 * Wird beim Start aus IndexedDB geladen und bei Änderungen gespeichert.
 */
export const settings: PersistedSettings = $state({ ...DEFAULT_PERSISTED_SETTINGS })
export const progress: Progress = $state(emptyProgress())

export const storageState = $state({
  ready: false,
  /** Wird gespeichert? Nein, wenn IndexedDB fehlt oder die Daten von einer neueren Version stammen */
  writable: true,
  status: 'fresh' as Loaded['status'],
})

let store: KeyValueStore = idbStore
let timer: ReturnType<typeof setTimeout> | undefined

/** Einen Datenstand in den reaktiven Zustand übernehmen (Start, Import, Zurücksetzen). */
export function applyData(data: AppData): void {
  Object.assign(settings, data.settings)
  const p = data.progress
  progress.items = p.items
  progress.recent = p.recent
  progress.rounds = p.rounds
  progress.unlocked = p.unlocked
}

export function snapshot(): AppData {
  return $state.snapshot({ version: DATA_VERSION, settings, progress }) as AppData
}

export async function initData(useStore: KeyValueStore = idbStore): Promise<void> {
  store = useStore
  const loaded = await loadData(store)
  applyData(loaded.data)
  storageState.status = loaded.status
  storageState.writable = loaded.writable
  storageState.ready = true
}

/** Sofort speichern (z. B. nach jeder Antwort). Gibt zurück, ob es geklappt hat. */
export async function persistNow(): Promise<boolean> {
  clearTimeout(timer)
  if (!storageState.writable) return false
  return saveData(store, snapshot())
}

/** Gebündelt speichern (z. B. beim Verschieben des Tempo-Reglers). */
export function persistSoon(delay = 400): void {
  clearTimeout(timer)
  timer = setTimeout(() => void persistNow(), delay)
}
