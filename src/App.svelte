<script lang="ts">
  import { onMount } from 'svelte'
  import { audio, type LoadState } from './audio/engine'
  import { Session, type SessionSummary } from './exercise/session'
  import type { LevelId } from './theory/tasks'
  import AudioTest from './ui/AudioTest.svelte'
  import Exercise from './ui/Exercise.svelte'
  import Home from './ui/Home.svelte'
  import StartScreen from './ui/StartScreen.svelte'
  import Summary from './ui/Summary.svelte'

  type Screen = 'start' | 'home' | 'exercise' | 'summary' | 'test'

  let screen = $state<Screen>('start')
  let load = $state<LoadState>(audio.loadState)
  let session = $state.raw<Session | null>(null)
  let summary = $state.raw<SessionSummary | null>(null)
  /** Audio läuft nicht (mehr), z. B. nach App-Wechsel: ein Tippen setzt es fort (B2) */
  let needsTap = $state(false)
  let config = { level: '1a' as LevelId, length: 15 }

  onMount(() => {
    const offLoad = audio.onLoadState((s) => (load = s))
    const offStatus = audio.onStatus((n) => (needsTap = n))
    // Laden schon vor dem ersten Tap beginnen: Der Synth springt bis dahin ein
    void audio.loadSamples()
    return () => {
      offLoad()
      offStatus()
    }
  })

  async function start() {
    await audio.unlock() // Tap entsperrt Audio (Browser-Regel)
    audio.play('C4') // hörbare Bestätigung
    screen = 'home'
  }

  function startRound(level: LevelId, length: number) {
    config = { level, length }
    session = new Session(config)
    summary = null
    screen = 'exercise'
  }

  function finish() {
    summary = session?.summary() ?? null
    screen = 'summary'
  }

  function exit() {
    audio.stop()
    screen = 'home'
  }
</script>

{#if screen === 'start'}
  <StartScreen {load} onstart={start} />
{:else if screen === 'home'}
  <Home onstart={startRound} ontest={() => (screen = 'test')} />
{:else if screen === 'exercise' && session}
  <Exercise {session} onfinish={finish} onexit={exit} />
{:else if screen === 'summary' && summary}
  <Summary {summary} onagain={() => startRound(config.level, config.length)} onhome={() => (screen = 'home')} />
{:else if screen === 'test'}
  <AudioTest {load} onback={() => (screen = 'home')} />
{/if}

{#if needsTap && screen === 'exercise'}
  <button class="resume" onclick={() => void audio.resume()}>
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
    background: rgba(8, 12, 22, 0.88);
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
