/**
 * Blocked-topic rules (PRD A8, T9 / S-31), checked on input AND output.
 * Rules catch clear cases cheaply; an optional ModerationCheck (e.g. Llama Guard on
 * Workers AI) adds a model-based second opinion for everything else.
 */
export type PolicyCategory =
  | 'scam'
  | 'hate'
  | 'sexual'
  | 'self_harm'
  | 'misinformation'
  | 'election'
  | 'impersonation'
  | 'tragedy';

const RULES: readonly (readonly [PolicyCategory, RegExp])[] = [
  ['scam', /\bguarantee(?:d|s)?\b.{0,40}\b(?:returns?|profits?|income|earnings?|money|lakh|crore|₹|rs\.?|\$)/iu],
  ['scam', /\b(?:double|triple)\s+your\s+(?:money|investment|crypto)\b/iu],
  ['scam', /\b(?:get[\s-]rich[\s-]quick|risk[\s-]free\s+(?:returns?|profits?|trading))\b/iu],
  ['scam', /(?:₹|rs\.?\s?|inr\s?)\s?[\d,.]+\s*(?:lakh|crore|k)?\s*(?:\/|per\s+)(?:day|week)\b/iu],
  ['scam', /\b(?:pump\s+and\s+dump|ponzi|pyramid\s+scheme|send\s+me\s+your\s+otp)\b/iu],
  ['sexual', /\b(?:porn|nude|nudes|sexting|explicit\s+sex|onlyfans\s+leak)\b/iu],
  ['self_harm', /\b(?:how\s+to\s+(?:kill|hurt)\s+(?:myself|yourself)|ways\s+to\s+self[\s-]harm|pro[\s-]?ana)\b/iu],
  ['misinformation', /\b(?:vaccines?\s+cause\s+autism|cures?\s+(?:cancer|diabetes|hiv)\s+(?:naturally|in\s+\d+\s+days)|covid\s+(?:is\s+)?(?:a\s+)?hoax)\b/iu],
  ['election', /\b(?:evm|election|voting|votes?)\b.{0,30}\b(?:rigged|hacked|stolen|fraud)\b/iu],
  ['election', /\b(?:don'?t|do\s+not)\s+vote\b|\bvote\s+(?:on|by)\s+(?:sms|whatsapp)\b/iu],
  ['impersonation', /\b(?:pretend|pose|posing|write)\s+(?:to\s+be|as)\s+(?:the\s+)?(?:real\s+)?(?:elon\s+musk|narendra\s+modi|ratan\s+tata|mukesh\s+ambani|virat\s+kohli|sundar\s+pichai)\b/iu],
  ['impersonation', /\b(?:official\s+(?:statement|account)\s+(?:of|from))\b/iu],
  ['tragedy', /\b(?:capitali[sz]e|cash\s+in|go\s+viral)\s+(?:on|off)\s+(?:the\s+)?(?:tragedy|disaster|crash|attack|death|deaths)\b/iu],
  ['hate', /\b(?:all|those)\s+\w+\s+(?:are|r)\s+(?:vermin|animals|parasites|subhuman)\b/iu],
  ['hate', /\b(?:kill|exterminate|deport)\s+all\s+\w+/iu],
];

const URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|in|net|org|io|co|app|dev|xyz|me)\b/iu;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/u;
const PHONE = /(?:\+?\d[\s-]?){10,}/u;

export interface PolicyVerdict {
  readonly allowed: boolean;
  readonly category: PolicyCategory | null;
}

/** Optional model-based moderation (adapter in infrastructure). */
export interface ModerationCheck {
  isUnsafe(text: string): Promise<boolean>;
}

export class ContentPolicy {
  readonly #moderation: ModerationCheck | null;

  public constructor(moderation: ModerationCheck | null = null) {
    this.#moderation = moderation;
  }

  /** Rules only: synchronous and free. */
  public checkRules(text: string): PolicyVerdict {
    for (const [category, rule] of RULES) {
      if (rule.test(text)) return { allowed: false, category };
    }
    return { allowed: true, category: null };
  }

  /** Input check before any credit is reserved. */
  public async checkInput(text: string): Promise<PolicyVerdict> {
    const verdict = this.checkRules(text);
    if (!verdict.allowed || this.#moderation === null) return verdict;
    const unsafe = await this.#moderation.isUnsafe(text).catch(() => false);
    return unsafe ? { allowed: false, category: 'misinformation' } : verdict;
  }

  /** Output check: rules + no URLs, emails or phone numbers (PRD A8). */
  public checkOutput(text: string): PolicyVerdict {
    const verdict = this.checkRules(text);
    if (!verdict.allowed) return verdict;
    if (URL.test(text) || EMAIL.test(text) || PHONE.test(text)) return { allowed: false, category: 'scam' };
    return verdict;
  }
}
