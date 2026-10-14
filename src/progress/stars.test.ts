import { describe, expect, it } from 'vitest'
import { emptyProgress } from '../storage/schema'
import { LEVELS } from '../theory/tasks'
import { levelMark, levelStars, meetsDoneRule, updateDone } from './marks'

const attempts = (right: number, wrong: number) => [...Array(right).fill(true), ...Array(wrong).fill(false)] as boolean[]

describe('Sterne im Lernpfad (4.5)', () => {
  it('0 Sterne = neu', () => {
    expect(levelStars(emptyProgress(), '1a')).toBe(0)
  })

  it('1 Stern = begonnen unter 60 %, 2 Sterne = begonnen ab 60 %', () => {
    const p = emptyProgress()
    p.recent['1a'] = attempts(1, 1) // 50 %
    p.recent['1b'] = attempts(3, 2) // 60 %
    p.recent['1c'] = attempts(14, 6) // 70 %, aber noch nicht 80 %
    expect([levelStars(p, '1a'), levelStars(p, '1b'), levelStars(p, '1c')]).toEqual([1, 2, 2])
    expect(levelMark(p, '1a')).toBe('begonnen')
  })

  it('3 Sterne = geschafft, bleibt auch wenn die Quote später sinkt', () => {
    const p = emptyProgress()
    p.recent['1a'] = attempts(18, 2) // 90 % über 20
    expect(updateDone(p, 0.8)).toEqual(['1a'])
    expect(levelStars(p, '1a')).toBe(3)
    p.recent['1a'] = attempts(2, 18)
    expect(levelStars(p, '1a')).toBe(3)
  })

  it('Sterne folgen der Markierung für jede Stufe: 3 genau dann, wenn geschafft', () => {
    for (const l of LEVELS) {
      const p = emptyProgress()
      p.recent[l.id] = attempts(20, 0)
      expect(meetsDoneRule(p, l.id, 0.8)).toBe(true)
      expect(levelStars(p, l.id)).toBe(2) // Regel erfüllt, aber noch nicht gesetzt
      updateDone(p, 0.8)
      expect(levelMark(p, l.id)).toBe('geschafft')
      expect(levelStars(p, l.id)).toBe(3)
    }
  })

  it('Die Regeln für „geschafft“ sind unverändert: 19 Versuche genügen nicht', () => {
    const p = emptyProgress()
    p.recent['1a'] = attempts(19, 0)
    expect(updateDone(p, 0.8)).toEqual([])
    expect(levelStars(p, '1a')).toBe(2)
  })
})
