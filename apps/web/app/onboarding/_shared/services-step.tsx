'use client';

/**
 * The onboarding SERVICES STEP — two cards, one shared component, mounted by all
 * three onboarding flows (BUILD SPEC § 3 · prototype 2026-07-29).
 *
 * Card 1 · Papic — ALREADY ON and free by the time the couple gets here (the
 *   free pool grant + the free dedicated camera are armed at every commit path).
 *   So the card INFORMS; it never sells. No checkout, no cart, no price the
 *   couple has to act on. Upgrades live in the Papic studio.
 * Card 2 · Setnayan AI — introduced, never given away, and absent entirely on a
 *   vendor-free type. The gate is resolved server-side (services-step-server.ts);
 *   `view.ai === null` means it does not render at all.
 *
 * ── WHY IT IS A CLIENT COMPONENT ────────────────────────────────────────────
 * Two of its three mounts are client wizards that own their screen sequence, so
 * the step has to live inside their render. It therefore takes ONLY plain JSON
 * (resolved server-side) plus one slot:
 *   `aiValue` is the already-rendered <SetnayanAiValue mode="preview" …/>, passed
 *   down from a Server Component. That component's copy is the type-aware
 *   nine-capability list shipped in #3865 and must NOT be re-authored here (spec
 *   § 1.4); passing it as a node also keeps its server-only transitive imports
 *   (lib/events via todays-one-thing) out of the onboarding client bundle.
 *
 * ── EVERY NUMBER IS DERIVED ─────────────────────────────────────────────────
 * Rungs, free tiers and the point currency all arrive in `view` from live
 * tables. This file spells no photo count, no clip count, no free-camera count,
 * no peso figure — `lib/papic-copy-guardrails.test.ts` fails CI if one appears.
 * A rung the catalog can't price is already gone by the time it gets here, so a
 * dead SKU shortens the ladder instead of lying about it.
 *
 * Guests only — and that is a COPY decision, not a consequence of the vendor
 * lane being off. ⚠ It IS on: the `vendor_papic_capture` privacy control was
 * approved in production on 2026-07-16, and this docblock claimed the opposite
 * for the nineteen days after. A comment that states a live system's state goes
 * stale silently; check the control, not this line.
 *
 * The reason this step still says guests only is simpler: it is the COUPLE'S
 * onboarding. What a booked vendor may capture is the vendor's own decision on
 * their own console, and promising it here would sell the couple something
 * neither they nor we control.
 */

import { useMemo, type ReactNode } from 'react';
import { Camera, CheckCircle2, Sparkles, Users, UserRound } from 'lucide-react';

import {
  orderPapicTypes,
  type PapicTypeView,
  type ServicesStepView,
} from '@/lib/onboarding/services-step-data';

/** Copy that varies by product but not by event — keyed on the stable id. */
const TYPE_COPY: Record<
  PapicTypeView['id'],
  { title: string; kind: string; desc: string; note?: string; Icon: typeof Users }
> = {
  pool: {
    title: 'Papic Pool',
    kind: 'Unlimited cameras · shared shots',
    desc:
      // ⚠ Same false promise as the studio Pool card (see its comment): there
      // is no single couple-owned QR anyone can scan. Cameras come from each
      // guest's own invite QR, plus the claim links the host hands out.
      'One shared pot for the whole event — every camera draws from it, from ' +
      'each guest’s own QR to the links you hand out. Add shots any time; ' +
      'they never expire before your day.',
    Icon: Users,
  },
  one: {
    title: 'Papic One',
    kind: 'Dedicated camera · its own QR',
    desc:
      'A named camera with its own QR and its own shots — for your best friend, ' +
      'your ninang, the one person you trust to catch everything. Their shots ' +
      'never draw from the shared pool.',
    note:
      'One free camera to try it — then add as many dedicated cameras as you ' +
      'want, and reload any of them with the same rungs when they run low. No ' +
      'new QR needed.',
    Icon: UserRound,
  },
};

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const pts = (n: number) => `${n.toLocaleString('en-PH')} pts`;

function LadderRow({
  left,
  right,
  free = false,
}: {
  left: string;
  right: string;
  free?: boolean;
}) {
  return (
    <li
      className={[
        'flex items-baseline justify-between gap-4 px-3 py-2 font-mono text-sm tabular-nums',
        free
          ? 'rounded-[var(--m-r-sm)] bg-terracotta/10'
          : 'border-t border-ink/[0.07] first:border-t-0',
      ].join(' ')}
    >
      <span className="font-semibold text-ink">{left}</span>
      <span className={free ? 'font-semibold text-terracotta-700' : 'text-ink/60'}>
        {right}
      </span>
    </li>
  );
}

