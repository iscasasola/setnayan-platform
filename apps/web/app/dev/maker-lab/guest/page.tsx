import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { mainGroundLayerFor } from '@/app/[slug]/_lib/main-ground-layer';
import { CountdownWidget } from '@/app/[slug]/_components/countdown';
import { EditorBridge } from '@/app/[slug]/_components/editor-bridge';
import { HUB_STAGES, type HubStage } from '@/lib/hub-canvas';
import { sceneStyleOfRow, paletteLookOfRow } from '@/lib/scene-style-of-row';
import { SpecialMessageWidget } from '@/app/[slug]/_components/special-message-widget';
import { MakerWelcomeGiftsEmpty, MakerWelcomeLook } from '@/app/[slug]/_components/maker-guest-scenes';
import { WelcomeGifts } from '@/app/[slug]/_components/guest-doorway-strip';
import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { ScheduleWidget } from '@/app/[slug]/_components/schedule-widget';
import { VenueWidget } from '@/app/[slug]/_components/venue-widget';
import { HubCanvasFrame } from '@/app/[slug]/_components/hub-canvas-frame';
import { canvasOnlyCss, canvasOnlyScene, canvasStylePreview } from '@/app/[slug]/_lib/editor-canvas';
import { withStylePreview } from '@/app/[slug]/_lib/style-preview';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { fixedSceneStyleOf } from '@/lib/fixed-scene-style-of';
import type { StyledScene } from '@/lib/fixed-scene-styles';
import { HERO_PART_LOOK, partLookAttr } from '@/lib/scene-styles-parts';
import { MakerEmptyScene } from '@/app/[slug]/_components/maker-empty-scene';
import { WhenYesCelebration } from '@/app/[slug]/_components/when-yes-celebration';
import { celebrationColours, isRsvpCelebration } from '@/lib/rsvp-celebration';
import { RsvpCanvasBridge } from '@/app/[slug]/_components/rsvp-canvas-bridge';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { postEventSceneDrawn } from '@/lib/post-event-scenes';
import { postEventLookOf } from '@/lib/post-event-draft';
import { resolvePostEventStyle } from '@/lib/post-event-style-resolve';
import { LAB_EDITORIAL_COOKIE, labEditorialDraft, labPostEventRead } from '../lab-post-event';

/** maria-and-jose's run of show and venues (read-only shape, 2026-10-05) — the lab has no database. */
const LAB_BLOCK = (i: number, label: string, at: string, location: string | null, type = 'pre_ceremony') => ({
  block_id: `lab-${i}`, public_id: `lab-${i}`, event_id: 'lab', label, block_type: type, start_at: `2026-12-12T${at}:00`, end_at: null,
  location, notes: null, is_public: true, sort_order: i, parent_block_id: null, created_at: '2026-10-01T00:00:00Z',
  run_state: 'upcoming', actual_start_at: null, actual_end_at: null, audience: null,
});
const LAB_BLOCKS = [
  LAB_BLOCK(1, 'Guests arrive', '14:30', 'Santuario de San Antonio'),
  LAB_BLOCK(2, 'Ceremony', '15:00', 'Santuario de San Antonio', 'ceremony'),
  LAB_BLOCK(3, 'Cocktails', '17:30', 'Seda Vertis North', 'cocktails'),
  LAB_BLOCK(4, 'Dinner & dancing', '19:00', 'Seda Vertis North', 'reception'),
];
const LAB_VENUE_EVENT = {
  event_date: '2026-12-12',
  venues: [
    { role: 'ceremony', name: 'Santuario de San Antonio', address: 'McKinley Rd, Forbes Park, Makati', latitude: 14.5476, longitude: 121.0335 },
    { role: 'reception', name: 'Seda Vertis North', address: '1 Astra Way, Vertis North, Quezon City', latitude: 14.6537, longitude: 121.0367 },
  ],
};

