import { LANGUAGE_INFO, scriptShare, TextSanitizer, type Language, type Script } from '@hook/domain';
import type { ContentPolicy } from '../content-policy';
import type { NumberProvenanceCheck } from '../number-provenance';

const SCRIPT_REGEX: Readonly<Record<Script, RegExp>> = {
  latin: /\p{Script=Latin}/u,
  devanagari: /\p{Script=Devanagari}/u,
  telugu: /\p{Script=Telugu}/u,
  tamil: /\p{Script=Tamil}/u,
  kannada: /\p{Script=Kannada}/u,
  bengali: /\p{Script=Bengali}/u,
};

/** Per-request context shared by the output validators. */
export interface TextCheckContext {
  readonly language: Language;
  readonly policy: ContentPolicy;
  readonly provenance: NumberProvenanceCheck;
}

/** Returns a failure reason, or null when the text is acceptable. */
export function textProblem(text: string, ctx: TextCheckContext, checkNumbers = true): string | null {
  if (!ctx.policy.checkOutput(text).allowed) return 'policy';
  if (checkNumbers && !ctx.provenance.isHonest(text)) return 'invented_number';
  const script = LANGUAGE_INFO[ctx.language].script;
  const minShare = script === 'latin' ? 0.9 : 0.8;
  if (scriptShare(text, SCRIPT_REGEX[script]) < minShare) return 'wrong_script';
  return null;
}

export function cleanText(text: string): string {
  return TextSanitizer.clean(text).trim();
}
