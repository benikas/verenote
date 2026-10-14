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
  import { intervalName } from '../theory/intervals'
  import { taskKey, type ExerciseTask } from '../theory/practice'
  import { octaveOffset } from '../theory/tasks'
  import { Note } from 'tonal'
  import { persistNow, progress, settings } from './data.svelte'
  import IntervalButtons from './IntervalButtons.svelte'
  import Keyboard from './Keyboard.svelte'
  import Burst from './Burst.svelte'
  import Intro from './Intro.svelte'
  import { prefersReducedMotion, rewardEnabled } from './reward'

  let {
    session,
    onfinish,
    onexit,
  }: { session: Session; onfinish: () => void; onexit: () => void } = $props()

  /** Pause, bis nach einer falschen Antwort die Lösung erklingt (ms) */
  const SOLUTION_DELAY = 900

  type Phase = 'neutralizing' | 'listening' | 'answering' | 'feedback'

  const practice = $derived(session.practice)
  let phase = $state<Phase>('listening')
  let task = $state<ExerciseTask | null>(null)
  let result = $state<AnswerResult | null>(null)
  let marks = $state<Record<string, 'correct' | 'wrong'>>({})
  let answered = $state(0)
  let correct = $state(0)
  /** Nach einer richtigen Antwort geht es automatisch weiter, außer man hört noch einmal nach */
  let manualNext = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let introToken = 0
  /** Zählt die kleinen Belohnungs-Animationen (neuer Wert = neue Animation) */
  let burst = $state(0)

  const timing = $derived(taskTiming(settings.tempo))
  const isLast = $derived(answered >= session.length)
  const wrong = $derived(phase === 'feedback' && result !== null && !result.correct)
  const showNext = $derived(wrong || (phase === 'feedback' && manualNext))
  /** Oktave des Zieltons: Die Klaviatur zeigt immer diese Lage (Stufe 1d: 3, 4 oder 5) */
  const targetOctave = $derived(
    task?.kind === 'notes' ? Number(task.target.slice(pitchClass(task.target).length)) : 4,
  )
  /** Lageanzeige (nur Grundtöne mit Referenz und mehreren Oktaven, z. B. Stufe 1d) */
  const multiOctave = $derived(practice.type === 'notes' && practice.reference && practice.octaves.length > 1)
  /** Name des Starttons bzw. Referenztons, für den Button */
  const refButton = $derived.by(() => {
    if (!task) return null
    if (task.kind === 'intervals') return { label: 'Startton', note: task.start }
    return task.reference ? { label: `Referenz ${task.reference.slice(0, -1)}`, note: task.reference } : null
  })
  const lage = $derived.by(() => {
    if (!task || task.kind !== 'notes') return ''
    const o = octaveOffset(task)
    return o < 0 ? 'eine Oktave tiefer als der Referenzton' : o > 0 ? 'eine Oktave höher als der Referenzton' : 'in der Oktave des Referenztons'
  })

  /** Antwort als lesbarer Name: Ton ("C#/Db") oder Intervall ("Grosse Terz") */
  const answerName = (a: string) => (task?.kind === 'intervals' ? intervalName(Number(a)) : displayName(a))

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

  /** „?“: Einführung der Stufe über der Übung. Die Runde pausiert und zählt keinen Versuch. */
  let helpOpen = $state(false)

  function openHelp() {
    if (!session.level || helpOpen) return
    audio.stop()
    handleInterrupt() // merkt sich, was nachzuholen ist
    helpOpen = true
  }

  function closeHelp() {
    audio.stop()
    helpOpen = false
    handleResume()
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
      const avoid = task.kind === 'intervals' ? task.start : (task.reference ?? task.target)
      const notes = makeNeutralization(settings.neutralLength, Math.random, avoid)
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

  /**
   * Aufgabe abspielen: Grundton = Referenz, dann Zielton (ohne Referenz nur der Zielton);
   * Intervall = Startton, dann zweiter Ton, oder beide gleichzeitig. Danach darf geantwortet werden.
   */
  async function playTask() {
    if (!task) return
    const myIntro = introToken
    let ok: boolean
    if (task.kind === 'intervals' && task.mode === 'harmonic') {
      const p = audio.playChord([task.start, task.second])
      if (phase === 'listening') phase = 'answering' // gleich nach dem Anschlag antwortbar
      ok = await p
    } else {
      const notes = task.kind === 'intervals' ? [task.start, task.second] : task.reference ? [task.reference, task.target] : [task.target]
      const last = notes.length - 1
      ok = await audio.playSequence(notes, {
        ...timing,
        onNote: (i) => {
          if (i === last && phase === 'listening') phase = 'answering'
        },
      })
    }
    // Audio war weg, ohne dass die Engine es gemeldet hat (Unterbrechung schon vermerkt)
    if (!ok && myIntro === introToken && audio.needsTap) handleInterrupt()
  }

  /** Wer nach einer richtigen Antwort noch einmal hört, bestimmt selbst, wann es weitergeht. */
  function takeOver() {
    clearTimeout(timer)
    if (phase === 'feedback') manualNext = true
  }

  function playReference() {
    if (!task || !refButton) return
    takeOver()
    audio.stop()
    audio.play(refButton.note, 1.6)
  }

  function replay() {
    takeOver()
    void playTask()
  }

  /** Antwort: Grundton als Pitch Class ("E"), Intervall als Halbtonzahl */
  function answer(given: string | number) {
    if (!task || phase !== 'answering') return
    audio.stop()
    if (task.kind === 'notes') audio.play(withOctave(String(given), targetOctave), 1.4) // die Klaviatur zeigt die Lage des Zieltons
    const r = session.answer(given)
    recordAttempt(progress, session.level, taskKey(r.task), r.correct)
    void persistNow() // nach jeder Antwort sichern
    result = r
    answered = session.answered
    if (r.correct) {
      correct += 1
      if (rewardEnabled(settings.animations, prefersReducedMotion())) burst += 1
    }
    marks = r.correct ? { [r.expected]: 'correct' } : { [r.given]: 'wrong', [r.expected]: 'correct' }
    phase = 'feedback'
    // Falsch: Lösung vorspielen, im Kontext des Referenztons (ohne Neutralisierung).
    // Richtig: nach kurzer Pause automatisch weiter.
    timer = setTimeout(() => (r.correct ? next() : void playTask()), r.correct ? AUTO_ADVANCE_MS : SOLUTION_DELAY)
  }

  /** Deine Antwort und die Lösung direkt nacheinander, nach Referenz- bzw. Startton */
  async function compare() {
    if (!task || !result || result.correct) return
    clearTimeout(timer)
    if (task.kind === 'notes') {
      const mine = withOctave(result.given, targetOctave)
      const seq = task.reference ? [task.reference, mine, task.target] : [mine, task.target]
      void audio.playSequence(seq, timing)
      return
    }
    // Intervall: erst dein Intervall, dann das richtige, jeweils vom selben Startton
    const startMidi = Note.midi(task.start) as number
    const sign = task.direction === 'down' ? -1 : 1
    const mine = Note.fromMidiSharps(startMidi + sign * Number(result.given))
    if (task.mode === 'harmonic') {
      if (await audio.playChord([task.start, mine], { duration: 1.3 })) await audio.playChord([task.start, task.second], { duration: 1.3 })
    } else {
      void audio.playSequence([task.start, mine, task.start, task.second], timing)
    }
  }

  function next() {
    clearTimeout(timer)
    if (isLast) {
      audio.stop()
      onfinish()
    } else begin()
  }
</script>

<main class="ex" data-phase={phase} data-area={session.practice.type}
  data-task={task?.kind === 'notes' ? task.target : task ? String(task.semitones) : undefined}
  data-second={task?.kind === 'intervals' ? task.second : undefined}
  data-start={task?.kind === 'intervals' ? task.start : undefined}
  data-mode={task?.kind === 'intervals' ? task.mode : undefined}
>
  <header>
    <button class="close" aria-label="Runde beenden" onclick={onexit}>✕</button>
    <div class="count">
      <span>Aufgabe {Math.min(answered + (phase === 'feedback' ? 0 : 1), session.length)} von {session.length}</span>
      <div class="bar"><div class="fill" style:width="{(answered / session.length) * 100}%"></div></div>
    </div>
    {#if session.level}
      <button class="help" aria-label="Einführung zu dieser Stufe" onclick={openHelp}>?</button>
    {/if}
    <span class="score" aria-label="Richtige Antworten">{correct} ✓</span>
  </header>

  {#key burst}
    {#if burst > 0}<Burst size="small" y="30%" />{/if}
  {/key}

  <section class="stage">
    <p class="prompt" aria-live="polite">
      <span>
        {#if phase === 'neutralizing'}
          <span class="muted">Ohr wird neutralisiert …</span>
        {:else if phase === 'listening'}
          Hör zu …
        {:else if phase === 'answering'}
          {task?.kind === 'intervals' ? 'Welches Intervall war das?' : 'Welcher Ton war das?'}
        {:else if result?.correct}
          <span class="good">Richtig: {answerName(result.expected)}</span>
        {:else if result}
          <span class="bad">Falsch.</span> Das war <b>{answerName(result.expected)}</b>, du hast {answerName(result.given)} gewählt.
        {/if}
      </span>
    </p>

    {#if multiOctave}
      <p class="lage" class:hidden={phase === 'neutralizing' || phase === 'listening'}>Zielton: {lage}</p>
    {/if}

    <div class="actions">
      <button onclick={replay} disabled={phase === 'neutralizing'}>▶ Nochmal</button>
      {#if refButton}
        <button onclick={playReference} disabled={phase === 'neutralizing'}>{refButton.label}</button>
      {/if}
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

  {#if practice.type === 'notes'}
    <div class="keys">
      <Keyboard enabled={practice.notes} {marks} locked={phase !== 'answering'} onpress={answer} />
    </div>
  {:else}
    <div class="answers">
      <IntervalButtons enabled={practice.intervals} {marks} locked={phase !== 'answering'} onpress={answer} />
    </div>
  {/if}
</main>

{#if helpOpen && session.level}
  <Intro level={session.level} onclose={closeHelp} overlay />
{/if}

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
    box-shadow: var(--shadow);
    border: 0;
    border-radius: 12px;
    width: 44px;
    height: 44px;
    font-size: 1rem;
    color: var(--muted);
  }
  .help {
    flex: none;
    background: var(--surface);
    box-shadow: var(--shadow);
    border: 0;
    border-radius: 12px;
    width: 44px;
    height: 44px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--accent);
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
    gap: 12px;
    padding: 4px 0;
  }
  .prompt {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.35;
    text-align: center;
    min-height: 3.2em;
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
    gap: 8px;
    /* eine Zeile reservieren, genug Platz auch auf kleinen Handys */
    min-height: 52px;
  }
  .actions button {
    min-height: 48px;
    background: var(--surface-2);
    border: 0;
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 1rem;
  }
  .actions button:active {
    background: var(--accent-soft);
  }
  .actions button:disabled {
    opacity: 0.4;
  }
  .next {
    min-height: 56px;
    background: var(--accent);
    color: var(--accent-ink);
    border: 0;
    border-radius: 16px;
    padding: 14px;
    font-size: 1.15rem;
    font-weight: 600;
  }
  .next.hidden {
    visibility: hidden;
  }
  .keys {
    height: clamp(210px, 34dvh, 300px);
  }
  .answers {
    padding-bottom: 4px;
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

  /* Kleine Handys (z. B. 320 × 568): enger setzen, damit nichts scrollen muss */
  @media (max-height: 640px) {
    .ex {
      gap: 8px;
      padding: 8px 12px 10px;
    }
    .stage {
      gap: 8px;
    }
    .prompt {
      font-size: 1.1rem;
      min-height: 2.8em;
    }
    .actions {
      gap: 6px;
      min-height: 48px;
    }
    .actions button {
      padding: 8px 10px;
      font-size: 0.9rem;
    }
    .next {
      min-height: 48px;
      padding: 8px;
    }
    .keys {
      height: clamp(170px, 34dvh, 300px);
    }
  }
</style>
