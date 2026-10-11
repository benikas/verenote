import { DEFAULT_SETTINGS, TEMPO_MAX, TEMPO_MIN, type Settings } from '../exercise/settings'
import { LEVELS, type LevelId } from '../theory/tasks'

/**
 * Datenformat der gespeicherten Daten (rein, ohne Browser-API).
 * Versioniert: Jede Änderung am Format erhöht DATA_VERSION und bekommt einen Migrationsschritt.
 */
export const DATA_VERSION = 1

/** Wie viele letzte Versuche pro Stufe für die Freischaltung zählen */
export const RECENT_ATTEMPTS = 20
/** Wie viele abgeschlossene Runden im Verlauf bleiben */
export const MAX_ROUNDS = 30
/** Standard-Schwellenwert der Freischaltung (Trefferquote über die letzten Versuche) */
export const DEFAULT_UNLOCK_THRESHOLD = 0.8

/** Einstellungen, wie sie gespeichert werden: Übungs-Einstellungen plus zuletzt Gewähltes */
export interface PersistedSettings extends Settings {
  /** Zuletzt gewählte Stufe */
  level: LevelId
  /** Zuletzt gewählte Rundenlänge */
  length: number
  /** Trefferquote 0–1, ab der die nächste Stufe freigeschaltet wird */
  unlockThreshold: number
}

/** Die erste Stufe ist immer offen */
export const FIRST_LEVEL: LevelId = '1a'

export const ROUND_LENGTHS = [10, 15, 20] as const

export interface ItemStat {
  hits: number
  misses: number
}

export interface RoundRecord {
  /** ISO-Zeitpunkt des Rundenendes */
  at: string
  level: LevelId
  total: number
  correct: number
}

export interface Progress {
  /** Schlüssel wie "E|C" (Zielton E, Referenz C) */
  items: Record<string, ItemStat>
  /** Die letzten Versuche pro Stufe, neueste zuletzt (true = richtig) */
  recent: Partial<Record<LevelId, boolean[]>>
  /** Abgeschlossene Runden, neueste zuletzt */
  rounds: RoundRecord[]
  /** Freigeschaltete Stufen. Einmal freigeschaltet, bleibt eine Stufe offen (auch wenn die Quote sinkt) */
  unlocked: LevelId[]
}

export interface AppData {
  version: number
  settings: PersistedSettings
  progress: Progress
}

export const DEFAULT_PERSISTED_SETTINGS: PersistedSettings = {
  ...DEFAULT_SETTINGS,
  level: '1a',
  length: 15,
  unlockThreshold: DEFAULT_UNLOCK_THRESHOLD,
}

export function emptyProgress(): Progress {
  return { items: {}, recent: {}, rounds: [], unlocked: [FIRST_LEVEL] }
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    settings: { ...DEFAULT_PERSISTED_SETTINGS },
    progress: emptyProgress(),
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isLevel = (v: unknown): v is LevelId => LEVELS.some((l) => l.id === v)

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

function cleanSettings(raw: unknown): PersistedSettings {
  const d = DEFAULT_PERSISTED_SETTINGS
  if (!isObject(raw)) return { ...d }
  return {
    neutralize: typeof raw.neutralize === 'boolean' ? raw.neutralize : d.neutralize,
    neutralLength: raw.neutralLength === 'long' || raw.neutralLength === 'short' ? raw.neutralLength : d.neutralLength,
    tempo: num(raw.tempo, d.tempo, TEMPO_MIN, TEMPO_MAX),
    level: isLevel(raw.level) ? raw.level : d.level,
    length: (ROUND_LENGTHS as readonly number[]).includes(raw.length as number) ? (raw.length as number) : d.length,
    unlockThreshold: num(raw.unlockThreshold, d.unlockThreshold, 0.5, 1),
  }
}

function cleanProgress(raw: unknown): Progress {
  const out = emptyProgress()
  if (!isObject(raw)) return out

  if (isObject(raw.items)) {
    for (const [key, v] of Object.entries(raw.items)) {
      if (isObject(v)) out.items[key] = { hits: count(v.hits), misses: count(v.misses) }
    }
  }
  if (isObject(raw.recent)) {
    for (const l of LEVELS) {
      const list = raw.recent[l.id]
      if (Array.isArray(list)) out.recent[l.id] = list.filter((x): x is boolean => typeof x === 'boolean').slice(-RECENT_ATTEMPTS)
    }
  }
  if (Array.isArray(raw.rounds)) {
    out.rounds = raw.rounds
      .filter(isObject)
      .filter((r) => typeof r.at === 'string' && isLevel(r.level))
      .map((r) => ({
        at: r.at as string,
        level: r.level as LevelId,
        total: count(r.total),
        correct: Math.min(count(r.correct), count(r.total)),
      }))
      .slice(-MAX_ROUNDS)
  }
  if (Array.isArray(raw.unlocked)) {
    const ids = raw.unlocked.filter(isLevel)
    // In der Reihenfolge der Stufen, ohne Doppelte, die erste immer dabei
    out.unlocked = LEVELS.map((l) => l.id).filter((id) => id === FIRST_LEVEL || ids.includes(id))
  }
  return out
}

export type MigrationStatus =
  | 'fresh' // nichts gespeichert
  | 'ok' // aktuelles Format
  | 'migrated' // älteres Format, übernommen
  | 'newer' // von einer neueren App-Version geschrieben: nicht überschreiben
  | 'invalid' // unbrauchbar

export interface Migration {
  data: AppData
  status: MigrationStatus
}

/**
 * Rohdaten (aus IndexedDB oder einer Importdatei) ins aktuelle Format bringen.
 * Fehlende oder kaputte Felder fallen auf Standardwerte zurück.
 */
export function migrate(raw: unknown): Migration {
  if (raw === undefined || raw === null) return { data: emptyData(), status: 'fresh' }
  if (!isObject(raw) || typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 0) {
    return { data: emptyData(), status: 'invalid' }
  }
  if (raw.version > DATA_VERSION) return { data: emptyData(), status: 'newer' }

  // Hier kommen künftig Schritte "von Version n auf n+1" hinzu (while version < DATA_VERSION).
  const data: AppData = {
    version: DATA_VERSION,
    settings: cleanSettings(raw.settings),
    progress: cleanProgress(raw.progress),
  }
  return { data, status: raw.version === DATA_VERSION ? 'ok' : 'migrated' }
}
