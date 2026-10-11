import { describe, expect, it } from 'vitest'
import { emptyProgress, type Progress } from '../storage/schema'
import { recentStat, recordAttempt, recordRound } from './progress'
import { MARK_LABEL, isDone, levelMark, meetsDoneRule, recommendedLevel, updateDone } from './marks'

function attempts(p: Progress, level: '1a' | '1b' | '1c' | '1d' | '1e', hits: number, misses: number) {
  for (let i = 0; i < hits; i++) recordAttempt(p, level, 'E|C', true)
  for (let i = 0; i < misses; i++) recordAttempt(p, level, 'E|C', false)
}

describe('Fortschritt', () => {
  it('zählt Treffer und Fehler pro Item', () => {
    const p = emptyProgress()
    recordAttempt(p, '1a', 'E|C', true)
    recordAttempt(p, '1a', 'E|C', false)
    recordAttempt(p, '1a', 'G|C', true)
    expect(p.items).toEqual({ 'E|C': { hits: 1, misses: 1 }, 'G|C': { hits: 1, misses: 0 } })
  })

  it('behält nur die letzten 20 Versuche je Stufe, getrennt nach Stufe', () => {
    const p = emptyProgress()
    attempts(p, '1a', 0, 10) // alte Fehler
    attempts(p, '1a', 20, 0) // schieben die Fehler hinaus
    attempts(p, '1b', 3, 1)
    expect(p.recent['1a']).toHaveLength(20)
    expect(recentStat(p, '1a')).toEqual({ attempts: 20, correct: 20, accuracy: 1 })
    expect(recentStat(p, '1b')).toEqual({ attempts: 4, correct: 3, accuracy: 0.75 })
    expect(recentStat(p, '1c')).toEqual({ attempts: 0, correct: 0, accuracy: 0 })
  })

  it('Verlauf: neueste zuletzt, höchstens 30 Runden', () => {
    const p = emptyProgress()
    for (let i = 0; i < 35; i++) recordRound(p, '1a', 10, i % 11, new Date(2026, 0, 1 + i))
    expect(p.rounds).toHaveLength(30)
    expect(p.rounds.at(-1)?.correct).toBe(34 % 11)
    expect(p.rounds[0].at).toBe(new Date(2026, 0, 6).toISOString())
  })
})

describe('Markierung neu · begonnen · geschafft', () => {
  it('am Anfang sind alle Stufen neu, nichts ist gesperrt oder geschafft', () => {
    const p = emptyProgress()
    for (const l of ['1a', '1b', '1c', '1d', '1e'] as const) {
      expect(levelMark(p, l)).toBe('neu')
      expect(isDone(p, l)).toBe(false)
    }
    expect(MARK_LABEL.geschafft).toBe('Geschafft')
  })

  it('begonnen ab dem ersten Versuch', () => {
    const p = emptyProgress()
    attempts(p, '1c', 1, 0)
    expect(levelMark(p, '1c')).toBe('begonnen')
    expect(levelMark(p, '1a')).toBe('neu')
  })

  it('80 % über 20 Versuche: geschafft, 79 % nicht', () => {
    const ok = emptyProgress()
    attempts(ok, '1a', 16, 4) // 80 %
    expect(meetsDoneRule(ok, '1a', 0.8)).toBe(true)
    expect(updateDone(ok, 0.8)).toEqual(['1a'])
    expect(levelMark(ok, '1a')).toBe('geschafft')

    const no = emptyProgress()
    attempts(no, '1a', 15, 5) // 75 %
    expect(updateDone(no, 0.8)).toEqual([])
    expect(levelMark(no, '1a')).toBe('begonnen')
  })

  it('weniger als 20 Versuche genügen nie, auch bei 100 %', () => {
    const p = emptyProgress()
    attempts(p, '1b', 19, 0)
    expect(updateDone(p, 0.8)).toEqual([])
    attempts(p, '1b', 1, 0)
    expect(updateDone(p, 0.8)).toEqual(['1b'])
  })

  it('jede Stufe kann geschafft werden, auch ohne die vorherige (nichts ist gesperrt)', () => {
    const p = emptyProgress()
    attempts(p, '1d', 20, 0)
    expect(updateDone(p, 0.8)).toEqual(['1d'])
    expect(levelMark(p, '1a')).toBe('neu')
  })

  it('geschafft bleibt gesetzt, auch wenn die Quote später sinkt; die Quote selbst sinkt sichtbar', () => {
    const p = emptyProgress()
    attempts(p, '1a', 20, 0)
    updateDone(p, 0.8)
    attempts(p, '1a', 0, 20)
    expect(updateDone(p, 0.8)).toEqual([])
    expect(levelMark(p, '1a')).toBe('geschafft')
    expect(recentStat(p, '1a').accuracy).toBe(0)
  })

  it('meldet eine Stufe nur einmal als neu geschafft', () => {
    const p = emptyProgress()
    attempts(p, '1a', 20, 0)
    expect(updateDone(p, 0.8)).toEqual(['1a'])
    attempts(p, '1a', 5, 0)
    expect(updateDone(p, 0.8)).toEqual([])
  })

  it('Schwellenwert ist konfigurierbar', () => {
    const p = emptyProgress()
    attempts(p, '1a', 18, 2) // 90 %
    expect(updateDone(p, 0.95)).toEqual([])
    expect(updateDone(p, 0.9)).toEqual(['1a'])
  })

  it('Empfehlung: erste Stufe, die noch nicht geschafft ist', () => {
    const p = emptyProgress()
    expect(recommendedLevel(p)).toBe('1a')
    attempts(p, '1a', 20, 0)
    updateDone(p, 0.8)
    expect(recommendedLevel(p)).toBe('1b')
    for (const l of ['1b', '1c', '1d', '1e'] as const) {
      attempts(p, l, 20, 0)
    }
    updateDone(p, 0.8)
    expect(recommendedLevel(p)).toBeNull()
  })
})