function PapicType({ type, suggested }: { type: PapicTypeView; suggested: boolean }) {
  const copy = TYPE_COPY[type.id];
  const { Icon } = copy;
  const showFree =
    type.freePoints > 0 && (type.freeCameras === null || type.freeCameras > 0);

  return (
    <section className="overflow-hidden rounded-[var(--m-r-md)] border border-ink/12 bg-paper">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Icon aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
          {copy.title}
        </h3>
        <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.1em] text-terracotta">
          {copy.kind}
        </span>
      </div>

      {suggested ? (
        <p className="px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-mulberry">
          Matches your plan
        </p>
      ) : null}

      <p className="px-4 pt-1.5 text-sm leading-relaxed text-ink/60">{copy.desc}</p>

      <ul className="mx-2.5 my-3 flex list-none flex-col">
        {showFree ? (
          <LadderRow
            free
            left={pts(type.freePoints)}
            right={
              type.freeCameras === null
                ? 'Free — yours now'
                : `Free — ${type.freeCameras === 1 ? '1 camera' : `${type.freeCameras} cameras`}`
            }
          />
        ) : null}
        {type.rungs.map((r) => (
          <LadderRow
            key={r.key}
            left={type.id === 'pool' ? `+${pts(r.points)}` : pts(r.points)}
            right={peso(r.pricePhp)}
          />
        ))}
      </ul>

      {copy.note ? (
        <p className="px-4 pb-4 text-xs italic leading-relaxed text-ink/45">{copy.note}</p>
      ) : null}
    </section>
  );
}

export function ServicesStep({
  view,
  interestedServices = [],
  aiValue = null,
  aiHref = null,
  className,
}: {
  /** Server-resolved live view-model. `view.ai === null` hides card 2 entirely. */
  view: ServicesStepView;
  /**
   * `style_preferences.interested_services` for this draft — the persona pack's
   * derived service list. Used ONLY to order the two Papic products (see
   * orderPapicTypes). Empty / unknown ⇒ default order.
   */
  interestedServices?: readonly string[];
  /** The already-rendered <SetnayanAiValue mode="preview" …/>, from a Server Component. */
  aiValue?: ReactNode;
  /**
   * Where the AI card points. NULL during onboarding — the event row is created
   * lazily at the final commit, so there is no `/dashboard/[eventId]/…` to link
   * to yet and a dead link would be the fake door this whole screen avoids. The
   * card then states where the assistant will be instead of pretending to open it.
   */
  aiHref?: string | null;
  className?: string;
}) {
  const { papic, ai } = view;
  const types = useMemo(
    () => orderPapicTypes(papic.types, interestedServices),
    [papic.types, interestedServices],
  );
  const named = useMemo(() => new Set(interestedServices), [interestedServices]);
  const eventWord = papic.eventWord || 'event';

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {/* ── CARD 1 · PAPIC — already on, free, informational ─────────────── */}
      <article className="rounded-[var(--m-r-lg)] border border-ink/12 bg-paper p-5 sm:p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-700">
          <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2.5} />
          Included · already on
        </span>

        <h2 className="mt-3 text-balance font-serif text-2xl font-medium italic leading-tight text-ink">
          Store every photo as you prepare — right through to your {eventWord}.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          Every guest&rsquo;s phone becomes a camera. Photos and clips land in your
          gallery, tagged, in real time — starting today, not on the day itself.
        </p>

        <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-emerald-600/[0.08] px-3 py-2.5 text-sm text-ink">
          <Camera
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            strokeWidth={2}
          />
          <span>
            <strong className="font-semibold">Papic is live on this {eventWord}.</strong>{' '}
            Your free shots and guest QR are ready.
          </span>
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {types.map((t) => (
            <PapicType key={t.id} type={t} suggested={named.has(t.inappKey)} />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 rounded-[var(--m-r-sm)] border border-dashed border-ink/15 px-3 py-2 font-mono text-xs text-ink/60">
          {papic.currencyTerms.map((term) => (
            <span key={term}>{term}</span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink/60">
          <strong className="font-semibold text-ink">
            Covered from today until your {eventWord} date.
          </strong>{' '}
          Plan a year ahead and that&rsquo;s a year of storage — the window is free,
          however long it is.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink/45">
          Guests shoot with any phone — nothing to install. Top up any time from your
          Papic studio.
        </p>
      </article>

      {/* ── CARD 2 · SETNAYAN AI — gated server-side; null ⇒ never rendered ── */}
      {ai ? (
        <article className="rounded-[var(--m-r-lg)] border border-ink/12 bg-paper p-5 sm:p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/12 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-700">
            <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2.5} />
            Setnayan AI
          </span>

          <h2 className="mt-3 text-balance font-serif text-2xl font-medium italic leading-tight text-ink">
            A planner that already knows every vendor in the room.
          </h2>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tabular-nums text-ink">
              {ai.priceLabel}
            </span>
            <span className="text-xs text-ink/45">
              one-time · yours through your {eventWord}
            </span>
          </p>

          {/* The nine wired capabilities, type-aware (#3865). Never re-authored here. */}
          {aiValue ? <div className="mt-4">{aiValue}</div> : null}

          {aiHref ? (
            <a
              href={aiHref}
              className="mt-5 block w-full rounded-xl border border-terracotta px-4 py-3 text-center text-sm font-semibold text-terracotta-700 transition hover:bg-terracotta/[0.06]"
            >
              See Setnayan AI in your studio →
            </a>
          ) : (
            <p className="mt-5 rounded-xl border border-ink/12 px-4 py-3 text-center text-sm text-ink/55">
              You&rsquo;ll find Setnayan AI in your studio the moment your {eventWord}{' '}
              is created.
            </p>
          )}
        </article>
      ) : null}

      <p className="text-center text-xs text-ink/45">
        No payment in this step. Upgrades live in your studio, whenever you want them.
      </p>
    </div>
  );
}
