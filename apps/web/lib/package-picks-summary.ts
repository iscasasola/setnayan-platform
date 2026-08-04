/**
 * THE BUILD, AS A MESSAGE — a display-only serialization of what a couple
 * configured in the package lock modal, so they can ASK about it instead of
 * paying for it — plus what to TELL THEM when that message does not land.
 *
 * Pure module — no React, no env, no clock, no I/O. Runs under `tsx --test`.
 *
 * ── WHY THIS IS A SERIALIZER AND NOT A PRICER ───────────────────────────────
 * 🚨 NOTHING HERE COMPUTES MONEY. Every peso figure in the output is a number
 * this module was HANDED, having already been rendered on the couple's screen:
 *
 *   · `bookingTotalCentavos` is `choiceTotals(...).bookingTotalCentavos` — the
 *     footer's "Total package", which `lib/package-choice-tree.ts` gets from the
 *     same `priceCustomizedPackage` the lock action commits with.
 *   · `surchargeCentavos` is the footer's "Upgrades picked" line.
 *   · a per-option `+₱X` is `option.price_delta_centavos` formatted with
 *     `formatCentavosPhp` — the exact string the option row printed.
 *
 * A second pricer for the message would be the worst possible bug on this
 * surface: the vendor would read a total the couple never saw. So the rule is
 * literal — if a number is not already on screen, it is not in the message.
 *
 * ── 🪞 ANNOTATION PARITY: THE MESSAGE MAY NOT SAY MORE THAN THE SCREEN ───────
 * An earlier cut of this module annotated every pick outside the chargeable
 * region with "(your vendor quotes this)". That was WRONG, and wrong in the
 * expensive direction: a picked follow-up option, or a second pick on a
 * pick-N line, is by construction a ZERO-delta option — `isOptionSelectable`
 * (lib/package-choice-tree.ts) refuses to offer a priced one there precisely so
 * that a preference is GENUINELY FREE. The modal renders such a pick with no
 * note at all (owner 2026-07-28: "a ₱0 option shows NOTHING"), so annotating it
 * here invited the vendor to quote for something the couple's screen presented
 * as included — and contradicted the choice tree's own contract.
 *
 * The rule now mirrors the modal's option row EXACTLY, and nothing else:
 *
 *     screen:   {!selectable || delta > 0 ? (!selectable ? 'Ask your vendor…'
 *                                                        : `+₱delta`) : null}
 *     message:  delta > 0 ? `(+₱delta)` : (nothing)
 *
 * The two agree because a PICKED option is always `selectable` —
 * `isOptionSelectable` returns true for anything already in the selection, so
 * the "Ask your vendor — not part of this total" branch is unreachable for a
 * pick. The only surviving "your vendor quotes" note is the EXTRA-HOURS line,
 * where the modal says exactly that ("your vendor quotes these") on screen.
 * `lib/package-picks-summary.test.ts` pins this parity; do not add an
 * annotation here without adding the same one to the modal.
 *
 * ── AND IT IS AN ESTIMATE, OUT LOUD ─────────────────────────────────────────
 * `formatPackagePicksBlock` always closes with the estimate line. Nothing in
 * this path charges anything: the couple is opening a conversation, and the
 * vendor confirms the price in their reply. Do not remove that line to make the
 * block shorter.
 *
 * Money is BIGINT CENTAVOS on the way in, formatted strings on the way out.
 */

import {
  formatCentavosPhp,
  type VendorPackageItemRow,
} from './vendor-packages';
import {
  extraHoursOn,
  pickedOptionsOn,
  type ChoiceSelection,
} from './package-choice-tree';

/* ──────────────────────────────────────────────────────────────────────── */
/* The serialized shape                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

/** One option the couple picked, with the delta EXACTLY as the screen showed it. */
export type PackagePickOption = {
  label: string;
  /**
   * "+₱3,500", or null when the option costs nothing extra — in which case the
   * message says NOTHING about it, because the screen says nothing about it
   * either (owner 2026-07-28: a ₱0 option shows NOTHING). See the annotation-
   * parity note in the module header: there is deliberately no "vendor quotes
   * this" flag on an option, because a pick outside the chargeable region is
   * always free and the modal presents it as such.
   */
  deltaLabel: string | null;
};

/** One line of the build, in screen order. */
export type PackagePickLine = {
  label: string;
  /** 0 = a top-level line; deeper = a follow-up revealed by the pick above it. */
  depth: number;
  options: PackagePickOption[];
  /** Extra hours requested on an hourly line. 0 = none / not an hourly line. */
  extraHours: number;
};

