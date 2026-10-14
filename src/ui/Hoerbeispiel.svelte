<script lang="ts">
  import { onDestroy } from 'svelte'
  import { audio } from '../audio/engine'
  import type { Example } from '../content/inhalte'
  import { taskTiming } from '../exercise/settings'
  import { settings } from './data.svelte'

  let { example }: { example: Example } = $props()

  /** Pause zwischen den Teilen eines Vergleichs (ms) */
  const GROUP_PAUSE = 700
  let playing = $state(false)
  let run = 0

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  async function play() {
    const my = ++run
    playing = true
    const timing = taskTiming(settings.tempo)
    try {
      if (example.kind === 'gleichzeitig') {
        await audio.playChord(example.groups[0], { duration: 1.6 })
      } else {
        for (let i = 0; i < example.groups.length; i++) {
          if (my !== run) return
          if (!(await audio.playSequence(example.groups[i], timing))) return
          if (i < example.groups.length - 1) await sleep(GROUP_PAUSE)
        }
      }
    } finally {
      if (my === run) playing = false
    }
  }

  onDestroy(() => {
    run += 1 // laufende Wiedergabe nicht weiterführen
  })
</script>

<button class="example" class:playing onclick={play} data-example={example.name}>
  <span class="icon" aria-hidden="true">▶</span>
  <span class="name">{example.name}</span>
</button>

<style>
  .example {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 8px 14px;
    text-align: left;
    background: var(--surface-2);
    border: 2px solid transparent;
    border-radius: var(--radius-m);
    font-size: 1rem;
  }
  .example:active,
  .example.playing {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .icon {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 0.8rem;
  }
  .name {
    flex: 1;
    min-width: 0;
    line-height: 1.3;
  }
</style>
