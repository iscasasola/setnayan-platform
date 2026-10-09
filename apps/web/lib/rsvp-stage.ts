/**
 * apps/web/lib/rsvp-stage.ts
 *
 * 🗳 THE RSVP STAGE — the Maker's own stage for the reply (owner 2026-09-30,
 * DECISION_LOG "THE MAKER RE-PLAN — SPEED FIRST…": the top nav is
 * `Details | Save the Date · RSVP · Invitation · The Day · Post Event | Prints`,
 * and "RE-PLAN REVISIONS…": *"RSVP has a different parts. the RSVP, after they
 * Submit, or when they declined"*).
 *
 * Three scenes, each the REAL guest page drawn for a SAMPLE guest in the canvas
 * (host-verified `?editor=1` — never a real guest, nothing written):
 *
 *   1 · RSVP               — the form (`/{slug}/invite/reply`), one-question mode included;
 *   2 · When yes  — the attending thank-you (`/{slug}/invite/enter?as=attending`);
 *   3 · When no   — its own screen (`/{slug}/invite/enter?as=declined`).
 *
 * ⚡ EVERY EDIT IS ON THE CANVAS BEFORE IT SAVES (owner 2026-09-30: *"make sure
 * what we rebuild is fast and realtime and changes instantly"*). The panel
 * announces the whole config on every change (`RSVP_PREVIEW_EVENT`); the stage
 * turns it into the editor bridge's own messages (`rsvpPreviewMessages`) and
 * posts them into the frame, which lays them on the page it already drew
 * (`app/[slug]/_components/rsvp-canvas-bridge.tsx`). The save runs behind it,
 * batched, and asks for no render (`lib/maker-refresh.ts`, `held`).
 *
 * Pure — no I/O, no React — so a test holds the scenes, the addresses and the
 * messages.
 */
import {
  RSVP_ASK_FIELDS,
  RSVP_WORD_KEYS,
  readOneAtATime,
  rsvpAnswerWord,
  rsvpAsks,
  type RsvpAskConfig,
  type RsvpAskField,
  type RsvpWordKey,
} from './rsvp-ask';
import { RSVP_BRIDGE_SOURCE, rsvpWordBridgeKey } from './rsvp-stage-shared';
import { RSVP_LOOK_MESSAGE } from './rsvp-stage-shared';

export * from './rsvp-stage-shared';

export type RsvpStageScene = 'form' | 'thanks' | 'decline';

/** The three scenes, in the order a guest meets them — the navigator's list. */
export const RSVP_STAGE_SCENES: ReadonlyArray<{ key: RsvpStageScene; label: string; tab: string; sub: string }> = [
  /* 📑 Named as the owner approved them (2026-10-05, DECISION_LOG "APPROVED —
     EVERY GUEST PAGE'S DEFAULT SECTION ORDER"): RSVP form · When yes · When no.
     `tab` is the word on the Stages page tabs — the prototype's short name
     (`PAGE_SHORT`: "RSVP form" → "Form"), under the stage's own name. */
  { key: 'form', label: 'RSVP form', tab: 'Form', sub: 'The form your guests fill in' },
  { key: 'thanks', label: 'When yes', tab: 'When yes', sub: 'The thank-you, with their Digital tickets' },
  { key: 'decline', label: 'When no', tab: 'When no', sub: 'What a guest who can’t come sees' },
];

export function isRsvpStageScene(v: unknown): v is RsvpStageScene {
  return v === 'form' || v === 'thanks' || v === 'decline';
}

/**
 * The address a scene's canvas loads — the SAME host-only canvas door every
 * Maker canvas uses (`?editor=1`, verified on the guest page; a stranger's
 * `?editor=1` or `?as=` is ignored there). Null before the event has an
 * address.
 */
export function rsvpStageCanvasSrc(publicLandingUrl: string | null, scene: RsvpStageScene): string | null {
  if (!publicLandingUrl) return null;
  if (scene === 'form') return `${publicLandingUrl}/invite/reply?editor=1`;
  return `${publicLandingUrl}/invite/enter?editor=1&as=${scene === 'thanks' ? 'attending' : 'declined'}`;
}

/** Which words each scene's controls edit. */
export const RSVP_SCENE_WORDS: Record<RsvpStageScene, readonly RsvpWordKey[]> = {
  form: ['attending', 'declined'],
  thanks: ['thanksHeading', 'thanksMessage'],
  decline: ['declineHeading', 'declineMessage'],
};

