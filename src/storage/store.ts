import { del, get, set } from 'idb-keyval'
import { emptyData, migrate, type AppData, type MigrationStatus } from './schema'

/** Schlüssel-Wert-Speicher. Die App nutzt IndexedDB, die Tests einen Speicher im RAM. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
}

export const DATA_KEY = 'gehoertraining-data'

export const idbStore: KeyValueStore = {
  get: (key) => get(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
}

export function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial))
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => void map.set(key, structuredClone(value)),
    del: async (key) => void map.delete(key),
  }
}

export interface Loaded {
  data: AppData
  status: MigrationStatus | 'unavailable'
  /** Darf gespeichert werden? Nein, wenn die Daten von einer neueren Version stammen oder der Speicher fehlt */
  writable: boolean
}

/** Gespeicherte Daten lesen. Nie ein Fehler nach außen: im Notfall startet die App leer. */
export async function loadData(store: KeyValueStore): Promise<Loaded> {
  let raw: unknown
  try {
    raw = await store.get(DATA_KEY)
  } catch {
    return { data: emptyData(), status: 'unavailable', writable: false }
  }
  const { data, status } = migrate(raw)
  // Kaputte Daten werden überschrieben, Daten einer neueren Version nicht
  return { data, status, writable: status !== 'newer' }
}

export async function saveData(store: KeyValueStore, data: AppData): Promise<boolean> {
  try {
    await store.set(DATA_KEY, data)
    return true
  } catch {
    return false
  }
}

export async function clearData(store: KeyValueStore): Promise<boolean> {
  try {
    await store.del(DATA_KEY)
    return true
  } catch {
    return false
  }
}
