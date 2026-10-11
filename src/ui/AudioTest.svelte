<script lang="ts">
  import { audio, type Instrument, type LoadState } from '../audio/engine'
  import { frequencyOf } from '../audio/samples'
  import { taskTiming } from '../exercise/settings'
  import { CHROMATIC_SHARPS } from '../theory/notes'
  import { settings } from './settings.svelte'

  let { load, onback }: { load: LoadState; onback: () => void } = $props()

  type Mode = Instrument | 'both'

  let octave = $state(4)
  let mode = $state<Mode>('piano')
  /** Zuletzt gespielter Ton, mit Name und Frequenz */
  let current = $state<{ note: string; instrument: Instrument } | null>(null)
  let running = $state(false)

  const notes = $derived(CHROMATIC_SHARPS.map((pc) => `${pc}${octave}`))
  const info = $derived.by(() => {
    void load // bei Zustandswechsel neu lesen
    return audio.info()
  })
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  /** Instrumente, die für diesen Modus nacheinander erklingen */
  function instruments(): Instrument[] {
    if (mode === 'both') return audio.hasPiano ? ['piano', 'synth'] : ['synth']
    return [mode === 'piano' && !audio.hasPiano ? 'synth' : mode]
  }

  async function playOne(note: string) {
    for (const inst of instruments()) {
      current = { note, instrument: inst }
      audio.play(note, 1.0, 1, inst)
      await sleep(inst === instruments().at(-1) ? 0 : 1200)
    }
  }

  async function playAll() {
    if (running) return
    running = true
    for (const n of notes) {
      if (!running) break
      await playOne(n)
      await sleep(1100)
    }
    running = false
  }

  function stop() {
    running = false
    audio.stop()
  }
</script>

<main class="test">
  <h1>Ton-Prüfung</h1>
  <p class="meta">
    Klang: <b>{audio.instrument === 'piano' ? 'Klavier' : 'Synth (Fallback)'}</b>
    {#if load.phase === 'ready'}· geladen in {(load.ms / 1000).toFixed(1)} s{/if}
    {#if load.phase === 'loading'}· lädt {Math.round(load.progress * 100)} %{/if}
    <br />
    Audio {info.state} · {info.sampleRate} Hz · Latenz Basis {info.baseLatencyMs} ms{#if info.outputLatencyMs != null}, Ausgabe {info.outputLatencyMs} ms{/if}
  </p>

  <div class="shown" aria-live="polite">
    {#if current}
      <span class="name">{current.note}</span>
      <span class="hz">{frequencyOf(current.note).toFixed(2).replace('.', ',')} Hz · {current.instrument === 'piano' ? 'Klavier' : 'Synth'}</span>
    {:else}
      <span class="hz">Tippe einen Ton an. Name und Frequenz erscheinen hier.</span>
    {/if}
  </div>

  <div class="seg" role="radiogroup" aria-label="Klang">
    {#each [['piano', 'Klavier'], ['synth', 'Synth'], ['both', 'Beide']] as [id, label] (id)}
      <button class:selected={mode === id} role="radio" aria-checked={mode === id} onclick={() => (mode = id as Mode)}>{label}</button>
    {/each}
  </div>
  <div class="seg" role="radiogroup" aria-label="Oktave">
    {#each [3, 4, 5] as o (o)}
      <button class:selected={octave === o} role="radio" aria-checked={octave === o} onclick={() => (octave = o)}>Oktave {o}</button>
    {/each}
  </div>

  <div class="grid">
    {#each notes as n (n)}
      <button class:black={n.includes('#')} class:active={current?.note === n} onclick={() => void playOne(n)}>
        {n.slice(0, -1)}
      </button>
    {/each}
  </div>

  <button class="wide" onclick={() => void playAll()} disabled={running}>
    {running ? 'Spielt …' : 'Alle Töne einzeln anspielen (C bis B)'}
  </button>
  <button class="wide" onclick={() => audio.play('C4')}>Referenzton C4</button>
  <button class="wide" onclick={() => audio.playSequence(['C4', 'E4', 'G4'], taskTiming(settings.tempo))}>
    Folge C – E – G
  </button>

  <button class="wide ghost" onclick={stop}>Stopp</button>
  <button class="wide ghost" onclick={onback}>Zurück</button>
</main>

<style>
  .test {
    flex: 1;
    max-width: 480px;
    width: 100%;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    margin: 0;
    font-size: 1.4rem;
  }
  .meta {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .meta b {
    color: var(--text);
  }
  button {
    background: var(--surface-2);
    border: 0;
    border-radius: 14px;
    padding: 18px;
    font-size: 1.1rem;
  }
  button:active {
    background: var(--accent);
  }
  .wide {
    width: 100%;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--surface-2);
    color: var(--muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .grid button {
    padding: 14px 0;
  }
  .grid .black {
    background: #151b2e;
  }
  .grid .active {
    outline: 2px solid var(--accent);
  }
  .shown {
    min-height: 74px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: var(--surface);
    border-radius: 14px;
    padding: 10px;
    text-align: center;
  }
  .shown .name {
    font-size: 2rem;
    font-weight: 700;
  }
  .shown .hz {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .seg {
    display: flex;
    gap: 8px;
  }
  .seg button {
    flex: 1;
    padding: 12px 4px;
    font-size: 0.95rem;
  }
  .seg .selected {
    outline: 2px solid var(--accent);
  }
</style>
