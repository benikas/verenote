<script lang="ts">
  import { buildStats } from '../progress/stats'
  import { RECENT_ATTEMPTS } from '../storage/schema'
  import { displayName } from '../theory/notes'
  import { MARK_LABEL } from '../progress/marks'
  import { progress } from './data.svelte'

  let { onback }: { onback: () => void } = $props()

  const stats = $derived(buildStats(progress, 10))
  /** Kurzbezeichnung der Stufe bzw. des Freien Trainings für die Rundenliste */
  const roundLabel = (level: string) => (level === 'free-notes' ? 'Fr. T' : level === 'free-intervals' ? 'Fr. I' : level)
  const variantText = (i: (typeof stats.intervals)[number]) =>
    [
      i.up.hits + i.up.misses > 0 ? `↑ ${i.up.hits}/${i.up.hits + i.up.misses}` : '',
      i.down.hits + i.down.misses > 0 ? `↓ ${i.down.hits}/${i.down.hits + i.down.misses}` : '',
      i.harm.hits + i.harm.misses > 0 ? `gleichzeitig ${i.harm.hits}/${i.harm.hits + i.harm.misses}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  const pct = (x: number) => `${Math.round(x * 100)} %`
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric' })

</script>

<main class="stats">
  <header>
    <button class="back" aria-label="Zurück" onclick={onback}>←</button>
    <h1>Statistik</h1>
  </header>

  {#if stats.totalAttempts === 0 && stats.rounds.length === 0}
    <p class="empty">Noch keine Daten. Spiel eine Runde, dann erscheinen hier deine Zahlen.</p>
  {/if}

  <h2>Stufen</h2>
  <ul class="rows">
    {#each stats.levels as l (l.id)}
      <li>
        <span class="name">{l.mark === 'geschafft' ? '✓ ' : ''}{l.id} · {l.label}</span>
        {#if l.attempts === 0}
          <span class="val muted">{MARK_LABEL[l.mark]}{l.mark === 'neu' ? '' : ', keine aktuellen Versuche'}</span>
        {:else}
          <span class="bar"><span class="fill" style:width="{l.accuracy * 100}%"></span></span>
          <span class="val">{pct(l.accuracy)} <small>({l.attempts}/{RECENT_ATTEMPTS})</small></span>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="foot">Quote über die letzten {RECENT_ATTEMPTS} Versuche je Stufe. „✓“ = geschafft (bleibt gesetzt).</p>

  <h2>Töne</h2>
  <ul class="rows tones">
    {#each stats.tones as t (t.note)}
      <li>
        <span class="name">{displayName(t.note)}</span>
        {#if t.accuracy === null}
          <span class="val muted">–</span>
        {:else}
          <span class="bar"><span class="fill" class:low={t.accuracy < 0.6} style:width="{t.accuracy * 100}%"></span></span>
          <span class="val">{pct(t.accuracy)} <small>({t.hits}/{t.attempts})</small></span>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="foot">Alle Versuche seit Beginn, je Zielton (Lernpfad und Freies Training).</p>

  <h2>Intervalle</h2>
  <ul class="rows ivs">
    {#each stats.intervals as i (i.semitones)}
      <li>
        <span class="name">{i.name}</span>
        {#if i.accuracy === null}
          <span class="val muted">–</span>
        {:else}
          <span class="bar"><span class="fill" class:low={i.accuracy < 0.6} style:width="{i.accuracy * 100}%"></span></span>
          <span class="val">{pct(i.accuracy)} <small>({i.hits}/{i.attempts})</small></span>
          <small class="detail">{variantText(i)}</small>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="foot">Alle Versuche seit Beginn, je Intervall und zusammen für alle Richtungen. Darunter: aufwärts, abwärts, gleichzeitig (Treffer/Versuche).</p>

  <h2>Letzte Runden</h2>
  {#if stats.rounds.length === 0}
    <p class="foot">Noch keine abgeschlossene Runde.</p>
  {:else}
    <div class="rounds" role="img" aria-label="Trefferquote der letzten Runden">
      {#each stats.rounds as r, i (i)}
        <div class="col">
          <span class="pct">{Math.round(r.accuracy * 100)}</span>
          <span class="colbar"><span class="colfill" style:height="{r.accuracy * 100}%"></span></span>
          <span class="lv">{roundLabel(r.level)}</span>
          <span class="dt">{dateOf(r.at)}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if stats.rounds.some((r) => r.level.startsWith('free'))}
    <p class="foot">Fr. T / Fr. I = Freies Training, Grundtöne bzw. Intervalle.</p>
  {/if}

</main>

<style>
  .stats {
    flex: 1;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 20px 20px 32px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  h2 {
    margin: 16px 0 0;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .back {
    background: var(--surface);
    box-shadow: var(--shadow);
    border: 0;
    border-radius: 12px;
    width: 44px;
    height: 44px;
    font-size: 1.2rem;
  }
  .empty,
  .foot {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.4;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--surface);
    box-shadow: var(--shadow);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
  }
  .rows li {
    display: grid;
    grid-template-columns: 8.5em 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--bg);
  }
  .rows li:last-child {
    border-bottom: 0;
  }
  .ivs li {
    grid-template-columns: 8.5em 1fr auto;
  }
  .detail {
    grid-column: 1 / 4;
    margin-top: -4px;
  }
  .tones li {
    grid-template-columns: 4.5em 1fr auto;
  }
  .name {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .val {
    font-size: 0.9rem;
    text-align: right;
    min-width: 5.5em;
    grid-column: 3;
  }
  .val.muted {
    grid-column: 2 / 4;
    color: var(--muted);
  }
  small {
    color: var(--muted);
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--good);
  }
  .fill.low {
    background: var(--bad);
  }
  .rounds {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    background: var(--surface);
    box-shadow: var(--shadow);
    border-radius: 14px;
    padding: 14px 10px 10px;
    overflow-x: auto;
  }
  .col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
  }
  .colbar {
    width: 100%;
    height: 80px;
    display: flex;
    align-items: flex-end;
    background: var(--surface-2);
    border-radius: 4px;
    overflow: hidden;
  }
  .colfill {
    width: 100%;
    background: var(--accent);
  }
  .pct {
    font-weight: 700;
  }
  .lv,
  .dt {
    color: var(--muted);
  }
</style>
