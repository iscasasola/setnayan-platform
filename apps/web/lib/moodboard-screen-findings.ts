/**
 * lib/moodboard-screen-findings.ts — THE VOCABULARY OF A SCREEN VERDICT (MB21).
 *
 * Zero imports, deliberately. Both renders that MB21 exists for are `'use
 * client'` components — the admin library editor and the supplier's own library
 * editor — and neither may import `lib/moodboard-gallery-upload.ts`, which
 * reaches `lib/supabase/admin.ts` through the taxonomy and turns
 * `lint-server-only-boundary` red. `lib/moodboard-gallery-pure.ts` already
 * carries the two constants MB11's FORM needed and its docblock says, in
 * capitals, that it may not grow; so the findings vocabulary gets its own file
 * under the same discipline rather than being poured into that one.
 *
 * ── WHAT MB21 CHANGED, AND THE TWO HOLES IT CLOSED ──────────────────────────
 * MB11 shipped a screen with exactly TWO outcomes: clean, or refused at the
 * door. The owner's rule has THREE:
 *
 *   QR code · any URL · any social handle · any email address · the vendor's
 *   own name, phone or logo            → HARD BLOCK, naming what was found
 *   unfamiliar name · phone-shaped digit run · logo-ish mark · heavy text
 *                                      → FLAG, and a human looks
 *   clean                              → draft, admin approval as before
 *
 * Hole 1: THE FLAG HAD NOWHERE TO LIVE. A questionable photo reached the admin
 * queue looking byte-identical to a clean one, so "send it to a human" was a
 * sentence with no mechanism behind it.
 *
 * Hole 2: A REJECTION TOLD THE VENDOR NOTHING. Admin could approve, retire or
 * delete; retiring hid the photo and the supplier's own editor went on saying
 * "draft (pending review)" forever, with no reason and nothing to fix.
 *
 * 🛑 "NO NAMES" IS NOT A BLOCK, AND THAT IS THE OWNER'S RULE, NOT A SOFTENING.
 * A very large share of legitimate inspiration photographs carry the couple's
 * names BY DESIGN — on the backdrop, the welcome sign, the monogram, the stage
 * lettering. Blocking names outright would gut the `backdrop` and `stage`
 * shelves. Names go to the queue. The same reasoning is why a phone-SHAPED
 * digit run flags rather than blocks: `lib/moodboard-gallery-upload.ts`'s
 * docblock already records the false positives a generic detector produces —
 * a table number, a date on signage, a price on a menu card, the couple's own
 * mobile on their own save-the-date.
 *
 * 🔑 SEVERITY IS A `Record` OVER THE FULL UNION. A new hit kind is a COMPILE
 * ERROR here until somebody says whether it bounces a supplier or asks a human
 * — which is the one question this whole session is about, and not a thing to
 * let default.
 */

/* ══════════════════════════════════════════════════════════════════════════
   1 · WHAT A CHECK CAN FIND
   ══════════════════════════════════════════════════════════════════════════ */

/** What a content check found. `label` is what a human is told we saw. */
export type ContentHitKind =
  // ── the hard blocks ──────────────────────────────────────────────────────
  | 'qr_code'
  | 'business_name'
  | 'phone'
  | 'email'
  | 'website'
  | 'social_handle'
  | 'own_logo'
  // MB21 widened these three from "this shop's own value" to "any at all".
  // A stranger's Instagram handle printed on a styled shoot takes the couple
  // off Setnayan exactly as effectively as the uploader's own would.
  | 'any_url'
  | 'any_email'
  | 'any_social_handle'
  // ── the flags: a human decides ───────────────────────────────────────────
  | 'unfamiliar_name'
  | 'phone_shaped'
  | 'logo_mark'
  | 'heavy_text';

export type ContentHit = {
  kind: ContentHitKind;
  /** The vendor-facing name of the thing, e.g. "your phone number". */
  label: string;
  /** What we actually matched, echoed back so it can be found in the photo. */
  found: string;
};