/** The public ready-made scene photo the lab's scene backgrounds use, as its own URL (a legacy ref is served verbatim). */
const LAB_MEDIA = { '/std/backgrounds/golden-hour.webp': '/std/backgrounds/golden-hour.webp' };

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
  /* 🖼 A style's true miniature (`?only=` + `?style=`), as the real canvas honours them — the lab is a host canvas. */
  const only = canvasOnlyScene({ only: typeof sp.only === 'string' ? sp.only : undefined }, true);
  const preview = canvasStylePreview({ style: typeof sp.style === 'string' ? sp.style : undefined }, true);
  /* 🎨 The lab's drafted part styles (`lab_styles`, the lab's `fixedStyles` stand-in), the preview's laid on top. */
  let labStyles: Record<string, unknown> = {};
  try {
    labStyles = JSON.parse(decodeURIComponent((await cookies()).get('lab_styles')?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    labStyles = {};
  }
  const { event: labEvent, widgets: labRows } = withStylePreview(
    { style_preferences: { scene_styles: labStyles } },
    Object.keys({ ...drafted, countdown: 1, special_message: 1, schedule: 1, venue_map: 1, dress_code: 1 }).map((t) => ({ widget_type: t, config_json: { canvas: drafted[t] ?? {} } })),
    preview,
  );
  const rowOf = (type: string) => labRows.find((r) => r.widget_type === type) ?? { widget_type: type, config_json: { canvas: {} } };
  const look = (type: StyledScene) => partLookAttr(type, fixedSceneStyleOf(labEvent.style_preferences, type, stage, 'wedding'));
  const heroLooks = Object.fromEntries(
    (Object.entries(HERO_PART_LOOK) as Array<[keyof typeof HERO_PART_LOOK, StyledScene]>).flatMap(([part, type]) => {
      const v = look(type);
      return v ? [[part, v]] : [];
    }),
  );
  const words = await eventWordsFor('wedding').catch(() => null);
  /* 🎞 The lab's Post Event story as guests would meet it: the scenes drawn, in the run's order, each with the marker
     its tile scrolls to, the style it is drawn in and the couple's own words where they wrote some. */
  const labStory = phase === 'editorial' ? labPostEventRead(labEditorialDraft((await cookies()).get(LAB_EDITORIAL_COOKIE)?.value)) : null;
  let chaptersMarked = false;
  const postEventScenes = (labStory?.rows ?? [])
    .filter((r) => postEventSceneDrawn(r.status, r.hidden))
    .map((r) => {
      const chapter = r.block === 'chapters';
      const marker = chapter ? (chaptersMarked ? null : 'ch-1') : r.key;
      if (chapter) chaptersMarked = true;
      const look = postEventLookOf(labStory!.arrangement, r.key);
      return { key: r.key, name: r.name, source: r.source, marker, style: resolvePostEventStyle(r.key, look.style, 'wedding'), words: look.words ?? null };
    });
  const mark = (key: string) => <span hidden data-maker-section={key} />;
  if (rsvp) {
    return (
      <main className="min-h-dvh bg-[#FBF9F5] px-5 py-6 text-ink">
        {/* 🧩 THE REAL RSVP PAGES' PART MARKS, AND THEIR BRIDGE (2026-10-09 — the owner could not reach the RSVP
            stage's tools by hand in the lab: these screens had no marks, so a tap picked nothing and ticked an
            answer). As `invite/reply` and `invite/enter` draw them on the Maker's canvas: the masthead inside the
            door's header (`stampRsvpCanvas` names its parts and marks it `f:hero`), a hidden section marker before
            each part, and each word's own key. `RsvpCanvasBridge` then makes a tap PICK the part under it — never
            the form's own. In the Maker's frame only (`play` is the lab's own celebration preview, a plain page). */}
        {play === null ? <RsvpCanvasBridge /> : null}
        <div>
          <header data-door-header="">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gild">You&rsquo;re invited</p>
            <h1 className="mt-1 text-xl font-semibold">Maria &amp; Jose</h1>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60">
              <span data-el="date">Saturday, December 12, 2026</span>
            </p>
          </header>
        </div>
        {rsvp === 'form' ? mark('f:greeting') : null}
        {rsvp === 'form' ? <p className="mt-4 text-sm">Teresita Aquino</p> : null}
        {rsvp === 'form' ? mark('f:rsvp') : null}
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
                  <span data-rsvp-word={rsvpWordBridgeKey(i === 0 ? 'attending' : 'declined')}>{label}</span>
                </label>
              ))}
            </fieldset>
          </form>
        ) : rsvp === 'thanks' ? (
          <>
            {mark('f:yesnote')}
            <div className="mt-6">
              <p className="font-serif text-2xl" data-landing-heading="" data-rsvp-word={rsvpWordBridgeKey('thanksHeading')} data-rsvp-default="See you there, Teresita" data-rsvp-name="Teresita">
                See you there, Teresita
              </p>
              <p className="mt-2 text-sm text-ink/60" data-rsvp-word={rsvpWordBridgeKey('thanksMessage')} data-rsvp-word-optional="" data-rsvp-name="Teresita" hidden />
            </div>
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
          <>
            {mark('f:nonote')}
            <div className="mt-6">
              <p className="font-serif text-2xl italic text-ink/70" data-rsvp-word={rsvpWordBridgeKey('declineHeading')} data-rsvp-default="We will miss you." data-rsvp-name="Teresita">
                We will miss you.
              </p>
              <p className="mt-2 text-sm text-ink/60" data-rsvp-word={rsvpWordBridgeKey('declineMessage')} data-rsvp-word-optional="" data-rsvp-name="Teresita" hidden />
            </div>
          </>
        )}
      </main>
    );
  }
  return (
    <main className={`min-h-dvh text-center text-ink ${ground || labPhoto ? 'relative' : 'bg-cream'}`} data-lab-phase={phase}>
      {/* The page's paper is a LAYER under everything, as the real page's is (`GuestGround`) — never the box's own
          fill, which would hide a background laid behind the page (the main background, and its instant preview). */}
      {labPhoto && !ground ? null : <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FBF9F5]" />}
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
      {/* 🧭 THE REAL HERO (`PahinaMasthead`, the guest page's own) on maria-and-jose's words — its parts carry their
          `data-el` and, when picked, their own style (`data-part-look`), exactly as the guest page draws them. */}
      {mark('f:hero')}
      <section className="px-4 pb-10 pt-6">
        <PahinaMasthead
          displayName="Maria & Jose"
          eventDate="2026-12-12"
          venueName="Seda Vertis North, Quezon City"
          eyebrow="Together with their families"
          stampElements
          looks={Object.keys(heroLooks).length > 0 ? heroLooks : null}
          monogramSlot={
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gild font-serif text-2xl italic text-terracotta-700">
              M &amp; J
            </span>
          }
        />
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
          {words ? <WelcomeGifts href="#gifts" words={words} look={look('gifts')} /> : <MakerWelcomeGiftsEmpty look={look('gifts')} />}
        </div>
        {mark('w:our_love_story')}
        <div data-lab-scene="our_love_story" className="border-t border-ink/10 px-4 py-8">
          <MakerEmptyScene type="our_love_story" />
        </div>
        {mark('w:special_message')}
        {/* 🌗 The REAL scene frame (`HubCanvasFrame`): its drafted background, Darker ↔ Lighter and Spacing, as guests see them. */}
        <HubCanvasFrame widget={{ ...rowOf('special_message'), widget_id: 'lab-special-message' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
          <div data-lab-scene="special_message" className="border-t border-ink/10 px-4 py-8 text-left">
            <SpecialMessageWidget
              text="We cannot wait to celebrate with you."
              signedBy="Maria & Jose"
              sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')}
            />
          </div>
        </HubCanvasFrame>
        {/* 👤 The Invitation's "Guest's look" — the guest page's own stand-in (the Maker's What to wear part). */}
        {mark('f:look')}
        <div data-lab-scene="look" className="border-t border-ink/10 px-4 py-8 text-left">
          <MakerWelcomeLook look={look('my_wear')} />
        </div>
        {/* 🗓 The day's moments — the REAL Schedule widget on maria-and-jose's run of show, in its drafted (or previewed) Style. */}
        {mark('w:schedule')}
        <HubCanvasFrame widget={{ ...rowOf('schedule'), widget_id: 'lab-schedule' } as never} hubTheme="house" ownClipPlays>
          <section data-lab-scene="schedule" className="border-t border-ink/10 px-4 py-8 text-left">
            <ScheduleWidget blocks={LAB_BLOCKS as never} eventTz="Asia/Manila" eventType="wedding" sceneStyle={sceneStyleOfRow(rowOf('schedule'), stage, 'wedding')} />
          </section>
        </HubCanvasFrame>
        {/* 🏛 The REAL Venue widget — the church and the hotel, in its drafted (or previewed) Style. */}
        {mark('w:venue_map')}
        <HubCanvasFrame widget={{ ...rowOf('venue_map'), widget_id: 'lab-venue' } as never} hubTheme="house" ownClipPlays>
          <section data-lab-scene="venue_map" className="border-t border-ink/10 px-4 py-8 text-left">
            <VenueWidget event={LAB_VENUE_EVENT as never} sceneStyle={sceneStyleOfRow(rowOf('venue_map'), stage, 'wedding')} map="none" blocks={LAB_BLOCKS as never} />
          </section>
        </HubCanvasFrame>
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
      {/* 🎞 POST EVENT'S OWN SCENES (the Post Event stage only) — a stand-in for each scene guests would meet, in the
          run's order, behind the marker the real story page puts before it (`p:<scene>`; the day's chapters share
          one, as they move together). The SAME rows the lab hands the Maker (`../lab-post-event.ts`), with the lab's
          drafted story keys laid over — so a scene hidden, moved, restyled or reworded in the panel is seen here. */}
      {phase === 'editorial' ? (
        <div className="sn-editorial" data-lab-post-event="">
          {postEventScenes.map((r) => (
            <div key={r.key} className="contents">
              {r.marker ? mark(`p:${r.marker}`) : null}
              <section data-lab-post-event-scene={r.key} data-lab-post-event-style={r.style ?? undefined} className="border-t border-ink/10 px-4 py-10 text-left">
                <p className="pahina-eyebrow">
                  <span data-el="label">{r.words?.label ?? r.name}</span>
                </p>
                <p className="mt-3 font-serif text-2xl" data-el="heading">
                  {r.words?.heading ?? r.source}
                </p>
                {r.words?.body ? (
                  <p className="mt-2 text-sm text-ink/70" data-el="body">
                    {r.words.body}
                  </p>
                ) : null}
                {r.style ? <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-ink/45">Style · {r.style}</p> : null}
              </section>
            </div>
          ))}
        </div>
      ) : null}
      {/* The Maker's two-way bridge, as the real canvas mounts it — its `ready` swaps a buffered frame in. Never in a miniature. */}
      {sp.editor === '1' && !preview ? <EditorBridge /> : null}
      {only ? <style>{canvasOnlyCss(only)}</style> : null}
    </main>
  );
}
