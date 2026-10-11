import { Note } from 'tonal'

/**
 * Sample-Zuordnung des Klaviers (rein, ohne Audio): Welche Datei klingt für welchen Ton,
 * und um wie viele Halbtöne wird sie verschoben? Die Regel entspricht Tone.Sampler:
 * nächstliegendes Sample, bei Gleichstand das höhere.
 */

/** Stützstellen im Abstand von Kleinterzen */
export const SAMPLE_PCS = ['A', 'C', 'D#', 'F#'] as const
export const SAMPLE_OCTAVES = [2, 3, 4, 5, 6] as const

/** Namen aller vorhandenen Samples, z. B. "D#4" (plus C7 als Abschluss) */
export function sampleNames(): string[] {
  return [...SAMPLE_OCTAVES.flatMap((o) => SAMPLE_PCS.map((p) => `${p}${o}`)), 'C7']
}

/** Dateiname: "D#4" -> "Ds4.mp3" (kein '#' in URLs) */
export function sampleFileName(name: string): string {
  return `${name.replace('#', 's')}.mp3`
}

/** Frequenz in Hz (gleichstufig, A4 = 440 Hz) */
export function frequencyOf(note: string): number {
  const midi = Note.midi(note)
  if (midi == null) throw new Error(`Ungültiger Notenname: ${note}`)
  return 440 * 2 ** ((midi - 69) / 12)
}

export interface SamplePlan {
  /** Name des verwendeten Samples, z. B. "D#4" */
  sample: string
  /** Verschiebung in Halbtönen (positiv = nach oben) */
  shift: number
}

/** Welches Sample klingt für `note` und wie stark wird es verschoben? */
export function sampleFor(note: string): SamplePlan {
  const midi = Note.midi(note)
  if (midi == null) throw new Error(`Ungültiger Notenname: ${note}`)
  const byMidi = new Map(sampleNames().map((n) => [Note.midi(n) as number, n]))
  for (let d = 0; d < 96; d++) {
    const above = byMidi.get(midi + d)
    if (above) return { sample: above, shift: d === 0 ? 0 : -d }
    const below = byMidi.get(midi - d)
    if (below) return { sample: below, shift: d }
  }
  throw new Error(`Kein Sample für ${note}`)
}
