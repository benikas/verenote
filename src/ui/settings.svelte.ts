import { DEFAULT_SETTINGS, type Settings } from '../exercise/settings'

/** Gemeinsamer, reaktiver Zustand der Einstellungen (nur im Speicher, Persistenz ab M2). */
export const settings: Settings = $state({ ...DEFAULT_SETTINGS })
