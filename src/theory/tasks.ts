import { Note } from 'tonal'
import { CHROMATIC_SHARPS, REFERENCE_NOTE, STAMMTOENE, pitchClass, withOctave } from './notes'

/**
 * Aufgaben als reine Daten (Stufe 1, Grundtöne): Referenzton C4 hören,
 * dann einen Zielton; gesucht ist der Name des Zielstons.
 */

export type LevelId = '1a' | '1b' | '1c' | '1d' | '1e'

export interface Level {
  id: LevelId
  /** Kurzbezeichnung für die Anzeige */
  label: string
  /** Erlaubte Zieltöne (Pitch Classes, Kreuze), zugleich die aktiven Tasten */
  notes: readonly string[]
  /** Oktaven, in denen der Zielton liegen kann (Referenz C4 liegt in Oktave 4) */
  octaves: readonly number[]
}

/** Feinstufen der Grundtöne: wenige Antwortoptionen zuerst, dann mehr. */
export const LEVELS: readonly Level[] = [
  { id: '1a', label: 'C, E, G', notes: ['C', 'E', 'G'], octaves: [4] },
  { id: '1b', label: 'C, D, E, F, G', notes: ['C', 'D', 'E', 'F', 'G'], octaves: [4] },
  { id: '1c', label: 'Alle 7 Stammtöne', notes: STAMMTOENE, octaves: [4] },
  { id: '1d', label: 'Andere Oktave', notes: STAMMTOENE, octaves: [3, 4, 5] },
  { id: '1e', label: 'Mit # und b', notes: CHROMATIC_SHARPS, octaves: [4] },
]

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

export interface Task {
  /** Laufende Nummer innerhalb der Session, ab 1 */
  id: number
  level: LevelId
  /** z. B. "C4" */
  reference: string
  /** z. B. "E4" */
  target: string
}

/** Aufgabe zu einem Ziel-Pitch-Class bauen. Standard-Oktave 4; die Stufe legt die erlaubten Oktaven fest. */
export function makeTask(id: number, level: LevelId, targetPitchClass: string, octave = 4): Task {
  const lv = getLevel(level)
  if (!lv.notes.includes(targetPitchClass)) {
    throw new Error(`${targetPitchClass} gehört nicht zu Stufe ${level}`)
  }
  if (!lv.octaves.includes(octave)) {
    throw new Error(`Oktave ${octave} gehört nicht zu Stufe ${level}`)
  }
  return { id, level, reference: REFERENCE_NOTE, target: withOctave(targetPitchClass, octave) }
}

/** Oktavabstand des Zieltons zum Referenzton: -1 = eine Oktave tiefer, 0 = gleiche, +1 = höher */
export function octaveOffset(task: Task): number {
  return (Note.octave(task.target) ?? 4) - (Note.octave(task.reference) ?? 4)
}

/** Schlüssel für die Statistik, z. B. "E|C" = Zielton E, Referenz C. */
export function itemKey(task: Task): string {
  return `${pitchClass(task.target)}|${pitchClass(task.reference)}`
}
