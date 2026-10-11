<script lang="ts">
  import { buildStats } from '../progress/stats'
  import { RECENT_ATTEMPTS, emptyData, type AppData } from '../storage/schema'
  import { markExported } from '../storage/backup'
  import { parseImport } from '../storage/transfer'
  import { displayName } from '../theory/notes'
  import { MARK_LABEL } from '../progress/marks'
  import { applyData, backup, persistNow, progress, storageState } from './data.svelte'
  import { exportProgress } from './exportFile'

  let { onback }: { onback: () => void } = $props()

  const stats = $derived(buildStats(progress, 10))
  const pct = (x: number) => `${Math.round(x * 100)} %`
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric' })

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
  <p class="foot">Alle Versuche seit Beginn, je Zielton.</p>

  <h2>Letzte Runden</h2>
  {#if stats.rounds.length === 0}
    <p class="foot">Noch keine abgeschlossene Runde.</p>
  {:else}
    <div class="rounds" role="img" aria-label="Trefferquote der letzten Runden">
      {#each stats.rounds as r, i (i)}
        <div class="col">
          <span class="pct">{Math.round(r.accuracy * 100)}</span>
          <span class="colbar"><span class="colfill" style:height="{r.accuracy * 100}%"></span></span>
          <span class="lv">{r.level}</span>
          <span class="dt">{dateOf(r.at)}</span>
        </div>
      {/each}
    </div>
  {/if}

  <h2>Daten</h2>
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
  .data {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .data button,
  .buttons button {
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