export const HIT_LABEL: Readonly<Record<ContentHitKind, string>> = {
  qr_code: 'a QR code',
  business_name: 'your shop’s name',
  phone: 'your phone number',
  email: 'your email address',
  website: 'your website address',
  social_handle: 'your social handle',
  own_logo: 'your shop’s logo',
  any_url: 'a web address',
  any_email: 'an email address',
  any_social_handle: 'a social media handle',
  unfamiliar_name: 'a name',
  phone_shaped: 'a number that reads like a phone number',
  logo_mark: 'a logo-style mark',
  heavy_text: 'a lot of printed text',
};

export type ContentHitSeverity = 'block' | 'flag';

/**
 * 🛑 THE OWNER'S TABLE, AS CODE. Every entry below is a decision about whether
 * an honest supplier gets bounced. Read the three flag rows before changing
 * any of them: each is a thing that is USUALLY the design of the photograph.
 */
export const HIT_SEVERITY: Readonly<Record<ContentHitKind, ContentHitSeverity>> = {
  qr_code: 'block',
  business_name: 'block',
  phone: 'block',
  email: 'block',
  website: 'block',
  social_handle: 'block',
  own_logo: 'block',
  any_url: 'block',
  any_email: 'block',
  any_social_handle: 'block',
  // A couple's names on their own backdrop. The design itself.
  unfamiliar_name: 'flag',
  // A table number, a date, a menu price, the couple's own mobile.
  phone_shaped: 'flag',
  // A graphic badge the whole-image pHash cannot match — MB11 named this exact
  // residue and said it reaches the queue. Now it reaches it wearing a label.
  logo_mark: 'flag',
  // A menu, an order of service, a seating chart. Legitimate, and worth a look.
  heavy_text: 'flag',
};

/**
 * The kinds whose MESSAGE echoes what was found, not only what kind it was.
 *
 * "We found your phone number" is actionable — the supplier knows which number
 * is theirs. "We found a web address" is not: on a styled shoot with three
 * signs the supplier has to guess. So the widened blocks name the string.
 * The own-value kinds keep their MB11 wording byte-for-byte, because the
 * vendor already knows their own phone number and the sentence was tested.
 */
const ECHOES_WHAT_IT_FOUND: ReadonlySet<ContentHitKind> = new Set<ContentHitKind>([
  'any_url',
  'any_email',
  'any_social_handle',
]);

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE THREE OUTCOMES
   ══════════════════════════════════════════════════════════════════════════ */

export type ScreenOutcome = 'clean' | 'flagged' | 'blocked';

export function blockingHits(hits: readonly ContentHit[]): ContentHit[] {
  return hits.filter((h) => HIT_SEVERITY[h.kind] === 'block');
}

export function flaggedHits(hits: readonly ContentHit[]): ContentHit[] {
  return hits.filter((h) => HIT_SEVERITY[h.kind] === 'flag');
}

/**
 * One verdict over a mixed bag of hits. A block outranks a flag: there is no
 * point queueing for a human a photo the supplier is about to be handed back.
 */
export function screenOutcome(hits: readonly ContentHit[]): ScreenOutcome {
  if (blockingHits(hits).length > 0) return 'blocked';
  if (flaggedHits(hits).length > 0) return 'flagged';
  return 'clean';
}

/** Whether the text read actually ran. A check that did not run is not a pass. */
export type TextScreenStatus = 'ran' | 'unavailable';

/* ══════════════════════════════════════════════════════════════════════════
   3 · WHAT GETS STORED, AND HOW IT IS READ BACK
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `moodboard_library_assets.screen_findings`, as JSON.
 *
 * ⚠ IT CARRIES THE TRANSCRIBED TEXT, and that is the point rather than an
 * oversight: an admin looking at a flag needs to see the words the judgement
 * was made from, or the flag is a shrug. The column is REVOKED from `anon` and
 * `authenticated` in the same migration that adds it — see that migration's
 * grant block for why a new column's inherited grant is the real hazard.
 */
export type ScreenFindings = {
  outcome: ScreenOutcome;
  hits: ContentHit[];
  /** Every legible string the model read. '' = the photo carries no text. */
  text: string;
  textScreen: TextScreenStatus;
  /** ISO timestamp of the screen that produced this. */
  screenedAt: string;
};

