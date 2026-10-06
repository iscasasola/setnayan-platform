/**
 * /dev/details-lab — the Maker's Details page (three columns, the theme gallery,
 * the folded-in prints) on fixture data, with no sign-in and no database
 * (Details part 1, 2026-09-28). DEV-ONLY: production builds 404 this route, the
 * same kill-switch as `/dev/hero-lab`. NODE_ENV is inlined at build time, so
 * the guard is free and the lab never ships.
 *
 * Why it exists: the page is LAYOUT — a navigator that is a strip on a 375 px
 * phone and a column on a desk, an editor that opens under it, a gallery that
 * must not load ten pages at once — and no unit test lays out. It draws the
 * REAL `MakerDetails`. What needs the database says so honestly here: the
 * couple's print pictures answer "could not draw" (the print route asks who is
 * signed in), and the sample's pictures need the sample row.
 *
 *   ?item=invitation      open on one item (default: Theme, as a cold open)
 *   ?item=march           the Wedding March maker on fixtures — drags drawn, never sent
 *                         (+ `&march=owner`: the owner-shaped march, 45 walks · 80 walking)
 *   ?pro=1                a couple with Event Hub Pro
 *   ?look=1               the Look (part 3): Mood Board, Logo, Hero, Reveal — stand-ins
 *                         for the work area's pages, so the layout can be checked
 *   ?type=birthday|wake   another celebration (default: wedding) — no Love Story item
 *   ?guide=1|walk-S|ready-S  the guided "What's left", by stage (S = save_the_date, rsvp-stage, …) — with Your event on
 *                         fixtures; `&fresh=1` a new event (nothing filled in yet)
 */
import { MakerDetails, detailsFactEditors } from '@/app/dashboard/[eventId]/launch/_components/maker-details';
import { pickableInviteThemes } from '@/lib/invite-themes';
import { formatFor, parsePrintDetails } from '@/lib/print-pieces';
import { detailsItemFor } from '@/lib/maker-details-items';
import { parseGuideParam } from '@/lib/details-guided-flow';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { resolveRoleSet } from '@/lib/role-sets';
import { hasTwoNamedPeople } from '@/lib/two-named-people';
import type { YourEventInput } from '@/app/dashboard/[eventId]/launch/_components/details-your-event-parts';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from '@/lib/event-type-profile';
import { updateEventSlug } from '@/app/dashboard/[eventId]/invitation/actions';
import { updateQrStyle } from '@/app/dashboard/[eventId]/launch/qr-look-actions';
import { updateSpecialMessage } from '@/app/dashboard/[eventId]/website/special-message/actions';
import { labMarchSections } from './march-fixture';

const EVENT = '00000000-0000-4000-8000-000000000000';

