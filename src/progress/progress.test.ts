import { describe, expect, it } from 'vitest'
import { emptyProgress, type Progress } from '../storage/schema'
import { recentStat, recordAttempt, recordRound } from './progress'
import { isUnlocked, meetsUnlockRule, unlockHint, updateUnlocks } from './unlock'

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

describe('Freischaltung 1a → 1b → …', () => {
  it('am Anfang ist nur 1a offen', () => {
    const p = emptyProgress()
    expect(isUnlocked(p, '1a')).toBe(true)
    expect(isUnlocked(p, '1b')).toBe(false)
  })

  it('80 % über 20 Versuche schalten 1b frei, 79 % nicht', () => {
    const ok = emptyProgress()
    attempts(ok, '1a', 16, 4) // 80 %
    expect(meetsUnlockRule(ok, '1a', 0.8)).toBe(true)
    expect(updateUnlocks(ok, 0.8)).toEqual(['1b'])
    expect(isUnlocked(ok, '1b')).toBe(true)

    const no = emptyProgress()
    attempts(no, '1a', 15, 5) // 75 %
    expect(updateUnlocks(no, 0.8)).toEqual([])
    expect(isUnlocked(no, '1b')).toBe(false)
  })

  it('weniger als 20 Versuche genügen nie, auch bei 100 %', () => {
    const p = emptyProgress()
    attempts(p, '1a', 19, 0)
    expect(updateUnlocks(p, 0.8)).toEqual([])
    attempts(p, '1a', 1, 0)
    expect(updateUnlocks(p, 0.8)).toEqual(['1b'])
  })

  it('nur die jeweils nächste Stufe geht auf, nie zwei auf einmal', () => {
    const p = emptyProgress()
    attempts(p, '1a', 20, 0)
    attempts(p, '1b', 20, 0) // 1b war noch gesperrt, zählt nicht für 1c
    expect(updateUnlocks(p, 0.8)).toEqual(['1b'])
    expect(isUnlocked(p, '1c')).toBe(false)
    expect(updateUnlocks(p, 0.8)).toEqual(['1c']) // nach der nächsten Prüfung (jetzt ist 1b offen)
  })

  it('freigeschaltet bleibt freigeschaltet, auch wenn die Quote später sinkt', () => {
    const p = emptyProgress()
    attempts(p, '1a', 20, 0)
    updateUnlocks(p, 0.8)
    attempts(p, '1a', 0, 20)
    expect(updateUnlocks(p, 0.8)).toEqual([])
    expect(isUnlocked(p, '1b')).toBe(true)
  })

  it('Schwellenwert ist konfigurierbar', () => {
    const p = emptyProgress()
    attempts(p, '1a', 18, 2) // 90 %
    expect(updateUnlocks(p, 0.95)).toEqual([])
    expect(updateUnlocks(p, 0.9)).toEqual(['1b'])
  })

  it('Kette bis 1e', () => {
    const p = emptyProgress()
    for (const l of ['1a', '1b', '1c', '1d'] as const) {
      attempts(p, l, 20, 0)
      expect(updateUnlocks(p, 0.8)).toHaveLength(1)
    }
    expect(p.unlocked).toEqual(['1a', '1b', '1c', '1d', '1e'])
    expect(updateUnlocks(p, 0.8)).toEqual([])
  })

  it('Hinweis sagt, was fehlt', () => {
    const p = emptyProgress()
    expect(unlockHint(p, '1a', 0.8)).toBe('')
    expect(unlockHint(p, '1b', 0.8)).toBe('Noch 20 Versuche in 1a, mit mindestens 80 % richtig.')
    attempts(p, '1a', 5, 4)
    expect(unlockHint(p, '1b', 0.8)).toBe('Noch 11 Versuche in 1a, mit mindestens 80 % richtig.')
    attempts(p, '1a', 0, 11) // 20 Versuche, 5 richtig? (letzte 20: 4 Treffer, 16 Fehler)
    expect(unlockHint(p, '1b', 0.8)).toMatch(/^1a: \d+ % richtig über die letzten 20 Versuche\. Nötig: 80 %\.$/)
    expect(unlockHint(p, '1c', 0.8)).toBe('Erst 1b freischalten.')
  })
})
