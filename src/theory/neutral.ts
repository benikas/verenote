import { Note } from 'tonal'
import { pickWeighted, type Rng } from '../shared/rng'
import { REFERENCE_NOTE, chroma } from './notes'

/**
 * Gehör neutralisieren (Konzept v3): Vor einer neuen Aufgabe läuft eine kurze atonale
 * Tonfolge, die den Höreindruck der letzten Aufgabe löscht. Hier entsteht sie als reine Daten.
 *
 * Regeln:
 * - 4 (kurz) oder 6 (lang) chromatische Töne, über 2–3 Oktaven verteilt
 * - kein Ton kehrt wieder (jede Pitch Class höchstens einmal)
 * - keine erkennbare Tonart: benachbarte Töne stehen nur im Abstand von Halbton, Ganzton oder
 *   Tritonus (Intervallklasse 1, 2 oder 6), also ohne Terzen, Quarten und Quinten
 * - die Folge endet nicht auf dem Referenzton
 */

export type NeutralLength = 'short' | 'long'

export const NEUTRAL_TONE_COUNT: Record<NeutralLength, number> = { short: 4, long: 6 }

/** Tonraum: C3 bis B5 (MIDI 48–83), also drei Oktaven */
export const NEUTRAL_LOW = 48
export const NEUTRAL_HIGH = 83
/** Mindestens zwei Oktaven zwischen tiefstem und höchstem Ton */
export const NEUTRAL_MIN_SPAN = 24

/** Erlaubte Intervallklassen zwischen benachbarten Tönen: m2/M7, M2/m7, Tritonus */
const ALLOWED_INTERVAL_CLASSES = [1, 2, 6]
const MAX_ATTEMPTS = 500

/** Intervallklasse 0–6: Abstand in Halbtönen, auf eine Oktave gefaltet und gespiegelt. */
export function intervalClass(a: number, b: number): number {
  const d = Math.abs(a - b) % 12
  return Math.min(d, 12 - d)
}

/**
 * Neutralisierungsfolge als Notennamen mit Oktave, z. B. ["D3", "G#3", "A4", "D#4"].
 * Wirft nur, wenn count unzulässig ist (die Suche selbst findet immer eine Lösung).
 */
export function makeNeutralization(
  length: NeutralLength,
  rng: Rng,
  reference: string = REFERENCE_NOTE,
): string[] {
  const count = NEUTRAL_TONE_COUNT[length]
  if (!count) throw new Error(`Unbekannte Länge: ${length}`)
  const refChroma = chroma(reference)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const picked: number[] = []
    const usedChroma = new Set<number>()

    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1
      const candidates: number[] = []
      for (let midi = NEUTRAL_LOW; midi <= NEUTRAL_HIGH; midi++) {
        const c = midi % 12
        if (usedChroma.has(c)) continue
        if (isLast && c === refChroma) continue
        if (i > 0 && !ALLOWED_INTERVAL_CLASSES.includes(intervalClass(picked[i - 1], midi))) continue
        candidates.push(midi)
      }
      if (candidates.length === 0) break
      const midi = candidates[pickWeighted(candidates.map(() => 1), rng)]
      picked.push(midi)
      usedChroma.add(midi % 12)
    }

    if (picked.length < count) continue
    if (Math.max(...picked) - Math.min(...picked) < NEUTRAL_MIN_SPAN) continue
    return picked.map((m) => Note.fromMidiSharps(m))
  }
  throw new Error('Keine passende Neutralisierungsfolge gefunden')
}
