<script lang="ts">
  import { entry as findEntry, introId } from '../content/inhalte'
  import { getLevel, type LevelId } from '../theory/tasks'
  import EntryView from './EntryView.svelte'

  /** Einführung einer Stufe. Als Seite (vor der ersten Runde) oder als Blatt über der Übung. */
  let { level, onclose, overlay = false }: { level: LevelId; onclose: () => void; overlay?: boolean } = $props()

  const e = $derived(findEntry(introId(level)))
  const area = $derived(getLevel(level).kind)
</script>

<div class="intro" class:overlay data-area={area} role={overlay ? 'dialog' : undefined} aria-modal={overlay ? 'true' : undefined} aria-label="Einführung Stufe {level}">
  <main class="page">
    <p class="kicker">Stufe {level}</p>
    {#if e}
      <h1>{e.title}</h1>
      <EntryView entry={e} />
    {:else}
      <h1>{getLevel(level).label}</h1>
    {/if}
    <button class="btn-primary ok" onclick={onclose}>Verstanden</button>
  </main>
</div>

<style>
  .intro {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .intro.overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow-y: auto;
    background: var(--bg);
  }
  .kicker {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.25;
  }
  .ok {
    margin-top: 8px;
  }
</style>
