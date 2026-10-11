import { DEFAULT_SETTINGS, TEMPO_MAX, TEMPO_MIN, type Settings } from '../exercise/settings'
import { CHROMATIC_SHARPS, STAMMTOENE } from '../theory/notes'
import { LEVELS, type LevelId } from '../theory/tasks'

/**
 * Datenformat der gespeicherten Daten (rein, ohne Browser-API).
 * Versioniert: Jede Änderung am Format erhöht DATA_VERSION und bekommt einen Migrationsschritt.
 */
export const DATA_VERSION = 3

/** Wie viele letzte Versuche pro Stufe für die Freischaltung zählen */
export const RECENT_ATTEMPTS = 20
/** Wie viele abgeschlossene Runden im Verlauf bleiben */
export const MAX_ROUNDS = 30
/** Standard-Schwellenwert für „geschafft“ (Trefferquote über die letzten Versuche) */
export const DEFAULT_DONE_THRESHOLD = 0.8
/** Nach so vielen Runden ohne Export erscheint die Erinnerung */
export const EXPORT_REMINDER_ROUNDS = 5

/** Freies Training: Einstellungen je Übungstyp (Konzept v6) */
export interface FreeSettings {
  /** Zuletzt gewählter Übungstyp */
  type: 'notes' | 'intervals'
  /** Grundtöne: Zieltöne als Pitch Class (Kreuze), in der Reihenfolge C bis B */
  notes: string[]
  /** Grundtöne: Oktaven des Zieltons (3, 4, 5) */
  octaves: number[]
  /** Grundtöne: mit Referenzton C4 (aus = absolutes Hören) */
  reference: boolean
  /** Intervalle: erlaubte Intervalle in Halbtönen, aufsteigend */
  intervals: number[]
  directions: 'up' | 'down' | 'both'
  modes: 'melodic' | 'harmonic' | 'both'
  start: 'fixed' | 'random'
}

export const FREE_OCTAVES = [3, 4, 5] as const

export const DEFAULT_FREE_SETTINGS: FreeSettings = {
  type: 'notes',
  notes: [...STAMMTOENE],
  octaves: [4],
  reference: true,
  intervals: [0, 2, 3, 4, 5, 7, 12],
  directions: 'up',
  modes: 'melodic',
  start: 'fixed',
}

/** Einstellungen, wie sie gespeichert werden: Übungs-Einstellungen plus zuletzt Gewähltes */
export interface PersistedSettings extends Settings {
  /** Zuletzt gewählte Stufe */
  level: LevelId
  /** Zuletzt gewählte Rundenlänge */
  length: number
  /** Trefferquote 0–1, ab der eine Stufe als „geschafft“ gilt */
  doneThreshold: number
  /** Freies Training (ab Version 3) */
  free: FreeSettings
}

export const ROUND_LENGTHS = [10, 15, 20] as const

export interface ItemStat {
  hits: number
  misses: number
}

/** Stufe des Lernpfads oder Freies Training (Grundtöne bzw. Intervalle) */
export type RoundLevel = LevelId | 'free-notes' | 'free-intervals'

export interface RoundRecord {
  /** ISO-Zeitpunkt des Rundenendes */
  at: string
  level: RoundLevel
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
  /** Stufen mit Markierung „geschafft“. Einmal gesetzt, bleibt sie (auch wenn die Quote später sinkt) */
  done: LevelId[]
}

/** Zähler für die Export-Erinnerung (Aufgabe 2.11) */
export interface Backup {
  /** Abgeschlossene Runden seit dem letzten Export (oder seit Beginn) */
  roundsSinceExport: number
  /** Ab diesem Zählerstand erscheint die Erinnerung. Wegklicken schiebt sie nach hinten */
  remindAt: number
}

export interface AppData {
  version: number
  settings: PersistedSettings
  progress: Progress
  backup: Backup
}

export const DEFAULT_PERSISTED_SETTINGS: PersistedSettings = {
  ...DEFAULT_SETTINGS,
  level: '1a',
  length: 15,
  doneThreshold: DEFAULT_DONE_THRESHOLD,
  free: DEFAULT_FREE_SETTINGS,
}

export function emptyProgress(): Progress {
  return { items: {}, recent: {}, rounds: [], done: [] }
}

