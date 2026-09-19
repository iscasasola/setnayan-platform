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
): Array<{ prompt: string; hint: string }> {
  const have = new Set(all.map((q) => normalise(q.prompt)));
  return STARTER_QUESTIONS.filter((s) => !have.has(normalise(s.prompt)));
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
