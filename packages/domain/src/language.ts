import { z } from 'zod';
import type { UnlockKey } from './features';

export const LANGUAGES = ['en', 'hinglish', 'hi', 'te', 'ta', 'kn', 'mr', 'bn'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LanguageSchema = z.enum(LANGUAGES);

export type Script = 'latin' | 'devanagari' | 'telugu' | 'tamil' | 'kannada' | 'bengali';

export interface LanguageInfo {
  readonly id: Language;
  readonly label: string;
  readonly script: Script;
  /**
   * Regional languages stay disabled until they pass the E4 quality eval.
   * Flip to true only after the eval passes for that language.
   */
  readonly enabled: boolean;
  /** Any ONE of these unlocks grants the language. Empty = free for everyone. */
  readonly requiredUnlocks: readonly UnlockKey[];
}

const REGIONAL: readonly UnlockKey[] = ['all_languages'];

export const LANGUAGE_INFO: Readonly<Record<Language, LanguageInfo>> = Object.freeze({
  en: { id: 'en', label: 'English', script: 'latin', enabled: true, requiredUnlocks: [] },
  hinglish: { id: 'hinglish', label: 'Hinglish', script: 'latin', enabled: true, requiredUnlocks: [] },
  hi: {
    id: 'hi',
    label: 'हिन्दी (Hindi)',
    script: 'devanagari',
    enabled: true,
    requiredUnlocks: ['hindi', 'all_languages'],
  },
  te: { id: 'te', label: 'తెలుగు (Telugu)', script: 'telugu', enabled: false, requiredUnlocks: REGIONAL },
  ta: { id: 'ta', label: 'தமிழ் (Tamil)', script: 'tamil', enabled: false, requiredUnlocks: REGIONAL },
  kn: { id: 'kn', label: 'ಕನ್ನಡ (Kannada)', script: 'kannada', enabled: false, requiredUnlocks: REGIONAL },
  mr: { id: 'mr', label: 'मराठी (Marathi)', script: 'devanagari', enabled: false, requiredUnlocks: REGIONAL },
  bn: { id: 'bn', label: 'বাংলা (Bengali)', script: 'bengali', enabled: false, requiredUnlocks: REGIONAL },
});

export function languageInfo(language: Language): LanguageInfo {
  return LANGUAGE_INFO[language];
}

export function enabledLanguages(): readonly LanguageInfo[] {
  return LANGUAGES.map((id) => LANGUAGE_INFO[id]).filter((info) => info.enabled);
}

/** True when the language is enabled AND the user holds a required unlock (if any). */
export function isLanguageAllowed(language: Language, unlocks: ReadonlySet<UnlockKey>): boolean {
  const info = LANGUAGE_INFO[language];
  if (!info.enabled) return false;
  if (info.requiredUnlocks.length === 0) return true;
  return info.requiredUnlocks.some((key) => unlocks.has(key));
}