/** The panel's label for each word. */
/**
 * PREMADE LINES — "type your own, or pick one". ONLY words that already exist
 * (owner 2026-09-30, "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE": no invented
 * presets): the answers are the lines the owner's own ruling lists ("RSVP
 * ANSWERS: THE COUPLE RENAMES…": "Joyfully accepts" · "Wouldn't miss it" ·
 * "Count me in" / "Regretfully declines" · "Sadly can't make it"), and the
 * screens after a reply offer only the words those screens and the reply card
 * already print. A key with no shipped line offers none — type your own.
 *
 * HERE, not in `lib/rsvp-ask.ts`: that file is read by the Maker's first load (`lib/hub-draft.ts`), and only the lazy
 * RSVP panel reads these.
 */
export const RSVP_WORD_LINES: Record<RsvpWordKey, { celebrate: readonly string[]; solemn: readonly string[] }> = {
  attending: { celebrate: ['Joyfully accepts', 'Wouldn’t miss it', 'Count me in'], solemn: ['Will be there'] },
  declined: { celebrate: ['Regretfully declines', 'Sadly can’t make it'], solemn: ['Unable to come'] },
  thanksHeading: { celebrate: ['See you there!'], solemn: ['Thank you'] },
  thanksMessage: {
    celebrate: ['Your place is reserved — we can’t wait to celebrate with you.'],
    solemn: ['Your place is noted — thank you for being with the family.'],
  },
  declineHeading: { celebrate: ['Thank you — you’ll be missed'], solemn: ['Thank you'] },
  declineMessage: { celebrate: [], solemn: [] },
  /* The form's three lines have ONE shipped wording each — the card's own, which "Automatic" already is. */
  eyebrow: { celebrate: [], solemn: [] },
  question: { celebrate: [], solemn: [] },
  hint: { celebrate: [], solemn: [] },
};

export const RSVP_WORD_LABEL: Record<RsvpWordKey, string> = {
  attending: 'Yes answer',
  declined: 'No answer',
  thanksHeading: 'Heading',
  thanksMessage: 'Message',
  declineHeading: 'Heading',
  declineMessage: 'Message',
  eyebrow: 'Eyebrow',
  question: 'Question',
  hint: 'Hint',
};

/* ── The editor bridge's messages (parent → frame, frame → parent) ────────── */

export type RsvpBridgeMessage =
  | { source: typeof RSVP_BRIDGE_SOURCE; t: 'words'; key: string; text: string }
  | { source: typeof RSVP_BRIDGE_SOURCE; t: 'rsvpAsk'; ask: Record<RsvpAskField, boolean>; oneAtATime: boolean }
  | { source: typeof RSVP_BRIDGE_SOURCE; t: typeof RSVP_LOOK_MESSAGE; look: Record<string, unknown> };

/**
 * What the frame is told for one config — the words (`t:'words'`, the bridge's
 * own message for text, one per word) and the form's switches (`t:'rsvpAsk'`).
 * A word the couple has not typed is sent as today's wording (the answers) or
 * as `''` (a heading goes back to the page's own headline; a message hides).
 */
export function rsvpPreviewMessages(config: RsvpAskConfig, solemn: boolean): RsvpBridgeMessage[] {
  const words = config.words ?? {};
  const out: RsvpBridgeMessage[] = RSVP_WORD_KEYS.map((key) => ({
    source: RSVP_BRIDGE_SOURCE,
    t: 'words' as const,
    key: rsvpWordBridgeKey(key),
    text: key === 'attending' || key === 'declined' ? rsvpAnswerWord(words, key, solemn) : (words[key] ?? ''),
  }));
  const ask = {} as Record<RsvpAskField, boolean>;
  for (const field of RSVP_ASK_FIELDS) ask[field] = rsvpAsks(config, field);
  out.push({ source: RSVP_BRIDGE_SOURCE, t: 'rsvpAsk', ask, oneAtATime: readOneAtATime(config) });
  /* 🎨 Each line's look — the RAW object: the page reads it strictly (`readRsvpLook`) and redraws its one `<style>`. */
  out.push({ source: RSVP_BRIDGE_SOURCE, t: RSVP_LOOK_MESSAGE, look: config.look ?? {} });
  return out;
}

/** "Please reply by 18 November." — the reply page's own sentence, for a date the couple just picked. */
export function rsvpReplyByLine(ymd: string | null): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const label = new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-PH', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return `Please reply by ${label}.`;
}

