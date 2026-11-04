/**
 * THE EMCEE'S QUESTIONS — pure model. (Register row DAY-7.)
 *
 * Spec: corpus `Emcee_Script_System_BUILD_SPEC_2026-07-29.md` § 8. The host
 * writes his own questions once; every couple after answers them; the answers
 * stay with that wedding. The highest-value one for a Filipino emcee is how to
 * SAY the names — a booked vendor cannot read the guest list, so the ~30
 * sponsor names he announces arrive only through this.
 *
 * THE SPLIT, restated where a later edit has to argue with it:
 * {@link VendorQuestion} carries no event id and {@link QuestionAnswer} carries
 * no question text. A couple's answer can never be cached onto the question row
 * and ride along to the next wedding — the schema (`vendor_questions` has no
 * `event_id`) enforces it, this module keeps the types honest about it.
 *
 * No Supabase, no clock, no React — a decision a test can hold down.
 */

/** One question in the host's reusable set. Carries no event, ever. */
export type VendorQuestion = {
  question_id: string;
  vendor_profile_id: string;
  prompt: string;
  hint: string | null;
  is_asked: boolean;
  display_order: number;
};

/** One couple's answer to one question, for one event. */
export type QuestionAnswer = {
  event_id: string;
  question_id: string;
  answer: string;
  updated_at: string;
};

export const QUESTION_PROMPT_MAX = 200;
export const QUESTION_HINT_MAX = 200;
export const ANSWER_MAX = 2000;

/**
 * The starting set, lifted from spec § 8's "only ask what the app cannot know".
 * Offered as one-tap additions so his first wedding is not a blank page — they
 * become HIS rows the moment he adds them, and he edits or retires them freely.
 * Deliberately absent: venue, date, headcount, names — the app already has
 * those, and "a questionnaire that asks for the venue is insulting".
 */
export const STARTER_QUESTIONS: ReadonlyArray<{ prompt: string; hint: string }> = [
  {
    prompt: 'How do you say your names — and any name I will read out loud?',
    hint: 'Spell it the way it sounds, e.g. "Nyoy = NYO-ee", "Jhoanna = jo-AH-na".',
  },
  {
    prompt: 'Who are your principal sponsors, in the order I should call them?',
    hint: 'Full names with titles — Atty., Dr., Engr., Hon., Ninang/Ninong.',
  },
  {
    prompt: 'Who should I acknowledge, and in what order?',
    hint: 'Parents, grandparents, guests who travelled far, anyone remembered tonight.',
  },
  {
    prompt: 'Is there anything I must NOT say or mention?',
    hint: 'A family situation, an ex, news not yet shared, a surprise. Only I will read this.',
  },
  {
    prompt: 'Who will give speeches or toasts, and in what order?',
    hint: 'Name and how they are related to you.',
  },
  {
    prompt: 'What language and tone do you want me to use?',
    hint: 'English, Tagalog, Bisaya, Taglish — formal, warm, or playful.',
  },
];

export type StarterQuestion = { prompt: string; hint: string };

/**
 * ❓ EVERY SUPPLIER ASKS (owner 2026-11-04, verbatim "Yes, every supplier";
 * DECISION_LOG "QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT HOSTS ONLY").
 *
 * Short starting sets per TRADE, keyed by the taxonomy's TILE key — the same
 * `WeddingTile` the code already uses everywhere (`host_mc`, `catering`…). The
 * shop's own services are resolved to tiles through the LIVE taxonomy
 * (`getTaxonomy()`, Admin › Categories is the one source) by the caller; this
 * file holds no copy of the taxonomy, only which set a tile starts from.
 *
 * Same rule as the host's set: only ask what the app cannot know. Never venue,
 * date, headcount or names-of-the-couple — the event already carries those.
 */
const COORDINATOR_STARTERS: ReadonlyArray<StarterQuestion> = [
  {
    prompt: 'Who are our two contact people on the day, and how do we reach them?',
    hint: 'Someone who is not the two of you — a sibling, a cousin, a best friend.',
  },
  {
    prompt: 'Is there anything about family we should handle quietly?',
    hint: 'Who should not sit together, a parent who must be fetched, someone unwell. Only we read this.',
  },
  {
    prompt: 'Which moments must not be missed or rushed?',
    hint: 'A dance, a surprise, a prayer, a gift from your lola.',
  },
];

const STYLIST_STARTERS: ReadonlyArray<StarterQuestion> = [
  {
    prompt: 'Which colours do you love — and any you never want to see?',
    hint: 'Name them, or say "like the photos on our mood board".',
  },
  {
    prompt: 'Any flowers or materials you love, or must avoid?',
    hint: 'Allergies, a flower with a meaning, no fresh flowers at all.',
  },
  {
    prompt: 'Who signs off on the setup on the day?',
    hint: 'The person we show the finished room to before the doors open.',
  },
];

