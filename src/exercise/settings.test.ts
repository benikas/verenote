import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  TEMPO_MAX,
  TEMPO_MIN,
  shouldNeutralize,
  taskTiming,
} from './settings'

describe('Neutralisierung: wann sie läuft', () => {
  it('nie vor der ersten Aufgabe', () => {
    expect(shouldNeutralize(DEFAULT_SETTINGS, 0)).toBe(false)
  })
  it('ab der zweiten Aufgabe, wenn eingeschaltet', () => {
    expect(DEFAULT_SETTINGS.neutralize).toBe(true)
    expect(shouldNeutralize(DEFAULT_SETTINGS, 1)).toBe(true)
    expect(shouldNeutralize(DEFAULT_SETTINGS, 14)).toBe(true)
  })
  it('nie, wenn ausgeschaltet', () => {
    expect(shouldNeutralize({ ...DEFAULT_SETTINGS, neutralize: false }, 5)).toBe(false)
  })
})

describe('Tempo', () => {
  it('Tonlänge liegt unter dem Abstand', () => {
    for (const t of [TEMPO_MIN, 1, 1.25, TEMPO_MAX]) {
      const { noteDuration, interval } = taskTiming(t)
      expect(interval).toBe(t)
      expect(noteDuration).toBeLessThan(interval)
    }
  })
  it('begrenzt Werte außerhalb des Reglers', () => {
    expect(taskTiming(0).interval).toBe(TEMPO_MIN)
    expect(taskTiming(99).interval).toBe(TEMPO_MAX)
  })
})
