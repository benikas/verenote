import { Note } from 'tonal'
import { describe, expect, it } from 'vitest'
import { seededRng } from '../shared/rng'
import {
  INTERVALS,
  PLAY_HIGH,
  PLAY_LOW,
  intervalKey,
  intervalName,
  makeIntervalTask,
  parseIntervalKey,
} from './intervals'
import { INTERVAL_LEVELS, LEVELS, nextLevel } from './tasks'
import { expectedAnswer, itemLabel, levelPractice, poolFor, taskFromItem, taskKey } from './practice'

describe('Intervalle', () => {
  it('13 Intervalle von Prime bis Oktave mit deutschen Namen', () => {
    expect(INTERVALS).toHaveLength(13)
    expect(INTERVALS.map((i) => i.semitones)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(intervalName(0)).toBe('Prime')
    expect(intervalName(4)).toBe('Grosse Terz')
    expect(intervalName(6)).toBe('Tritonus')
    expect(intervalName(12)).toBe('Oktave')
    expect(() => intervalName(13)).toThrow()
  })

  it('alle 13 Intervalle aufwärts: zweiter Ton liegt genau so viele Halbtöne höher', () => {
    for (const { semitones } of INTERVALS) {
      const t = makeIntervalTask(1, null, semitones, 'up', 'melodic', 60)
      expect(t.start).toBe('C4')
      expect((Note.midi(t.second) as number) - 60).toBe(semitones)
      expect(t.direction).toBe('up')
    }
  })

  it('alle Intervalle abwärts: zweiter Ton liegt tiefer (Prime bleibt gleich)', () => {
    for (const { semitones } of INTERVALS) {
      const t = makeIntervalTask(1, null, semitones, 'down', 'melodic', 60)
      expect((Note.midi(t.second) as number) - 60 + 0).toBe(-semitones + 0)
      expect(t.direction).toBe(semitones === 0 ? 'up' : 'down')
    }
    expect(makeIntervalTask(1, null, 7, 'down', 'melodic', 60).second).toBe('F3')
  })

  it('harmonisch: zweiter Ton liegt immer über dem Startton', () => {
    const t = makeIntervalTask(1, null, 7, 'down', 'harmonic', 60)
    expect(t.second).toBe('G4')
    expect(t.direction).toBe('up')
    expect(t.mode).toBe('harmonic')
  })

  it('Tonraum: beide Töne bleiben zwischen C2 und C6', () => {
    expect(() => makeIntervalTask(1, null, 12, 'up', 'melodic', PLAY_HIGH - 11)).toThrow()
    expect(() => makeIntervalTask(1, null, 12, 'down', 'melodic', PLAY_LOW + 11)).toThrow()
    expect(() => makeIntervalTask(1, null, 13, 'up', 'melodic', 60)).toThrow()
    expect(makeIntervalTask(1, null, 12, 'up', 'melodic', PLAY_HIGH - 12).second).toBe('C6')
  })

  it('Schlüssel: melodisch auf/ab, harmonisch; Prime ist immer „up“', () => {
    expect(intervalKey(4, 'up', 'melodic')).toBe('int:4:up')
    expect(intervalKey(4, 'down', 'melodic')).toBe('int:4:down')
    expect(intervalKey(4, 'down', 'harmonic')).toBe('int:4:harm')
    expect(intervalKey(0, 'down', 'melodic')).toBe('int:0:up')
    expect(parseIntervalKey('int:7:harm')).toEqual({ semitones: 7, variant: 'harm' })
    expect(parseIntervalKey('E|C')).toBeNull()
    expect(parseIntervalKey('int:99:up')).toBeNull()
  })
})

describe('Stufen 2a–2f', () => {
  it('sechs Stufen nach den Vorgaben im Konzept', () => {
    expect(INTERVAL_LEVELS.map((l) => l.id)).toEqual(['2a', '2b', '2c', '2d', '2e', '2f'])
    const byId = Object.fromEntries(INTERVAL_LEVELS.map((l) => [l.id, l]))
    expect(byId['2a'].intervals).toEqual([0, 7, 12])
    expect(byId['2b'].intervals).toEqual([0, 4, 5, 7, 12])
    expect(byId['2c'].intervals).toHaveLength(7)
    expect(byId['2d'].intervals).toHaveLength(13)
    expect(byId['2a'].start).toBe('fixed')
    expect(byId['2d'].start).toBe('random')
    expect(byId['2e'].directions).toEqual(['down'])
    expect(byId['2f'].modes).toEqual(['harmonic'])
  })

  it('wachsen schrittweise (a ⊂ b ⊂ c ⊂ d)', () => {
    const [a, b, c, d] = INTERVAL_LEVELS
    for (const n of a.intervals) expect(b.intervals).toContain(n)
    for (const n of b.intervals) expect(c.intervals).toContain(n)
    for (const n of c.intervals) expect(d.intervals).toContain(n)
  })

  it('Lernpfad: 1e → 2a, 2f ist die letzte Stufe', () => {
    expect(LEVELS).toHaveLength(11)
    expect(nextLevel('1e')).toBe('2a')
    expect(nextLevel('2f')).toBeNull()
  })

  it('Pool: Prime „abwärts“ zählt nicht doppelt, harmonisch hat eine Variante je Intervall', () => {
    expect(poolFor(levelPractice('2a')).map((i) => i.key)).toEqual(['int:0:up', 'int:7:up', 'int:12:up'])
    expect(poolFor(levelPractice('2e'))).toHaveLength(13)
    expect(poolFor(levelPractice('2e')).filter((i) => i.key.endsWith(':down'))).toHaveLength(12)
    expect(poolFor(levelPractice('2f')).every((i) => i.key.endsWith(':harm'))).toBe(true)
    const both = poolFor({ type: 'intervals', intervals: [0, 4], directions: ['up', 'down'], modes: ['melodic', 'harmonic'], start: 'fixed' })
    expect(both.map((i) => i.key)).toEqual(['int:0:up', 'int:0:harm', 'int:4:up', 'int:4:down', 'int:4:harm'])
  })

  it('Startton: 2a–2c fest C4, 2d–2f zufällig zwischen C3 und C5, immer spielbar', () => {
    for (const l of INTERVAL_LEVELS) {
      const practice = levelPractice(l.id)
      const rng = seededRng(42)
      const starts = new Set<string>()
      for (let n = 0; n < 400; n++) {
        for (const item of poolFor(practice)) {
          const t = taskFromItem(item, n, l.id, practice, rng)
          if (t.kind !== 'intervals') throw new Error('Intervall erwartet')
          starts.add(t.start)
          const a = Note.midi(t.start) as number
          const b = Note.midi(t.second) as number
          expect(a).toBeGreaterThanOrEqual(PLAY_LOW)
          expect(Math.min(a, b)).toBeGreaterThanOrEqual(PLAY_LOW)
          expect(Math.max(a, b)).toBeLessThanOrEqual(PLAY_HIGH)
          expect(Math.abs(b - a)).toBe(t.semitones)
          expect(taskKey(t)).toBe(item.key)
          expect(expectedAnswer(t)).toBe(String(t.semitones))
        }
      }
      if (l.start === 'fixed') expect([...starts]).toEqual(['C4'])
      else {
        expect(starts.size).toBeGreaterThan(15)
        for (const s of starts) {
          const m = Note.midi(s) as number
          expect(m).toBeGreaterThanOrEqual(48)
          expect(m).toBeLessThanOrEqual(72)
        }
      }
    }
  })

  it('Beschriftung der Items', () => {
    expect(itemLabel('int:4:up')).toBe('Grosse Terz ↑')
    expect(itemLabel('int:4:down')).toBe('Grosse Terz ↓')
    expect(itemLabel('int:4:harm')).toBe('Grosse Terz gleichzeitig')
    expect(itemLabel('int:0:up')).toBe('Prime')
    expect(itemLabel('F#|C')).toBe('F#/Gb')
  })
})
