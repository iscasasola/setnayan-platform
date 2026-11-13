/**
 * front-door-landing.tsx — the signed-out front page below the hero.
 *
 * PORTED, NOT REDRAWN, from `prototypes/front_page_2026-11-04.html` (owner-approved 4 Nov 2026; DECISION_LOG
 * "THE THREE MARKETING PAGES GO TO CLOUD BUILD"). The prototype EXTENDS the shipped front door: the hero
 * (`front-door-anchor.tsx`), then, in this order —
 *
 *   #events        every kind of event — read from `event_type_vocab`, never listed here
 *   #sample        Maria and Jose, seen as two guests — only while the sample opens (see below)
 *   #shelves       the SHIPPED Discover shelves (`FrontDoorFeed`), handed in exactly as they render
 *   #solves        twenty problems, and what happens instead
 *   #coordinators  a band that sends coordinators to /for-coordinators
 *   #suppliers     a band that sends suppliers to /for-suppliers
 *   #plans         Free · Event Plus · Event Pro, and the add-ons
 *   the close, and the page's own footer (Privacy and Terms live here now — Google's homepage rule).
 *
 * Signed in, none of this renders: a member's `/` is Discover, unchanged (`front-door.tsx`).
 *
 * ─── MARIA AND JOSE, WITH NO BUTTON INTO THE SAMPLE ─────────────────────────────────────────────────────────
 * The owner ruled the marketing pages carry no demo or sample buttons — "just do not add buttons" (CLOUD_BOARD,
 * 5 Nov), not hidden behind a switch either. So the #sample section shows the two guests' pages (the shipped Hub,
 * as the prototype's screenshots) and what each one sees, and links nowhere into `/sample`; no other section does
 * either. Its names, its date and its guests are the fixtures' (`lib/sample-event/*`), never typed here.
 *
 * ─── NO PRICE IS TYPED HERE ──────────────────────────────────────────────────────────────────────────────
 * Event Plus and Event Pro are read from `platform_retail_catalog_v2` (`planPricesFrom`, below): Event Pro is
 * Event Hub Pro (`COUPLE_WEBSITE_PRO`), Event Plus is `EVENT_PLUS`. A row that is not on sale draws "per event"
 * and no figure, so Plus shows its price on its own the day its row goes on sale. The add-on tiles open their own
 * feature pages, which read the live catalogue. ₱0 is the free tier, not a price.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';

import { marketingPhoto } from '@/lib/front-page-photos';
import { eventTypePhotoSrc, type EventTypeRow } from '@/app/dashboard/(account)/create-event/_components/event-types';
import { readSampleEvent, readSampleGuest, SAMPLE_EVENT_ID } from '@/lib/sample-event/snapshot';
import { sampleDay, sampleGuestName, sampleMarchPlace } from '@/lib/sample-event/hub';
import { marchOrdinal } from '@/lib/march-place';
import { guestRoleLabel } from '@/lib/guests';
import { formatCount } from '@/lib/format-number';
import { formatPeso } from '@/lib/v2-catalog-pure';
import {
  ADD_ONS,
  COORDINATOR_TOOLS,
  FREE_PEEK,
  PLUS_MORE,
  PRO_PEEK,
  ULTRA_PEEK,
  freeGroups,
  plusPeek,
  proMore,
  ultraMore,
  type PlanFacts,
  SOLVES,
  SOLVES_SHOWN_FIRST,
  SUPPLIER_STAGES,
  SUPPLIER_TILES,
  type Solve,
} from './front-door-landing-data';
import { ExpandButton, Expandable, LandingMotion, PersonaViewer } from './front-door-landing-client';

/* ─── The sample, from its fixtures ─────────────────────────────────────────────────────────────── */

export type FrontPagePersona = {
  key: string;
  /** The "See it as" option. */
  option: string;
  who: string;
  title: string;
  line: string;
  points: string[];
  shot: string;
  alt: string;
};

export type FrontPageSample = { dateLabel: string; personas: FrontPagePersona[] };

/**
 * The two guests the front page shows, built from the Maria and Jose fixtures — the same rows
 * `/sample/hub/[guestKey]` draws. The copy is the prototype's; every name, role and place in the march
 * is read. The host (the third persona) is not drawn here: the prototype dropped it from the front page,
 * and the couple's own pages are the sample's slice S3.
 */
