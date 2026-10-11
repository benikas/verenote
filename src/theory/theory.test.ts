import { describe, expect, it } from 'vitest'
import {
  CHROMATIC_SHARPS,
  REFERENCE_NOTE,
  STAMMTOENE,
  chroma,
  pitchClass,
  samePitchClass,
  semitonesBetween,
  withOctave,
} from './notes'
import { LEVELS, getLevel, itemKey, makeTask } from './tasks'

describe('Noten', () => {
  it('Stammtöne sind C bis B in englischer Schreibweise', () => {
    expect([...STAMMTOENE]).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  })

  it('chromatische Reihe hat 12 verschiedene Töne', () => {
    expect(CHROMATIC_SHARPS).toHaveLength(12)
    expect(new Set(CHROMATIC_SHARPS.map(chroma)).size).toBe(12)
  })

  it('Pitch Class und Halbtonposition', () => {
    expect(pitchClass('E4')).toBe('E')
    expect(pitchClass('Db3')).toBe('Db')
    expect(chroma('C')).toBe(0)
    expect(chroma('B')).toBe(11)
  })

  it('enharmonisch gleiche Töne zählen als gleich, Oktave ist egal', () => {
    expect(samePitchClass('C#4', 'Db5')).toBe(true)
    expect(samePitchClass('E4', 'F4')).toBe(false)
  })

  it('Abstand in Halbtönen', () => {
    expect(semitonesBetween('C4', 'E4')).toBe(4)
    expect(semitonesBetween('C4', 'G4')).toBe(7)
    expect(semitonesBetween('E4', 'C4')).toBe(-4)
  })

  it('ungültige Namen werfen einen Fehler', () => {
    expect(() => pitchClass('X9')).toThrow()
    expect(() => chroma('hello')).toThrow()
  })

  it('withOctave setzt die Oktave an', () => {
    expect(withOctave('F#', 3)).toBe('F#3')
  })
})

describe('Stufen 1a–c', () => {
  it('sind 1a, 1b, 1c und wachsen schrittweise', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['1a', '1b', '1c'])
    const [a, b, c] = LEVELS
    expect(a.notes).toEqual(['C', 'E', 'G'])
    expect(b.notes).toEqual(['C', 'D', 'E', 'F', 'G'])
    expect(c.notes).toEqual([...STAMMTOENE])
    for (const n of a.notes) expect(b.notes).toContain(n)
    for (const n of b.notes) expect(c.notes).toContain(n)
  })

  it('getLevel findet Stufen und wirft bei unbekannten', () => {
    expect(getLevel('1b').notes).toHaveLength(5)
    expect(() => getLevel('9z' as never)).toThrow()
  })
})

describe('Aufgabe als Daten', () => {
  it('Referenz ist C4, Zielton liegt in Oktave 4', () => {
    const t = makeTask(1, '1c', 'E')
    expect(t).toEqual({ id: 1, level: '1c', reference: 'C4', target: 'E4' })
    expect(t.reference).toBe(REFERENCE_NOTE)
  })

  it('Zielton außerhalb der Stufe wird abgelehnt', () => {
    expect(() => makeTask(1, '1a', 'D')).toThrow()
  })

  it('jeder Ton jeder Stufe lässt sich als Aufgabe bauen', () => {
    for (const level of LEVELS) {
      for (const n of level.notes) {
        expect(makeTask(1, level.id, n).target).toBe(`${n}4`)
      }
    }
  })

  it('Item-Schlüssel: Zielton und Referenz', () => {
    expect(itemKey(makeTask(1, '1a', 'E'))).toBe('E|C')
  })
})
