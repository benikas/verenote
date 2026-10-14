/**
 * Belohnungs-Animation (M4, 4.4): reine Hilfsfunktionen, ohne UI.
 * Klein bei richtiger Antwort, mittel am Rundenende, gross bei „Stufe geschafft“. Ohne Ton.
 */

export type BurstSize = 'small' | 'medium' | 'big'

export interface Particle {
  /** Zielpunkt relativ zum Ursprung, in px */
  dx: number
  dy: number
  /** Drehung in Grad */
  rot: number
  /** Verzögerung in Millisekunden */
  delay: number
  /** Grösse in px */
  size: number
  /** 0, 1, 2 = Farbe aus --burst-1 … --burst-3 */
  color: number
  /** Stern statt Punkt */
  star: boolean
}

export const BURST_SPEC: Record<BurstSize, { count: number; radius: number; ms: number }> = {
  small: { count: 8, radius: 56, ms: 700 },
  medium: { count: 14, radius: 110, ms: 1100 },
  big: { count: 26, radius: 150, ms: 1500 },
}

/** Läuft die Animation? Nur wenn eingeschaltet UND das Gerät keine reduzierte Bewegung wünscht. */
export function rewardEnabled(setting: boolean, prefersReducedMotion: boolean): boolean {
  return setting && !prefersReducedMotion
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Gleichmässig verteilte Teilchen mit fester, wiederholbarer Streuung (kein Zufall: testbar) */
export function burstParticles(size: BurstSize): Particle[] {
  const { count, radius } = BURST_SPEC[size]
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.2
    const r = radius * (0.65 + 0.35 * (((i * 7) % 5) / 4))
    return {
      dx: Math.round(Math.cos(angle) * r),
      dy: Math.round(Math.sin(angle) * r),
      rot: ((i * 53) % 360) - 180,
      delay: (i % 4) * 30,
      size: size === 'small' ? 8 : 10 + (i % 3) * 3,
      color: i % 3,
      star: i % 4 === 0,
    }
  })
}
