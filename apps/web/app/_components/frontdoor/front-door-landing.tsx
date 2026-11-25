/**
 * front-door-landing.tsx — the signed-out front page below the first screen.
 *
 * BUILT FROM `prototypes/front_page_home_2026-11-20_usp/` v6 (owner "Approve v6", 20 Nov 2026, specs f29c85b3 — v5,
 * `front_page_home_2026-11-19/`, plus the USP line, the Papic heading and "Suppliers you can trust"; brief
 * `FRONT_PAGES_BUILD_BRIEF_2026-11-20.md`): "the home of every Filipino celebration", redrawn in Discover's look.
 * The first screen (photo, headline, picker, chips) is `front-door-anchor.tsx`. Below it, in this order —
 *
 *   #live   Live it — the sample wedding as its guests see it, five screens on one shelf
 *           Live it · Papic — everyone you love and every photo of them, one album; their own QR pass; family abroad
 *           watch live
 *   #plan   Plan it — six free tools on one shelf
 *   #suppliers  Plan it · Suppliers — suppliers you can trust: four text rows, no data read
 *   #keep   Keep it — one person's debut, wedding and son's christening on one thread
 *           the three doors — I'm hosting · I'm a supplier · I'm a coordinator
 *   #plans  Plans — one line; Free · Event Plus · Event Pro · Event Ultra open on a tap
 *   the close, the page's own footer (Privacy and Terms — Google's homepage rule) and the thumb-zone bar.
 *
 * ─── A PUBLIC PAGE SAYS ONLY WHAT IS LIVE (brief, "gate every line") ──────────────────────────────────────
 * The drawing prices and fills the plans with the 18–20 Nov re-cut (Event Plus = the whole Event Hub, Setnayan AI on
 * Pro, Pro ₱5,490 with 3,000 credits). That re-cut is #7978 / #8004, not merged. So every plan row here is the LIVE
 * product: its price and credits read from `platform_retail_catalog_v2` (`planPricesFrom` / `planCreditsFrom`), its
 * lines from `front-door-landing-data.ts` (what an order unlocks today). The day those PRs land, the rows follow the
 * data, not this file. Never "Coming".
 *   · Memories ⓘ: the drawing says "six with Event Pro"; only Event Ultra keeps originals longer today (the
 *     `fullres_extra_keep_days` row), so it says twelve with Event Ultra and no Pro term.
 *   · Patiktok and Music Maker are retired (owner 20 Nov): neither is named here, not even on Ultra.
 *   · Hosts see "0% commission" only; the supplier fee is never on this page.
 *
 * NO SAMPLE OR DEMO BUTTONS (owner, CLOUD_BOARD 5 Nov). The sample is pictures only, "Sample wedding" under them.
 * NO PRICE IS TYPED HERE. ₱0 is the free tier, not a price.
 * NO SCRIPT. Plans and ⓘ open with <details>; motion is CSS on the scroll (`front-door-landing.css`).
 *
 * Signed in, none of this renders: a member's `/` is Discover, unchanged (`front-door.tsx`).
 */
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

import { marketingPhoto, marketingSmallPhoto } from '@/lib/front-page-photos';
import {
  eventTypePhotoSrc,
  eventTypeRepoPhotoSrc,
  eventTypeSmallPhotoSrc,
  startHrefFor,
  type EventTypeRow,
} from '@/app/dashboard/(account)/create-event/_components/event-types';
import { sampleSnapshot } from '@/lib/sample-event/hub';
import { formatCount } from '@/lib/format-number';
import { formatPeso } from '@/lib/v2-catalog-pure';
import { PLUS_MORE, PRO_PEEK, ULTRA_PEEK, plusPeek, proMore, type PlanFacts } from './front-door-landing-data';

/* The plan readers live in `lib/event-plans.ts` so non-front-door code never imports this component file; re-exported
   so every existing import keeps working. 💎 Event Ultra (#7601) lives there too. */
export { PLAN_PRICE_CODES, planPricesFrom, planCreditsFrom, type PlanPrices } from '@/lib/event-plans';
import type { PlanPrices } from '@/lib/event-plans';

/* ─── The picker's tiles ──────────────────────────────────────────────────────────────────────────── */

