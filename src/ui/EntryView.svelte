<script lang="ts">
  import type { Entry } from '../content/inhalte'
  import Hoerbeispiel from './Hoerbeispiel.svelte'

  let { entry, showMnemonics = true }: { entry: Entry; showMnemonics?: boolean } = $props()
</script>

<div class="entry">
  {#each entry.paragraphs as p, i (i)}
    <p>{p}</p>
  {/each}

  {#if entry.tip}
    <p class="tip"><b>Tipp:</b> {entry.tip.replace(/^Tipp:\s*/, '')}</p>
  {/if}

  {#if entry.examples.length}
    <h3>Zum Anhören</h3>
    <div class="examples">
      {#each entry.examples as ex (ex.name)}
        <Hoerbeispiel example={ex} />
      {/each}
    </div>
  {/if}

  {#if showMnemonics && entry.mnemonics.length}
    <h3>Merksätze</h3>
    <ul class="mnemonics">
      {#each entry.mnemonics as m (m.title)}
        <li>
          <b>{m.title}</b>
          <span class="dir">{m.direction}</span>
          <span class="hint">{m.hint}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .entry {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  p {
    margin: 0;
    line-height: 1.5;
    font-size: 1rem;
  }
  .tip {
    padding: 10px 12px;
    border-radius: var(--radius-m);
    background: var(--accent-soft);
    color: var(--accent-soft-ink);
  }
  h3 {
    margin: 6px 0 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .examples {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mnemonics {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mnemonics li {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    align-items: baseline;
    padding: 10px 12px;
    border-radius: var(--radius-m);
    background: var(--surface-2);
    line-height: 1.35;
  }
  .dir {
    font-size: 0.8rem;
    color: var(--accent-soft-ink);
    background: var(--accent-soft);
    border-radius: 8px;
    padding: 1px 8px;
  }
  .hint {
    flex-basis: 100%;
    font-size: 0.9rem;
    color: var(--muted);
  }
</style>
