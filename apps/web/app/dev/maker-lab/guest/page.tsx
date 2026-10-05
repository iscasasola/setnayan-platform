import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { mainGroundLayerFor } from '@/app/[slug]/_lib/main-ground-layer';
import { WhenYesCelebration } from '@/app/[slug]/_components/when-yes-celebration';
import { celebrationColours, isRsvpCelebration } from '@/lib/rsvp-celebration';

/** maria-and-jose's board stand-in — Oxblood & olive, the prototype's first palette. */
const LAB_BOARD = ['#5B1A22', '#6B7A3A', '#E0A52B', '#8E2E3C', '#F2C8C2'];

/**
 * /dev/maker-lab/guest — the Maker lab's CANVAS stand-in: maria-and-jose's
 * page, same words and shape (read-only from production, 2026-10-05), drawn
 * here because the real guest page needs the database the lab does not have.
 * DEV-ONLY: production builds 404 it.
 */
export default async function MakerLabGuestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const rsvp = typeof sp.rsvp === 'string' ? sp.rsvp : null;
  /* 🎉 `?play=<pick>` plays the When yes celebration as a guest who just said
     yes (`&freeze=<s>` holds one still frame for a screenshot); without it the
     thank-you listens to the Maker, as the real one does on the stage. */
  const play = typeof sp.play === 'string' && isRsvpCelebration(sp.play) ? sp.play : null;
  const freeze = typeof sp.freeze === 'string' && Number.isFinite(Number(sp.freeze)) ? Number(sp.freeze) : undefined;
  const phase = typeof sp.phase === 'string' ? sp.phase : 'rsvp';
  /* 🎞 The lab's drafted Main background (a cookie the lab's draft stand-in
     sets), drawn by the REAL guest layer — `mainGroundLayerFor`, on the host's
     canvas (`tryOn`), Classic like maria-and-jose. A moving background needs no
     database on this path. */
  let main: unknown = null;
  try {
    main = JSON.parse(decodeURIComponent((await cookies()).get('lab_main')?.value ?? 'null'));
  } catch {
    main = null;
  }
  const ground = main
    ? await mainGroundLayerFor({
        theme: 'house',
        heroConfig: { main },
        event: { event_id: '00000000-0000-4000-8000-000000000000' },
        viewerIsHost: true,
        tryOn: true,
      })
    : null;
  if (rsvp) {
    return (
      <main className="min-h-dvh bg-[#FBF9F5] px-5 py-6 text-ink">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gild">You&rsquo;re invited</p>
        <h1 className="mt-1 text-xl font-semibold">Maria &amp; Jose</h1>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink/60">Saturday, December 12, 2026</p>
        <p className="mt-4 text-sm">Teresita Aquino</p>
        {rsvp === 'form' ? (
          /* The reply card's own answer markup (`rsvp-widget.tsx`): the tapped
             answer fills with the page's button colour, the other goes plain. */
          <form className="rsvp-form mt-4">
            <fieldset className="space-y-2">
              <legend className="mb-3 font-serif text-2xl">Will you celebrate with us?</legend>
              {(['Yes, with joy', 'Sadly, no'] as const).map((label, i) => (
                <label
                  key={label}
                  data-rsvp-answer=""
                  className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-white px-5 text-sm font-medium leading-tight text-ink ring-[1.5px] ring-ink transition-colors has-[:checked]:bg-ink has-[:checked]:text-cream"
                >
                  <input type="radio" name="rsvp_status" value={i === 0 ? 'attending' : 'declined'} className="sr-only" />
                  {label}
                </label>
              ))}
            </fieldset>
          </form>
        ) : rsvp === 'thanks' ? (
          <>
            <p className="mt-6 font-serif text-2xl" data-landing-heading="">
              See you there, Teresita
            </p>
            <WhenYesCelebration
              kind={play ?? 'none'}
              colours={celebrationColours(LAB_BOARD)}
              play={play !== null}
              name="Teresita"
              listen={play === null}
              freezeAt={freeze}
            />
          </>
        ) : (
          <p className="mt-6 font-serif text-2xl italic text-ink/70">We will miss you.</p>
        )}
      </main>
    );
  }
  return (
    <main className={`min-h-dvh text-center text-ink ${ground ? 'relative' : 'bg-[#FBF9F5]'}`} data-lab-phase={phase}>
      {ground}
      <div className="flex justify-between border-b border-ink/10 px-4 py-2.5 text-[9.5px] font-semibold uppercase tracking-[0.3em] text-gild">
        <span>Setnayan</span>
        <span>{phase === 'save_the_date' ? 'Save the Date' : phase === 'event' ? 'The Day' : phase === 'editorial' ? 'Post Event' : 'Invitation'}</span>
      </div>
      <section data-maker-section="f:hero" className="px-4 pb-10 pt-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.26em] text-ink/55">Together with their families</p>
        <p className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full border border-gild font-serif text-lg italic text-terracotta-700">M &amp; J</p>
        <p className="mt-2 font-serif text-[30px] leading-none">Maria</p>
        <p className="font-serif text-lg italic text-gild">and</p>
        <p className="font-serif text-[30px] leading-none">Jose</p>
        <p className="mt-2 text-[11px] text-ink/70">invite you to celebrate their wedding</p>
        <p className="mt-1 font-serif text-lg">December 12, 2026</p>
      </section>
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Personal greeting</p>
        <p className="mt-1 text-sm text-ink/70">Dear Teresita, we would love you there.</p>
      </section>
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Guest&rsquo;s ticket</p>
      </section>
    </main>
  );
}
