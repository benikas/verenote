import { describe, expect, it } from 'vitest'
import { BURST_SPEC, burstParticles, rewardEnabled } from './reward'

describe('Belohnungs-Animation (4.4)', () => {
  it('läuft nur, wenn eingeschaltet und keine reduzierte Bewegung gewünscht ist', () => {
    expect(rewardEnabled(true, false)).toBe(true)
    expect(rewardEnabled(false, false)).toBe(false)
    expect(rewardEnabled(true, true)).toBe(false)
    expect(rewardEnabled(false, true)).toBe(false)
  })

  it('klein < mittel < gross: mehr Teilchen, weiter, länger', () => {
    const { small, medium, big } = BURST_SPEC
    expect(small.count).toBeLessThan(medium.count)
    expect(medium.count).toBeLessThan(big.count)
    expect(small.radius).toBeLessThan(medium.radius)
    expect(medium.radius).toBeLessThan(big.radius)
    expect(small.ms).toBeLessThan(medium.ms)
    expect(medium.ms).toBeLessThan(big.ms)
  })

  it('die kleine Animation ist fertig, bevor Auto-Weiter (1,1 s) die nächste Aufgabe zeigt', () => {
    const maxDelay = Math.max(...burstParticles('small').map((p) => p.delay))
    expect(BURST_SPEC.small.ms + maxDelay).toBeLessThanOrEqual(1100)
  })

  it('Teilchen sind wiederholbar, in allen Richtungen verteilt und im Radius', () => {
    for (const size of ['small', 'medium', 'big'] as const) {
      const a = burstParticles(size)
      expect(a).toEqual(burstParticles(size))
      expect(a).toHaveLength(BURST_SPEC[size].count)
      for (const p of a) expect(Math.hypot(p.dx, p.dy)).toBeLessThanOrEqual(BURST_SPEC[size].radius + 1)
      expect(a.some((p) => p.dx > 0) && a.some((p) => p.dx < 0) && a.some((p) => p.dy > 0) && a.some((p) => p.dy < 0)).toBe(true)
      expect(new Set(a.map((p) => p.color)).size).toBe(3)
    }
  })
})
