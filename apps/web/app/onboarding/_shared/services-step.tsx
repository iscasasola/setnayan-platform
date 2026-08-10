'use client';

/**
 * The onboarding SERVICES STEP — two cards, one shared component, mounted by all
 * three onboarding flows (BUILD SPEC § 3 · prototype 2026-07-29).
 *
 * Card 1 · Papic — ALWAYS ON and always free at its floor (the free pool grant +
 *   the free dedicated camera are armed at every commit path, whatever is picked
 *   here). Since 2026-08-11 the card can also SELL: the couple sets how many
 *   shots they want for the event and how many dedicated cameras to add, and
 *   that becomes a real order at commit. See "THE PICKER" below.
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
 *
 * ── THE PICKER (owner 2026-08-11) ───────────────────────────────────────────
 * Owner: *"how many shots do you want for this event? 50 - Free … then they can
 * press + and minus. which will set how much they will pay. Or papic one (pick
 * how many papic one) they want to add. so this can be their paywall for the
 * onboarding. can add more later."*
 *
 * This REVERSES two of the owner's own earlier rulings — the 2026-06-21 "no
 * paywall in onboarding" lock and the 2026-07-27 "Papic informs, never sells /
 * NO checkout in onboarding" lock — at the owner's own instruction. The rest of
 * both stands: `PAYWALL_SCREENS` in the wedding shell is untouched, and the
 * retired bundle / à-la-carte tail stays out of the funnel. What comes back is
 * ONE product's ladder, on the screen that was already showing it.
 *
 * 🔑 IT ASKS, IT DOES NOT BLOCK. Paying means a bank or GCash transfer that a
 * human reconciles — up to 24 hours. A step that refused to finish until the
 * money landed would lock every new couple out of their own dashboard
 * overnight, so the free floor is always a complete, finishable answer and the
 * order is minted ALONGSIDE the event, never in front of it.
 *
 * 🔑 + AND − WALK THE LADDER, NOT SINGLE SHOTS. There is no SKU for an
 * arbitrary shot count; the Pool sells whole blocks. A free-running counter
 * would display a quantity that cannot be ordered, priced or granted. See the
 * long note in lib/papic-onboarding-selection.ts — that module owns all of this
 * arithmetic and is where its tests live.
 *
 * 🔒 THE CONTROLS ONLY APPEAR WHERE THE FLOW CAN TAKE THE ORDER — i.e. when the
 * mount passes `selection` + `onSelectionChange`. A flow whose commit does not
 * yet carry a selection renders the original read-only ladder, because a stepper
 * that changes a price and then charges nothing is a fake door. Do NOT default
 * these props to local state to "turn it on everywhere".
 */

import { useMemo, type ReactNode } from 'react';
import { Camera, CheckCircle2, Sparkles, Users, UserRound } from 'lucide-react';

import {
  orderPapicTypes,
  type PapicTypeView,
  type ServicesStepView,
} from '@/lib/onboarding/services-step-data';
import {
  ONBOARDING_MAX_EXTRA_CAMERAS,
  oneCameraTotal,
  onePriceOf,
  oneRungOf,
  poolPriceAt,
  poolShotsAt,
  poolStepCount,
  poolStepOf,
  quotePapicSelection,
  setOneCameras,
  setOneRung,
  stepPool,
  type PapicSelection,
} from '@/lib/papic-onboarding-selection';

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

/**
 * The − / + control. Deliberately the same gesture as the one on /pricing, so it
 * is already familiar by the time a couple reaches the studio.
 *
 * Both buttons stay MOUNTED and are disabled at the ends rather than removed: a
 * control that disappears from under the thumb mid-tap is how a couple ends up
 * on a rung they did not choose.
 */
