import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  HeartHandshake,
  Plus,
  Search,
  Settings,
  Store,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { CollapsingTop } from '@/app/_components/collapsing-top/collapsing-top';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { DiscoverEventCover } from '@/app/_components/frontdoor/discover-event-cover';
import { ProfileHeader, PROFILE_HEADER_CSS, profileInitials } from '@/app/u/_components/profile-header';
import { PenLine } from 'lucide-react';
import { pictureFrameStyle } from '@/lib/picture-frame';
import type { HomeHandle } from '@/lib/home-profile.server';
import { MEMORIES_HOME, PEOPLE_HOME, peopleHomeHref } from '@/lib/home-segments';
import { discoverFollowingHref } from '@/lib/discover-pin';
import { discoverSupplierHref } from '@/lib/discover-suppliers';
import { stanceLabel } from '@/lib/event-board';
import { formatCount } from '@/lib/format-number';
import {
  UNIHOME_EVENTS_ALL,
  UNIHOME_TOP_ID,
  type UnihomeDiscover,
  type UnihomeEventCard,
  type UnihomeEvents,
  type UnihomeMemories,
  type UnihomePeople,
  type UnihomeShop,
} from '@/lib/unihome';
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { SAMPLE_MEMORY_SHELF, SAMPLE_PEOPLE } from '@/lib/empty-look-samples';
import { EventScene } from './event-scene';
import { EventCardMenu } from './event-card-menu';
import { UnihomeJump } from './unihome-jump';
import { UnihomeHubButton } from './unihome-hub-button';
import u from './unihome.module.css';

/**
 * unihome.tsx — 🏠 UNIHOME v5, THE ACCOUNT'S ONE HOME (owner-approved 23 Nov 2026, DECISION_LOG "UNIHOME v5 APPROVED";
 * drawing `prototypes/one_profile_page_2026-11-23/unihome-v5.html`, specs 7e314b06).
 *
 *   your profile (⚙ beside your name) → the six jump icons, which stay at the top → Events · Shop · People · Memories ·
 *   Discover on ONE scroll, each with "See all →" to its full page → "Create an event", labelled, floating bottom
 *   right on a phone (the top of the rail on a computer).
 *
 * What it REMOVES from the Home before it (all listed in the drawing's Notes): the `Events ▾` pinned row
 * (`home-pin.tsx` → PinnedRow → PickMenu), the bottom bar (`account-bottom-nav.tsx`) — hidden while this page is on
 * screen (`unihome.module.css`) — and the one-section-at-a-time swap. The round photo at the top right STAYS on Home
 * (owner 24 Nov 2026: "just return the profile icon on the upper right"). The
 * full section pages are unchanged and one tap away (`?seg=events|people|shop|memories`).
 *
 * A VIEW, NOT A READER: the Home page reads everything in one batched wait and hands it here as plain data (so the
 * dev lab can draw it with sample data). Every `null` is "couldn't read" and is drawn as such — never 0, never empty.
 * 🔒 app/dashboard/(launcher)/unihome-is-the-drawing.test.ts
 */

export type UnihomeViewProps = {
  me: { name: string; photoUrl: string | null; photoFrame: SwitcherData['photoFrame'] | null };
  handle: HomeHandle;
  /** The public page's host as a person would type it ("setnayan.com"). */
  host: string;
  /** For ⚙ — the shipped account sheet. null = the switcher read failed: ⚙ goes to Profile & settings instead. */
  switcher: SwitcherData | null;
  events: UnihomeEvents;
  shop: UnihomeShop;
  people: UnihomePeople;
  memories: UnihomeMemories;
  discover: UnihomeDiscover;
  /** "Incoming requests" — the board's own block, drawn at the top of Events only while one waits. */
  incoming?: ReactNode;
  /** Draw the greyed Example under an empty Events part — only when every membership read ANSWERED. */
  eventsExample?: ReactNode;
};

/* ── small shared pieces ─────────────────────────────────────────────────────────────────────────────────────── */

