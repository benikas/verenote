/** Inhalte (Einführungen, Themen, Intervall-Karten) aus dem Textformat von inhalte.md lesen. */

export type Area = 'notes' | 'intervals' | 'allgemein'
export type ExampleKind = 'nacheinander' | 'gleichzeitig' | 'folge'

export interface Example {
  name: string
  kind: ExampleKind
  /** Gruppen von Tönen. nacheinander/gleichzeitig: genau eine Gruppe; folge: mehrere, jede nacheinander */
  groups: string[][]
}

export interface Mnemonic {
  title: string
  hint: string
  direction: 'aufwärts' | 'abwärts'
  /** Mit ⚠ markiert: Quelle weniger sicher */
  uncertain: boolean
}

export interface Entry {
  id: string
  title: string
  area: Area
  paragraphs: string[]
  tip?: string
  examples: Example[]
  mnemonics: Mnemonic[]
}

const AREAS: Area[] = ['notes', 'intervals', 'allgemein']
const KINDS: ExampleKind[] = ['nacheinander', 'gleichzeitig', 'folge']
const NOTE = /^[A-G][#b]?-?\d$/

function parseExample(line: string, id: string): Example {
  const parts = line.split('|').map((s) => s.trim())
  if (parts.length !== 3) throw new Error(`${id}: Hörbeispiel ohne drei Teile: "${line}"`)
  const [name, kind, tones] = parts
  if (!KINDS.includes(kind as ExampleKind)) throw new Error(`${id}: unbekannte Art "${kind}"`)
  const groups = tones.split(';').map((g) => g.trim().split(/\s+/).filter(Boolean))
  for (const n of groups.flat()) if (!NOTE.test(n)) throw new Error(`${id}: ungültiger Ton "${n}"`)
  if (kind !== 'folge' && groups.length !== 1) throw new Error(`${id}: "${name}" braucht genau eine Gruppe`)
  return { name, kind: kind as ExampleKind, groups }
}

function parseMnemonic(line: string, id: string): Mnemonic {
  const parts = line.split('|').map((s) => s.trim())
  if (parts.length !== 3) throw new Error(`${id}: Merksatz ohne drei Teile: "${line}"`)
  const uncertain = parts[0].startsWith('⚠')
  const direction = parts[2]
  if (direction !== 'aufwärts' && direction !== 'abwärts') throw new Error(`${id}: unbekannte Richtung "${direction}"`)
  return { title: parts[0].replace(/^⚠\s*/, ''), hint: parts[1], direction, uncertain }
}

export function parseInhalte(source: string): Entry[] {
  const entries: Entry[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let cur: Entry | null = null
  let mode: 'none' | 'text' | 'examples' | 'mnemonics' = 'none'
  let para: string[] = []

  const flushPara = () => {
    if (cur && para.length) cur.paragraphs.push(para.join(' '))
    para = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const head = /^## (\S+)\s*$/.exec(line)
    if (head) {
      flushPara()
      cur = { id: head[1], title: '', area: 'allgemein', paragraphs: [], examples: [], mnemonics: [] }
      entries.push(cur)
      mode = 'none'
      continue
    }
    if (!cur || line === '---') {
      if (line === '---') {
        flushPara()
        cur = null
      }
      continue
    }
    const key = /^(Titel|Bereich|Text|Tipp|Hörbeispiele|Merksätze):\s*(.*)$/.exec(line)
    if (key) {
      flushPara()
      const [, k, v] = key
      if (k === 'Titel') cur.title = v
      else if (k === 'Bereich') {
        if (!AREAS.includes(v as Area)) throw new Error(`${cur.id}: unbekannter Bereich "${v}"`)
        cur.area = v as Area
      } else if (k === 'Tipp') cur.tip = v
      mode = k === 'Text' ? 'text' : k === 'Hörbeispiele' ? 'examples' : k === 'Merksätze' ? 'mnemonics' : 'none'
      continue
    }
    if (mode === 'text') {
      if (line.trim() === '') flushPara()
      else para.push(line.trim())
    } else if (mode === 'examples' && line.startsWith('- ')) cur.examples.push(parseExample(line.slice(2), cur.id))
    else if (mode === 'mnemonics' && line.startsWith('- ')) cur.mnemonics.push(parseMnemonic(line.slice(2), cur.id))
  }
  flushPara()
  return entries
}
