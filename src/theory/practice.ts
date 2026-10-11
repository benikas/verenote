import type { Rng } from '../shared/rng'
import { displayName } from './notes'
import {
  FIXED_START,
  START_HIGH,
  START_LOW,
  intervalKey,
  intervalName,
  makeIntervalTask,
  parseIntervalKey,
  type IntervalTask,
} from './intervals'
import {
  getLevel,
  itemKey,
  makeFreeNoteTask,
  type Direction,
  type IntervalMode,
  type LevelId,
  type StartMode,
  type Task,
} from './tasks'
import { Note } from 'tonal'
import type { FreeSettings } from '../storage/schema'

/**
 * Was geübt wird, unabhängig davon, ob es aus dem Lernpfad (Stufe) oder dem Freien Training
 * stammt. Aus einer Übung entsteht ein Pool von Items, aus dem die Engine gewichtet wählt.
 */

export interface NotePractice {
  type: 'notes'
  /** Zieltöne als Pitch Class (Kreuze) */
  notes: readonly string[]
  octaves: readonly number[]
  /** Mit Referenzton C4 (sonst absolutes Hören) */
  reference: boolean
}

export interface IntervalPractice {
  type: 'intervals'
  intervals: readonly number[]
  directions: readonly Direction[]
  modes: readonly IntervalMode[]
  start: StartMode
}

export type Practice = NotePractice | IntervalPractice

export type ExerciseTask = Task | IntervalTask

/** Eine Übung der Stufe des Lernpfads */
export function levelPractice(id: LevelId): Practice {
  const lv = getLevel(id)
  if (lv.kind === 'notes') {
    return { type: 'notes', notes: lv.notes, octaves: lv.octaves, reference: true }
  }
  return { type: 'intervals', intervals: lv.intervals, directions: lv.directions, modes: lv.modes, start: lv.start }
}

/** Einstellungen des Freien Trainings als Übung */
export function freePractice(f: FreeSettings): Practice {
  if (f.type === 'notes') {
    return { type: 'notes', notes: f.notes, octaves: f.octaves, reference: f.reference }
  }
  return {
    type: 'intervals',
    intervals: f.intervals,
    directions: f.directions === 'both' ? ['up', 'down'] : [f.directions],
    modes: f.modes === 'both' ? ['melodic', 'harmonic'] : [f.modes],
    start: f.start,
  }
}

/** Ein wählbarer Eintrag der Übung, zugleich der Schlüssel für Statistik und Fehlerstand */
export type PoolItem =
  | { key: string; type: 'notes'; note: string; reference: boolean }
  | { key: string; type: 'intervals'; semitones: number; direction: Direction; mode: IntervalMode }

export function poolFor(practice: Practice): PoolItem[] {
  if (practice.type === 'notes') {
    return practice.notes.map((note) => ({
      key: `${note}|${practice.reference ? 'C' : '-'}`,
      type: 'notes',
      note,
      reference: practice.reference,
    }))
  }
  const items: PoolItem[] = []
  const seen = new Set<string>()
  for (const semitones of practice.intervals) {
    for (const mode of practice.modes) {
      const dirs: readonly Direction[] = mode === 'harmonic' ? ['up'] : practice.directions
      for (const direction of dirs) {
        const key = intervalKey(semitones, direction, mode)
        if (seen.has(key)) continue // z. B. Prime „abwärts“ ist dieselbe Aufgabe wie „aufwärts“
        seen.add(key)
        items.push({ key, type: 'intervals', semitones, direction, mode })
      }
    }
  }
  return items
}

/** Zufälliger Startton (MIDI) im Bereich C3–C5, bei Bedarf eingeschränkt, damit beide Töne spielbar bleiben */
function randomStartMidi(rng: Rng): number {
  return START_LOW + Math.min(START_HIGH - START_LOW, Math.floor(rng() * (START_HIGH - START_LOW + 1)))
}

/** Aufgabe zu einem Item bauen. Der Zufall bestimmt Oktave bzw. Startton. */
export function taskFromItem(
  item: PoolItem,
  id: number,
  level: LevelId | null,
  practice: Practice,
  rng: Rng,
): ExerciseTask {
  if (item.type === 'notes') {
    if (practice.type !== 'notes') throw new Error('Item passt nicht zur Übung')
    const octs = practice.octaves
    const octave = octs.length === 1 ? octs[0] : octs[Math.min(octs.length - 1, Math.floor(rng() * octs.length))]
    return makeFreeNoteTaskForLevel(id, level, item.note, octave, item.reference)
  }
  if (practice.type !== 'intervals') throw new Error('Item passt nicht zur Übung')
  const startMidi = practice.start === 'fixed' ? (Note.midi(FIXED_START) as number) : randomStartMidi(rng)
  return makeIntervalTask(id, level, item.semitones, item.direction, item.mode, startMidi)
}

function makeFreeNoteTaskForLevel(
  id: number,
  level: LevelId | null,
  note: string,
  octave: number,
  withReference: boolean,
): Task {
  return { ...makeFreeNoteTask(id, note, octave, withReference), level }
}

/** Schlüssel einer Aufgabe */
export function taskKey(task: ExerciseTask): string {
  return task.kind === 'notes' ? itemKey(task) : intervalKey(task.semitones, task.direction, task.mode)
}

/** Richtige Antwort als Text: Pitch Class ("E") oder Halbtöne ("4") */
export function expectedAnswer(task: ExerciseTask): string {
  return task.kind === 'notes' ? Note.pitchClass(task.target) : String(task.semitones)
}

/** Anzeigename eines Items, z. B. "E", "C#/Db", "Grosse Terz ↑" */
export function itemLabel(key: string): string {
  const iv = parseIntervalKey(key)
  if (iv) {
    const arrow = iv.variant === 'up' ? ' ↑' : iv.variant === 'down' ? ' ↓' : ' gleichzeitig'
    return `${intervalName(iv.semitones)}${iv.semitones === 0 && iv.variant !== 'harm' ? '' : arrow}`
  }
  return displayName(key.split('|')[0])
}
