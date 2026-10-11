<script lang="ts">
  import { displayName } from '../theory/notes'
  /**
   * Klaviatur mit einer Oktave (C bis B), Hochformat.
   * Nicht benötigte Tasten sind ausgegraut und nicht antippbar.
   * Antworten kommen als Pitch Class ("C", "F#") über onpress.
   */
  type Mark = 'correct' | 'wrong'

  let {
    enabled,
    marks = {},
    locked = false,
    onpress,
  }: {
    /** Antippbare Tasten als Pitch Class, z. B. ['C', 'E', 'G'] */
    enabled: readonly string[]
    /** Feedback-Farben pro Taste */
    marks?: Record<string, Mark>
    /** Alle Tasten vorübergehend sperren (z. B. beim Zuhören oder nach der Antwort) */
    locked?: boolean
    onpress: (note: string) => void
  } = $props()

  const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  // Schwarze Tasten sitzen auf den Grenzen zwischen weißen Tasten: Nummer der Grenze 1–6
  const BLACK: { note: string; boundary: number }[] = [
    { note: 'C#', boundary: 1 },
    { note: 'D#', boundary: 2 },
    { note: 'F#', boundary: 4 },
    { note: 'G#', boundary: 5 },
    { note: 'A#', boundary: 6 },
  ]
  const W = 100 / 7
  const BLACK_W = W * 0.62

  const isEnabled = (n: string) => enabled.includes(n)

  function press(n: string) {
    if (locked || !isEnabled(n)) return
    onpress(n)
  }
</script>

<div class="kb" role="group" aria-label="Klaviatur">
  <div class="whites">
    {#each WHITE as n (n)}
      <button
        class="white"
        class:off={!isEnabled(n)}
        class:locked
        class:correct={marks[n] === 'correct'}
        class:wrong={marks[n] === 'wrong'}
        disabled={!isEnabled(n)}
        aria-label={n}
        onpointerdown={() => press(n)}
        onclick={(e) => {
          // Tastatur-Bedienung (Enter/Leertaste): detail ist dann 0
          if (e.detail === 0) press(n)
        }}
      >
        <span class="label">{n}</span>
      </button>
    {/each}
  </div>

  {#each BLACK as b (b.note)}
    <button
      class="black"
      class:off={!isEnabled(b.note)}
      class:locked
      class:correct={marks[b.note] === 'correct'}
      class:wrong={marks[b.note] === 'wrong'}
      style:left="{b.boundary * W - BLACK_W / 2}%"
      style:width="{BLACK_W}%"
      disabled={!isEnabled(b.note)}
      aria-label={displayName(b.note)}
      onpointerdown={() => press(b.note)}
      onclick={(e) => {
        if (e.detail === 0) press(b.note)
      }}
    >
      {#if isEnabled(b.note)}
        <span class="blabel">{b.note}<br />{displayName(b.note).split('/')[1]}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .kb {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 180px;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .whites {
    display: flex;
    height: 100%;
    gap: 3px;
  }
  button {
    border: 0;
    padding: 0;
    font: inherit;
  }
  .white {
    flex: 1;
    min-width: 0;
    background: #f1f3f8;
    color: #1b1e27;
    border-radius: 0 0 10px 10px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 14px;
    transition: background 0.08s;
  }
  .label {
    font-size: 1.05rem;
    font-weight: 600;
    pointer-events: none;
  }
  .white:not(.off):not(.locked):active {
    background: #c9d6ff;
  }
  .white.off {
    background: #2a2f3a;
    color: #5c6475;
  }
  .black {
    position: absolute;
    top: 0;
    height: 62%;
    background: #0a0b0f;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 0 0 2px var(--bg);
    z-index: 1;
  }
  .black {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 8px;
  }
  .blabel {
    font-size: 0.66rem;
    line-height: 1.25;
    font-weight: 600;
    color: #dfe6ff;
    pointer-events: none;
  }
  .black.correct .blabel,
  .black.wrong .blabel {
    color: inherit;
  }
  .black.off {
    background: #1b1e26;
  }
  .black:not(.off):not(.locked):active {
    background: #34406a;
  }
  .white.correct,
  .black.correct {
    background: var(--good);
    color: #06281a;
  }
  .white.wrong,
  .black.wrong {
    background: var(--bad);
    color: #3a0808;
  }
</style>