function SecHead({ id, title, tally, see }: { id: string; title: string; tally?: string | null; see?: string | null }) {
  return (
    <div className={u.sh}>
      <h2 id={id}>{title}</h2>
      {tally ? <span className={u.cnt}>{tally}</span> : <span className={u.grow} />}
      {see ? (
        <Link href={see} className={u.see} aria-label={`See all ${title.toLowerCase()}`}>
          See all →
        </Link>
      ) : null}
    </div>
  );
}

function HairRow({
  href,
  title,
  sub,
  right,
  hot = false,
  first = false,
  data,
}: {
  href: string;
  title: string;
  sub?: string | null;
  right?: ReactNode;
  hot?: boolean;
  first?: boolean;
  data?: string;
}) {
  return (
    <Link href={href} className={`${u.hr} ${first ? u.hrFirst : ''}`} data-unihome-row={data}>
      <span className={u.hrL}>
        <span className={`${u.hrT} ${hot ? u.hot : ''}`}>{title}</span>
        {sub ? <span className={u.hrS}>{sub}</span> : null}
      </span>
      <span className={u.hrR}>
        {right}
        <ChevronRight className={u.chev} strokeWidth={2} aria-hidden />
      </span>
    </Link>
  );
}

function Pen({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="uprof-pen" aria-label={label} data-home-pen={label}>
      <PenLine strokeWidth={1.9} aria-hidden />
    </Link>
  );
}

/* ── Events ──────────────────────────────────────────────────────────────────────────────────────────────────── */

function Scene({ card }: { card: UnihomeEventCard }) {
  return (
    <EventScene
      eventId={card.eventId}
      eventType={card.scene.eventType}
      photoSrc={card.scene.photoSrc}
      ownPhotoSrc={card.scene.ownPhotoSrc}
      cover={card.scene.cover}
    />
  );
}

/**
 * An event you organise or help with. 📋 THE CARD IS THE MENU'S BUTTON (owner-approved 25 Nov 2026, final-check brief
 * Add 40; drawing `build-sessions/final-check/drawings/event-card-menu.html`): a tap on the card, its ⋯, a long-press or
 * a right-click opens Open Dashboard · Open your Event Hub · Open Chat · Open your Memories · Publish Story · Delete
 * Event. It replaces the Dashboard · Event Hub · trash buttons that sat under the card (Unihome v5). Delete is the
 * shipped flow inside the same menu — organisers only.
 */
function EventCard({ card }: { card: UnihomeEventCard }) {
  const cover = (
    <span className={u.cover}>
      <Scene card={card} />
      <span className={u.stance}>
        <HeartHandshake strokeWidth={2.25} aria-hidden />
        {stanceLabel(card.stance)}
      </span>
    </span>
  );
  const words = (
    <>
      <span className={u.poK}>{card.kind}</span>
      <h3 className={u.poT}>{card.title}</h3>
      <span className={u.poS}>{card.when}</span>
      {card.countdown || card.progress ? (
        <span className={u.poM}>
          {card.countdown ? <span className={u.hot}>{card.countdown}</span> : null}
          {card.countdown && card.progress ? ' · ' : null}
          {card.progress}
        </span>
      ) : null}
    </>
  );
  const body = (
    <article className={`${u.ecard} ${u.dgrid2}`} data-unihome-event={card.stance} aria-label={card.title}>
      {cover}
      <div className={u.dright}>{words}</div>
    </article>
  );
  if (!card.menu || !card.dashboardHref) return body;
  return (
    <EventCardMenu
      trigger="card"
      eventId={card.eventId}
      eventName={card.title}
      archived={card.archived}
      card={{
        body,
        thumb: <Scene card={card} />,
        meta: card.when,
        stance: stanceLabel(card.stance),
        dashboardHref: card.dashboardHref,
        menu: card.menu,
      }}
    />
  );
}

/** An event you're invited to — Event Hub only. */
function InvitedRow({ card }: { card: UnihomeEventCard }) {
  return (
    <div className={u.irow} data-unihome-event="invited">
      <span className={u.thumb} aria-hidden>
        <Scene card={card} />
      </span>
      <span className={u.hrL}>
        <span className={u.tagw}>You’re invited</span>
        <span className={u.hrT}>{card.title}</span>
        <span className={u.hrS}>{card.when}</span>
      </span>
      {card.hubUrl ? <UnihomeHubButton href={card.hubUrl} eventName={card.title} small /> : null}
    </div>
  );
}

