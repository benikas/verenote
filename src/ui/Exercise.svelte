<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { audio } from '../audio/engine'
  import type { AnswerResult, Session } from '../exercise/session'
  import {
    AUTO_ADVANCE_MS,
    NEUTRAL_PLAYBACK,
    shouldNeutralize,
    taskTiming,
  } from '../exercise/settings'
  import { recordAttempt } from '../progress/progress'
  import { displayName, pitchClass, withOctave } from '../theory/notes'
  import { makeNeutralization } from '../theory/neutral'
  import { getLevel, itemKey, octaveOffset, type Task } from '../theory/tasks'
  import { persistNow, progress, settings } from './data.svelte'
  import Keyboard from './Keyboard.svelte'

  let {
    session,
    onfinish,
    onexit,
  }: { session: Session; onfinish: () => void; onexit: () => void } = $props()

  /** Pause, bis nach einer falschen Antwort die Lösung erklingt (ms) */
  const SOLUTION_DELAY = 900

  type Phase = 'neutralizing' | 'listening' | 'answering' | 'feedback'

  const level = $derived(getLevel(session.level))
  let phase = $state<Phase>('listening')
  let task = $state<Task | null>(null)
  let result = $state<AnswerResult | null>(null)
  let marks = $state<Record<string, 'correct' | 'wrong'>>({})
  let answered = $state(0)
  let correct = $state(0)
  /** Nach einer richtigen Antwort geht es automatisch weiter, außer man hört noch einmal nach */
  let manualNext = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let introToken = 0

  const timing = $derived(taskTiming(settings.tempo))
  const isLast = $derived(answered >= session.length)
  const wrong = $derived(phase === 'feedback' && result !== null && !result.correct)
  const showNext = $derived(wrong || (phase === 'feedback' && manualNext))
  /** Oktave des Zieltons: Die Klaviatur zeigt immer diese Lage (Stufe 1d: 3, 4 oder 5) */
  const targetOctave = $derived(task ? Number(task.target.slice(pitchClass(task.target).length)) : 4)
  const multiOctave = $derived(level.octaves.length > 1)
  const lage = $derived.by(() => {
    if (!task) return ''
    const o = octaveOffset(task)
    return o < 0 ? 'eine Oktave tiefer als der Referenzton' : o > 0 ? 'eine Oktave höher als der Referenzton' : 'in der Oktave des Referenztons'
  })

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  /**
   * App-Wechsel/Bildschirmsperre (B2): Die Wiedergabe bricht ab. Was danach nachzuholen ist,
   * merkt sich `pending`. Sobald Audio wieder läuft, geht es dort weiter.
   */
  type Pending = 'prelude' | 'task' | 'solution' | 'next' | null
  let pending: Pending = null

  function handleInterrupt() {
    introToken += 1 // laufende begin()-Kette beenden
    clearTimeout(timer)
    if (phase === 'neutralizing') pending = 'prelude'
    else if (phase === 'listening' || phase === 'answering') pending = 'task'
    else if (result?.correct) pending = manualNext ? null : 'next'
    else pending = 'solution'
  }

  function handleResume() {
    const p = pending
    pending = null
    if (p === 'prelude') void prelude(++introToken)
    else if (p === 'task') {
      phase = 'listening'
      void playTask()
    } else if (p === 'solution') void playTask()
    else if (p === 'next') next()
  }

  onMount(() => {
    const offs = [audio.onInterrupted(handleInterrupt), audio.onResumed(handleResume)]
    void begin()
    return () => offs.forEach((off) => off())
  })
  onDestroy(() => {
    introToken += 1
    clearTimeout(timer)
    audio.stop()
  })

  async function begin() {
    clearTimeout(timer)
    const token = ++introToken
    task = session.next()
    result = null
    marks = {}
    manualNext = false
    await prelude(token)
  }

  /** Neutralisierung (falls an), dann Aufgabe. Wird bei Unterbrechung von vorn gespielt. */
  async function prelude(token: number) {
    if (!task) return
    // Gehör neutralisieren: ab der zweiten Aufgabe, leiser, danach kurze Pause
    if (shouldNeutralize(settings, session.answered)) {
      phase = 'neutralizing'
      const notes = makeNeutralization(settings.neutralLength, Math.random, task.reference)
      const ok = await audio.playSequence(notes, {
        noteDuration: NEUTRAL_PLAYBACK.noteDuration,
        interval: NEUTRAL_PLAYBACK.interval,
        velocity: NEUTRAL_PLAYBACK.velocity,
      })
      if (token !== introToken) return
      if (!ok) return handleInterrupt() // Audio weg, ohne dass die Engine es gemeldet hat
      await sleep(NEUTRAL_PLAYBACK.pauseMs)
      if (token !== introToken) return
    }

    phase = 'listening'
    await playTask()
  }

  /** Referenzton, dann Zielton. Nach dem Zielton darf geantwortet werden. */
  async function playTask() {
    if (!task) return
    const myIntro = introToken
    const ok = await audio.playSequence([task.reference, task.target], {
      ...timing,
      onNote: (i) => {
        if (i === 1 && phase === 'listening') phase = 'answering'
      },
    })
    // Audio war weg, ohne dass die Engine es gemeldet hat (Unterbrechung schon vermerkt)
    if (!ok && myIntro === introToken && audio.needsTap) handleInterrupt()
  }

  /** Wer nach einer richtigen Antwort noch einmal hört, bestimmt selbst, wann es weitergeht. */
  function takeOver() {
    clearTimeout(timer)
    if (phase === 'feedback') manualNext = true
  }

  function playReference() {
    if (!task) return
    takeOver()
    audio.stop()
    audio.play(task.reference, 1.6)
  }

  function replay() {
    takeOver()
    void playTask()
  }

  function answer(note: string) {
    if (!task || phase !== 'answering') return
    audio.stop()
    audio.play(withOctave(note, targetOctave), 1.4) // die Klaviatur zeigt die Lage des Zieltons
    const r = session.answer(note)
    recordAttempt(progress, session.level, itemKey(r.task), r.correct)
    void persistNow() // nach jeder Antwort sichern
    result = r
    answered = session.answered
    if (r.correct) correct += 1
    marks = r.correct ? { [r.expected]: 'correct' } : { [r.given]: 'wrong', [r.expected]: 'correct' }
    phase = 'feedback'
    // Falsch: Lösung vorspielen, im Kontext des Referenztons (ohne Neutralisierung).
    // Richtig: nach kurzer Pause automatisch weiter.
    timer = setTimeout(() => (r.correct ? next() : void playTask()), r.correct ? AUTO_ADVANCE_MS : SOLUTION_DELAY)
  }

  /** Dein Ton und die Lösung direkt nacheinander, nach dem Referenzton */
  function compare() {
    if (!task || !result || result.correct) return
    clearTimeout(timer)
    void audio.playSequence([task.reference, withOctave(result.given, targetOctave), task.target], timing)
  }

  function next() {
    clearTimeout(timer)
    if (isLast) {
      audio.stop()
      onfinish()
    } else begin()
  }
