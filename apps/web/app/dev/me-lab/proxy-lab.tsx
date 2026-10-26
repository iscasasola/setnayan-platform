import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import type { GuestRow } from '@/app/[slug]/_lib/types';
import { GuestMeParts } from '@/app/[slug]/_components/guest-me-parts';
import { GuestTicket } from '@/app/[slug]/_components/guest-ticket';
import { MeGreeting } from '@/app/[slug]/_components/guest-greeting';
import { RsvpWidget } from '@/app/[slug]/_components/rsvp-widget';
import { guestAttireOf, guestNamePartsOf } from '@/lib/attire-rows';
import { guestGreetingOf } from '@/lib/guest-greeting';
import { guestMeFacts, guestMePartsShown } from '@/lib/guest-me-parts';
import { effectiveRoleOf, standingInWords, standsInForYouWords, type GuestStandIn } from '@/lib/guest-proxy';
import { guestRoleLabel } from '@/lib/guests';
import { labMeRolePalette, labProxyDressConfig } from './lab-people';
import { EntourageSection } from '@/app/[slug]/_components/entourage-section';
import { buildEntourage, type EntourageGuestRow } from '@/lib/entourage';
import { entourageWithProxies } from '@/lib/guest-proxy';

/**
 * 🧍‍♀️➡️🧍 THE ME LAB'S PROXY (`/dev/me-lab?proxy=1`, owner 2026-10-27) — the cale-ice pair as FIXTURES, nothing read or
 * written: Mrs. Ma. Theresa Sacdalan-Tria (a principal sponsor, Ninang) and Mrs. Maria Catherine Sacdalan, who stands in for
 * her. Drawn through the guest page's OWN pieces and the ONE effective-role reading (`effectiveRoleOf`):
 *
 *   `&who=proxy`   Maria Catherine's Me — "Standing in for … · Principal Sponsor · Ninang", the role's What to wear and
 *                  Arrive by, and her ticket (Arrive = the role's call time) — and her reply card (replies as herself).
 *   `&who=holder`  Ma. Theresa's Me once someone stands in — "Maria Catherine Sacdalan is standing in for you" — and her
 *                  reply card ("No reply is needed from you").
 *   `&who=ask`     Ma. Theresa's reply BEFORE anyone is linked, with "Regretfully declines" picked: the "I can't come —
 *                  someone will stand in for me" box.
 *   `&who=print`   the entourage as the invitation and the prints name it: "… (represented by Maria Catherine Sacdalan)".
 * Never press Send: the lab's save writes nothing.
 */
const HOLDER = { guestId: 'g-proxy-theresa', name: 'Ma. Theresa Sacdalan-Tria', role: 'principal_sponsor_ninang' as const, extra_roles: [] };

function labGuest(p: Partial<GuestRow>): GuestRow {
  return {
    guest_id: 'g-proxy-catherine',
    first_name: 'Maria Catherine',
    last_name: 'Sacdalan',
    name_prefix: 'Mrs.',
    display_name: null,
    role: 'guest',
    extra_roles: [],
    gender: 'woman',
    attire: 'neutral',
    side: 'bride',
    group_category: 'family',
    plus_one_of_guest_id: null,
    plus_one_mode: null,
    plus_one_name_confirmed_at: null,
    plus_one_allowed: false,
    plus_one_count: 0,
    plus_one_name: null,
    rsvp_status: 'pending',
    meal_preference: null,
    dietary_restrictions: null,
    guest_note: null,
    custom_tags: [],
    qr_token: 'lab-proxy',
    photo_url: null,
    photo_source: null,
    email: null,
    mobile: '+63 917 000 0000',
    ...p,
  } as unknown as GuestRow;
}

/** The Principal Sponsors as cale-ice lists them (stand-in rows): Ma. Theresa represented, the others as themselves. */
function labSponsors(): EntourageGuestRow[] {
  return [
    { guest_id: 'g-proxy-theresa', name_prefix: 'Mrs.', first_name: 'Ma. Theresa', last_name: 'Sacdalan-Tria', role: 'principal_sponsor_ninang', gender: 'woman' },
    { guest_id: 'g-ramon', name_prefix: 'Mr.', first_name: 'Ramon', last_name: 'Tria', role: 'principal_sponsor_ninong', gender: 'man' },
    { guest_id: 'g-lourdes', name_prefix: 'Mrs.', first_name: 'Lourdes', last_name: 'Bautista', role: 'principal_sponsor_ninang', gender: 'woman' },
    { guest_id: 'g-antonio', name_prefix: 'Mr.', first_name: 'Antonio', last_name: 'Bautista', role: 'principal_sponsor_ninong', gender: 'man' },
  ] as EntourageGuestRow[];
}

