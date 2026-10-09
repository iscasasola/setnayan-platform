import { Fragment, type ReactNode } from 'react';
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
import { HubPageHold, HubScenes, hubScrubHoldsAtMost } from '@/app/[slug]/_components/hub-scenes';
import { EDITOR_CANVAS_HIDES_APP_CHROME, canvasOnlyCss, canvasOnlyScene, canvasStylePreview } from '@/app/[slug]/_lib/editor-canvas';
import { withStylePreview } from '@/app/[slug]/_lib/style-preview';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { fixedSceneStyleOf } from '@/lib/fixed-scene-style-of';
import type { StyledScene } from '@/lib/fixed-scene-styles';
import { HERO_PART_LOOK, partLookAttr } from '@/lib/scene-styles-parts';
import { MakerEmptyScene } from '@/app/[slug]/_components/maker-empty-scene';
import { WhenYesCelebration } from '@/app/[slug]/_components/when-yes-celebration';
import { celebrationColours, isRsvpCelebration } from '@/lib/rsvp-celebration';
import { RsvpCanvasBridge } from '@/app/[slug]/_components/rsvp-canvas-bridge';
import { RsvpLookStyle } from '@/app/[slug]/_components/rsvp-look-style';
import { rsvpAnswerWord } from '@/lib/rsvp-ask';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { postEventSceneDrawn } from '@/lib/post-event-scenes';
import { postEventLookOf } from '@/lib/post-event-draft';
import { resolvePostEventStyle } from '@/lib/post-event-style-resolve';
import { LAB_EDITORIAL_COOKIE, labEditorialDraft, labPostEventRead } from '../lab-post-event';
import { LAB_SCRUB_CHAIN, LAB_SCRUB_NAME, labScrubCanvases, labScrubLabel, labWidgetsCookie, type LabScrubScene } from '../lab-scrub';
import { LabScrubBadge } from './scrub-badge';
import { LabDayPages } from './lab-day';

