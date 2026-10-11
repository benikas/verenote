<script lang="ts">
  import type { SessionSummary } from '../exercise/session'
  import { displayName } from '../theory/notes'
  import { getLevel, type LevelId } from '../theory/tasks'

  let {
    summary,
    achieved = [],
    nextLevel = null,
    onagain,
    onnext,
    onhome,
  }: {
    summary: SessionSummary
    /** Mit dieser Runde „geschaffte“ Stufen */
    achieved?: LevelId[]
    /** Stufe nach der geübten (null bei der letzten) */
    nextLevel?: LevelId | null
    onagain: () => void
    onnext: (level: LevelId) => void
    onhome: () => void
  } = $props()

  /** Die gerade geübte Stufe ist mit dieser Runde geschafft: „Weiter mit …“ anbieten */
  const justDone = $derived(achieved.includes(summary.level) && nextLevel !== null)

  const percent = $derived(Math.round(summary.accuracy * 100))
  const weak = $derived(summary.perNote.filter((n) => n.attempts > n.correct))
</script>

<main class="sum">
  <h1>Ergebnis</h1>

  <div class="big" class:good={percent >= 80}>
    <span class="pct">{percent} %</span>
    <span class="sub">{summary.correct} von {summary.total} richtig</span>
  </div>

  {#if achieved.length > 0}
    <p class="unlock" role="status">
      🎉 Stufe geschafft: <b>{achieved.map((id) => `${id} · ${getLevel(id).label}`).join(', ')}</b>
    </p>
  {:else}
    <p class="note">Eine Stufe gilt als geschafft bei ca. 80 % über die letzten 20 Versuche.</p>
  {/if}

  <h2>Pro Ton</h2>
  <ul class="notes">
    {#each summary.perNote as n (n.note)}
      <li class:miss={n.attempts > n.correct}>
        <span class="name">{displayName(n.note)}</span>
        <span class="ratio">
          {#if n.attempts === 0}nicht gefragt{:else}{n.correct} / {n.attempts}{/if}
        </span>
      </li>
    {/each}
  </ul>

  {#if weak.length > 0}
    <p class="hint">Zum Üben: {weak.map((n) => displayName(n.note)).join(', ')}</p>
  {/if}

  <div class="buttons">
    {#if justDone && nextLevel}
      <button class="go" onclick={() => onnext(nextLevel)}>Weiter mit {nextLevel}</button>
      <button class="ghost" onclick={onagain}>Nochmal {summary.level}</button>
    {:else}
      <button class="go" onclick={onagain}>Nochmal</button>
    {/if}
    <button class="ghost" onclick={onhome}>Zur Auswahl</button>
  </div>
</main>

<style>
  .sum {
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
  .big {
    background: var(--surface);
    border-radius: 18px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .pct {
    font-size: 3rem;
    font-weight: 700;
  }
  .big.good .pct {
    color: var(--good);
  }
  .sub {
    color: var(--muted);
  }
  .note {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }
  .notes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
  }
  li {
    background: var(--surface);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  li.miss {
    box-shadow: inset 0 0 0 2px var(--bad);
  }
  .name {
    font-weight: 700;
    font-size: 1.1rem;
  }
  .ratio {
    font-size: 0.85rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .buttons {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .go {
    background: var(--accent);
    color: #fff;
    border: 0;
    border-radius: 16px;
    padding: 18px;
    font-size: 1.15rem;
    font-weight: 600;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--surface-2);
    border-radius: 16px;
    padding: 16px;
    color: var(--muted);
    font-size: 1rem;
  }
  .unlock {
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: #12372a;
    color: #c9f5de;
    line-height: 1.4;
  }
</style>
