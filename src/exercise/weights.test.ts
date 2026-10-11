import { describe, expect, it } from 'vitest'
import { seededRng } from '../shared/rng'
import { Session } from './session'
import { MAX_BONUS, NEW_ITEM_WEIGHT, historyWeight } from './weights'
import type { ItemStat } from '../storage/schema'

describe('Gewicht aus dem Fehlerstand', () => {
  it('neue Items liegen zwischen sicheren und oft verfehlten', () => {
    const safe = historyWeight({ hits: 30, misses: 0 })
    const bad = historyWeight({ hits: 2, misses: 20 })
    expect(safe).toBe(1)
    expect(historyWeight(undefined)).toBe(NEW_ITEM_WEIGHT)
    expect(historyWeight({ hits: 0, misses: 0 })).toBe(NEW_ITEM_WEIGHT)
    expect(bad).toBeGreaterThan(NEW_ITEM_WEIGHT)
    expect(safe).toBeLessThan(NEW_ITEM_WEIGHT)
  })

  it('wächst mit der Fehlerquote, bleibt aber zwischen 1 und 1 + MAX_BONUS', () => {
    const w = (hits: number, misses: number) => historyWeight({ hits, misses })
    expect(w(10, 0)).toBeLessThan(w(8, 2))
    expect(w(8, 2)).toBeLessThan(w(2, 8))
    expect(w(0, 1000)).toBeLessThan(1 + MAX_BONUS)
    expect(w(1000, 0)).toBeGreaterThanOrEqual(1)
  })

  it('ein einzelner Fehler zählt weniger als viele', () => {
    expect(historyWeight({ hits: 0, misses: 1 })).toBeLessThan(historyWeight({ hits: 0, misses: 10 }))
  })
})

/** Eine Session mit gespeichertem Fehlerstand: wie oft kommt welches Item vor? */
function counts(history: Record<string, ItemStat>, level: '1a' | '2a', rounds = 400) {
  const result: Record<string, number> = {}
  for (let r = 0; r < rounds; r++) {
    const s = new Session({
      level,
      length: 10,
      rng: seededRng(r + 1),
      history: (k) => history[k],
    })
    while (!s.done) {
      const t = s.next()
      const key = t.kind === 'notes' ? `${t.target.replace(/\d/g, '')}|C` : `int:${t.semitones}:up`
      result[key] = (result[key] ?? 0) + 1
      s.answer(t.kind === 'notes' ? t.target : t.semitones) // immer richtig, nur die Auswahl zählt
    }
  }
  return result
}

describe('Aufgabenauswahl mit gespeichertem Fehlerstand (über Runden hinweg)', () => {
  it('Grundtöne: oft verfehltes Item kommt in der nächsten Runde öfter dran', () => {
    const c = counts({ 'E|C': { hits: 2, misses: 18 }, 'C|C': { hits: 20, misses: 0 }, 'G|C': { hits: 20, misses: 0 } }, '1a')
    expect(c['E|C']).toBeGreaterThan(c['C|C'] * 1.4)
    expect(c['E|C']).toBeGreaterThan(c['G|C'] * 1.4)
  })

  it('Intervalle: gleiche Wirkung', () => {
    const c = counts({ 'int:7:up': { hits: 1, misses: 15 }, 'int:0:up': { hits: 20, misses: 0 }, 'int:12:up': { hits: 20, misses: 0 } }, '2a')
    expect(c['int:7:up']).toBeGreaterThan(c['int:0:up'] * 1.4)
    expect(c['int:7:up']).toBeGreaterThan(c['int:12:up'] * 1.4)
  })

  it('kein Item verhungert, auch ein sicheres nicht', () => {
    const c = counts({ 'E|C': { hits: 0, misses: 50 }, 'C|C': { hits: 80, misses: 0 }, 'G|C': { hits: 80, misses: 0 } }, '1a')
    expect(c['C|C']).toBeGreaterThan(100)
    expect(c['G|C']).toBeGreaterThan(100)
  })

  it('neue Items kommen vor sicheren', () => {
    const c = counts({ 'C|C': { hits: 40, misses: 0 }, 'G|C': { hits: 40, misses: 0 } }, '1a') // E ist neu
    expect(c['E|C']).toBeGreaterThan(c['C|C'] * 1.5)
    expect(c['E|C']).toBeGreaterThan(c['G|C'] * 1.5)
  })

  it('ohne Fehlerstand: alle Items ungefähr gleich oft', () => {
    const c = counts({}, '1a')
    const vals = Object.values(c)
    expect(Math.max(...vals) / Math.min(...vals)).toBeLessThan(1.25)
  })

  it('dasselbe Item nie zweimal hintereinander', () => {
    const s = new Session({ level: '2a', length: 60, rng: seededRng(5) })
    let last = ''
    while (!s.done) {
      const t = s.next()
      if (t.kind !== 'intervals') throw new Error('Intervall erwartet')
      expect(t.semitones).not.toBe(last)
      last = t.semitones as unknown as string
      s.answer(t.semitones)
    }
  })

  it('Intervall-Session: Antwort per Halbtonzahl, Zusammenfassung je Intervall', () => {
    const s = new Session({ level: '2a', length: 6, rng: seededRng(2) })
    let wrongOnce = false
    while (!s.done) {
      const t = s.next()
      if (t.kind !== 'intervals') throw new Error('Intervall erwartet')
      if (!wrongOnce) {
        wrongOnce = true
        const r = s.answer(t.semitones === 7 ? 5 : 7)
        expect(r.correct).toBe(false)
        expect(r.expected).toBe(String(t.semitones))
      } else {
        expect(s.answer(String(t.semitones)).correct).toBe(true)
      }
    }
    const sum = s.summary()
    expect(sum.total).toBe(6)
    expect(sum.correct).toBe(5)
    expect(sum.perItem.map((i) => i.label)).toEqual(['Prime', 'Quinte ↑', 'Oktave ↑'])
    expect(sum.perItem.reduce((n, i) => n + i.attempts, 0)).toBe(6)
    expect(sum.perNote).toEqual([])
  })
})
