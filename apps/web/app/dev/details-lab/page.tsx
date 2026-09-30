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
 *   ?pro=1                a couple with Event Hub Pro
 *   ?look=1               the Look (part 3): Mood Board, Logo, Hero, Reveal — stand-ins
 *                         for the work area's pages, so the layout can be checked
 *   ?type=birthday|wake   another celebration (default: wedding) — no Love Story item
 *   ?item=love-story      the INSTANT Love Story on fixtures (`love-story-lab.tsx`):
 *                         `&ms=` the stand-in save's delay, `&refuse=1` every save refused,
 *                         `&seed=1` a story still told only in its onboarding words
 *   ?guide=1|ready-N      the guided "What's left" (Details part 5) — with Your event on
 *                         fixtures; `&fresh=1` a new event (nothing filled in yet)
 */
import { notFound } from 'next/navigation';
import { MakerDetails, detailsFactEditors } from '@/app/dashboard/[eventId]/launch/_components/maker-details';
import { LookLab } from './look-lab';
import { LoveStoryLab } from './love-story-lab';
import { LAB_STORY, LAB_STORY_SEED } from './love-story-fixture';
import { INVITE_THEMES, pickableInviteThemes } from '@/lib/invite-themes';
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

const EVENT = '00000000-0000-4000-8000-000000000000';

export default async function DetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const pro = one('pro') === '1';
  const withLook = one('look') === '1';
  const profile = one('type') === 'wake' ? WAKE_PROFILE : one('type') === 'birthday' ? { ...GENERIC_PROFILE, eventType: 'birthday' } : WEDDING_PROFILE;
  const themes = pickableInviteThemes({ mayShowStdFilm: true });
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
    loveStory: { story: one('seed') === '1' ? LAB_STORY_SEED : LAB_STORY, ownsPro: pro },
  });
  /* 🪜 The guided flow (part 5): Your event on fixtures, so its first steps are real items. */
  const guideAddr = parseGuideParam(one('guide'));
  const fresh = one('fresh') === '1';
  const words = eventWordsFromProfile(profile);
  const yourEvent: YourEventInput | null = guideAddr
    ? {
        kind: {
          words: { twoPeople: hasTwoNamedPeople(profile), solemn: words.solemn, eventWord: words.eventWord },
          offeredRoles: resolveRoleSet(profile.roleSetKey).offeredRoles,
        },
        facts: {
          names: fresh ? ['', ''] : ['Claire', 'Indalecio'],
          date: { value: fresh ? null : '2026-12-18', dayPrecise: !fresh },
          venueCount: fresh ? 0 : 1,
          parentCount: fresh ? 0 : 2,
          hostCount: 1,
          marchLines: 0,
        },
        names: hasTwoNamedPeople(profile)
          ? {
              people: ['Bride', 'Groom'],
              initial: fresh
                ? [{ first: '', last: '' }, { first: '', last: '' }]
                : [{ first: 'Claire', last: 'Buanhog' }, { first: 'Indalecio', last: 'Casasola' }],
              keep: { region: '', feel: '' },
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
        venues: { resolved: [], slots: [], city: null, launchDate: null },
        march: { sections: [], panel: null },
      }
    : null;
  const needsDb = (what: string) => <p className="p-6 text-sm text-ink/60">{what} is read from the database — open it in the Maker.</p>;
  return (
    <div className="h-dvh bg-cream text-ink">
      <LookLab>
      <MakerDetails
        eventId={EVENT}
        slug="indalecio-and-claire"
        slugAction={updateEventSlug.bind(null, EVENT, 'launch')}
        qr={{ ownsPro: pro, style: {}, inks: ['#1A1A1A'], storeShell: false }}
        qrStyleAction={updateQrStyle.bind(null, EVENT)}
        theme={{
          themes: themes.map((t) => ({ id: t.id, name: t.name, tier: t.tier })),
          current: 'house',
          ownsPro: pro,
          storeShell: false,
          suggested: 'vintage',
          sampleVersion: null,
          blurbs: Object.fromEntries(themes.map((t) => [t.id, INVITE_THEMES[t.id].blurb])),
          posters: {},
          tour: false,
          chosen: !fresh,
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
        hosts={[{ moderatorId: 'm1', label: 'Claire', contact: '0917 555 0101' }]}
        parents={[
          { guestId: null, name: 'Atty. Eufrocina M. Sacdalan-Casasola', card: null },
          { guestId: null, name: 'Mrs. Milagros Buanhog', card: null },
        ]}
        pabuyaMessage={pabuyaMessage}
        specialMessage={specialMessage}
        facts={facts}
        loveStory={{
          book: <LoveStoryLab ms={Number(one('ms') ?? 300) || 300} refuse={one('refuse') === '1'} story={one('seed') === '1' ? LAB_STORY_SEED : LAB_STORY} />,
          moments: 3,
        }}
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
            ? { open: true, ready: guideAddr.ready, itemNamed: Boolean(one('item')), guideNamed: true, tour: null }
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
                heroOn: ['Save the Date', 'Invitation', 'On the Day', 'The poster'],
                revealOn: ['Save the Date', 'Invitation'],
              }
            : null
        }
      />
      </LookLab>
    </div>
  );
}