</script>

<main class="ex" data-phase={phase} data-task={task?.target}>
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
        {#if phase === 'neutralizing'}
          <span class="muted">Ohr wird neutralisiert …</span>
        {:else if phase === 'listening'}
          Hör zu …
        {:else if phase === 'answering'}
          Welcher Ton war das?
        {:else if result?.correct}
          <span class="good">Richtig: {displayName(result.expected)}</span>
        {:else if result}
          <span class="bad">Falsch.</span> Das war <b>{displayName(result.expected)}</b>, du hast {displayName(result.given)} gewählt.
        {/if}
      </span>
    </p>

    {#if multiOctave}
      <p class="lage" class:hidden={phase === 'neutralizing' || phase === 'listening'}>Zielton: {lage}</p>
    {/if}

    <div class="actions">
      <button onclick={replay} disabled={phase === 'neutralizing'}>▶ Nochmal</button>
      <button onclick={playReference} disabled={phase === 'neutralizing'}
        >Referenz {task ? task.reference.slice(0, -1) : 'C'}</button
      >
      {#if wrong}
        <button onclick={compare}>Vergleich</button>
      {/if}
    </div>

    <!-- Platz immer reservieren, damit beim Feedback nichts springt -->
    <button
      class="next"
      class:hidden={!showNext}
      disabled={!showNext}
      aria-hidden={!showNext}
      tabindex={showNext ? 0 : -1}
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
  .muted {
    color: var(--muted);
    font-size: 1.1rem;
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
  .actions button:disabled {
    opacity: 0.4;
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
  .lage {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
    text-align: center;
  }
  .lage.hidden {
    visibility: hidden;
  }
</style>
