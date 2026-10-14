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

/** Ab dieser Quote (letzte Versuche) zeigt eine begonnene Stufe 2 statt 1 Stern */
export const STARS_TWO_THRESHOLD = 0.6
/** Stern 2 verlangt mindestens so viele Versuche (PL, 14.10.): sonst gilt 1 Stern */
export const STARS_TWO_MIN_ATTEMPTS = 5

export type Stars = 0 | 1 | 2 | 3

/**
 * Sterne im Lernpfad (M4, 4.5). Folgen der Markierung, ändern keine Regel:
 * 0 = neu · 1 = begonnen, Quote unter 60 % oder weniger als 5 Versuche · 2 = ab 5 Versuchen und Quote ab 60 % · 3 = geschafft.
 * Wer „geschafft“ ist, behält 3 Sterne, auch wenn die Quote später sinkt.
 */
export function levelStars(progress: Progress, level: LevelId): Stars {
  const mark = levelMark(progress, level)
  if (mark === 'geschafft') return 3
  if (mark === 'neu') return 0
  const s = recentStat(progress, level)
  return s.attempts >= STARS_TWO_MIN_ATTEMPTS && s.accuracy >= STARS_TWO_THRESHOLD ? 2 : 1
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
