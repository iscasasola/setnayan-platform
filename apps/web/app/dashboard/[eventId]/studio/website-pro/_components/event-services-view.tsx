'use client';

import Image from 'next/image';
import Link from 'next/link';
import { createContext, useContext, useId, useMemo, useRef, useState, useTransition, type ComponentType, type ReactNode } from 'react';
import { ArrowRight, Check, RotateCw, ChevronDown, ChevronRight, Wallet, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Chips } from '@/app/_components/chips';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { formatPhp } from '@/lib/php';
import { routes } from '@/lib/routes';
import { IAP_COPY, pendingLine, type IapScreen } from '@/lib/iap/iap-outcome';
import { formatCount } from '@/lib/format-number';
import {
  EMPTY_PICK,
  PACK_HOLDS,
  PACK_PURPOSE,
  SERVICE_PICTURE,
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
  type PackKey,
  type SingleFact,
  type SingleKey,
} from '@/lib/event-services';

/**
 * 🛒 EVENT SERVICES — the one place to buy for an event (owner 2026-11-23), in the WEBSITE template: DECISION_LOG
 * "EVENT SERVICES v5 (WEBSITE TEMPLATE) APPROVED, WITH THE TODAY DOOR"; drawing
 * `prototypes/buy_event_services_one_place_2026-11-23/frames_v5_website/` + `strip-v5.jpg` (HOUSE_DESIGN_STANDARD Part H,
 * Discover's own tokens). v4's functions, unchanged; only the look moved:
 *
 *   a white page · the event's mono kicker and the one 28-px title · plan rows split by hairlines (no boxes, no cards)
 *   · a tick circle at each row's start (v5's one new piece) · the price 17/700 at the row's end, the saving an outlined
 *   tag · the ⓘ opening the pack's list IN PLACE in a note box · the singles with the Pricing page's small pictures ·
 *   32-px chips · a flat Pay bar with the ONE terracotta button.
 *
 *   Your plan · Pick a pack (or "Next pack" on a plan) · Or just what you need / Add to your pack · Orders and receipts
 *   · the cart bar → ONE order → the shipped `/pay/[reference]`.
 *
 * The look is `event-services-website.css` (scoped to `[data-event-services]` and the cart bar; loaded by the page and
 * its lab, never by a unit render). Draws only what it is handed (`EventServicesFacts`, read by `readEventServices`) —
 * so the page and its lab (`/dev/pro-parts-lab?frame=services-…`) draw the same thing. Every peso is a read; `null`
 * says "Couldn't read", never ₱0.
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
  /** 🧪 The lab's ⓘ frame: that pack's list open in place on arrival. */
  initialInfo?: PackKey | null;
};

/** The ONE order's post — `submitOrderAction` with the Event services intent (handed in by the page's body). */
export type SubmitEventServices = (
  fd: FormData,
) => Promise<{ ok: true; reference_code: string } | { ok: false; reason: string; needsAccount?: true }>;

/**
 * 🍎 THE iPHONE APP (drawing v4 frames 08 · 08b · 08c · 08e · 08f): the same page with Apple's prices only — no web
 * price, no saving worked from web prices, no link out — and Event Hub and Setnayan AI alone hidden (no Apple product).
 * Pay runs Apple's own sheet once per ticked item, in order: the plan first, then the rest ("1 of 2 · Event Pro").
 * Handed in by the page's body (`event-services-body.tsx`), which owns StoreKit.
 */
export type AppleKit = {
  /** Catalogue code → App Store product id — only the products Apple sells (`lib/iap/products.ts`). */
  products: Readonly<Record<string, string>>;
  /** StoreKit's prices: 'silent' = the App Store did not answer, and the page says so. */
  prices: { state: 'loading' | 'ready' | 'silent'; display: ReadonlyMap<string, string> };
  /** One Apple payment — its one true outcome (`buyWithApple`). */
  buy: (productId: string) => Promise<IapScreen>;
  /** Read the event again (a purchase that landed changes "Your plan" and the packs). */
  refresh: () => void;
};

