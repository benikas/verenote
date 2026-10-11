import { MAX_ROUNDS, RECENT_ATTEMPTS, type Progress, type RoundLevel } from '../storage/schema'
import type { LevelId } from '../theory/tasks'

/**
 * Fortschritt (rein, ohne Speicher und UI). Die Funktionen ändern das übergebene
 * Progress-Objekt; gespeichert wird es von der App.
 */

/**
 * Einen Versuch festhalten: Treffer/Fehler pro Item und, im Lernpfad, die letzten Versuche der Stufe.
 * Im Freien Training (level = null) zählt der Versuch für Statistik und Fehlerstand, nicht für die Stufen.
 */
export function recordAttempt(progress: Progress, level: LevelId | null, itemKey: string, correct: boolean): void {
  // Immer über `progress` zurücklesen: Bei einem Svelte-$state-Objekt liefert `??=` sonst das
  // rohe Objekt, und Änderungen daran bleiben unsichtbar.
  if (!progress.items[itemKey]) progress.items[itemKey] = { hits: 0, misses: 0 }
  const stat = progress.items[itemKey]
  if (correct) stat.hits += 1
  else stat.misses += 1

  if (level === null) return
  if (!progress.recent[level]) progress.recent[level] = []
  const recent = progress.recent[level]
  recent.push(correct)
  if (recent.length > RECENT_ATTEMPTS) recent.splice(0, recent.length - RECENT_ATTEMPTS)
}

/** Eine abgeschlossene Runde in den Verlauf aufnehmen (die letzten MAX_ROUNDS bleiben). */
export function recordRound(progress: Progress, level: RoundLevel, total: number, correct: number, at = new Date()): void {
  progress.rounds.push({ at: at.toISOString(), level, total, correct })
  if (progress.rounds.length > MAX_ROUNDS) progress.rounds.splice(0, progress.rounds.length - MAX_ROUNDS)
}

export interface RecentStat {
  attempts: number
  correct: number
  /** 0–1; 0 ohne Versuche */
  accuracy: number
}

/** Trefferquote über die letzten Versuche (höchstens RECENT_ATTEMPTS) einer Stufe. */
export function recentStat(progress: Progress, level: LevelId): RecentStat {
  const list = progress.recent[level] ?? []
  const correct = list.filter(Boolean).length
  return { attempts: list.length, correct, accuracy: list.length === 0 ? 0 : correct / list.length }
}
