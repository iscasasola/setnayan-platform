/**
 * service-card-check-copy.ts — the words a supplier reads when a card cannot be created yet.
 *
 * Drawn in the approved v2 prototype (corpus prototypes/service_card_checks_2026-10-26/index.html; PLAN §1–§3):
 * one message under the row it concerns — a title and one short line — and a status line that counts and jumps.
 * Pure, so the words are unit-tested, and the server's refusal reads the SAME title + line as the maker.
 *
 * 🔒 Never "flag", "fraud", "scam", "violation"; a photo on another shop's card names ANOTHER service card, never
 * which shop; a photo on the supplier's own card names that card (they can see it themselves).
 */
import type { CardProblem } from './service-card-checks';

export type ProblemCopy = {
  title: string;
  line: string;
  /** Phrases to mark inside the title (the claim words themselves). */
  marks?: string[];
  /** "It's mine — report it" — only for a photo on another shop's card that is not reported yet. */
  report?: { flagId: number };
};

/** “Guaranteed” · “Guaranteed” and “#1” · “Guaranteed”, “#1” and “Official”. */
export function quotedList(words: readonly string[]): string {
  const q = words.map((w) => `“${w.charAt(0).toUpperCase()}${w.slice(1)}”`);
  if (q.length <= 1) return q[0] ?? '';
  return `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
}

export function problemCopy(p: CardProblem): ProblemCopy {
  switch (p.code) {
    case 'words':
      return {
        title: `${quotedList(p.hits)} ${p.hits.length === 1 ? 'reads' : 'read'} as a promise`,
        line: 'Say what you do instead — couples take these as guarantees we can’t stand behind.',
        marks: p.hits.map((h) => `“${h.charAt(0).toUpperCase()}${h.slice(1)}”`),
      };
    case 'service':
      return {
        title: `This reads like ${p.matchedLabel}, not ${p.filedLabel}`,
        line: 'Change the service above, or the name below.',
      };
    case 'photo': {
      const a = p.answer;
      if (a.status === 'own_card') {
        return {
          title: `Already on your card “${a.title}”`,
          line: 'Use a different photo here — each card gets its own.',
        };
      }
      if (a.status === 'other_card') {
        if (a.reported) {
          return {
            title: 'Reported — thank you',
            line: 'We’ll look at who used it first and tell you here. To create this card now, use a different photo.',
          };
        }
        return {
          title: 'This photo is already on another service card',
          line: 'Use a different one — a photo belongs to one card.',
          report: a.flagId !== null ? { flagId: a.flagId } : undefined,
        };
      }
      if (a.status === 'checking') return { title: 'Checking the photo…', line: 'This takes a moment.' };
      return {
        title: 'We couldn’t check this photo just now',
        line: 'Take it out and add it again, or try again in a moment.',
      };
    }
    case 'unavailable':
      return {
        title: 'We couldn’t finish the check just now',
        line: 'Reload the page in a moment — the card can be created once it has been checked.',
      };
  }
}

/** The status line under the card: the count, and a jump. Only blockers are counted. */
export function checkStatusLine(count: number, isEdit: boolean): { title: string; line: string } | null {
  if (count <= 0) return null;
  const verb = isEdit ? 'save' : 'create';
  return {
    title: `${count} ${count === 1 ? 'thing' : 'things'} to fix before you can ${verb}`,
    line: 'Tap to go to the first',
  };
}

/** The server's refusal — the first problem's own words, so the save says what the maker says. */
export function refusalSentence(problems: readonly CardProblem[]): string | null {
  const first = problems[0];
  if (!first) return null;
  if (first.code === 'unavailable') return 'We couldn’t finish the check just now, so nothing was saved. Try again in a moment.';
  const c = problemCopy(first);
  return `${c.title}. ${c.line}`;
}
