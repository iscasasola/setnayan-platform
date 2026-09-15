/**
 * THE COUPLE'S OWN WORDS ON THEIR GIFTS PAGE.
 *
 * ⚖ OWNER 2026-09-15. He wrote the sentence he wanted — *"We would love to
 * receive monetary gift so we can find the best suitable gift from everyone who
 * loves us"* — and then ruled on how it should work for everybody else: *"can we
 * provide 5 templates that we can create for people who will add messages"* and
 * *"so pick among 5 or create your own."*
 *
 * So these are STARTING POINTS, not a menu. A couple picks one, edits it, or
 * ignores them and writes their own. Nothing here is ever forced onto a page:
 * a NULL message renders the gifts page exactly as it reads today.
 *
 * ── WHY A COUPLE NEEDS THIS AT ALL ─────────────────────────────────────────
 * The page already says what to DO ("Scan a QR or copy a handle"). It could not
 * say WHY, and why is the only part a guest actually weighs. A money-gift page
 * without the couple's reason reads as a request; with it, it reads as a plan
 * they are inviting you into.
 *
 * ⛔ NO TEMPLATE ASKS FOR MONEY OUTRIGHT, and that is deliberate. Each one opens
 * by making the gift optional — presence first — because a page that opens with
 * the ask is the reason couples are embarrassed to turn this on at all.
 */
export type PabuyaTemplate = {
  /** Stable key — stored nowhere; the couple's TEXT is what is saved. */
  key: string;
  /** What the couple sees in the picker. */
  name: string;
  body: string;
};

/** The ceiling the column enforces (`events_pabuya_message_chk`). */
export const PABUYA_MESSAGE_MAX = 600;

export const PABUYA_TEMPLATES: readonly PabuyaTemplate[] = [
  {
    key: 'choose-together',
    name: 'So we can choose together',
    /* The owner's own choice for Cale & Ice. It opens by saying presence is
       enough, which stops the page reading as a request, and keeps his actual
       reason — we choose the right thing — as the justification. */
    body:
      'Your presence is the gift. But if you’d like to give more, a blessing lets us choose the one thing our new home still needs — chosen together, from all of you who love us.',
  },
  {
    key: 'plainly',
    name: 'Plainly put',
    body:
      'We’d love to receive your blessing in money, so we can choose the gift we truly need — from everyone who loves us.',
  },
  {
    key: 'our-first-home',
    name: 'Our first home',
    body:
      'We’re starting our life together in a small place with a lot of empty corners. A blessing helps us fill them slowly, with things we picked ourselves.',
  },
  {
    key: 'travelled-far',
    name: 'For those who travelled',
    body:
      'Many of you are coming a long way, and that is already more than enough. If you would still like to give, a blessing travels lighter than a box — and we’ll think of you when we use it.',
  },
  {
    key: 'no-obligation',
    name: 'No obligation at all',
    body:
      'Please don’t feel you have to give anything. Come, eat, dance with us. And if you’d like to leave a blessing, it goes toward the start of our life together.',
  },
];

/**
 * Clean a couple's message for storage.
 *
 * ⚠ TRIMMED, AND EMPTY BECOMES NULL — not an empty string. A stored `''` is a
 * message the page would render as a blank paragraph above the QR codes, which
 * reads as a layout fault rather than as "they wrote nothing". NULL is the only
 * honest way to say unset.
 */
export function cleanPabuyaMessage(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, PABUYA_MESSAGE_MAX);
}
