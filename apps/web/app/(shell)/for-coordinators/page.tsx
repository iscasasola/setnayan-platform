/**
 * /for-coordinators — "Run every event from one place — free."
 *
 * NEW 2026-11-04. Ported from the owner-approved prototype `prototypes/for_coordinators_2026-11-04.html`
 * (corpus, with photos the owner generated in `prototypes/marketing_photos_2026-11-04/`, copied to
 * `public/marketing/2026-11-04/` under the same names). Sections, top to bottom, as drawn:
 *   hero (three photos) → the free kit → twelve problems → how it works with the couple (four steps, each
 *   with a drawing of the couple's real screen) → one login, every event → the close.
 *
 * A coordinator is a SUPPLIER (DECISION_LOG 2026-05-12; the `planner_coordinator` category), so every
 * call to action is the supplier door, `/open-shop` — there is no separate coordinator sign-up.
 *
 * 🔑 EVERY TOOL THIS PAGE NAMES IS IN THE APP, AND THE PAGE SAYS ONLY WHAT IT DOES.
 * `for-coordinators-says-what-ships.test.ts` beside this file pins each one to its code. Where the
 * prototype's words and the code disagreed, the words follow the code (each is listed in the PR):
 *   · in-app voice and video calls are gone from the chat (owner 2026-10-28, "remove both voice and
 *     video call") — so the kit is at most nine tools, not ten, and no line offers calls;
 *   · moving the show forward is the coordinator's AND the couple's (`decideMayAdvance` in
 *     `lib/run-of-show-advance-gate.ts`), never the emcee's;
 *   · prep-then-release releases to the couple (`setBlockPrepVisibility`);
 *   · "Recommend an add-on" has had no screen since 2026-10-02 (`studio/recommend-actions.ts`), so the
 *     one-login block does not offer it.
 *
 * 🎚 FOUR LINES SHOW ONLY WHILE THEIR SWITCH IS ON (owner 2026-11-04: *"show each line only when its
 * switch is on"*) — each supplier seeing only their rows, announcements, prepare-then-release and
 * private notes. The page reads the live switches (`_claims.server.ts`) on every request and an
 * unreadable switch reads OFF, so it can never promise a thing that is switched off. The headings'
 * counts ("Nine tools", "Twelve problems") are counted from what is shown, never typed.
 *
 * 🆓 "FREE", WITH NO END DATE (owner 2026-11-04, DECISION_LOG "DAY-OF DESKS STAY FREE — NO END DATE":
 * *"keep it free"*). The day-of tools are tagged plain "Free" — `isVendorDayOfStillFree` stays true while
 * `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL` is unset. Never write an end date here.
 *
 * NO PRICE IS TYPED HERE. The page shows no paid plan; the one "not free" line names the couple's
 * add-ons without a number. If a price is ever added, read it from the catalogue
 * (`platform_retail_catalog_v2`), never type it.
 *
 * The page sits in the shared shell (`app/(shell)/layout.tsx` owns the bar, the rail and
 * `force-dynamic`) and runs full-bleed (`DOORWAY_BLEED_PATHS`), so the photo hero reaches the edges.
 */

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { InfoTip } from '@/app/_components/info-tip';
import { LineRevealHeading, RevealBand, RevealList } from '@/app/_components/marketing/_pa-motion';
import { PhotoHeroSlides, type HeroSlide } from '@/app/_components/marketing/photo-hero';
import { ProblemScenes, type ProblemScene } from '@/app/_components/marketing/problem-scenes';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { DELEGATE_GRACE_DAYS } from '@/lib/delegate-access-window';

import { countWord, shownWith, type ClaimSwitch, type ClaimSwitches } from './_claims';
import { readClaimSwitches } from './_claims.server';

import '@/app/_components/marketing/photo-page.css';
import './_for-coordinators.css';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PHOTOS = '/marketing/2026-11-04';

