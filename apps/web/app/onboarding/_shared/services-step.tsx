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
 * long note in lib/onboarding-services-selection.ts — that module owns all of this
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
  poolPriceAt,
  poolListPriceAt,
  poolShotsAt,
  poolStepCount,
  poolStepOf,
  quoteServicesStepSelection,
  quoteServicesStepLaterSelection,
  setAi,
  stepPool,
  type ServicesStepSelection,
} from '@/lib/onboarding-services-selection';

/** Copy that varies by product but not by event — keyed on the stable id. */
const TYPE_COPY: Record<
  PapicTypeView['id'],
  { title: string; kind: string; desc: string; note?: string; Icon: typeof Users }
> = {
  pool: {
    title: 'Papic',
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
  // ⚠ A DEAD KEY, KEPT ONLY TO SATISFY THE TYPE. `papicView` stopped emitting a
  // 'one' entry on 2026-08-11, so nothing here can render — but the id union
  // still allows 'one' (the data-layer tests build such views on purpose, to
  // prove the reader survives a stored pre-change draft), and a Record over that
  // union must cover it. Do not read this as a live product.
  one: {
    title: 'Papic',
    kind: 'Dedicated camera · its own QR',
    desc:
      'A named camera with its own QR and its own shots — for your best friend, ' +
      'your ninang, the one person you trust to catch everything. Their shots ' +
      'never draw from the shared pool.',
    // ⚠ "the same rungs" (plural) was true of the retired two-rung ladder.
    // Papic One has had ONE price since 2026-08-11, and a reload buys exactly
    // the same thing at exactly the same price — which is simpler to say and is
    // the actual product rule, not a simplification of it.
    note:
      'One free camera to try it — then add as many dedicated cameras as you ' +
      'want, and top any of them up for the same price when they run low. No ' +
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

/**
 * The live price of whatever is currently picked, or the free label.
 *
 * ⚖ Owner, 2026-08-28: *"we give them a 10% discount if they purchase now. They
 * can order later, but they will lose the 10% discount."* The saving is stated
 * on the line where the money is, and the later price is named — a discount that
 * does not say what you are saving it against is just a price.
 *
 * ⛔ NO INVENTED "WAS" PRICE. `listPricePhp` equals `pricePhp` on a rung with no
 * sign-up discount, so this whole block simply does not render there. Showing a
 * struck-through figure nobody has ever been charged is the oldest trick in
 * retail, and it is not one we are doing.
 */
function PriceLine({ pricePhp, listPricePhp }: { pricePhp: number; listPricePhp?: number }) {
  const saving = listPricePhp != null && listPricePhp > pricePhp ? listPricePhp - pricePhp : 0;
  return pricePhp > 0 ? (
    <>
      <p className="mt-3 flex items-baseline justify-between gap-3 rounded-[var(--m-r-sm)] bg-ink/[0.03] px-3 py-2">
        <span className="text-sm text-ink/65">You&rsquo;ll pay</span>
        <span className="flex items-baseline gap-2">
          {saving > 0 && (
            <span className="font-mono text-xs tabular-nums text-ink/40 line-through">
              {peso(listPricePhp!)}
            </span>
          )}
          <span className="font-mono text-base font-semibold tabular-nums text-ink">
            {peso(pricePhp)}
          </span>
        </span>
      </p>
      {saving > 0 && (
        <p className="mt-1.5 text-center text-xs text-terracotta-700">
          You save {peso(saving)} by adding it now — it&rsquo;s {peso(listPricePhp!)} later.
        </p>
      )}
    </>
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
  selection: ServicesStepSelection;
  onChange: (next: ServicesStepSelection) => void;
  eventWord: string;
}) {
  const step = poolStepOf(type, selection);
  const last = poolStepCount(type) - 1;
  // What the NEXT press actually buys — the DELTA in shots and the price of the
  // rung it lands on.
  //
  // 🔴 WITHOUT THIS LINE THE CARD HAS NO PRICE ON IT UNTIL YOU PRESS SOMETHING.
  // The owner reported "no way to add shots for papic" (2026-08-20) on a card
  // whose control was present and working: at rest it read "50 shots · Yours
  // already", "Included — Free", "Papic — Free", and every other word said the
  // thing was already his. The only purchase affordance was a bare `+` whose
  // sole "add shots" wording was its aria-label, which a sighted person never
  // sees. Reading that as "there is no way to buy here" was CORRECT — the
  // control was not hidden, it was contradicted.
  const nextShots = step < last ? poolShotsAt(type, step + 1) - poolShotsAt(type, step) : 0;
  const nextPrice = step < last ? poolPriceAt(type, step + 1) : 0;
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
      <PriceLine pricePhp={poolPriceAt(type, step)} listPricePhp={poolListPriceAt(type, step)} />
      {step < last ? (
        <p className="mt-2 text-center text-xs text-ink/60">
          Press <span className="font-semibold text-ink">+</span> to add{' '}
          <span className="font-semibold text-ink">{pts(nextShots)}</span> more for{' '}
          <span className="font-semibold text-ink">{peso(nextPrice)}</span>.
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-ink/45">
          That&rsquo;s the biggest pool we sell in one go — you can add more later from
          your Papic studio.
        </p>
      )}
    </div>
  );
}

// OnePicker — "how many dedicated cameras, and at which size" — stood here.
//
// DELETED 2026-08-11: Papic is one product. Cameras are free and unlimited,
// and a dedicated camera is made in the studio by handing it shots the couple
// already owns. A stepper whose only legal answer is zero is a fake door.

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
  selection?: ServicesStepSelection;
  onSelectionChange?: (next: ServicesStepSelection) => void;
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

      {interactive && type.id === 'pool' ? (
        // The controls REPLACE the ladder rather than sitting under it. Showing
        // both would print every rung's price beside a stepper that already
        // states the one being charged — two answers to "what does this cost".
        //
        // Only 'pool' is interactive: it is the ONE thing on this screen a
        // couple buys. Anything else falls through to the read-only ladder
        // below rather than to a control — which is what a retired product
        // should look like on the screen where money is chosen.
        <PoolPicker
          type={type}
          selection={selection}
          onChange={onSelectionChange}
          eventWord={eventWord}
        />
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
  selection?: ServicesStepSelection;
  onSelectionChange?: (next: ServicesStepSelection) => void;
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
        ? quoteServicesStepSelection(papic.types, selection, ai?.pricePhp ?? null)
        : { poolPhp: 0, aiPhp: 0, papicPhp: 0, totalPhp: 0 },
    [papic.types, selection, ai],
  );

  /**
   * What everything on this screen would cost if they came back for it later.
   * Zero when nothing is picked, and zero when nothing carries a discount — so
   * the saving line disappears on its own rather than announcing "save ₱0".
   */
  const laterPhp = useMemo(
    () =>
      selection
        ? quoteServicesStepLaterSelection(papic.types, selection, ai?.listPricePhp ?? ai?.pricePhp ?? null)
        : 0,
    [papic.types, selection, ai],
  );
  const savingPhp = Math.max(0, laterPhp - quote.totalPhp);

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {/*
        ── THE DISCOUNT HAS TO BE READABLE, AND SO DOES ITS DEADLINE ─────────
        Owner, 2026-08-28: *"Onboarding discount should be visible and easy to
        understand that this discount only applies on onboarding."*

        🔑 A DISCOUNT NOBODY NOTICES IS A DISCOUNT WE PAID FOR AND DID NOT SELL,
        and one whose deadline is not stated is one somebody feels tricked by
        later. So it is said three times, in the three places a person actually
        looks: here before they choose, on each item as they choose it, and on
        the total when they are about to agree.

        ⚖ "AT LEAST 10%" IS DELIBERATE. The owner's rule is 10% (*"10% for all
        purchase on onboarding"*), and Setnayan AI already carries a deeper
        sign-up price — 40%, and 44% on the birthday tier. Advertising a flat
        "10% off" beside a card giving 40% would understate our own offer;
        promising more than 10% would over-claim on the Papic rungs. The floor is
        the honest word for a floor.
      */}
      {interactive && (
        <p className="rounded-[var(--m-r-lg)] border border-terracotta/30 bg-terracotta/[0.07] px-4 py-3 text-sm leading-relaxed text-ink">
          <span className="font-semibold">
            Anything you add here is at least 10% off.
          </span>{' '}
          This is a set-up price — it ends when you finish. You can always add these
          later from your studio, at the normal price.
        </p>
      )}

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

        {/* The Papic subtotal stays INSIDE the Papic card. The grand total,
            with Setnayan AI on its own line, sits below both cards. */}
        {interactive ? (
          <p className="mt-4 flex items-baseline justify-between gap-3 rounded-[var(--m-r-md)] border border-ink/12 bg-ink/[0.02] px-4 py-3">
            <span className="text-sm font-semibold text-ink">Papic</span>
            <span className="font-sans text-xl font-semibold tabular-nums text-ink">
              {quote.papicPhp > 0 ? peso(quote.papicPhp) : 'Free'}
            </span>
          </p>
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
          Guests shoot with any phone — nothing to install. Add shots here now, or top
          up later from your Papic studio.
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
          <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
            {ai.listPricePhp > ai.pricePhp && (
              <span className="font-mono text-sm tabular-nums text-ink/40 line-through">
                {peso(ai.listPricePhp)}
              </span>
            )}
            <span className="font-mono text-lg font-semibold tabular-nums text-ink">
              {ai.priceLabel}
            </span>
            <span className="text-xs text-ink/45">
              one-time · yours through your {eventWord}
            </span>
          </p>
          {/* The planner's sign-up saving is the biggest on the screen and was
              the only one not stated. Rendered from the same comparison as the
              rungs, so a type with no discount says nothing at all. */}
          {ai.listPricePhp > ai.pricePhp && (
            <p className="mt-1 text-xs text-terracotta-700">
              {peso(ai.listPricePhp - ai.pricePhp)} off while you&rsquo;re setting up —
              it&rsquo;s {peso(ai.listPricePhp)} later.
            </p>
          )}

          {/* The nine wired capabilities, type-aware (#3865). Never re-authored here. */}
          {aiValue ? <div className="mt-4">{aiValue}</div> : null}

          {/* ── THE TICK (owner 2026-08-11) ───────────────────────────────
              Only where the flow can take the order, exactly like the Papic
              steppers. Off by default: on many event types this single line is
              worth ten times the whole Papic side, so pre-ticking it would be
              adding the expensive thing to a couple's bill on their behalf.
              Elsewhere the card keeps its original "find it in your studio"
              wording, because a tick that charges nothing is a fake door. */}
          {interactive ? (
            <button
              type="button"
              role="switch"
              aria-checked={selection.ai}
              onClick={() => onSelectionChange(setAi(selection, !selection.ai))}
              className={`mt-5 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                selection.ai
                  ? 'border-terracotta bg-terracotta/[0.07]'
                  : 'border-ink/15 hover:border-ink/30'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                  selection.ai
                    ? 'border-terracotta bg-terracotta text-cream'
                    : 'border-ink/25'
                }`}
                aria-hidden
              >
                {selection.ai ? '✓' : ''}
              </span>
              <span className="flex-1 text-sm font-medium text-ink">
                {selection.ai ? 'Added to your plan' : `Add Setnayan AI to my ${eventWord}`}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                {ai.priceLabel}
              </span>
            </button>
          ) : aiHref ? (
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

      {/* ── WHAT THEY OWE, AS TWO LINES ───────────────────────────────────
          Owner 2026-08-11, confirming the split: *"yes it can be just 50 and
          499"*. Papic and the planner are shown SEPARATELY and only summed at
          the end, because on most event types Papic is a few tens of pesos and
          the planner is several hundred — one blended number reads as though
          Papic is what got expensive. It also states the FREE case in words: a
          couple who touches nothing must be able to READ that they owe nothing
          and still have a working event, not infer it from a missing figure. */}
      {interactive ? (
        <div className="rounded-[var(--m-r-lg)] border border-ink/12 bg-paper p-5 sm:p-6">
          <dl className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ink/70">Papic</dt>
              <dd className="font-mono text-sm tabular-nums text-ink/80">
                {quote.papicPhp > 0 ? peso(quote.papicPhp) : 'Free'}
              </dd>
            </div>
            {ai ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-ink/70">Setnayan AI</dt>
                <dd className="font-mono text-sm tabular-nums text-ink/80">
                  {quote.aiPhp > 0 ? peso(quote.aiPhp) : 'Not added'}
                </dd>
              </div>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-3">
              <dt className="text-sm font-semibold text-ink">Your total today</dt>
              <dd className="font-sans text-2xl font-semibold tabular-nums text-ink">
                {quote.totalPhp > 0 ? peso(quote.totalPhp) : 'Free'}
              </dd>
            </div>
            {savingPhp > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-terracotta-700">
                  You save by setting up now
                </dt>
                <dd className="font-mono text-sm font-semibold tabular-nums text-terracotta-700">
                  &minus;{peso(savingPhp)}
                </dd>
              </div>
            )}
          </dl>
          {savingPhp > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-ink/60">
              The same things cost {peso(laterPhp)} if you add them later. This price
              is only while you&rsquo;re setting up.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-ink/55">
            {quote.totalPhp > 0 ? (
              <>
                We&rsquo;ll show you where to send it right after this — your {eventWord}{' '}
                and your free shots are live either way, and what you added arrives once
                your payment is confirmed.
              </>
            ) : (
              <>
                Nothing to pay. Your {eventWord} and your free shots go live the moment
                you finish — you can add more whenever you want.
              </>
            )}
          </p>
        </div>
      ) : null}

      <p className="text-center text-xs text-ink/45">
        {interactive
          ? 'Nothing is charged now, and finishing never waits on a payment. You can add more from your studio whenever you want.'
          : 'No payment in this step. Upgrades live in your studio, whenever you want them.'}
      </p>
    </div>
  );
}
