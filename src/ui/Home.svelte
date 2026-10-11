<script lang="ts">
  import { LEVELS, type LevelId } from '../theory/tasks'

  let {
    onstart,
    ontest,
  }: { onstart: (level: LevelId, length: number) => void; ontest: () => void } = $props()

  const DESCRIPTIONS: Record<LevelId, string> = {
    '1a': 'Nur drei Töne, gut zu unterscheiden. Der beste Einstieg.',
    '1b': 'Zwei Töne mehr: D und F dazu.',
    '1c': 'Alle sieben Stammtöne von C bis B.',
  }
  const LENGTHS = [10, 15, 20]

  let level = $state<LevelId>('1a')
  let length = $state(15)
</script>

<main class="home">
  <h1>Grundtöne</h1>
  <p class="lead">
    Du hörst zuerst den Referenzton C, dann einen Zielton. Tippe auf der Klaviatur, welcher Ton es
    war.
  </p>

  <h2>Stufe</h2>
  <div class="levels" role="radiogroup" aria-label="Stufe">
    {#each LEVELS as l (l.id)}
      <button
        class="level"
        class:selected={level === l.id}
        role="radio"
        aria-checked={level === l.id}
        onclick={() => (level = l.id)}
      >
        <span class="name">{l.id} · {l.label}</span>
        <span class="desc">{DESCRIPTIONS[l.id]}</span>
      </button>
    {/each}
  </div>

  <h2>Aufgaben pro Runde</h2>
  <div class="chips" role="radiogroup" aria-label="Aufgaben pro Runde">
    {#each LENGTHS as n (n)}
      <button
        class="chip"
        class:selected={length === n}
        role="radio"
        aria-checked={length === n}
        onclick={() => (length = n)}>{n}</button
      >
    {/each}
  </div>

  <button class="go" onclick={() => onstart(level, length)}>Runde starten</button>
  <button class="link" onclick={ontest}>Audio-Test</button>
</main>

<style>
  .home {
    flex: 1;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 28px 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin: 12px 0 0;
    font-size: 1.8rem;
  }
  h2 {
    margin: 14px 0 0;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .lead {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }
  .levels {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .level {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    background: var(--surface);
    border: 2px solid transparent;
    border-radius: 14px;
    padding: 14px 16px;
  }
  .level.selected {
    border-color: var(--accent);
    background: #1d2742;
  }
  .name {
    font-weight: 600;
  }
  .desc {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .chips {
    display: flex;
    gap: 10px;
  }
  .chip {
    flex: 1;
    background: var(--surface);
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 14px;
    font-size: 1.05rem;
  }
  .chip.selected {
    border-color: var(--accent);
    background: #1d2742;
  }
  .go {
    margin-top: auto;
    background: var(--accent);
    color: #fff;
    border: 0;
    border-radius: 16px;
    padding: 20px;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .go:active {
    filter: brightness(0.9);
  }
  .link {
    background: none;
    border: 0;
    color: var(--muted);
    font-size: 0.85rem;
    padding: 8px;
    text-decoration: underline;
  }
</style>