const TITLE = 'For Coordinators — Run every event from one place, free';
const DESCRIPTION =
  'Open your coordinator shop free. With the couple’s say-so, run their event from one place — the guest list, the seat plan, the run-of-show, door check-in and the day-of desk. Your own clients never carry a fee.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/for-coordinators' },
  openGraph: {
    images: BRAND_OG_IMAGES,
    title: `${TITLE} · Setnayan`,
    description: DESCRIPTION,
    url: '/for-coordinators',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    images: BRAND_TWITTER_IMAGES,
    card: 'summary_large_image',
    title: `${TITLE} · Setnayan`,
    description: DESCRIPTION,
  },
};

const PAGE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/for-coordinators#webpage`,
      url: `${SITE_URL}/for-coordinators`,
      name: `${TITLE} · Setnayan`,
      description: DESCRIPTION,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      audience: {
        '@type': 'BusinessAudience',
        audienceType: 'Wedding and event coordinators in the Philippines',
        geographicArea: { '@type': 'Country', name: 'Philippines' },
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/for-coordinators#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'For Coordinators', item: `${SITE_URL}/for-coordinators` },
      ],
    },
  ],
};

/** The hero's three photos. `dr` = how far right the photo is pushed at ≥1024 px (prototype `--dr`). */
const HERO: readonly HeroSlide[] = [
  { src: `${PHOTOS}/coord-hero.webp`, width: 1600, height: 900, dr: '25%' },
  { src: `${PHOTOS}/problem-09-entourage.webp`, width: 960, height: 720, dr: '14%' },
  { src: `${PHOTOS}/supplier-team-hero.webp`, width: 1600, height: 1200, dr: '19%' },
];

/** A line that is true only while a switch is on carries `needs` — see `_claims.ts`. */
type Gated<T> = T & { needs?: ClaimSwitch };

const FREE_LINE: readonly Gated<{ text: string }>[] = [
  { text: 'Shop + dashboard' },
  { text: 'Host access, part by part' },
  { text: 'One run-of-show', needs: 'runOfShow' },
  { text: 'Door check-in' },
  { text: 'Day-of desk' },
  { text: 'Auto-arrange seats' },
  { text: 'One-tap invites' },
  { text: 'One free helper' },
  { text: 'Events you run' },
];

/** Icon strokes from the prototype (24 × 24, drawn with `currentColor`). */
const KIT: readonly Gated<{ title: string; body: string; icon: ReactNode }>[] = [
  {
    title: 'Your shop and dashboard',
    body: 'Couples find you under coordinators. The clients you bring yourself never carry a fee.',
    icon: (
      <>
        <path d="M4 9l1.5-5h13L20 9" />
        <path d="M4 9h16v11H4z" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
  },
  {
    title: 'Host access, part by part',
    body: 'The couple invites you; you ask for the parts you need; they approve each one.',
    icon: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="M11 12l9-9M16 7l3 3" />
      </>
    ),
  },
  {
    title: 'One run-of-show',
    body: 'Each supplier sees only their rows. They ask to move a time; you approve.',
    needs: 'runOfShow',
    icon: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="18" r="1" />
      </>
    ),
  },
  {
    title: 'Door check-in',
    body: 'Scan each guest’s pass at the door and send them to their seat.',
    icon: (
      <>
        <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
        <path d="M4 12h16" />
      </>
    ),
  },
  {
    title: 'The day-of desk',
    body: 'Cue the show, the requests inbox and the seat scanner, in one place on the day.',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
        <path d="M8 10l3 2-3 2" />
      </>
    ),
  },
  {
    title: 'Auto-arrange seats',
    body: 'One tap seats everyone; move anyone by hand after.',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="3.5" r="1.5" />
        <circle cx="12" cy="20.5" r="1.5" />
        <circle cx="3.5" cy="12" r="1.5" />
        <circle cx="20.5" cy="12" r="1.5" />
      </>
    ),
  },
  {
    title: 'One-tap invites',
    body: 'Invitations go out through Messenger, Viber or WhatsApp.',
    icon: (
      <>
        <path d="M21 3L10 14" />
        <path d="M21 3l-7 18-4-7-7-4z" />
      </>
    ),
  },
  {
    title: 'One helper, free',
    body: 'A teammate gets their own login under your shop.',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0113 0" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M16 14.5a5 5 0 016 5" />
      </>
    ),
  },
  {
    title: 'Events you run',
    body: 'Every client’s event, one tap from your supplier dashboard.',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
];