function NewEventTile() {
  return (
    <Link href="/dashboard/create-event" className={u.addtile} data-tour="create-event" data-unihome-new-event="">
      <span className={u.addmark} aria-hidden>
        <Plus strokeWidth={2} />
      </span>
      <span className={u.addT}>
        <b>New event</b>
      </span>
    </Link>
  );
}

function EventsPart({ events, incoming, example }: { events: UnihomeEvents; incoming?: ReactNode; example?: ReactNode }) {
  const { cards, invited, counts, worth, more } = events;
  const nothing = cards.length === 0 && invited.length === 0;
  const tally = counts
    ? [counts.planning > 0 ? `${formatCount(counts.planning)} planning` : null, counts.celebrated > 0 ? `${formatCount(counts.celebrated)} celebrated` : null]
        .filter(Boolean)
        .join(' · ') || null
    : 'Couldn’t count your events';
  const hasMore = more > 0 || (counts?.celebrated ?? 0) > 0 || !nothing;
  return (
    <section id="events" aria-labelledby="unihome-events" className={u.part} data-unihome-part="events">
      <SecHead id="unihome-events" title="Events" tally={tally} see={hasMore ? UNIHOME_EVENTS_ALL : null} />
      {incoming}
      {cards.map((c) => (
        <EventCard key={c.key} card={c} />
      ))}
      {invited.length > 0 ? (
        <div>
          {invited.map((c) => (
            <InvitedRow key={c.key} card={c} />
          ))}
        </div>
      ) : null}
      {nothing && example ? example : null}
      {nothing && example ? <p className={u.line}>Guests, suppliers, the day itself. Everything you plan gathers here, soonest first.</p> : null}
      <NewEventTile />
      {nothing && counts && counts.celebrated === 0 && worth === null ? null : (
        <div>
          <HairRow
            first
            href={`${UNIHOME_EVENTS_ALL}#worth-planning`}
            title="Worth planning"
            right={worth === 'unread' ? 'Couldn’t read' : worth ? `${worth.label} · ${worth.day}` : null}
            data="worth-planning"
          />
          <HairRow
            href={`${UNIHOME_EVENTS_ALL}#finished`}
            title="Celebrated"
            right={counts ? formatCount(counts.celebrated) : 'Couldn’t count'}
            data="celebrated"
          />
        </div>
      )}
    </section>
  );
}

/* ── Shop ────────────────────────────────────────────────────────────────────────────────────────────────────── */

function CreateShopTile() {
  return (
    <Link href="/open-shop" className={`${u.addtile} ${u.shopadd}`} data-unihome-open-shop="">
      <span className={u.addmark} aria-hidden>
        <Store strokeWidth={1.9} />
        <span className={u.plusdot}>
          <Plus strokeWidth={2.6} />
        </span>
      </span>
      <span className={u.addT}>
        <b>Create your own shop</b>
        <span className={u.hrS}>Free to start. Run the business you already have.</span>
      </span>
      <ChevronRight className={u.chev} strokeWidth={2} aria-hidden />
    </Link>
  );
}

