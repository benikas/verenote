import type { NeutralLength } from '../theory/neutral'

/**
 * Einstellungen der Übung (rein, ohne UI). Persistenz kommt mit M2;
 * bis dahin gelten sie, solange die App geöffnet ist.
 */
export interface Settings {
  /** Gehör neutralisieren vor jeder neuen Aufgabe (Standard: an) */
  neutralize: boolean
  neutralLength: NeutralLength
  /** Abstand zwischen Referenz- und Zielton in Sekunden (kleiner = schneller) */
  tempo: number
}

export const TEMPO_MIN = 0.7
export const TEMPO_MAX = 2.0
export const TEMPO_STEP = 0.05

export const DEFAULT_SETTINGS: Settings = {
  neutralize: true,
  neutralLength: 'short',
  tempo: 1.25,
}

/** Wiedergabe-Zeiten der Aufgabe aus dem Tempo: Tonlänge liegt knapp unter dem Abstand. */
export function taskTiming(tempo: number): { noteDuration: number; interval: number } {
  const interval = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, tempo))
  return { noteDuration: Math.round(interval * 0.9 * 100) / 100, interval }
}

/** Wiedergabe der Neutralisierung: schnell, leiser, danach eine kurze Pause. */
export const NEUTRAL_PLAYBACK = {
  /** Abstand der Töne (0,1–0,15 s laut Konzept) */
  interval: 0.12,
  noteDuration: 0.3,
  velocity: 0.3,
  /** Pause nach der Folge in Millisekunden (0,5–1 s) */
  pauseMs: 700,
} as const

/** Pause nach einer richtigen Antwort, bevor automatisch die nächste Aufgabe beginnt (ms) */
export const AUTO_ADVANCE_MS = 1100

/**
 * Wann läuft die Neutralisierung? Nur wenn eingeschaltet und nie vor der ersten Aufgabe.
 * Wiederholen und Lösung vorspielen rufen das gar nicht erst auf.
 */
export function shouldNeutralize(settings: Settings, answeredSoFar: number): boolean {
  return settings.neutralize && answeredSoFar > 0
}