const CATERER_STARTERS: ReadonlyArray<StarterQuestion> = [
  {
    prompt: 'Any allergies or dishes some guests cannot eat?',
    hint: 'Halal, no pork, vegetarian, nut or seafood allergies — how many, roughly.',
  },
  {
    prompt: 'Is there a family dish or flavour you want on the table?',
    hint: 'Your lola’s recipe, a dish from home, a dessert that means something.',
  },
  {
    prompt: 'Who should be served first, or served at their table?',
    hint: 'Elders, sponsors, a guest who cannot queue.',
  },
];

const PHOTO_VIDEO_STARTERS: ReadonlyArray<StarterQuestion> = [
  {
    prompt: 'Which people must be in the photos together?',
    hint: 'Family groupings, barkada, a grandparent who may leave early.',
  },
  {
    prompt: 'Any moment or detail you want us to catch?',
    hint: 'A letter, a ring, a surprise, the view from a window.',
  },
  {
    prompt: 'Is there anyone or anything we should NOT photograph?',
    hint: 'A guest who asked not to be posted, a private moment. Only we read this.',
  },
];

/** Any trade without its own set starts here. */
export const GENERIC_STARTERS: ReadonlyArray<StarterQuestion> = [
  {
    prompt: 'What matters most to you about our part of the day?',
    hint: 'In your own words — what would make you say "that was perfect".',
  },
  {
    prompt: 'Is there anything we should know before we plan?',
    hint: 'A family situation, an accessibility need, a surprise being kept.',
  },
  {
    prompt: 'Who should we talk to on the day if you are busy?',
    hint: 'Their name and how they are related to you.',
  },
];

/**
 * Tile key → its starting set. Keys are taxonomy TILE keys; a tile not named
 * here falls back to {@link GENERIC_STARTERS}. `host_mc` keeps the emcee set.
 */
export const STARTERS_BY_TILE: Readonly<Record<string, ReadonlyArray<StarterQuestion>>> = {
  host_mc: STARTER_QUESTIONS,
  coordinator: COORDINATOR_STARTERS,
  stylist_decorator: STYLIST_STARTERS,
  catering: CATERER_STARTERS,
  photo_video: PHOTO_VIDEO_STARTERS,
};

/**
 * The starting suggestions for a shop, from the tiles its services sit under
 * (resolved by the caller through the live taxonomy). A shop in several trades
 * gets each trade's set, in the shop's own order, without repeats; a shop in no
 * named trade gets the generic set. Pure.
 */
export function startersForTiles(tiles: readonly (string | null | undefined)[]): StarterQuestion[] {
  const out: StarterQuestion[] = [];
  const seen = new Set<string>();
  for (const tile of tiles) {
    const set = tile ? STARTERS_BY_TILE[tile] : undefined;
    if (!set) continue;
    for (const s of set) {
      const key = normalise(s.prompt);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out.length > 0 ? out : [...GENERIC_STARTERS];
}

/** The questions he still asks, in his order. Retired ones are kept, not asked. */
export function askedQuestions(all: readonly VendorQuestion[]): VendorQuestion[] {
  return all
    .filter((q) => q.is_asked)
    .slice()
    .sort((a, b) => a.display_order - b.display_order);
}

function normalise(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Starters he has not added yet — compared against EVERY row he owns, retired
 * included, so a starter he deliberately stopped asking is not offered back.
 */
export function startersNotYetAdded(
  all: readonly VendorQuestion[],
  starters: ReadonlyArray<StarterQuestion> = STARTER_QUESTIONS,
): Array<{ prompt: string; hint: string }> {
  const have = new Set(all.map((q) => normalise(q.prompt)));
  return starters.filter((s) => !have.has(normalise(s.prompt)));
}

export type QuestionnaireRow = {
  question: VendorQuestion;
  /** null = not answered yet. An empty string is never an answer. */
  answer: string | null;
};

export type Questionnaire = {
  rows: QuestionnaireRow[];
  answered: number;
  total: number;
};

/**
 * Pair his asked questions with this couple's answers.
 *
 * An answer to a question he has since RETIRED still shows — the couple typed
 * it for this wedding and he may still need it — but it is not counted toward
 * "still to answer", which only concerns questions he is currently asking.
 */
export function buildQuestionnaire(
  questions: readonly VendorQuestion[],
  answers: readonly QuestionAnswer[],
): Questionnaire {
  const byQuestion = new Map<string, string>();
  for (const a of answers) {
    const text = a.answer.trim();
    if (text) byQuestion.set(a.question_id, text);
  }
  const asked = askedQuestions(questions);
  const retiredButAnswered = questions
    .filter((q) => !q.is_asked && byQuestion.has(q.question_id))
    .sort((a, b) => a.display_order - b.display_order);

  const rows: QuestionnaireRow[] = [...asked, ...retiredButAnswered].map((q) => ({
    question: q,
    answer: byQuestion.get(q.question_id) ?? null,
  }));
  const answered = asked.filter((q) => byQuestion.has(q.question_id)).length;
  return { rows, answered, total: asked.length };
}

/** Trim and clamp an answer. Returns null for an empty box — which means "clear it". */
export function cleanAnswer(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return text.slice(0, ANSWER_MAX);
}
