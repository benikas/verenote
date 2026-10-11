import { describe, expect, it } from 'vitest'
import { seededRng } from '../shared/rng'
import { Note } from 'tonal'
import {
  NEUTRAL_HIGH,
  NEUTRAL_LOW,
  NEUTRAL_MIN_SPAN,
  NEUTRAL_TONE_COUNT,
  intervalClass,
  makeNeutralization,
  type NeutralLength,
} from './neutral'
import { chroma } from './notes'

const midis = (notes: string[]) => notes.map((n) => Note.midi(n)!)
const LENGTHS: NeutralLength[] = ['short', 'long']
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)

describe('Gehör neutralisieren: Generator', () => {
  it('Länge: kurz 4, lang 6 Töne', () => {
    expect(NEUTRAL_TONE_COUNT).toEqual({ short: 4, long: 6 })
    for (const seed of SEEDS) {
      expect(makeNeutralization('short', seededRng(seed))).toHaveLength(4)
      expect(makeNeutralization('long', seededRng(seed))).toHaveLength(6)
    }
  })

  it('Tonumfang: alle Töne in C3–B5, mindestens zwei Oktaven Spannweite', () => {
    for (const length of LENGTHS) {
      for (const seed of SEEDS) {
        const m = midis(makeNeutralization(length, seededRng(seed)))
        expect(Math.min(...m)).toBeGreaterThanOrEqual(NEUTRAL_LOW)
        expect(Math.max(...m)).toBeLessThanOrEqual(NEUTRAL_HIGH)
        expect(Math.max(...m) - Math.min(...m)).toBeGreaterThanOrEqual(NEUTRAL_MIN_SPAN)
      }
    }
  })

  it('keine Wiederholung: jede Pitch Class höchstens einmal', () => {
    for (const length of LENGTHS) {
      for (const seed of SEEDS) {
        const notes = makeNeutralization(length, seededRng(seed))
        expect(new Set(notes.map(chroma)).size).toBe(notes.length)
      }
    }
  })

  it('endet nicht auf dem Referenzton C', () => {
    for (const length of LENGTHS) {
      for (const seed of SEEDS) {
        const notes = makeNeutralization(length, seededRng(seed))
        expect(chroma(notes.at(-1)!)).not.toBe(chroma('C'))
      }
    }
  })

  it('keine erkennbare Tonart: Nachbartöne nur Halbton, Ganzton oder Tritonus', () => {
    for (const length of LENGTHS) {
      for (const seed of SEEDS) {
        const m = midis(makeNeutralization(length, seededRng(seed)))
        for (let i = 1; i < m.length; i++) {
          expect([1, 2, 6]).toContain(intervalClass(m[i - 1], m[i]))
        }
      }
    }
  })

  it('andere Referenz: endet nicht auf deren Pitch Class', () => {
    for (const seed of SEEDS) {
      const notes = makeNeutralization('short', seededRng(seed), 'F#4')
      expect(chroma(notes.at(-1)!)).not.toBe(chroma('F#'))
    }
  })

  it('ist mit gleichem Seed reproduzierbar und variiert mit anderem Seed', () => {
    expect(makeNeutralization('long', seededRng(5))).toEqual(makeNeutralization('long', seededRng(5)))
    const variants = new Set(SEEDS.map((s) => makeNeutralization('short', seededRng(s)).join()))
    expect(variants.size).toBeGreaterThan(100)
  })

  it('Notennamen sind gültig und tragen eine Oktave', () => {
    for (const n of makeNeutralization('long', seededRng(3))) {
      expect(Note.get(n).oct).toBeDefined()
      expect(Note.midi(n)).not.toBeNull()
    }
  })

  it('unbekannte Länge wirft', () => {
    expect(() => makeNeutralization('mittel' as never, seededRng(1))).toThrow()
  })
})

describe('Intervallklasse', () => {
  it('faltet auf eine Oktave und spiegelt', () => {
    expect(intervalClass(60, 61)).toBe(1)
    expect(intervalClass(60, 71)).toBe(1) // große Septime = kleine Sekunde
    expect(intervalClass(60, 72)).toBe(0)
    expect(intervalClass(60, 66)).toBe(6)
    expect(intervalClass(72, 60)).toBe(0)
    expect(intervalClass(60, 64)).toBe(4)
  })
})