export function emptyBackup(): Backup {
  return { roundsSinceExport: 0, remindAt: EXPORT_REMINDER_ROUNDS }
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    settings: cleanSettings(undefined),
    progress: emptyProgress(),
    backup: emptyBackup(),
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isLevel = (v: unknown): v is LevelId => LEVELS.some((l) => l.id === v)
const isRoundLevel = (v: unknown): v is RoundLevel => isLevel(v) || v === 'free-notes' || v === 'free-intervals'

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

/** Auswahl aus erlaubten Werten: gültige übernehmen, Reihenfolge der Vorlage, keine Doppelten; leer = Standard. */
function pickAllowed<T>(raw: unknown, allowed: readonly T[], fallback: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [...fallback]
  const picked = allowed.filter((v) => raw.includes(v))
  return picked.length > 0 ? picked : [...fallback]
}

function cleanFree(raw: unknown): FreeSettings {
  const d = DEFAULT_FREE_SETTINGS
  if (!isObject(raw)) return { ...d, notes: [...d.notes], octaves: [...d.octaves], intervals: [...d.intervals] }
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback
  return {
    type: oneOf(raw.type, ['notes', 'intervals'] as const, d.type),
    notes: pickAllowed(raw.notes, CHROMATIC_SHARPS, d.notes),
    octaves: pickAllowed(raw.octaves, FREE_OCTAVES, d.octaves),
    reference: typeof raw.reference === 'boolean' ? raw.reference : d.reference,
    intervals: pickAllowed(raw.intervals, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d.intervals),
    directions: oneOf(raw.directions, ['up', 'down', 'both'] as const, d.directions),
    modes: oneOf(raw.modes, ['melodic', 'harmonic', 'both'] as const, d.modes),
    start: oneOf(raw.start, ['fixed', 'random'] as const, d.start),
  }
}

function cleanSettings(raw: unknown): PersistedSettings {
  const d = DEFAULT_PERSISTED_SETTINGS
  if (!isObject(raw)) return { ...d, free: cleanFree(undefined) }
  return {
    neutralize: typeof raw.neutralize === 'boolean' ? raw.neutralize : d.neutralize,
    neutralLength: raw.neutralLength === 'long' || raw.neutralLength === 'short' ? raw.neutralLength : d.neutralLength,
    tempo: num(raw.tempo, d.tempo, TEMPO_MIN, TEMPO_MAX),
    level: isLevel(raw.level) ? raw.level : d.level,
    length: (ROUND_LENGTHS as readonly number[]).includes(raw.length as number) ? (raw.length as number) : d.length,
    // Version 1 nannte es unlockThreshold
    doneThreshold: num(raw.doneThreshold ?? raw.unlockThreshold, d.doneThreshold, 0.5, 1),
    // Version 3: Freies Training. Ältere Daten haben das Feld nicht und bekommen die Standardwerte.
    free: cleanFree(raw.free),
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
      .filter((r) => typeof r.at === 'string' && isRoundLevel(r.level))
      .map((r) => ({
        at: r.at as string,
        level: r.level as RoundLevel,
        total: count(r.total),
        correct: Math.min(count(r.correct), count(r.total)),
      }))
      .slice(-MAX_ROUNDS)
  }
  if (Array.isArray(raw.done)) {
    const ids = raw.done.filter(isLevel)
    // In der Reihenfolge der Stufen, ohne Doppelte
    out.done = LEVELS.map((l) => l.id).filter((id) => ids.includes(id))
  }
  return out
}

/**
 * Version 1 → 2: Die Freischaltung (`unlocked`) wird zur Markierung „geschafft“.
 * Eine Stufe gilt als geschafft, wenn ihre Folgestufe freigeschaltet war (so ging sie auf)
 * oder wenn ihre letzten Versuche die Schwelle ohnehin erfüllen. Nichts geht verloren:
 * Versuche, Items, Runden und Einstellungen bleiben unverändert.
 */
function doneFromV1(raw: Record<string, unknown>, progress: Progress, threshold: number): LevelId[] {
  const unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.filter(isLevel) : []
  const done = new Set<LevelId>()
  LEVELS.forEach((l, i) => {
    const next = LEVELS[i + 1]
    if (next && unlocked.includes(next.id)) done.add(l.id)
    const recent = progress.recent[l.id] ?? []
    if (recent.length >= RECENT_ATTEMPTS && recent.filter(Boolean).length / recent.length >= threshold) done.add(l.id)
  })
  return LEVELS.map((l) => l.id).filter((id) => done.has(id))
}

function cleanBackup(raw: unknown): Backup {
  const d = emptyBackup()
  if (!isObject(raw)) return d
  const rounds = count(raw.roundsSinceExport)
  const remindAt = typeof raw.remindAt === 'number' && Number.isFinite(raw.remindAt) ? Math.max(1, Math.floor(raw.remindAt)) : d.remindAt
  return { roundsSinceExport: rounds, remindAt }
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

  const settings = cleanSettings(raw.settings)
  const progress = cleanProgress(raw.progress)
  if (raw.version < 2) progress.done = doneFromV1(raw.progress && isObject(raw.progress) ? raw.progress : {}, progress, settings.doneThreshold)
  // Version 2 → 3: Neue Felder (settings.free), neue Stufen 2a–2f, Item-Schlüssel "int:…" und
  // Runden des Freien Trainings. Es ist nichts umzurechnen, alles Bestehende bleibt unverändert.
  // Hier kommen künftig weitere Schritte "von Version n auf n+1" hinzu.
  const data: AppData = {
    version: DATA_VERSION,
    settings,
    progress,
    backup: cleanBackup(raw.backup),
  }
  return { data, status: raw.version === DATA_VERSION ? 'ok' : 'migrated' }
}
