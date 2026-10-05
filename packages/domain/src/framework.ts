import { InvariantViolation } from './errors';

interface FrameworkProps {
  readonly id: string;
  readonly name: string;
  /** Public one-liner. The detailed prompt definitions stay server-side (PRD B8). */
  readonly summary: string;
  /** Public example. Uses [X] placeholders, never invented numbers. */
  readonly example: string;
}

/** Immutable hook formula. */
export class Framework {
  public readonly id: string;
  public readonly name: string;
  public readonly summary: string;
  public readonly example: string;

  private constructor(props: FrameworkProps) {
    this.id = props.id;
    this.name = props.name;
    this.summary = props.summary;
    this.example = props.example;
    Object.freeze(this);
  }

  public static create(props: FrameworkProps): Framework {
    if (!/^[a-z][a-z0-9_]{1,39}$/u.test(props.id)) {
      throw new InvariantViolation(`Invalid framework id: ${props.id}`);
    }
    if (props.name.trim() === '' || props.summary.trim() === '' || props.example.trim() === '') {
      throw new InvariantViolation(`Framework ${props.id} needs name, summary and example`);
    }
    return new Framework(props);
  }
}

const DEFINITIONS: readonly FrameworkProps[] = [
  { id: 'contrarian', name: 'Contrarian Take', summary: 'Go against the popular advice.', example: 'Stop posting every day. It is hurting your reach.' },
  { id: 'unpopular_opinion', name: 'Unpopular Opinion', summary: 'Own a view most people would argue with.', example: 'Unpopular opinion: your portfolio matters more than your degree.' },
  { id: 'mistake_story', name: 'Mistake Story', summary: 'Open with a mistake you made.', example: 'I lost my first client because of one email I never sent.' },
  { id: 'i_was_wrong', name: 'I Was Wrong', summary: 'Admit you changed your mind.', example: 'I was wrong about cold DMs. Here is what changed my mind.' },
  { id: 'before_after', name: 'Before / After', summary: 'Contrast the old state with the new one.', example: 'Before: posts nobody read. After: DMs from founders.' },
  { id: 'number_list', name: 'Number List', summary: 'Promise a countable list.', example: '[X] mistakes that kill your first line.' },
  { id: 'curiosity_gap', name: 'Curiosity Gap', summary: 'Hint at an answer without giving it away.', example: 'The reason your posts flop is not your content.' },
  { id: 'myth_buster', name: 'Myth Buster', summary: 'Call out a common myth.', example: 'Myth: you need a big following to land clients.' },
  { id: 'how_i', name: 'How I...', summary: 'Promise the method behind your result.', example: 'How I write a hook in under five minutes.' },
  { id: 'stop_doing', name: 'Stop Doing This', summary: 'Tell readers to drop a habit.', example: 'Stop starting posts with "Excited to share".' },
  { id: 'nobody_tells_you', name: 'Nobody Tells You', summary: 'Reveal insider knowledge.', example: 'Nobody tells you how lonely building in public feels.' },
  { id: 'confession', name: 'Confession', summary: 'Share something vulnerable.', example: 'Confession: I almost quit last month.' },
  { id: 'mid_story', name: 'Mid-Story Open', summary: 'Start in the middle of the action.', example: 'The call ended. I had just lost the deal.' },
  { id: 'direct_question', name: 'Direct Question', summary: 'Ask the reader a pointed question.', example: 'Why do your best posts get the fewest likes?' },
  { id: 'relatable_pain', name: 'Relatable Pain', summary: 'Name a frustration the reader feels.', example: 'You spent hours on that post. It got [X] likes.' },
  { id: 'warning', name: 'Warning', summary: 'Warn about a risk or trap.', example: 'Read this before you send your next cold email.' },
  { id: 'quick_win', name: 'Quick Win', summary: 'Promise a fast, small improvement.', example: 'One edit that makes any first line stronger.' },
  { id: 'this_vs_that', name: 'This vs That', summary: 'Compare two options sharply.', example: 'Writing for likes vs writing for clients.' },
  { id: 'lesson_learned', name: 'Lesson Learned', summary: 'Share the takeaway from an experience.', example: 'The hardest lesson from my first launch.' },
  { id: 'behind_the_scenes', name: 'Behind the Scenes', summary: 'Show what usually stays hidden.', example: 'What a "viral" post looks like before anyone sees it.' },
  { id: 'try_this', name: 'Try This', summary: 'Challenge the reader to an action.', example: 'Try this before you post today.' },
  { id: 'imagine', name: 'Imagine If', summary: 'Paint a future the reader wants.', example: 'Imagine every post bringing you one new client.' },
  { id: 'proof_point', name: 'Proof Point', summary: 'Lead with a result taken from your own input.', example: 'From zero replies to [X] client calls. Same profile.' },
  { id: 'one_word', name: 'One-Word Open', summary: 'Open with a single punchy word.', example: 'Consistency. It is overrated, and here is why.' },
  { id: 'milestone', name: 'Milestone', summary: 'Mark a moment that matters.', example: 'A year ago I had never posted. Today this happened.' },
];

/** The ~25 known frameworks: lookup + validation. */
export class FrameworkLibrary {
  readonly #byId: ReadonlyMap<string, Framework>;

  private constructor(frameworks: readonly Framework[]) {
    this.#byId = new Map(frameworks.map((f) => [f.id, f]));
    if (this.#byId.size !== frameworks.length) {
      throw new InvariantViolation('Duplicate framework id');
    }
  }

  public static default(): FrameworkLibrary {
    return new FrameworkLibrary(DEFINITIONS.map((d) => Framework.create(d)));
  }

  public has(id: string): boolean {
    return this.#byId.has(id);
  }

  public get(id: string): Framework | undefined {
    return this.#byId.get(id);
  }

  public list(): readonly Framework[] {
    return [...this.#byId.values()];
  }

  public ids(): readonly string[] {
    return [...this.#byId.keys()];
  }
}

export const FRAMEWORKS = FrameworkLibrary.default();
