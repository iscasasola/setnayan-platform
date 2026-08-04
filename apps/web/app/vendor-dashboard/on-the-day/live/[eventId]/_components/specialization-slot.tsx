import Link from 'next/link';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import type { DayOfFrameModel } from '@/lib/vendor-dayof-frame';
import { roleRunOfDay, type RunBlock } from '@/lib/role-run-of-day';
import type { VendorSpecializationSet } from '@/lib/vendor-specialization-gate';
import {
  ConsoleEyebrow,
  ConsoleHeading,
  ConsolePlate,
} from '../../../_components/pahina-console';
import { SPECIALIZATION_SURFACES } from './specialization-registry';

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
    <div className="border border-ink/10 bg-paper p-4">
      <h4 className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
        Your run of day
      </h4>

      {run.empty ? (
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Nothing on this programme is booked to this trade — you are seeing the couple&rsquo;s full
          night for context.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          <strong className="text-ink">{run.yoursCount}</strong> of {run.entries.length} moments are
          yours in this role. The rest are here so nothing surprises you.
          {run.callTime ? (
            <>
              {' '}
              Be on site by{' '}
              <strong className="text-ink">
                {new Date(run.callTime.call_time).toLocaleTimeString('en-PH', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'Asia/Manila',
                })}
              </strong>{' '}
              — {run.callTime.lead_minutes} min before {run.callTime.anchor_label}.
            </>
          ) : null}
        </p>
      )}

      <ol className="mt-3 space-y-1.5">
        {run.entries.map((e) => (
          <li
            key={e.blockId}
            className={`flex items-baseline gap-2 ${e.yours ? '' : 'opacity-45'}`}
          >
            <span className="font-mono text-xs text-ink/60">
              {e.startAt
                ? new Date(e.startAt).toLocaleTimeString('en-PH', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Asia/Manila',
                  })
                : '—'}
            </span>
            <span className={`text-sm ${e.relevance === 'primary' ? 'font-semibold text-ink' : 'text-ink/80'}`}>
              {e.label}
            </span>
            {e.relevance === 'primary' ? (
              <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gild">
                Yours
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
      <ConsoleEyebrow>
        {spec.state === 'locked' ? 'Available on your trade' : 'Your specialization'}
      </ConsoleEyebrow>

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
        <nav aria-label="Which desk you are running" className="flex flex-wrap gap-2">
          {model.roleChoices.map((choice) => (
            <Link
              key={choice.set}
              href={`?role=${choice.set}#${spec.domId}`}
              aria-current={choice.active ? 'true' : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                choice.active
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/15 bg-paper text-ink/60 hover:text-ink'
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
        <ConsolePlate className="space-y-4">
          <ConsoleHeading>{spec.label}</ConsoleHeading>
          <Surface
            eventId={eventId}
            vendorProfileId={vendorProfileId}
            coupleName={coupleName}
          />
        </ConsolePlate>
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
    <ConsolePlate className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
        <ConsoleHeading as="h3">{label}</ConsoleHeading>
      </div>
      <p className="text-sm leading-relaxed text-ink/65">{blurb}</p>
      <p className="text-sm leading-relaxed text-ink/70">
        This is included in your plan. We&rsquo;re still building it — it will appear
        here, on this screen, the moment it&rsquo;s ready. Nothing for you to do.
      </p>
    </ConsolePlate>
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

  return (
    <ConsolePlate className="space-y-2">
      <div className="flex items-center gap-2">
        <Lock aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
        <ConsoleHeading as="h3">{upsell.label}</ConsoleHeading>
      </div>
      <p className="text-sm leading-relaxed text-ink/65">{upsell.blurb}</p>
      <p className="text-sm leading-relaxed text-ink/70">
        {upsell.lapsed
          ? `Your subscription has lapsed, so this desk is paused. Renewing brings it back — everything else on this screen keeps working.`
          : `Built for your trade, and included from ${upsell.minTierLabel} up. Everything else on this screen stays exactly as it is.`}
      </p>
      <Link
        href={upsell.href}
        className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline"
      >
        {upsell.lapsed ? 'Renew your plan' : 'See the plans'}
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    </ConsolePlate>
  );
}
