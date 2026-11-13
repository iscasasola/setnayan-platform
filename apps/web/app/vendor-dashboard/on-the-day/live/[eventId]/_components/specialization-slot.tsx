import Link from 'next/link';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import type { DayOfFrameModel } from '@/lib/vendor-dayof-frame';
import { roleRunOfDay, type RunBlock } from '@/lib/role-run-of-day';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import type { VendorSpecializationSet } from '@/lib/vendor-specialization-gate';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { SPECIALIZATION_SURFACES } from './specialization-registry';
import { formatCount } from '@/lib/format-number';

/**
 * The specialization SLOT — the one place the console renders a vendor's
 * per-trade surface, and the one place that decides what to show when there
 * isn't one yet.
 *
 * Three states, from `buildDayOfFrame`, and all three render something honest:
 *
 *   ready       → the registered surface, mounted with the props contract.
 *   coming_soon → a named placeholder. The vendor HOLDS this specialization;
 *                 we simply have not shipped the desk yet. It says exactly
 *                 that, using the set's own label and blurb, so it is never a
 *                 blank panel, never an error, and never a link that goes
 *                 nowhere (owner requirement).
 *   locked      → the quiet upsell. Their trade has a desk; their tier does
 *                 not include it yet.
 *
 * THE ENTITLEMENT IS NOT DECIDED HERE. `page.tsx` resolves it on the server via
 * `resolveVendorSpecializationAccessForVendor` before this component exists.
 * This file reads `model.specialization.state` and nothing else — there is no
 * prop, param or cookie on this path that could promote `locked` to `ready`.
 *
 * NOTHING IN THE GENERIC KIT PASSES THROUGH HERE. This component renders the
 * NEW section only. The tools every vendor already had are rendered by
 * `page.tsx` from `model.genericModuleIds`, which the frame passes through
 * untouched on every access path.
 */
/**
 * YOUR RUN OF DAY — the couple's night seen through the ONE role now mounted.
 *
 * Phase 2 of the role-scoped design. Every decision is made by the pure
 * `roleRunOfDay` and only drawn here.
 *
 * 🔴 A LENS, NEVER A GATE (locked D2). Every block is listed. The moments this
 * role does not work are dimmed, never removed — a host told nothing about a
 * moment is worse off than one told it is not his.
 */
