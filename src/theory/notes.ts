import { Note } from 'tonal'

/**
 * Theorie-Kern: kennt weder Audio noch UI.
 * Notennamen in englischer Schreibweise (C D E F G A B, mit # und b), passend zu Tonal.js.
 */

/** Stammtöne (Pitch Classes ohne Vorzeichen), aufsteigend ab C */
export const STAMMTOENE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Stammton = (typeof STAMMTOENE)[number]

/** Alle zwölf Töne mit Kreuzen, für die spätere chromatische Stufe (1e) */
export const CHROMATIC_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Referenzton der Grundton-Übungen */
export const REFERENCE_NOTE = 'C4'

/** Pitch Class eines Tons: "E4" -> "E", "Db3" -> "Db" */
export function pitchClass(note: string): string {
  const pc = Note.pitchClass(note)
  if (!pc) throw new Error(`Ungültiger Notenname: ${note}`)
  return pc
}

/** Halbtonposition 0–11 über C (enharmonisch gleich: "E#" = "F"). */
export function chroma(note: string): number {
  const c = Note.chroma(note)
  if (c === undefined || Number.isNaN(c)) throw new Error(`Ungültiger Notenname: ${note}`)
  return c
}

/** Zwei Töne sind gleich, wenn sie dieselbe Pitch Class haben (Oktave egal). */
export function samePitchClass(a: string, b: string): boolean {
  return chroma(a) === chroma(b)
}

/** Notenname mit Oktave: ("E", 4) -> "E4" */
export function withOctave(pc: string, octave: number): string {
  return `${pc}${octave}`
}

/** Halbtöne von a nach b (positiv = b höher), über MIDI-Nummern. */
export function semitonesBetween(a: string, b: string): number {
  const ma = Note.midi(a)
  const mb = Note.midi(b)
  if (ma == null || mb == null) throw new Error(`Töne brauchen eine Oktave: ${a}, ${b}`)
  return mb - ma
}

const FLAT_NAMES: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
}

/** Anzeigename einer Pitch Class: Stammtöne wie sie sind, schwarze Tasten mit beiden Namen ("C#/Db"). */
export function displayName(pc: string): string {
  const flat = FLAT_NAMES[pc]
  return flat ? `${pc}/${flat}` : pc
}