function Stepper({
  value,
  sub,
  onDec,
  onInc,
  canDec,
  canInc,
  decLabel,
  incLabel,
}: {
  value: string;
  sub: string;
  onDec: () => void;
  onInc: () => void;
  canDec: boolean;
  canInc: boolean;
  decLabel: string;
  incLabel: string;
}) {
  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 ' +
    'text-xl leading-none text-ink/70 transition hover:bg-ink/[0.05] ' +
    'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onDec} disabled={!canDec} aria-label={decLabel} className={btn}>
        −
      </button>
      <span className="min-w-0 flex-1 text-center">
        <span className="block font-mono text-2xl font-semibold tabular-nums text-ink">
          {value}
        </span>
        <span className="mt-0.5 block text-xs text-ink/55">{sub}</span>
      </span>
      <button type="button" onClick={onInc} disabled={!canInc} aria-label={incLabel} className={btn}>
        +
      </button>
    </div>
  );
}

/** The live price of whatever is currently picked, or the free label. */
function PriceLine({ pricePhp }: { pricePhp: number }) {
  return pricePhp > 0 ? (
    <p className="mt-3 flex items-baseline justify-between gap-3 rounded-[var(--m-r-sm)] bg-ink/[0.03] px-3 py-2">
      <span className="text-sm text-ink/65">You&rsquo;ll pay</span>
      <span className="font-mono text-base font-semibold tabular-nums text-ink">
        {peso(pricePhp)}
      </span>
    </p>
  ) : (
    <p className="mt-3 flex items-baseline justify-between gap-3 rounded-[var(--m-r-sm)] bg-terracotta/10 px-3 py-2">
      <span className="text-sm text-ink/70">Included</span>
      <span className="font-mono text-base font-semibold text-terracotta-700">Free</span>
    </p>
  );
}

/** The shared Pool: one stepper over the ladder, free floor at the bottom. */
function PoolPicker({
  type,
  selection,
  onChange,
  eventWord,
}: {
  type: PapicTypeView;
  selection: PapicSelection;
  onChange: (next: PapicSelection) => void;
  eventWord: string;
}) {
  const step = poolStepOf(type, selection);
  const last = poolStepCount(type) - 1;
  return (
    <div className="mx-3 mb-3">
      <p className="mb-2 text-sm font-medium text-ink">
        How many shots do you want for this {eventWord}?
      </p>
      <Stepper
        decLabel="Fewer shots"
        incLabel="More shots"
        value={pts(poolShotsAt(type, step))}
        sub={step === 0 ? 'Yours already' : 'Shared by every camera'}
        canDec={step > 0}
        canInc={step < last}
        onDec={() => onChange(stepPool(type, selection, -1))}
        onInc={() => onChange(stepPool(type, selection, +1))}
      />
      <PriceLine pricePhp={poolPriceAt(type, step)} />
      {step === last && last > 0 ? (
        <p className="mt-2 text-center text-xs text-ink/45">
          That&rsquo;s the biggest pool we sell in one go — add more any time from your
          Papic studio.
        </p>
      ) : null}
    </div>
  );
}

