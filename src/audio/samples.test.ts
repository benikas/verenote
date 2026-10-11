import { describe, expect, it } from 'vitest'
import { CHROMATIC_SHARPS, STAMMTOENE } from '../theory/notes'
import { makeTask } from '../theory/tasks'
import { frequencyOf, sampleFor, sampleNames } from './samples'

describe('Notenname -> Frequenz (B1)', () => {
  it('Referenzwerte', () => {
    expect(frequencyOf('C4')).toBeCloseTo(261.63, 2)
    expect(frequencyOf('E4')).toBeCloseTo(329.63, 2)
    expect(frequencyOf('F4')).toBeCloseTo(349.23, 2)
    expect(frequencyOf('A4')).toBeCloseTo(440, 2)
    expect(frequencyOf('B3')).toBeCloseTo(246.94, 2)
    expect(frequencyOf('C5')).toBeCloseTo(523.25, 2)
  })

  it('alle 12 Töne in allen Oktaven 1–7 stimmen mit der Gleichstufigkeit überein', () => {
    for (let o = 1; o <= 7; o++) {
      CHROMATIC_SHARPS.forEach((pc, i) => {
        const midi = 12 * (o + 1) + i
        expect(frequencyOf(`${pc}${o}`)).toBeCloseTo(440 * 2 ** ((midi - 69) / 12), 6)
      })
    }
  })

  it('E klingt tiefer als F, B tiefer als C der nächsten Oktave (je ein Halbton)', () => {
    for (let o = 2; o <= 6; o++) {
      expect(frequencyOf(`F${o}`) / frequencyOf(`E${o}`)).toBeCloseTo(2 ** (1 / 12), 9)
      expect(frequencyOf(`C${o + 1}`) / frequencyOf(`B${o}`)).toBeCloseTo(2 ** (1 / 12), 9)
    }
  })

  it('Aufgabe: Zielton hat genau die Frequenz seines Namens (alle Stammtöne)', () => {
    for (const pc of STAMMTOENE) {
      const task = makeTask(1, '1c', pc)
      expect(task.target).toBe(`${pc}4`)
      expect(frequencyOf(task.target)).toBe(frequencyOf(`${pc}4`))
    }
  })
})

describe('Notenname -> Sample und Verschiebung (Sampler)', () => {
  it('E4 kommt aus D#4 (+1), F4 aus F#4 (−1): nicht vertauscht', () => {
    expect(sampleFor('E4')).toEqual({ sample: 'D#4', shift: 1 })
    expect(sampleFor('F4')).toEqual({ sample: 'F#4', shift: -1 })
    expect(sampleFor('B4')).toEqual({ sample: 'C5', shift: -1 })
    expect(sampleFor('C4')).toEqual({ sample: 'C4', shift: 0 })
    expect(sampleFor('G#4')).toEqual({ sample: 'A4', shift: -1 })
  })

  it('Sample-Frequenz × Verschiebung ergibt die Zielfrequenz, höchstens ±1 Halbton', () => {
    for (let o = 2; o <= 6; o++) {
      for (const pc of CHROMATIC_SHARPS) {
        const note = `${pc}${o}`
        const { sample, shift } = sampleFor(note)
        expect(Math.abs(shift)).toBeLessThanOrEqual(1)
        expect(frequencyOf(sample) * 2 ** (shift / 12)).toBeCloseTo(frequencyOf(note), 6)
      }
    }
  })

  it('jedes Sample, das verwendet wird, existiert', () => {
    const names = new Set(sampleNames())
    for (let o = 2; o <= 6; o++) for (const pc of CHROMATIC_SHARPS) expect(names.has(sampleFor(`${pc}${o}`).sample)).toBe(true)
  })
})
