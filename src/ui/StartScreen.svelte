<script lang="ts">
  import type { LoadState } from '../audio/engine'

  let { load, onstart }: { load: LoadState; onstart: () => void } = $props()

  const percent = $derived(Math.round(load.progress * 100))
</script>

<main class="start">
  <div class="top">
    <h1>Gehörtraining</h1>
    <p class="lead">Höre Töne, erkenne sie, tippe die Antwort.</p>
  </div>

  <div class="middle">
    <button class="go" onclick={onstart}>Start</button>

    <div class="status" aria-live="polite">
      {#if load.phase === 'ready'}
        <span class="ok">Klavierklang bereit</span>
      {:else if load.phase === 'error'}
        <span class="warn">Klavier nicht geladen, einfacher Klang wird verwendet</span>
      {:else}
        <span>Klavierklang lädt … {percent} %</span>
        <div class="bar"><div class="fill" style:width="{percent}%"></div></div>
      {/if}
    </div>

    <p class="hint">
      iPhone: Stummschalter seitlich auf Ton stellen und die Lautstärke prüfen. Mit Kopfhörern
      hört man genauer.
    </p>
  </div>

  <footer>
    Klaviersamples: Salamander Grand Piano V3 von Alexander Holm,
    <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer"
      >CC BY 3.0</a
    >
  </footer>
</main>

<style>
  .start {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 32px 24px 20px;
    max-width: 480px;
    width: 100%;
    margin: 0 auto;
  }
  h1 {
    font-size: 2rem;
    margin: 24px 0 8px;
  }
  .lead {
    color: var(--muted);
    margin: 0;
  }
  .middle {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .go {
    background: var(--accent);
    border: 0;
    border-radius: 16px;
    padding: 22px;
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--accent-ink);
  }
  .go:active {
    filter: brightness(0.9);
  }
  .status {
    font-size: 0.9rem;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 2.4em;
  }
  .ok {
    color: var(--good);
  }
  .warn {
    color: var(--bad);
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.15s;
  }
  .hint {
    font-size: 0.85rem;
    color: var(--muted);
    background: var(--surface);
    box-shadow: var(--shadow);
    border-radius: 12px;
    padding: 12px 14px;
    margin: 0;
    line-height: 1.4;
  }
  footer {
    font-size: 0.75rem;
    color: var(--muted);
    text-align: center;
    padding-top: 16px;
  }
  footer a {
    /* größere Berührfläche für den Lizenz-Link */
    display: inline-block;
    padding: 14px 6px;
    margin: -14px -6px;
  }
</style>