/** Papic One: how many dedicated cameras to add, and at which size. */
function OnePicker({
  type,
  selection,
  onChange,
}: {
  type: PapicTypeView;
  selection: PapicSelection;
  onChange: (next: PapicSelection) => void;
}) {
  const rung = oneRungOf(type, selection);
  const extra = selection.oneExtraCameras;
  const total = oneCameraTotal(type, selection);
  // No live rung means there is nothing to sell — the free camera still exists,
  // so the card simply grows no controls rather than offering an empty one.
  if (!rung) return null;
  return (
    <div className="mx-3 mb-3">
      <p className="mb-2 text-sm font-medium text-ink">
        How many dedicated cameras do you want?
      </p>
      <Stepper
        decLabel="Fewer cameras"
        incLabel="More cameras"
        value={String(total)}
        sub={
          extra === 0
            ? 'Your free one'
            : `Your free one, plus ${extra === 1 ? 'one you add' : `${extra} you add`}`
        }
        canDec={extra > 0}
        canInc={extra < ONBOARDING_MAX_EXTRA_CAMERAS}
        onDec={() => onChange(setOneCameras(type, selection, extra - 1))}
        onInc={() => onChange(setOneCameras(type, selection, extra + 1))}
      />
      {/* The size choice only earns its space once a camera is being added, and
          only when there is genuinely more than one size to choose between. */}
      {extra > 0 && type.rungs.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {type.rungs.map((r) => {
            const on = r.key === rung.key;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(setOneRung(selection, r.key))}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs tabular-nums transition ${
                  on
                    ? 'border-terracotta bg-terracotta/[0.08] text-terracotta-700'
                    : 'border-ink/15 text-ink/65 hover:border-ink/30'
                }`}
              >
                {pts(r.points)} · {peso(r.pricePhp)} each
              </button>
            );
          })}
        </div>
      ) : null}
      <PriceLine pricePhp={onePriceOf(type, selection)} />
    </div>
  );
}

function PapicType({
  type,
  suggested,
  selection,
  onSelectionChange,
  eventWord,
}: {
  type: PapicTypeView;
  suggested: boolean;
  /** Both present ⇒ this product gets controls. Absent ⇒ read-only ladder. */
  selection?: PapicSelection;
  onSelectionChange?: (next: PapicSelection) => void;
  eventWord: string;
}) {
  const copy = TYPE_COPY[type.id];
  const { Icon } = copy;
  const interactive = selection != null && onSelectionChange != null;
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

      {interactive ? (
        // The controls REPLACE the ladder rather than sitting under it. Showing
        // both would print every rung's price beside a stepper that already
        // states the one being charged — two answers to "what does this cost".
        type.id === 'pool' ? (
          <PoolPicker
            type={type}
            selection={selection}
            onChange={onSelectionChange}
            eventWord={eventWord}
          />
        ) : (
          <OnePicker type={type} selection={selection} onChange={onSelectionChange} />
        )
      ) : (
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
      )}

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
  selection,
  onSelectionChange,
  className,
}: {
  /**
   * What the couple has picked so far. Present WITH `onSelectionChange` ⇒ the
   * Papic card grows its steppers and the running total. Both absent ⇒ the
   * original read-only ladder, unchanged.
   *
   * ⚠ Pass these ONLY from a mount whose commit actually carries the selection
   * through to an order (see the docblock). Wiring the control without the
   * commit is a fake door that quietly loses the sale AND the couple's shots.
   */
  selection?: PapicSelection;
  onSelectionChange?: (next: PapicSelection) => void;
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
  const interactive = selection != null && onSelectionChange != null;
  const quote = useMemo(
    () =>
      selection
        ? quotePapicSelection(papic.types, selection)
        : { poolPhp: 0, onePhp: 0, totalPhp: 0 },
    [papic.types, selection],
  );

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
            <PapicType
              key={t.id}
              type={t}
              suggested={named.has(t.inappKey)}
              eventWord={eventWord}
              selection={selection}
              onSelectionChange={onSelectionChange}
            />
          ))}
        </div>

        {/* ── THE RUNNING TOTAL ────────────────────────────────────────────
            Only where the controls are live. It states the FREE case as
            plainly as the paid one: a couple who touches nothing must be able
            to read — not infer — that they owe nothing and still have a
            working event. */}
        {interactive ? (
          <div className="mt-4 rounded-[var(--m-r-md)] border border-ink/12 bg-ink/[0.02] p-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-ink">Your total today</span>
              <span className="font-sans text-2xl font-semibold tabular-nums text-ink">
                {quote.totalPhp > 0 ? peso(quote.totalPhp) : 'Free'}
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink/55">
              {quote.totalPhp > 0 ? (
                <>
                  We&rsquo;ll show you where to send it right after this — your{' '}
                  {eventWord} and your free shots are live either way, and the extra
                  shots land once your payment is confirmed.
                </>
              ) : (
                <>
                  Nothing to pay. Your {eventWord} and your free shots go live the
                  moment you finish — you can add more whenever you want.
                </>
              )}
            </p>
          </div>
        ) : null}

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
        {interactive
          ? 'Nothing is charged now, and finishing never waits on a payment. You can add more from your studio whenever you want.'
          : 'No payment in this step. Upgrades live in your studio, whenever you want them.'}
      </p>
    </div>
  );
}