function RunOfDay({
  blocks,
  set,
  bookedCategories,
}: {
  blocks: readonly RunBlock[];
  set: VendorSpecializationSet;
  bookedCategories: readonly string[] | null | undefined;
}) {
  const run = roleRunOfDay({ blocks, set, bookedCategories });
  if (run.entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
        Your run of day
      </h3>

      {run.empty ? (
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--m-slate-2)]">
          This trade has no booked moment on this programme — you are seeing the couple’s full night for
          context.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--m-slate-2)]">
          <strong className="text-ink">{formatCount(run.yoursCount)}</strong> of {formatCount(run.entries.length)} moments are
          yours in this role. The rest are here so nothing surprises you.
          {run.callTime ? (
            <>
              {' '}
              Be on site by{' '}
              <strong className="text-ink">
                {/* The venue WALL CLOCK, read off the stored components (`formatWallClock`), never re-zoned:
                    `call_time` is derived from the schedule's wall clock, so it is already the venue's time.
                    Translating it into Manila added eight hours on top — this line once told an emcee to be on
                    site by 9:00 PM for a 2:00 PM ceremony, and the run-of-day beneath it agreed with the error. */}
                {formatWallClock(run.callTime.call_time, { hour12: true }) || '—'}
              </strong>{' '}
              — {run.callTime.lead_minutes} min before {run.callTime.anchor_label}.
            </>
          ) : null}
        </p>
      )}

      <ol className="mt-2 divide-y divide-[color:var(--m-line)]">
        {run.entries.map((e) => (
          <li key={e.blockId} className="flex min-h-11 items-center gap-2 py-1.5" data-yours={e.yours ? '' : undefined}>
            <span className="w-16 shrink-0 text-sm tabular-nums text-[color:var(--m-slate-2)]">
              {/* ⏱ The venue wall clock — re-zoning it into Asia/Manila
                  added eight hours a second time (1:30 PM read 9:30 PM). */}
              {e.startAt ? formatWallClock(e.startAt) || '—' : '—'}
            </span>
            {/* 🔴 A lens, never a gate: a moment this role does not work stays listed, in the mid grey. */}
            <span
              className={`min-w-0 text-sm ${
                !e.yours
                  ? 'text-[color:var(--m-slate-3)]'
                  : e.relevance === 'primary'
                    ? 'font-semibold text-ink'
                    : 'text-ink'
              }`}
            >
              {e.label}
            </span>
            {e.relevance === 'primary' ? (
              <span className="ml-auto">
                <Badge tone="ok">Yours</Badge>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SpecializationSlot({
  model,
  eventId,
  vendorProfileId,
  coupleName,
  blocks,
  bookedCategories,
}: {
  model: DayOfFrameModel;
  eventId: string;
  vendorProfileId: string;
  coupleName: string;
  /** The couple's timeline, already read by the page. */
  blocks?: readonly RunBlock[];
  /** `get_vendor_event_brief().booked_categories` — couple-side vocabulary. */
  bookedCategories?: readonly string[] | null;
}) {
  const spec = model.specialization;
  if (!spec) return null; // category has no specialization — generic is the whole kit

  const Surface =
    spec.state === 'ready' ? SPECIALIZATION_SURFACES[spec.set] : undefined;

  return (
    <section id={spec.domId} className="scroll-mt-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
        {spec.state === 'locked' ? 'Available on your trade' : 'Your specialization'}
      </h2>

      {/*
        THE ROLE SWITCHER — only when there is genuinely a choice.

        A supplier can be two trades at one wedding: the band that also emcees.
        Which one they are RUNNING is a fact about the person on the floor
        tonight, not about the company, so they say — and the frame validates
        what they say against the entitlement before anything mounts.

        A plain `?role=` Link, so the console stays a server component with no
        client state, exactly like the Customer Card's tab rail. `scroll` is
        left on so the choice lands on the desk they just picked.
      */}
      {model.roleChoices.length > 1 ? (
        <nav aria-label="Which desk you are running" className="flex gap-1 overflow-x-auto">
          {model.roleChoices.map((choice) => (
            <Link
              key={choice.set}
              href={`?role=${choice.set}#${spec.domId}`}
              aria-current={choice.active ? 'true' : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition-colors duration-sn-control ease-sn ${
                choice.active
                  ? 'bg-[color:var(--m-paper-2)] text-ink'
                  : 'text-[color:var(--m-slate-2)] hover:text-ink'
              }`}
            >
              {choice.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {/*
        YOUR RUN OF DAY — only for a desk that is actually mounted. A locked or
        coming-soon section gets the upsell/placeholder it already had; adding a
        timeline there would bury the one sentence those states exist to say.
      */}
      {spec.state === 'ready' && blocks && blocks.length > 0 ? (
        <RunOfDay blocks={blocks} set={spec.set} bookedCategories={bookedCategories} />
      ) : null}

      {Surface ? (
        // The built desk. It gets the plate for material consistency; whatever
        // it renders inside is its own PR's business.
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-ink">{spec.label}</h3>
          <Surface
            eventId={eventId}
            vendorProfileId={vendorProfileId}
            coupleName={coupleName}
          />
        </div>
      ) : spec.state === 'coming_soon' ? (
        <ComingSoon label={spec.label} blurb={spec.blurb} />
      ) : (
        <LockedUpsell model={model} />
      )}
    </section>
  );
}

/**
 * Held, but not built yet. Names the desk and says plainly that it is on the
 * way — no spinner, no "error loading", no CTA that leads nowhere.
 */
function ComingSoon({ label, blurb }: { label: string; blurb: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
        <h3 className="text-base font-semibold text-ink">{label}</h3>
      </div>
      <p className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">{blurb}</p>
      <p className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">
        Included in your plan and still being built — it appears here the moment it’s ready. Nothing for you to do.
      </p>
    </div>
  );
}

/**
 * Eligible by trade, below the tier floor (or lapsed). Quiet on purpose: it is
 * one plate under the tools the vendor came here to use, not a wall in front of
 * them. `lapsed` gets "renew", everyone else gets "subscribe".
 */
function LockedUpsell({ model }: { model: DayOfFrameModel }) {
  const upsell = model.upsell;
  if (!upsell) return null;

  const line = upsell.lapsed
    ? 'Your subscription has lapsed, so this desk is paused. Renewing brings it back — everything else on this screen keeps working.'
    : `Built for your trade, and included from ${upsell.minTierLabel} up. Everything else on this screen stays exactly as it is.`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Lock aria-hidden className="h-4 w-4 shrink-0 text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
        <h3 className="text-base font-semibold text-ink">{upsell.label}</h3>
      </div>
      <p className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">{upsell.blurb}</p>
      <p className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">{line}</p>
      <ActionButton
        tone="brand"
        icon={ArrowRight}
        label={upsell.lapsed ? 'Renew your plan' : 'See the plans'}
        href={upsell.href}
      />
    </div>
  );
}