/**
 * The whole build, ready to be sent. Plain JSON on purpose: this crosses the
 * client→server action boundary, so nothing in it may be a class, a Set or a
 * function.
 */
export type PackagePicksSummary = {
  packageName: string;
  lines: PackagePickLine[];
  /** Labels of the lines the couple unticked. */
  removed: string[];
  /** Formatted "Total package", or null when the pricer refused (the modal
   *  blocks its own CTA in that case, and the block simply omits a total). */
  totalLabel: string | null;
  /** Formatted "Upgrades picked", or null when there is no surcharge. */
  upgradesLabel: string | null;
};

/* ──────────────────────────────────────────────────────────────────────── */
/* The builder — reads the SAME state the modal renders from                */
/* ──────────────────────────────────────────────────────────────────────── */

export type BuildPackagePicksArgs = {
  packageName: string;
  /**
   * `visibleLineTree(pkg, removedIds, selection)` — the lines the couple can
   * actually see, in screen order, with their nesting depth. Passing the tree
   * rather than the package is what guarantees the message lists exactly the
   * lines the screen listed: a follow-up nobody revealed is not in the tree, so
   * it cannot be in the message. Since removal became reversible (2026-07-29),
   * the tree also carries UNTICKED roots marked `removed: true` — those render
   * on screen only so they can be re-ticked, and this builder keeps them out of
   * the build lines (they appear under `removed` instead).
   */
  lines: ReadonlyArray<{ item: VendorPackageItemRow; depth: number; removed?: boolean }>;
  /**
   * `pkg.items` — handed over WHOLE, never pre-filtered by the caller.
   *
   * The only thing resolved from it here is the label of a line the couple
   * unticked, which `visibleLineTree` has already dropped from `lines` (a
   * removed root is not visible). Doing that resolution inside this tested
   * module is deliberate: `package-followup-not-priced.test.ts` pins that the
   * lock modal never filters `pkg.items` itself, because a second local notion
   * of "which lines count" is exactly how an add-on got back onto a list the
   * couple could tick.
   */
  allItems: ReadonlyArray<VendorPackageItemRow>;
  /** The item ids the couple unticked (the modal's own `removedIds` state). */
  removedItemIds: ReadonlyArray<string>;
  selection: ChoiceSelection;
  /** `choiceTotals(...).bookingTotalCentavos`, or null when the pricer refused. */
  bookingTotalCentavos: number | null;
  /** The footer's "Upgrades picked" figure. 0 = no surcharge line. */
  surchargeCentavos: number;
};

export function buildPackagePicksSummary(
  args: BuildPackagePicksArgs,
): PackagePicksSummary {
  const removedIds = new Set(args.removedItemIds ?? []);

  // Removed roots now stay in the visible tree (marked) so the couple can
  // re-tick them — but they are NOT part of the build. They belong only in
  // `removed` below; mapping them here would advertise picks on a line the
  // couple explicitly unticked.
  const lines: PackagePickLine[] = (args.lines ?? [])
    .filter((line) => !line.removed)
    .map(({ item, depth }) => {
    const picked = pickedOptionsOn(item, args.selection);
    return {
      label: lineLabel(item),
      depth: Number.isSafeInteger(depth) && depth > 0 ? depth : 0,
      options: picked.map((opt) => ({
        label: String(opt.option_label ?? '').trim() || 'Option',
        // 🪞 PARITY WITH THE OPTION ROW, and nothing beyond it: the modal shows
        // `+₱delta` when the delta is above zero and shows NOTHING otherwise.
        // A picked option is always `selectable`, so the screen's other branch
        // ("Ask your vendor — not part of this total") cannot apply to a pick,
        // and neither may the message. See the module header.
        deltaLabel:
          opt.price_delta_centavos > 0
            ? `+${formatCentavosPhp(opt.price_delta_centavos)}`
            : null,
      })),
      extraHours: extraHoursOn(item, args.selection),
    };
  });

  return {
    packageName: String(args.packageName ?? '').trim() || 'Package',
    lines,
    // Package display order, not click order — so two couples who unticked the
    // same two lines send the vendor the same sentence.
    removed: (args.allItems ?? [])
      .filter((i) => removedIds.has(i.item_id))
      .map(lineLabel),
    totalLabel:
      args.bookingTotalCentavos != null && Number.isFinite(args.bookingTotalCentavos)
        ? formatCentavosPhp(args.bookingTotalCentavos)
        : null,
    upgradesLabel:
      Number.isFinite(args.surchargeCentavos) && args.surchargeCentavos > 0
        ? `+${formatCentavosPhp(args.surchargeCentavos)}`
        : null,
  };
}

