/**
 * lib/event-answers.ts — THE ONBOARDING'S LAST ANSWERS, AND THEIR ONE HOME.
 *
 * ⚖ Owner 2026-10-02 (DECISION_LOG "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT
 * DETAILS ("YOUR INFO") — ONE HOME, MAPPED"), verbatim: *"when questions are
 * asked, and information is placed, let us place them all to there so
 * everything is mapped properly"*.
 *
 * Four answers from the onboarding's "A few more, quick" card used to land in
 * `style_preferences.setup` and be read by nothing. Each now has ONE column
 * (migration `20271260666366_answers_live_in_event_details.sql`), written at
 * the commit (`setupColumns`), shown and changed in the Maker's Your info
 * (`details-answers.tsx`, drafted like every Maker edit, live at Apply), and
 * OBEYED:
 *
 *   papic_on            → Papic: no free pool armed at the commit, the guest
 *                         camera door closed (`eventPapicGuestAccess`), no
 *                         capture taken (`eventAcceptsNewCaptures`), Home's
 *                         "Your free camera is ready" not offered.
 *   gifts_on            → the guest-facing gift reader returns none
 *                         (`fetchEgiftMethods` enabledOnly) — doors, the page,
 *                         the prints — and the Maker draws no E-Gifts part.
 *   logo_wanted         → What's left: "Make one" keeps the Logo step open
 *                         until a logo exists; "Use our names" answers it.
 *   cover_photo_wanted  → What's left: "Upload a photo" keeps the First screen
 *                         step open until a photo is up; "Theme picture" answers it.
 *
 * Pure and client-safe: no I/O, no React. The words are the onboarding card's
 * own (`setup-card.tsx` reads them from here), so the question asked once and
 * the row that changes it later can never say two different things.
 */
import type { GiftsMode } from '@/lib/event-type-profile';

export const EVENT_ANSWER_COLUMNS = ['papic_on', 'gifts_on', 'logo_wanted', 'cover_photo_wanted'] as const;
export type EventAnswerColumn = (typeof EVENT_ANSWER_COLUMNS)[number];

export function isEventAnswerColumn(v: unknown): v is EventAnswerColumn {
  return typeof v === 'string' && (EVENT_ANSWER_COLUMNS as readonly string[]).includes(v);
}

/** The answers as the onboarding engine holds them (`SetupAnswers`). */
export type SetupAnswerKeys = {
  papic: 'yes' | 'no';
  gifts: 'yes' | 'no';
  logo: 'yes' | 'no';
  photo: 'upload' | 'theme';
};

/** The onboarding's answers → their columns. Every one is an explicit answer (the card's default IS an answer). */
export function answerColumnsFromSetup(a: SetupAnswerKeys): Record<EventAnswerColumn, boolean> {
  return {
    papic_on: a.papic === 'yes',
    gifts_on: a.gifts === 'yes',
    logo_wanted: a.logo === 'yes',
    cover_photo_wanted: a.photo === 'upload',
  };
}

/**
 * Is Papic on? NULL — never asked — is ON: every event made before the
 * question existed had Papic, and nobody decided otherwise. Only an explicit
 * `false` turns it off.
 */
export function papicIsOn(v: unknown): boolean {
  return v !== false;
}

/** Are gifts on? Same rule: only an explicit "No" hides them. */
export function giftsAreOn(v: unknown): boolean {
  return v !== false;
}

/**
 * Does the commit arm the free Papic grants? Not when the couple said "No" —
 * an event whose camera is off has nothing to meter (and `eventAcceptsNewCaptures`
 * takes no capture there, so no shot can run unmetered). A caller with no
 * answers (a type the engine has not admitted) arms them, as before.
 */
export function setupArmsPapic(a: Pick<SetupAnswerKeys, 'papic'> | null | undefined): boolean {
  return a?.papic !== 'no';
}

/** Is the Logo step answered? A logo exists, or they chose their names instead. */
export function logoStepAnswered(made: boolean, wanted: unknown): boolean {
  return made || wanted === false;
}

/** Is the First screen step answered? A photo is up, or they chose a theme picture for now. */
export function coverStepAnswered(set: boolean, wanted: unknown): boolean {
  return set || wanted === false;
}

/* ══ THE WORDS — one set, read by the onboarding card AND the Your info row ══ */

export type AnswerChoice = { key: string; label: string };

const YES_NO: readonly AnswerChoice[] = [
  { key: 'yes', label: 'Yes' },
  { key: 'no', label: 'No' },
];

/** "Photos from your guests?" — a wake asks it quietly. */
export function papicQuestion(solemn: boolean): string {
  return solemn ? 'Photographs for the family?' : 'Photos from your guests?';
}

/** The gifts question in the type's own word. */
export function giftsQuestion(mode: GiftsMode): string {
  if (mode === 'abuloy') return 'Accept abuloy?';
  if (mode === 'donations') return 'Accept donations?';
  if (mode === 'ambag') return 'Collect ambag?';
  return 'Accept gifts?';
}

/** The gifts row's name in Your info — the type's own word. */
export function giftsLabel(mode: GiftsMode): string {
  if (mode === 'abuloy') return 'Abuloy';
  if (mode === 'donations') return 'Donations';
  if (mode === 'ambag') return 'Ambag';
  return 'Gifts';
}

/** The Papic row's name in Your info. */
export function papicLabel(solemn: boolean): string {
  return solemn ? 'Photographs' : 'Photos from guests';
}

export const LOGO_QUESTION = 'Do you want a logo?';

export function papicChoices(): readonly AnswerChoice[] {
  return YES_NO;
}

export function giftsChoices(): readonly AnswerChoice[] {
  return YES_NO;
}

/** "Yes, make one" · "No, use our names" — one name where the type has one person. */
export function logoChoices(twoPeople: boolean): readonly AnswerChoice[] {
  return [
    { key: 'yes', label: 'Yes, make one' },
    { key: 'no', label: twoPeople ? 'No, use our names' : 'No, use the name' },
  ];
}

export function coverQuestion(solemn: boolean): string {
  return solemn ? 'A photograph' : 'Event photo';
}

/** The photo card's two answers, as the onboarding asks them. */
export function coverChoices(solemn: boolean): readonly AnswerChoice[] {
  return [
    { key: 'upload', label: solemn ? 'Choose a photograph' : 'Upload a photo' },
    { key: 'theme', label: solemn ? 'A plain notice for now' : 'Use a theme picture for now' },
  ];
}

/**
 * A stored answer → the key its dropdown shows. Papic and gifts are ON until
 * someone says No (NULL is a real state: on). The logo and the photo are
 * questions: NULL is "not answered yet" → '' (the dropdown names no choice),
 * never a "No" nobody gave.
 */
export function answerKeyOf(column: EventAnswerColumn, v: unknown): string {
  if (column === 'cover_photo_wanted') return v === true ? 'upload' : v === false ? 'theme' : '';
  if (column === 'logo_wanted') return v === true ? 'yes' : v === false ? 'no' : '';
  return v === false ? 'no' : 'yes';
}

/** A dropdown key → the column's value. Unknown keys are refused (undefined). */
export function answerValueOf(column: EventAnswerColumn, key: string): boolean | undefined {
  if (column === 'cover_photo_wanted') return key === 'upload' ? true : key === 'theme' ? false : undefined;
  return key === 'yes' ? true : key === 'no' ? false : undefined;
}

/** The answer in words, for the navigator row's line — read from the same choices. */
export function answerSub(choices: readonly AnswerChoice[], key: string): string {
  return choices.find((c) => c.key === key)?.label ?? '';
}