function ShopPart({ shop }: { shop: UnihomeShop }) {
  if (shop.kind === 'unread') {
    return (
      <section id="shop" aria-labelledby="unihome-shop" className={u.part} data-unihome-part="shop" data-unihome-shop="unread">
        <SecHead id="unihome-shop" title="Shop" />
        <p role="alert" className={u.line}>Couldn’t read your shop just now. Nothing has changed — reload in a moment.</p>
      </section>
    );
  }
  if (shop.kind === 'none') {
    // No shop, and the account may not open one (or the shops read was refused — a duplicate shop is permanent).
    return (
      <section id="shop" aria-labelledby="unihome-shop" className={u.part} data-unihome-part="shop" data-unihome-shop="none">
        <SecHead id="unihome-shop" title="Shop" />
        <p className={u.line}>Shops on Setnayan are run by suppliers. Yours shows here once you have one.</p>
      </section>
    );
  }
  return (
    <section id="shop" aria-labelledby="unihome-shop" className={u.part} data-unihome-part="shop" data-unihome-shop={shop.kind}>
      <SecHead id="unihome-shop" title="Shop" />
      {shop.kind === 'create' ? <CreateShopTile /> : null}
      {shop.kind === 'helper' ? (
        <>
          <HairRow first href="/vendor-dashboard" title={shop.name} sub="You help in this shop" data="helper-shop" />
          {shop.canOpenShop ? <CreateShopTile /> : null}
        </>
      ) : null}
      {shop.kind === 'owner' ? (
        <div className={u.shop} data-unihome-shop-view="">
          <Link href="/vendor-dashboard" className={u.cover} tabIndex={-1} aria-hidden>
            {shop.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.coverUrl} alt="" className={u.img} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            ) : null}
          </Link>
          <div className={u.shopId}>
            <span className={u.logo} aria-hidden>
              {shop.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logoUrl} alt="" />
              ) : (
                shop.initials
              )}
            </span>
            <span className={u.shopNm}>
              <b>{shop.name}</b>
              <span className={u.tagline}>
                {shop.verified === true ? <span className={`${u.tagw} ${u.tagOk}`}>Verified</span> : null}
                {shop.verified === false ? <span className={`${u.tagw} ${u.tagG}`}>Unverified</span> : null}
                {shop.publicHref ? (
                  <Link href={shop.publicHref} className={u.vp} data-unihome-view-page="">
                    View page
                    <ArrowUpRight strokeWidth={2} aria-hidden />
                  </Link>
                ) : null}
              </span>
            </span>
          </div>
          <div className={u.stats}>
            <span className={u.stat} data-unihome-stat="new">
              <b>{shop.newCount === null ? '—' : formatCount(shop.newCount)}</b>
              <span>{shop.newCount === null ? 'Couldn’t read what’s new' : 'new for your shop'}</span>
            </span>
            <span className={u.stat} data-unihome-stat="cards">
              <b>{shop.cards ? `${formatCount(shop.cards.online)} of ${formatCount(shop.cards.cards)}` : '—'}</b>
              <span>{shop.cards ? 'service cards online' : 'Couldn’t count your cards'}</span>
            </span>
          </div>
          <Link href="/vendor-dashboard" className={u.supbtn} data-unihome-shop-door="">
            Open shop dashboard
            <ArrowRight strokeWidth={2} aria-hidden />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/* ── People ──────────────────────────────────────────────────────────────────────────────────────────────────── */

function PeoplePart({ people }: { people: UnihomePeople }) {
  const asking = typeof people.asking === 'number' && people.asking > 0 ? people.asking : null;
  const faces = people.faces ?? [];
  return (
    <section id="people" aria-labelledby="unihome-people" className={u.part} data-unihome-part="people">
      <SecHead id="unihome-people" title="People" see={PEOPLE_HOME} />
      {asking !== null ? (
        <HairRow first hot href={peopleHomeHref({ view: 'requests' })} title={`${formatCount(asking)} asking you`} data="asking" />
      ) : null}
      {faces.length > 0 ? (
        <div className={u.faces}>
          {faces.map((f) => (
            <Link key={f.key} href={f.href} className={u.fc}>
              <span className={u.av} aria-hidden>
                {f.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.photoUrl} alt="" />
                ) : (
                  f.initials
                )}
              </span>
              <span>{f.name}</span>
            </Link>
          ))}
          <Link href={PEOPLE_HOME} className={u.fc} data-unihome-find="">
            <span className={u.fcAdd} aria-hidden>
              <Plus strokeWidth={2} />
            </span>
            <span>Find</span>
          </Link>
        </div>
      ) : (
        <>
          {/* 👻 The Example only when the roster was READ and is empty — a refused read (null) draws none. */}
          {people.faces !== null && asking === null ? (
            <ExamplePreview>
              <div className={u.faces}>
                {SAMPLE_PEOPLE.map((f) => (
                  <span key={f.initials} className={u.fc}>
                    <span className={u.av}>{f.initials}</span>
                    <span>{f.name}</span>
                  </span>
                ))}
              </div>
            </ExamplePreview>
          ) : null}
          <HairRow first={asking === null} href={PEOPLE_HOME} title="Find or invite your people" data="find-people" />
        </>
      )}
    </section>
  );
}

