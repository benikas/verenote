import { Note } from 'tonal'
import { CHROMATIC_SHARPS, REFERENCE_NOTE, STAMMTOENE, pitchClass, withOctave } from './notes'

/**
 * Aufgaben als reine Daten (Stufe 1, Grundtöne): Referenzton C4 hören,
 * dann einen Zielton; gesucht ist der Name des Zielstons.
 */

export type NoteLevelId = '1a' | '1b' | '1c' | '1d' | '1e'
export type IntervalLevelId = '2a' | '2b' | '2c' | '2d' | '2e' | '2f'
export type LevelId = NoteLevelId | IntervalLevelId

export type Direction = 'up' | 'down'
export type IntervalMode = 'melodic' | 'harmonic'
/** Startton der Intervalle: fest C4 oder zufällig (C3–C5) */
export type StartMode = 'fixed' | 'random'

export interface NoteLevel {
  kind: 'notes'
  id: NoteLevelId
  /** Kurzbezeichnung für die Anzeige */
  label: string
  /** Erlaubte Zieltöne (Pitch Classes, Kreuze), zugleich die aktiven Tasten */
  notes: readonly string[]
  /** Oktaven, in denen der Zielton liegen kann (Referenz C4 liegt in Oktave 4) */
  octaves: readonly number[]
}

export interface IntervalLevel {
  kind: 'intervals'
  id: IntervalLevelId
  label: string
  /** Erlaubte Intervalle in Halbtönen (0 = Prime … 12 = Oktave) */
  intervals: readonly number[]
  directions: readonly Direction[]
  modes: readonly IntervalMode[]
  start: StartMode
}

export type Level = NoteLevel | IntervalLevel

const ALL_INTERVALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** Feinstufen der Grundtöne: wenige Antwortoptionen zuerst, dann mehr. */
export const NOTE_LEVELS: readonly NoteLevel[] = [
  { kind: 'notes', id: '1a', label: 'C, E, G', notes: ['C', 'E', 'G'], octaves: [4] },
  { kind: 'notes', id: '1b', label: 'C, D, E, F, G', notes: ['C', 'D', 'E', 'F', 'G'], octaves: [4] },
  { kind: 'notes', id: '1c', label: 'Alle 7 Stammtöne', notes: STAMMTOENE, octaves: [4] },
  { kind: 'notes', id: '1d', label: 'Andere Oktave', notes: STAMMTOENE, octaves: [3, 4, 5] },
  { kind: 'notes', id: '1e', label: 'Mit # und b', notes: CHROMATIC_SHARPS, octaves: [4] },
]

/** Feinstufen der Intervalle (Konzept v6, Vorschlag; Feinjustierung nach dem Gerätetest). */
export const INTERVAL_LEVELS: readonly IntervalLevel[] = [
  { kind: 'intervals', id: '2a', label: 'Prime, Quinte, Oktave', intervals: [0, 7, 12], directions: ['up'], modes: ['melodic'], start: 'fixed' },
  { kind: 'intervals', id: '2b', label: '+ Quarte, grosse Terz', intervals: [0, 4, 5, 7, 12], directions: ['up'], modes: ['melodic'], start: 'fixed' },
  { kind: 'intervals', id: '2c', label: '+ grosse Sekunde, kleine Terz', intervals: [0, 2, 3, 4, 5, 7, 12], directions: ['up'], modes: ['melodic'], start: 'fixed' },
  { kind: 'intervals', id: '2d', label: 'Alle 13, wechselnder Startton', intervals: ALL_INTERVALS, directions: ['up'], modes: ['melodic'], start: 'random' },
  { kind: 'intervals', id: '2e', label: 'Alle abwärts', intervals: ALL_INTERVALS, directions: ['down'], modes: ['melodic'], start: 'random' },
  { kind: 'intervals', id: '2f', label: 'Alle gleichzeitig', intervals: ALL_INTERVALS, directions: ['up'], modes: ['harmonic'], start: 'random' },
]

/** Alle Stufen des Lernpfads in empfohlener Reihenfolge */
export const LEVELS: readonly Level[] = [...NOTE_LEVELS, ...INTERVAL_LEVELS]

/** Stufe, die auf `id` folgt (null bei der letzten) */
export function nextLevel(id: LevelId): LevelId | null {
  const i = LEVELS.findIndex((l) => l.id === id)
  return LEVELS[i + 1]?.id ?? null
}

export function getLevel(id: LevelId): Level {
  const level = LEVELS.find((l) => l.id === id)
  if (!level) throw new Error(`Unbekannte Stufe: ${id}`)
  return level
}

export function getNoteLevel(id: LevelId): NoteLevel {
  const level = getLevel(id)
  if (level.kind !== 'notes') throw new Error(`Stufe ${id} ist keine Grundton-Stufe`)
  return level
}

export interface Task {
  kind: 'notes'
  /** Laufende Nummer innerhalb der Session, ab 1 */
  id: number
  /** Stufe des Lernpfads; null im Freien Training */
  level: LevelId | null
  /** z. B. "C4"; null = ohne Referenzton (absolutes Hören, nur im Freien Training) */
  reference: string | null
  /** z. B. "E4" */
  target: string
}

/** Aufgabe zu einem Ziel-Pitch-Class bauen. Standard-Oktave 4; die Stufe legt die erlaubten Oktaven fest. */
export function makeTask(id: number, level: LevelId, targetPitchClass: string, octave = 4): Task {
  const lv = getNoteLevel(level)
  if (!lv.notes.includes(targetPitchClass)) {
    throw new Error(`${targetPitchClass} gehört nicht zu Stufe ${level}`)
  }
  if (!lv.octaves.includes(octave)) {
    throw new Error(`Oktave ${octave} gehört nicht zu Stufe ${level}`)
  }
  return { kind: 'notes', id, level, reference: REFERENCE_NOTE, target: withOctave(targetPitchClass, octave) }
}

/** Grundton-Aufgabe ohne Prüfung gegen eine Stufe (Freies Training). */
export function makeFreeNoteTask(id: number, targetPitchClass: string, octave: number, withReference: boolean): Task {
  return {
    kind: 'notes',
    id,
    level: null,
    reference: withReference ? REFERENCE_NOTE : null,
    target: withOctave(targetPitchClass, octave),
  }
}

/** Oktavabstand des Zieltons zum Referenzton: -1 = eine Oktave tiefer, 0 = gleiche, +1 = höher */
export function octaveOffset(task: Task): number {
  const ref = task.reference ?? REFERENCE_NOTE
  return (Note.octave(task.target) ?? 4) - (Note.octave(ref) ?? 4)
}

/** Schlüssel für die Statistik, z. B. "E|C" = Zielton E, Referenz C; "E|-" = ohne Referenz. */
export function itemKey(task: Task): string {
  return `${pitchClass(task.target)}|${task.reference ? pitchClass(task.reference) : '-'}`
}
