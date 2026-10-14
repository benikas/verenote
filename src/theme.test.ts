// @ts-ignore Node-Modul nur im Test, @types/node ist nicht installiert
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** 4.1: Alle Farben stehen in theme.css; Text auf Hintergrund mindestens 4,5 : 1 (WCAG AA). */

const css: string = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')

function block(selector: string): Record<string, string> {
  const i = css.indexOf(selector)
  const body = css.slice(i, css.indexOf('}', i))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+):\s*#([0-9a-fA-F]{3,6})\s*[;}]?/g)) {
    const h = m[2].length === 3 ? [...m[2]].map((c) => c + c).join('') : m[2]
    out[m[1]] = '#' + h
  }
  return out
}

const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}
function ratio(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const base = block(':root')
const areas: Record<string, Record<string, string>> = {
  notes: base,
  intervals: { ...base, ...block('[data-area=') },
}

// [Vordergrund, Hintergrund]
const PAIRS: [string, string][] = [
  ['--text', '--bg'],
  ['--text', '--surface'],
  ['--text', '--surface-2'],
  ['--muted', '--bg'],
  ['--muted', '--surface'],
  ['--muted', '--surface-2'],
  ['--accent-ink', '--accent'],
  ['--accent-soft-ink', '--accent-soft'],
  ['--accent', '--bg'],
  ['--accent', '--surface'],
  ['--good-ink', '--good'],
  ['--good-soft-ink', '--good-soft'],
  ['--good', '--bg'],
  ['--bad-ink', '--bad'],
  ['--bad-soft-ink', '--bad-soft'],
  ['--bad', '--bg'],
  ['--warn-soft-ink', '--warn-soft'],
  ['--key-white-ink', '--key-white'],
  ['--key-black-ink', '--key-black'],
  ['--key-white-ink', '--key-pressed'],
  ['--text', '--accent-soft'],
]

// Grafische Elemente (Sterne): mindestens 3 : 1 auf weissen Karten
const GRAPHIC: [string, string][] = [['--star', '--surface']]

describe('Kontraste (Text mind. 4,5 : 1)', () => {
  for (const [area, vars] of Object.entries(areas)) {
    for (const [fg, bg] of PAIRS) {
      it(`${area}: ${fg} auf ${bg}`, () => {
        expect(vars[fg], fg).toBeTruthy()
        expect(vars[bg], bg).toBeTruthy()
        expect(ratio(vars[fg], vars[bg])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('Kontraste grafischer Elemente (mind. 3 : 1)', () => {
  for (const [fg, bg] of GRAPHIC) {
    it(`${fg} auf ${bg}`, () => {
      expect(ratio(base[fg], base[bg])).toBeGreaterThanOrEqual(3)
    })
  }
})

describe('Farben nur an einer Stelle', () => {
  it('Screens enthalten keine eigenen Farbwerte', () => {
    const files = import.meta.glob('./ui/*.svelte', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const bad = Object.entries(files)
      .filter(([, src]) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(src.split('<style>')[1] ?? ''))
      .map(([name]) => name)
    expect(Object.keys(files).length).toBeGreaterThan(5)
    expect(bad).toEqual([])
  })
})
