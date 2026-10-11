/** Zufallsquelle: liefert Zahlen in [0, 1). Injizierbar, damit Tests deterministisch sind. */
export type Rng = () => number

/** Kleiner, schneller Seed-Zufallsgenerator (mulberry32) für Tests */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Gewichtete Auswahl: Index mit Wahrscheinlichkeit weights[i] / Summe. */
export function pickWeighted(weights: readonly number[], rng: Rng): number {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (!(total > 0)) throw new Error('Gewichte müssen eine positive Summe ergeben')
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.length - 1
}