export function frontPageSample(now: Date): FrontPageSample | null {
  const sample = readSampleEvent(SAMPLE_EVENT_ID);
  if (!sample) return null;
  const personas: FrontPagePersona[] = [];
  for (const p of sample.personas) {
    if (!p.guestKey) continue;
    const g = readSampleGuest(p.guestKey);
    if (!g) continue;
    const name = sampleGuestName(g);
    const lower = p.title.charAt(0).toLowerCase() + p.title.slice(1);
    if (p.key === 'guest') {
      personas.push({
        key: p.key,
        option: `${lower} — a guest`,
        who: 'A guest',
        title: p.title,
        line: `${g.first_name} opens one link. No app, no sign-in. What is hers on that page:`,
        points: [
          'Her name on the invitation',
          'Her own ticket — shown once at the door',
          'Her table and seat, and who she sits with',
          'The whole program, the march and what to wear',
        ],
        shot: 'real-cousin',
        alt: `The real Event Hub page ${name}, ${lower}, opens: her invitation, ticket, table, the program, the entourage and the dress code`,
      });
    } else if (p.key === 'guest-with-role') {
      const role = guestRoleLabel(g.role, null);
      const place = sampleMarchPlace(g);
      personas.push({
        key: p.key,
        option: `${lower} — ${role.toLowerCase()}`,
        who: 'A guest with a role',
        title: p.title,
        line: `${g.first_name} gets everything the cousin gets, and because she is the ${role.toLowerCase()}, also:`,
        points: [
          `Her role on the invitation — ${role}`,
          ...(place ? [`Her place in the march — “you walk ${marchOrdinal(place.position)}”`] : []),
          'What to wear for her role',
          'An earlier call time, and her seat at the VIP table',
        ],
        shot: 'real-sister',
        alt: `The real Event Hub page ${name}, the ${role.toLowerCase()}, opens: her role, her place in the march, what to wear, her call time and her VIP seat`,
      });
    }
  }
  if (personas.length === 0) return null;
  return { dateLabel: sampleDay(now).label, personas };
}

/* ─── The two plan prices, from the price list ─────────────────────────────────────────────────────── */

/* Moved to `lib/event-plans.ts` (2026-11-13) so the in-app plan screen reads the SAME helpers; re-exported here so
   every existing import keeps working. 💎 Event Ultra (#7601) lives there too. */
export { PLAN_PRICE_CODES, planPricesFrom, planCreditsFrom, type PlanPrices } from '@/lib/event-plans';
import type { PlanPrices } from '@/lib/event-plans';

