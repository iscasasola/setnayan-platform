import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { mainGroundLayerFor } from '@/app/[slug]/_lib/main-ground-layer';
import { CountdownWidget } from '@/app/[slug]/_components/countdown';
import { EditorBridge } from '@/app/[slug]/_components/editor-bridge';
import { HUB_STAGES, type HubStage } from '@/lib/hub-canvas';
import { sceneStyleOfRow, paletteLookOfRow } from '@/lib/scene-style-of-row';
import { SpecialMessageWidget } from '@/app/[slug]/_components/special-message-widget';
import { MakerWelcomeGiftsEmpty } from '@/app/[slug]/_components/maker-guest-scenes';
import { MakerEmptyScene } from '@/app/[slug]/_components/maker-empty-scene';
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
  /* 🎨 The lab's drafted scene canvases (`lab_widgets`, the lab's save
     stand-in) — each scene drawn below wears its drafted Style through the
     REAL resolver (`sceneStyleOfRow`) and the REAL widget, as the guest page does. */
  let drafted: Record<string, unknown> = {};
  try {
    drafted = JSON.parse(decodeURIComponent((await cookies()).get('lab_widgets')?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    drafted = {};
  }
  /* ⏱ A `lab_slow` cookie: the canvas page takes as long as production's to arrive. */
  if ((await cookies()).get('lab_slow')?.value === '1') await new Promise((r) => setTimeout(r, 2500));
  const labPhoto = (await cookies()).get('lab_photo')?.value === '1';
  const stage: HubStage | null = (HUB_STAGES as readonly string[]).includes(phase) ? (phase as HubStage) : null;
  const rowOf = (type: string) => ({ widget_type: type, config_json: { canvas: drafted[type] ?? {} } });
  const mark = (key: string) => <span hidden data-maker-section={key} />;
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
    <main className={`relative min-h-dvh text-center text-ink ${ground || labPhoto ? '' : 'bg-[#FBF9F5]'}`} data-lab-phase={phase}>
      {ground}
      {/* 🖼 a `lab_photo=1` cookie: a photo behind the page (the side-by-side's real-looking content) — a public ready-made scene. */}
      {!ground && labPhoto ? (
        <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/std/backgrounds/golden-hour.webp" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#FBF9F5]/60" />
        </div>
      ) : null}
      <div className="flex justify-between border-b border-ink/10 px-4 py-2.5 text-[9.5px] font-semibold uppercase tracking-[0.3em] text-gild">
        <span>Setnayan</span>
        <span>{phase === 'save_the_date' ? 'Save the Date' : phase === 'event' ? 'The Day' : phase === 'editorial' ? 'Post Event' : 'Invitation'}</span>
      </div>
      {/* 🧭 The hero's parts carry their `data-el`, as the real hero does — so a tap picks Names, Date, Place. */}
      {mark('f:hero')}
      <section className="px-4 pb-10 pt-6">
        <p data-el="eyebrow" className="text-[9px] font-semibold uppercase tracking-[0.26em] text-ink/55">Together with their families</p>
        <p data-el="mark" className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full border border-gild font-serif text-lg italic text-terracotta-700">M &amp; J</p>
        <div data-el="names">
          <p className="mt-2 font-serif text-[30px] leading-none">Maria</p>
          <p className="font-serif text-lg italic text-gild">and</p>
          <p className="font-serif text-[30px] leading-none">Jose</p>
        </div>
        <p className="mt-2 text-[11px] text-ink/70">invite you to celebrate their wedding</p>
        <p data-el="date" className="mt-1 font-serif text-lg">Saturday, December 12, 2026</p>
        <p data-el="venue" className="mt-1 text-[12px] text-ink/60">Quezon City · Seda Vertis North</p>
      </section>
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Personal greeting</p>
        <p className="mt-1 text-sm text-ink/70">Dear Teresita, we would love you there.</p>
      </section>
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Guest&rsquo;s ticket</p>
      </section>
      {mark('w:countdown')}
      <section data-lab-scene="countdown" className="border-t border-ink/10 px-4 py-8">
        <CountdownWidget targetIso="2026-12-12" timeZone="Asia/Manila" sceneStyle={sceneStyleOfRow(rowOf('countdown'), stage, 'wedding')} />
      </section>
      {/* 🔤 Three of the page's eyebrows, as the real scenes draw them — inside the
          editorial scope the guest page wears (`.sn-editorial`). */}
      <div className="sn-editorial">
        {mark('f:gifts')}
        <div data-lab-scene="gifts" className="border-t border-ink/10 px-4 py-8 text-left">
          <MakerWelcomeGiftsEmpty />
        </div>
        {mark('w:our_love_story')}
        <div data-lab-scene="our_love_story" className="border-t border-ink/10 px-4 py-8">
          <MakerEmptyScene type="our_love_story" />
        </div>
        {mark('w:special_message')}
        <div data-lab-scene="special_message" className="border-t border-ink/10 px-4 py-8 text-left">
          <SpecialMessageWidget
            text="We cannot wait to celebrate with you."
            signedBy="Maria & Jose"
            sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')}
          />
        </div>
        {/* 👤 The Invitation's "Guest's look" stand-in — each guest's own outfit (the Maker's What to wear part). */}
        {mark('f:look')}
        <section data-lab-scene="look" className="border-t border-ink/10 px-4 py-8 text-left">
          <p className="pahina-eyebrow">
            <span>What to wear</span>
          </p>
          <p className="mt-2 font-serif text-2xl">Your guest’s role, colours and outfit</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ink/55">Each guest sees their own look, from your Mood Board</p>
        </section>
        {/* 🗓 The day's moments — a scene of ROWS (its Build in carries Rows ▾). */}
        {mark('w:schedule')}
        <section data-lab-scene="schedule" className="border-t border-ink/10 px-4 py-8 text-left">
          <p className="pahina-eyebrow">
            <span>The day</span>
          </p>
          {[
            ['2:30 PM', 'Guests arrive · Santuario de San Antonio'],
            ['3:00 PM', 'Ceremony'],
            ['5:30 PM', 'Cocktails · the garden'],
            ['7:00 PM', 'Dinner & dancing'],
          ].map(([t, w]) => (
            <p key={t} className="mt-3 flex gap-3 border-t border-ink/10 pt-3 text-sm">
              <b className="w-20 shrink-0 font-serif text-base font-medium">{t}</b>
              <span className="text-ink/70">{w}</span>
            </p>
          ))}
        </section>
        {mark('w:dress_code')}
        {/* 🎨 Dress code's palette LOOK (`canvas.palette`), read through the real
            resolver; the lab stands in for the widget's drawing with its name. */}
        <section data-lab-scene="dress_code" className="border-t border-ink/10 px-4 py-16">
          <p className="pahina-eyebrow">
            <span>Dress code</span>
          </p>
          <p className="mt-3 font-serif text-2xl" data-lab-palette={paletteLookOfRow(rowOf('dress_code'))}>
            Palette look: {paletteLookOfRow(rowOf('dress_code'))}
          </p>
        </section>
      </div>
      {/* The Maker's two-way bridge, as the real canvas mounts it — its `ready` swaps a buffered frame in. */}
      {sp.editor === '1' ? <EditorBridge /> : null}
    </main>
  );
}
