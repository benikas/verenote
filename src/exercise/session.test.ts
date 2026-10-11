import { describe, expect, it } from 'vitest'
import { pickWeighted, seededRng } from '../shared/rng'
import { Session } from './session'

const make = (level: '1a' | '1b' | '1c' = '1c', length = 10, seed = 1) =>
  new Session({ level, length, rng: seededRng(seed) })

describe('Zufall', () => {
  it('seededRng ist deterministisch und liegt in [0, 1)', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    for (let i = 0; i < 100; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('pickWeighted folgt den Gewichten', () => {
    const rng = seededRng(7)
    const counts = [0, 0]
    for (let i = 0; i < 4000; i++) counts[pickWeighted([1, 3], rng)]++
    expect(counts[1] / 4000).toBeGreaterThan(0.7)
    expect(counts[1] / 4000).toBeLessThan(0.8)
  })

  it('pickWeighted lehnt leere oder null-Gewichte ab', () => {
    expect(() => pickWeighted([], seededRng(1))).toThrow()
    expect(() => pickWeighted([0, 0], seededRng(1))).toThrow()
  })
})

describe('Session: Ablauf', () => {
  it('erzeugt Aufgaben mit Referenz C4 und Zielton aus der Stufe', () => {
    const s = make('1a')
    for (let i = 0; i < 10; i++) {
      const t = s.next()
      expect(t.reference).toBe('C4')
      expect(['C4', 'E4', 'G4']).toContain(t.target)
      expect(t.id).toBe(i + 1)
      s.answer('C')
    }
  })

  it('ist nach length Antworten fertig und erlaubt keine weitere Aufgabe', () => {
    const s = make('1b', 3)
    expect(s.done).toBe(false)
    for (let i = 0; i < 3; i++) {
      s.next()
      s.answer('C')
    }
    expect(s.done).toBe(true)
    expect(s.answered).toBe(3)
    expect(() => s.next()).toThrow()
  })

  it('verlangt die Antwort, bevor die nächste Aufgabe kommt', () => {
    const s = make()
    s.next()
    expect(() => s.next()).toThrow()
    expect(() => make().answer('C')).toThrow()
  })

  it('lehnt unsinnige Längen ab', () => {
    expect(() => new Session({ level: '1a', length: 0 })).toThrow()
    expect(() => new Session({ level: '1a', length: 2.5 })).toThrow()
  })

  it('current zeigt die offene Aufgabe', () => {
    const s = make()
    expect(s.current).toBeNull()
    const t = s.next()
    expect(s.current).toBe(t)
    s.answer('C')
    expect(s.current).toBeNull()
  })
})

describe('Session: Bewertung', () => {
  it('richtige und falsche Antworten, mit und ohne Oktave', () => {
    const s = make('1a', 3)
    const t1 = s.next()
    const ok = s.answer(t1.target)
    expect(ok).toMatchObject({ correct: true, given: t1.target.slice(0, -1) })

    const t2 = s.next()
    const wrong = ['C', 'E', 'G'].find((n) => n !== t2.target.slice(0, -1))!
    const bad = s.answer(wrong)
    expect(bad.correct).toBe(false)
    expect(bad.expected).toBe(t2.target.slice(0, -1))
    expect(bad.given).toBe(wrong)
  })

  it('enharmonisch gleiche Antwort zählt als richtig', () => {
    // E ist enharmonisch Fb: gleiche Pitch Class
    const s = new Session({ level: '1a', length: 20, rng: seededRng(3) })
    let found = false
    for (let i = 0; i < 20 && !found; i++) {
      const t = s.next()
      if (t.target === 'E4') {
        expect(s.answer('Fb').correct).toBe(true)
        found = true
      } else s.answer(t.target)
    }
    expect(found).toBe(true)
  })

  it('ungültige Antwort wirft', () => {
    const s = make()
    s.next()
    expect(() => s.answer('X')).toThrow()
  })
})

describe('Session: Wiederholung von Fehlern', () => {
  it('derselbe Zielton kommt nie zweimal hintereinander', () => {
    const s = make('1b', 200, 5)
    let last = ''
    for (let i = 0; i < 200; i++) {
      const t = s.next()
      expect(t.target).not.toBe(last)
      last = t.target
      s.answer(t.target)
    }
  })

  it('verfehlte Töne kommen deutlich öfter dran', () => {
    // Stufe 1c, G wird immer falsch beantwortet, alles andere richtig
    const s = make('1c', 1400, 11)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 1400; i++) {
      const t = s.next()
      const pc = t.target.slice(0, -1)
      counts[pc] = (counts[pc] ?? 0) + 1
      s.answer(pc === 'G' ? 'A' : pc)
    }
    const others = Object.entries(counts)
      .filter(([n]) => n !== 'G')
      .map(([, c]) => c)
    const avgOthers = others.reduce((a, b) => a + b, 0) / others.length
    expect(counts.G).toBeGreaterThan(avgOthers * 2)
  })

  it('der Zusatz klingt nach richtigen Antworten wieder ab', () => {
    // Erst G falsch, dann wieder richtig: am Ende nähert sich G dem Durchschnitt
    const s = make('1c', 1500, 21)
    const late: Record<string, number> = {}
    for (let i = 0; i < 1500; i++) {
      const t = s.next()
      const pc = t.target.slice(0, -1)
      const wrongPhase = i < 60 && pc === 'G'
      if (i >= 500) late[pc] = (late[pc] ?? 0) + 1
      s.answer(wrongPhase ? 'A' : pc)
    }
    const others = Object.entries(late)
      .filter(([n]) => n !== 'G')
      .map(([, c]) => c)
    const avgOthers = others.reduce((a, b) => a + b, 0) / others.length
    expect(late.G).toBeLessThan(avgOthers * 1.4)
    expect(late.G).toBeGreaterThan(avgOthers * 0.6)
  })
})

describe('Session: Zusammenfassung', () => {
  it('berechnet Trefferquote und Aufschlüsselung pro Ton', () => {
    const s = make('1a', 12, 9)
    for (let i = 0; i < 12; i++) {
      const t = s.next()
      const pc = t.target.slice(0, -1)
      // C immer richtig, E immer falsch, G immer richtig
      s.answer(pc === 'E' ? 'G' : pc)
    }
    const sum = s.summary()
    expect(sum.total).toBe(12)
    expect(sum.level).toBe('1a')
    expect(sum.perNote.map((n) => n.note)).toEqual(['C', 'E', 'G'])
    expect(sum.perNote.reduce((a, n) => a + n.attempts, 0)).toBe(12)

    const e = sum.perNote.find((n) => n.note === 'E')!
    expect(e.correct).toBe(0)
    const rest = sum.perNote.filter((n) => n.note !== 'E')
    for (const n of rest) expect(n.correct).toBe(n.attempts)

    expect(sum.correct).toBe(12 - e.attempts)
    expect(sum.accuracy).toBeCloseTo(sum.correct / 12)
    expect(sum.answers).toHaveLength(12)
  })

  it('ohne Antworten ist die Trefferquote 0', () => {
    const sum = make().summary()
    expect(sum).toMatchObject({ total: 0, correct: 0, accuracy: 0 })
  })
})

describe('Stufen 1d und 1e in der Session', () => {
  it('1d: Zielton in den Oktaven 3, 4 und 5, jeder Ton aus den Stammtönen', () => {
    const s = new Session({ level: '1d', length: 60, rng: seededRng(7) })
    const octaves = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const t = s.next()
      octaves.add(t.target.slice(-1))
      expect(['C', 'D', 'E', 'F', 'G', 'A', 'B']).toContain(t.target.slice(0, -1))
      s.answer(t.target)
    }
    expect([...octaves].sort()).toEqual(['3', '4', '5'])
  })

  it('1e: alle zwölf Töne kommen vor, Antwort mit Kreuz wird richtig bewertet', () => {
    const s = new Session({ level: '1e', length: 80, rng: seededRng(3) })
    const notes = new Set<string>()
    for (let i = 0; i < 80; i++) {
      const t = s.next()
      notes.add(t.target.slice(0, -1))
      expect(s.answer(t.target.slice(0, -1)).correct).toBe(true)
    }
    expect(notes.size).toBe(12)
    expect(notes.has('F#')).toBe(true)
  })
})
