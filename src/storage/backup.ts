import { EXPORT_REMINDER_ROUNDS, type Backup } from './schema'

/**
 * Erinnerung an den Export (rein): Nach EXPORT_REMINDER_ROUNDS abgeschlossenen Runden seit dem
 * letzten Export erscheint ein Hinweis. Wegklicken schiebt ihn um dieselbe Zahl Runden nach hinten.
 */

/** Eine abgeschlossene Runde zählen. */
export function noteRound(b: Backup): void {
  b.roundsSinceExport += 1
}

export function shouldRemind(b: Backup): boolean {
  return b.roundsSinceExport >= b.remindAt
}

/** Wegklicken: erst nach weiteren Runden wieder erinnern. */
export function dismissReminder(b: Backup): void {
  b.remindAt = b.roundsSinceExport + EXPORT_REMINDER_ROUNDS
}

/** Export gelungen (oder frischer Import): Zähler zurück auf Anfang. */
export function markExported(b: Backup): void {
  b.roundsSinceExport = 0
  b.remindAt = EXPORT_REMINDER_ROUNDS
}