/** `addWhen` appends one sentence to the answer, only while its switch is on. */
const PROBLEMS: readonly Gated<ProblemScene & { addWhen?: { needs: ClaimSwitch; text: string } }>[] = [
  {
    photo: `${PHOTOS}/problem-11-five-apps.webp`,
    alt: 'A coordinator juggling a laptop and two phones',
    title: 'Working from the couple’s screenshots',
    pain: 'You run their event from forwarded screenshots and a password they texted you.',
    answer:
      'The couple invites you into their own event. You ask for the parts you need — guest list, seat plan, schedule, suppliers, invitations — and they approve each one. Their budget and photos stay closed unless they open them.',
    link: { href: '#how', label: 'See how access works' },
    tag: 'Free',
  },
  {
    photo: `${PHOTOS}/problem-06-coordinator.webp`,
    alt: 'A coordinator checking her watch at a reception',
    title: 'The timeline lives in your head',
    pain: 'Every supplier has a different version of the day, and the only full copy is yours.',
    answer:
      'One run-of-show for the whole event. Each supplier sees only their own rows; the couple and the guests see theirs.',
    link: { href: '/schedule', label: 'See the run-of-show' },
    tag: 'Free',
    needs: 'runOfShow',
  },
  {
    photo: `${PHOTOS}/problem-seatplan.webp`,
    alt: 'A couple arranging coloured cards for their seat plan',
    title: 'The seat plan redrawn at midnight',
    pain: 'A family arrives with three more people, and the chart is paper.',
    answer:
      'Auto-arrange the seats in one tap, then move anyone by hand. Everyone with the plan open sees each change.',
    link: { href: '/seat-plan', label: 'See the seat plan' },
    tag: 'Free',
  },
  {
    photo: `${PHOTOS}/problem-08-invites.webp`,
    alt: 'Hands sealing an invitation envelope',
    title: 'Invites across five apps',
    pain: 'You send the invitation from one app, chase the replies in another and lose the thread in a third.',
    answer: 'Invitations go to Messenger, Viber or WhatsApp in one tap, straight from the couple’s guest list.',
    link: { href: '/guest-list', label: 'See the guest list' },
    tag: 'Free',
  },
  {
    photo: `${PHOTOS}/problem-03-door.webp`,
    alt: 'A queue of guests at the reception door',
    title: 'A line at the door',
    pain: 'Guests wait while someone searches a printed list for their name and table.',
    answer:
      'Check guests in at the door by scanning their pass, and send them to their seat. On the day-of desk, the seat scanner finds any guest’s table. With the couple’s approval you see the full guest details.',
    tag: 'Free',
  },
  {
    photo: `${PHOTOS}/coord-05-cue-the-show.webp`,
    alt: 'A coordinator with an earpiece cueing the next part of the programme',
    title: 'Everyone thinks they are running the show',
    pain: 'The emcee, the band and the venue each move to the next part when they think it is time.',
    answer:
      'On the day, only you and the couple move the show forward, part by part. The emcee and the other suppliers cannot.',
    tag: 'Free',
  },
  {
    photo: `${PHOTOS}/supplier-02-inquiries.webp`,
    alt: 'A crew member overwhelmed by messages on his phone',
    title: 'Ten suppliers, ten chats, one evening',
    pain: 'Requests and problems arrive by text, call and tap on the shoulder, all at once.',
    answer: 'One requests inbox for the day. Every supplier’s request and issue lands in one list that you sort.',
    tag: 'Free',
  },
  {
    photo: `${PHOTOS}/supplier-12-time-changes.webp`,
    alt: 'A supplier checking his watch during set-up',
    title: 'Times changed in the group chat',
    pain: 'A supplier moves their own call time, and you find out when they arrive late.',
    answer:
      'Suppliers ask for a new time; you or the couple approve or decline it. A supplier never edits the timeline.',
    link: { href: '/schedule', label: 'See the Schedule' },
    tag: 'Free',
  },
  {
    photo: `${PHOTOS}/coord-06-announcement.webp`,
    alt: 'A coordinator speaking quietly into her phone at the side of a reception',
    title: 'Announcements shouted across the hall',
    pain: 'Dinner is moved, the shuttle is late — and half the guests never hear it.',
    answer: 'Send one announcement and it appears on every guest’s Event Hub, on their phone.',
    tag: 'Free',
    needs: 'announcements',
  },
  {
    photo: `${PHOTOS}/supplier-team.webp`,
    alt: 'A coordinator’s team checking an event together on a tablet',
    title: 'Many clients, many logins',
    pain: 'Each client’s event is a different chat, a different file and a different login.',
    answer:
      'One login opens every event you run. Your team works under your shop, each with their own login — one helper seat is free.',
    tag: 'Free · one helper',
  },
  {
    photo: `${PHOTOS}/coord-03-prep-private.webp`,
    alt: 'A coordinator drafting the programme alone before the client meeting',
    title: 'Plans leak before they are ready',
    pain: 'A draft time reaches the caterer before the couple has even said yes.',
    answer:
      'Prepare schedule items in private and release them to the couple when they are ready. Until then, nobody else sees them.',
    tag: 'Free',
    needs: 'prepRelease',
  },
  {
    photo: `${PHOTOS}/problem-receipts.webp`,
    alt: 'A tired couple with a pile of receipts',
    title: 'Supplier deposits on scraps of paper',
    pain: 'Who is booked, who is paid and who still needs a first payment lives in a notebook.',
    answer:
      'Track every booked supplier and payment for the couple. You book a supplier or handle a payment only where the couple allowed it.',
    addWhen: { needs: 'privateNotes', text: 'Keep private notes for yourself and notes the couple can read.' },
    tag: 'Free',
  },
];

