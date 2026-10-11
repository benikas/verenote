<script lang="ts">
  import { audio, type LoadState } from '../audio/engine'
  import { taskTiming } from '../exercise/settings'
  import { settings } from './settings.svelte'

  let { load, onback }: { load: LoadState; onback: () => void } = $props()

  // Stammtöne in englischer Schreibweise, Oktave 4
  const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']
  const info = $derived.by(() => {
    void load // bei Zustandswechsel neu lesen
    return audio.info()
  })
</script>

<main class="test">
  <h1>Audio-Test</h1>
  <p class="meta">
    Klang: <b>{audio.instrument === 'piano' ? 'Klavier' : 'Synth (Fallback)'}</b>
    {#if load.phase === 'ready'}· geladen in {(load.ms / 1000).toFixed(1)} s{/if}
    {#if load.phase === 'loading'}· lädt {Math.round(load.progress * 100)} %{/if}
    <br />
    Audio {info.state} · {info.sampleRate} Hz · Latenz Basis {info.baseLatencyMs} ms{#if info.outputLatencyMs != null}, Ausgabe {info.outputLatencyMs} ms{/if}
  </p>

  <button class="wide" onclick={() => audio.play('C4')}>Referenzton C4</button>
  <button class="wide" onclick={() => audio.playSequence(['C4', 'E4', 'G4'], taskTiming(settings.tempo))}>
    Folge C – E – G
  </button>

  <div class="grid">
    {#each NOTES as n (n)}
      <button onclick={() => audio.play(n)}>{n.slice(0, -1)}</button>
    {/each}
  </div>

  <button class="wide ghost" onclick={() => audio.stop()}>Stopp</button>
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
</style>
