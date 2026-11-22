'use client';

import Link from 'next/link';
import { useId, useMemo, useRef, useState, useTransition, type ComponentType, type ReactNode } from 'react';
import { Camera, Check, ChevronDown, ChevronRight, ChevronUp, Gem, LayoutTemplate, Radio, Sparkles, Wallet, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { Chips } from '@/app/_components/chips';
import { InfoTip } from '@/app/_components/info-tip';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { formatPhp } from '@/lib/php';
import { routes } from '@/lib/routes';
import { formatCount } from '@/lib/format-number';
import {
  EMPTY_PICK,
  PACK_HOLDS,
  PACK_PURPOSE,
  SINGLE_SHORT,
  SINGLE_WORDS,
  applySwitch,
  cartFor,
  packHoldsLine,
  shownPacks,
  singleTickable,
  singlesInPlan,
  switchOffer,
  type EventServicesFacts,
  type EventServicesPick,
  type PackFact,
  type PackKey,
  type SingleFact,
  type SingleKey,
} from '@/lib/event-services';

/**
 * 🛒 EVENT SERVICES — the one place to buy for an event (owner 2026-11-23; drawing
 * `prototypes/buy_event_services_one_place_2026-11-23/frames_v4_clean_warm/`, approved "Yes, build it"), on the clean
 * warm look (16 Nov · HOUSE_DESIGN_STANDARD): the peach band with the one 30-px title, floating white frames with no
 * lines, prices in the decision colour at the row's end, the saving in green under it, soft grey second buttons, the
 * one filled Pay.
 *
 *   Your plan · Pick a pack (or "Next pack" on a plan) · Or just what you need / Add to your pack · Orders and receipts
 *   · the cart bar → ONE order → the shipped `/pay/[reference]`.
 *
 * Draws only what it is handed (`EventServicesFacts`, read by `readEventServices`) — so the page and its lab
 * (`/dev/event-services-lab`) draw the same thing. Every peso is a read; `null` says "Couldn't read", never ₱0.
 */
export type EventServicesBodyProps = {
  eventId: string;
  facts: EventServicesFacts;
  ordersHref: string;
  /** A door's pick on arrival (`?plan=` · `?add=`) — closed values, already checked by the page. */
  initialPick?: EventServicesPick;
  /** Open the singles on arrival (a door for photos, Live Watch, Setnayan AI or the Event Hub). */
  initialOpen?: boolean;
  /** 🧪 The lab draws the frames without posting. */
  lab?: boolean;
  /** The way back when a door brought them (the Maker's Apply sheet) — drawn as a quiet row; null otherwise. */
  back?: { href: string; label: string } | null;
  /** 🧪 The lab's ⓘ frame: that pack's sheet open on arrival. */
  initialInfo?: PackKey | null;
};

/** The ONE order's post — `submitOrderAction` with the Event services intent (handed in by the page's body). */
export type SubmitEventServices = (
  fd: FormData,
) => Promise<{ ok: true; reference_code: string } | { ok: false; reason: string; needsAccount?: true }>;

/** Where the cart bar stands — the thumb dock on the page (`event-services-body.tsx`); a plain block in a unit test. */
export type CartDock = ComponentType<{ children: ReactNode }>;
const PlainDock: CartDock = ({ children }) => <div data-event-services-dock="">{children}</div>;

const ICON: Record<SingleKey, typeof Gem> = { hub: LayoutTemplate, ai: Sparkles, live: Radio };

/** A price, or the honest word when it was not read. */
function Price({ php, className = '' }: { php: number | null; className?: string }) {
  return php === null ? (
    <span className={`text-sn-md text-ink/55 ${className}`}>Couldn’t read</span>
  ) : (
    <span className={`whitespace-nowrap text-sn-xl font-bold text-mulberry ${className}`}>{formatPhp(php)}</span>
  );
}

/** The round mark at a row's start: the topic icon on a soft ground, or a filled ✓ when picked. */
function Mark({ on, Icon }: { on: boolean; Icon: typeof Gem }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-sn-control ease-sn ${
        on ? 'bg-mulberry text-cream' : 'bg-mulberry/10 text-mulberry'
      }`}
    >
      {on ? <Check className="h-5 w-5" strokeWidth={2.4} /> : <Icon className="h-5 w-5" strokeWidth={1.9} />}
    </span>
  );
}

function StateWord({ state }: { state: 'yours' | 'review' | 'plan' }) {
  if (state === 'review') return <span className="whitespace-nowrap text-sn-sm font-semibold text-ink/60">Being checked</span>;
  return (
    <span className="whitespace-nowrap rounded-full bg-success-100 px-2 py-1 text-sn-sm font-semibold text-success-800">
      {state === 'plan' ? 'In your plan' : 'Yours'}
    </span>
  );
}

export function EventServicesView({
  eventId,
  facts,
  ordersHref,
  initialPick = EMPTY_PICK,
  initialOpen = false,
  lab = false,
  initialInfo = null,
  back = null,
  Dock = PlainDock,
  submit,
}: EventServicesBodyProps & { Dock?: CartDock; submit?: SubmitEventServices }) {
  const [pick, setPick] = useState<EventServicesPick>(initialPick);
  const [open, setOpen] = useState(initialOpen || (facts.plan !== null && facts.plan !== 'free'));
  const [info, setInfo] = useState<PackFact | null>(() => (initialInfo ? facts.packs.find((p) => p.key === initialInfo) ?? null : null));
  const [failed, setFailed] = useState<string | null>(null);
  const [paying, startPaying] = useTransition();
  const infoHead = useId();
  // The singles grow in place and the page brings them into view on a press (the house reveal, never a hand-rolled one).
  const singlesRef = useRef<HTMLElement>(null);
  const revealSingles = useRevealOnOpen(open, () => ({ head: singlesRef.current }));

  const { title: packsTitle, packs } = useMemo(() => shownPacks(facts), [facts]);
  const onPlan = facts.plan !== null && facts.plan !== 'free';
  const inPlan = singlesInPlan(facts.plan, pick.pack);
  const cart = cartFor(facts, pick);
  const offer = switchOffer(facts, pick);
  const singlesTitle = pick.pack || onPlan ? 'Add to your pack' : 'Or just what you need';

  const togglePack = (k: PackKey) =>
    setPick((p) => {
      const pack = p.pack === k ? null : k;
      // A pack takes the singles it holds out of the cart — they read "In your plan".
      return { ...p, pack, singles: pack ? p.singles.filter((s) => !PACK_HOLDS[pack].includes(s)) : p.singles };
    });
  const toggleSingle = (k: SingleKey) =>
    setPick((p) => ({ ...p, singles: p.singles.includes(k) ? p.singles.filter((s) => s !== k) : [...p.singles, k] }));
  const pickPhotos = (code: string, next: boolean) => setPick((p) => ({ ...p, photos: next ? code : null }));

  const pay = () => {
    if (lab || !submit || cart.totalPhp === null) return;
    setFailed(null);
    startPaying(async () => {
      const fd = new FormData();
      fd.set('intent', 'event_services');
      fd.set('event_id', eventId);
      fd.set('pick', JSON.stringify(pick));
      fd.set('shown_total_centavos', String(Math.round((cart.totalPhp as number) * 100)));
      try {
        const r = await submit(fd);
        if (r.ok) {
          window.location.assign(`/pay/${encodeURIComponent(r.reference_code)}`);
          return;
        }
        if (r.needsAccount) {
          window.location.assign(`/signup?next=${encodeURIComponent(routes.dashboard.eventServices(eventId))}`);
          return;
        }
        setFailed(r.reason);
      } catch {
        setFailed('We could not reach Setnayan. Nothing was charged.');
      }
    });
  };

  const photosLine =
    pick.photos || pick.pack
      ? cart.photosAfter === null
        ? null
        : { word: 'After this:', n: cart.photosAfter }
      : facts.photosLeft === null
        ? null
        : { word: 'You have', n: facts.photosLeft };
  const photoSize = pick.photos ? facts.photos?.find((p) => p.code === pick.photos) ?? null : null;

  return (
    <section className="mx-auto w-full max-w-[760px] pb-8" data-event-services="" data-event-services-plan={facts.plan ?? 'unread'}>
      {/* ── the peach band: the event's line and the one title ── */}
      <div className="sn-band -mt-2 px-4 pb-4 pt-3 sm:rounded-b-2xl" data-event-services-band="">
        {facts.eyebrow ? <p className="text-sn-md text-ink/60">{facts.eyebrow}</p> : null}
        <p aria-hidden className="sn-screen-title mt-1 text-ink">
          Event services
        </p>
      </div>

      <div className="space-y-6 px-4 pt-2">
        {/* ── Your plan ── */}
        <div className="sn-frame" data-event-services-your-plan="">
          <p className="text-sn-md text-ink/60">Your plan</p>
          <p className="mt-1 text-sn-3xl font-bold text-ink">{facts.planName ?? 'Couldn’t read'}</p>
          <p className="mt-1 text-sn-base text-ink/70">
            {facts.photosLeft === null ? 'Guest photos left: couldn’t read' : `${formatCount(facts.photosLeft)} guest photos left`}
          </p>
        </div>

        {/* ── the packs ── */}
        {packs.length > 0 ? (
          <section aria-labelledby={`${infoHead}-packs`} data-event-services-packs="">
            <div className="mb-3 flex items-center justify-between">
              <InfoTip
                label={packsTitle}
                labelAs="h2"
                labelId={`${infoHead}-packs`}
                labelClassName="text-sn-xl font-semibold text-ink"
                align="end"
                className="w-full justify-between"
              >
                A pack holds several services for less than buying each one. Its ⓘ lists everything inside.
              </InfoTip>
            </div>
            <ul className="sn-frame flex flex-col gap-1 !p-2">
              {packs.map((p) => {
                const picked = pick.pack === p.key;
                const buyable = p.state === 'buy' && p.php !== null;
                const next = packsTitle === 'Next pack';
                return (
                  <li key={p.key} data-event-services-pack={p.key} data-picked={picked ? '' : undefined} data-state={p.state}>
                    {/* The whole row picks (a stretched button under the words); the ⓘ beside the name sits above it. */}
                    <div className={`relative flex items-start gap-3 rounded-xl p-3 transition-colors duration-sn-control ease-sn ${picked ? 'bg-mulberry/10' : ''}`}>
                      <button
                        type="button"
                        className="sn-press absolute inset-0 rounded-xl disabled:cursor-default"
                        aria-pressed={picked}
                        aria-label={`${p.name}${p.php !== null && p.state === 'buy' ? `, ${formatPhp(p.php)}` : ''}`}
                        disabled={!buyable}
                        onClick={() => togglePack(p.key)}
                      />
                      <Mark on={picked} Icon={Gem} />
                      <span className="pointer-events-none min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sn-xl font-semibold text-ink">{p.name}</span>
                          {/* The house ⓘ's look, token for token (`there-is-one-info-dot.test.ts` lists this site): it opens the
                              pack's full list in the page's one sheet, which <InfoTip>'s hover note cannot hold. */}
                          <button
                            type="button"
                            className="sn-press sn-press-ring sn-dot-btn pointer-events-auto relative z-10 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition-all duration-sn-control ease-sn hover:border-terracotta hover:text-terracotta aria-expanded:border-terracotta aria-expanded:text-terracotta"
                            aria-label={`What’s in ${p.name}`}
                            aria-haspopup="dialog"
                            aria-expanded={info?.key === p.key}
                            onClick={() => setInfo(p)}
                            data-event-services-info-open={p.key}
                          >
                            <span aria-hidden="true">i</span>
                          </button>
                        </span>
                        <span className="mt-0.5 block text-sn-base leading-snug text-ink/75">
                          {PACK_PURPOSE[p.key]}
                          {p.fits ? <span className="font-semibold text-ink"> {p.fits}</span> : null}
                        </span>
                        <span className="mt-0.5 block text-sn-md text-ink/55">{packHoldsLine(p, next, facts.plan)}</span>
                      </span>
                      <span className="pointer-events-none flex shrink-0 flex-col items-end gap-1 pt-1">
                        {p.state === 'buy' ? (
                          <>
                            <Price php={p.php} />
                            {next && p.php !== null ? (
                              <span className="text-sn-sm text-ink/55">pay the difference</span>
                            ) : p.savePhp !== null ? (
                              <span className="whitespace-nowrap text-sn-sm font-bold text-success-700">Save {formatPhp(p.savePhp)}</span>
                            ) : null}
                          </>
                        ) : (
                          <StateWord state={p.state} />
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* ── the singles: the quieter second choice ── */}
        <section ref={singlesRef} aria-labelledby={`${infoHead}-singles`} data-event-services-singles={open ? 'open' : 'closed'}>
          <div className="flex items-center justify-between gap-3">
            <h2 id={`${infoHead}-singles`} className="text-sn-lg font-medium text-ink/70">
              {singlesTitle}
            </h2>
            <ActionButton
              tone="neutral"
              icon={open ? ChevronUp : ChevronDown}
              label={open ? 'Hide' : 'Show'}
              aria-expanded={open}
              onClick={() => {
                if (!open) revealSingles();
                setOpen((o) => !o);
              }}
            />
          </div>
          {open ? (
            <div className="sn-frame mt-3 !p-2">
              <ul className="flex flex-col gap-1">
                {facts.singles.map((s) => (
                  <SingleRow key={s.key} s={s} inPlan={inPlan.has(s.key)} picked={pick.singles.includes(s.key) && singleTickable(s, inPlan)} onToggle={() => toggleSingle(s.key)} />
                ))}
              </ul>
              {/* More guest photos · Papic — the sizes on sale */}
              <div className="p-3" data-event-services-photos="">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry">
                    <Camera className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <p className="text-sn-lg font-semibold text-ink">
                    More guest photos <span className="font-normal text-ink/55">· Papic</span>
                  </p>
                </div>
                {facts.photos === null ? (
                  <p className="mt-3 text-sn-md text-ink/60">The photo sizes couldn’t be read. Try again in a moment.</p>
                ) : facts.photos.length > 0 ? (
                  <Chips
                    className="mt-3"
                    label="Photo sizes"
                    data="event-services-photos"
                    options={facts.photos.map((p) => ({ key: p.code, label: formatCount(p.points), ariaLabel: `${formatCount(p.points)} photos, ${formatPhp(p.php)}` }))}
                    value={pick.photos ? [pick.photos] : []}
                    onToggle={pickPhotos}
                  />
                ) : null}
                <p className="mt-3 flex items-baseline justify-between gap-3 text-sn-md text-ink/70">
                  <span>
                    {photosLine ? (
                      <>
                        {photosLine.word} <span className="font-semibold text-ink">{formatCount(photosLine.n)} photos</span>
                      </>
                    ) : (
                      'Photos left: couldn’t read'
                    )}
                  </span>
                  {photoSize ? <Price php={photoSize.php} className="!text-sn-lg" /> : null}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {/* ── the Switch line: ticked singles a pack holds for less ── */}
        {offer ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-info-50 p-3" data-event-services-switch={offer.pack}>
            <p className="text-sn-md text-ink/80">
              <span className="font-semibold text-ink">
                {offer.name} has {offer.holds.length === 2 ? 'both' : 'all of them'}
              </span>
              {offer.extraPhotos ? `, plus ${formatCount(offer.extraPhotos)} photos,` : ''} for {formatPhp(offer.lessPhp)} less.
            </p>
            <ActionButton tone="neutral" icon={Gem} label="Switch" onClick={() => setPick((p) => applySwitch(p, offer))} />
          </div>
        ) : null}

        {back ? (
          <Link href={back.href} className="sn-press flex min-h-11 items-center justify-between text-sn-lg text-ink/70 hover:text-ink" data-event-services-back="">
            {back.label}
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        ) : null}
        <Link href={ordersHref} className="sn-press flex min-h-11 items-center justify-between text-sn-lg text-ink/70 hover:text-ink" data-event-services-orders="">
          Orders and receipts
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>

      {/* ── the cart bar: ONE order, ONE Pay ── */}
      {cart.lines.length > 0 ? (
        <Dock>
            <div className="sn-glass-row flex w-full min-w-0 items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5" data-event-services-cart="">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sn-md font-semibold leading-snug text-ink">{cart.label}</span>
                <span className="block text-sn-sm text-ink/60">
                  {failed ? (
                    <span className="text-warn-800">{failed}</span>
                  ) : cart.totalPhp === null ? (
                    'A price couldn’t be read'
                  ) : (
                    `${formatPhp(cart.totalPhp)} · one payment`
                  )}
                </span>
              </span>
              <ActionButton
                tone="brand"
                main
                icon={failed ? X : Wallet}
                label={failed ? 'Try again' : 'Pay'}
                waiting={paying || cart.totalPhp === null}
                onClick={pay}
                data-event-services-pay=""
              />
            </div>
        </Dock>
      ) : null}

      {/* ── ⓘ: what's in a pack — the only sheet on the page ── */}
      <Sheet open={info !== null} onClose={() => setInfo(null)} labelledById={`${infoHead}-info`}>
        {info ? (
          <div className="space-y-4 px-5 pb-5 pt-1" data-event-services-info={info.key}>
            <h2 id={`${infoHead}-info`} className="text-sn-2xl font-bold text-ink">
              What’s in {info.name}
            </h2>
            <ul className="space-y-2 text-sn-base text-ink/80">
              {info.info.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-mulberry" strokeWidth={2.2} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <ActionButton tone="neutral" quiet icon={X} label="Close" onClick={() => setInfo(null)} />
              {info.state === 'buy' && info.php !== null ? (
                <ActionButton
                  tone="brand"
                  main
                  icon={Check}
                  label={`Pick ${info.name}`}
                  onClick={() => {
                    if (pick.pack !== info.key) togglePack(info.key);
                    setInfo(null);
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}

function SingleRow({ s, inPlan, picked, onToggle }: { s: SingleFact; inPlan: boolean; picked: boolean; onToggle: () => void }) {
  const words = SINGLE_WORDS[s.key];
  const tickable = s.state === 'buy' && s.php !== null && !inPlan;
  return (
    <li data-event-services-single={s.key} data-picked={picked ? '' : undefined}>
      <button
        type="button"
        className={`sn-press flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors duration-sn-control ease-sn disabled:cursor-default ${picked ? 'bg-mulberry/10' : ''}`}
        aria-pressed={tickable ? picked : undefined}
        aria-label={`${SINGLE_SHORT[s.key]}${tickable ? '' : inPlan ? ', in your plan' : ''}`}
        disabled={!tickable}
        onClick={onToggle}
      >
        <Mark on={picked} Icon={ICON[s.key]} />
        <span className="min-w-0 flex-1">
          <span className="block text-sn-lg font-semibold text-ink">
            {words.name}
            {words.brand ? <span className="font-normal text-ink/55"> · {words.brand}</span> : null}
          </span>
          <span className="block text-sn-md leading-snug text-ink/65">{words.line}</span>
        </span>
        <span className="shrink-0 pt-0.5">
          {inPlan ? <StateWord state="plan" /> : s.state !== 'buy' ? <StateWord state={s.state} /> : <Price php={s.php} className="!text-sn-lg" />}
        </span>
      </button>
    </li>
  );
}
