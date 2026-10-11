import { RECENT_ATTEMPTS, type Progress, type RoundLevel } from '../storage/schema'
import { CHROMATIC_SHARPS } from '../theory/notes'
import { INTERVALS, parseIntervalKey } from '../theory/intervals'
import { LEVELS, type LevelId } from '../theory/tasks'
import { levelMark, type Mark } from './marks'
import { recentStat } from './progress'

/** Aufbereitete Zahlen für den Statistik-Screen (rein, aus den gespeicherten Daten). */

export interface LevelStat {
  id: LevelId
  label: string
  mark: Mark
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

/** Treffer und Fehler einer Variante eines Intervalls */
export interface VariantStat {
  hits: number
  misses: number
}

export interface IntervalStat {
  semitones: number
  name: string
  hits: number
  misses: number
  attempts: number
  /** 0–1, null ohne Versuche */
  accuracy: number | null
  /** Aufgeschlüsselt: aufwärts, abwärts, gleichzeitig */
  up: VariantStat
  down: VariantStat
  harm: VariantStat
}

export interface RoundStat {
  at: string
  level: RoundLevel
  total: number
  correct: number
  /** 0–1 */
  accuracy: number
}

export interface Stats {
  levels: LevelStat[]
  /** Alle 12 Töne, C bis B; Items „E|C“ werden nach Zielton zusammengefasst (alle Zeit) */
  tones: ToneStat[]
  /** Alle 13 Intervalle, Prime bis Oktave (alle Zeit, Lernpfad und Freies Training gemeinsam) */
  intervals: IntervalStat[]
  /** Letzte Runden, älteste zuerst */
  rounds: RoundStat[]
  /** Alle Versuche seit Beginn (Töne und Intervalle) */
  totalAttempts: number
  /** Versuche mit Grundtönen / mit Intervallen */
  toneAttempts: number
  intervalAttempts: number
}

export function buildStats(progress: Progress, maxRounds = 10): Stats {
  const levels = LEVELS.map((l): LevelStat => {
    const s = recentStat(progress, l.id)
    return { id: l.id, label: l.label, mark: levelMark(progress, l.id), attempts: s.attempts, accuracy: s.accuracy }
  })

  const byTone = new Map<string, { hits: number; misses: number }>()
  const byInterval = new Map<number, Record<'up' | 'down' | 'harm', VariantStat>>()
  for (const [key, stat] of Object.entries(progress.items)) {
    const iv = parseIntervalKey(key)
    if (iv) {
      const cur = byInterval.get(iv.semitones) ?? { up: { hits: 0, misses: 0 }, down: { hits: 0, misses: 0 }, harm: { hits: 0, misses: 0 } }
      cur[iv.variant].hits += stat.hits
      cur[iv.variant].misses += stat.misses
      byInterval.set(iv.semitones, cur)
      continue
    }
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

  const intervals = INTERVALS.map((i): IntervalStat => {
    const v = byInterval.get(i.semitones) ?? { up: { hits: 0, misses: 0 }, down: { hits: 0, misses: 0 }, harm: { hits: 0, misses: 0 } }
    const hits = v.up.hits + v.down.hits + v.harm.hits
    const misses = v.up.misses + v.down.misses + v.harm.misses
    const attempts = hits + misses
    return { semitones: i.semitones, name: i.name, hits, misses, attempts, accuracy: attempts === 0 ? null : hits / attempts, ...v }
  })

  const rounds = progress.rounds.slice(-maxRounds).map(
    (r): RoundStat => ({ ...r, accuracy: r.total === 0 ? 0 : r.correct / r.total }),
  )

  const toneAttempts = tones.reduce((n, t) => n + t.attempts, 0)
  const intervalAttempts = intervals.reduce((n, i) => n + i.attempts, 0)
  return { levels, tones, intervals, rounds, totalAttempts: toneAttempts + intervalAttempts, toneAttempts, intervalAttempts }
}

export { RECENT_ATTEMPTS }