/* ── Memories ────────────────────────────────────────────────────────────────────────────────────────────────── */

function MemoriesPart({ memories }: { memories: UnihomeMemories }) {
  return (
    <section id="memories" aria-labelledby="unihome-memories" className={u.part} data-unihome-part="memories">
      <SecHead id="unihome-memories" title="Memories" see={MEMORIES_HOME} />
      {memories === null ? (
        <p className={u.line}>We couldn’t read your albums just now. Your photos are safe; try again in a moment.</p>
      ) : memories.length === 0 ? (
        <>
          <ExamplePreview>
            <div className={u.shelf}>
              {SAMPLE_MEMORY_SHELF.map((m) => (
                <span key={m.title} className={u.st}>
                  <span className={u.stImg}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photo} alt="" className={u.img} style={{ width: '100%', height: '100%' }} />
                  </span>
                  <span className={u.stT}>{m.title}</span>
                  <span className={u.stS}>{m.sub}</span>
                </span>
              ))}
            </div>
          </ExamplePreview>
          <p className={u.line}>Photos from your events are kept here, for life.</p>
        </>
      ) : (
        <div className={u.shelf}>
          {memories.map((m) => (
            <Link key={m.key} href={m.href} className={u.st}>
              <span className={u.stImg}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photoUrl} alt="" loading="lazy" className={u.img} style={{ width: '100%', height: '100%' }} />
              </span>
              <span className={u.stT}>{m.title}</span>
              {m.sub ? <span className={u.stS}>{m.sub}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Discover ────────────────────────────────────────────────────────────────────────────────────────────────── */

function DiscoverPart({ discover }: { discover: UnihomeDiscover }) {
  const { upcoming, suppliers } = discover;
  return (
    <section id="discover" aria-labelledby="unihome-discover" className={`${u.part} ${u.disc}`} data-unihome-part="discover">
      <div className={u.discH}>
        <h2 id="unihome-discover">Discover</h2>
        <ActionButton tone="neutral" iconOnly icon={<Search aria-hidden />} label="Search" name="Search events, people and suppliers" href="/dashboard/search" />
      </div>
      {upcoming ? (
        <>
          <div className={u.sh}>
            <h3>Upcoming from people you follow</h3>
            <span className={u.grow} />
            <Link href={discoverFollowingHref(true)} className={u.see} aria-label="See all upcoming from people you follow">
              See all →
            </Link>
          </div>
          {upcoming.status === 'unavailable' ? (
            <p className={u.line}>We couldn’t check who you follow just now. This does not mean nothing is coming up.</p>
          ) : upcoming.items.length === 0 ? (
            <HairRow first href={discoverFollowingHref(true)} title="Follow people to see their public events here" data="follow-people" />
          ) : (
            <div className={u.shelf}>
              {upcoming.items.map((c) => (
                <Link key={c.key} href={c.href} className={`${u.st} ${u.stWide}`}>
                  <span className={u.stImg} aria-hidden>
                    <DiscoverEventCover card={c} />
                  </span>
                  <span className={u.stT}>{c.title}</span>
                  <span className={u.stS}>{c.datePlate}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}
      <div className={u.sh}>
        <h3>Suppliers</h3>
        <span className={u.meta}>verified only</span>
        <span className={u.grow} />
        <Link href={discoverSupplierHref(new URLSearchParams({ verified: '1' }))} className={u.see} aria-label="See all verified suppliers">
          See all →
        </Link>
      </div>
      {suppliers === null ? (
        <p className={u.line}>We couldn’t load suppliers just now. Try again in a moment.</p>
      ) : suppliers.length === 0 ? (
        <p className={u.line}>Verified suppliers show here as they join.</p>
      ) : (
        <div className={u.shelf}>
          {suppliers.map((s) => (
            <Link key={s.key} href={s.href} className={u.st}>
              <span className={u.stImg}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.coverUrl} alt="" loading="lazy" className={u.img} style={{ width: '100%', height: '100%' }} />
                {s.sample ? <span className={u.sample}>Sample photo</span> : null}
              </span>
              <span className={u.stT}>{s.name}</span>
              {s.sub ? <span className={u.stS}>{s.sub}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── the page ────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The jump row's height (R) — the drawing's 8 + 60 + 6 px plus its two hairlines. */
const JUMP_H = 76;

export function Unihome(props: UnihomeViewProps) {
  const { me, handle, host, switcher, events, shop, people, memories, discover, incoming, eventsExample } = props;
  const initials = profileInitials(me.name);
  const photoStyle = pictureFrameStyle(me.photoFrame ?? null);
  const shopNew = shop.kind === 'owner' ? shop.newCount : null;
  return (
    <div className={u.page} data-unihome="">
      <style>{PROFILE_HEADER_CSS}</style>
      <CollapsingTop
        rowHeight={JUMP_H}
        rowAtRest
        data={{ 'unihome-top': '' }}
        row={
          <div className={u.jumpRow}>
            <UnihomeJump me={{ photoUrl: me.photoUrl, initials, photoStyle }} marks={{ shop: shopNew, people: people.asking }} />
          </div>
        }
      >
        <div className={u.col} id={UNIHOME_TOP_ID}>
          <div className={u.prof} data-home-profile="">
            <ProfileHeader
              layout="home"
              photoSrc={me.photoUrl}
              photoStyle={photoStyle}
              initials={initials}
              heading={me.name}
              photoEdit={<Pen href="/dashboard/profile?tab=profile" label="Change photo and frame" />}
              nameEdit={<Pen href="/dashboard/profile?tab=profile#display_name" label="Edit name" />}
              handle={
                handle.slug ? (
                  <>
                    @{handle.slug}
                    <span className={u.hdot}> · </span>
                    {/* The address and its "off" stay one unit: the address never breaks mid-word (it ends in "…" when
                        it can't fit) and "· off" never lands alone on the next line (walkthrough 27 Nov, testnayan4). */}
                    <span className={u.addr}>
                      <Link href={`/u/${handle.slug}`} className={u.addrLink} data-home-public-page="">
                        {host}/u/{handle.slug}
                      </Link>
                      {handle.publicOn === false ? <span className={u.addrOff}>&nbsp;· off</span> : null}
                    </span>
                  </>
                ) : (
                  <Link href="/dashboard/profile#url-slug" data-home-public-page="">
                    Choose your @handle
                  </Link>
                )
              }
              rule={false}
            />
            {switcher ? (
              <AccountSwitcher data={switcher} trigger="gear" />
            ) : (
              <ActionButton tone="neutral" iconOnly icon={<Settings aria-hidden />} label="Settings" name="Profile & settings" href="/dashboard/profile" data-home-gear="" />
            )}
          </div>
          {/* The row's seat: the jump icons (drawn by `CollapsingTop` over these R px) sit here at rest. */}
          <div className={u.rowRoom} aria-hidden />
        </div>
      </CollapsingTop>

      {/* ➕ CREATE AN EVENT — the one terracotta button on Home. A real button in the tab order RIGHT AFTER the icon
          row (it follows the top in the page's order); it floats bottom right on a phone, and the computer's rail
          carries the same door at its top. Opens the shipped New event sheet (`@modal/(.)create-event`). */}
      <div className={u.create} data-unihome-create="">
        <ActionButton href="/dashboard/create-event" tone="brand" main icon={<Plus aria-hidden />} label="Create an event" tour="create-event" />
      </div>

      <div className={u.col}>
        <EventsPart events={events} incoming={incoming} example={eventsExample} />
        <ShopPart shop={shop} />
        <PeoplePart people={people} />
        <MemoriesPart memories={memories} />
        <DiscoverPart discover={discover} />
      </div>
    </div>
  );
}

