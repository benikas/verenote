import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * B3/B4: Neuaufbau nach iOS-Unterbrechung und Audio-Session. Tone, document und window sind
 * simuliert. Ob iOS sich wirklich so verhält, zeigt nur der Test auf dem iPhone.
 */

type Ctx = {
  state: string
  currentTime: number
  id: number
  listeners: Record<string, (() => void)[]>
  addEventListener: (n: string, f: () => void) => void
  resume: () => Promise<void>
  suspend: () => Promise<void>
  close: () => Promise<void>
  createBuffer: () => object
  createBufferSource: () => { connect: () => void; start: () => void; buffer: object }
  destination: object
}

let contexts: Ctx[]
let current: Ctx
const played: { ctxId: number; note: string }[] = []
let session: { type: string }
const winHandlers: Record<string, (() => void)[]> = {}
const docHandlers: Record<string, (() => void)[]> = {}
let hidden = false

function makeCtx(): Ctx {
  const c: Ctx = {
    state: 'running',
    currentTime: 0,
    id: contexts.length + 1,
    listeners: {},
    addEventListener(n, f) {
      ;(c.listeners[n] ??= []).push(f)
    },
    resume: async () => {
      c.state = 'running'
    },
    suspend: async () => {
      c.state = 'suspended'
    },
    close: async () => {
      c.state = 'closed'
    },
    createBuffer: () => ({}),
    createBufferSource: () => ({ connect() {}, start() {}, buffer: {} }),
    destination: {},
  }
  contexts.push(c)
  return c
}

vi.mock('tone', () => {
  class Voice {
    ctxId = current.id
    volume = { value: 0 }
    toDestination() {
      return this
    }
    triggerAttackRelease(note: string) {
      played.push({ ctxId: this.ctxId, note })
    }
    releaseAll() {}
    dispose() {}
  }
  return {
    start: async () => {},
    immediate: () => 0,
    getContext: () => ({ rawContext: current }),
    setContext: (x: { rawContext: Ctx }) => {
      current = x.rawContext
    },
    Context: class {
      rawContext = makeCtx()
    },
    PolySynth: Voice,
    Synth: class {},
    Sampler: Voice,
    ToneAudioBuffer: class {},
  }
})

async function fresh() {
  vi.resetModules()
  contexts = []
  played.length = 0
  hidden = false
  session = { type: 'auto' }
  current = makeCtx()
  for (const k of Object.keys(winHandlers)) delete winHandlers[k]
  for (const k of Object.keys(docHandlers)) delete docHandlers[k]
  vi.stubGlobal('navigator', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, audioSession: session })
  vi.stubGlobal('document', {
    get hidden() {
      return hidden
    },
    addEventListener: (n: string, f: () => void) => (docHandlers[n] ??= []).push(f),
  })
  vi.stubGlobal('window', { addEventListener: (n: string, f: () => void) => (winHandlers[n] ??= []).push(f) })
  const { AudioEngine } = await import('./engine')
  const engine = new AudioEngine()
  await engine.unlock()
  return engine
}

const fire = (h: Record<string, (() => void)[]>, n: string) => h[n]?.forEach((f) => f())
const touch = () => fire(winHandlers, 'touchend')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Zeit vergehen lassen; der Takt des Kontexts läuft nur, wenn `alive` */
function elapse(ms: number, alive: boolean) {
  for (let t = 0; t < ms; t += 250) {
    vi.advanceTimersByTime(250)
    if (alive) current.currentTime += 0.25
  }
}

describe('Neuaufbau nach App-Wechsel (B3)', () => {
  it('Normalfall: Ton klingt auf dem ersten Kontext', async () => {
    const e = await fresh()
    elapse(2000, true)
    e.play('C4')
    expect(played.map((p) => p.ctxId)).toEqual([1])
  })

  it('Wechsel mit Ereignis: nächster Ton kommt nach dem Tippen vom neuen Kontext', async () => {
    const e = await fresh()
    hidden = true
    fire(docHandlers, 'visibilitychange')
    hidden = false
    fire(docHandlers, 'visibilitychange')
    expect(e.needsTap).toBe(true)
    e.play('E4') // pointerdown: alter Kontext ist unbrauchbar, Ton wird gemerkt
    expect(played).toHaveLength(0)
    touch() // touchend: Neuaufbau, Ton wird nachgeholt
    expect(contexts).toHaveLength(2)
    expect(played).toEqual([{ ctxId: 2, note: 'E4' }])
    e.play('F4')
    expect(played.at(-1)).toEqual({ ctxId: 2, note: 'F4' })
  })

  it('Kurzer Wechsel OHNE Ereignis: iOS meldet "running", der Takt steht aber still', async () => {
    const e = await fresh()
    elapse(1000, true)
    e.play('C4')
    played.length = 0
    elapse(3000, false) // kurz weg: Uhr läuft, Audio-Takt nicht, kein Ereignis, Zustand weiter "running"
    expect(current.state).toBe('running')
    expect(e.running).toBe(false)
    e.play('D4')
    expect(played).toHaveLength(0)
    touch()
    expect(contexts).toHaveLength(2)
    expect(played).toEqual([{ ctxId: 2, note: 'D4' }])
  })

  it('Herzschlag erkennt den toten Kontext von selbst und meldet die Unterbrechung', async () => {
    const e = await fresh()
    const onInt = vi.fn()
    e.onInterrupted(onInt)
    elapse(3000, false)
    expect(onInt).toHaveBeenCalledTimes(1)
    expect(e.needsTap).toBe(true)
    expect(e.info().state).toContain('verbraucht')
  })

  it('Alle Abspielwege nutzen nach dem Neuaufbau den neuen Kontext', async () => {
    const e = await fresh()
    hidden = true
    fire(docHandlers, 'visibilitychange')
    hidden = false
    touch() // Neuaufbau
    played.length = 0
    const seq = e.playSequence(['C4', 'E4'], { interval: 0.01 })
    await vi.advanceTimersByTimeAsync(100)
    await seq
    const chord = e.playChord(['C4', 'G4'], { duration: 0.01 })
    await vi.advanceTimersByTimeAsync(100)
    await chord
    e.play('A4')
    expect(played.length).toBe(5)
    expect(new Set(played.map((p) => p.ctxId))).toEqual(new Set([2]))
  })

  it('pagehide und freeze wirken wie ein Wechsel in den Hintergrund', async () => {
    const e = await fresh()
    fire(winHandlers, 'pagehide')
    expect(e.needsTap).toBe(true)
  })
})

describe('Audio-Session (B4)', () => {
  it('"playback" nur während Töne klingen, danach zurück auf "auto"', async () => {
    const e = await fresh()
    elapse(5000, true)
    expect(session.type).toBe('auto')
    e.play('C4', 1.2)
    expect(session.type).toBe('playback')
    elapse(5000, true)
    expect(session.type).toBe('auto')
  })

  it('im Hintergrund sofort "auto" und Kontext suspendiert', async () => {
    const e = await fresh()
    e.play('C4')
    expect(session.type).toBe('playback')
    hidden = true
    fire(docHandlers, 'visibilitychange')
    expect(session.type).toBe('auto')
    expect(contexts[0].state).toBe('suspended')
  })
})
