import type { ItemStat } from '../storage/schema'

/**
 * Gewicht eines Items aus dem gespeicherten Fehlerstand (über Runden hinweg).
 * - Neue Items (noch nie gefragt) bekommen ein mittleres Gewicht, damit sie vor sicheren dran kommen.
 * - Je höher die Fehlerquote, desto grösser das Gewicht. Die Quote ist geglättet (m / (n + 2)),
 *   ein einzelner Fehler zählt also weniger als viele.
 * - Das Gewicht liegt immer zwischen 1 und 1 + MAX_BONUS: Kein Item verhungert, auch kein sicheres.
 */
export const NEW_ITEM_WEIGHT = 3
export const MAX_BONUS = 4

export function historyWeight(stat: ItemStat | undefined): number {
  const n = stat ? stat.hits + stat.misses : 0
  if (!stat || n === 0) return NEW_ITEM_WEIGHT
  return 1 + MAX_BONUS * (stat.misses / (n + 2))
}