function lineLabel(item: VendorPackageItemRow): string {
  return String(item?.service_description ?? '').trim() || 'Item';
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The sanitizer — this shape arrives from a browser                        */
/* ──────────────────────────────────────────────────────────────────────── */

/** Caps. A build is a short list; anything past these is not a build. */
const MAX_LINES = 80;
const MAX_OPTIONS_PER_LINE = 20;
const MAX_REMOVED = 80;
const MAX_LABEL_CHARS = 200;

/**
 * Coerce whatever the client sent into a summary we are willing to render into
 * a chat message, or null when there is nothing worth saying.
 *
 * This is DISPLAY DATA arriving from a browser, so it is treated exactly like
 * the couple's freeform special-request note: trimmed, length-capped, and
 * structurally forced into shape. It is never re-priced and never trusted as a
 * money input — no caller of this module writes a peso figure anywhere.
 */
export function sanitizePackagePicks(raw: unknown): PackagePicksSummary | null {
  if (!isPlainObject(raw)) return null;
  const packageName = clampText(raw.packageName);
  const lines = toArray(raw.lines)
    .slice(0, MAX_LINES)
    .map((l): PackagePickLine | null => {
      if (!isPlainObject(l)) return null;
      const label = clampText(l.label);
      if (!label) return null;
      const depthRaw = typeof l.depth === 'number' ? Math.floor(l.depth) : 0;
      const hoursRaw = typeof l.extraHours === 'number' ? Math.floor(l.extraHours) : 0;
      return {
        label,
        depth: Number.isSafeInteger(depthRaw) && depthRaw > 0 ? Math.min(depthRaw, 5) : 0,
        options: toArray(l.options)
          .slice(0, MAX_OPTIONS_PER_LINE)
          .map((o): PackagePickOption | null => {
            if (!isPlainObject(o)) return null;
            const optLabel = clampText(o.label);
            if (!optLabel) return null;
            return { label: optLabel, deltaLabel: clampText(o.deltaLabel) || null };
          })
          .filter((o): o is PackagePickOption => o !== null),
        extraHours: Number.isSafeInteger(hoursRaw) && hoursRaw > 0 ? hoursRaw : 0,
      };
    })
    .filter((l): l is PackagePickLine => l !== null);

  const removed = toArray(raw.removed)
    .slice(0, MAX_REMOVED)
    .map(clampText)
    .filter((s) => s.length > 0);

  // Nothing to say → say nothing. A couple who opened the modal and sent
  // immediately still has lines (the package's own inclusions), so an empty
  // result here means the payload was junk, not that the build was empty.
  if (lines.length === 0 && removed.length === 0) return null;

  return {
    packageName: packageName || 'Package',
    lines,
    removed,
    totalLabel: clampText(raw.totalLabel) || null,
    upgradesLabel: clampText(raw.upgradesLabel) || null,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function clampText(v: unknown): string {
  if (typeof v !== 'string') return '';
  // Collapse newlines: a label is one line in a bulleted block, and a pasted
  // multi-line string would break the block's shape.
  return v.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_CHARS);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The message block                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * The estimate disclaimer. ALWAYS present — nothing on this path charges
 * anything, and the vendor is the one who confirms the price.
 */
export const PACKAGE_PICKS_ESTIMATE_NOTE =
  'This total is an estimate from the package screen — please confirm the final price.';

/**
 * Character budget for the rendered block.
 *
 * `sendChatMessageCore` rejects a body over 4,000 characters outright
 * (`too_long`), and this block rides alongside the intro line, the couple's
 * requirements block and the bundle ask. A 40-line catering package with long
 * option labels can clear that on its own, and the failure mode would be the
 * whole build bouncing — so the block bounds ITSELF and says out loud that it
 * was shortened, rather than silently costing the couple their message.
 */
const MAX_BLOCK_CHARS = 2400;

/**
 * Render the summary as the block appended to the inquiry message body, in the
 * same shape as `buildRequirementsBlock`'s "What we're looking for" (leading
 * blank line, an em-dashed heading, then bullets) so a thread that carries both
 * reads as one message rather than two pasted ones.
 *
 * Returns '' when there is nothing to render, so callers can concatenate it
 * unconditionally.
 */
export function formatPackagePicksBlock(
  summary: PackagePicksSummary | null | undefined,
): string {
  if (!summary) return '';
  if (summary.lines.length === 0 && summary.removed.length === 0) return '';

  const out: string[] = ['', '— The build we put together —', `Package: ${summary.packageName}`];

  // Budgeted so the block can never be the reason the whole message bounces.
  // Whole LINES are dropped (never a half-rendered one), the tail is counted,
  // and the couple is told the list was shortened.
  let used = out.join('\n').length;
  let dropped = 0;
  for (const line of summary.lines) {
    const indent = '  '.repeat(Math.min(line.depth, 5));
    const rendered: string[] = [`${indent}• ${line.label}`];
    for (const opt of line.options) {
      // No delta ⇒ no annotation, exactly as the option row renders it.
      const suffix = opt.deltaLabel ? ` (${opt.deltaLabel})` : '';
      rendered.push(`${indent}  → ${opt.label}${suffix}`);
    }
    if (line.extraHours > 0) {
      rendered.push(
        `${indent}  → ${line.extraHours} extra hour${line.extraHours === 1 ? '' : 's'} (your vendor quotes these)`,
      );
    }
    const cost = rendered.reduce((n, l) => n + l.length + 1, 0);
    if (used + cost > MAX_BLOCK_CHARS) {
      dropped += 1;
      continue;
    }
    used += cost;
    out.push(...rendered);
  }
  if (dropped > 0) {
    out.push(`…and ${dropped} more line${dropped === 1 ? '' : 's'} — ask us for the full list.`);
  }

  if (summary.removed.length > 0) {
    out.push(`Skipped: ${summary.removed.join(', ')}`);
  }

  if (summary.totalLabel) {
    out.push(
      summary.upgradesLabel
        ? `Estimated total: ${summary.totalLabel} (incl. ${summary.upgradesLabel} upgrades)`
        : `Estimated total: ${summary.totalLabel}`,
    );
  }

  out.push(PACKAGE_PICKS_ESTIMATE_NOTE);
  return out.join('\n');
}

/* ──────────────────────────────────────────────────────────────────────── */
/* 🚨 DELIVERY TRUTH — what to say when the build did NOT reach the vendor   */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * WHY THIS EXISTS. The build message is THE DELIVERABLE of "Ask the vendor
 * about this build instead" — unlike the canned inquiry note, there is nothing
 * else in the thread that carries it. And it can legitimately fail to post:
 *
 *   · `followup_used` — the couple already spent their ONE pre-accept follow-up
 *     on a thread the vendor has not accepted (`lib/chat-send.ts` accept-gate).
 *     That gate is deliberate anti-spam and MUST NOT be bypassed for this
 *     feature; the couple simply has to be told.
 *   · `declined` — the vendor declined; the conversation is closed.
 *   · `contact_blocked` — the off-platform-contact filter caught something in
 *     the body (a vendor's option label can carry a phone number).
 *   · anything else (`too_long`, `insert_failed`, …) → a generic failure.
 *
 * The first cut of this feature wrapped the send in a swallow-all `try/catch`
 * and returned `{ status: 'ok' }` regardless, so the modal said "your build is
 * in the message" while nothing had posted and the couple sat waiting on a
 * quote the vendor never received. Delivery is now reported, and this is where
 * the reason becomes something a person can read.
 */
export type BuildNotSentReason =
  | 'followup_used'
  | 'declined'
  | 'contact_blocked'
  | 'failed';

/**
 * `SendMessageError` → the reason the couple is shown. Anything not explicitly
 * mapped degrades to 'failed', so a NEW core error code can never silently
 * become a claim of delivery.
 */
export function buildNotSentReasonFor(code: string): BuildNotSentReason {
  if (code === 'followup_used') return 'followup_used';
  if (code === 'declined') return 'declined';
  if (code === 'contact_blocked') return 'contact_blocked';
  return 'failed';
}

/**
 * The couple-facing sentence for a build that did not post.
 *
 * Never claims delivery, never promises the build was kept, and never suggests
 * a way around the pre-accept follow-up gate. For a contact-block it passes the
 * SERVER's own teaching copy straight through — the same wording a normal chat
 * send shows — so the couple gets one consistent explanation rather than a
 * second, weaker paraphrase of the rule.
 */
export function buildNotSentCopy(
  reason: BuildNotSentReason,
  vendorLabel: string,
  serverMessage?: string | null,
): string {
  const vendor = (vendorLabel ?? '').trim() || 'This vendor';
  switch (reason) {
    case 'followup_used':
      return (
        `${vendor} hasn’t accepted your inquiry yet, and you’ve already used your ` +
        `one follow-up message — so this build wasn’t sent. Once they reply, you ` +
        `can send it from your conversation.`
      );
    case 'declined':
      return `${vendor} declined this inquiry, so the conversation is closed — this build wasn’t sent.`;
    case 'contact_blocked':
      return (
        (serverMessage ?? '').trim() ||
        'This build wasn’t sent — please remove any phone numbers or outside-app contacts and try again.'
      );
    default:
      return `We couldn’t send this build to ${vendor}. Nothing else changed — please try again.`;
  }
}