const ONE_LOGIN = [
  { title: 'Events you run', body: 'Each client’s event, one tap from your supplier dashboard.' },
  { title: 'Your team', body: 'Each person with their own login under your shop. One helper seat is free.' },
  { title: 'Your own shop page', body: 'Couples find you under coordinators, like every supplier.' },
] as const;

/** The problems whose switches are on, each answer completed by its `addWhen` line when that is on too. */
function problemsFor(on: ClaimSwitches): ProblemScene[] {
  return shownWith(PROBLEMS, on).map(({ needs: _needs, addWhen, ...scene }) => ({
    ...scene,
    answer: addWhen && on[addWhen.needs] ? `${scene.answer} ${addWhen.text}` : scene.answer,
  }));
}

export default async function ForCoordinatorsPage() {
  // The four switches some lines depend on, read live; an unreadable one reads OFF (`_claims.ts`).
  const on = await readClaimSwitches();
  const freeLine = shownWith(FREE_LINE, on);
  const kit = shownWith(KIT, on);
  const problems = problemsFor(on);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PAGE_LD) }} />
      <main className="pp-page min-h-dvh">
        {/* ════ 1 · HERO ════ */}
        <section className="pp-hero" aria-labelledby="fc-h1">
          <PhotoHeroSlides slides={HERO} />
          <div className="pp-hero-copy">
            <p className="pp-eyebrow">For coordinators</p>
            <h1 id="fc-h1">Run every event from one place — free.</h1>
            <p className="pp-lede">
              <b>Your shop, your dashboard and the tools to run the day cost you nothing.</b> With the
              couple’s say-so, step into their event — the guest list, the seat plan, the run-of-show and every
              supplier.
            </p>
            <ul className="fc-freeline" aria-label="Free for coordinators">
              {freeLine.map((t) => (
                <li key={t.text}>{t.text}</li>
              ))}
            </ul>
            <div className="pp-ctas">
              <Link href="/open-shop" className="m-btn m-btn-primary">
                Open your coordinator shop — free
              </Link>
              <a href="#how" className="m-btn m-btn-ghost">
                How it works with the couple
              </a>
            </div>
            <div className="pp-truths">
              <span>Free to join</span>
              <span className="pp-sep" aria-hidden="true">
                ·
              </span>
              <span>Full dashboard free</span>
              <span className="pp-sep" aria-hidden="true">
                ·
              </span>
              <InfoTip label="Your own clients never carry a fee" ariaLabel="About the fee" align="start">
                A coordinator opens a supplier shop, like every supplier. The booking fee applies only to
                clients Setnayan brings you. The clients you bring yourself are free, always.
              </InfoTip>
            </div>
          </div>
        </section>

        {/* ════ 1b · THE FREE KIT ════ */}
        <section className="pp-sec" id="free" aria-labelledby="fc-h-free">
          <RevealBand className="pp-sec-head">
            <p className="pp-kicker" data-reveal-item="">
              Free for every coordinator
            </p>
            <LineRevealHeading>
              <span id="fc-h-free">{countWord(kit.length)} tools you get the day you open your shop.</span>
            </LineRevealHeading>
            <p className="pp-lede" data-reveal-item="">
              No plan to buy. They work inside the couple’s event and your supplier dashboard today.
            </p>
          </RevealBand>
          <RevealList className="fc-kit" stagger={0.04}>
            {kit.map((k) => (
              <li key={k.title} data-reveal-item="">
                <i aria-hidden="true">
                  <svg viewBox="0 0 24 24">{k.icon}</svg>
                </i>
                <b>{k.title}</b>
                <span>{k.body}</span>
              </li>
            ))}
          </RevealList>
        </section>

        {/* ════ 2 · PROBLEMS ════ */}
        <section className="pp-sec" id="solves" aria-labelledby="fc-h-solves">
          <RevealBand className="pp-sec-head">
            <p className="pp-kicker" data-reveal-item="">
              What it solves
            </p>
            <LineRevealHeading>
              <span id="fc-h-solves">
                {countWord(problems.length)} problems coordinators face. And what Setnayan does instead.
              </span>
            </LineRevealHeading>
            <p className="pp-lede" data-reveal-item="">
              Every one of these is a tool that works today, inside the couple’s event and your supplier
              dashboard.
            </p>
          </RevealBand>
          <ProblemScenes items={problems} initial={4} />
          <p className="fc-notfree">
            <b>Not free, said plainly.</b> Papic guest cameras and the Live Photo Wall are add-ons the couple
            buys for their event.
          </p>
        </section>

        {/* ════ 3 · HOW IT WORKS WITH THE COUPLE ════ */}
        <section className="pp-sec" id="how" aria-labelledby="fc-h-how">
          <RevealBand className="pp-sec-head">
            <p className="pp-kicker" data-reveal-item="">
              How it works with the couple
            </p>
            <LineRevealHeading>
              <span id="fc-h-how">Their event stays theirs. You get the parts they open.</span>
            </LineRevealHeading>
          </RevealBand>
          <ol className="fc-flow">
            <li className="fc-fs">
              <span className="fc-dot" aria-hidden="true">
                1
              </span>
              <div className="fc-ft">
                <b>The couple invites you</b>
                <span>
                  From your booking in their event — or the invite is made for them when they mark your first
                  payment.
                </span>
              </div>
              <div className="fc-ui" aria-hidden="true">
                <p className="fc-ui-h">Promote your coordinator</p>
                <p className="fc-ui-p">
                  Your booked coordinator can plan WITH you — edit the guest list, seat plan, schedule, and
                  supplier records, with every change logged. Publishing the seat plan and the first invitation
                  send always stay with you.
                </p>
                <span className="fc-ui-btn fc-ui-dark">Invite as delegate</span>
              </div>
            </li>
            <li className="fc-fs">
              <span className="fc-dot" aria-hidden="true">
                2
              </span>
              <div className="fc-ft">
                <b>You ask for the parts you need</b>
                <span>One part at a time. They get a notice in the app.</span>
              </div>
              <div className="fc-ui" aria-hidden="true">
                <p className="fc-ui-h">Ask the hosts</p>
                <p className="fc-ui-p">Pick a part — they get a notice in the app.</p>
                <div className="fc-chips">
                  <span data-on="">Guest list</span>
                  <span data-on="">Seat plan</span>
                  <span data-on="">The Day</span>
                  <span>Suppliers</span>
                  <span>Event Hub</span>
                </div>
              </div>
            </li>
            <li className="fc-fs">
              <span className="fc-dot" aria-hidden="true">
                3
              </span>
              <div className="fc-ft">
                <b>They approve each part</b>
                <span>Budget and photos stay closed unless they open them.</span>
              </div>
              <div className="fc-ui" aria-hidden="true">
                <p className="fc-ui-h">Ana Reyes is asking for access</p>
                <div className="fc-arow">
                  <span>
                    <b>Guest list</b> <em>can make changes</em>
                    <small>See who is coming.</small>
                  </span>
                  <span className="fc-yn">
                    <i data-ok="">✓ Share</i>
                    <i>✕ Decline</i>
                  </span>
                </div>
                <div className="fc-arow">
                  <span>
                    <b>The Day</b> <em>can make changes</em>
                    <small>Start each part of the day and push the timings when you run late.</small>
                  </span>
                  <span className="fc-yn">
                    <i data-ok="">✓ Share</i>
                    <i>✕ Decline</i>
                  </span>
                </div>
                <div className="fc-arow" data-shut="">
                  <span>
                    <b>Budget &amp; payments</b>
                    <small>Your budget and payments. Never Edit — View at most.</small>
                  </span>
                  <span className="fc-lock">🔒 Off</span>
                </div>
                <div className="fc-arow" data-shut="">
                  <span>
                    <b>Photos</b>
                    <small>The event’s photos. View at most.</small>
                  </span>
                  <span className="fc-lock">🔒 Off</span>
                </div>
                <p className="fc-ui-fine">You can take any of this back later, and they lose it straight away.</p>
              </div>
            </li>
            <li className="fc-fs">
              <span className="fc-dot" aria-hidden="true">
                4
              </span>
              <div className="fc-ft">
                <b>Access ends after the event</b>
                <span>{DELEGATE_GRACE_DAYS} days after the event day. The couple can end it sooner.</span>
              </div>
              <div className="fc-ui" aria-hidden="true">
                <p className="fc-ui-h">
                  Ana Reyes <small>Coordinator · until Feb 13, 2027</small>
                </p>
                <div className="fc-track">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="fc-tlabels">
                  <span>Until the event · Feb 6</span>
                  <span>+{DELEGATE_GRACE_DAYS} days</span>
                  <span>Ends</span>
                </div>
                <span className="fc-ui-btn">Remove…</span>
              </div>
            </li>
          </ol>
          <p className="fc-flow-src">
            Drawn from the couple’s real screens: Promote your coordinator · Access requests · People with
            access. Sample names and dates.
          </p>
        </section>

        {/* ════ 4 · ONE LOGIN, EVERY EVENT ════ */}
        <section className="pp-sec" id="many" aria-labelledby="fc-h-many">
          <div className="fc-many">
            <Image
              src={`${PHOTOS}/coord-multi-events.webp`}
              alt="A coordinator moving between two events on one evening"
              width={960}
              height={720}
              sizes="(min-width: 701px) 50vw, 100vw"
            />
            <div className="fc-many-copy">
              <p className="pp-kicker">Your business</p>
              <LineRevealHeading>
                <span id="fc-h-many">One login. Every event you run.</span>
              </LineRevealHeading>
              <RevealList className="fc-lines">
                {ONE_LOGIN.map((l) => (
                  <li key={l.title} data-reveal-item="">
                    <b>{l.title}</b>
                    <span>{l.body}</span>
                  </li>
                ))}
              </RevealList>
            </div>
          </div>
        </section>

        {/* ════ 5 · CLOSE ════ */}
        <section className="pp-close" aria-labelledby="fc-h-close">
          <h2 id="fc-h-close">
            Set na ’yan.<em>Every event, one desk.</em>
          </h2>
          <div className="pp-ctas">
            <Link href="/open-shop" className="m-btn m-btn-primary">
              Open your coordinator shop — free
            </Link>
          </div>
          <p className="pp-fine">Free to join · Full dashboard free · Your own clients never carry a fee</p>
        </section>
      </main>
    </>
  );
}
