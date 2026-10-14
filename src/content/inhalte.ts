import raw from './inhalte.md?raw'
import { parseInhalte, type Entry } from './parse'

export * from './parse'

/** Alle Einträge, in der Reihenfolge der Datei */
export const ENTRIES: readonly Entry[] = parseInhalte(raw)

export function entry(id: string): Entry | undefined {
  return ENTRIES.find((e) => e.id === id)
}

/** Einführung einer Stufe: Eintrag `stufe-<id>` */
export const introId = (level: string) => `stufe-${level}`

export const TOPICS = ENTRIES.filter((e) => e.id.startsWith('thema-'))
export const INTERVAL_CARDS = ENTRIES.filter((e) => e.id.startsWith('intervall-'))
