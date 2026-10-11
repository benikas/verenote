import { Note } from 'tonal'
import type { Direction, IntervalMode, LevelId } from './tasks'

/**
 * Intervalle als reine Daten (Stufe 2): Startton, zweiter Ton, Richtung, melodisch oder
 * harmonisch. Der Startton ist die Referenz, es gibt keinen separaten Referenzton.
 */

export interface IntervalInfo {
  /** Abstand in Halbtönen, 0 (Prime) bis 12 (Oktave) */
  semitones: number
  /** Deutscher Name */
  name: string
}

export const INTERVALS: readonly IntervalInfo[] = [
  { semitones: 0, name: 'Prime' },
  { semitones: 1, name: 'Kleine Sekunde' },
  { semitones: 2, name: 'Grosse Sekunde' },
  { semitones: 3, name: 'Kleine Terz' },
  { semitones: 4, name: 'Grosse Terz' },
  { semitones: 5, name: 'Quarte' },
  { semitones: 6, name: 'Tritonus' },
  { semitones: 7, name: 'Quinte' },
  { semitones: 8, name: 'Kleine Sexte' },
  { semitones: 9, name: 'Grosse Sexte' },
  { semitones: 10, name: 'Kleine Septime' },
  { semitones: 11, name: 'Grosse Septime' },
  { semitones: 12, name: 'Oktave' },
]

export function intervalName(semitones: number): string {
  const info = INTERVALS.find((i) => i.semitones === semitones)
  if (!info) throw new Error(`Unbekanntes Intervall: ${semitones} Halbtöne`)
  return info.name
}

/** Fester Startton */
export const FIXED_START = 'C4'
/** Zufälliger Startton: C3 bis C5 (MIDI 48–72). Beide Töne bleiben so zwischen C2 und C6. */
export const START_LOW = 48
export const START_HIGH = 72
/** Spielbarer Tonraum der Samples: C2 bis C6 */
export const PLAY_LOW = 36
export const PLAY_HIGH = 84

export interface IntervalTask {
  kind: 'intervals'
  /** Laufende Nummer innerhalb der Session, ab 1 */
  id: number
  /** Stufe des Lernpfads; null im Freien Training */
  level: LevelId | null
  /** Startton mit Oktave, z. B. "C4" */
  start: string
  /** Zweiter Ton mit Oktave */
  second: string
  semitones: number
  /** Bei harmonischen Intervallen und der Prime immer 'up' */
  direction: Direction
  mode: IntervalMode
}

/** Aufgabe bauen. startMidi: MIDI-Nummer des Starttons. */
export function makeIntervalTask(
  id: number,
  level: LevelId | null,
  semitones: number,
  direction: Direction,
  mode: IntervalMode,
  startMidi: number,
): IntervalTask {
  if (!Number.isInteger(semitones) || semitones < 0 || semitones > 12) {
    throw new Error(`Intervall ausserhalb von Prime bis Oktave: ${semitones}`)
  }
  const dir: Direction = mode === 'harmonic' || semitones === 0 ? 'up' : direction
  const secondMidi = startMidi + (dir === 'up' ? semitones : -semitones)
  if (startMidi < PLAY_LOW || startMidi > PLAY_HIGH || secondMidi < PLAY_LOW || secondMidi > PLAY_HIGH) {
    throw new Error(`Tonraum verlassen: ${startMidi} → ${secondMidi}`)
  }
  return {
    kind: 'intervals',
    id,
    level,
    start: Note.fromMidiSharps(startMidi),
    second: Note.fromMidiSharps(secondMidi),
    semitones,
    direction: dir,
    mode,
  }
}

/** Statistik-Schlüssel, z. B. "int:4:up", "int:4:down", "int:4:harm" */
export function intervalKey(semitones: number, direction: Direction, mode: IntervalMode): string {
  if (mode === 'harmonic') return `int:${semitones}:harm`
  return `int:${semitones}:${semitones === 0 ? 'up' : direction}`
}

export function taskIntervalKey(task: IntervalTask): string {
  return intervalKey(task.semitones, task.direction, task.mode)
}

/** Schlüssel eines Intervall-Items zerlegen (null bei anderen Schlüsseln). */
export function parseIntervalKey(
  key: string,
): { semitones: number; variant: 'up' | 'down' | 'harm' } | null {
  const m = /^int:(\d+):(up|down|harm)$/.exec(key)
  if (!m) return null
  const semitones = Number(m[1])
  return semitones <= 12 ? { semitones, variant: m[2] as 'up' | 'down' | 'harm' } : null
}
