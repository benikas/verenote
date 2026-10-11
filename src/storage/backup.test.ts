import { describe, expect, it } from 'vitest'
import { dismissReminder, markExported, noteRound, shouldRemind } from './backup'
import { emptyBackup } from './schema'

describe('Export-Erinnerung', () => {
  it('erscheint nach 5 Runden, vorher nicht', () => {
    const b = emptyBackup()
    for (let i = 0; i < 4; i++) {
      noteRound(b)
      expect(shouldRemind(b)).toBe(false)
    }
    noteRound(b)
    expect(shouldRemind(b)).toBe(true)
  })

  it('Wegklicken blendet aus, nach 5 weiteren Runden kommt sie wieder', () => {
    const b = emptyBackup()
    for (let i = 0; i < 5; i++) noteRound(b)
    dismissReminder(b)
    expect(shouldRemind(b)).toBe(false)
    for (let i = 0; i < 4; i++) noteRound(b)
    expect(shouldRemind(b)).toBe(false)
    noteRound(b)
    expect(shouldRemind(b)).toBe(true)
  })

  it('Export setzt den Zähler zurück und blendet aus', () => {
    const b = emptyBackup()
    for (let i = 0; i < 7; i++) noteRound(b)
    expect(shouldRemind(b)).toBe(true)
    markExported(b)
    expect(shouldRemind(b)).toBe(false)
    expect(b).toEqual(emptyBackup())
    for (let i = 0; i < 5; i++) noteRound(b)
    expect(shouldRemind(b)).toBe(true)
  })
})
