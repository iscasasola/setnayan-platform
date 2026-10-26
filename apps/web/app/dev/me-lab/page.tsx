import { notFound } from 'next/navigation';
import { APPLE_WALLET_ROUTE, PASS_CARD_WORDS } from '@/lib/pass-card';
import { headers } from 'next/headers';
import { appleWalletDevice, type AppleWalletLink } from '@/lib/wallet-pass';
import { mightBeIpadSafari } from '@/lib/apple-device';
import { MeKeepInvitation } from '@/app/[slug]/_components/me-keep-invitation';
import { MeStageLab } from './me-stage-lab';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { GuestMeParts } from '@/app/[slug]/_components/guest-me-parts';
import { GuestTicket } from '@/app/[slug]/_components/guest-ticket';
import { guestAttireOf, guestNamePartsOf } from '@/lib/attire-rows';
import { guestMeFacts, guestMeNoteShown, guestMePartsShown } from '@/lib/guest-me-parts';
import { LAB_PEOPLE, labMeDressConfig, labMeRolePalette } from './lab-people';
import { ConnectHostsLab } from './connect-hosts-lab';
import { HostViewsGuestLab } from './host-views-guest-lab';
import { SaveOfferLab } from './save-offer-lab';

/**
 * 👤 THE ME LAB — Invitation › Me's own parts (Your role · What to wear · Arrive by) and the digital ticket under them,
 * for the four people of `lab-people.ts`, through the guest page's OWN components (`GuestMeParts`, `GuestTicket`) and
 * resolvers. No database: the ticket is drawn by `./ticket` from the same facts. `?who=woman|man|unknown|guest` draws one.
 * `?stage=1` draws Me AS A STAGE over a photo (`./me-stage-lab` — the Hub's cards, cased names, a +1 as their ticket;
 * guest_page_fixes_2_4), `&dark=1` under Candlelight, `&guests=2` with a second plus-one.
 * `?note=1` gives each person the hosts' note to them (💌 owner 2026-10-20) — drawn under Your role by the same gate.
 * `?connect=1` draws the 🤝 "Also connect with <the hosts>" link step and the host's Requests row (`./connect-hosts-lab`).
 * `?save=1` draws the save offer, option A (`./save-offer-lab`): Me's ticket group and the thank-you's, per device / state / look.
 * `?host=1` draws Me on a guest's invitation for the HOST (before / after) and for the guest (`./host-views-guest-lab`).
 */
export default async function MeLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  if (sp.stage === '1') return <MeStageLab dark={sp.dark === '1'} two={sp.guests === '2'} />;
  if (sp.connect === '1') return <ConnectHostsLab />;
  if (sp.save === '1') return <SaveOfferLab sp={sp} />;
  if (sp.host === '1') return <HostViewsGuestLab only={typeof sp.only === 'string' ? sp.only : null} />;
  const words = await eventWordsFor('wedding');
  const config = labMeDressConfig();
  const rolePalette = labMeRolePalette();
  const people = typeof sp.who === 'string' ? LAB_PEOPLE.filter((p) => p.key === sp.who) : LAB_PEOPLE;
  /* 🍎 Me's "Add to Apple Wallet" under Save as an iPhone/iPad in Safari is handed it when the server can sign
     (`appleWalletLink`'s `download` arm) — a lab fixture by the same device test, not a second caller of the gate.
     `?keep=1` also draws Me's "Keep this invitation" offer (`MeKeepInvitation`) with its quiet "Use my email instead". */
  const userAgent = (await headers()).get('user-agent');
  const labWallet: AppleWalletLink | null = appleWalletDevice(userAgent)
    ? { kind: 'download', href: APPLE_WALLET_ROUTE, label: PASS_CARD_WORDS.appleWallet }
    : mightBeIpadSafari(userAgent)
      ? { kind: 'download', href: APPLE_WALLET_ROUTE, label: PASS_CARD_WORDS.appleWallet, touchOnly: true }
      : null;
  const labNote = sp.note === '1' ? 'Tita, we saved you a seat beside Lola — she can’t wait to see you.\nPlease bring the Santo Niño for the blessing.' : null;
  return (
    <main className="min-h-dvh bg-cream px-4 py-8 text-ink">
      {people.map((p) => {
        const person = { ...guestNamePartsOf(p), attire: guestAttireOf(p) };
        const facts = guestMeFacts({ role: p.role, dressCodeConfig: config, rolePalette, person });
        const parts = guestMePartsShown({ getIn: 'list', listed: true, facts });
        const note = guestMeNoteShown({ getIn: 'list', listed: true, note: labNote, eventNames: 'Jodalicca & Claire', theOrganizer: words.theOrganizer });
        return (
          <section key={p.key} data-lab-person={p.key} className="mx-auto mb-16 max-w-[430px] space-y-10 border-t border-ink/10 pt-6">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/50">
              Me · {p.label} · {[p.name_prefix, p.display_name].filter(Boolean).join(' ')}
            </p>
            <GuestMeParts
              note={note}
              parts={parts}
              words={words}
              comingWith={[]}
              look={{
                config: config as never,
                ceremonyType: null,
                genderSeparation: null,
                guestRole: p.role,
                guestAttire: guestAttireOf(p),
                guestNameParts: guestNamePartsOf(p),
                march: null,
                rolePalette,
              }}
            />
            <GuestTicket state="pass" name={p.display_name} invitationUrl="/dev/me-lab" src={`/dev/me-lab/ticket?who=${p.key}`} appleWallet={labWallet} />
            {sp.keep === '1' ? (
              <MeKeepInvitation state={{ kind: 'offer' }} eventId="lab-event" slug="lab" personalLink="https://www.setnayan.com/lab" userAgent={userAgent} termsCarried />
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
