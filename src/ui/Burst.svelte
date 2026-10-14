<script lang="ts">
  import { burstParticles, BURST_SPEC, type BurstSize } from './reward'

  /**
   * Kleine Belohnungs-Animation aus Punkten und Sternen. Ändert das Layout nicht
   * (liegt frei über der Seite, ohne Berührung) und läuft einmal.
   */
  let { size, x = '50%', y = '40%' }: { size: BurstSize; x?: string; y?: string } = $props()

  const particles = $derived(burstParticles(size))
  const ms = $derived(BURST_SPEC[size].ms)
</script>

<div class="burst" aria-hidden="true" style:left={x} style:top={y} style:--ms="{ms}ms">
  {#each particles as p, i (i)}
    <span
      class="p"
      class:star={p.star}
      style:--dx="{p.dx}px"
      style:--dy="{p.dy}px"
      style:--rot="{p.rot}deg"
      style:--delay="{p.delay}ms"
      style:--s="{p.size}px"
      style:--c="var(--burst-{p.color + 1})"
    >{p.star ? '★' : ''}</span>
  {/each}
</div>

<style>
  .burst {
    position: fixed;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 5;
  }
  .p {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--s);
    height: var(--s);
    margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
    border-radius: 50%;
    background: var(--c);
    color: var(--c);
    font-size: calc(var(--s) * 1.6);
    line-height: var(--s);
    text-align: center;
    opacity: 0;
    animation: fly var(--ms) cubic-bezier(0.15, 0.7, 0.3, 1) var(--delay) forwards;
  }
  .p.star {
    background: none;
    border-radius: 0;
  }
  @keyframes fly {
    0% {
      opacity: 0;
      transform: translate(0, 0) scale(0.3) rotate(0deg);
    }
    15% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .burst {
      display: none;
    }
  }
</style>
