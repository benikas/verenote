import { samePitchClass, pitchClass } from '../theory/notes'
import type { LevelId } from '../theory/tasks'
import {
  expectedAnswer,
  itemLabel,
  levelPractice,
  poolFor,
  taskFromItem,
  taskKey,
  type ExerciseTask,
  type PoolItem,
  type Practice,
} from '../theory/practice'
import { pickWeighted, type Rng } from '../shared/rng'
import type { ItemStat as StoredItemStat } from '../storage/schema'
import { historyWeight } from './weights'

/**
 * Übungs-Engine für Grundtöne und Intervalle. Kennt weder UI noch Audio:
 * erzeugt Aufgaben, bewertet Antworten und lässt Fehler öfter wiederholen.
 * Gewicht eines Items = Fehlerstand aus früheren Runden (`history`) + Fehler in dieser Session.
 * Gespeichert wird von der App.
 */

/** Maximale Zusatzgewichtung eines oft verfehlten Items */
const MAX_PENALTY = 6
/** Zusatzgewicht pro Fehler / Abzug pro richtiger Antwort */
const MISS_PENALTY = 2
const HIT_RELIEF = 1

export interface SessionConfig {
  /** Stufe des Lernpfads; null im Freien Training (dann ist `practice` Pflicht) */
  level: LevelId | null
  /** Was geübt wird. Standard: die Übung der Stufe */
  practice?: Practice
  /** Anzahl Aufgaben pro Session, üblich 10–20 */
  length: number
  rng?: Rng
  /** Gespeicherter Fehlerstand eines Items (Schlüssel wie "E|C" oder "int:4:up") */
  history?: (key: string) => StoredItemStat | undefined
}

export interface AnswerResult {
  task: ExerciseTask
  /** Antwort: Pitch Class ("D") bei Grundtönen, Halbtöne ("4") bei Intervallen */
  given: string
  /** Richtige Antwort in derselben Form */
  expected: string
  correct: boolean
}

/** Ergebnis je Item der Übung (Ton bzw. Intervall) */
export interface ItemRow {
  key: string
  label: string
  attempts: number
  correct: number
}

export interface NoteStat {
  /** Zielton als Pitch Class */
  note: string
  attempts: number
  correct: number
}

export interface SessionSummary {
  level: LevelId | null
  practice: Practice
  total: number
  correct: number
  /** Trefferquote 0–1 (0 bei keiner Antwort) */
  accuracy: number
  /** Pro Zielton, in der Reihenfolge der Stufe (nur Grundtöne, sonst leer) */
  perNote: NoteStat[]
  /** Pro Item (Ton bzw. Intervall) in der Reihenfolge der Übung */
  perItem: ItemRow[]
  /** Alle gegebenen Antworten in Reihenfolge */
  answers: AnswerResult[]
}

interface ItemStat {
  attempts: number
  correct: number
  /** Zusatzgewicht: steigt bei Fehlern, sinkt bei Treffern */
  penalty: number
}

export class Session {
  readonly level: LevelId | null
  readonly practice: Practice
  readonly length: number
  private readonly rng: Rng
  private readonly pool: PoolItem[]
  private readonly history: (key: string) => StoredItemStat | undefined
  private readonly stats = new Map<string, ItemStat>()
  private readonly results: AnswerResult[] = []
  private issued = 0
  private open: ExerciseTask | null = null
  private lastKey: string | null = null

  constructor(config: SessionConfig) {
    if (!Number.isInteger(config.length) || config.length < 1) {
      throw new Error('Die Session braucht mindestens eine Aufgabe')
    }
    const practice = config.practice ?? (config.level ? levelPractice(config.level) : null)
    if (!practice) throw new Error('Die Session braucht eine Stufe oder eine Übung')
    this.level = config.level
    this.practice = practice
    this.length = config.length
    this.rng = config.rng ?? Math.random
    this.history = config.history ?? (() => undefined)
    this.pool = poolFor(practice)
    if (this.pool.length === 0) throw new Error('Die Übung enthält nichts zum Üben')
  }

  /** Aufgabe, auf die noch eine Antwort fehlt (oder null). */
  get current(): ExerciseTask | null {
    return this.open
  }

  /** Anzahl beantworteter Aufgaben */
  get answered(): number {
    return this.results.length
  }

  /** Fertig, wenn alle Aufgaben beantwortet sind. */
  get done(): boolean {
    return this.results.length >= this.length
  }

  /** Nächste Aufgabe erzeugen. Erst nach der Antwort auf die vorige erlaubt. */
  next(): ExerciseTask {
    if (this.open) throw new Error('Die aktuelle Aufgabe ist noch nicht beantwortet')
    if (this.issued >= this.length) throw new Error('Die Session ist bereits zu Ende')

    const item = this.pickItem()
    this.issued += 1
    this.lastKey = item.key
    this.open = taskFromItem(item, this.issued, this.level, this.practice, this.rng)
    return this.open
  }

  /**
   * Antwort bewerten. Grundtöne: Ton mit oder ohne Oktave ("E" oder "E4").
   * Intervalle: Abstand in Halbtönen ("4" oder 4).
   */
  answer(answer: string | number): AnswerResult {
    const task = this.open
    if (!task) throw new Error('Es gibt keine offene Aufgabe')

    const expected = expectedAnswer(task)
    let given: string
    let correct: boolean
    if (task.kind === 'notes') {
      given = pitchClass(String(answer))
      correct = samePitchClass(given, expected)
    } else {
      given = String(answer)
      correct = given === expected
    }

    const stat = this.stat(taskKey(task))
    stat.attempts += 1
    if (correct) {
      stat.correct += 1
      stat.penalty = Math.max(0, stat.penalty - HIT_RELIEF)
    } else {
      stat.penalty = Math.min(MAX_PENALTY, stat.penalty + MISS_PENALTY)
    }

    const result: AnswerResult = { task, given, expected, correct }
    this.results.push(result)
    this.open = null
    return result
  }

  summary(): SessionSummary {
    const correct = this.results.filter((r) => r.correct).length
    const total = this.results.length
    const perItem = this.pool.map((item): ItemRow => {
      const mine = this.results.filter((r) => taskKey(r.task) === item.key)
      return {
        key: item.key,
        label: itemLabel(item.key),
        attempts: mine.length,
        correct: mine.filter((r) => r.correct).length,
      }
    })
    const perNote =
      this.practice.type === 'notes'
        ? this.practice.notes.map((note): NoteStat => {
            const mine = this.results.filter((r) => r.expected === note)
            return { note, attempts: mine.length, correct: mine.filter((r) => r.correct).length }
          })
        : []
    return {
      level: this.level,
      practice: this.practice,
      total,
      correct,
      accuracy: total === 0 ? 0 : correct / total,
      perNote,
      perItem,
      answers: [...this.results],
    }
  }

  /**
   * Gewichtete Wahl: Items mit Fehlern (früher und in dieser Session) kommen öfter dran, neue
   * Items vor sicheren. Dasselbe Item erscheint nie zweimal hintereinander, solange es mehrere gibt.
   */
  private pickItem(): PoolItem {
    const candidates = this.pool.length > 1 ? this.pool.filter((i) => i.key !== this.lastKey) : this.pool
    const weights = candidates.map((i) => historyWeight(this.history(i.key)) + (this.stats.get(i.key)?.penalty ?? 0))
    return candidates[pickWeighted(weights, this.rng)]
  }

  private stat(key: string): ItemStat {
    let s = this.stats.get(key)
    if (!s) {
      s = { attempts: 0, correct: 0, penalty: 0 }
      this.stats.set(key, s)
    }
    return s
  }
}
