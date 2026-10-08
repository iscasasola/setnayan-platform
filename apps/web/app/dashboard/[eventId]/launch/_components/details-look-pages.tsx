'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { makerPageCanvasSrc } from '@/lib/maker-made-once-pages';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { REVEAL_STAGE_CHOICES } from '@/lib/reveal-stages';
import { canvasKeyOfSelection } from '@/lib/maker-selection';
import { CanvasStaysOnThePage } from '../../website/editor/_components/maker-canvas-guard';
import { MakerPageFrame, MakerPageSwitch } from './maker-page';
import { MAKER_PLAY_SCENE_EVENT } from './maker-play-menu';
import { useMaker } from './maker-context';
import { DetailsGoTo, DetailsPieceButton, useDetailsPiece } from './details-go';
// ⚡ The sheet opens on a tap — it loads with the Details pieces (`details-lazy.tsx`).
import { ElementSheet } from './details-lazy';
import { HUB_ELEMENT_LABEL, isHubElementKey, type HubElementKey } from '@/lib/element-style';
import { LOOK_PART_LABEL, LOOK_SECTIONS, LOOK_SECTION_LABEL, LOOK_SECTION_PARTS, type LookPart, type LookSection } from '@/lib/maker-look-sections';
import { stagePageSrc, type GuidedStepBody } from '@/lib/guided-step-layout';
import { usePickedTheme } from './theme-pick-context';

/**
 * 🎨 LOGO · HERO · REVEAL, MOVED INTO DETAILS WHOLE (Details part 3; owner
 * 2026-09-28, DECISION_LOG "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS;
 * THE TOP MENU IS THE FOUR STAGES + DETAILS").
 *
 * They were Maker pages of their own (`MakerWork`'s `pageView`, 2026-09-25).
 * Nothing about them is redrawn here: the SAME nodes the work area always
 * built (`website/editor/page.tsx` `madeOnce` — `MakerLogoPanel`,
 * `MakerHeroPanel` with the Main background row, `MakerRevealPanel`) are
 * registered by `MakerWork` (`MakerLookPages`) and drawn in Details' columns
 * with the split they shipped with:
 *
 *   · Logo   — the studio IS the body; it lays its own panel beside its canvas
 *              (`detailsItemLayout` 'whole'). Opening it still writes nothing —
 *              its save gate is the studio's own (`the-logo-never-saves-on-open`).
 *   · Hero   — the guest page, the hero alone (`makerPageCanvasSrc` 'hero'),
 *              fills the body; Designs 1–4, its parts and the photo are the
 *              editor on the right ('fill').
 *   · Reveal — the opening playing on the stage it plays on, with the same
 *              "Play it on" switch; its picker on the right ('fill').
 *
 * 🧩 AND EACH IN THE MAKER'S THREE PARTS (owner 2026-09-29, DECISION_LOG "A
 * TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS"): the Hero lists
 * its PARTS in the navigator (`DetailsLookPieces`) — a pick marks it on the
 * hero and opens that part's style on the right (the same `ElementSheet` a tap
 * on the hero scene opens, the same draft door), above the design dropdown;
 * the Reveal lists its OPENINGS in the navigator (the picker's own rows) and
 * keeps play, fine-tune and where it plays on the right. The Logo studio
 * already is three parts — its layers, the logo, the layer's tools.
 *
 * ▶ The toolbar's "Play this scene" plays them in THIS frame: the Reveal by
 * loading it again (its page IS the opening), the Hero by the bridge's replay.
 *
 * ⏳ Until the work area has registered them (the first paint, before
 * hydration) the item says it is opening — and if they never arrive, it SAYS
 * they could not be opened, never an empty column that reads as "no logo".
 */

export type LookPageKey = 'logo' | 'hero' | 'reveal' | 'look';

const WORD: Record<LookPageKey, string> = { logo: 'Logo', hero: 'hero', reveal: 'reveal', look: 'page' };

