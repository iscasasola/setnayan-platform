import { notFound } from 'next/navigation';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { GuestMeParts } from '@/app/[slug]/_components/guest-me-parts';
import { GuestTicket } from '@/app/[slug]/_components/guest-ticket';
import { guestAttireOf, guestNamePartsOf } from '@/lib/attire-rows';
import { guestMeFacts, guestMePartsShown } from '@/lib/guest-me-parts';
import { LAB_PEOPLE, labMeDressConfig, labMeRolePalette } from './lab-people';

/**
 * 👤 THE ME LAB — Invitation › Me's own parts (Your role · What to wear · Arrive by) and the digital ticket under them,
 * for the four people of `lab-people.ts`, through the guest page's OWN components (`GuestMeParts`, `GuestTicket`) and
 * resolvers. No database: the ticket is drawn by `./ticket` from the same facts. `?who=woman|man|unknown|guest` draws one.
 */
export default async function MeLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const words = await eventWordsFor('wedding');
  const config = labMeDressConfig();
  const rolePalette = labMeRolePalette();
  const people = typeof sp.who === 'string' ? LAB_PEOPLE.filter((p) => p.key === sp.who) : LAB_PEOPLE;
  return (
    <main className="min-h-dvh bg-cream px-4 py-8 text-ink">
      {people.map((p) => {
        const person = { ...guestNamePartsOf(p), attire: guestAttireOf(p) };
        const facts = guestMeFacts({ role: p.role, dressCodeConfig: config, rolePalette, person });
        const parts = guestMePartsShown({ on: true, getIn: 'list', listed: true, facts });
        return (
          <section key={p.key} data-lab-person={p.key} className="mx-auto mb-16 max-w-[430px] space-y-10 border-t border-ink/10 pt-6">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/50">
              Me · {p.label} · {[p.name_prefix, p.display_name].filter(Boolean).join(' ')}
            </p>
            <GuestMeParts
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
            <GuestTicket state="pass" name={p.display_name} invitationUrl="/dev/me-lab" src={`/dev/me-lab/ticket?who=${p.key}`} />
          </section>
        );
      })}
    </main>
  );
}
