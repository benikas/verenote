import { RECENT_ATTEMPTS, type Progress } from '../storage/schema'
import { LEVELS, nextLevel, type LevelId } from '../theory/tasks'
import { recentStat } from './progress'

/**
 * Freischaltung im Lernpfad: Stufe n+1 öffnet sich, sobald die Trefferquote über die letzten
 * RECENT_ATTEMPTS Versuche von Stufe n den Schwellenwert erreicht (mindestens so viele Versuche).
 */

export function isUnlocked(progress: Progress, level: LevelId): boolean {
  return progress.unlocked.includes(level)
}

/** Erfüllt `level` die Bedingung für die Freischaltung der Folgestufe? */
export function meetsUnlockRule(progress: Progress, level: LevelId, threshold: number): boolean {
  const s = recentStat(progress, level)
  return s.attempts >= RECENT_ATTEMPTS && s.accuracy >= threshold
}

/**
 * Prüft nach einer Runde, ob neue Stufen aufgehen, und trägt sie ein.
 * Gibt die neu freigeschalteten Stufen zurück (leer, wenn nichts passiert).
 */
export function updateUnlocks(progress: Progress, threshold: number): LevelId[] {
  const added: LevelId[] = []
  for (const l of LEVELS) {
    const next = nextLevel(l.id)
    if (!next) break
    if (!isUnlocked(progress, l.id)) break
    if (!isUnlocked(progress, next) && meetsUnlockRule(progress, l.id, threshold)) {
      progress.unlocked.push(next)
      added.push(next)
      break // pro Prüfung höchstens eine Stufe
    }
  }
  progress.unlocked = LEVELS.map((l) => l.id).filter((id) => progress.unlocked.includes(id))
  return added
}

/** Aktuelle Stufe im Lernpfad: die höchste freigeschaltete. */
export function currentLevel(progress: Progress): LevelId {
  const open = LEVELS.filter((l) => isUnlocked(progress, l.id))
  return open.at(-1)?.id ?? LEVELS[0].id
}

const pct = (x: number) => `${Math.round(x * 100)} %`

/** Hinweis, was für eine gesperrte Stufe noch fehlt. Leer, wenn sie offen ist. */
export function unlockHint(progress: Progress, level: LevelId, threshold: number): string {
  if (isUnlocked(progress, level)) return ''
  const idx = LEVELS.findIndex((l) => l.id === level)
  const prev = LEVELS[idx - 1]?.id
  if (!prev) return ''
  if (!isUnlocked(progress, prev)) return `Erst ${prev} freischalten.`
  const s = recentStat(progress, prev)
  if (s.attempts < RECENT_ATTEMPTS) {
    const missing = RECENT_ATTEMPTS - s.attempts
    return `Noch ${missing} ${missing === 1 ? 'Versuch' : 'Versuche'} in ${prev}, mit mindestens ${pct(threshold)} richtig.`
  }
  return `${prev}: ${pct(s.accuracy)} richtig über die letzten ${RECENT_ATTEMPTS} Versuche. Nötig: ${pct(threshold)}.`
}
