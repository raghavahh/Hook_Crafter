import type { Language } from '@hook/domain';

/**
 * Per-language word lists for the Hook Score.
 * Single words are matched against lower-cased word tokens; phrases are matched
 * as substrings of the lower-cased, whitespace-collapsed text.
 * Languages without a list fall back to script-agnostic signals only
 * (question marks, digits, length), so they get an empty lexicon.
 */
export interface Lexicon {
  /** Contrast and curiosity words ("but", "why", "secret"). */
  readonly curiosity: ReadonlySet<string>;
  /** Open-loop phrases ("here's", "nobody tells you"). */
  readonly openLoops: readonly string[];
  /** Power / emotion words. */
  readonly power: ReadonlySet<string>;
  /** Vague filler words. */
  readonly vague: ReadonlySet<string>;
  /** Cliché phrases. */
  readonly cliches: readonly string[];
  /** Corporate jargon. */
  readonly jargon: ReadonlySet<string>;
  /** Spelled-out numbers and ordinals. */
  readonly numberWords: ReadonlySet<string>;
  /** First-person words: a personal story is concrete. */
  readonly personal: ReadonlySet<string>;
}

interface WordLists {
  readonly curiosity: readonly string[];
  readonly openLoops: readonly string[];
  readonly power: readonly string[];
  readonly vague: readonly string[];
  readonly cliches: readonly string[];
  readonly jargon: readonly string[];
  readonly numberWords: readonly string[];
  readonly personal: readonly string[];
}

const ENGLISH: WordLists = {
  curiosity: [
    'but', 'yet', 'however', 'instead', 'why', 'secret', 'secrets', 'truth', 'nobody', 'never', 'wrong',
    'mistake', 'mistakes', 'surprising', 'unexpected', 'stop', 'myth', 'hidden', 'what', 'how', 'until',
    'except', 'unless', 'actually', 'turns',
  ],
  openLoops: [
    "here's", 'here is', 'nobody tells you', 'no one tells you', 'the truth about', 'what happened next',
    'the real reason', 'this is why', "here's why", 'i was wrong', 'what i learned', 'the one thing',
    'most people', 'turns out',
  ],
  power: [
    'lost', 'failed', 'fail', 'failure', 'fired', 'broke', 'quit', 'regret', 'afraid', 'fear', 'scared',
    'shocking', 'brutal', 'painful', 'proud', 'love', 'hate', 'cried', 'crushed', 'embarrassing', 'honest',
    'risk', 'dream', 'struggled', 'rejected', 'won', 'mistake', 'mistakes', 'never', 'worst', 'best',
    'secret', 'finally', 'alone', 'panic', 'stupid',
  ],
  vague: [
    'very', 'really', 'things', 'thing', 'stuff', 'something', 'some', 'many', 'lots', 'various', 'important',
    'good', 'nice', 'basically', 'kind', 'sort', 'maybe', 'somehow', 'everything', 'certain', 'quite',
  ],
  cliches: [
    "in today's fast-paced world", 'in today’s fast-paced world', 'fast-paced world', 'excited to share',
    'i am thrilled', "i'm thrilled", 'i am excited', "i'm excited", 'game changer', 'game-changer',
    'unlock your potential', 'at the end of the day', 'think outside the box', 'in this day and age',
    'without further ado', 'humbled to announce', 'let that sink in', 'it goes without saying',
    'needless to say', 'take it to the next level',
  ],
  jargon: [
    'synergy', 'synergies', 'leverage', 'paradigm', 'ecosystem', 'holistic', 'scalable', 'disruptive',
    'bandwidth', 'stakeholders', 'deliverables', 'optimize', 'actionable', 'robust', 'seamless', 'utilize',
    'innovative', 'streamline', 'empower',
  ],
  numberWords: [
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'twenty', 'thirty', 'fifty', 'hundred', 'thousand', 'million', 'billion', 'first', 'second', 'third',
    'half', 'dozen',
  ],
  personal: ['i', "i'm", "i've", "i'd", 'my', 'me', 'myself', 'we', 'our'],
};

