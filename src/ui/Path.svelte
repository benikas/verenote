<script lang="ts">
  import { recentStat } from '../progress/progress'
  import { MARK_LABEL, levelMark } from '../progress/marks'
  import { RECENT_ATTEMPTS, ROUND_LENGTHS } from '../storage/schema'
  import { LEVELS, type LevelId } from '../theory/tasks'
  import { persistSoon, progress, settings } from './data.svelte'

  let {
    onback,
    onstart,
  }: { onback: () => void; onstart: (level: LevelId, length: number) => void } = $props()

  const DESCRIPTIONS: Record<LevelId, string> = {
    '1a': 'Nur drei Töne, gut zu unterscheiden. Der beste Einstieg.',
    '1b': 'Zwei Töne mehr: D und F dazu.',
    '1c': 'Alle sieben Stammtöne von C bis B.',
    '1d': 'Der Zielton kann eine Oktave tiefer oder höher liegen.',
    '1e': 'Auch die schwarzen Tasten: Töne mit # und b.',
    '2a': 'Prime, Quinte und Oktave, immer ab Startton C.',
    '2b': 'Dazu Quarte und grosse Terz.',
    '2c': 'Dazu grosse Sekunde und kleine Terz: sieben Intervalle.',
    '2d': 'Alle 13 Intervalle aufwärts, der Startton wechselt.',
    '2e': 'Alle Intervalle abwärts, der Startton wechselt.',
    '2f': 'Alle Intervalle gleichzeitig gespielt (harmonisch).',
  }

  /** Gewählte Stufe (zuletzt benutzte, gespeichert). Nichts ist gesperrt. */
  const level = $derived(settings.level)

  function setLevel(id: LevelId) {
    settings.level = id
    persistSoon()
  }

  function setLength(n: number) {
    settings.length = n
    persistSoon()
  }

  const pct = (x: number) => `${Math.round(x * 100)} %`
</script>

<main class="page path">
  <header class="page-head">
    <button class="back" aria-label="Zurück" onclick={onback}>←</button>
    <h1>Lernpfad</h1>
  </header>
  <p class="muted-text">Empfohlene Reihenfolge. Du kannst jede Stufe jederzeit wählen.</p>

  <div class="levels" role="radiogroup" aria-label="Stufe">
    {#each LEVELS as l, i (l.id)}
      {#if i === 0 || LEVELS[i - 1].kind !== l.kind}
        <h2 class="section" data-area={l.kind}>{l.kind === 'notes' ? 'Grundtöne' : 'Intervalle'}</h2>
      {/if}
      {@const mark = levelMark(progress, l.id)}
      {@const st = recentStat(progress, l.id)}
      {@const selected = level === l.id}
      <button class="level" data-area={l.kind} class:selected role="radio" aria-checked={selected} onclick={() => setLevel(l.id)}>
        <span class="line">
          <span class="id">{l.id}</span>
          <span class="name">{l.label}</span>
          <span class="badge {mark}">{mark === 'geschafft' ? '✓ ' : ''}{MARK_LABEL[mark]}</span>
          <span class="quote">{st.attempts > 0 ? pct(st.accuracy) : ''}</span>
        </span>
        {#if selected}
          <span class="desc">{DESCRIPTIONS[l.id]}</span>
          <span class="desc">
            {#if st.attempts > 0}
              Letzte {st.attempts} {st.attempts === 1 ? 'Versuch' : 'Versuche'}: {pct(st.accuracy)} richtig.
            {/if}
            {#if mark !== 'geschafft'}Geschafft ab {pct(settings.doneThreshold)} über {RECENT_ATTEMPTS} Versuche.{/if}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <h2 class="section">Aufgaben pro Runde</h2>
  <div class="chips" role="radiogroup" aria-label="Aufgaben pro Runde">
    {#each ROUND_LENGTHS as n (n)}
      <button class="chip" class:selected={settings.length === n} role="radio" aria-checked={settings.length === n} onclick={() => setLength(n)}>{n}</button>
    {/each}
  </div>

  <button class="btn-primary go" onclick={() => onstart(level, settings.length)}>Runde starten · Stufe {level}</button>
</main>

<style>
  .levels {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .levels .section:first-child {
    margin-top: 0;
  }
  .level {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    min-height: 52px;
    background: var(--surface);
    box-shadow: var(--shadow);
    border: 2px solid transparent;
    border-radius: 14px;
    padding: 10px 14px;
  }
  .level.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 30px;
  }
  .id {
    flex: none;
    font-weight: 700;
    color: var(--accent);
    min-width: 1.6em;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    line-height: 1.25;
  }
  .badge {
    flex: none;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 700;
  }
  .badge.begonnen {
    background: var(--warn-soft);
    color: var(--warn-soft-ink);
  }
  .badge.geschafft {
    background: var(--good-soft);
    color: var(--good-soft-ink);
  }
  .quote {
    flex: none;
    min-width: 3em;
    text-align: right;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .desc {
    font-size: 0.85rem;
    color: var(--muted);
    line-height: 1.35;
    padding-left: calc(1.6em + 10px);
  }
  .go {
    position: sticky;
    bottom: 12px;
    margin-top: 8px;
    box-shadow: 0 0 0 8px var(--bg);
  }
</style>