export type EventTypeTile = { key: string; label: string; photo: string; href: string; focus?: string };

/**
 * The drawing's order: Wedding · Debut · Christening · Birthday lead, then the rest it names — twelve on the shelf;
 * "All N kinds" opens the rest. A kind the live roster does not carry is simply not drawn.
 */
const SHELF_ORDER = [
  'wedding', 'debut', 'christening', 'birthday', 'anniversary', 'gender_reveal',
  'reunion', 'graduation', 'corporate', 'travel', 'tournament', 'grand_opening',
] as const;

/**
 * Where the app's event-type photo misreads at tile size (a hall, not people), the drawing uses the marketing photo of
 * the same event, with its own crop. Every other kind keeps the app's one photo rule (`eventTypePhotoSrc`).
 */
/**
 * ⚡ The sample wedding's photos at the size this page draws them (`public/demo/maria-jose/sm/`, 480 px on the short
 * side): the shelf tile is 150–200 CSS px wide and a Papic pile photo 124 × 156, so a phone at 3× needs ~470 px. The
 * full files are 1.1–1.8 MB each and loaded ~8 MB on a phone's first open of `/` (measured 24 Nov 2026); the small
 * copies are 11–27 KB. Same picture, same crop.
 */
const demoSmallPhoto = (name: string) => `/demo/maria-jose/sm/${name}.webp`;

const TILE_PHOTO: Record<string, { photo: string; focus: string }> = {
  wedding: { photo: demoSmallPhoto('toast'), focus: '40% 50%' },
  debut: { photo: marketingSmallPhoto('hero-debut'), focus: '68% 50%' },
  christening: { photo: marketingSmallPhoto('hero-christening'), focus: '42% 50%' },
  birthday: { photo: marketingSmallPhoto('hero-birthday'), focus: '82% 60%' },
  reunion: { photo: marketingSmallPhoto('hero-reunion'), focus: '30% 50%' },
};

export function frontPageTiles(
  roster: readonly Pick<EventTypeRow, 'key' | 'label' | 'heroPhotoUrl' | 'onboardingHref'>[],
  quizOn: boolean,
): EventTypeTile[] {
  const byKey = new Map(roster.map((t) => [t.key, t]));
  return SHELF_ORDER.flatMap((key) => {
    const t = byKey.get(key);
    if (!t) return [];
    const own = TILE_PHOTO[key];
    return [{ key, label: t.label, photo: own?.photo ?? eventTypePhotoSrc(t), focus: own?.focus, href: startHrefFor(t, quizOn) }];
  });
}

