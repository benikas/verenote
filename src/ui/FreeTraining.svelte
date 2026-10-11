<script lang="ts">
  import { INTERVALS } from '../theory/intervals'
  import { CHROMATIC_SHARPS, displayName } from '../theory/notes'
  import { freePractice, poolFor } from '../theory/practice'
  import { FREE_OCTAVES, ROUND_LENGTHS } from '../storage/schema'
  import { persistSoon, settings } from './data.svelte'

  let { onback, onstart }: { onback: () => void; onstart: (length: number) => void } = $props()

  const free = settings.free

  /** So viele Items hat die gewählte Übung. Weniger als zwei ergeben keine sinnvolle Runde. */
  const itemCount = $derived(poolFor(freePractice(free)).length)
  const canStart = $derived(itemCount >= 2)

  function save() {
    persistSoon()
  }

  /** Element in einer Liste ein- oder ausschalten, Reihenfolge der Vorlage bleibt */
  function toggle<T>(list: readonly T[], value: T, order: readonly T[]): T[] {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    return order.filter((v) => next.includes(v))
  }

  const ALL_INTERVALS = INTERVALS.map((i) => i.semitones)
  const STAMM = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const lines = (name: string) => name.split(' ')
</script>

<main class="free">
  <header>
    <button class="back" aria-label="Zurück" onclick={onback}>←</button>
    <h1>Freies Training</h1>
  </header>
  <p class="lead">Stell dir die Übung selbst zusammen. Die Einstellungen bleiben gespeichert. Die Ergebnisse zählen in die Statistik, ändern aber nicht die Stufen im Lernpfad.</p>

  <h2>Übung</h2>
  <div class="chips two" role="radiogroup" aria-label="Übungstyp">
    {#each [['notes', 'Grundtöne'], ['intervals', 'Intervalle']] as [id, label] (id)}
      <button
        class="chip"
        class:selected={free.type === id}
        role="radio"
        aria-checked={free.type === id}
        onclick={() => {
          free.type = id as 'notes' | 'intervals'
          save()
        }}>{label}</button
      >
    {/each}
  </div>

  {#if free.type === 'notes'}
    <h2>Töne</h2>
    <div class="chips grid4" role="group" aria-label="Töne">
      {#each CHROMATIC_SHARPS as n (n)}
        <button
          class="chip"
          class:selected={free.notes.includes(n)}
          aria-pressed={free.notes.includes(n)}
          onclick={() => {
            free.notes = toggle(free.notes, n, CHROMATIC_SHARPS)
            save()
          }}>{displayName(n)}</button
        >
      {/each}
    </div>
    <div class="quick">
      <button
        onclick={() => {
          free.notes = [...STAMM]
          save()
        }}>Stammtöne</button
      >
      <button
        onclick={() => {
          free.notes = [...CHROMATIC_SHARPS]
          save()
        }}>Alle 12</button
      >
    </div>

    <h2>Lage des Zieltons</h2>
    <div class="chips" role="group" aria-label="Oktaven">
      {#each FREE_OCTAVES as o (o)}
        <button
          class="chip"
          class:selected={free.octaves.includes(o)}
          aria-pressed={free.octaves.includes(o)}
          disabled={free.octaves.length === 1 && free.octaves.includes(o)}
          onclick={() => {
            free.octaves = toggle(free.octaves, o, FREE_OCTAVES)
            save()
          }}>Oktave {o}</button
        >
      {/each}
    </div>

    <div class="row">
      <div class="text">
        <span class="name">Mit Referenzton C</span>
        <span class="desc">Aus: Du hörst nur den Zielton und erkennst ihn ohne Vergleich (absolutes Hören, schwer)</span>
      </div>
      <button
        class="switch"
        class:on={free.reference}
        role="switch"
        aria-checked={free.reference}
        aria-label="Mit Referenzton C"
        onclick={() => {
          free.reference = !free.reference
          save()
        }}><span class="knob"></span></button
      >
    </div>
  {:else}
    <h2>Intervalle</h2>
    <div class="chips grid3" role="group" aria-label="Intervalle">
      {#each INTERVALS as i (i.semitones)}
        <button
          class="chip"
          class:selected={free.intervals.includes(i.semitones)}
          aria-pressed={free.intervals.includes(i.semitones)}
          aria-label={i.name}
          onclick={() => {
            free.intervals = toggle(free.intervals, i.semitones, ALL_INTERVALS)
            save()
          }}>{#each lines(i.name) as part, k (k)}<span>{part}</span>{/each}</button
        >
      {/each}
    </div>
    <div class="quick">
      <button
        onclick={() => {
          free.intervals = [...ALL_INTERVALS]
          save()
        }}>Alle 13</button
      >
      <button
        onclick={() => {
          free.intervals = []
          save()
        }}>Keines</button
      >
    </div>

    <h2>Richtung</h2>
    <div class="chips" role="radiogroup" aria-label="Richtung">
      {#each [['up', 'Aufwärts'], ['down', 'Abwärts'], ['both', 'Beides']] as [id, label] (id)}
        <button
          class="chip"
          class:selected={free.directions === id}
          role="radio"
          aria-checked={free.directions === id}
          onclick={() => {
            free.directions = id as 'up' | 'down' | 'both'
            save()
          }}>{label}</button
        >
      {/each}
    </div>

    <h2>Wiedergabe</h2>
    <div class="chips" role="radiogroup" aria-label="Wiedergabe">
      {#each [['melodic', 'Nacheinander'], ['harmonic', 'Gleichzeitig'], ['both', 'Beides']] as [id, label] (id)}
        <button
          class="chip"
          class:selected={free.modes === id}
          role="radio"
          aria-checked={free.modes === id}
          onclick={() => {
            free.modes = id as 'melodic' | 'harmonic' | 'both'
            save()
          }}>{label}</button
        >
      {/each}
    </div>

    <h2>Startton</h2>
    <div class="chips two" role="radiogroup" aria-label="Startton">
      {#each [['fixed', 'Fest (C4)'], ['random', 'Zufällig']] as [id, label] (id)}
        <button
          class="chip"
          class:selected={free.start === id}
          role="radio"
          aria-checked={free.start === id}
          onclick={() => {
            free.start = id as 'fixed' | 'random'
            save()
          }}>{label}</button
        >
      {/each}
    </div>
  {/if}

  <h2>Aufgaben pro Runde</h2>
  <div class="chips" role="radiogroup" aria-label="Aufgaben pro Runde">
    {#each ROUND_LENGTHS as n (n)}
      <button
        class="chip"
        class:selected={settings.length === n}
        role="radio"
        aria-checked={settings.length === n}
        onclick={() => {
          settings.length = n
          save()
        }}>{n}</button
      >
    {/each}
  </div>
  <p class="desc">Neutralisierung und Tempo gelten wie überall und stehen auf der Startseite.</p>

  {#if !canStart}
    <p class="warn" role="status">Wähle mindestens {free.type === 'notes' ? 'zwei Töne' : 'zwei Möglichkeiten (z. B. zwei Intervalle oder ein Intervall in beide Richtungen)'}.</p>
  {/if}
  <button class="go" disabled={!canStart} onclick={() => onstart(settings.length)}>Runde starten</button>
</main>

<style>
  .free {
    flex: 1;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 20px 20px 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    margin: 14px 0 0;
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
  .lead,
  .desc {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .chips {
    display: flex;
    gap: 8px;
  }
  .chips.grid4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }
  .chips.grid3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
  .chip {
    flex: 1;
    min-height: 48px;
    background: var(--surface);
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 8px 4px;
    font-size: 0.95rem;
    line-height: 1.15;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .chip.selected {
    border-color: var(--accent);
    background: #1d2742;
  }
  .chip:disabled {
    opacity: 0.6;
  }
  .quick {
    display: flex;
    gap: 8px;
  }
  .quick button {
    min-height: 44px;
    background: var(--surface-2);
    border: 0;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 0.9rem;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--surface);
    border-radius: 14px;
    padding: 12px 16px;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-weight: 600;
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
  .warn {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: #3b3015;
    color: #ffe9a8;
    font-size: 0.9rem;
  }
  .go {
    margin-top: 12px;
    background: var(--accent);
    color: #fff;
    border: 0;
    border-radius: 16px;
    padding: 20px;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .go:disabled {
    opacity: 0.4;
  }
</style>