/** The facts as the app shows them: Apple's rows only, no web figure (a row Apple prices is tickable at 0 — never drawn). */
function appleFacts(f: EventServicesFacts, apple: AppleKit): EventServicesFacts {
  const has = (code: string) => Boolean(apple.products[code]);
  const priced = (code: string): number | null => {
    const id = apple.products[code];
    return id && apple.prices.display.has(id) ? 0 : null;
  };
  // 🍎 ONE plan per event in the app: Apple sells each plan whole and cannot charge "the difference", and the server
  // refuses a second plan for an event that holds one (`startAppStorePurchase`: owned / not_on_sale). So an event on a
  // plan is offered no pack here at all — never a "Next pack" whose Pay can only fail.
  const onPlan = f.plan !== null && f.plan !== 'free';
  return {
    ...f,
    packs: onPlan ? [] : f.packs.map((p) => ({ ...p, php: p.state === 'buy' ? priced(p.code) : null, savePhp: null, upgrade: false })),
    singles: f.singles.filter((x) => has(x.code)).map((x) => ({ ...x, php: x.state === 'buy' ? priced(x.code) : null })),
    photos: f.photos ? f.photos.filter((x) => has(x.code)).map((x) => ({ ...x, php: 0 })) : null,
  };
}

/** A pick less the lines Apple already confirmed. */
function withoutLines(pick: EventServicesPick, done: readonly { code: string }[], facts: EventServicesFacts): EventServicesPick {
  const gone = new Set(done.map((d) => d.code));
  const pack = pick.pack && gone.has(facts.packs.find((p) => p.key === pick.pack)?.code ?? '') ? null : pick.pack;
  const singles = pick.singles.filter((k) => !gone.has(facts.singles.find((x) => x.key === k)?.code ?? ''));
  return { pack, singles, photos: pick.photos && gone.has(pick.photos) ? null : pick.photos };
}

/** Apple's price for a catalogue code — StoreKit's own string, or the honest word. */
const AppleCtx = createContext<((code: string) => string | null) | null>(null);

/** Where the cart bar stands — the thumb dock on the page (`event-services-body.tsx`); a plain block in a unit test. */
export type CartDock = ComponentType<{ children: ReactNode }>;
const PlainDock: CartDock = ({ children }) => <div data-event-services-dock="">{children}</div>;

/** A price (17/700, tabular — the website's plan-row price), or the honest word when it was not read. */
function Price({ php, code }: { php: number | null; code?: string }) {
  const apple = useContext(AppleCtx);
  if (apple) {
    const label = code ? apple(code) : null;
    return label === null ? <span className="es-unread">Apple’s price</span> : <b className="es-price">{label}</b>;
  }
  return php === null ? <span className="es-unread">Couldn’t read</span> : <b className="es-price">{formatPhp(php)}</b>;
}

/** The tick circle at a row's start (v5's one new piece: the website has no "pick" control) — filled when picked. */
function Tick() {
  return (
    <span aria-hidden className="es-tick">
      <Check strokeWidth={2.6} />
    </span>
  );
}

/** The small outlined word (Part H "small tag"): Picked · Save · In your plan · Being checked. */
function Tag({ quiet = false, children }: { quiet?: boolean; children: ReactNode }) {
  return <em className={quiet ? 'es-tag es-tag-q' : 'es-tag'}>{children}</em>;
}

function StateWord({ state }: { state: 'yours' | 'review' | 'plan' }) {
  return <Tag quiet>{state === 'review' ? 'Being checked' : state === 'plan' ? 'In your plan' : 'Yours'}</Tag>;
}

/**
 * The ⓘ beside a row: it opens the row's full list IN PLACE, in a note box under the row (v5: "The ⓘ opens the full
 * list in a note box, in place" — no sheet). The house ⓘ's look, token for token (`there-is-one-info-dot.test.ts` lists
 * this site).
 */
