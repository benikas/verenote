import * as Tone from 'tone'

/**
 * Audio-Engine (M0, Aufgaben 0.2 + 0.3).
 * - Synth-Fallback ist sofort nach dem Entsperren nutzbar.
 * - Klavier-Samples (Salamander) laden im Hintergrund; sobald sie bereit sind,
 *   wird automatisch der Sampler benutzt.
 * - Kennt weder UI noch Übungslogik: nur play(note) und playSequence(notes).
 */

export type Instrument = 'synth' | 'piano'

export type LoadState =
  | { phase: 'idle'; progress: 0 }
  | { phase: 'loading'; progress: number }
  | { phase: 'ready'; progress: 1; ms: number }
  | { phase: 'error'; progress: number; message: string }

export interface SequenceOptions {
  /** Länge jedes Tons in Sekunden */
  noteDuration?: number
  /** Abstand zwischen Tonanfängen in Sekunden */
  interval?: number
}

// Sample-Stützstellen (Kleinterzen), siehe scripts/copy-samples.mjs
const SAMPLE_NOTES = ['A', 'C', 'D#', 'F#']
const SAMPLE_OCTAVES = [2, 3, 4, 5, 6]
const LOAD_TIMEOUT_MS = 30_000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class AudioEngine {
  private synth: Tone.PolySynth | null = null
  private sampler: Tone.Sampler | null = null
  private unlocked = false
  private runId = 0
  private loadStarted = false
  private listeners = new Set<(s: LoadState) => void>()

  loadState: LoadState = { phase: 'idle', progress: 0 }

  /** Welches Instrument aktuell klingt */
  get instrument(): Instrument {
    return this.sampler ? 'piano' : 'synth'
  }

  onLoadState(fn: (s: LoadState) => void): () => void {
    this.listeners.add(fn)
    fn(this.loadState)
    return () => this.listeners.delete(fn)
  }

  private setLoadState(s: LoadState) {
    this.loadState = s
    this.listeners.forEach((fn) => fn(s))
  }

  /**
   * Muss aus einem Tap-Handler aufgerufen werden (Browser-Autoplay-Regel).
   * Entsperrt den AudioContext und baut den Synth-Fallback auf.
   */
  async unlock(): Promise<void> {
    if (this.unlocked) return
    // iOS: Der Stummschalter schaltet Web-Audio sonst stumm. Die Audio-Session-Art
    // "playback" verhindert das (Safari 16.4+, auf anderen Browsern ohne Wirkung).
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'

    await Tone.start()
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.25, release: 1.2 },
    }).toDestination()
    this.synth.volume.value = -8
    this.unlocked = true
  }

  /**
   * Lädt die Klavier-Samples. Kann schon vor dem Entsperren gestartet werden
   * (fetch + decode brauchen keinen laufenden AudioContext).
   */
  loadSamples(baseUrl = `${import.meta.env.BASE_URL}samples/piano/`): Promise<void> {
    if (this.loadStarted) return Promise.resolve()
    this.loadStarted = true

    const t0 = performance.now()
    const names = SAMPLE_OCTAVES.flatMap((o) => SAMPLE_NOTES.map((n) => `${n}${o}`))
    names.push('C7')
    let done = 0
    this.setLoadState({ phase: 'loading', progress: 0 })

    const buffers: Record<string, Tone.ToneAudioBuffer> = {}
    const loads = names.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const url = `${baseUrl}${name.replace('#', 's')}.mp3` // D#2 -> Ds2.mp3
          buffers[name] = new Tone.ToneAudioBuffer(
            url,
            () => {
              done += 1
              this.setLoadState({ phase: 'loading', progress: done / names.length })
              resolve()
            },
            (err) => reject(err instanceof Error ? err : new Error(`Sample ${name} nicht ladbar`)),
          )
        }),
    )

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden der Samples')), LOAD_TIMEOUT_MS),
    )

    return Promise.race([Promise.all(loads), timeout])
      .then(() => {
        const sampler = new Tone.Sampler({ urls: buffers, release: 1.2 }).toDestination()
        sampler.volume.value = -4
        this.sampler = sampler
        this.setLoadState({ phase: 'ready', progress: 1, ms: Math.round(performance.now() - t0) })
      })
      .catch((e: unknown) => {
        // Synth bleibt aktiv, die App funktioniert weiter
        this.loadStarted = false
        this.setLoadState({
          phase: 'error',
          progress: done / names.length,
          message: e instanceof Error ? e.message : String(e),
        })
      })
  }

  /** Einzelnen Ton sofort spielen. note z. B. "C4", "F#3". duration in Sekunden. */
  play(note: string, duration = 1.2): void {
    if (!this.unlocked) return
    const t = Tone.immediate()
    if (this.sampler) this.sampler.triggerAttackRelease(note, duration, t)
    else this.synth?.triggerAttackRelease(note, duration, t)
  }

  /**
   * Töne nacheinander spielen. Das Promise ist erst fertig, wenn der letzte Ton
   * angeschlagen und sein Abstand abgelaufen ist, oder früher, wenn stop() oder
   * eine neue Sequenz die Wiedergabe abbricht.
   */
  async playSequence(notes: string[], opts: SequenceOptions = {}): Promise<void> {
    const { noteDuration = 1.2, interval = 1.4 } = opts
    const myRun = ++this.runId
    this.releaseAll()
    for (let i = 0; i < notes.length; i++) {
      if (myRun !== this.runId) return
      this.play(notes[i], noteDuration)
      await sleep(interval * 1000)
    }
  }

  /** Laufende Wiedergabe abbrechen und Töne ausklingen lassen. */
  stop(): void {
    this.runId += 1
    this.releaseAll()
  }

  /** Diagnose für den Gerätetest (0.5) */
  info(): { state: string; sampleRate: number; baseLatencyMs: number; outputLatencyMs: number | null } {
    const ctx = Tone.getContext().rawContext as AudioContext
    return {
      state: ctx.state,
      sampleRate: ctx.sampleRate,
      baseLatencyMs: Math.round((ctx.baseLatency ?? 0) * 1000),
      outputLatencyMs: ctx.outputLatency != null ? Math.round(ctx.outputLatency * 1000) : null,
    }
  }

  private releaseAll(): void {
    this.sampler?.releaseAll()
    this.synth?.releaseAll()
  }
}

export const audio = new AudioEngine()
