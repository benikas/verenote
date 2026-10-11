<script lang="ts">
  import { audio } from '../audio/engine'
  import { TEMPO_MAX, TEMPO_MIN, TEMPO_STEP, taskTiming } from '../exercise/settings'
  import { emptyData, type AppData } from '../storage/schema'
  import { markExported } from '../storage/backup'
  import { parseImport } from '../storage/transfer'
  import { buildStats } from '../progress/stats'
  import { applyData, backup, persistNow, persistSoon, storageState, settings } from './data.svelte'
  import { exportProgress } from './exportFile'

  let { onback, ontest }: { onback: () => void; ontest: () => void } = $props()

  const seconds = (n: number) => `${n.toFixed(2).replace('.', ',')} s`

  /** Probehören: Referenz C und ein Zielton im eingestellten Tempo */
  function tryTempo() {
    void audio.playSequence(['C4', 'E4'], taskTiming(settings.tempo))
  }

  let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null)
  /** Offene Rückfrage: Import (mit den geprüften Daten) oder Zurücksetzen */
  let pending = $state<{ kind: 'import'; data: AppData; info: string } | { kind: 'reset' } | null>(null)
  let fileInput: HTMLInputElement

  async function doExport() {
    message = null
    const r = await exportProgress()
    if (r.ok) message = { kind: 'ok', text: `Exportiert: ${r.fileName}` }
    else if (!r.cancelled) message = { kind: 'error', text: 'Export nicht möglich.' }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // dieselbe Datei später erneut wählen können
    if (!file) return
    message = null
    const result = parseImport(await file.text())
    if (!result.ok) {
      message = { kind: 'error', text: result.error }
      return
    }
    const s = buildStats(result.data.progress)
    pending = {
      kind: 'import',
      data: result.data,
      info: `${file.name}: ${s.totalAttempts} Versuche, ${result.data.progress.rounds.length} Runden, ${result.data.progress.done.length} Stufen geschafft.`,
    }
  }

  async function confirm() {
    if (!pending) return
    const action = pending
    pending = null
    applyData(action.kind === 'import' ? action.data : emptyData())
    markExported(backup) // frisch importiert oder zurückgesetzt: nichts zu sichern
    const saved = await persistNow()
    const done = action.kind === 'import' ? 'Import abgeschlossen.' : 'Alle Daten wurden zurückgesetzt.'
    message = { kind: saved || !storageState.writable ? 'ok' : 'error', text: saved ? done : `${done} Speichern auf diesem Gerät ist nicht möglich.` }
  }
</script>

<main class="page settings">
  <header class="page-head">
    <button class="back" aria-label="Zurück" onclick={onback}>←</button>
    <h1>Einstellungen</h1>
  </header>

  <h2 class="section">Neutralisierung</h2>
  <div class="card">
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
        {#each [['short', 'Kurz'], ['long', 'Lang']] as [id, label] (id)}
          <button
            class="chip"
            class:selected={settings.neutralLength === id}
            role="radio"
            aria-checked={settings.neutralLength === id}
            disabled={!settings.neutralize}
            onclick={() => {
              settings.neutralLength = id as 'short' | 'long'
              persistSoon()
            }}>{label}</button
          >
        {/each}
      </div>
    </div>
  </div>

  <h2 class="section">Tempo</h2>
  <div class="card">
    <div class="row">
      <div class="text">
        <span class="name">Tempo</span>
        <span class="desc">Abstand zwischen den Tönen: {seconds(settings.tempo)}</span>
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
      aria-label="Tempo: Abstand zwischen den Tönen"
    />
    <div class="ends"><span>schneller</span><span>langsamer</span></div>
  </div>

  <h2 class="section">Daten</h2>
  {#if !storageState.writable}
    <p class="warn">Speichern ist auf diesem Gerät gerade nicht möglich. Der Fortschritt gilt nur, bis die App geschlossen wird.</p>
  {/if}
  <div class="data">
    <button onclick={doExport}>Exportieren (JSON)</button>
    <button onclick={() => fileInput.click()}>Importieren</button>
    <button class="danger" onclick={() => (pending = { kind: 'reset' })}>Zurücksetzen</button>
  </div>
  <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />

  {#if pending}
    <div class="confirm" role="alertdialog" aria-label="Rückfrage">
      {#if pending.kind === 'import'}
        <p><b>Import:</b> {pending.info}<br />Der aktuelle Stand wird ersetzt.</p>
        <div class="buttons">
          <button class="danger" onclick={confirm}>Ja, ersetzen</button>
          <button onclick={() => (pending = null)}>Abbrechen</button>
        </div>
      {:else}
        <p><b>Alles zurücksetzen?</b><br />Fortschritt, Freischaltungen und Einstellungen werden gelöscht. Das lässt sich nur mit einer Exportdatei rückgängig machen.</p>
        <div class="buttons">
          <button class="danger" onclick={confirm}>Ja, alles löschen</button>
          <button onclick={() => (pending = null)}>Abbrechen</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if message}
    <p class="msg" class:error={message.kind === 'error'} role="status">{message.text}</p>
  {/if}

  <h2 class="section">Technik</h2>
  <button class="link-row" onclick={ontest}>
    <span class="name">Ton-Prüfung</span>
    <span class="desc">Alle Töne einzeln anhören und den Audio-Zustand ansehen</span>
  </button>
</main>

<style>
  .card {
    background: var(--surface);
    border-radius: 14px;
    padding: 6px 16px;
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
  }
  .row.dim {
    opacity: 0.45;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-weight: 600;
  }
  .desc {
    font-size: 0.85rem;
    color: var(--muted);
    line-height: 1.35;
  }
  .chips.small {
    flex: none;
  }
  .chips.small .chip {
    min-height: 44px;
    padding: 8px 16px;
    font-size: 0.95rem;
  }
  .try {
    flex: none;
    min-height: 44px;
    background: var(--surface-2);
    border: 0;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 0.9rem;
  }
  .try:active {
    background: var(--accent);
  }
  input[type='range'] {
    width: 100%;
    margin: 4px 0 2px;
    accent-color: var(--accent);
    height: 44px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    padding-bottom: 10px;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .link-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    min-height: 56px;
    background: var(--surface);
    border: 0;
    border-radius: 14px;
    padding: 12px 16px;
  }
  .link-row:active {
    background: var(--surface-2);
  }
  .data {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .data button,
  .buttons button {
    min-height: 48px;
    background: var(--surface-2);
    border: 0;
    border-radius: 12px;
    padding: 14px;
    font-size: 1rem;
  }
  .danger {
    background: #4a2020 !important;
    color: #ffd7d7;
  }
  .confirm {
    background: var(--surface);
    border-radius: 14px;
    padding: 14px 16px;
    line-height: 1.45;
  }
  .confirm p {
    margin: 0 0 12px;
  }
  .buttons {
    display: flex;
    gap: 10px;
  }
  .buttons button {
    flex: 1;
  }
  .warn {
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: #3b3015;
    color: #ffe9a8;
    font-size: 0.9rem;
  }
  .msg {
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: #12372a;
    color: #c9f5de;
  }
  .msg.error {
    background: #4a2020;
    color: #ffd7d7;
  }
</style>
