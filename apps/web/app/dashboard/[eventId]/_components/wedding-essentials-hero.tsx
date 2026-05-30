/**
 * Wedding Essentials hero · the Free DIY surface on /dashboard/[eventId]/today.
 *
 * Renders when `events.concierge_status` is NOT 'active' (Free DIY tier ·
 * includes 'diy', 'trial', 'expired', and NULL). Paid Today's Focus
 * couples see the existing WizardHero instead · branch lives in
 * today/page.tsx.
 *
 * Renders 7 always-visible Wedding Essential cards in a stacked vertical
 * layout (no carousel) so couples can scan all 7 at once on mobile · per
 * the brief's "scannability" principle + per the owner's DIY simplicity
 * directive. Each card shows:
 *
 *   - eyebrow · "ESSENTIAL N OF 7" in mono uppercase
 *   - label in display italic
 *   - hint in body 75% ink
 *   - status pill · Empty / In progress / Done
 *   - optional detail (e.g., "3 considering · 1 locked" · "Casa Manila")
 *   - primary CTA · Mulberry filled when Empty, Champagne outline when
 *     In progress or Done
 *
 * Bottom of hero · soft upgrade nudge for paid Today's Focus ₱1,499 ·
 * brand-voice editorial register (not punchy sales copy) · placed AFTER
 * the planning utility so it doesn't compete with the active essentials.
 *
 * Data contract: this component is presentational only · all data
 * (essential statuses · detail strings) is pre-computed in today/page.tsx
 * and passed in. Keeps the component decoupled from Supabase + RLS
 * concerns and lets the page surface own the query batch.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]]: no
 * engineering jargon · no "Coming soon" placeholders · all copy reads
 * like a wedding planner speaking.
 *
 * Palette per CLAUDE.md 2026-05-29 Clean Editorial lock · Mulberry CTA ·
 * Champagne accent · Alabaster bg · Obsidian text. Uses the existing
 * `.m-*` token classes from globals.css so palette changes inherit
 * automatically (per the token-swap pattern · 219 files inherit from
 * the Clean Editorial swap).
 */

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import {
  WEDDING_ESSENTIALS,
  type WeddingEssentialId,
} from '@/lib/wedding-essentials';

/**
 * Status pill rendered on each essential card.
 *
 *   - 'empty' · couple hasn't touched this essential · neutral chip
 *   - 'in_progress' · some action taken (e.g., 3 considering vendors,
 *     date set in profile, draft guest list started) · champagne chip
 *   - 'done' · the essential is settled (vendor locked, date confirmed,
 *     license obtained) · emerald chip with checkmark
 */
export type WeddingEssentialStatus = 'empty' | 'in_progress' | 'done';

/**
 * Auto-resolution framings · which kind of locked-venue commitment is
 * implicitly handling this essential. Drives the framing-specific hint
 * copy + provider label on the rendered card.
 *
 *   - 'catholic_parish' · Catholic ceremony at a parish church · the
 *     priest from the parish officiates · confirmed via Pre-Cana.
 *   - 'civil_registrar' · Civil ceremony at a city hall / municipal
 *     registrar · the judge or registrar officiates as part of the
 *     venue commitment.
 *   - 'inc_chapel' · INC ceremony at an INC chapel · an INC minister
 *     from the chapel officiates.
 *
 * Other ceremony × venue combinations (Christian-at-banquet · Muslim ·
 * Cultural · Mixed · Catholic-at-non-church-destination) fall through
 * to the standard vendor picker · no auto-resolution applies.
 */
export type WeddingEssentialAutoResolutionFraming =
  | 'catholic_parish'
  | 'civil_registrar'
  | 'inc_chapel';

/**
 * Auto-resolution payload · passed in from the page wrapper when a
 * Wedding Essential is implicitly handled by another locked commitment
 * (today: Card 04 Officiant when Catholic+parish · Civil+civil-registrar
 * · INC+INC-chapel match per CLAUDE.md 2026-05-29 "Vendor Discovery
 * Architecture" row).
 *
 * When set, the hero renders the card with framing-specific hint copy ·
 * a "Set by your venue" pill (instead of "Not started") · the provider
 * name as the detail line · and a quieter override CTA pointing at the
 * standard picker · so the couple can still override per the spec's
 * "always-available override affordance" rule for the real PH edge
 * cases (interfaith / destination / family priest with permission
 * letter / retired pastor / hired celebrant for civil).
 */
export type WeddingEssentialAutoResolution = {
  framing: WeddingEssentialAutoResolutionFraming;
  /**
   * Public-facing name of the venue/parish/registrar that implicitly
   * handles this essential. Surfaces in the card detail line · sourced
   * from `venue_directory.name` (admin-seeded famous venues) OR
   * `vendor_profiles.business_name` (marketplace-linked venues).
   */
  providerName: string;
};

