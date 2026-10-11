import { samePitchClass, pitchClass } from '../theory/notes'
import { getLevel, itemKey, makeTask, type LevelId, type Task } from '../theory/tasks'
import { pickWeighted, type Rng } from '../shared/rng'

/**
 * Übungs-Engine für Grundton-Sessions. Kennt weder UI noch Audio:
 * erzeugt Aufgaben, bewertet Antworten und lässt Fehler öfter wiederholen.
 * Der Fortschritt lebt nur in der Session (Speichern kommt erst in M2).
 */

/** Maximale Zusatzgewichtung eines oft verfehlten Items */
const MAX_PENALTY = 6
/** Zusatzgewicht pro Fehler / Abzug pro richtiger Antwort */
const MISS_PENALTY = 2
const HIT_RELIEF = 1

export interface SessionConfig {
  level: LevelId
  /** Anzahl Aufgaben pro Session, üblich 10–20 */
  length: number
  rng?: Rng
}

export interface AnswerResult {
  task: Task
  /** Antwort als Pitch Class, z. B. "D" */
  given: string
  /** Richtige Antwort als Pitch Class, z. B. "E" */
  expected: string
  correct: boolean
}

export interface NoteStat {
  /** Zielton als Pitch Class */
  note: string
  attempts: number
  correct: number
}

export interface SessionSummary {
  level: LevelId
  total: number
  correct: number
  /** Trefferquote 0–1 (0 bei keiner Antwort) */
  accuracy: number
  /** Pro Zielton, in der Reihenfolge der Stufe */
  perNote: NoteStat[]
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
  readonly level: LevelId
  readonly length: number
  private readonly rng: Rng
  private readonly notes: readonly string[]
  private readonly stats = new Map<string, ItemStat>()
  private readonly results: AnswerResult[] = []
  private issued = 0
  private open: Task | null = null
  private lastTarget: string | null = null

  constructor(config: SessionConfig) {
    if (!Number.isInteger(config.length) || config.length < 1) {
      throw new Error('Die Session braucht mindestens eine Aufgabe')
    }
    this.level = config.level
    this.length = config.length
    this.rng = config.rng ?? Math.random
    this.notes = getLevel(config.level).notes
  }

  /** Aufgabe, auf die noch eine Antwort fehlt (oder null). */
  get current(): Task | null {
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
  next(): Task {
    if (this.open) throw new Error('Die aktuelle Aufgabe ist noch nicht beantwortet')
    if (this.issued >= this.length) throw new Error('Die Session ist bereits zu Ende')

    const target = this.pickTarget()
    this.issued += 1
    this.lastTarget = target
    this.open = makeTask(this.issued, this.level, target)
    return this.open
  }

  /** Antwort bewerten. note darf mit oder ohne Oktave angegeben werden ("E" oder "E4"). */
  answer(note: string): AnswerResult {
    const task = this.open
    if (!task) throw new Error('Es gibt keine offene Aufgabe')

    const given = pitchClass(note)
    const expected = pitchClass(task.target)
    const correct = samePitchClass(given, expected)

    const stat = this.stat(itemKey(task))
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
    const perNote = this.notes.map((note): NoteStat => {
      const mine = this.results.filter((r) => r.expected === note)
      return { note, attempts: mine.length, correct: mine.filter((r) => r.correct).length }
    })
    return {
      level: this.level,
      total,
      correct,
      accuracy: total === 0 ? 0 : correct / total,
      perNote,
      answers: [...this.results],
    }
  }

  /**
   * Gewichtete Wahl: Töne mit Fehlern kommen öfter dran. Derselbe Zielton
   * erscheint nie zweimal hintereinander, solange die Stufe mehrere Töne hat.
   */
  private pickTarget(): string {
    const candidates = this.notes.length > 1 ? this.notes.filter((n) => n !== this.lastTarget) : this.notes
    const weights = candidates.map((n) => 1 + this.penaltyFor(n))
    return candidates[pickWeighted(weights, this.rng)]
  }

  private penaltyFor(note: string): number {
    const key = itemKey(makeTask(0, this.level, note))
    return this.stats.get(key)?.penalty ?? 0
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
