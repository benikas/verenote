import { REFERENCE_NOTE, STAMMTOENE, pitchClass, withOctave } from './notes'

/**
 * Aufgaben als reine Daten (Stufe 1, Grundtöne): Referenzton C4 hören,
 * dann einen Zielton; gesucht ist der Name des Zielstons.
 */

export type LevelId = '1a' | '1b' | '1c'

export interface Level {
  id: LevelId
  /** Kurzbezeichnung für die Anzeige */
  label: string
  /** Erlaubte Zieltöne (Pitch Classes), zugleich die aktiven Tasten */
  notes: readonly string[]
}

/** Feinstufen der Grundtöne: wenige Antwortoptionen zuerst, dann mehr. */
export const LEVELS: readonly Level[] = [
  { id: '1a', label: 'C, E, G', notes: ['C', 'E', 'G'] },
  { id: '1b', label: 'C, D, E, F, G', notes: ['C', 'D', 'E', 'F', 'G'] },
  { id: '1c', label: 'Alle 7 Stammtöne', notes: STAMMTOENE },
]

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

/** Aufgabe zu einem Ziel-Pitch-Class bauen. Zielton liegt in Oktave 4 (Stufen 1a–c). */
export function makeTask(id: number, level: LevelId, targetPitchClass: string): Task {
  const allowed = getLevel(level).notes
  if (!allowed.includes(targetPitchClass)) {
    throw new Error(`${targetPitchClass} gehört nicht zu Stufe ${level}`)
  }
  return { id, level, reference: REFERENCE_NOTE, target: withOctave(targetPitchClass, 4) }
}

/** Schlüssel für die Statistik, z. B. "E|C" = Zielton E, Referenz C. */
export function itemKey(task: Task): string {
  return `${pitchClass(task.target)}|${pitchClass(task.reference)}`
}
