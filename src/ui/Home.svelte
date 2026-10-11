<script lang="ts">
  import { shouldRemind, dismissReminder } from '../storage/backup'
  import { LEVELS } from '../theory/tasks'
  import { backup, persistNow, progress } from './data.svelte'
  import { exportProgress } from './exportFile'

  let {
    onpath,
    onfree,
    onstats,
    onsettings,
  }: { onpath: () => void; onfree: () => void; onstats: () => void; onsettings: () => void } = $props()

  // Erinnerung an den Export (2.11)
  const remind = $derived(shouldRemind(backup))
  let exportNote = $state<string | null>(null)

  async function exportNow() {
    exportNote = null
    const r = await exportProgress()
    if (r.ok) exportNote = 'Gesichert.'
    else if (!r.cancelled) exportNote = 'Export nicht möglich.'
  }

  function dismiss() {
    dismissReminder(backup)
    void persistNow()
  }

  const doneCount = $derived(progress.done.length)
</script>

<main class="page home">
  <h1>Gehörtraining</h1>
  <p class="muted-text">Töne und Intervalle erkennen. Wähle, wie du üben willst.</p>

  {#if remind}
    <div class="remind" role="status">
      <span>Du hast {backup.roundsSinceExport} Runden nicht gesichert. Ein Export schützt deinen Fortschritt.</span>
      <div class="remind-actions">
        <button onclick={exportNow}>Jetzt exportieren</button>
        <button class="x" aria-label="Hinweis ausblenden" onclick={dismiss}>✕</button>
      </div>
    </div>
  {:else if exportNote}
    <p class="muted-text" role="status">{exportNote}</p>
  {/if}

  <div class="tiles">
    <button class="tile primary" onclick={onpath}>
      <span class="title">Lernpfad</span>
      <span class="sub">{doneCount} von {LEVELS.length} Stufen geschafft</span>
    </button>
    <button class="tile" onclick={onfree}>
      <span class="title">Freies Training</span>
      <span class="sub">Töne oder Intervalle selbst zusammenstellen</span>
    </button>
    <button class="tile" onclick={onstats}>
      <span class="title">Statistik</span>
      <span class="sub">Quoten, Töne, Intervalle, letzte Runden</span>
    </button>
    <button class="tile" onclick={onsettings}>
      <span class="title">Einstellungen</span>
      <span class="sub">Neutralisierung, Tempo, Daten, Technik</span>
    </button>
  </div>
</main>

<style>
  .home {
    padding-top: 32px;
  }
  h1 {
    margin: 4px 0 0;
    font-size: 1.8rem;
  }
  .tiles {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
  }
  .tile {
    min-height: 88px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    text-align: left;
    background: var(--surface);
    border: 2px solid transparent;
    border-radius: 18px;
    padding: 16px 20px;
  }
  .tile:active {
    background: var(--surface-2);
  }
  .tile.primary {
    min-height: 104px;
    background: var(--accent);
    color: #fff;
  }
  .tile.primary:active {
    filter: brightness(0.9);
    background: var(--accent);
  }
  .title {
    font-size: 1.25rem;
    font-weight: 600;
  }
  .sub {
    font-size: 0.9rem;
    color: var(--muted);
    line-height: 1.3;
  }
  .primary .sub {
    color: rgba(255, 255, 255, 0.85);
  }
  .remind {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    background: #3b3015;
    color: #ffe9a8;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .remind-actions {
    display: flex;
    gap: 10px;
  }
  .remind-actions button {
    min-height: 44px;
    background: rgba(255, 255, 255, 0.12);
    border: 0;
    border-radius: 10px;
    padding: 10px 14px;
    color: inherit;
    font-size: 0.9rem;
  }
  .remind-actions .x {
    margin-left: auto;
    min-width: 44px;
  }
</style>
