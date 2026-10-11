import { describe, expect, it } from 'vitest'
import { recordAttempt, recordRound } from '../progress/progress'
import { updateUnlocks } from '../progress/unlock'
import { emptyData, type AppData } from './schema'
import { DATA_KEY, clearData, loadData, memoryStore, saveData } from './store'
import { exportFileName, exportJson, parseImport } from './transfer'

function sampleData(): AppData {
  const d = emptyData()
  d.settings.tempo = 0.85
  d.settings.neutralLength = 'long'
  d.settings.level = '1b'
  for (let i = 0; i < 20; i++) recordAttempt(d.progress, '1a', i % 2 ? 'E|C' : 'G|C', true)
  recordAttempt(d.progress, '1a', 'D|C', false)
  recordRound(d.progress, '1a', 10, 9, new Date('2026-10-11T12:00:00Z'))
  updateUnlocks(d.progress, 0.8)
  return d
}

describe('Export/Import', () => {
  it('Export, Zurücksetzen, Import ergibt denselben Stand', async () => {
    const store = memoryStore()
    const before = sampleData()
    expect(before.progress.unlocked).toContain('1b')
    await saveData(store, before)

    const file = exportJson((await loadData(store)).data)
    await clearData(store) // Zurücksetzen
    expect((await loadData(store)).data).toEqual(emptyData())

    const parsed = parseImport(file)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      await saveData(store, parsed.data)
      expect((await loadData(store)).data).toEqual(before)
    }
  })

  it('Export ist lesbares JSON mit Version', () => {
    const json = exportJson(emptyData())
    expect(JSON.parse(json).version).toBe(1)
    expect(json).toContain('\n')
  })

  it('Fehler: kein JSON, fremdes JSON, neuere Version', () => {
    expect(parseImport('kein json')).toEqual({ ok: false, error: 'Die Datei ist kein gültiges JSON.' })
    expect(parseImport('{"foo":1}')).toMatchObject({ ok: false })
    expect(parseImport('[]')).toMatchObject({ ok: false })
    expect(parseImport('null')).toMatchObject({ ok: false })
    const newer = parseImport('{"version": 99}')
    expect(newer).toMatchObject({ ok: false })
    expect(newer.ok === false && newer.error).toMatch(/neueren Version/)
  })

  it('Import bereinigt kaputte Felder statt sie zu übernehmen', () => {
    const r = parseImport(JSON.stringify({ version: 1, settings: { tempo: 50 }, progress: { items: { 'E|C': { hits: 'x' } } } }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.settings.tempo).toBe(2)
      expect(r.data.progress.items['E|C']).toEqual({ hits: 0, misses: 0 })
    }
  })

  it('Dateiname enthält das Datum', () => {
    expect(exportFileName(new Date(2026, 9, 5))).toBe('gehoertraining-2026-10-05.json')
  })

  it('Schlüssel ist stabil (Export/Import hängt nicht davon ab)', () => {
    expect(DATA_KEY).toBe('gehoertraining-data')
  })
})
