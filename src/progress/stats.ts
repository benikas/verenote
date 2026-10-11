import { RECENT_ATTEMPTS, type Progress } from '../storage/schema'
import { CHROMATIC_SHARPS } from '../theory/notes'
import { LEVELS, type LevelId } from '../theory/tasks'
import { recentStat } from './progress'

/** Aufbereitete Zahlen für den Statistik-Screen (rein, aus den gespeicherten Daten). */

export interface LevelStat {
  id: LevelId
  label: string
  unlocked: boolean
  /** Letzte Versuche (höchstens 20) */
  attempts: number
  accuracy: number
}

export interface ToneStat {
  /** Pitch Class, z. B. "F#" */
  note: string
  hits: number
  misses: number
  attempts: number
  /** 0–1, null ohne Versuche */
  accuracy: number | null
}

export interface RoundStat {
  at: string
  level: LevelId
  total: number
  correct: number
  /** 0–1 */
  accuracy: number
}

export interface Stats {
  levels: LevelStat[]
  /** Alle 12 Töne, C bis B; Items „E|C“ werden nach Zielton zusammengefasst (alle Zeit) */
  tones: ToneStat[]
  /** Letzte Runden, älteste zuerst */
  rounds: RoundStat[]
  totalAttempts: number
}

export function buildStats(progress: Progress, maxRounds = 10): Stats {
  const levels = LEVELS.map((l): LevelStat => {
    const s = recentStat(progress, l.id)
    return { id: l.id, label: l.label, unlocked: progress.unlocked.includes(l.id), attempts: s.attempts, accuracy: s.accuracy }
  })

  const byTone = new Map<string, { hits: number; misses: number }>()
  for (const [key, stat] of Object.entries(progress.items)) {
    const note = key.split('|')[0]
    const cur = byTone.get(note) ?? { hits: 0, misses: 0 }
    cur.hits += stat.hits
    cur.misses += stat.misses
    byTone.set(note, cur)
  }
  const tones = CHROMATIC_SHARPS.map((note): ToneStat => {
    const t = byTone.get(note) ?? { hits: 0, misses: 0 }
    const attempts = t.hits + t.misses
    return { note, hits: t.hits, misses: t.misses, attempts, accuracy: attempts === 0 ? null : t.hits / attempts }
  })

  const rounds = progress.rounds.slice(-maxRounds).map(
    (r): RoundStat => ({ ...r, accuracy: r.total === 0 ? 0 : r.correct / r.total }),
  )

  return { levels, tones, rounds, totalAttempts: tones.reduce((n, t) => n + t.attempts, 0) }
}

export { RECENT_ATTEMPTS }