export async function ProxyLab({ who, reply }: { who: string | null; reply: (formData: FormData) => Promise<void> }) {
  if (who === 'print') {
    const groups = entourageWithProxies(buildEntourage(labSponsors(), null), new Map([['g-proxy-theresa', 'Maria Catherine Sacdalan']]));
    return (
      <main className="min-h-dvh bg-cream px-4 py-8 text-ink" data-lab-proxy="print">
        <section className="mx-auto max-w-[430px]">
          <p className="mb-6 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/50">Entourage · proxy lab · print</p>
          <EntourageSection groups={groups} id="lab-entourage" />
        </section>
      </main>
    );
  }
  const words = await eventWordsFor('wedding');
  const config = labProxyDressConfig();
  const rolePalette = labMeRolePalette();
  const view = who === 'holder' || who === 'ask' ? who : 'proxy';
  const standIn: GuestStandIn =
    view === 'proxy'
      ? { standingInFor: HOLDER, representedBy: null, namedProxy: null }
      : view === 'holder'
        ? { standingInFor: null, representedBy: { guestId: 'g-proxy-catherine', name: 'Maria Catherine Sacdalan' }, namedProxy: null }
        : { standingInFor: null, representedBy: null, namedProxy: null };
  const guest =
    view === 'proxy'
      ? labGuest({ stand_in: standIn, rsvp_status: 'pending' })
      : labGuest({
          guest_id: 'g-proxy-theresa',
          first_name: 'Ma. Theresa',
          last_name: 'Sacdalan-Tria',
          role: 'principal_sponsor_ninang',
          rsvp_status: 'declined',
          stand_in: standIn,
          ...(view === 'holder' ? { represented_by_guest_id: 'g-proxy-catherine' } : {}),
        });
  // 🧍 THE ONE READING — the proxy dresses and arrives as the role she stands in for.
  const dressRole = effectiveRoleOf(guest, standIn.standingInFor);
  const roleWord = guestRoleLabel(dressRole);
  const person = { ...guestNamePartsOf(guest), attire: guestAttireOf(guest) };
  const facts = guestMeFacts({ role: dressRole, dressCodeConfig: config, rolePalette, person });
  const parts = guestMePartsShown({ getIn: 'list', listed: true, facts });
  const greeting = guestGreetingOf({
    name: `${guest.name_prefix ?? ''} ${guest.first_name} ${guest.last_name}`.trim(),
    roleCode: dressRole,
    roleWord,
    sideLabel: 'Bride’s side',
    date: 'Friday, December 18, 2026',
    venues: null,
    venueName: 'San Agustin Church',
    standIn: standIn.standingInFor
      ? standingInWords(standIn.standingInFor.name, roleWord)
      : standIn.representedBy
        ? standsInForYouWords(standIn.representedBy.name)
        : null,
  });
  return (
    <main className="min-h-dvh bg-cream px-4 py-8 text-ink" data-lab-proxy={view}>
      <section className="mx-auto max-w-[430px] space-y-10">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/50">Me · proxy lab · {view}</p>
        {view === 'ask' ? null : <MeGreeting greeting={greeting} />}
        {view === 'proxy' ? (
          <>
            <GuestMeParts
              parts={parts}
              words={words}
              comingWith={[]}
              look={{
                config: config as never,
                ceremonyType: null,
                genderSeparation: null,
                guestRole: dressRole,
                guestAttire: guestAttireOf(guest),
                guestNameParts: guestNamePartsOf(guest),
                march: null,
                rolePalette,
              }}
            />
            <GuestTicket
              state="pass"
              name="Mrs. Maria Catherine Sacdalan"
              invitationUrl="/dev/me-lab"
              src={`/dev/me-lab/ticket?who=woman&name=${encodeURIComponent('Mrs. Maria Catherine Sacdalan')}&role=${dressRole}`}
              appleWallet={null}
            />
          </>
        ) : null}
        <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-ink/10">
          <RsvpWidget
            words={words}
            guest={guest}
            eventId="lab"
            eventPublicId="lab"
            faceMode="mode_b"
            doorAction={reply}
            ask={{ meal: false, dietary: false, note: false, song_request: false, mobile: false, plus_ones: false }}
          />
        </div>
      </section>
    </main>
  );
}