/**
 * One essential's computed state · passed in from the page wrapper.
 */
export type WeddingEssentialState = {
  id: WeddingEssentialId;
  status: WeddingEssentialStatus;
  /**
   * Optional one-line context detail rendered under the status pill.
   * Examples · "3 considering" · "Casa Manila locked" · "47 of 150
   * RSVPs in". When omitted, only the status pill renders.
   *
   * When `autoResolved` is set, the auto-resolution's providerName
   * takes precedence over this field for the rendered detail line.
   */
  detail?: string;
  /**
   * When set, this essential is implicitly handled by a locked venue
   * commitment (see WeddingEssentialAutoResolution above). The hero
   * renders an "auto-resolved" treatment · the underlying `status`
   * may still be 'empty' (no separate vendor row for this essential
   * exists) but the couple doesn't need to act because the venue
   * covers it. The page wrapper only sets this when the underlying
   * `status` is 'empty' · couples who've actually picked or considered
   * a separate vendor see their picks instead.
   */
  autoResolved?: WeddingEssentialAutoResolution;
};

type Props = {
  eventId: string;
  /**
   * Pre-computed status for each of the 7 essentials. Caller is
   * responsible for filling all 7 — missing essentials fall back to
   * 'empty' status. Order doesn't matter (the hero renders in
   * WEDDING_ESSENTIALS canonical order).
   */
  essentials: ReadonlyArray<WeddingEssentialState>;
};

