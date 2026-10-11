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
  let config = { level: '1a' as LevelId, length: 15 }

  onMount(() => {
    const off = audio.onLoadState((s) => (load = s))
    // Laden schon vor dem ersten Tap beginnen: Der Synth springt bis dahin ein
    void audio.loadSamples()
    return off
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