function PlanPrice({ php }: { php: number | null }) {
  if (php === null) return <span className="fl-price fl-price-none">per event</span>;
  return (
    <span className="fl-price">
      ₱{formatPeso(php)}
      <small>per event</small>
    </span>
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────────────────────────────────── */

function Head({
  kicker,
  id,
  title,
  lede,
  more,
}: {
  kicker: string;
  id: string;
  title: ReactNode;
  lede?: ReactNode;
  more?: { href: string; label: string };
}) {
  return (
    <div className="fl-head">
      <p className="fl-kicker">{kicker}</p>
      <h2 id={id}>{title}</h2>
      {lede ? <p className="fl-lede">{lede}</p> : null}
      {more ? (
        <Link className="fl-more" href={more.href}>
          {more.label}
        </Link>
      ) : null}
    </div>
  );
}

/** One marquee row of event types. Decorative: the same names are listed once, for screen readers, below. */
function EventTypeStrip({ types, reverse }: { types: readonly EventTypeTile[]; reverse?: boolean }) {
  const tile = (t: EventTypeTile, dup: boolean) => (
    <figure className={dup ? 'fl-et fl-et-dup' : 'fl-et'} key={`${dup ? 'b' : 'a'}-${t.key}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t.photo} alt="" loading="lazy" decoding="async" width={880} height={1100} />
      <figcaption>{t.label}</figcaption>
    </figure>
  );
  return (
    <div className={reverse ? 'fl-etrow fl-etrow-b' : 'fl-etrow'} aria-hidden="true">
      <div className="fl-ettrack">
        {types.map((t) => tile(t, false))}
        {types.map((t) => tile(t, true))}
      </div>
    </div>
  );
}

function SolveTagLine({ tag }: { tag: Solve['tag'] }) {
  if (!tag) return null;
  if (tag.kind === 'free') return <span className="fl-free">Free</span>;
  return <span className="fl-fine">{tag.text}</span>;
}

function Dots({ items }: { items: readonly string[] }) {
  return (
    <ul className="fl-dots">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function PlainList({ items }: { items: readonly string[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

/* ─── The landing ──────────────────────────────────────────────────────────────────────────────── */

export type EventTypeTile = { key: string; label: string; photo: string };

export function FrontDoorLanding({
  eventTypes,
  planPrices,
  planFacts,
  floorKitFree = false,
  sample,
  shelves,
}: {
  /** The creatable event types, in the roster's order (`getCreatableEventTypes`). */
  eventTypes: readonly Pick<EventTypeRow, 'key' | 'label' | 'heroPhotoUrl'>[];
  /** Event Plus and Event Pro from the price list (`planPricesFrom`). */
  planPrices: PlanPrices;
  /** The included credits and the free-credit sentence the plan cards may say (`planCreditsFrom` + the free grant). */
  planFacts: PlanFacts;
  /**
   * Is the coordinator's floor kit (live schedule · requests inbox · seat scanner) free right now? The caller asks
   * the paywall's own rule (`specializationFreeWindowActive`). Defaults to false — never claim free on a guess.
   */
  floorKitFree?: boolean;
  /** The sample's two guests, from its fixtures — null only if the fixtures cannot be read. */
  sample: FrontPageSample | null;
  /** The shipped Discover shelves, rendered by the caller. */
  shelves: ReactNode;
}) {
  // The app's one photo rule (`eventTypePhotoSrc`, #7271): an admin upload first, else the repo's 4 Nov render.
  const tiles: EventTypeTile[] = eventTypes.map((t) => ({ key: t.key, label: t.label, photo: eventTypePhotoSrc(t) }));
  const half = Math.ceil(tiles.length / 2);

  const FREE_GROUPS = freeGroups(planFacts);
  const PLUS_PEEK = plusPeek(planFacts);
  const PRO_MORE = proMore(planFacts);
  const freeItems = FREE_GROUPS.flatMap((g) => g.items);
  const plusItems = [...PLUS_PEEK, ...PLUS_MORE];
  const plusCount = plusItems.length + freeItems.length;
  const proCount = PRO_PEEK.length + PRO_MORE.length + plusCount;
  const ULTRA_MORE = ultraMore(planFacts);
  const proItems = [...PRO_PEEK, ...PRO_MORE];
  const ultraCount = ULTRA_PEEK.length + ULTRA_MORE.length + proCount;

  const total = SOLVES.length;

  return (
    <div className="fl-landing" id="fl-landing">
      <LandingMotion rootId="fl-landing" />

      {/* ════ EVERY KIND OF EVENT ════ */}
      {tiles.length > 0 ? (
        <section className="fl-sec fl-reveal fl-evtypes" id="events" aria-labelledby="h-events">
          <Head
            kicker="Every kind of event"
            id="h-events"
            title={<>From a christening to a company gala — {tiles.length} kinds, one place.</>}
            lede="Pick yours when you start. Setnayan sets up the right tools for it."
          />
          <EventTypeStrip types={tiles.slice(0, half)} />
          {tiles.length > half ? <EventTypeStrip types={tiles.slice(half)} reverse /> : null}
          <ul className="fd-sr-only">
            {tiles.map((t) => (
              <li key={t.key}>{t.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ════ ONE EVENT HUB, PERSONAL FOR EVERY GUEST — the centrepiece, with no button into the sample ════ */}
      {sample ? (
        <section className="fl-sec fl-reveal" id="sample" aria-labelledby="h-sample">
          <Head
            kicker="A sample wedding, three months out"
            id="h-sample"
            title="Same event. Each guest sees their own."
            lede={
              <>
                Maria and Jose&rsquo;s wedding, seen by two of their guests — the real pages. Date:{' '}
                <span className="fl-nw">{sample.dateLabel}</span>.
              </>
            }
          />
          <PersonaViewer options={sample.personas.map((p) => ({ key: p.key, label: p.option }))}>
            <div className="fl-phone">
              <div className="fl-glass">
                <span className="fl-tag">Preview of the real page</span>
                {sample.personas.map((p) => (
                  <div key={p.key} className="fl-screen" data-who={p.key} data-fl-screen="">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={marketingPhoto(p.shot)} alt={p.alt} loading="lazy" decoding="async" />
                  </div>
                ))}
                <span className="fl-scrollhint" aria-hidden="true">
                  Scroll the real page
                </span>
              </div>
            </div>
            <div className="fl-viewer-copy">
              {sample.personas.map((p) => (
                <div key={p.key} className="fl-who-copy" data-who={p.key}>
                  <p className="fl-who">{p.who}</p>
                  <h3>{p.title}</h3>
                  <p className="fl-line">{p.line}</p>
                  <Dots items={p.points} />
                </div>
              ))}
            </div>
          </PersonaViewer>
          <p className="fl-custom">
            <span>
              The hosts shape how the Hub looks — theme, colours, music and the reveal. Pro makes every part theirs.
            </span>{' '}
            <Link className="fl-more" href="/features/event-hub">
              See the Event Hub Maker
            </Link>
          </p>
        </section>
      ) : null}

      {/* ════ THE SHELVES — the shipped Discover feed, exactly as it renders ════ */}
      <section className="fl-sec fl-reveal fl-shelves" id="shelves" aria-label="On Setnayan">
        <p className="fl-kicker">On Setnayan</p>
        {shelves}
      </section>

      {/* ════ WHAT IT SOLVES ════ */}
      <section className="fl-sec fl-reveal" id="solves" aria-labelledby="h-solves">
        <Head
          kicker="What it solves"
          id="h-solves"
          title="Twenty things that go wrong when you plan an event. And what happens instead."
          lede="Each one is a real feature."
          more={{ href: '/features', label: 'All features, as problems we solve' }}
        />
        <Expandable className="fl-solves">
          <div className="fl-solves-list">
            {SOLVES.map((s, i) => (
              <article key={s.photo} className={i < SOLVES_SHOWN_FIRST ? 'fl-solve' : 'fl-solve fl-solve-more'}>
                <figure className="fl-scene">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="fl-ph" src={marketingPhoto(s.photo)} alt={s.alt} loading="lazy" decoding="async" width={960} height={720} />
                  <figcaption>
                    <span className="fl-n">
                      {String(i + 1).padStart(2, '0')} / {formatCount(total)}
                    </span>
                    <span className="fl-t">{s.title}</span>
                    <span className="fl-pain">{s.pain}</span>
                  </figcaption>
                </figure>
                <div className="fl-answer">
                  <p className="fl-with">With Setnayan</p>
                  <p className="fl-ans">{s.answer}</p>
                  <div className="fl-act">
                    <Link className="fl-go" href={s.href}>
                      {s.action} <i aria-hidden="true">›</i>
                    </Link>
                    <SolveTagLine tag={s.tag} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="fl-solves-more">
            <ExpandButton className="fl-btn fl-btn-line" more={`See all ${formatCount(total)} ›`} less={`Show the top ${SOLVES_SHOWN_FIRST}`} />
          </div>
        </Expandable>
      </section>

      {/* ════ FOR COORDINATORS — the pitch lives at /for-coordinators ════ */}
      <section className="fl-sec fl-reveal fl-co" id="coordinators" aria-labelledby="h-coord">
        <figure className="fl-co-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={marketingPhoto('coord-band')} alt="A coordinator checking the day’s plan at a reception" loading="lazy" decoding="async" />
        </figure>
        <div className="fl-co-copy">
          <p className="fl-kicker">For coordinators</p>
          <h2 id="h-coord">
            You run the day.{floorKitFree ? <> <em>The tools are free.</em></> : null}
          </h2>
          <p className="fl-lede">
            The couple invites you to their event and opens the parts you need. Everything you run, in one place.
          </p>
          <ul className="fl-co-tools">
            {COORDINATOR_TOOLS.map((t) => (
              <li key={t.title}>
                {/* "Free" only where the app makes it free today — the floor kit follows the paywall's own rule. */}
                <span className="fl-free">{!t.floorKit || floorKitFree ? 'Free' : ''}</span>
                <b>{t.title}</b>
                <span className="fl-d">{t.line}</span>
              </li>
            ))}
          </ul>
          <div className="fl-ctas">
            <Link className="fd-btn-terra fl-btn" href="/for-coordinators">
              See what coordinators get ›
            </Link>
            <Link className="fl-more" href="/open-shop">
              Open your coordinator shop — free
            </Link>
          </div>
        </div>
      </section>

      {/* ════ FOR SUPPLIERS — a short invitation; the pitch lives at /for-suppliers ════ */}
      <section className="fl-sec fl-reveal fl-sup" id="suppliers" aria-labelledby="h-sup">
        <div className="fl-crew">
          <div className="fl-track">
            {SUPPLIER_TILES.map((t) => (
              <figure className="fl-tile" key={t.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={marketingPhoto(t.photo)} alt={t.alt} loading="lazy" decoding="async" style={{ objectPosition: t.focus }} />
                <figcaption>{t.label}</figcaption>
              </figure>
            ))}
            <span className="fl-dup" aria-hidden="true">
              {SUPPLIER_TILES.map((t) => (
                <figure className="fl-tile" key={t.photo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={marketingPhoto(t.photo)} alt="" loading="lazy" decoding="async" style={{ objectPosition: t.focus }} />
                  <figcaption>{t.label}</figcaption>
                </figure>
              ))}
            </span>
          </div>
        </div>
        <div className="fl-sup-copy">
          <p className="fl-kicker">For suppliers</p>
          <h2 id="h-sup">
            Every event needs you. <em>Start or grow your business here.</em>
          </h2>
          <p className="fl-lede">
            Whether you&rsquo;re just starting out or already booked every weekend — people planning their events are
            already here.
          </p>
          <dl className="fl-three">
            {SUPPLIER_STAGES.map((s) => (
              <div key={s.term}>
                <dt>{s.term}</dt>
                <dd>{s.line}</dd>
              </div>
            ))}
          </dl>
          <div className="fl-ctas">
            <Link className="fd-btn-terra fl-btn" href="/for-suppliers">
              See how it works for suppliers ›
            </Link>
            <Link className="fl-more" href="/open-shop">
              Open a shop — free
            </Link>
          </div>
        </div>
      </section>

      {/* ════ WHAT YOU GET ════ */}
      <section className="fl-sec fl-reveal" id="plans" aria-labelledby="h-plans">
        <Head
          kicker="What you get"
          id="h-plans"
          title="Free is complete. Plus, Pro and Ultra are for more."
          lede="One price for the whole event — it unlocks for everyone on it."
        />
        <div className="fl-plans">
          <Expandable as="article" className="fl-plan fl-plan-free">
            <div className="fl-plan-name">
              <h3>Free</h3>
              <span className="fl-price">₱0</span>
            </div>
            <p className="fl-plan-one">
              <b>
                {freeItems.length} tools to plan, invite, run and remember the whole event — free, with no guest limit.
              </b>
            </p>
            <Dots items={FREE_PEEK} />
            <div className="fl-pmore">
              <div>
                {FREE_GROUPS.map((g) => (
                  <div className="fl-pg" key={g.name}>
                    <p className="fl-fg">{g.name}</p>
                    <PlainList items={g.items} />
                  </div>
                ))}
                <p className="fl-fine">Carries the Setnayan watermark.</p>
              </div>
            </div>
            <ExpandButton className="fl-ptoggle" more={`See all ${freeItems.length} free tools`} less="Show less" chevron />
            <p className="fl-plan-note">Free, not a trial. Nothing expires.</p>
            <Link className="fd-btn-terra fl-btn" href="/start">
              Set up your event — free
            </Link>
          </Expandable>

          <Expandable as="article" className="fl-plan">
            <div className="fl-plan-name">
              <h3>Event Plus</h3>
              <PlanPrice php={planPrices.plus} />
            </div>
            <p className="fl-plan-one">Setnayan AI and Papic credits for your event.</p>
            <Dots items={PLUS_PEEK} />
            <div className="fl-pmore">
              <div>
                <PlainList items={PLUS_MORE} />
                <div className="fl-pg">
                  <p className="fl-fg">And everything in Free</p>
                  <PlainList items={freeItems} />
                </div>
              </div>
            </div>
            <ExpandButton className="fl-ptoggle" more={`See all ${formatCount(plusCount)} features`} less="Show less" chevron />
            <Link className="fl-btn fl-btn-line" href="/start">
              Start free, upgrade any time
            </Link>
          </Expandable>

          <Expandable as="article" className="fl-plan fl-plan-pro">
            <div className="fl-plan-name">
              <h3>Event Pro</h3>
              <PlanPrice php={planPrices.pro} />
            </div>
            <p className="fl-plan-one">Everything in Plus, and an Event Hub that is fully yours.</p>
            <Dots items={PRO_PEEK} />
            <div className="fl-pmore">
              <div>
                <PlainList items={PRO_MORE} />
                <div className="fl-pg">
                  <p className="fl-fg">And everything in Plus</p>
                  <PlainList items={plusItems} />
                </div>
                <div className="fl-pg">
                  <p className="fl-fg">And everything in Free</p>
                  <PlainList items={freeItems} />
                </div>
              </div>
            </div>
            <ExpandButton className="fl-ptoggle" more={`See all ${formatCount(proCount)} features`} less="Show less" chevron />
            <Link className="fd-btn-terra fl-btn" href="/start">
              Start free, upgrade any time
            </Link>
          </Expandable>

          {/* 💎 Event Ultra (owner 2026-11-13) — the Pro card's own shape, one rung up. Drawn only while its row is on sale. */}
          {planPrices.ultra !== null ? (
            <Expandable as="article" className="fl-plan">
              <div className="fl-plan-name">
                <h3>Event Ultra</h3>
                <PlanPrice php={planPrices.ultra} />
              </div>
              <p className="fl-plan-one">Everything in Pro, and your day shared live and kept.</p>
              <Dots items={ULTRA_PEEK} />
              <div className="fl-pmore">
                <div>
                  <PlainList items={ULTRA_MORE} />
                  <div className="fl-pg">
                    <p className="fl-fg">And everything in Pro</p>
                    <PlainList items={proItems} />
                  </div>
                  <div className="fl-pg">
                    <p className="fl-fg">And everything in Plus</p>
                    <PlainList items={plusItems} />
                  </div>
                  <div className="fl-pg">
                    <p className="fl-fg">And everything in Free</p>
                    <PlainList items={freeItems} />
                  </div>
                </div>
              </div>
              <ExpandButton className="fl-ptoggle" more={`See all ${formatCount(ultraCount)} features`} less="Show less" chevron />
              <Link className="fl-btn fl-btn-line" href="/start">
                Start free, upgrade any time
              </Link>
            </Expandable>
          ) : null}
        </div>

        <div className="fl-addons">
          <p className="fl-fg">Add to any plan</p>
          <div className="fl-atiles">
            {ADD_ONS.map((a) => (
              <Link className="fl-atile" href={a.href} key={a.href}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={marketingPhoto(a.photo)} alt="" loading="lazy" decoding="async" />
                <span className="fl-at">
                  <b>{a.title}</b>
                  <span>{a.line}</span>
                  <em>See price ›</em>
                </span>
              </Link>
            ))}
          </div>
          <p className="fl-fine">Prices are read from our live catalogue on each page.</p>
        </div>
      </section>

      {/* ════ CLOSE ════ */}
      <section className="fl-close fl-reveal" aria-labelledby="h-close">
        <h2 id="h-close">
          Set na &rsquo;yan.<em>That&rsquo;s all set.</em>
        </h2>
        <div className="fl-ctas">
          <Link className="fd-btn-terra fl-btn" href="/start">
            Set up your event — free
          </Link>
        </div>
        <p className="fl-fine">Free to plan · No guest limit · Guests don&rsquo;t sign in</p>
      </section>

      <FrontDoorFooter />
    </div>
  );
}

/**
 * The page's own footer. 🔑 THE PRIVACY POLICY AND THE TERMS ARE LINKED HERE, ON THE HOME PAGE ITSELF —
 * Google's homepage requirement (2026-10-22). They used to sit inside the hero; the prototype moved them
 * down here, and `app/google-can-verify-the-home-page.test.ts` reads this component for them.
 */
export function FrontDoorFooter() {
  return (
    <footer className="fl-foot">
      <nav aria-label="Footer">
        <Link href="/about">About</Link>
        <Link href="/features">Features</Link>
        <Link href="/for-suppliers">For suppliers</Link>
        <Link href="/help">Help</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
      <p>© {new Date().getFullYear()} Setnayan · setnayan.com</p>
    </footer>
  );
}