export function WeddingEssentialsHero({ eventId, essentials }: Props) {
  // Build a lookup so we can iterate in canonical order regardless of
  // input order · missing entries fall back to 'empty' rather than
  // throwing (defensive · the page wrapper might query fewer than 7 if
  // some surfaces aren't shipped yet · this PR ships the schema +
  // surface, not all per-essential data fetches).
  const stateById = new Map<WeddingEssentialId, WeddingEssentialState>(
    essentials.map((e) => [e.id, e]),
  );

  return (
    <section className="space-y-6">
      {/* Header rail · matches WizardCard's "★ TODAY'S FOCUS" pattern
       *  but with neutral copy that doesn't claim wizard intelligence
       *  the DIY tier doesn't have. */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink/60">
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          <span className="m-label-mono">Wedding Essentials</span>
        </div>
        <h2 className="m-display text-2xl text-ink sm:text-3xl">
          Lock the seven things every wedding needs
        </h2>
        <p className="max-w-prose text-sm text-ink/70">
          Start with these. Everything else can wait or skip entirely.
          Tap a card to take the next step.
        </p>
      </header>

      {/* Essential cards · stacked vertical layout · single column on
       *  mobile · 1-2 column on desktop depending on space. Each card
       *  is its own `<article>` for semantic chunking. */}
      <ul className="space-y-3">
        {WEDDING_ESSENTIALS.map((essential, idx) => {
          const state = stateById.get(essential.id) ?? {
            id: essential.id,
            status: 'empty' as WeddingEssentialStatus,
          };
          const href = essential.primaryHref(eventId);
          const autoResolved = state.autoResolved;
          const isAutoResolved = autoResolved != null;
          const isDone = state.status === 'done';
          const isInProgress = state.status === 'in_progress';

          // Hint copy · auto-resolved cards swap the generic hint for
          // framing-specific copy that names how the venue handles it
          // (Catholic parish · Civil registrar · INC chapel). Normal
          // cards keep the essential's stock hint.
          const hint = autoResolved
            ? autoResolvedHint(autoResolved.framing)
            : essential.hint;

          // Detail line · auto-resolved cards surface the provider name
          // (e.g. "Manila Cathedral") · normal cards use whatever the
          // page wrapper computed (e.g. "3 considering · 1 locked").
          const detail = autoResolved
            ? autoResolved.providerName
            : state.detail;

          // CTA visual rank · Mulberry filled for empty (primary call
          // to action) · Champagne outline for in_progress (continue
          // the work) · neutral outline for done (review/edit) ·
          // Champagne outline for auto-resolved (override path · the
          // couple can still pick their own per the always-available
          // override rule from CLAUDE.md 2026-05-29 Vendor Discovery).
          const ctaLabel = isAutoResolved
            ? `Use a different ${essential.label.toLowerCase()}`
            : isDone
              ? 'View'
              : isInProgress
                ? 'Continue'
                : essential.primaryCtaLabel;

          return (
            <li key={essential.id}>
              <article className="m-card flex flex-col gap-3 rounded-lg border border-ink/10 bg-paper p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                {/* Left column · eyebrow + title + hint */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink/50">
                    <span className="m-label-mono">
                      Essential {idx + 1} of 7
                    </span>
                  </div>
                  <h3 className="m-serif text-lg italic text-ink">
                    {essential.label}
                  </h3>
                  <p className="text-sm text-ink/70">{hint}</p>
                </div>

                {/* Right column · status pill + detail + CTA */}
                <div className="flex flex-col gap-2 sm:items-end">
                  {isAutoResolved ? (
                    <AutoResolvedPill />
                  ) : (
                    <StatusPill status={state.status} />
                  )}
                  {detail ? (
                    <p className="text-xs text-ink/60">{detail}</p>
                  ) : null}
                  <Link
                    href={href}
                    className={
                      isAutoResolved
                        ? // Auto-resolved · Champagne outline (override · the
                          //  couple can still pick their own officiant)
                          'm-btn inline-flex items-center gap-2 self-start rounded-md border border-[var(--m-orange)] px-3 py-2 text-sm text-ink hover:bg-[var(--m-orange-4)] sm:self-end'
                        : isDone
                          ? // Done · subtle outline (review/edit affordance)
                            'm-btn inline-flex items-center gap-2 self-start rounded-md border border-ink/20 px-3 py-2 text-sm text-ink hover:border-ink/40 sm:self-end'
                          : isInProgress
                            ? // In progress · Champagne outline (continue)
                              'm-btn inline-flex items-center gap-2 self-start rounded-md border border-[var(--m-orange)] px-3 py-2 text-sm text-ink hover:bg-[var(--m-orange-4)] sm:self-end'
                            : // Empty · Mulberry primary (start)
                              'm-btn-primary inline-flex items-center gap-2 self-start rounded-md px-3 py-2 text-sm sm:self-end'
                    }
                    aria-label={`${ctaLabel}: ${essential.label}`}
                  >
                    <span>{ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {/* Soft upgrade nudge · placed AFTER the planning utility so it
       *  reads as a quiet offering, not a blocking paywall. Mulberry-
       *  bordered card · Champagne icon · brand-voice editorial copy ·
       *  per the conversation lock "the upgrade nudge sits at the
       *  bottom of free Today — discoverable but not blocking". */}
      <aside className="rounded-lg border border-[var(--m-mulberry)]/30 bg-[var(--m-mulberry-4)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--m-orange-4)]">
            <Sparkles
              className="h-5 w-5 text-[var(--m-orange-2)]"
              strokeWidth={2}
            />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="m-serif text-base italic text-ink">
              Want Setnayan to plan with you?
            </h3>
            <p className="text-sm text-ink/70">
              Today&apos;s Focus opens the full guided wizard · 65 cards ·
              hard-floor warnings · religion-aware copy · auto-scheduled
              coordinator meetings · ₱1,499 one-time per wedding.
            </p>
          </div>
          <Link
            href="/pricing#todays-focus"
            className="m-btn-primary inline-flex items-center gap-2 self-start rounded-md px-4 py-2 text-sm sm:self-center"
          >
            <span>See what&apos;s included</span>
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </aside>
    </section>
  );
}

/**
 * Status pill · Empty / In progress / Done · three visual treatments
 * keyed off the status field.
 */
function StatusPill({ status }: { status: WeddingEssentialStatus }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-700">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
        Done
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-orange-4)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-[var(--m-orange-2)]">
        <Circle className="h-3 w-3 fill-[var(--m-orange-2)]" strokeWidth={0} />
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink/60">
      <Circle className="h-3 w-3" strokeWidth={2} />
      Not started
    </span>
  );
}

/**
 * Auto-resolved pill · emerald-tinted "Set by your venue" treatment.
 * Renders when an essential is implicitly handled by another locked
 * commitment (today: Card 04 Officiant when the venue covers it).
 * Distinct from the regular Done pill copy so couples understand the
 * essential is provided · they didn't pick a vendor.
 */
function AutoResolvedPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-700">
      <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
      Set by your venue
    </span>
  );
}

/**
 * Framing-specific hint copy for auto-resolved cards · brand voice
 * editorial register · names the role the venue's officiant plays
 * (Catholic priest / Civil judge / INC minister) and the gating
 * paperwork or commitment when relevant.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] · no engineering
 * jargon · concrete + Filipino-aware framing.
 */
function autoResolvedHint(
  framing: WeddingEssentialAutoResolutionFraming,
): string {
  switch (framing) {
    case 'catholic_parish':
      return 'The priest from your parish officiates. Confirmed via Pre-Cana paperwork.';
    case 'civil_registrar':
      return 'The judge or registrar at this venue officiates the ceremony.';
    case 'inc_chapel':
      return 'Your INC minister officiates from this chapel.';
  }
}
