import { RECENT_ATTEMPTS, type Progress } from '../storage/schema'
import { LEVELS, nextLevel, type LevelId } from '../theory/tasks'
import { recentStat } from './progress'

/**
 * Markierung der Stufen (Konzept v5): Nichts ist gesperrt. Jede Stufe ist
 * neu · begonnen · geschafft. „Geschafft“ = Schwelle (Standard 80 %) über die letzten
 * RECENT_ATTEMPTS Versuche, und bleibt gesetzt, auch wenn die Quote später sinkt.
 */
export type Mark = 'neu' | 'begonnen' | 'geschafft'

export const MARK_LABEL: Record<Mark, string> = { neu: 'Neu', begonnen: 'Begonnen', geschafft: 'Geschafft' }

export function isDone(progress: Progress, level: LevelId): boolean {
  return progress.done.includes(level)
}

export function levelMark(progress: Progress, level: LevelId): Mark {
  if (isDone(progress, level)) return 'geschafft'
  return recentStat(progress, level).attempts > 0 ? 'begonnen' : 'neu'
}

/** Erfüllen die letzten Versuche der Stufe die Bedingung für „geschafft“? */
export function meetsDoneRule(progress: Progress, level: LevelId, threshold: number): boolean {
  const s = recentStat(progress, level)
  return s.attempts >= RECENT_ATTEMPTS && s.accuracy >= threshold
}

/**
 * Nach einer Runde: Stufen markieren, die jetzt „geschafft“ sind. Gibt die neu geschafften
 * Stufen zurück (leer, wenn nichts Neues).
 */
export function updateDone(progress: Progress, threshold: number): LevelId[] {
  const added: LevelId[] = []
  for (const l of LEVELS) {
    if (!isDone(progress, l.id) && meetsDoneRule(progress, l.id, threshold)) {
      progress.done.push(l.id)
      added.push(l.id)
    }
  }
  progress.done = LEVELS.map((l) => l.id).filter((id) => progress.done.includes(id))
  return added
}

/** Empfohlene nächste Stufe: die erste, die noch nicht geschafft ist (null, wenn alle geschafft). */
export function recommendedLevel(progress: Progress): LevelId | null {
  return LEVELS.find((l) => !isDone(progress, l.id))?.id ?? null
}

export { nextLevel }