/**
 * 🎨 LOOK IS ONE PANEL — BACKGROUND · ELEMENTS · MUSIC (owner 2026-10-08,
 * DECISION_LOG "APPROVED — THE LOOK RESTUDY"; `lib/maker-look-sections.ts`), in
 * that order, in the one editor the toolbar's Look opens. 🚫 No Theme section
 * since 2026-10-05: every theme's moving loop is a choice under Background.
 *
 * A section is drawn from its PARTS (`LOOK_SECTION_PARTS`) — the rows the work
 * area built (`MakerLookPages.look`), moved here: the same controls, the same
 * fields, into the draft. Background holds the main background, the page fill
 * (it was under Colours) and the hero video (it was under Music); Elements holds
 * Colours (with the Dress code palette's style), Font and Buttons, each under
 * its own small name. A part the event does not offer (the store shell's Main
 * background) is simply absent, and a section with none of its parts is not
 * drawn; a section that has not arrived SAYS so.
 *
 * 🎞 NO FILM LINE (2026-10-08): the Save the Date film's "Same as the Event Hub"
 * left Look — the film's own background is handed back in its own studio until
 * it retires (restudy § 4, plan row 6).
 */
export function LookPanel({
  sections = LOOK_SECTIONS,
  item,
  extras,
}: {
  sections?: readonly LookSection[];
  /**
   * 🔑 ONE MOUNT OF EACH CONTROL (review 2026-10-06): the whole Look (`theme`) and
   * Background · Elements · Music draw the SAME registered nodes — mounted
   * twice they would hold two states and two on-open measurements. Named, a
   * panel draws only while its item is the one open in the Maker.
   */
  item?: string;
  /** More of a part's OWN controls, drawn straight under it (the new Maker's Studio: the five main colours under Colours, the background's extras). */
  extras?: Partial<Record<LookPart, ReactNode>>;
}) {
  const maker = useMaker();
  const look = maker?.lookPages?.look ?? null;
  const late = useLate(Boolean(look));
  if (item && maker && maker.detailsItem !== item) return null;
  /* 🧭 THE NEW MAKER'S STUDIO, WITH A MAIN BACKGROUND: its ONE Source ▾ (`main-background-panel.tsx`, restudy
     row 2) draws the page fill (Colour), the hero video (Your photo or video) and the extras (Shade · Blur ·
     Focus) itself — so Look does not draw them a second time. Without that panel (the app-store shell builds
     none) they stay rows of Look, as in the shipped Maker. */
  const sourceHolds = maker?.stagesStudio === true && Boolean(look?.background);
  /* 🎨 THE PALETTE-TYPE ROW LEFT LOOK (owner 2026-10-08, on the local copy: *"remove Palette Type"*). `look.palette`
     ("Palette · Fabric swatches ▾") is no longer drawn under Colours. Nothing is written by leaving it out: the
     stored palette look stays as it is and keeps drawing on the guest page, and the SAME control is still where
     the palette itself lives — the Dress code scene's own settings (`editor-shell.tsx` `paletteRow`). */
  const part = (k: LookPart): ReactNode => (!look || (sourceHolds && (k === 'page' || k === 'video')) ? null : (look[k] ?? null));
  /** A section's parts that are there — each with what rides under it. */
  const partsOf = (k: LookSection) =>
    LOOK_SECTION_PARTS[k].flatMap((p) => {
      const node = part(p);
      const more = sourceHolds && p === 'background' ? null : (extras?.[p] ?? null);
      return node || more ? [{ p, node, more }] : [];
    });
  /* 🗂 Never a blank panel (owner 2026-10-06): a section this event does not offer says so in one line. */
  if (look && sections.every((k) => partsOf(k).length === 0)) {
    return (
      <p className="text-sm text-ink/70" data-look-panel-empty={sections.join(' ')}>
        Nothing to set here for this event.
      </p>
    );
  }
  return (
    <div data-look-panel={sections.length === LOOK_SECTIONS.length ? '' : sections.join(' ')} className="flex flex-col gap-5">
      {sections.map((k, i) => {
        const parts = partsOf(k);
        if (look && parts.length === 0) return null;
        /* Elements is three controls of different kinds — each is named; Background and Music name themselves. */
        const named = k === 'elements';
        return (
          <section key={k} data-look-section={k} className={`flex flex-col gap-2${i > 0 ? ' border-t border-ink/10 pt-4' : ''}`}>
            {/* One section alone is named by its item's row — no second heading. */}
            {sections.length > 1 ? <h3 className="text-[15px] font-semibold text-ink">{LOOK_SECTION_LABEL[k]}</h3> : null}
            {look ? (
              parts.map(({ p, node, more }) => (
                <div key={p} data-look-part={p} className="flex flex-col gap-2">
                  {named ? <h4 className="text-[13px] font-semibold text-ink/70">{LOOK_PART_LABEL[p]}</h4> : null}
                  {node}
                  {more}
                </div>
              ))
            ) : late ? (
              <p role="alert" className="text-sm text-terracotta-700" data-look-section-failed={k}>
                This could not be opened just now. Nothing was changed — please reopen Look in a moment.
              </p>
            ) : (
              <p role="status" className="text-sm text-ink/60" data-look-section-waiting={k}>
                Opening…
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * 🖼 LOOK'S BODY IS THE COUPLE'S OWN PAGE (owner 2026-10-02: on a phone the
 * Look panel is a sheet that leaves the top half of the page visible, so a
 * change shows as it is made). The page they are editing — the stage the Maker
 * is on, its draft, through the host-only canvas door — fills the body. The
 * "All themes" sample gallery that sat one switch away is gone with the theme
 * pick (2026-10-05).
 */
export function DetailsLookPageBody() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-details-look-body="page">
      <DetailsLookBody item="look" />
    </div>
  );
}

/** The body of a Look item: its page. */
export function DetailsLookBody({ item }: { item: LookPageKey }) {
  const maker = useMaker();
  const look = maker?.lookPages ?? null;
  const late = useLate(Boolean(look));
  if (!maker || !look) return <Waiting item={item} late={late} />;
  if (item === 'logo') {
    return look.logo ? (
      <div className="flex min-h-0 flex-1 flex-col" data-details-look="logo">
        {look.logo}
      </div>
    ) : (
      <CouldNotOpen item={item} />
    );
  }
  /* 🪟 STUDIO › LOOK SHOWS A SAMPLE, NOT THE PAGE (owner 2026-10-08, DECISION_LOG "THE LOOK PREVIEW IS A SAMPLE OF
     WHAT IS BEING EDITED — NOT THE COVER PAGE": *"a sample of the header text, buttons on the actual screen"*). In the
     new Maker's Studio, Look's body is the sample screen the work area built (`look-sample.tsx`) — drawn in the
     browser from the values in hand, answering every control at the tap. NO guest-page frame is mounted here: a Look
     open fetches no guest-page document, and a pick asks for no render of one. The whole page is one tap away, where
     it always was — Stages. The shipped Maker (the flag off) keeps its page frame. */
  if (lookShowsSample(item, maker.stagesStudio === true)) {
    return look.look?.sample ? (
      <div className="flex min-h-0 flex-1 flex-col" data-details-look="look" data-details-look-sample="">
        {look.look.sample}
      </div>
    ) : (
      <CouldNotOpen item={item} />
    );
  }
  return <LookFrame item={item} />;
}

/** Studio › Look draws the sample screen in place of the page frame — the Hero and the Reveal keep their page (they ARE the page). */
export function lookShowsSample(item: LookPageKey, stagesStudio: boolean): boolean {
  return item === 'look' && stagesStudio;
}

/** The editor of a Look item: the controls its page always had beside it. */
export function DetailsLookEditor({ item }: { item: Exclude<LookPageKey, 'logo' | 'look'> }) {
  const maker = useMaker();
  const look = maker?.lookPages ?? null;
  const late = useLate(Boolean(look));
  if (!maker || !look) return <Waiting item={item} late={late} />;
  const node = look[item];
  if (!node) return <CouldNotOpen item={item} />;
  return (
    <div data-details-look-editor={item} className="flex flex-col gap-3">
      {item === 'hero' ? <HeroPartSheet /> : null}
      {node}
    </div>
  );
}

/**
 * 🧩 The NAVIGATOR part of a Look tool: the Hero's parts, the Reveal's
 * openings. Drawn by `DetailsWorkspace` under the item while it is picked.
 */
export function DetailsLookPieces({ item }: { item: Exclude<LookPageKey, 'logo' | 'look'> }) {
  const maker = useMaker();
  const look = maker?.lookPages ?? null;
  const [piece, setPiece] = useDetailsPiece(item);
  if (!look) return null;
  if (item === 'reveal') return look.revealOptions ? <>{look.revealOptions}</> : null;
  const parts = look.heroParts;
  if (!parts) return null;
  return (
    <>
      {parts.keys.map((k) => (
        <DetailsPieceButton
          key={k}
          on={piece === k}
          data={`hero:${k}`}
          onPick={() => {
            const next = piece === k ? null : k;
            markHeroPart(next);
            setPiece(next, { openEditor: true });
          }}
        >
          {HUB_ELEMENT_LABEL[k]}
        </DetailsPieceButton>
      ))}
    </>
  );
}

/** The hero's key on the canvas (`f:hero`) — the bridge marks and replays parts by it. */
const HERO_KEY = canvasKeyOfSelection({ kind: 'tool', key: 'hero' }, []) ?? 'f:hero';

function heroFrame(): HTMLIFrameElement | null {
  /* The frame SHOWN — `MakerPageFrame` is double-buffered, so a new render may be loading behind it. */
  return document.querySelector<HTMLIFrameElement>('[data-details-look="hero"] iframe[data-maker-page-frame]');
}

/** Ring the picked part on the hero (or clear it) — the bridge's `markEl`. */
function markHeroPart(el: string | null) {
  heroFrame()?.contentWindow?.postMessage({ source: 'setnayan-editor', t: 'markEl', key: HERO_KEY, el }, window.location.origin);
}

/**
 * The picked hero part's style — the SAME sheet a tap on the hero scene opens
 * (`element-sheet.tsx`: font, size, colour, motion; every choice a draft save),
 * laid in the right column's flow instead of floating.
 */
function HeroPartSheet() {
  const maker = useMaker()!;
  const parts = maker.lookPages?.heroParts ?? null;
  const [piece, setPiece] = useDetailsPiece('hero');
  if (!parts || !piece || !isHubElementKey(piece)) return null;
  const el: HubElementKey = piece;
  const canvases = parts.canvases;
  const usedColours = (() => {
    const out = new Set<string>();
    for (const c of Object.values(canvases)) {
      if (c.color) out.add(c.color);
      for (const st of Object.values(c.elements ?? {})) {
        if (st?.color) out.add(st.color.slice(0, 7));
        for (const r of st?.runs ?? []) if (r.color) out.add(r.color.slice(0, 7));
      }
    }
    return [...out].slice(0, 15);
  })();
  const post = (message: unknown) => heroFrame()?.contentWindow?.postMessage(message, window.location.origin);
  return (
    <div
      data-details-hero-part={el}
      className="-mx-4 [&>aside]:!static [&>aside]:!z-auto [&>aside]:!max-h-none [&>aside]:!w-full [&>aside]:!rounded-none [&>aside]:!pb-2"
    >
      <ElementSheet
        eventId={maker.eventId}
        target={{ key: HERO_KEY, widgetType: 'hero', el }}
        canvas={canvases.hero ?? {}}
        palette={parts.palette}
        ownsPro={parts.ownsPro}
        hideLocked={maker.storeShell}
        draftAction={parts.draftAction}
        parts={parts.keys}
        onPart={(next) => {
          markHeroPart(next);
          setPiece(next);
        }}
        sceneLabel="Hero"
        usedColours={usedColours}
        onPreview={(message) => post(message)}
        onPlay={() => post({ source: 'setnayan-editor', t: 'playEl', key: HERO_KEY, el })}
        onClose={() => {
          markHeroPart(null);
          setPiece(null);
        }}
      />
    </div>
  );
}

function LookFrame({ item }: { item: Exclude<LookPageKey, 'logo'> }) {
  const maker = useMaker()!;
  const look = maker.lookPages!;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  /** The frame now shown (the page frame is double-buffered) — the canvas guard re-attaches to it. */
  const [shownKey, setShownKey] = useState('');
  const [revealPick, setRevealPick] = useState<LifecyclePhase | null>(null);
  const stages = look.revealStages;
  const revealStage = revealPick && stages.includes(revealPick) ? revealPick : (stages[0] ?? null);
  /* 🎨 Look: the page being edited, on the stage the Maker is on (the canvas door, its draft),
     wearing the theme being picked — at the tap, before its save lands (`theme=`). */
  const picked = usePickedTheme();
  const src =
    item === 'look'
      ? look.publicLandingUrl
        ? `${look.publicLandingUrl}?phase=${maker.stage}&editor=1${picked ? `&theme=${encodeURIComponent(picked)}` : ''}`
        : null
      : makerPageCanvasSrc(look.publicLandingUrl, item, maker.stage, { revealStage });
  /* 🖼 The PAGE only — a Maker render re-renders it in place (`refreshOn`), never a new frame. */
  const frameKey = `${item}:${src}`;
  const showing = maker.selection?.kind === 'tool' && maker.selection.key === 'details' && maker.detailsItem === item;

  /* ▶ "Play this scene" — only while this item is the one showing. */
  useEffect(() => {
    if (item === 'look' || !showing) return;
    const onPlay = () => {
      const f = frameRef.current;
      if (item === 'reveal') {
        try {
          f?.contentWindow?.location.reload();
        } catch {
          /* a frame we cannot reach is left as it is */
        }
        return;
      }
      const key = canvasKeyOfSelection({ kind: 'tool', key: 'hero' }, []);
      if (key) f?.contentWindow?.postMessage({ source: 'setnayan-editor', t: 'play', key }, window.location.origin);
    };
    window.addEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
    return () => window.removeEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
  }, [showing, item]);

  if (!src || !look.publicLandingUrl) {
    return (
      <div className="m-auto flex max-w-sm flex-col items-center gap-1 px-4 text-center text-sm text-ink/70" data-maker-page-no-address="">
        <p>Your page shows here once it has an address.</p>
        <DetailsGoTo item="address">Choose your Event Hub address</DetailsGoTo>
      </div>
    );
  }
  const title =
    item === 'look'
      ? `Your page — ${PUBLIC_STAGE_LABELS[maker.stage]}`
      : item === 'reveal'
      ? `Your reveal — ${PUBLIC_STAGE_LABELS[revealStage ?? 'save_the_date']}`
      : `Your hero — ${PUBLIC_STAGE_LABELS[maker.stage === 'rsvp' || maker.stage === 'event' ? maker.stage : 'rsvp']}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-details-look={item}>
      {item === 'reveal' && stages.length > 1 ? (
        <MakerPageSwitch
          label="Play it on"
          value={revealStage ?? 'save_the_date'}
          onChange={(v) => setRevealPick(v as LifecyclePhase)}
          options={REVEAL_STAGE_CHOICES.filter((s) => stages.includes(s)).map((s) => [s, PUBLIC_STAGE_LABELS[s]] as const)}
        />
      ) : null}
      {/* 🖥📱 BOTH, INSIDE THE PIECE TOO (owner 2026-09-29, DECISION_LOG "OWNER
          ANSWERS — TEN OPEN QUESTIONS" (8): YES) — View ▾ Both draws the Hero and
          the Reveal as the stage does: the desktop and the phone side by side.
          The desktop frame keeps the ref (play, the stay-on-the-page guard); the
          phone beside it is the same page at phone width. */}
      {maker.device === 'both' ? (
        <div className="flex min-h-0 flex-1 flex-row gap-2" data-details-look-both="">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <MakerPageFrame src={src} title={`${title} — desktop`} device="desktop" frameKey={frameKey} refreshOn={maker.renderStamp} frameRef={frameRef} onShown={setShownKey} />
          </div>
          <div className="flex min-h-0 w-[min(460px,40%)] shrink-0 flex-col">
            <MakerPageFrame src={src} title={`${title} — phone`} device="phone" frameKey={`${frameKey}:phone`} refreshOn={maker.renderStamp} />
          </div>
        </div>
      ) : (
        <MakerPageFrame src={src} title={title} device={maker.device} frameKey={frameKey} refreshOn={maker.renderStamp} frameRef={frameRef} onShown={setShownKey} />
      )}
      <CanvasStaysOnThePage
        frameRef={frameRef}
        pagePath={look.publicLandingUrl}
        resetKey={shownKey}
        stageLabel={title}
        onBack={() => {
          const f = frameRef.current;
          const at = f?.getAttribute('src');
          if (f && at) f.src = at;
        }}
      />
    </div>
  );
}

/**
 * 🖼 BEHIND A GUIDED STEP — what the stage produces (`lib/guided-step-layout.ts`):
 * its page, live, in the draft, wearing the theme being picked, at the part the
 * step fills; or, on the cover step, the cover photo itself. The SAME frame
 * every Maker page uses (`MakerPageFrame`, double-buffered).
 */
export function StageStepPreview({ body, coverUrl = null }: { body: GuidedStepBody; coverUrl?: string | null }) {
  const maker = useMaker();
  const picked = usePickedTheme();
  const base = maker?.lookPages?.publicLandingUrl ?? null;
  if (body.kind === 'cover' && coverUrl) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-2" data-guided-step-body="cover">
        {/* eslint-disable-next-line @next/next/no-img-element -- the couple's own cover, already signed */}
        <img src={coverUrl} alt="Your cover photo" className="max-h-full max-w-full rounded-md object-contain shadow-sm" />
      </div>
    );
  }
  const src = base ? stagePageSrc(base, body, picked) : null;
  if (!maker || !src) {
    return (
      <p role="status" className="m-auto px-4 text-center text-sm text-ink/60" data-guided-step-body="waiting">
        Opening your page…
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guided-step-body={body.kind}>
      <MakerPageFrame src={src} title="Your page, as guests will see it" device="phone" frameKey={`step:${src}`} refreshOn={maker.renderStamp} />
    </div>
  );
}

/** True a few seconds after mount while the pages have still not arrived. */
function useLate(arrived: boolean): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (arrived) {
      setLate(false);
      return;
    }
    const t = window.setTimeout(() => setLate(true), 4000);
    return () => window.clearTimeout(t);
  }, [arrived]);
  return late;
}

function Waiting({ item, late }: { item: LookPageKey; late: boolean }) {
  if (late) return <CouldNotOpen item={item} />;
  return (
    <p role="status" className="m-auto px-4 text-center text-sm text-ink/60" data-details-look-waiting={item}>
      Opening your {WORD[item]}…
    </p>
  );
}

function CouldNotOpen({ item }: { item: LookPageKey }) {
  return (
    <p role="alert" className="m-auto max-w-sm px-4 text-center text-sm text-terracotta-700" data-details-look-failed={item}>
      Your {WORD[item]} could not be opened just now. Nothing was changed — please reopen this in a moment.
    </p>
  );
}
