import { Heart, Briefcase, Mailbox, Shield, Globe, QrCode, type LucideIcon } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// How it works — the six kinds of people on Setnayan and how the flow connects.
// Folded in from the standalone /how-it-works page (retired 2026-09-01; that URL
// and /tl/how-it-works now 301 here).
//
// ─── WHY THE MOVE IS AN IMPROVEMENT, NOT JUST A CONSOLIDATION ───────────────
// /how-it-works and /tl/how-it-works were a 413-line page and a 405-line FULL
// COPY of it — the older duplicate-the-whole-page localization pattern. This
// page uses the newer dictionary + thin-routes architecture (owner 2026-06-13),
// so the two locales now sit side by side in one file and cannot structurally
// drift. ~800 lines of duplicated markup retired.
//
// ─── 🛑 FOUR CLAIMS WERE FALSE AND WERE CORRECTED IN THE MOVE ───────────────
// All four were live on TWO public pages in TWO languages. Each was checked
// against the shipped tree / the production database on 2026-09-01 — not
// against the document that made the claim.
//
//  1. `/e/[event-slug]` — THE ROUTE DOES NOT EXIST. There is no `app/e/`
//     directory; the guest-facing event route is `app/[slug]`. The page was
//     printing a URL shape a visitor could copy and land on a 404.
//     Re-check: `ls apps/web/app/e` (absent) vs `apps/web/app/[slug]` (present).
//
//  2. "One event, one owner today" — CO-HOSTS SHIP. `lib/host-gate.ts` refuses
//     with "only current hosts can edit this event" (plural), and `lib/chat.ts`
//     names "co-hosts accepted via" invite. An event has several hosts.
//     Re-check: `grep -n "co-host" apps/web/lib/chat.ts apps/web/lib/entitlements.ts`.
//
//  3. WEDDING-ONLY FRAMING — SEVENTEEN CELEBRATION TYPES ARE LIVE. Measured in
//     production 2026-09-01: `select count(*) from event_type_profiles` → 17
//     (anniversary, birthday, celebration, christening, corporate, date, debut,
//     gala_night, gender_reveal, graduation, hangout, reunion, simple_event,
//     tournament, travel, wake, wedding). PR #5029 already removed this framing
//     from the HOME page; these two pages still carried it.
//
//  4. "Couple browses /vendors" — `/vendors` IS THE SUPPLIER SALES PAGE
//     ("Built to grow your business — free"), and `/vendors/*` → `/explore` by
//     owner directive 2026-06-14. The marketplace a host browses is `/explore`.
//     Re-check: `grep -n "vendors/\* → /explore" apps/web/middleware.ts`.
//
// ⚠ CONTRAST `_WhySetnayan.tsx`, WHERE THE WEDDING FRAMING WAS LEFT ALONE.
// There it is owner-approved positioning copy, and narrowing the audience is a
// marketing choice. Here it stated something FALSE about what the product
// accepts. Fixing the second is a defect fix; rewriting the first would not be.
//
// Bilingual (EN + Taglish) — the Taglish prose is CARRIED OVER from the retired
// /tl/how-it-works rather than re-translated, so the owner's approved wording
// survives the move. Only the four corrections above are new in either locale.
//
// Icons are language-neutral and zip with COPY[locale].roles by index — keep
// the two arrays the same length + order.

const ROLE_ICONS: LucideIcon[] = [Heart, Briefcase, Mailbox, Shield, Globe, QrCode];

/**
 * Entry paths are language-neutral and live here ONCE, beside the icons.
 *
 * 🔑 A PATH IS NOT PROSE. Putting these in the per-locale dictionaries is how
 * `/e/[event-slug]` survived in two languages — the English page was corrected
 * once before without the Taglish twin being touched, because a reader fixing
 * copy has no reason to open the other file. One array, both locales.
 */
const ROLE_PATHS: string[] = [
  '/dashboard',
  '/vendor-dashboard',
  '/[slug]',
  '/admin',
  '/',
  '/[slug]',
];

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    roles: { label: string; who: string; where: string[] }[];
    flowHeading: string;
    flow: { from: string; to: string; what: string }[];
  }
