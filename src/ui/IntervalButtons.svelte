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
    gap: 8px;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  button {
    min-height: 52px;
    padding: 6px 4px;
    border: 0;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.15;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  button:not(.off):not(.locked):active {
    background: var(--accent);
  }
  button.off {
    background: #1b1e26;
    color: #5c6475;
  }
  button.correct {
    background: var(--good);
    color: #06281a;
  }
  button.wrong {
    background: var(--bad);
    color: #3a0808;
  }
</style>