function isHitKind(value: unknown): value is ContentHitKind {
  return typeof value === 'string' && Object.hasOwn(HIT_SEVERITY, value);
}

/**
 * Read a `screen_findings` value back into a typed shape, or null.
 *
 * 🔑 TOTAL, NEVER THROWING, AND NEVER FABRICATING. This parses a JSONB column
 * whose rows were written by earlier versions of this code: an unknown hit
 * kind is DROPPED rather than rendered with `undefined` as its label, and a
 * malformed row returns null so the render falls back to "no findings recorded"
 * instead of crashing an admin page over one bad photo.
 */
export function parseScreenFindings(value: unknown): ScreenFindings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const hits: ContentHit[] = Array.isArray(raw.hits)
    ? raw.hits
        .filter(
          (h): h is Record<string, unknown> =>
            Boolean(h) && typeof h === 'object' && !Array.isArray(h),
        )
        .filter((h) => isHitKind(h.kind))
        .map((h) => ({
          kind: h.kind as ContentHitKind,
          label:
            typeof h.label === 'string' && h.label
              ? h.label
              : HIT_LABEL[h.kind as ContentHitKind],
          found: typeof h.found === 'string' ? h.found : '',
        }))
    : [];
  const outcome =
    raw.outcome === 'blocked' || raw.outcome === 'flagged' || raw.outcome === 'clean'
      ? raw.outcome
      : screenOutcome(hits);
  return {
    outcome,
    hits,
    text: typeof raw.text === 'string' ? raw.text : '',
    textScreen: raw.textScreen === 'ran' ? 'ran' : 'unavailable',
    screenedAt: typeof raw.screenedAt === 'string' ? raw.screenedAt : '',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE TWO SENTENCES A HUMAN READS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 🛑 THE REJECTION NAMES WHAT WAS FOUND. This is the whole difference between
 * a gate a vendor can clear and a wall they bounce off forever.
 *
 * The failure this repo keeps re-learning is a measurement that never reaches
 * the render: an upload refused with "invalid image" tells the supplier
 * nothing, so they re-upload the same photo, or give up and conclude Setnayan
 * is broken. Naming the thing — "we found your phone number in this photo" —
 * turns a block into an instruction they can act on in one minute.
 *
 * Nobody is banned, nothing is deleted, and the photo is never quietly
 * dropped: the upload simply does not happen and the vendor is told why.
 *
 * ⚠ FLAGS ARE NOT IN THIS SENTENCE, BY CONSTRUCTION. It filters to the blocking
 * hits, so a photo that is merely questionable never produces a refusal message
 * — it uploads, and a human looks. Handing this function every hit and letting
 * the caller decide was the other option and it is worse: one caller forgetting
 * the filter turns the couple's names into a wall.
 */
export function contentRejectionMessage(hits: readonly ContentHit[]): string {
  const blocking = blockingHits(hits);
  if (blocking.length === 0) return '';
  const named = blocking.map((h) =>
    ECHOES_WHAT_IT_FOUND.has(h.kind) && h.found ? `${h.label} (${h.found})` : h.label,
  );
  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;

  const fix = blocking.some((h) => h.kind === 'qr_code')
    ? 'Couples find your shop through the credit we print under the photo, so a QR code in the picture is never needed. Upload a version without it and it will go straight through.'
    : 'Upload a clean version without it — your shop is already credited under every photo, so couples can still find you.';

  return `We can’t add this photo yet: we found ${list} in it. ${fix}`;
}

/**
 * The sentence the SUPPLIER reads when a human refused their photo.
 *
 * Worded like the hard-block messages on purpose — a supplier should not have
 * to learn two vocabularies for "this photo cannot go up". The admin supplies
 * the clause; this supplies the frame, so no admin has to remember to write a
 * full sentence and no supplier gets a bare fragment.
 *
 * Returns '' for an empty reason rather than "We couldn’t publish this: ." —
 * the DB CHECK refuses a blank reason beside a rejection, but a render must not
 * depend on a constraint it cannot see.
 */
export function rejectionSentence(reason: string | null | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) return '';
  const closed = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return `We couldn’t publish this: ${closed}`;
}