> = {
  en: {
    eyebrow: 'How it works · who’s who',
    heading: 'The six kinds of people on Setnayan.',
    intro:
      'The complete map of who’s who and where each person spends their time — one paragraph per role, plus how the flow connects.',
    roles: [
      {
        label: 'Host',
        who: 'You’re planning a celebration — a wedding, a debut, a christening, a reunion, and thirteen more. An event can have several hosts.',
        where: [
          'Guest list, invitation site, vendors, budget, seating, mood board',
          'Day-of mode from T-1h to T+8h with table + schedule + photo wall',
          'Add-ons (photo delivery, Live Studio, Papic, supplies marketplace, more)',
        ],
      },
      {
        label: 'Vendor',
        who: 'You sell to hosts. Free profile, optional paid tier for more reach.',
        where: [
          'Services, bookings inbox, team roles, earnings rollup',
          'Reply-only chat — hosts reach out, you reply with quotes + files',
          'Verification badge, reviews from completed events',
        ],
      },
      {
        label: 'Guest',
        who: 'You got invited. No sign-up needed — just open your link.',
        where: [
          'Save-the-Date → Invitation → Logistics → Post-event (4 phases)',
          'RSVP, meal preference, plus-one naming',
          'Day-of: find your table, see the live schedule, upload photos',
        ],
      },
      {
        label: 'Admin',
        who: 'Setnayan operations team. Gated behind is_internal.',
        where: [
          'Users, vendors, orders, reviews — the day-to-day moderation',
          'Funnels, force-majeure escalations, verification queue',
          'Website editor for marketing-site widgets',
        ],
      },
      {
        label: 'Public landing',
        who: 'The marketing site at setnayan.com. Where you’re standing now.',
        where: [
          'Host-side sign-up + vendor-side registration',
          'Browse the marketplace, read features, see pricing, get help',
          'No login needed — bookmark and share',
        ],
      },
      {
        label: 'Event landing',
        who: 'The event’s own public page. The link you share with everyone.',
        where: [
          'Auto-shifts through 4 phases as the date approaches',
          'Each guest gets their own slug for personalised RSVP',
          'Activates day-of mode from T-1h on the day itself',
        ],
      },
    ],
    flowHeading: 'How the flow connects',
    flow: [
      {
        from: 'Host',
        to: 'Vendors',
        what: 'Host browses the marketplace at /explore and opens a chat thread with one (vendors cannot DM cold).',
      },
      {
        from: 'Vendor',
        to: 'Host',
        what: 'Vendor replies with a quote + files. Both sides see the same thread.',
      },
      {
        from: 'Host',
        to: 'Guests',
        what: 'Host builds the guest list and prints / shares QR-coded invites.',
      },
      {
        from: 'Guests',
        to: 'Host',
        what: 'Each guest scans their QR, lands on their personal page, RSVPs.',
      },
      {
        from: 'Day-of',
        to: 'Everyone',
        what: 'T-1h flips the event into live mode — tables, schedule, photo wall, broadcast.',
      },
      {
        from: 'Post-event',
        to: 'Host ↔ Vendor',
        what: 'Reviews land 24h after the event; force-majeure flags route to admin if filed.',
      },
    ],
  },
  tl: {
    eyebrow: 'Paano ito gumagana · sino-sino',
    heading: 'Ang anim na uri ng tao sa Setnayan.',
    intro:
      'Ang buong mapa ng sino-sino at saan gumugugol ng oras ang bawat isa — isang talata bawat role, kasama kung paano nag-uugnay ang daloy.',
    roles: [
      {
        label: 'Host',
        who: 'Nagpaplano ka ng pagdiriwang — kasal, debut, binyag, reunion, at labintatlo pa. Pwedeng maraming host ang isang event.',
        where: [
          'Guest list, invitation site, vendors, budget, seating, mood board',
          'Day-of mode from T-1h to T+8h — table + schedule + photo wall',
          'Add-ons (photo delivery, Live Studio, Papic, supplies marketplace, at iba pa)',
        ],
      },
      {
        label: 'Vendor',
        who: 'Nagbebenta ka sa mga host. Free profile, optional na bayad na tier para sa mas maraming reach.',
        where: [
          'Services, bookings inbox, team roles, earnings rollup',
          'Reply-only chat — ang host ang lalapit, ikaw ang sasagot with quotes + files',
          'Verification badge, reviews from completed events',
        ],
      },
      {
        label: 'Guest',
        who: 'Na-invite ka. No sign-up needed — buksan mo lang ang link mo.',
        where: [
          'Save-the-Date → Invitation → Logistics → Post-event (4 phases)',
          'RSVP, meal preference, plus-one naming',
          'Day-of: hanapin ang table mo, tingnan ang live schedule, mag-upload ng photos',
        ],
      },
      {
        label: 'Admin',
        who: 'Setnayan operations team. Naka-gate sa likod ng is_internal.',
        where: [
          'Users, vendors, orders, reviews — ang araw-araw na moderation',
          'Funnels, force-majeure escalations, verification queue',
          'Website editor para sa marketing-site widgets',
        ],
      },
      {
        label: 'Public landing',
        who: 'Ang marketing site sa setnayan.com. Kung nasaan ka ngayon.',
        where: [
          'Host-side sign-up + vendor-side registration',
          'I-browse ang marketplace, basahin ang features, tingnan ang pricing, humingi ng help',
          'No login needed — i-bookmark at i-share',
        ],
      },
      {
        label: 'Event landing',
        who: 'Ang sariling public page ng event. Ang link na i-share mo sa lahat.',
        where: [
          'Auto-shift sa 4 phases habang papalapit ang date',
          'May sariling slug ang bawat guest para sa personalised RSVP',
          'Nag-a-activate ng day-of mode from T-1h sa mismong araw',
        ],
      },
    ],
    flowHeading: 'Paano nag-uugnay ang daloy',
    flow: [
      {
        from: 'Host',
        to: 'Vendors',
        what: 'Nagba-browse ang host sa marketplace sa /explore at nagbubukas ng chat thread sa isa (hindi pwedeng mag-cold-DM ang vendors).',
      },
      {
        from: 'Vendor',
        to: 'Host',
        what: 'Sumasagot ang vendor with a quote + files. Iisang thread ang nakikita ng dalawa.',
      },
      {
        from: 'Host',
        to: 'Guests',
        what: 'Ginagawa ng host ang guest list at nagpi-print / nag-share ng QR-coded invites.',
      },
      {
        from: 'Guests',
        to: 'Host',
        what: 'Ini-scan ng bawat guest ang QR nila, lalapag sa personal page nila, at mag-RSVP.',
      },
      {
        from: 'Day-of',
        to: 'Everyone',
        what: 'Sa T-1h nagiging live mode ang event — tables, schedule, photo wall, broadcast.',
      },
      {
        from: 'Post-event',
        to: 'Host ↔ Vendor',
        what: 'Lalabas ang reviews 24h after the event; ang force-majeure flags ay pupunta sa admin kung may na-file.',
      },
    ],
  },
};

export function HowItWorks({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="how-it-works-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.intro}</p>
        </header>

        <ul className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.roles.map((role, i) => {
            const Icon = ROLE_ICONS[i]!;
            return (
              <li
                key={role.label}
                className="rounded-xl border border-ink/10 bg-cream p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-ink">
                      {role.label}
                    </h3>
                    <code className="text-xs text-ink/45">{ROLE_PATHS[i]}</code>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink/65">{role.who}</p>
                <ul className="mt-3 space-y-1.5">
                  {role.where.map((w) => (
                    <li key={w} className="text-sm text-ink/55">
                      {w}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/50">
          {c.flowHeading}
        </h3>
        <ol className="space-y-3">
          {c.flow.map((step) => (
            <li
              key={`${step.from}-${step.to}-${step.what.slice(0, 24)}`}
              className="flex flex-col gap-1 rounded-xl border border-ink/10 bg-cream p-4 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="shrink-0 text-sm font-semibold tracking-tight text-ink">
                {step.from} → {step.to}
              </span>
              <span className="text-sm text-ink/65">{step.what}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