/** The lab's Event Details page — also mounted whole inside the Maker lab (`/dev/maker-lab`). */
export function detailsLabNode(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const pro = one('pro') === '1';
  const withLook = one('look') === '1';
  const profile = one('type') === 'wake' ? WAKE_PROFILE : one('type') === 'birthday' ? { ...GENERIC_PROFILE, eventType: 'birthday' } : WEDDING_PROFILE;
  const themes = pickableInviteThemes();
  const stored = parsePrintDetails({ opening_line: 'Together with their families', include: undefined });
  const eventContext = { profile, solemn: profile === WAKE_PROFILE };
  const pabuyaMessage = 'Thank you for joining us — every gift is received with thanks.';
  const specialMessage = 'We can’t wait to see you on December 18.';
  /* ✍ Words (part 2b): the same editors the stage opens. Story & plans need the
     database (the scrapbook, the schedule, the guest's RSVP), so the lab says
     so honestly with a line in each picture. */
  const facts = detailsFactEditors({
    eventId: EVENT,
    specialMessage,
    specialMessageAction: updateSpecialMessage.bind(null, EVENT),
    pabuyaMessage,
    loveStory: { story: {}, ownsPro: pro },
  });
  /* 🪜 The guided flow (part 5): Your event on fixtures, so its first steps are real items. */
  const guideAddr = parseGuideParam(one('guide'));
  const fresh = one('fresh') === '1';
  /* 🧪 `?shape=mj` — maria-and-jose's REAL shape (read-only SQL, 2026-10-05):
     first names only, the date set, Cyber Neon in the draft over a live
     Classic, no parent but one co-host ACCOUNT (a planner — never listed as the
     invitation's host), the film's own background picked, nothing else filled in, and the setup's
     facts (no guests yet) — so the counts, the Parents step and the guests'
     names step behave as they did on the owner's live walk. */
  const mj = one('shape') === 'mj';
  const words = eventWordsFromProfile(profile);
  /* 🚶 `?item=march` — the Wedding March maker on maria-and-jose's couple + a full entourage (`march-fixture.ts`). */
  const marchLab = one('item') === 'march';
  const yourEvent: YourEventInput | null = guideAddr || marchLab
    ? {
        kind: {
          words: { twoPeople: hasTwoNamedPeople(profile), solemn: words.solemn, eventWord: words.eventWord },
          offeredRoles: resolveRoleSet(profile.roleSetKey).offeredRoles,
        },
        facts: {
          names: mj ? ['Maria', 'Jose'] : fresh ? ['', ''] : ['Claire', 'Indalecio'],
          date: { value: mj ? '2026-12-12' : fresh ? null : '2026-12-18', dayPrecise: mj || !fresh },
          venueCount: fresh || mj ? 0 : 1,
          parentCount: fresh || mj ? 0 : 2,
          // Where the invitation prints parents a co-host account never counts (`readYourEventFacts`).
          hostCount: mj ? 0 : 1,
          marchLines: marchLab ? 1 : 0,
        },
        names: hasTwoNamedPeople(profile)
          ? {
              people: ['Bride', 'Groom'],
              initial: mj
                ? [{ first: 'Maria', last: '' }, { first: 'Jose', last: '' }]
                : fresh
                ? [{ first: '', last: '' }, { first: '', last: '' }]
                : [{ first: 'Claire', last: 'Buanhog' }, { first: 'Indalecio', last: 'Casasola' }],
              wholeForm: null,
            }
          : null,
        // A one-person event's Name (owner 2026-09-29, "yes to all 4") — the lab's birthday.
        oneName: hasTwoNamedPeople(profile) ? null : { initial: fresh ? '' : 'Mateo', hint: 'Guests read it on your page, on every print and on every pass.' },
        date: {
          confirmedVendorCount: 0,
          dateDisplay: fresh ? null : 'December 18, 2026',
          dateValue: fresh ? null : '2026-12-18',
          label: 'Date',
          matrix: Promise.resolve(null),
          nudge: null,
        },
        venues: { resolved: [], slots: [], city: null },
        march: marchLab ? { ...labMarchSections(one('march')), lab: true } : { sections: [] },
      }
    : null;
  const needsDb = (what: string) => <p className="p-6 text-sm text-ink/60">{what} is read from the database — open it in the Maker.</p>;
  return (
      <MakerDetails
        eventId={EVENT}
        slug="indalecio-and-claire"
        slugAction={updateEventSlug.bind(null, EVENT, 'launch')}
        qr={{ ownsPro: pro, style: {}, inks: ['#1A1A1A'], storeShell: false }}
        qrStyleAction={updateQrStyle.bind(null, EVENT)}
        theme={{
          themes: themes.map((t) => ({ id: t.id, name: t.name, tier: t.tier })),
          current: mj ? 'cyber' : 'house',
          ownsPro: pro,
          storeShell: false,
          suggested: 'vintage',
          sampleVersion: null,
          posters: {},
          tour: false,
          chosen: mj || !fresh,
          // maria-and-jose's film keeps a picked background (plain #e8d9bd).
          filmOwnBackground: mj,
        }}
        prints={{
          eventId: EVENT,
          slug: 'indalecio-and-claire',
          theme: 'house',
          ownsPro: pro,
          storeShell: false,
          previewVersion: null,
          formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
        }}
        menu={{ saved: [], caterer: [], suggestions: [], flash: null }}
        stored={stored}
        hosts={
          mj
            ? [{ moderatorId: 'm1', label: 'Ana & Marco · wedding planner external', contact: 'testnayan1@test.com' }]
            : [{ moderatorId: 'm1', label: 'Claire', contact: '0917 555 0101' }]
        }
        parents={
          mj
            ? []
            : [
                { guestId: null, name: 'Atty. Eufrocina M. Sacdalan-Casasola', card: null },
                { guestId: null, name: 'Mrs. Milagros Buanhog', card: null },
              ]
        }
        pabuyaMessage={pabuyaMessage}
        specialMessage={specialMessage}
        facts={facts}
        loveStory={{ book: needsDb('The Love Story'), moments: 0 }}
        schedule={{ page: needsDb('The schedule'), moments: null, pieces: [] }}
        rsvp={{ page: needsDb('The guest’s RSVP'), settings: needsDb('The RSVP settings') }}
        hasPalette={!fresh}
        hasGifts={false}
        flash={null}
        stamp="lab"
        initialItem={detailsItemFor({ tool: 'details', item: one('item') })}
        eventContext={eventContext}
        yourEvent={yourEvent}
        guide={
          guideAddr
            ? {
                open: true,
                address: guideAddr,
                itemNamed: Boolean(one('item')),
                guideNamed: true,
                tour: null,
                ...(mj
                  ? {
                      setup: {
                        guestList: true,
                        arrival: false,
                        venuesLocked: { ceremony: false, reception: false },
                        venuesNamed: { ceremony: false, reception: false },
                        loveStoryMoments: 0,
                        wear: false,
                        replyBy: false,
                        guests: 0,
                      },
                      guestsHref: `/dashboard/${EVENT}/guests?import=1`,
                    }
                  : {}),
              }
            : null
        }
        look={
          withLook
            ? {
                moodBoard: (
                  <div data-lab-stand="mood-board" className="flex min-h-[1400px] items-start justify-center bg-white/70 pt-10 text-sm text-ink/60">
                    Mood Board — the picked part (theme, inspirations, palette, reception…)
                  </div>
                ),
                moodBoardControls: (
                  <div data-lab-stand="mood-board-controls" className="rounded-md bg-white/70 p-4 text-sm text-ink/60">
                    Mood Board — the part’s controls (supplier sign-off, share, downloads)
                  </div>
                ),
                logoDone: !fresh,
                heroDone: false,
                heroOn: ['Save the Date', 'Invitation', 'The Day', 'The poster'],
                revealOn: ['Save the Date', 'Invitation'],
              }
            : null
        }
      />
  );
}