/** One swipe row of event types — Discover's card: the picture is the object, the name on the page under it. */
export function EventTypeShelf({ tiles }: { tiles: readonly EventTypeTile[] }) {
  return (
    <div className="fl-car fl-types">
      {tiles.map((t) => (
        <Link className="fl-et" href={t.href} key={t.key}>
          {/* ⚡ The tile is 150 CSS px wide on a phone and 200 from 701 px (`.fl-et` in front-door-landing.css): a repo
              photo offers its 330-px copy and the browser takes the 880 only where the screen needs it. A marketing
              photo or an admin upload keeps its own URL. `sizes` names both widths. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.photo}
            srcSet={t.photo === eventTypeRepoPhotoSrc(t.key) ? `${eventTypeSmallPhotoSrc(t.key)} 330w, ${t.photo} 880w` : undefined}
            sizes="(min-width: 701px) 200px, 150px"
            alt=""
            loading="lazy"
            decoding="async"
            width={330}
            height={412}
            style={t.focus ? { objectPosition: t.focus } : undefined}
          />
          <span>{t.label}</span>
        </Link>
      ))}
    </div>
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────────────────────────────────── */

const SHOT = (key: string) => `/marketing/2026-11-20/${key}.webp`;

/**
 * ⓘ — one short line shows; the detail opens in place, with no script. The circle wears InfoTip's own classes token
 * for token (`there-is-one-info-dot.test.ts`): 16 px, ink at rest, terracotta while hovered or open, the 46-px halo.
 */
function What({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="fl-what-tip group">
      <summary aria-label={label}>
        <span
          aria-hidden="true"
          className="sn-dot-btn inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 group-hover:border-terracotta group-hover:text-terracotta group-open:border-terracotta group-open:text-terracotta"
        >
          i
        </span>
      </summary>
      <p>{children}</p>
    </details>
  );
}

/** A price as the catalog has it. A row whose price could not be read is not drawn at all — never a figureless price. */
function PlanPrice({ php }: { php: number }) {
  return (
    <span className="fl-pp">
      ₱{formatPeso(php)}
      <small> per event</small>
    </span>
  );
}

function PlanRow({
  name,
  best,
  price,
  one,
  items,
  under,
}: {
  name: string;
  best?: boolean;
  price: ReactNode;
  one: string;
  items: readonly string[];
  under: string;
}) {
  return (
    <details className="fl-plan" name="fl-plan">
      <summary>
        <span className="fl-pn">
          {name}
          {best ? <em>Best buy</em> : null}
        </span>
        {price}
        <span className="fl-po">{one}</span>
        <span className="fl-pc" aria-hidden="true">
          See what&rsquo;s inside
        </span>
      </summary>
      <div className="fl-pb">
        <ul>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <p className="fl-fine">{under}</p>
      </div>
    </details>
  );
}

const credits = (n: number | null | undefined): string[] =>
  n !== null && n !== undefined && n > 0 ? [`${formatCount(n)} Papic credits: ${formatCount(n)} photos from your guests’ phones`] : [];

/* ─── The landing ──────────────────────────────────────────────────────────────────────────────── */

const LIVE_SCREENS = [
  { shot: 'hub1', alt: 'The Save the Date, with the couple’s names over their photo', b: 'Your Event Hub, in your own photos.', k: 'What every guest opens' },
  { shot: 'hub2', alt: 'A guest’s invitation, with her name and the reply buttons', b: 'Her name on it. She replies in a tap.', k: 'A guest · the bride’s cousin' },
  { shot: 'hub3', alt: 'A guest’s ticket with her QR, table and seat', b: 'Her own ticket, her table, her seat.', k: 'A guest · the bride’s cousin' },
  { shot: 'hub4', alt: 'An invitation marked Maid of Honor', b: 'Her place in the march, and what to wear.', k: 'A guest with a role · the maid of honor' },
  { shot: 'hub5', alt: 'The day, live, with the photos a guest is in', b: 'The schedule, live. Her photos, found for her.', k: 'The Day' },
] as const;

const PILE = [
  { src: demoSmallPhoto('wall-7'), s: '--fx:-150px;--fy:-30px;--fr:-16deg;--tx:-98px;--ty:8px;--tr:-10deg' },
  { src: demoSmallPhoto('wall-5'), s: '--fx:150px;--fy:-20px;--fr:16deg;--tx:98px;--ty:10px;--tr:10deg' },
  { src: demoSmallPhoto('wall-1'), s: '--fx:-110px;--fy:50px;--fr:4deg;--tx:-50px;--ty:0px;--tr:-4.5deg' },
  { src: demoSmallPhoto('wall-8'), s: '--fx:110px;--fy:56px;--fr:-4deg;--tx:50px;--ty:2px;--tr:4.5deg' },
  { src: demoSmallPhoto('wall-4'), s: '--fx:0px;--fy:70px;--fr:0deg;--tx:0px;--ty:-6px;--tr:0deg' },
] as const;

const cssVars = (s: string): CSSProperties =>
  Object.fromEntries(s.split(';').map((d) => d.split(':') as [string, string])) as CSSProperties;

const PLAN_TOOLS = [
  { shot: 'scr-guest-list-0', alt: 'The guest list with replies counted', b: 'Guest list', s: 'One link each. The list fills itself.' },
  { shot: 'scr-3d-plan-0', alt: 'The seat plan’s 3D room, with every table', b: 'Seat plan', s: 'Tables in 2D, then walk the room in 3D.' },
  { shot: 'scr-budget-0', alt: 'The budget page: target, agreed, paid and owed', b: 'Budget planner', s: 'Planned, agreed, paid and owed, in pesos.' },
  { shot: 'scr-suppliers-0', alt: 'Suppliers, Find: search the marketplace from your date and venue', b: 'Find suppliers', s: 'Search by your date and city.' },
  { shot: 'scr-suppliers-1', alt: 'Suppliers, Build: your picks side by side against your budget', b: 'Compare suppliers', s: 'Side by side, against your budget.' },
  { shot: 'scr-papic-0', alt: 'The event’s Memories, every photo in one place', b: 'Memories', s: 'Every photo, every guest’s, in one place.' },
] as const;

const PLAN_COUNT_WORD: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four' };

export function FrontDoorLanding({
  planPrices,
  planFacts,
}: {
  /** Event Plus, Event Pro and Event Ultra from the price list (`planPricesFrom`). */
  planPrices: PlanPrices;
  /** The included credits the plan rows may say (`planCreditsFrom`). */
  planFacts: PlanFacts;
}) {
  const couple = sampleSnapshot().couple;
  const plusItems = [...plusPeek(planFacts), ...PLUS_MORE];
  // Free always draws; a paid plan draws only when its price was read.
  const planCount = 1 + [planPrices.plus, planPrices.pro, planPrices.ultra].filter((p) => p !== null).length;
  const proItems = [...PRO_PEEK, ...proMore(planFacts)];
  const ultraItems = [...ULTRA_PEEK, ...credits(planFacts.ultraCredits)];

  return (
    <div className="fl-landing" id="fl-landing">
      {/* ════ LIVE IT — the sample wedding, as its guests see it ════ */}
      <section className="fl-sec fl-bleed" id="live" aria-labelledby="h-guest">
        <div className="fl-head fl-rv">
          <p className="fl-kick">Live it</p>
          <h2 className="fd-sechead fl-sechead" id="h-guest">
            <span>Same event. Each guest sees their own.</span>
          </h2>
          <p className="fl-lede">
            {couple.bride.first} and {couple.groom.first}&rsquo;s wedding, as their guests see it.
          </p>
        </div>
        <div className="fl-car fl-rv">
          {LIVE_SCREENS.map((s) => (
            <figure className="fl-who" key={s.shot}>
              <div className="fl-phone">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SHOT(s.shot)} alt={s.alt} loading="lazy" decoding="async" width={400} height={711} />
              </div>
              <figcaption>
                <b>{s.b}</b>
                <span>{s.k}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="fl-fine fl-smp">Sample wedding</p>
      </section>

      {/* ════ LIVE IT · PAPIC — the one moving moment ════ */}
      <section className="fl-sec fl-papic" aria-labelledby="h-papic">
        <div className="fl-rv">
          <p className="fl-kick">Live it · Papic</p>
          <h2 className="fd-sechead fl-sechead" id="h-papic">
            <span>Everyone you love, in one place. And every photo of them.</span>
          </h2>
          <p className="fl-lede">Every guest&rsquo;s phone is a camera. Every photo they take lands in one album.</p>
        </div>
        <div className="fl-pile" aria-hidden="true">
          {PILE.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.src} src={p.src} alt="" loading="lazy" decoding="async" style={cssVars(p.s)} />
          ))}
          <span className="fl-alb">One album</span>
        </div>
        <div className="fl-fine fl-hasi">
          Unlimited cameras · photos use Papic credits
          <What label="About Papic credits">
            Every guest&rsquo;s phone can be a camera, with nothing to install. Each photo they take into your album
            uses one Papic credit. Credits come with Event Plus, Pro and Ultra and as gifts from the suppliers you book,
            and you can buy more any time.
          </What>
        </div>
        <ul className="fl-also">
          <li>
            <b>Their own QR pass.</b> Seat, door and photos in one.
          </li>
          <li className="fl-hasi">
            <b>Family abroad watch live.</b> On the same page.
            <What label="About Live Watch">
              A one-camera livestream is free on every event. Live Watch puts every camera live, guests&rsquo; phones
              included, and comes with Event Ultra or on its own.
            </What>
          </li>
        </ul>
      </section>

      {/* ════ PLAN IT — six free tools ════ */}
      <section className="fl-sec fl-bleed" id="plan" aria-labelledby="h-plan">
        <div className="fl-head fl-rv">
          <p className="fl-kick">
            Plan it <span className="fl-free">Free</span>
          </p>
          <h2 className="fd-sechead fl-sechead" id="h-plan">
            <span>Everything to plan it. Free, not a trial.</span>
            <Link className="fl-go" href="/features">
              See all &rarr;
            </Link>
          </h2>
          <div className="fl-lede fl-hasi">
            No guest limit. Nothing expires.
            <What label="Every free tool">
              Free on every event: guest list with no limit, replies and a QR pass for every guest, seat plan in 2D and
              3D, budget, schedule, mood board, find and book suppliers, your Event Hub through every stage, door
              check-in, Papic cameras, Memories kept for life, face tagging and FaceBlock.
            </What>
          </div>
        </div>
        <div className="fl-car fl-rv">
          {PLAN_TOOLS.map((t) => (
            <figure className="fl-tool" key={t.shot}>
              <div className="fl-mini">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SHOT(t.shot)} alt={t.alt} loading="lazy" decoding="async" width={460} height={560} />
              </div>
              <figcaption>
                <b>{t.b}</b>
                <span>{t.s}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ════ PLAN IT · SUPPLIERS — v6 (owner "Approve v6", 20 Nov): text only, Papic's own parts, no data read ════ */}
      <section className="fl-sec fl-sup" id="suppliers" aria-labelledby="h-sup">
        <div className="fl-rv">
          <p className="fl-kick">Plan it · Suppliers</p>
          <h2 className="fd-sechead fl-sechead" id="h-sup">
            <span>Suppliers you can trust.</span>
          </h2>
          <p className="fl-lede">No fake reviews. No paid stars. Ever.</p>
        </div>
        <ul className="fl-also">
          <li>
            <b>Badges are earned.</b> Every badge and seal is earned: real bookings, real inquiries, checked papers.
          </li>
          <li>
            <b>Nothing is a screenshot.</b> Every quote and payment is a card in your chat.
          </li>
          <li>
            <b>You pay them directly.</b> Hosts pay 0% commission.
          </li>
          <li>
            <b>An exclusive Setnayan gift with every booking.</b>
          </li>
        </ul>
      </section>

      {/* ════ KEEP IT — one life on one thread ════ */}
      <section className="fl-sec" id="keep" aria-labelledby="h-keep">
        <div className="fl-rv">
          <p className="fl-kick">Keep it</p>
          <h2 className="fd-sechead fl-sechead" id="h-keep">
            <span>Kept for life, on one page.</span>
          </h2>
          <p className="fl-lede">Her debut. Her wedding. Her son&rsquo;s christening.</p>
        </div>
        <ol className="fl-life">
          {[
            { key: 'hero-debut', b: 'Her debut', s: '18 roses, every guest’s photos.' },
            { key: 'hero-wedding', b: 'Her wedding', s: 'The same people, already saved.' },
            { key: 'hero-christening', b: 'Her son’s christening', s: 'Half done before she starts.' },
          ].map((c) => (
            <li key={c.key}>
              <figure>
                {/* ⚡ 64 px: the small copy — except the wedding, which is the first screen's own photo, already loaded. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.key === 'hero-wedding' ? marketingPhoto(c.key) : marketingSmallPhoto(c.key)} alt="" loading="lazy" decoding="async" />
              </figure>
              <span>
                <b>{c.b}</b>
                {c.s}
              </span>
            </li>
          ))}
        </ol>
        <div className="fl-fine fl-hasi">
          Sample · one person&rsquo;s Memories over the years
          <What label="About Memories">
            Every event you host or go to joins one Memories library. Full-size photos stay until three months after the
            event (twelve with Event Ultra), then a 720p copy of every one is kept for life, free. Only you delete.
            People are saved once, so the next event starts pre-filled.
          </What>
        </div>
      </section>

      {/* ════ THE THREE DOORS ════ */}
      <section className="fl-sec" aria-labelledby="h-doors">
        <div className="fl-rv">
          <p className="fl-kick">Who you are here</p>
          <h2 className="fd-sechead fl-sechead" id="h-doors">
            <span>One home, every role in it.</span>
          </h2>
        </div>
        <nav className="fl-doors" aria-label="Who you are here">
          <Link href="/start">
            <b>I&rsquo;m hosting</b>
            <span>Plan it free, from today.</span>
          </Link>
          <Link href="/for-suppliers">
            <b>I&rsquo;m a supplier</b>
            <span>Your shop, free to open.</span>
          </Link>
          <Link href="/for-coordinators">
            <b>I&rsquo;m a coordinator</b>
            <span>Every client&rsquo;s event, one screen.</span>
          </Link>
        </nav>
      </section>

      {/* ════ PLANS — one line; the four open on a tap. Every row is the live product (see the header). ════ */}
      <section className="fl-sec" id="plans" aria-labelledby="h-plans">
        <div className="fl-rv">
          <p className="fl-kick">Plans</p>
          <h2 className="fd-sechead fl-sechead" id="h-plans">
            <span>Free to plan. Pay only for the extras on the day.</span>
          </h2>
        </div>
        <details className="fl-all">
          <summary>{planCount === 1 ? 'See the Free plan' : `See the ${PLAN_COUNT_WORD[planCount] ?? formatCount(planCount)} plans`}</summary>
          <div className="fl-list">
            <PlanRow
              name="Free"
              price={<span className="fl-pp">₱0</span>}
              one="Everything you need to run your event. For everybody."
              items={[
                'Guest list with no limit, and replies in a tap',
                'Seat plan in 2D and 3D',
                'Budget, schedule and mood board',
                'Find, compare and book suppliers',
                'Your Event Hub, with a QR pass for every guest',
              ]}
              under="Free, not a trial. Nothing expires."
            />
            {planPrices.plus !== null ? (
              <PlanRow
                name="Event Plus"
                price={<PlanPrice php={planPrices.plus} />}
                one="Setnayan AI and Papic credits for your event."
                items={plusItems}
                under="Everything in Free is included."
              />
            ) : null}
            {planPrices.pro !== null ? (
              <PlanRow
                name="Event Pro"
                best
                price={<PlanPrice php={planPrices.pro} />}
                one="Everything in Plus, and an Event Hub that is fully yours."
                items={proItems}
                under="Everything in Plus is included."
              />
            ) : null}
            {planPrices.ultra !== null ? (
              <PlanRow
                name="Event Ultra"
                price={<PlanPrice php={planPrices.ultra} />}
                one="Everything in Pro, and your day shared live and kept."
                items={ultraItems}
                under="Everything in Pro is included."
              />
            ) : null}
          </div>
          {planCount > 1 ? (
            <p className="fl-fine fl-under">
              One price for the whole event. It unlocks for everyone on it. Upgrading pays only the difference.
            </p>
          ) : null}
        </details>
      </section>

      {/* ════ CLOSE — type only ════ */}
      <section className="fl-sec fl-close" aria-labelledby="h-close">
        <h2 id="h-close">
          Set na &rsquo;yan.<em>{HOME_CLOSE_LINE}</em>
        </h2>
        <Link className="fd-btn-terra fl-btn" href="/start">
          What are you planning? &rarr;
        </Link>
        <p className="fl-fine">Free to plan · No guest limit · Guests don&rsquo;t sign in</p>
      </section>

      <FrontDoorFooter />

      <div className="fl-cta-bar">
        <Link className="fd-btn-terra fl-btn" href="/start">
          Start your event — free
        </Link>
      </div>
    </div>
  );
}

/** The closing brand line — with the headline, one of the two places the front door says "celebration" (owner 19 Nov). */
export const HOME_CLOSE_LINE = 'Every celebration, all in one place, for life.';

/**
 * The page's own footer. 🔑 THE PRIVACY POLICY AND THE TERMS ARE LINKED HERE, ON THE HOME PAGE ITSELF —
 * Google's homepage requirement (2026-10-22). `app/google-can-verify-the-home-page.test.ts` reads this component.
 */
export function FrontDoorFooter() {
  return (
    <footer className="fl-foot">
      <nav aria-label="Footer">
        <Link href="/about">About</Link>
        <Link href="/features">Features</Link>
        <Link href="/pricing">Plans</Link>
        <Link href="/for-suppliers">For suppliers</Link>
        <Link href="/help">Help</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
      <p>© {new Date().getFullYear()} Setnayan · setnayan.com</p>
    </footer>
  );
}
