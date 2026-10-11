import { describe, expect, it } from 'vitest'
import { DATA_VERSION, DEFAULT_PERSISTED_SETTINGS, emptyData, migrate } from './schema'
import { DATA_KEY, clearData, loadData, memoryStore, saveData, type KeyValueStore } from './store'

describe('Speicherschicht', () => {
  it('leerer Speicher: Standardwerte, Status fresh', async () => {
    const loaded = await loadData(memoryStore())
    expect(loaded.status).toBe('fresh')
    expect(loaded.data).toEqual(emptyData())
    expect(loaded.data.version).toBe(DATA_VERSION)
    expect(loaded.writable).toBe(true)
  })

  it('Schreiben und wieder Lesen ergibt dieselben Daten', async () => {
    const store = memoryStore()
    const data = emptyData()
    data.settings.tempo = 0.9
    data.settings.neutralize = false
    data.progress.items['E|C'] = { hits: 3, misses: 1 }
    data.progress.recent['1a'] = [true, false, true]
    data.progress.rounds.push({ at: '2026-10-11T10:00:00.000Z', level: '1a', total: 10, correct: 8 })
    expect(await saveData(store, data)).toBe(true)
    const loaded = await loadData(store)
    expect(loaded.status).toBe('ok')
    expect(loaded.data).toEqual(data)
  })

  it('Löschen setzt auf leer zurück', async () => {
    const store = memoryStore()
    await saveData(store, { ...emptyData(), settings: { ...DEFAULT_PERSISTED_SETTINGS, tempo: 0.8 } })
    expect(await clearData(store)).toBe(true)
    expect((await loadData(store)).status).toBe('fresh')
  })

  it('Speicher wirft Fehler: App startet leer, schreibt nicht', async () => {
    const broken: KeyValueStore = {
      get: async () => {
        throw new Error('IndexedDB gesperrt')
      },
      set: async () => {
        throw new Error('voll')
      },
      del: async () => {},
    }
    const loaded = await loadData(broken)
    expect(loaded.status).toBe('unavailable')
    expect(loaded.writable).toBe(false)
    expect(await saveData(broken, loaded.data)).toBe(false)
  })

  it('Daten einer neueren Version werden nicht überschrieben', async () => {
    const loaded = await loadData(memoryStore({ [DATA_KEY]: { version: DATA_VERSION + 1, foo: 1 } }))
    expect(loaded.status).toBe('newer')
    expect(loaded.writable).toBe(false)
  })
})

describe('Migration', () => {
  it('nichts gespeichert -> fresh', () => {
    expect(migrate(undefined).status).toBe('fresh')
    expect(migrate(null).status).toBe('fresh')
  })

  it('Müll -> invalid, mit Standardwerten', () => {
    for (const junk of ['text', 42, [], { foo: 1 }, { version: 'x' }, { version: -1 }, { version: 1.5 }]) {
      const m = migrate(junk)
      expect(m.status).toBe('invalid')
      expect(m.data).toEqual(emptyData())
    }
  })

  it('Version 0 (ohne Felder) wird übernommen und ergänzt', () => {
    const m = migrate({ version: 0 })
    expect(m.status).toBe('migrated')
    expect(m.data).toEqual(emptyData())
  })

  it('kaputte Felder fallen auf Standardwerte, gute bleiben', () => {
    const m = migrate({
      version: DATA_VERSION,
      settings: { tempo: 99, neutralize: 'ja', neutralLength: 'long', level: '9z', length: 15, unlockThreshold: 0.1 },
      progress: {
        items: { 'E|C': { hits: 2, misses: -4 }, kaputt: 7 },
        recent: { '1a': [true, 'x', false], '1b': 'nein' },
        rounds: [{ at: '2026-01-01T00:00:00Z', level: '1a', total: 10, correct: 12 }, { at: 3 }],
      },
    })
    expect(m.status).toBe('ok')
    expect(m.data.settings.tempo).toBe(2.0) // an die Grenze geklemmt
    expect(m.data.settings.neutralize).toBe(true) // Standard
    expect(m.data.settings.neutralLength).toBe('long')
    expect(m.data.settings.level).toBe('1a')
    expect(m.data.settings.unlockThreshold).toBe(0.5) // untere Grenze
    expect(m.data.progress.items).toEqual({ 'E|C': { hits: 2, misses: 0 } })
    expect(m.data.progress.recent).toEqual({ '1a': [true, false] })
    expect(m.data.progress.rounds).toEqual([{ at: '2026-01-01T00:00:00Z', level: '1a', total: 10, correct: 10 }])
  })

  it('begrenzt Verlauf und letzte Versuche', () => {
    const many = Array.from({ length: 50 }, (_, i) => i % 2 === 0)
    const rounds = Array.from({ length: 50 }, (_, i) => ({ at: `2026-01-${i}`, level: '1a', total: 10, correct: 5 }))
    const m = migrate({ version: DATA_VERSION, progress: { recent: { '1a': many }, rounds } })
    expect(m.data.progress.recent['1a']).toHaveLength(20)
    expect(m.data.progress.rounds).toHaveLength(30)
    expect(m.data.progress.rounds.at(-1)?.at).toBe('2026-01-49')
  })
})