const HINGLISH: WordLists = {
  curiosity: [
    'galti', 'sach', 'kabhi', 'kyun', 'kyu', 'raaz', 'lekin', 'par', 'magar', 'phir', 'asli', 'kaise', 'kya',
    'koi', 'nahi',
  ],
  openLoops: ['koi nahi batata', 'sach ye hai', 'asli wajah', 'yeh hai kyun', 'maine seekha', 'kya hua'],
  power: [
    'galti', 'sabse', 'yaar', 'bhai', 'seekha', 'dar', 'haar', 'jeet', 'pachtava', 'sapna', 'dard', 'sharam',
    'dhoka', 'zindagi', 'pyaar', 'barbaad', 'raaz',
  ],
  vague: ['kuch', 'bahut', 'cheezein', 'cheez', 'shayad', 'thoda'],
  cliches: ['aaj ke daur mein', 'aaj ki bhaag daud', 'dosto aaj hum', 'aaj ke zamane mein'],
  jargon: [],
  numberWords: ['ek', 'teen', 'chaar', 'paanch', 'das', 'sau', 'hazaar', 'lakh', 'crore', 'pehla', 'pehli'],
  personal: ['main', 'mera', 'meri', 'maine', 'mujhe', 'hum', 'humne', 'hamara'],
};

const HINDI: WordLists = {
  curiosity: ['गलती', 'सच', 'राज़', 'राज', 'कभी', 'क्यों', 'लेकिन', 'पर', 'मगर', 'असली', 'कैसे', 'क्या', 'कोई', 'नहीं'],
  openLoops: ['कोई नहीं बताता', 'सच यह है', 'सच ये है', 'असली वजह', 'मैंने सीखा', 'क्या हुआ'],
  power: [
    'गलती', 'सबसे', 'डर', 'हार', 'जीत', 'पछतावा', 'सपना', 'दर्द', 'शर्म', 'धोखा', 'ज़िंदगी', 'जिंदगी', 'प्यार',
    'बर्बाद', 'राज़', 'सीखा',
  ],
  vague: ['कुछ', 'बहुत', 'चीज़ें', 'चीजें', 'शायद', 'थोड़ा'],
  cliches: ['आज के दौर में', 'आज की भागदौड़', 'दोस्तों आज हम', 'आज के ज़माने में'],
  jargon: [],
  numberWords: ['एक', 'दो', 'तीन', 'चार', 'पांच', 'पाँच', 'दस', 'सौ', 'हज़ार', 'हजार', 'लाख', 'करोड़', 'पहला', 'पहली'],
  personal: ['मैं', 'मेरा', 'मेरी', 'मैंने', 'मुझे', 'हम', 'हमने', 'हमारा'],
};

const EMPTY: WordLists = {
  curiosity: [],
  openLoops: [],
  power: [],
  vague: [],
  cliches: [],
  jargon: [],
  numberWords: [],
  personal: [],
};

/** Lower-case + NFC so lists match sanitised text (e.g. "ज़" decomposes under NFC). */
export function normaliseForMatch(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/’/gu, "'").replace(/\s+/gu, ' ');
}

function merge(lists: readonly WordLists[]): Lexicon {
  const words = (pick: (l: WordLists) => readonly string[]): ReadonlySet<string> =>
    new Set(lists.flatMap(pick).map(normaliseForMatch));
  const phrases = (pick: (l: WordLists) => readonly string[]): readonly string[] =>
    Array.from(new Set(lists.flatMap(pick).map(normaliseForMatch)));
  return Object.freeze({
    curiosity: words((l) => l.curiosity),
    openLoops: phrases((l) => l.openLoops),
    power: words((l) => l.power),
    vague: words((l) => l.vague),
    cliches: phrases((l) => l.cliches),
    jargon: words((l) => l.jargon),
    numberWords: words((l) => l.numberWords),
    personal: words((l) => l.personal),
  });
}

/** Hinglish and Hindi posts mix in English words, so English is merged into both. */
const LEXICONS: ReadonlyMap<Language, Lexicon> = new Map<Language, Lexicon>([
  ['en', merge([ENGLISH])],
  ['hinglish', merge([HINGLISH, ENGLISH])],
  ['hi', merge([HINDI, ENGLISH])],
]);

const FALLBACK: Lexicon = merge([EMPTY]);

export function lexiconFor(language: Language): Lexicon {
  return LEXICONS.get(language) ?? FALLBACK;
}
