import { describe, expect, it } from 'vitest'
import { emptyProgress } from '../storage/schema'
import { recordAttempt, recordRound } from './progress'
import { buildStats } from './stats'

describe('Statistik', () => {
  it('leer: alle 12 Töne ohne Versuche, keine Runden', () => {
    const s = buildStats(emptyProgress())
    expect(s.tones).toHaveLength(12)
    expect(s.tones.every((t) => t.attempts === 0 && t.accuracy === null)).toBe(true)
    expect(s.rounds).toEqual([])
    expect(s.totalAttempts).toBe(0)
    expect(s.levels.map((l) => [l.id, l.mark])).toEqual(
      ['1a', '1b', '1c', '1d', '1e', '2a', '2b', '2c', '2d', '2e', '2f'].map((id) => [id, 'neu']),
    )
  })

  it('Zahlen stimmen mit den gespeicherten Daten überein', () => {
    const p = emptyProgress()
    recordAttempt(p, '1a', 'E|C', true)
    recordAttempt(p, '1a', 'E|C', true)
    recordAttempt(p, '1a', 'E|C', false)
    recordAttempt(p, '1a', 'G|C', true)
    recordAttempt(p, '1e', 'F#|C', false)
    recordRound(p, '1a', 10, 7, new Date('2026-10-01T10:00:00Z'))
    recordRound(p, '1a', 10, 9, new Date('2026-10-02T10:00:00Z'))

    const s = buildStats(p)
    const tone = (n: string) => s.tones.find((t) => t.note === n)!
    expect(tone('E')).toEqual({ note: 'E', hits: 2, misses: 1, attempts: 3, accuracy: 2 / 3 })
    expect(tone('G')).toMatchObject({ hits: 1, misses: 0, accuracy: 1 })
    expect(tone('F#')).toMatchObject({ hits: 0, misses: 1, accuracy: 0 })
    expect(tone('C').accuracy).toBeNull()
    expect(s.totalAttempts).toBe(5)

    const a = s.levels.find((l) => l.id === '1a')!
    expect(a).toMatchObject({ attempts: 4, accuracy: 0.75, mark: 'begonnen' })
    expect(s.levels.find((l) => l.id === '1e')?.mark).toBe('begonnen')
    expect(s.rounds.map((r) => r.accuracy)).toEqual([0.7, 0.9])
  })

  it('Töne aus verschiedenen Referenzen werden pro Zielton zusammengefasst', () => {
    const p = emptyProgress()
    recordAttempt(p, '1a', 'E|C', true)
    recordAttempt(p, '1a', 'E|D', false)
    expect(buildStats(p).tones.find((t) => t.note === 'E')).toMatchObject({ hits: 1, misses: 1 })
  })

  it('Verlauf zeigt höchstens die letzten Runden, älteste zuerst', () => {
    const p = emptyProgress()
    for (let i = 0; i < 15; i++) recordRound(p, '1a', 10, i % 11, new Date(2026, 0, 1 + i))
    const s = buildStats(p, 10)
    expect(s.rounds).toHaveLength(10)
    expect(s.rounds[0].correct).toBe(5)
    expect(s.rounds.at(-1)?.correct).toBe(14 % 11)
  })
})
