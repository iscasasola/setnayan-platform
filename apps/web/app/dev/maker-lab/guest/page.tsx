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
          <>
            <p className="mt-4 font-serif text-2xl">Will you celebrate with us?</p>
            <div className="mt-3 flex gap-2">
              <span className="flex-1 rounded-full bg-ink py-2 text-center text-sm text-cream">Yes, with joy</span>
              <span className="flex-1 rounded-full border border-ink py-2 text-center text-sm">Sadly, no</span>
            </div>
          </>
        ) : rsvp === 'thanks' ? (
          <p className="mt-6 font-serif text-2xl">Thank you — see you there!</p>
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
