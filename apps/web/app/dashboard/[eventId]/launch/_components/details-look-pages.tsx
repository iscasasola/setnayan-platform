'use client';

import { useEffect, useRef, useState } from 'react';
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
import { ElementSheet } from '../../website/editor/_components/element-sheet';
import { HUB_ELEMENT_LABEL, isHubElementKey, type HubElementKey } from '@/lib/element-style';

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

export type LookPageKey = 'logo' | 'hero' | 'reveal';

const WORD: Record<LookPageKey, string> = { logo: 'Logo', hero: 'hero', reveal: 'reveal' };

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
  return <LookFrame item={item} />;
}

/** The editor of a Look item: the controls its page always had beside it. */
export function DetailsLookEditor({ item }: { item: Exclude<LookPageKey, 'logo'> }) {
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
export function DetailsLookPieces({ item }: { item: Exclude<LookPageKey, 'logo'> }) {
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
  const src = makerPageCanvasSrc(look.publicLandingUrl, item, maker.stage, { revealStage });
  const frameKey = `${item}:${src}:${maker.renderStamp}`;
  const showing = maker.selection?.kind === 'tool' && maker.selection.key === 'details' && maker.detailsItem === item;

  /* ▶ "Play this scene" — only while this item is the one showing. */
  useEffect(() => {
    if (!showing) return;
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
    item === 'reveal'
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
            <MakerPageFrame src={src} title={`${title} — desktop`} device="desktop" frameKey={frameKey} frameRef={frameRef} onShown={setShownKey} />
          </div>
          <div className="flex min-h-0 w-[min(460px,40%)] shrink-0 flex-col">
            <MakerPageFrame src={src} title={`${title} — phone`} device="phone" frameKey={`${frameKey}:phone`} />
          </div>
        </div>
      ) : (
        <MakerPageFrame src={src} title={title} device={maker.device} frameKey={frameKey} frameRef={frameRef} onShown={setShownKey} />
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
