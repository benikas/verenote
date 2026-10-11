<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { audio } from '../audio/engine'
  import type { AnswerResult, Session } from '../exercise/session'
  import { getLevel, type Task } from '../theory/tasks'
  import Keyboard from './Keyboard.svelte'

  let {
    session,
    onfinish,
    onexit,
  }: { session: Session; onfinish: () => void; onexit: () => void } = $props()

  /** Tempo der Wiedergabe: Länge der Töne und Abstand zwischen den Tonanfängen (Sekunden) */
  const TIMING = { noteDuration: 1.1, interval: 1.25 }
  /** Pause, bis nach einer falschen Antwort die Lösung erklingt (ms) */
  const SOLUTION_DELAY = 900

  type Phase = 'listening' | 'answering' | 'feedback'

  const level = $derived(getLevel(session.level))
  let phase = $state<Phase>('listening')
  let task = $state<Task | null>(null)
  let result = $state<AnswerResult | null>(null)
  let marks = $state<Record<string, 'correct' | 'wrong'>>({})
  let answered = $state(0)
  let correct = $state(0)
  let solutionTimer: ReturnType<typeof setTimeout> | undefined

  const isLast = $derived(answered >= session.length)

  onMount(begin)
  onDestroy(() => {
    clearTimeout(solutionTimer)
    audio.stop()
  })

  function begin() {
    clearTimeout(solutionTimer)
    task = session.next()
    result = null
    marks = {}
    phase = 'listening'
    void playTask()
  }

  /** Referenzton, dann Zielton. Nach dem Zielton darf geantwortet werden. */
  async function playTask() {
    if (!task) return
    await audio.playSequence([task.reference, task.target], {
      ...TIMING,
      onNote: (i) => {
        if (i === 1 && phase === 'listening') phase = 'answering'
      },
    })
  }

  function playReference() {
    if (!task) return
    clearTimeout(solutionTimer)
    audio.stop()
    audio.play(task.reference, 1.6)
  }

  function replay() {
    clearTimeout(solutionTimer)
    void playTask()
  }

  function answer(note: string) {
    if (!task || phase !== 'answering') return
    audio.stop()
    audio.play(`${note}4`, 1.4) // die Klaviatur zeigt Oktave 4
    const r = session.answer(note)
    result = r
    answered = session.answered
    if (r.correct) correct += 1
    marks = r.correct ? { [r.expected]: 'correct' } : { [r.given]: 'wrong', [r.expected]: 'correct' }
    phase = 'feedback'
    // Falsch: Lösung vorspielen, im Kontext des Referenztons
    if (!r.correct) solutionTimer = setTimeout(() => void playTask(), SOLUTION_DELAY)
  }

  /** Dein Ton und die Lösung direkt nacheinander, nach dem Referenzton */
  function compare() {
    if (!task || !result || result.correct) return
    clearTimeout(solutionTimer)
    void audio.playSequence([task.reference, `${result.given}4`, task.target], TIMING)
  }

  function next() {
    if (isLast) {
      audio.stop()
      onfinish()
    } else begin()
  }
</script>

<main class="ex">
  <header>
    <button class="close" aria-label="Runde beenden" onclick={onexit}>✕</button>
    <div class="count">
      <span>Aufgabe {Math.min(answered + (phase === 'feedback' ? 0 : 1), session.length)} von {session.length}</span>
      <div class="bar"><div class="fill" style:width="{(answered / session.length) * 100}%"></div></div>
    </div>
    <span class="score" aria-label="Richtige Antworten">{correct} ✓</span>
  </header>

  <section class="stage">
    <p class="prompt" aria-live="polite">
      <span>
        {#if phase === 'listening'}
          Hör zu …
        {:else if phase === 'answering'}
          Welcher Ton war das?
        {:else if result?.correct}
          <span class="good">Richtig: {result.expected}</span>
        {:else if result}
          <span class="bad">Falsch.</span> Das war <b>{result.expected}</b>, du hast {result.given} gewählt.
        {/if}
      </span>
    </p>

    <div class="actions">
      <button onclick={replay}>▶ Nochmal</button>
      <button onclick={playReference}>Referenz {task ? task.reference.slice(0, -1) : 'C'}</button>
      {#if phase === 'feedback' && result && !result.correct}
        <button onclick={compare}>Vergleich</button>
      {/if}
    </div>

    <!-- Platz immer reservieren, damit beim Feedback nichts springt -->
    <button
      class="next"
      class:hidden={phase !== 'feedback'}
      disabled={phase !== 'feedback'}
      aria-hidden={phase !== 'feedback'}
      tabindex={phase === 'feedback' ? 0 : -1}
      onclick={next}>{isLast ? 'Ergebnis ansehen' : 'Weiter'}</button
    >
  </section>

  <div class="keys">
    <Keyboard enabled={level.notes} {marks} locked={phase !== 'answering'} onpress={answer} />
  </div>
</main>

<style>
  .ex {
    flex: 1;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 16px;
    gap: 12px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .close {
    background: var(--surface);
    border: 0;
    border-radius: 12px;
    width: 44px;
    height: 44px;
    font-size: 1rem;
    color: var(--muted);
  }
  .count {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--muted);
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
    transition: width 0.2s;
  }
  .score {
    min-width: 44px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--good);
  }
  .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 18px;
    padding: 8px 0;
  }
  .prompt {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.35;
    text-align: center;
    min-height: 3.6em;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .good {
    color: var(--good);
    font-weight: 600;
  }
  .bad {
    color: var(--bad);
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    align-content: flex-start;
    flex-wrap: wrap;
    /* zwei Zeilen reservieren: mit "Vergleich" bricht die Reihe um */
    min-height: 108px;
  }
  .actions button {
    background: var(--surface-2);
    border: 0;
    border-radius: 12px;
    padding: 12px 18px;
    font-size: 1rem;
  }
  .actions button:active {
    background: var(--accent);
  }
  .next {
    background: var(--accent);
    color: #fff;
    border: 0;
    border-radius: 16px;
    padding: 18px;
    font-size: 1.15rem;
    font-weight: 600;
  }
  .next.hidden {
    visibility: hidden;
  }
  .keys {
    height: clamp(210px, 34dvh, 300px);
  }
</style>
