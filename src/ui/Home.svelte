<script lang="ts">
  import { audio } from '../audio/engine'
  import { TEMPO_MAX, TEMPO_MIN, TEMPO_STEP, taskTiming } from '../exercise/settings'
  import { recentStat } from '../progress/progress'
  import { currentLevel, isUnlocked, unlockHint } from '../progress/unlock'
  import { RECENT_ATTEMPTS, ROUND_LENGTHS } from '../storage/schema'
  import { LEVELS, type LevelId } from '../theory/tasks'
  import { persistSoon, progress, settings } from './data.svelte'

  let {
    onstart,
    ontest,
  }: { onstart: (level: LevelId, length: number) => void; ontest: () => void } = $props()

  const DESCRIPTIONS: Record<LevelId, string> = {
    '1a': 'Nur drei Töne, gut zu unterscheiden. Der beste Einstieg.',
    '1b': 'Zwei Töne mehr: D und F dazu.',
    '1c': 'Alle sieben Stammtöne von C bis B.',
    '1d': 'Der Zielton kann eine Oktave tiefer oder höher liegen.',
    '1e': 'Auch die schwarzen Tasten: Töne mit # und b.',
  }

  /** Lernpfad: Es wird immer die höchste freigeschaltete Stufe geübt. */
  const current = $derived(currentLevel(progress))
  const info = (id: LevelId) => recentStat(progress, id)

  function setLength(n: number) {
    settings.length = n
    persistSoon()
  }

  const seconds = (n: number) => `${n.toFixed(2).replace('.', ',')} s`

  /** Probehören: Referenz C und ein Zielton im eingestellten Tempo */
  function tryTempo() {
    void audio.playSequence(['C4', 'E4'], taskTiming(settings.tempo))
  }
</script>

<main class="home">
  <h1>Grundtöne</h1>
  <p class="lead">
    Du hörst zuerst den Referenzton C, dann einen Zielton. Tippe auf der Klaviatur, welcher Ton es
    war.
  </p>

  <h2>Lernpfad</h2>
  <ol class="levels" aria-label="Lernpfad">
    {#each LEVELS as l (l.id)}
      {@const open = isUnlocked(progress, l.id)}
      {@const st = info(l.id)}
      <li class="level" class:current={l.id === current} class:locked={!open}>
        <span class="name">
          {#if !open}<span aria-hidden="true">🔒 </span>{/if}{l.id} · {l.label}
          {#if l.id === current}<span class="badge">Jetzt</span>{/if}
        </span>
        <span class="desc">{DESCRIPTIONS[l.id]}</span>
        {#if open}
          <span class="desc">
            {#if st.attempts === 0}
              Noch nicht geübt.
            {:else}
              Letzte {st.attempts} {st.attempts === 1 ? 'Versuch' : 'Versuche'}: {Math.round(st.accuracy * 100)} % richtig{#if st.attempts < RECENT_ATTEMPTS} (für die Freischaltung zählen {RECENT_ATTEMPTS}){/if}
            {/if}
          </span>
        {:else}
          <span class="desc hint">{unlockHint(progress, l.id, settings.unlockThreshold)}</span>
        {/if}
      </li>
    {/each}
  </ol>

  <h2>Aufgaben pro Runde</h2>
  <div class="chips" role="radiogroup" aria-label="Aufgaben pro Runde">
    {#each ROUND_LENGTHS as n (n)}
      <button
        class="chip"
        class:selected={settings.length === n}
        role="radio"
        aria-checked={settings.length === n}
        onclick={() => setLength(n)}>{n}</button
      >
    {/each}
  </div>

  <h2>Einstellungen</h2>
  <div class="settings">
    <div class="row">
      <div class="text">
        <span class="name">Gehör neutralisieren</span>
        <span class="desc">Kurze atonale Tonfolge vor jeder neuen Aufgabe (ab der zweiten)</span>
      </div>
      <button
        class="switch"
        class:on={settings.neutralize}
        role="switch"
        aria-checked={settings.neutralize}
        aria-label="Gehör neutralisieren"
        onclick={() => {
          settings.neutralize = !settings.neutralize
          persistSoon()
        }}><span class="knob"></span></button
      >
    </div>

    <div class="row" class:dim={!settings.neutralize}>
      <span class="name">Länge</span>
      <div class="chips small" role="radiogroup" aria-label="Länge der Neutralisierung">
        <button
          class="chip"
          class:selected={settings.neutralLength === 'short'}
          role="radio"
          aria-checked={settings.neutralLength === 'short'}
          disabled={!settings.neutralize}
          onclick={() => {
            settings.neutralLength = 'short'
            persistSoon()
          }}>Kurz</button
        >
        <button
          class="chip"
          class:selected={settings.neutralLength === 'long'}
          role="radio"
          aria-checked={settings.neutralLength === 'long'}
          disabled={!settings.neutralize}
          onclick={() => {
            settings.neutralLength = 'long'
            persistSoon()
          }}>Lang</button
        >
      </div>
    </div>

    <div class="tempo">
      <div class="row">
        <div class="text">
          <span class="name">Tempo</span>
          <span class="desc">Abstand zwischen Referenz- und Zielton: {seconds(settings.tempo)}</span>
        </div>
        <button class="try" onclick={tryTempo}>Probehören</button>
      </div>
      <input
        type="range"
        min={TEMPO_MIN}
        max={TEMPO_MAX}
        step={TEMPO_STEP}
        bind:value={settings.tempo}
        oninput={() => persistSoon()}
        aria-label="Tempo: Abstand zwischen Referenz- und Zielton"
      />
      <div class="ends"><span>schneller</span><span>langsamer</span></div>
    </div>
  </div>

  <button class="go" onclick={() => onstart(current, settings.length)}>Runde starten · Stufe {current}</button>
  <button class="link" onclick={ontest}>Ton-Prüfung (alle Töne anhören)</button>
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
  .level.current {
    border-color: var(--accent);
    background: #1d2742;
  }
  .level.locked {
    opacity: 0.75;
  }
  .levels {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .badge {
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent);
    color: #0c1020;
    font-size: 0.7rem;
    font-weight: 700;
    vertical-align: middle;
  }
  .hint {
    color: var(--text);
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
  .settings {
    background: var(--surface);
    border-radius: 14px;
    padding: 6px 16px;
    display: flex;
    flex-direction: column;
  }
  .settings .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
  }
  .settings .row.dim {
    opacity: 0.45;
  }
  .settings .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .chips.small .chip {
    padding: 8px 16px;
    font-size: 0.95rem;
  }
  .switch {
    flex: none;
    width: 52px;
    height: 32px;
    border-radius: 16px;
    border: 0;
    background: var(--surface-2);
    position: relative;
    transition: background 0.15s;
  }
  .switch.on {
    background: var(--accent);
  }
  .knob {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }
  .switch.on .knob {
    transform: translateX(20px);
  }
  .tempo {
    border-top: 1px solid var(--surface-2);
    padding-bottom: 12px;
  }
  .tempo .row {
    padding-bottom: 4px;
  }
  .try {
    flex: none;
    background: var(--surface-2);
    border: 0;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 0.9rem;
  }
  .try:active {
    background: var(--accent);
  }
  input[type='range'] {
    width: 100%;
    margin: 8px 0 2px;
    accent-color: var(--accent);
    height: 32px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--muted);
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
