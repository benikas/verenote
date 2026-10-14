<script lang="ts">
  import { onMount } from 'svelte'
  import { audio, type LoadState } from './audio/engine'
  import { Session, type SessionSummary } from './exercise/session'
  import { recordRound } from './progress/progress'
  import { updateDone } from './progress/marks'
  import { noteRound } from './storage/backup'
  import { freePractice } from './theory/practice'
  import { nextLevel, type LevelId } from './theory/tasks'
  import AudioTest from './ui/AudioTest.svelte'
  import { backup, initData, persistNow, persistSoon, progress, settings } from './ui/data.svelte'
  import Exercise from './ui/Exercise.svelte'
  import FreeTraining from './ui/FreeTraining.svelte'
  import Home from './ui/Home.svelte'
  import Path from './ui/Path.svelte'
  import Settings from './ui/Settings.svelte'
  import StartScreen from './ui/StartScreen.svelte'
  import Stats from './ui/Stats.svelte'
  import Summary from './ui/Summary.svelte'

  type Screen = 'start' | 'home' | 'path' | 'free' | 'exercise' | 'summary' | 'test' | 'stats' | 'settings'

  let screen = $state<Screen>('start')
  let load = $state<LoadState>(audio.loadState)
  let session = $state.raw<Session | null>(null)
  let summary = $state.raw<SessionSummary | null>(null)
  /** Audio läuft nicht (mehr), z. B. nach App-Wechsel: ein Tippen setzt es fort (B2) */
  let needsTap = $state(false)
  /** Letzte gestartete Runde (für „Nochmal“): eine Stufe oder das Freie Training */
  let lastRun: { level: LevelId } | { free: true } = { level: '1a' }
  /** Stufen, die mit der letzten Runde „geschafft“ wurden */
  let achieved = $state.raw<LevelId[]>([])
  const dataReady = initData()

  onMount(() => {
    const offLoad = audio.onLoadState((s) => (load = s))
    void dataReady.then(() => (saveEnabled = true))
    const offStatus = audio.onStatus((n) => (needsTap = n))
    // Laden schon vor dem ersten Tap beginnen: Der Synth springt bis dahin ein
    void audio.loadSamples()
    return () => {
      offLoad()
      offStatus()
    }
  })

  // Einstellungen speichern, sobald sie sich ändern (nach dem Laden)
  let saveEnabled = false
  $effect(() => {
    void JSON.stringify($state.snapshot(settings))
    if (saveEnabled) persistSoon()
  })

  async function start() {
    await audio.unlock() // Tap entsperrt Audio (Browser-Regel)
    audio.play('C4') // hörbare Bestätigung
    await dataReady
    screen = 'home'
  }

  const history = (key: string) => progress.items[key]

  function startRound(level: LevelId, length: number) {
    lastRun = { level }
    settings.level = level
    settings.length = length
    session = new Session({ level, length, history })
    summary = null
    achieved = []
    screen = 'exercise'
  }

  /** Freies Training: Übung aus den gespeicherten Einstellungen, zählt nicht für die Stufenmarkierungen */
  function startFree(length: number) {
    lastRun = { free: true }
    settings.length = length
    session = new Session({ level: null, practice: freePractice($state.snapshot(settings.free)), length, history })
    summary = null
    achieved = []
    screen = 'exercise'
  }

  function again() {
    if ('free' in lastRun) startFree(settings.length)
    else startRound(lastRun.level, settings.length)
  }

  function finish() {
    summary = session?.summary() ?? null
    if (summary) {
      const roundLevel = summary.level ?? (summary.practice.type === 'notes' ? 'free-notes' : 'free-intervals')
      recordRound(progress, roundLevel, summary.total, summary.correct)
      noteRound(backup)
      achieved = updateDone(progress, settings.doneThreshold)
      void persistNow()
    }
    screen = 'summary'
  }

  /** Zurück dorthin, wo die Runde gestartet wurde: Lernpfad oder Freies Training */
  function backToChooser() {
    screen = 'free' in lastRun ? 'free' : 'path'
  }

  function exit() {
    audio.stop()
    backToChooser()
  }
</script>

{#if screen === 'start'}
  <StartScreen {load} onstart={start} />
{:else if screen === 'home'}
  <Home
    onpath={() => (screen = 'path')}
    onfree={() => (screen = 'free')}
    onstats={() => (screen = 'stats')}
    onsettings={() => (screen = 'settings')}
  />
{:else if screen === 'path'}
  <Path onback={() => (screen = 'home')} onstart={startRound} />
{:else if screen === 'settings'}
  <Settings onback={() => (screen = 'home')} ontest={() => (screen = 'test')} />
{:else if screen === 'free'}
  <FreeTraining onback={() => (screen = 'home')} onstart={startFree} />
{:else if screen === 'exercise' && session}
  <Exercise {session} onfinish={finish} onexit={exit} />
{:else if screen === 'summary' && summary}
  <Summary
    {summary}
    {achieved}
    nextLevel={summary.level ? nextLevel(summary.level) : null}
    onagain={again}
    onnext={(id) => startRound(id, settings.length)}
    onhome={backToChooser}
  />
{:else if screen === 'stats'}
  <Stats onback={() => (screen = 'home')} />
{:else if screen === 'test'}
  <AudioTest {load} onback={() => (screen = 'settings')} />
{/if}

{#if needsTap && screen === 'exercise'}
  <button class="resume" onclick={() => void audio.resume(true)}>
    <span class="big">Tippen zum Fortsetzen</span>
    <span class="small">Der Ton wurde beim App-Wechsel angehalten.</span>
  </button>
{/if}

<style>
  .resume {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 0;
    background: var(--overlay);
    color: var(--text);
    /* erscheint leicht verzögert, damit ein sofortiges automatisches Fortsetzen nicht aufblitzt */
    opacity: 0;
    animation: fade-in 0.2s 0.35s forwards;
  }
  .big {
    font-size: 1.4rem;
    font-weight: 600;
  }
  .small {
    color: var(--muted);
  }
  @keyframes fade-in {
    to {
      opacity: 1;
    }
  }
</style>
