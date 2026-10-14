<script lang="ts">
  import { INTERVAL_CARDS, TOPICS, entry as findEntry } from '../content/inhalte'
  import EntryView from './EntryView.svelte'

  let { onback }: { onback: () => void } = $props()

  let openId = $state<string | null>(null)
  const open = $derived(openId ? findEntry(openId) : undefined)

  function show(id: string) {
    openId = id
    window.scrollTo(0, 0)
  }

  const semitones = (id: string) => Number(id.slice('intervall-'.length))
  const halbtoene = (n: number) => `${n} ${n === 1 ? 'Halbton' : 'Halbtöne'}`
</script>

<main class="page learn" data-area={open ? (open.area === 'intervals' ? 'intervals' : 'notes') : undefined}>
  <header class="page-head">
    <button class="back" aria-label="Zurück" onclick={() => (open ? (openId = null) : onback())}>←</button>
    <h1>{open ? open.title : 'Lernen'}</h1>
  </header>

  {#if open}
    {#if open.id.startsWith('intervall-')}
      <p class="muted-text">{halbtoene(semitones(open.id))}</p>
    {/if}
    {#key open.id}
      <EntryView entry={open} />
    {/key}
  {:else}
    <p class="muted-text">Erklärungen zum Nachlesen und Anhören. Alle Beispiele kannst du abspielen.</p>

    <h2 class="section">Themen</h2>
    <div class="list">
      {#each TOPICS as t (t.id)}
        <button class="row" data-area={t.area === 'intervals' ? 'intervals' : 'notes'} onclick={() => show(t.id)}>
          <span class="name">{t.title}</span>
          <span class="chev" aria-hidden="true">›</span>
        </button>
      {/each}
    </div>

    <h2 class="section" data-area="intervals">Die 13 Intervalle</h2>
    <div class="list" data-area="intervals">
      {#each INTERVAL_CARDS as c (c.id)}
        <button class="row" onclick={() => show(c.id)}>
          <span class="num" aria-hidden="true">{semitones(c.id)}</span>
          <span class="name">{c.title}</span>
          <span class="sub">{halbtoene(semitones(c.id))}</span>
          <span class="chev" aria-hidden="true">›</span>
        </button>
      {/each}
    </div>
  {/if}
</main>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 8px 14px;
    text-align: left;
    background: var(--surface);
    box-shadow: var(--shadow);
    border: 2px solid transparent;
    border-radius: 14px;
    font-size: 1rem;
  }
  .row:active {
    background: var(--accent-soft);
  }
  .num {
    flex: none;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-soft-ink);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }
  .sub {
    flex: none;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .chev {
    flex: none;
    color: var(--muted);
    font-size: 1.3rem;
  }
</style>