function InfoDot({ name, open, onToggle, controls, marker }: { name: string; open: boolean; onToggle: () => void; controls: string; marker: string }) {
  return (
    <button
      type="button"
      className="sn-press sn-press-ring sn-dot-btn pointer-events-auto relative z-10 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition-all duration-sn-control ease-sn hover:border-terracotta hover:text-terracotta aria-expanded:border-terracotta aria-expanded:text-terracotta"
      aria-label={`What’s in ${name}`}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      data-event-services-info-open={marker}
    >
      <span aria-hidden="true">i</span>
    </button>
  );
}

export function EventServicesView({
  eventId,
  ordersHref,
  initialPick = EMPTY_PICK,
  initialOpen = false,
  lab = false,
  initialInfo = null,
  back = null,
  Dock = PlainDock,
  submit,
  apple = null,
  facts: shippedFacts,
}: Omit<EventServicesBodyProps, 'facts'> & { facts: EventServicesFacts; Dock?: CartDock; submit?: SubmitEventServices; apple?: AppleKit | null }) {
  /* 🍎 In the app every row is priced by Apple: a row Apple prices can be ticked (its web figure is never handed in —
     the page strips them), the others cannot; Event Hub and Setnayan AI alone have no Apple product and are not shown. */
  const facts = useMemo(() => (apple ? appleFacts(shippedFacts, apple) : shippedFacts), [shippedFacts, apple]);
  const [pick, setPick] = useState<EventServicesPick>(initialPick);
  const [open, setOpen] = useState(initialOpen || (facts.plan !== null && facts.plan !== 'free'));
  // ⓘ: the one pack whose full list is open IN PLACE, under its row (v5 — no sheet).
  const [info, setInfo] = useState<PackKey | null>(initialInfo);
  const [failed, setFailed] = useState<string | null>(null);
  const [paying, startPaying] = useTransition();
  const [step, setStep] = useState<{ at: number; of: number; label: string } | null>(null);
  const [appleNote, setAppleNote] = useState<{ tone: 'warn' | 'note'; text: string; retry: boolean } | null>(null);
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

  /* 🍎 Apple's sheet once per item, in the cart's order (plan first). Each item switches on as Apple confirms it; the
     first that does not go through stops the run — what landed stays, what did not stays picked, nothing more is
     charged (frames 08b · 08c · 08e). */
  const payWithApple = async () => {
    if (!apple || lab) return;
    setAppleNote(null);
    const lines = cart.lines.filter((l) => apple.products[l.code]);
    const done: typeof lines = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      setStep({ at: i + 1, of: lines.length, label: line.label });
      let screen: IapScreen;
      try {
        screen = await apple.buy(apple.products[line.code]!);
      } catch {
        screen = { kind: 'failed' };
      }
      if (screen.kind === 'on') {
        done.push(line);
        continue;
      }
      setStep(null);
      // What landed leaves the cart; what did not stays picked.
      setPick((p) => withoutLines(p, done, facts));
      const kept = done.length > 0 ? `${done.map((d) => d.label).join(' + ')} ${done.length === 1 ? 'is' : 'are'} yours. ` : '';
      const rest = lines.slice(i).map((l) => l.label).join(' + ');
      setAppleNote(
        screen.kind === 'pending'
          ? { tone: 'note', text: `${kept}${screen.askToBuy ? IAP_COPY.askToBuy : pendingLine(line.label, false)}`, retry: false }
          : screen.kind === 'refused'
            ? { tone: 'warn', text: `${kept}${screen.message}`, retry: true }
            : { tone: 'warn', text: `${kept}${rest} not bought. ${IAP_COPY.cancelled}`, retry: true },
      );
      if (done.length > 0) apple.refresh();
      return;
    }
    setStep(null);
    setPick(EMPTY_PICK);
    setAppleNote({ tone: 'note', text: `${lines.map((l) => l.label).join(' + ')} ${lines.length === 1 ? 'is' : 'are'} on this event. ${IAP_COPY.receipt}`, retry: false });
    apple.refresh();
  };

  const pay = () => {
    if (apple) {
      void payWithApple();
      return;
    }
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

  const appleLabel = useMemo(
    () => (apple ? (code: string) => (apple.products[code] ? (apple.prices.display.get(apple.products[code]!) ?? null) : null) : null),
    [apple],
  );
  const appleCount = apple ? cart.lines.filter((l) => apple.products[l.code]).length : 0;

  return (
    <AppleCtx.Provider value={appleLabel}>
    <section className="es" data-event-services="" data-event-services-apple={apple ? '' : undefined} data-event-services-plan={facts.plan ?? 'unread'}>
      {/* ── the head: the event's line (mono kicker) and the one title, on the white page — no band ── */}
      <div className="es-head" data-event-services-head="">
        {facts.eyebrow ? <p className="es-kick">{facts.eyebrow}</p> : null}
        {/* The one visible title (a real heading, so the event's loader may promise it); hidden from a screen reader,
            which hears the masthead's own h1 once. */}
        <h1 aria-hidden className="es-title">
          Event services
        </h1>
      </div>

      {/* 🍎 The honest states, in a note box (frames 08e · 08f): the App Store not answering, or a payment that did not
          go through — what landed is said, what did not stays picked, and Try again picks up where it stopped. */}
      {apple && apple.prices.state === 'silent' ? (
        <div className="es-note es-note-row" role="alert" data-event-services-apple-silent="">
          <p>{IAP_COPY.storeSilent}</p>
          <ActionButton tone="brand" quiet icon={RotateCw} label="Try again" onClick={() => window.location.reload()} />
        </div>
      ) : null}
      {appleNote ? (
        <div className="es-note es-note-row" role={appleNote.tone === 'warn' ? 'alert' : 'status'} data-event-services-apple-note={appleNote.tone}>
          <p>{appleNote.text}</p>
          {appleNote.retry && cart.lines.length > 0 ? <ActionButton tone="brand" quiet icon={RotateCw} label="Try again" onClick={pay} /> : null}
        </div>
      ) : null}

      {/* ── Your plan: a plan row — name and its line left, the plan right ── */}
      <div className="es-rows es-plan" data-event-services-your-plan="">
        <div className="es-row es-row-plan">
          <span className="es-words">
            <b className="es-name">Your plan</b>
            <span className="es-line">
              {facts.photosLeft === null ? 'Guest photos left: couldn’t read' : `${formatCount(facts.photosLeft)} guest photos left`}
            </span>
          </span>
          {facts.planName === null ? <span className="es-unread">Couldn’t read</span> : <b className="es-price">{facts.planName}</b>}
        </div>
      </div>

      {/* ── the packs: plan rows, a tick at the start, the saving as a small tag, the ⓘ opening its list in place ── */}
      {packs.length > 0 ? (
        <section className="es-part" aria-labelledby={`${infoHead}-packs`} data-event-services-packs="">
          <h2 id={`${infoHead}-packs`} className="es-sec">
            {packsTitle}
          </h2>
          {packsTitle === 'Next pack' ? null : <p className="es-lede">Each pack costs less than its parts.</p>}
          <ul className="es-rows">
            {packs.map((p) => {
              const picked = pick.pack === p.key;
              const buyable = p.state === 'buy' && p.php !== null;
              const next = packsTitle === 'Next pack';
              const opened = info === p.key;
              const noteId = `${infoHead}-info-${p.key}`;
              return (
                <li
                  key={p.key}
                  className={`es-item${picked ? ' es-on' : ''}${opened ? ' es-open' : ''}`}
                  data-event-services-pack={p.key}
                  data-picked={picked ? '' : undefined}
                  data-state={p.state}
                >
                  <div className="es-row es-row-pack">
                    {/* The whole row picks (a stretched button under the words); the ⓘ sits above it. */}
                    <button
                      type="button"
                      className="es-hit sn-press"
                      aria-pressed={picked}
                      aria-label={`${p.name}${p.php !== null && p.state === 'buy' ? `, ${formatPhp(p.php)}` : ''}`}
                      disabled={!buyable}
                      onClick={() => togglePack(p.key)}
                    />
                    <Tick />
                    <span className="es-words">
                      <b className="es-name">
                        {p.name}
                        {picked ? <Tag>Picked</Tag> : null}
                      </b>
                      <span className="es-line">
                        {PACK_PURPOSE[p.key]}
                        {p.fits ? ` ${p.fits}` : null}
                      </span>
                      <small className="es-small">{packHoldsLine(p, next, facts.plan)}</small>
                    </span>
                    <span className="es-end">
                      {p.state === 'buy' ? (
                        <>
                          <Price php={p.php} code={p.code} />
                          {apple ? null : next && p.php !== null ? (
                            <small className="es-small">pay the difference</small>
                          ) : p.savePhp !== null ? (
                            <Tag>Save {formatPhp(p.savePhp)}</Tag>
                          ) : null}
                        </>
                      ) : (
                        <StateWord state={p.state} />
                      )}
                    </span>
                    <InfoDot name={p.name} open={opened} onToggle={() => setInfo((k) => (k === p.key ? null : p.key))} controls={noteId} marker={p.key} />
                  </div>
                  {opened ? (
                    <div id={noteId} className="es-note es-note-list" data-event-services-info={p.key}>
                      <ul>
                        {p.info.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ── the singles: the quieter second choice — one terracotta line until opened, then plan rows with pictures ── */}
      <section ref={singlesRef} className={open ? 'es-part' : undefined} aria-labelledby={`${infoHead}-singles`} data-event-services-singles={open ? 'open' : 'closed'}>
        {open ? (
          <>
            <h2 id={`${infoHead}-singles`} className="es-sec">
              {singlesTitle}
            </h2>
            <ul className="es-rows">
              {facts.singles.map((s) => (
                <SingleRow key={s.key} s={s} inPlan={inPlan.has(s.key)} picked={pick.singles.includes(s.key) && singleTickable(s, inPlan)} onToggle={() => toggleSingle(s.key)} />
              ))}
              {/* More guest photos · Papic — the sizes on sale, as the website's chips */}
              <li className={`es-item${pick.photos ? ' es-on' : ''}`} data-event-services-photos="">
                <div className="es-row es-row-x">
                  <span className="es-pic">
                    <Image src={SERVICE_PICTURE.photos} alt="" width={48} height={48} sizes="48px" />
                    {pick.photos ? <Tick /> : null}
                  </span>
                  <span className="es-words">
                    <b className="es-name">More guest photos</b>
                    <span className="es-line">Papic · every guest’s phone is a camera.</span>
                  </span>
                  <span className="es-end">{photoSize ? <Price php={photoSize.php} code={photoSize.code} /> : <small className="es-small">pick a size</small>}</span>
                </div>
                {facts.photos === null ? (
                  <p className="es-fine es-indent">The photo sizes couldn’t be read. Try again in a moment.</p>
                ) : facts.photos.length > 0 ? (
                  <Chips
                    className="es-chips es-indent"
                    even={false}
                    label="Photo sizes"
                    data="event-services-photos"
                    options={facts.photos.map((p) => ({ key: p.code, label: formatCount(p.points), ariaLabel: `${formatCount(p.points)} photos, ${formatPhp(p.php)}` }))}
                    value={pick.photos ? [pick.photos] : []}
                    onToggle={pickPhotos}
                  />
                ) : null}
                <p className="es-fine es-indent">
                  {photosLine ? (
                    <>
                      {photosLine.word} <span className="es-strong">{formatCount(photosLine.n)} photos</span>
                    </>
                  ) : (
                    'Photos left: couldn’t read'
                  )}
                </p>
              </li>
            </ul>
          </>
        ) : (
          <button
            type="button"
            id={`${infoHead}-singles`}
            className="es-all sn-press"
            aria-expanded={false}
            onClick={() => {
              revealSingles();
              setOpen(true);
            }}
          >
            {singlesTitle}
            <ChevronDown aria-hidden strokeWidth={1.9} />
          </button>
        )}
      </section>

      {/* ── the Switch line: ticked singles a pack holds for less — a note box with its one link ── */}
      {offer ? (
        <div className="es-note es-note-row" data-event-services-switch={offer.pack}>
          <p>
            <b>
              {offer.name} has {offer.holds.length === 2 ? 'both' : 'all of them'}
            </b>
            {offer.extraPhotos ? `, plus ${formatCount(offer.extraPhotos)} photos,` : ''} for {formatPhp(offer.lessPhp)} less.
          </p>
          <ActionButton tone="brand" quiet icon={ArrowRight} label="Switch" onClick={() => setPick((p) => applySwitch(p, offer))} />
        </div>
      ) : null}

      {back ? (
        <Link href={back.href} className="es-ask sn-press" data-event-services-back="">
          {back.label}
          <ChevronRight aria-hidden strokeWidth={1.9} />
        </Link>
      ) : null}
      <Link href={ordersHref} className="es-ask sn-press" data-event-services-orders="">
        Orders and receipts
        <ChevronRight aria-hidden strokeWidth={1.9} />
      </Link>

      {/* 🍎 "1 of 2 · Event Pro" — Apple's own payment sheet opens over this; we only name the step (frames 08b · 08c). */}
      {step ? (
        <div className="es-step" role="status" aria-live="polite" data-event-services-apple-step={`${step.at}/${step.of}`}>
          <div className="es-step-sheet">
            <p className="es-kick">
              {formatCount(step.at)} of {formatCount(step.of)}
            </p>
            <p className="es-big">{step.label}</p>
            <p className="es-fine">Apple’s own payment sheet opens now.</p>
          </div>
        </div>
      ) : null}

      {/* ── the cart bar: ONE order, ONE Pay — flat on the page, a hairline above (no floating pill) ── */}
      {cart.lines.length > 0 ? (
        <Dock>
          <div className="es-paybar" data-event-services-cart="">
            <span className="es-paybar-t">
              <b>{cart.label}</b>
              <small>
                {apple ? (
                  appleCount === 1 ? `Apple’s price · ${IAP_COPY.billedByApple}` : `Apple’s prices · ${formatCount(appleCount)} Apple payments`
                ) : failed ? (
                  <span className="es-warn">{failed}</span>
                ) : cart.totalPhp === null ? (
                  'A price couldn’t be read'
                ) : (
                  `${formatPhp(cart.totalPhp)} · one payment`
                )}
              </small>
            </span>
            <ActionButton
              tone="brand"
              main
              icon={failed ? X : Wallet}
              label={failed ? 'Try again' : 'Pay'}
              waiting={apple ? step !== null || apple.prices.state !== 'ready' : paying || cart.totalPhp === null}
              onClick={pay}
              data-event-services-pay=""
            />
          </div>
        </Dock>
      ) : null}
    </section>
    </AppleCtx.Provider>
  );
}

function SingleRow({ s, inPlan, picked, onToggle }: { s: SingleFact; inPlan: boolean; picked: boolean; onToggle: () => void }) {
  const words = SINGLE_WORDS[s.key];
  const tickable = s.state === 'buy' && s.php !== null && !inPlan;
  return (
    <li className={`es-item${picked ? ' es-on' : ''}`} data-event-services-single={s.key} data-picked={picked ? '' : undefined}>
      <div className="es-row es-row-x">
        <button
          type="button"
          className="es-hit sn-press"
          aria-pressed={tickable ? picked : undefined}
          aria-label={`${SINGLE_SHORT[s.key]}${tickable ? '' : inPlan ? ', in your plan' : ''}`}
          disabled={!tickable}
          onClick={onToggle}
        />
        <span className="es-pic">
          <Image src={SERVICE_PICTURE[s.key]} alt="" width={48} height={48} sizes="48px" />
          {picked ? <Tick /> : null}
        </span>
        <span className="es-words">
          <b className="es-name">
            {words.name}
            {words.brand ? <span className="es-brand"> · {words.brand}</span> : null}
          </b>
          <span className="es-line">{words.line}</span>
        </span>
        <span className="es-end">{inPlan ? <StateWord state="plan" /> : s.state !== 'buy' ? <StateWord state={s.state} /> : <Price php={s.php} code={s.code} />}</span>
      </div>
    </li>
  );
}
