<script lang="ts">
  import { INTERVALS } from '../theory/intervals'
  /**
   * Antwort-Buttons für Intervalle (Prime bis Oktave), deutsche Namen, Hochformat.
   * Nicht benötigte Intervalle sind ausgegraut und nicht antippbar.
   * Die Antwort kommt als Halbtonzahl (0–12) über onpress.
   */
  type Mark = 'correct' | 'wrong'

  let {
    enabled,
    marks = {},
    locked = false,
    onpress,
  }: {
    /** Antippbare Intervalle in Halbtönen */
    enabled: readonly number[]
    /** Feedback-Farben pro Intervall (Schlüssel: Halbtonzahl als Text) */
    marks?: Record<string, Mark>
    locked?: boolean
    onpress: (semitones: number) => void
  } = $props()

  const isEnabled = (n: number) => enabled.includes(n)

  function press(n: number) {
    if (locked || !isEnabled(n)) return
    onpress(n)
  }

  /** Name in zwei Zeilen: „Kleine“ / „Terz“ */
  const lines = (name: string) => name.split(' ')
</script>

<div class="grid" role="group" aria-label="Intervalle">
  {#each INTERVALS as i (i.semitones)}
    <button
      class:off={!isEnabled(i.semitones)}
      class:locked
      class:correct={marks[String(i.semitones)] === 'correct'}
      class:wrong={marks[String(i.semitones)] === 'wrong'}
      disabled={!isEnabled(i.semitones)}
      aria-label={i.name}
      onpointerdown={() => press(i.semitones)}
      onclick={(e) => {
        // Tastatur-Bedienung (Enter/Leertaste): detail ist dann 0
        if (e.detail === 0) press(i.semitones)
      }}
    >
      {#each lines(i.name) as part, k (k)}<span>{part}</span>{/each}
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  button {
    position: relative;
    min-height: 48px;
    padding: 4px 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.12;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  button:not(.off):not(.locked):active {
    background: var(--accent-soft);
  }
  button.off {
    background: var(--surface-off);
    color: var(--disabled);
    box-shadow: none;
  }
  /* Richtig/falsch nur über Farbe (Entscheidung Auftraggeber 14.10.); der Text „Richtig/Falsch“ steht zusätzlich im Feedback */
  button.correct {
    background: var(--good);
    color: var(--good-ink);
    border-color: var(--good);
  }
  button.wrong {
    background: var(--bad);
    color: var(--bad-ink);
    border-color: var(--bad);
    /* auch ohne Rot/Grün erkennbar: heller Innenring (PL, Farbschwäche) */
    box-shadow: inset 0 0 0 3px var(--bad-ink);
  }
</style>