/** maria-and-jose's run of show and venues (read-only shape, 2026-10-05) — the lab has no database. */
const LAB_BLOCK = (i: number, label: string, at: string, location: string | null, type = 'pre_ceremony') => ({
  block_id: `lab-${i}`, public_id: `lab-${i}`, event_id: 'lab', label, block_type: type, start_at: `2026-12-12T${at}:00Z`, end_at: null,
  location, notes: null, is_public: true, sort_order: i, parent_block_id: null, created_at: '2026-10-01T00:00:00Z',
  run_state: 'upcoming', actual_start_at: null, actual_end_at: null, audience: null,
});
const LAB_BLOCKS = [
  LAB_BLOCK(1, 'Guests arrive', '14:30', 'Santuario de San Antonio'),
  LAB_BLOCK(2, 'Ceremony', '15:00', 'Santuario de San Antonio', 'ceremony'),
  LAB_BLOCK(3, 'Cocktails', '17:30', 'Seda Vertis North', 'cocktails'),
  LAB_BLOCK(4, 'Dinner & dancing', '19:00', 'Seda Vertis North', 'reception'),
];
/** 🎚 The Scrub chain's run of show (`?scrub=1`): eight moments — a list long enough to be scrolled THROUGH, row by row. */
const LAB_BLOCKS_LONG = [
  LAB_BLOCK(1, 'Guests arrive', '14:30', 'Santuario de San Antonio'),
  LAB_BLOCK(2, 'Ceremony', '15:00', 'Santuario de San Antonio', 'ceremony'),
  LAB_BLOCK(3, 'Photos with the families', '16:00', 'Santuario de San Antonio'),
  LAB_BLOCK(4, 'Cocktails', '17:30', 'Seda Vertis North', 'cocktails'),
  LAB_BLOCK(5, 'Grand entrance', '18:30', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(6, 'Dinner', '19:00', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(7, 'First dance', '20:30', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(8, 'Send-off', '22:00', 'Seda Vertis North', 'reception'),
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
  /* 🎚 `?scrub=1` (the Maker reaches it as `./scrub`): the lab's scenes as the Scrub chain (`../lab-scrub.ts`),
     drawn through the guest page's own renderer — see the chain below. */
  const scrub = sp.scrub === '1';
  let drafted: Record<string, unknown> = {};
  try {
    drafted = JSON.parse(decodeURIComponent((await cookies()).get(labWidgetsCookie(scrub))?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    drafted = {};
  }
  drafted = labScrubCanvases(scrub, drafted);
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
    Object.keys({ ...drafted, countdown: 1, special_message: 1, schedule: 1, venue_map: 1, dress_code: 1, our_love_story: 1 }).map((t) => ({ widget_type: t, config_json: { canvas: drafted[t] ?? {} } })),
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
  /* On the chain the markers are drawn as the REAL page draws them — on the Maker's canvas only (`site-body.tsx`
     `makerMark`). The Scrub island reads them: a page that has one is being edited, and holds nothing until ▶ is
     held (`hub-scrub.tsx`); the same address opened plainly is a guest's page, and its hand-overs run. */
  const mark = (key: string) => (scrub && sp.editor !== '1' ? null : <span hidden data-maker-section={key} />);
  /* 🧩 THE LAB'S SCENES, each drawn ONCE — placed by the ordinary sample below, or (`?scrub=1`) by the Scrub chain. */
  const scene: Record<LabScrubScene | 'our_love_story', ReactNode> = {
    countdown: (
      <section data-lab-scene="countdown" className="border-t border-ink/10 px-4 py-8">
        <CountdownWidget targetIso="2026-12-12" timeZone="Asia/Manila" sceneStyle={sceneStyleOfRow(rowOf('countdown'), stage, 'wedding')} />
      </section>
    ),
    our_love_story: (
      <div data-lab-scene="our_love_story" className="border-t border-ink/10 px-4 py-8">
        <MakerEmptyScene type="our_love_story" />
      </div>
    ),
    special_message: (
      /* 🌗 The REAL scene frame (`HubCanvasFrame`): its drafted background, Darker ↔ Lighter and Spacing, as guests see them. */
      <HubCanvasFrame widget={{ ...rowOf('special_message'), widget_id: 'lab-special-message' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
        <div data-lab-scene="special_message" className="border-t border-ink/10 px-4 py-8 text-left">
          <SpecialMessageWidget
            text="We cannot wait to celebrate with you."
            signedBy="Maria & Jose"
            sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')}
          />
        </div>
      </HubCanvasFrame>
    ),
    schedule: (
      /* 🗓 The day's moments — the REAL Schedule widget on maria-and-jose's run of show, in its drafted (or previewed) Style. */
      <HubCanvasFrame widget={{ ...rowOf('schedule'), widget_id: 'lab-schedule' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="schedule" className="border-t border-ink/10 px-4 py-8 text-left">
          <ScheduleWidget blocks={LAB_BLOCKS as never} eventTz="Asia/Manila" eventType="wedding" sceneStyle={sceneStyleOfRow(rowOf('schedule'), stage, 'wedding')} />
        </section>
      </HubCanvasFrame>
    ),
    venue_map: (
      /* 🏛 The REAL Venue widget — the church and the hotel, in its drafted (or previewed) Style. */
      <HubCanvasFrame widget={{ ...rowOf('venue_map'), widget_id: 'lab-venue' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="venue_map" className="border-t border-ink/10 px-4 py-8 text-left">
          <VenueWidget event={LAB_VENUE_EVENT as never} sceneStyle={sceneStyleOfRow(rowOf('venue_map'), stage, 'wedding')} map="none" blocks={LAB_BLOCKS as never} />
        </section>
      </HubCanvasFrame>
    ),
    dress_code: (
      /* 🎨 Dress code's palette LOOK (`canvas.palette`), read through the real
         resolver; the lab stands in for the widget's drawing with its name. */
      <section data-lab-scene="dress_code" className="border-t border-ink/10 px-4 py-16">
        <p className="pahina-eyebrow">
          <span>Dress code</span>
        </p>
        <p className="mt-3 font-serif text-2xl" data-lab-palette={paletteLookOfRow(rowOf('dress_code'))}>
          Palette look: {paletteLookOfRow(rowOf('dress_code'))}
        </p>
      </section>
    ),
  };
  const giftsBlock = (
    <div data-lab-scene="gifts" className="border-t border-ink/10 px-4 py-8 text-left">
      {words ? <WelcomeGifts href="#gifts" words={words} look={look('gifts')} /> : <MakerWelcomeGiftsEmpty look={look('gifts')} />}
    </div>
  );
  /* 👤 The Invitation's "Guest's look" — the guest page's own stand-in (the Maker's What to wear part). */
  const lookBlock = (
    <div data-lab-scene="look" className="border-t border-ink/10 px-4 py-8 text-left">
      <MakerWelcomeLook look={look('my_wear')} />
    </div>
  );
  /* 🎚 THE CHAIN'S CARDS (`?scrub=1`). Each scene of the chain is drawn as the prototype drew it, so a hold can be
     READ (2026-10-09 — a hold was "mostly a blank white screen with one faint element in the middle and nothing
     saying anything is happening"): a card (the hub's card look: paper, hairline, radius, shadow) in a phone-wide
     column, labelled with what it is set to — read from the canvas it is drawn with (`labScrubLabel`), never written
     by hand. The card sits INSIDE the real frame (`HubCanvasFrame`), so the scene's Build in and Build out move the
     card itself, as they move a scene on the guest page. The first card says the cover is not in the chain.
     🖼 THE CARD IS THE HUB'S OWN RULE (`globals.css` "THE HUB IS CARDS", its last arm — a section inside a frame that
     paints nothing): the lab draws none of its own, so what is seen here is what a guest's page draws. A scene given
     a background of its own in the Maker wears THAT as its box, by the same rule. (Until 2026-10-09 the rule did
     not reach a framed scene and each card here was a stand-in, written out in classes.) */
  const chainBody: Record<LabScrubScene, ReactNode> = {
    countdown: <CountdownWidget targetIso="2026-12-12" timeZone="Asia/Manila" sceneStyle={sceneStyleOfRow(rowOf('countdown'), stage, 'wedding')} />,
    schedule: <ScheduleWidget blocks={LAB_BLOCKS_LONG as never} eventTz="Asia/Manila" eventType="wedding" sceneStyle={sceneStyleOfRow(rowOf('schedule'), stage, 'wedding')} />,
    special_message: <SpecialMessageWidget text="We cannot wait to celebrate with you." signedBy="Maria & Jose" sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')} />,
    dress_code: (
      <>
        <p className="pahina-eyebrow">
          <span>Dress code</span>
        </p>
        <p className="mt-3 font-serif text-2xl" data-lab-palette={paletteLookOfRow(rowOf('dress_code'))}>
          Garden formal, in warm earth tones
        </p>
      </>
    ),
    venue_map: <VenueWidget event={LAB_VENUE_EVENT as never} sceneStyle={sceneStyleOfRow(rowOf('venue_map'), stage, 'wedding')} map="none" blocks={LAB_BLOCKS as never} />,
  };
  const chainCard = (type: LabScrubScene, i: number) => (
    <HubCanvasFrame widget={{ ...rowOf(type), widget_id: `lab-${type}` } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
      <section
        data-lab-scene={type}
        data-lab-name={LAB_SCRUB_NAME[type]}
        className="text-left"
      >
        <p data-lab-card-label="" className="mb-3 text-[10.5px] font-bold uppercase leading-snug tracking-[0.08em] text-gild">
          {labScrubLabel(rowOf(type).config_json, { last: i === LAB_SCRUB_CHAIN.length - 1 }).map((l, n) => (
            <span key={l.name}>
              {n > 0 ? ' · ' : ''}
              {l.name} <b className="font-bold text-terracotta-700">{l.value}</b>
            </span>
          ))}
          {i === 0 ? <span className="mt-1 block normal-case tracking-normal text-ink/60">The cover above is not part of the chain yet.</span> : null}
        </p>
        {chainBody[type]}
      </section>
    </HubCanvasFrame>
  );
  /* 🧭 THE DAY, AS PAGES (`./lab-day.tsx`) — the Stages canvas's own shape for The Day (`&tabs=1`, as the Maker asks
     for it): one page per tab, the day's own parts on the page the one filing puts them on, the Camera a page. */
  if (phase === 'event' && sp.tabs === '1' && !scrub && !rsvp) {
    return (
      <main className="min-h-dvh bg-cream text-center text-ink" data-lab-phase={phase}>
        <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FBF9F5]" />
        <LabDayPages
          tab={typeof sp.tab === 'string' ? sp.tab : undefined}
          paged={!only}
          mark={mark}
          styleOf={(part) => fixedSceneStyleOf(labEvent.style_preferences, part, stage, 'wedding')}
          galleryStyle={sceneStyleOfRow(rowOf('our_photos'), stage, 'wedding')}
          given={{
            'f:hero': (
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
            ),
            'w:schedule': scene.schedule,
            'w:venue_map': scene.venue_map,
            'w:dress_code': scene.dress_code,
          }}
        />
        {sp.editor === '1' && !preview ? <EditorBridge /> : null}
        {only ? <style>{canvasOnlyCss(only)}</style> : null}
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
      </main>
    );
  }
  if (rsvp) {
    return (
      /* 🖼 A GROUND TO JUDGE THE CARD AGAINST (controller 2026-10-10): on plain cream, Frosted and None looked the
         same as Plain. A stand-in for the Look's background, made of the lab's own colours — the lab only. */
      <main className="min-h-dvh px-5 py-6 text-ink" style={{ background: `linear-gradient(160deg, ${LAB_BOARD[4]} 0%, ${LAB_BOARD[2]} 52%, ${LAB_BOARD[1]} 100%)` }}>
        {/* 🧩 THE REAL RSVP PAGES' PART MARKS, AND THEIR BRIDGE (2026-10-09 — the owner could not reach the RSVP
            stage's tools by hand in the lab: these screens had no marks, so a tap picked nothing and ticked an
            answer). As `invite/reply` and `invite/enter` draw them on the Maker's canvas: the masthead inside the
            door's header (`stampRsvpCanvas` names its parts and marks it `f:hero`), a hidden section marker before
            each part, and each word's own key. `RsvpCanvasBridge` then makes a tap PICK the part under it — never
            the form's own. In the Maker's frame only (`play` is the lab's own celebration preview, a plain page). */}
        {play === null ? <RsvpCanvasBridge /> : null}
        {/* The app's own chrome (the cookie card) stays off the lab's RSVP screens, as it does off the lab's other
            guest pages below: it sat over "Sadly, no", the hint and the Save button. The lab only. */}
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {/* 🎨 Each line's look, as the real pages carry it — drawn at the tap in the Maker (`rsvp-look-style.tsx`). */}
        <RsvpLookStyle config={null} board={celebrationColours(LAB_BOARD)} parts={rsvp === 'form' ? ['rsvp'] : rsvp === 'thanks' ? ['yesnote', 'pass'] : ['nonote']} canvas />
        {/* 🃏 The door's CARD, as `DoorShell` draws it: the masthead and every section inside ONE card — on the Maker's
            canvas the card is the screen's group of lines, picked from its edge (`RSVP_CARD_GROUPS`). */}
        <div className="rounded-3xl bg-white px-5 py-6 shadow-sm">
          <header data-door-header="">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gild">You&rsquo;re invited</p>
            <h1 className="mt-1 text-xl font-semibold">Maria &amp; Jose</h1>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60">
              <span data-el="date">Saturday, December 12, 2026</span>
            </p>
          </header>
        {rsvp === 'form' ? mark('f:greeting') : null}
        {rsvp === 'form' ? <p className="mt-4 text-sm">Teresita Aquino</p> : null}
        {rsvp === 'form' ? mark('f:rsvp') : null}
        {rsvp === 'form' ? (
          /* The reply card's own answer markup (`rsvp-widget.tsx`): the tapped
             answer fills with the page's button colour, the other goes plain. */
          <form className="rsvp-form mt-4">
            <fieldset className="space-y-2">
              {/* 🧩 The lines as the real card names them (`data-rsvp-line`, `rsvp-widget.tsx`): each its own part. */}
              <legend className="mb-3">
                <span data-rsvp-line="eyebrow" data-rsvp-word={rsvpWordBridgeKey('eyebrow')} data-rsvp-default="Your reply" className="block text-xs font-semibold uppercase tracking-[0.26em] text-mulberry">Your reply</span>
                <span data-rsvp-line="question" data-rsvp-word={rsvpWordBridgeKey('question')} data-rsvp-default="Will you celebrate with us?" className="mt-2 block font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink">Will you celebrate with us?</span>
              </legend>
              {/* The two answers say what the REAL card prints when the couple wrote nothing (`rsvpAnswerWord`) — the
                  words the Maker's row calls "Automatic". (They read "Yes, with joy" / "Sadly, no" here: a stand-in
                  of the lab's own, which no guest page prints.) */}
              {(['attending', 'declined'] as const).map((answer, i) => ({ label: rsvpAnswerWord(null, answer, false), i })).map(({ label, i }) => (
                <label
                  key={label}
                  data-rsvp-line={i === 0 ? 'yes' : 'no'}
                  data-rsvp-answer=""
                  className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-white px-5 text-sm font-medium leading-tight text-ink ring-[1.5px] ring-ink transition-colors has-[:checked]:bg-ink has-[:checked]:text-cream"
                >
                  <input type="radio" name="rsvp_status" value={i === 0 ? 'attending' : 'declined'} className="sr-only" />
                  <span data-rsvp-word={rsvpWordBridgeKey(i === 0 ? 'attending' : 'declined')}>{label}</span>
                </label>
              ))}
            </fieldset>
            {/* The hint, where the one-at-a-time flow puts it: inside the form, under the answers. */}
            <p data-rsvp-line="hint" data-rsvp-word={rsvpWordBridgeKey('hint')} data-rsvp-default="Tap one to continue" className="flex min-h-[48px] items-center justify-center text-sm text-ink/70">Tap one to continue</p>
          </form>
        ) : rsvp === 'thanks' ? (
          <>
            {mark('f:yesnote')}
            <div className="mt-6">
              <p className="font-serif text-2xl" data-landing-heading="" data-rsvp-line="heading" data-rsvp-word={rsvpWordBridgeKey('thanksHeading')} data-rsvp-default="See you there, Teresita" data-rsvp-name="Teresita">
                See you there, Teresita
              </p>
              <p className="mt-2 text-sm text-ink/60" data-rsvp-line="message" data-rsvp-word={rsvpWordBridgeKey('thanksMessage')} data-rsvp-word-optional="" data-rsvp-name="Teresita" hidden />
            </div>
            <WhenYesCelebration
              kind={play ?? 'none'}
              colours={celebrationColours(LAB_BOARD)}
              play={play !== null}
              name="Teresita"
              listen={play === null}
              freezeAt={freeze}
            />
            {/* The pass and its Save button — a line of the pass, named on a box around the (inert) button, as
                `invite/enter` does. */}
            {play === null ? mark('f:pass') : null}
            {play === null ? (
              <section className="mt-6 space-y-4 text-center">
                <div className="mx-auto h-40 w-[min(260px,100%)] rounded-2xl bg-ink/10" />
                <div data-rsvp-line="save">
                  <button type="button" className="button-primary w-full">
                    Save my ticket
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            {mark('f:nonote')}
            {/* The note's OWN card inside the door's card, as `invite/enter` draws it (`data-landing-missed`): with a
                ground chosen for the door's card it gives up its paper, so ONE card shows (`RSVP_INNER_CARD_SELECTOR`). */}
            <div className="sn-glass-bare mt-6 rounded-2xl bg-cream/95 px-5 py-7 text-center shadow-sm" data-landing-missed="">
              <p className="font-serif text-2xl italic text-ink/70" data-rsvp-line="heading" data-rsvp-word={rsvpWordBridgeKey('declineHeading')} data-rsvp-default="We will miss you." data-rsvp-name="Teresita">
                We will miss you.
              </p>
              <p className="mt-2 text-sm text-ink/60" data-rsvp-line="message" data-rsvp-word={rsvpWordBridgeKey('declineMessage')} data-rsvp-word-optional="" data-rsvp-name="Teresita" hidden />
            </div>
          </>
        )}
        </div>
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
      {/* 🧍 THE PAGE'S OWN HOLD, as `site-body.tsx` wraps its article: on the chain, everything this page draws — the
          cover, the greeting, the ticket — stands still while a hand-over plays. (`holds` 0 off the chain: nothing is
          wrapped.) */}
      <HubPageHold holds={scrub ? hubScrubHoldsAtMost(LAB_SCRUB_CHAIN.map((t) => rowOf(t)) as never, true, true) : 0}>
      <div className="flex justify-between border-b border-ink/10 px-4 py-2.5 text-[9.5px] font-semibold uppercase tracking-[0.3em] text-gild">
        <span>Setnayan</span>
        <span>{phase === 'save_the_date' ? 'Save the Date' : phase === 'event' ? 'The Day' : phase === 'editorial' ? 'Post Event' : 'Invitation'}</span>
      </div>
      {/* 🧭 THE REAL HERO (`PahinaMasthead`, the guest page's own) on maria-and-jose's words — its parts carry their
          `data-el` and, when picked, their own style (`data-part-look`), exactly as the guest page draws them. */}
      {/* 🎚 The chain's badge (lab only): is Scrub on, which hand-over, how far — or WHY it is off. Before the first
          marker, so the Maker's bridge never counts it as part of a scene. Never in a miniature. */}
      {scrub && !only && !preview ? <LabScrubBadge /> : null}
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
      {scrub ? (
        /* 🎚 THE SCRUB CHAIN (`../lab-scrub.ts`) — the lab's scenes through the guest page's OWN renderer (`HubScenes`),
           one node a scene with its marker, exactly as `site-body.tsx` hands them over: the hand-overs, the holds and
           the engine are the real ones, and what the owner arranges on a scene in the Maker is what plays here. The
           fixed blocks, and the one scene that is not in the chain, follow it as the ordinary lab draws them. */
        <>
          <div className="sn-editorial mx-auto max-w-[430px] px-4 pb-6" data-lab-scrub="">
            <HubScenes widgets={LAB_SCRUB_CHAIN.map((t) => ({ ...rowOf(t), widget_id: `lab-${t}` })) as never} scrubAllowed scrubOut>
              {LAB_SCRUB_CHAIN.map((t, i) => (
                <Fragment key={t}>
                  {mark(`w:${t}`)}
                  {chainCard(t, i)}
                </Fragment>
              ))}
            </HubScenes>
          </div>
          <div className="sn-editorial">
            {mark('f:gifts')}
            {giftsBlock}
            {mark('f:look')}
            {lookBlock}
            {mark('w:our_love_story')}
            {scene.our_love_story}
          </div>
        </>
      ) : (
        <>
          {mark('w:countdown')}
          {scene.countdown}
          {/* 🔤 Three of the page's eyebrows, as the real scenes draw them — inside the
              editorial scope the guest page wears (`.sn-editorial`). */}
          <div className="sn-editorial">
            {mark('f:gifts')}
            {giftsBlock}
            {mark('w:our_love_story')}
            {scene.our_love_story}
            {mark('w:special_message')}
            {scene.special_message}
            {mark('f:look')}
            {lookBlock}
            {mark('w:schedule')}
            {scene.schedule}
            {mark('w:venue_map')}
            {scene.venue_map}
            {mark('w:dress_code')}
            {scene.dress_code}
          </div>
        </>
      )}
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
      </HubPageHold>
      {/* The Maker's two-way bridge, as the real canvas mounts it — its `ready` swaps a buffered frame in. Never in a miniature. */}
      {sp.editor === '1' && !preview ? <EditorBridge /> : null}
      {only ? <style>{canvasOnlyCss(only)}</style> : null}
      {/* 🍪 As the REAL canvas does (`site-body.tsx`, `isEditorCanvas`): the app's floating notices — the cookie consent
          among them — are not drawn inside the Maker's sample; the host answers them on the Maker's own page. The lab
          drew the banner over the foot of the sample, which the real Maker never does (seen on the review copy, 2026-10-09). */}
      <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
    </main>
  );
}
