<script lang="ts">
  import { onMount } from 'svelte'
  import { audio, type LoadState } from './audio/engine'
  import StartScreen from './ui/StartScreen.svelte'
  import AudioTest from './ui/AudioTest.svelte'

  let screen = $state<'start' | 'test'>('start')
  let load = $state<LoadState>(audio.loadState)

  onMount(() => {
    const off = audio.onLoadState((s) => (load = s))
    // Laden schon vor dem ersten Tap beginnen: Synth springt bis dahin ein
    void audio.loadSamples()
    return off
  })

  async function start() {
    await audio.unlock() // Tap entsperrt Audio (Browser-Regel)
    audio.play('C4') // hörbare Bestätigung: Ton erklingt nach dem ersten Tap
    screen = 'test'
  }
</script>

{#if screen === 'start'}
  <StartScreen {load} onstart={start} />
{:else}
  <AudioTest {load} />
{/if}
