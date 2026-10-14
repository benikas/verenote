import { Note } from 'tonal'
import { describe, expect, it } from 'vitest'
import { ENTRIES, INTERVAL_CARDS, TOPICS, entry, introId, parseInhalte } from './inhalte'
import { LEVELS } from '../theory/tasks'

const midi = (n: string) => Note.midi(n) as number
const LOW = midi('C2')
const HIGH = midi('C6')

describe('Inhalte: Vollständigkeit', () => {
  it('jede Stufe hat eine Einführung mit Titel und Text', () => {
    for (const l of LEVELS) {
      const e = entry(introId(l.id))
      expect(e, l.id).toBeDefined()
      expect(e!.title.length).toBeGreaterThan(0)
      expect(e!.paragraphs.length).toBeGreaterThan(0)
      expect(e!.area).toBe(l.kind)
    }
  })
  it('vier Themen und 13 Intervall-Karten (0 bis 12)', () => {
    expect(TOPICS.map((t) => t.id)).toEqual(['thema-toene', 'thema-referenz', 'thema-intervalle', 'thema-neutralisieren'])
    expect(INTERVAL_CARDS.map((c) => c.id)).toEqual(Array.from({ length: 13 }, (_, i) => `intervall-${i}`))
  })
  it('keine doppelten Ids, jeder Eintrag hat Titel und Text', () => {
    const ids = ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of ENTRIES) {
      expect(e.title, e.id).not.toBe('')
      expect(e.paragraphs.length, e.id).toBeGreaterThan(0)
    }
  })
  it('jeder Eintrag hat Hörbeispiele (ausser „Gehör neutralisieren“: dort gibt es nichts Sinnvolles vorzuspielen)', () => {
    for (const e of ENTRIES.filter((x) => x.id !== 'thema-neutralisieren')) expect(e.examples.length, e.id).toBeGreaterThan(0)
  })
})

describe('Inhalte: Hörbeispiele', () => {
  it('alle Töne liegen im Tonraum C2 bis C6', () => {
    for (const e of ENTRIES)
      for (const ex of e.examples)
        for (const n of ex.groups.flat()) {
          expect(midi(n), `${e.id} ${ex.name} ${n}`).toBeGreaterThanOrEqual(LOW)
          expect(midi(n), `${e.id} ${ex.name} ${n}`).toBeLessThanOrEqual(HIGH)
        }
  })
  it('Intervall-Karten: nacheinander/gleichzeitig mit zwei Tönen haben N Halbtöne Abstand', () => {
    for (const c of INTERVAL_CARDS) {
      const n = Number(c.id.slice('intervall-'.length))
      for (const ex of c.examples) {
        if (ex.kind === 'folge') continue
        const [a, b] = ex.groups[0]
        expect(ex.groups[0].length, `${c.id} ${ex.name}`).toBe(2)
        expect(Math.abs(midi(b) - midi(a)), `${c.id} ${ex.name}`).toBe(n)
      }
    }
  })
  it('Intervall-Karten: „aufwärts“ steigt, „abwärts“ fällt', () => {
    for (const c of INTERVAL_CARDS)
      for (const ex of c.examples) {
        const [a, b] = ex.groups[0]
        if (/abwärts/.test(ex.name)) expect(midi(b) < midi(a), `${c.id} ${ex.name}`).toBe(true)
        if (/aufwärts/.test(ex.name)) expect(midi(b) > midi(a), `${c.id} ${ex.name}`).toBe(true)
      }
  })
  it('Vergleichs-Folgen haben mehrere Gruppen, jede mit zwei Tönen oder mehr', () => {
    for (const e of ENTRIES)
      for (const ex of e.examples)
        if (ex.kind === 'folge') {
          expect(ex.groups.length, `${e.id} ${ex.name}`).toBeGreaterThan(1)
          for (const g of ex.groups) expect(g.length).toBeGreaterThanOrEqual(2)
        }
  })
  it('Stufenbeispiele: Intervall-Stufe 2e mit Abwärts-Beispielen, 2f gleichzeitig', () => {
    expect(entry('stufe-2e')!.examples.every((x) => midi(x.groups[0][1]) < midi(x.groups[0][0]))).toBe(true)
    expect(entry('stufe-2f')!.examples.every((x) => x.kind === 'gleichzeitig')).toBe(true)
  })
})

describe('Inhalte: Merksätze', () => {
  it('Prime und grosse Septime haben bewusst keinen Merksatz', () => {
    expect(entry('intervall-0')!.mnemonics).toEqual([])
    expect(entry('intervall-11')!.mnemonics).toEqual([])
  })
  it('Lieder, die nicht eindeutig geprüft werden konnten, sind nicht enthalten', () => {
    const titles = ENTRIES.flatMap((e) => e.mnemonics.map((m) => m.title))
    expect(titles.some((t) => /Nachtmusik|Love Story/.test(t))).toBe(false)
    expect(titles.length).toBeGreaterThan(10)
  })
  it('jeder Merksatz hat Titel, Hinweis und Richtung', () => {
    for (const c of INTERVAL_CARDS)
      for (const m of c.mnemonics) {
        expect(m.title).not.toBe('')
        expect(m.hint).not.toBe('')
        expect(['aufwärts', 'abwärts']).toContain(m.direction)
      }
  })
})

describe('Parser', () => {
  const src = `## x\nTitel: T\nBereich: notes\nText:\nErste Zeile\nzweite Zeile\n\nAbsatz zwei\nTipp: Tipp!\nHörbeispiele:\n- A | folge | C4 D4 ; E4 F4\nMerksätze:\n- ⚠ Lied | Hinweis | abwärts\n\n---\n`
  it('liest Absätze, Tipp, Folge und ⚠', () => {
    const [e] = parseInhalte(src)
    expect(e.paragraphs).toEqual(['Erste Zeile zweite Zeile', 'Absatz zwei'])
    expect(e.tip).toBe('Tipp!')
    expect(e.examples[0].groups).toEqual([['C4', 'D4'], ['E4', 'F4']])
    expect(e.mnemonics[0]).toMatchObject({ title: 'Lied', uncertain: true, direction: 'abwärts' })
  })
  it('meldet fehlerhafte Zeilen', () => {
    expect(() => parseInhalte('## x\nHörbeispiele:\n- A | nacheinander | H4 C5')).toThrow()
    expect(() => parseInhalte('## x\nHörbeispiele:\n- A | irgendwie | C4')).toThrow()
    expect(() => parseInhalte('## x\nMerksätze:\n- A | b | seitwärts')).toThrow()
  })
})
