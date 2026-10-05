import { FRAMEWORKS, LANGUAGE_INFO, type Language } from '@hook/domain';

/** Server-side framework definitions used in prompts (never shipped to the browser). */
const DEFINITIONS: Readonly<Record<string, string>> = {
  contrarian: 'Challenge widely accepted advice with a confident counter-position.',
  unpopular_opinion: 'Start with "Unpopular opinion:" or similar and state a view many would dispute.',
  mistake_story: 'Open with a specific mistake the author made and hint at its cost.',
  i_was_wrong: 'Admit a belief the author held and has now reversed.',
  before_after: 'Contrast a "before" state with an "after" state in one or two short beats.',
  number_list: 'Promise a list. Use a count ONLY if the user gave it; otherwise use the placeholder [X].',
  curiosity_gap: 'Withhold the key answer so the reader must keep reading.',
  myth_buster: 'Name a common myth and signal it is false.',
  how_i: 'Promise the method behind a result the user actually described.',
  stop_doing: 'Tell the reader to stop a common habit.',
  nobody_tells_you: 'Reveal something insiders rarely say out loud.',
  confession: 'Share a vulnerable admission in first person.',
  mid_story: 'Drop the reader into the middle of a moment, no setup.',
  direct_question: 'Ask one sharp question the target reader feels.',
  relatable_pain: 'Name a frustration the reader has felt, in their words.',
  warning: 'Warn the reader about a risk before they act.',
  quick_win: 'Promise one small, fast improvement.',
  this_vs_that: 'Contrast two options or mindsets sharply.',
  lesson_learned: 'Frame the takeaway from an experience the user described.',
  behind_the_scenes: 'Promise a look at what normally stays hidden.',
  try_this: 'Challenge the reader to do one specific thing.',
  imagine: 'Paint a desirable future the reader wants.',
  proof_point: 'Lead with a concrete result FROM THE USER INPUT only; otherwise use [X].',
  one_word: 'Open with a single punchy word, then a short line.',
  milestone: 'Mark a moment that matters to the author.',
};

export function frameworkList(): string {
  return FRAMEWORKS.list()
    .map((f) => `- ${f.id}: ${DEFINITIONS[f.id] ?? f.summary}`)
    .join('\n');
}

export function languageRule(language: Language): string {
  const info = LANGUAGE_INFO[language];
  if (language === 'hinglish') {
    return 'Write in natural Hinglish: Hindi and English mixed, in LATIN script only (no Devanagari).';
  }
  if (info.script === 'devanagari') {
    return `Write in ${info.label} using Devanagari script. Keep English words only where creators really use them.`;
  }
  if (language === 'en') return 'Write in clear, modern English.';
  return `Write in ${info.label} using its native script.`;
}

export const HONESTY_RULES = [
  'HONESTY: Never invent numbers, earnings, results, follower counts, percentages, dates or credentials.',
  'Every number you write must appear in the user data; otherwise use a placeholder like [X].',
  'Never write URLs, emails, phone numbers or @mentions of real people.',
  'Never produce hate, harassment, sexual content, self-harm encouragement, scams or get-rich-quick promises,',
  'medical/financial/legal/election misinformation, fake news about real people or events, impersonation of',
  'real people or brands, or content exploiting tragedies.',
].join(' ');
