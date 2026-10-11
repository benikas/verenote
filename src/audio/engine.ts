import * as Tone from 'tone'
import { sampleFileName, sampleNames } from './samples'

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
  /** Anschlagstärke 0–1 (Standard 1); kleiner = leiser */
  velocity?: number
  /** Wird direkt nach dem Anschlag jedes Tons aufgerufen (index ab 0) */
  onNote?: (index: number, note: string) => void
  /** Klavier oder Synth erzwingen (Prüfmodus) */
  instrument?: Instrument
}

const LOAD_TIMEOUT_MS = 30_000

const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class AudioEngine {
  private synth: Tone.PolySynth | null = null
  private sampler: Tone.Sampler | null = null
  private unlocked = false
  private runId = 0
  private loadStarted = false
  private listeners = new Set<(s: LoadState) => void>()
  private statusListeners = new Set<(needsTap: boolean) => void>()
  private interruptListeners = new Set<() => void>()
  private resumeListeners = new Set<() => void>()
  /** Wiedergabe wurde unterbrochen (App im Hintergrund); wartet auf Rückkehr von Audio */
  private interrupted = false
  private lifecycleBound = false
  /** Die geladenen Klavier-Samples; bleiben beim Neuaufbau des AudioContext erhalten */
  private buffers: Record<string, Tone.ToneAudioBuffer> | null = null
  /**
   * iOS: Nach Hintergrund/Sperrbildschirm ist der AudioContext oft tot, meldet aber weiter
   * "running". Dann hilft nur ein neuer Kontext, aufgebaut im nächsten Tippen.
   */
  private stale = false

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
    this.makeSynth()
    this.unlocked = true
    this.bindLifecycle()
    this.bindContext()
  }

  private makeSynth(): void {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.25, release: 1.2 },
    }).toDestination()
    this.synth.volume.value = -8
  }

  private makeSampler(): void {
    if (!this.buffers) return
    const sampler = new Tone.Sampler({ urls: this.buffers, release: 1.2 }).toDestination()
    sampler.volume.value = -4
    this.sampler = sampler
  }

  // ---- Audio nach App-Wechsel wieder aufnehmen (B2) -------------------------------
  // iOS setzt den AudioContext auf "suspended"/"interrupted", sobald die Seite im
  // Hintergrund ist oder der Bildschirm gesperrt wird. Er läuft nur nach einer
  // Berührung wieder an. Deshalb: bei jeder Berührung resume(), vor jedem Abspielen
  // prüfen, und der UI melden, wenn "Tippen zum Fortsetzen" nötig ist.

  private get rawCtx(): AudioContext {
    return Tone.getContext().rawContext as AudioContext
  }

  /** Läuft der AudioContext gerade? */
  get running(): boolean {
    return this.unlocked && !this.stale && this.rawCtx.state === 'running'
  }

  /** Audio ist entsperrt, läuft aber nicht (mehr): ein Tippen ist nötig */
  get needsTap(): boolean {
    return this.unlocked && !this.running
  }

  /** Neuer AudioContext mit neuem Synth/Sampler; die geladenen Samples bleiben. */
  private rebuild(): void {
    const oldCtx = Tone.getContext()
    const oldSynth = this.synth
    const oldSampler = this.sampler
    Tone.setContext(new Tone.Context())
    this.synth = null
    this.sampler = null
    this.makeSynth()
    this.makeSampler()
    this.bindContext()
    try {
      oldSynth?.dispose()
      oldSampler?.dispose()
      void (oldCtx.rawContext as AudioContext).close?.()
    } catch {
      /* der alte Kontext ist ohnehin unbrauchbar */
    }
  }

  /** Kurzer stiller Ton im Tippen: schaltet iOS Audio endgültig frei */
  private silentKick(): void {
    try {
      const ctx = this.rawCtx
      const src = ctx.createBufferSource()
      src.buffer = ctx.createBuffer(1, 1, 22050)
      src.connect(ctx.destination)
      src.start(0)
    } catch {
      /* nicht kritisch */
    }
  }

  onStatus(fn: (needsTap: boolean) => void): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  /** Wird gerufen, wenn die laufende Wiedergabe wegen App-Wechsel abgebrochen wurde */
  onInterrupted(fn: () => void): () => void {
    this.interruptListeners.add(fn)
    return () => this.interruptListeners.delete(fn)
  }

  /** Wird gerufen, wenn Audio nach einer Unterbrechung wieder läuft */
  onResumed(fn: () => void): () => void {
    this.resumeListeners.add(fn)
    return () => this.resumeListeners.delete(fn)
  }

  /**
   * Versucht, den AudioContext wieder zu starten. Ohne Berührung verweigert iOS das
   * unter Umständen, dann bleibt needsTap wahr. Hängt nie länger als ~1,5 s.
   */
  async resume(fromGesture = false): Promise<boolean> {
    if (!this.unlocked) return false
    // Ein neuer Kontext darf nur aus einer Berührung heraus gestartet werden. Alles bis zum
    // resume()-Aufruf läuft deshalb synchron, ohne await.
    if (this.stale && fromGesture) {
      this.rebuild()
      this.stale = false
    }
    if (!this.stale && this.rawCtx.state !== 'running') {
      try {
        const p = this.rawCtx.resume()
        if (fromGesture) this.silentKick()
        await Promise.race([p, sleep(1500)])
      } catch {
        /* bleibt gesperrt, needsTap meldet es */
      }
    } else if (!this.stale && fromGesture) {
      this.silentKick()
    }
    this.checkStatus()
    return this.running
  }

  private checkStatus(): void {
    const needsTap = this.needsTap
    this.statusListeners.forEach((fn) => fn(needsTap))
    if (this.running && this.interrupted && !this.stale && !document.hidden) {
      this.interrupted = false
      this.resumeListeners.forEach((fn) => fn())
    }
  }

  /** Laufende Töne und Sequenzen sauber abbrechen; die UI spielt nach der Rückkehr neu */
  private markInterrupted(): void {
    if (this.interrupted) return
    this.stop()
    this.interrupted = true
    this.interruptListeners.forEach((fn) => fn())
  }

  /** Auf Zustandswechsel des aktuellen AudioContext hören (nach jedem Neuaufbau neu). */
  private bindContext(): void {
    const ctx = this.rawCtx
    ctx.addEventListener('statechange', () => {
      if (ctx !== this.rawCtx) return // alter Kontext
      // Das Gerät hat Audio weggenommen (Anruf, Sperrbildschirm) oder gibt es zurück
      if ((ctx.state as string) === 'interrupted' && IS_IOS) this.stale = true
      if (ctx.state !== 'running') this.markInterrupted()
      this.checkStatus()
    })
  }

  private bindLifecycle(): void {
    if (this.lifecycleBound) return
    this.lifecycleBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (IS_IOS) this.stale = true
        this.markInterrupted()
        this.checkStatus()
      }
      else void this.resume()
    })
    // Zurück aus dem Seiten-Cache (Safari): Zustand neu prüfen
    window.addEventListener('pageshow', () => void this.resume())
    // iOS erlaubt resume() nur in einer Berührung (touchend/click, nicht pointerdown)
    const onGesture = () => {
      if (this.needsTap) void this.resume(true)
    }
    window.addEventListener('touchend', onGesture, { capture: true, passive: true })
    window.addEventListener('click', onGesture, { capture: true, passive: true })
  }

  /**
   * Lädt die Klavier-Samples. Kann schon vor dem Entsperren gestartet werden
   * (fetch + decode brauchen keinen laufenden AudioContext).
   */
  loadSamples(baseUrl = `${import.meta.env.BASE_URL}samples/piano/`): Promise<void> {
    if (this.loadStarted) return Promise.resolve()
    this.loadStarted = true

    const t0 = performance.now()
    const names = sampleNames()
    let done = 0
    this.setLoadState({ phase: 'loading', progress: 0 })

    const buffers: Record<string, Tone.ToneAudioBuffer> = {}
    const loads = names.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const url = `${baseUrl}${sampleFileName(name)}` // D#2 -> Ds2.mp3
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
        this.buffers = buffers
        this.makeSampler()
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

  /** Sind die Klavier-Samples geladen? */
  get hasPiano(): boolean {
    return this.sampler !== null
  }

  /**
   * Einzelnen Ton sofort spielen. note z. B. "C4", "F#3". duration in Sekunden, velocity 0–1.
   * instrument erzwingt Klavier oder Synth (Prüfmodus); Standard: Klavier, sobald geladen.
   */
  play(note: string, duration = 1.2, velocity = 1, instrument?: Instrument): void {
    if (!this.unlocked) return
    if (!this.running) void this.resume() // z. B. nach App-Wechsel, aus dem Tippen heraus
    const t = Tone.immediate()
    const usePiano = this.sampler !== null && instrument !== 'synth'
    if (usePiano) this.sampler?.triggerAttackRelease(note, duration, t, velocity)
    else this.synth?.triggerAttackRelease(note, duration, t, velocity)
  }

  /**
   * Töne nacheinander spielen. Das Promise ist erst fertig, wenn der letzte Ton
   * angeschlagen und sein Abstand abgelaufen ist, oder früher, wenn stop() oder
   * eine neue Sequenz die Wiedergabe abbricht. Ergebnis: true = vollständig gespielt.
   */
  async playSequence(notes: string[], opts: SequenceOptions = {}): Promise<boolean> {
    const { noteDuration = 1.2, interval = 1.4, velocity = 1, onNote, instrument } = opts
    const myRun = ++this.runId
    this.releaseAll()
    if (!this.running && !(await this.resume())) {
      this.markInterrupted() // Audio ist weg: UI zeigt "Tippen zum Fortsetzen"
      this.checkStatus()
      return false
    }
    for (let i = 0; i < notes.length; i++) {
      if (myRun !== this.runId) return false
      this.play(notes[i], noteDuration, velocity, instrument)
      onNote?.(i, notes[i])
      await sleep(interval * 1000)
    }
    return myRun === this.runId
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
      // "verbraucht" = nach App-Wechsel steht ein Neuaufbau an (iOS, siehe B2)
      state: this.stale ? `${ctx.state}, verbraucht` : ctx.state,
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
