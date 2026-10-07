'use client';

import { StageStyle } from './stage-panel/stage-style';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { IntoLowerThird, LOWER_THIRD_TILE, LOWER_THIRD_TILE_ON, LOWER_THIRD_TILE_PART } from './maker-lower-third';
import { MakerPage } from './maker-page';
import { MakerRsvpSettings, type CelebrationInputs } from './maker-rsvp-ask';
import { useMaker } from './maker-context';
import type { RsvpAskConfig, RsvpWordKey } from '@/lib/rsvp-ask';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { draftedCanvasOr } from '@/lib/maker-draft-store';
import {
  RSVP_PREVIEW_EVENT,
  RSVP_REPLY_BY_EVENT,
  RSVP_SCENE_WORDS,
  RSVP_SITE_SOURCE,
  RSVP_STAGE_SCENES,
  RSVP_BRIDGE_SOURCE,
  RSVP_DRAFT_TYPE,
  rsvpPreviewMessages,
  rsvpStageCanvasSrc,
  rsvpWordBridgeKey,
  type RsvpStageScene,
} from '@/lib/rsvp-stage';
import {
  RSVP_CELEBRATE_EVENT,
  RSVP_CELEBRATE_MESSAGE,
  isRsvpCelebration,
  readCelebrationKey,
  type RsvpCelebration,
} from '@/lib/rsvp-celebration';

/**
 * 🧰 THE RSVP'S THREE SCREENS AS THE LOWER THIRD'S PARTS (owner 2026-10-05,
 * frame 6: *"on RSVP there is the RSVP, when yes, when no"*) — the shipped
 * screens (`RSVP_STAGE_SCENES`), each tile titled in his words.
 */
const RSVP_STAGE_TILE: Record<RsvpStageScene, { label: string; caption: string }> = {
  /* 📑 The titles the owner approved (2026-10-05): RSVP form · When yes · When
     no. Each caption says what the screen is, never the title again. */
  form: { label: 'RSVP form', caption: 'Their reply' },
  thanks: { label: 'When yes', caption: 'The thank-you' },
  decline: { label: 'When no', caption: 'Can’t come' },
};

/**
 * 🗳 THE RSVP STAGE — the Maker's stage between Save the Date and Invitation
 * (owner 2026-09-30, DECISION_LOG "THE MAKER RE-PLAN…" and "RE-PLAN
 * REVISIONS…"). The Maker's three parts, like every stage:
 *
 *   LEFT   the scenes — 1 RSVP form · 2 When yes · 3 When no;
 *   MIDDLE the REAL guest page for that scene, drawn for a SAMPLE guest in the
 *          canvas (`rsvpStageCanvasSrc` — `?editor=1`, host-verified; no real
 *          guest is read or written);
 *   RIGHT  the scene's controls (`MakerRsvpSettings` with `scene`) — the SAME
 *          component Details' RSVP item draws, so there is one set of controls.
 *
 * ⚡ REALTIME, NEVER A RELOAD (owner 2026-09-30: *"make sure what we rebuild is
 * fast and realtime and changes instantly"*). Every change the panel makes is
 * announced (`RSVP_PREVIEW_EVENT`, `RSVP_REPLY_BY_EVENT`) and posted into the
 * frames here as the editor bridge's messages (`rsvpPreviewMessages`); the
 * page lays it on what it already drew (`rsvp-canvas-bridge.tsx`). A frame is
 * loaded once per scene and KEPT (hidden while another scene shows), so going
 * back to a scene is instant too. A frame that loads later says `rsvpReady`
 * and is sent what the panel holds now.
 *
 * Loaded lazily, inside the `maker-details` chunk (`details-lazy.tsx`): the
 * Maker's first load does not carry it.
 */
export function MakerRsvpStage({
  eventId,
  publicLandingUrl,
  solemn,
  current,
  drafted,
  replyBy,
  replyByOwn,
  replyByFallback,
  frameSrc,
  draftAction,
  replyByAction,
  celebration,
}: {
  /**
   * 🎉 The When yes Celebration's inputs, measured by the launch page — Event
   * Hub Pro (its ◆ marks) and the Mood Board's colours (its previews) — handed
   * through to the panel, which draws the mark (`CelebrationPick`).
   */
  celebration?: CelebrationInputs;
  /** The dev lab only (`/dev/rsvp-stage-lab`): its own frames and saves, to measure the stage without a sign-in. */
  frameSrc?: (scene: RsvpStageScene) => string | null;
  draftAction?: ComponentProps<typeof MakerRsvpSettings>['draftAction'];
  replyByAction?: ComponentProps<typeof MakerRsvpSettings>['replyByAction'];
  eventId: string;
  /** `/<slug>`, or null before the event has an address. */
  publicLandingUrl: string | null;
  solemn: boolean;
  current: RsvpAskConfig;
  drafted: boolean;
  replyBy: { date: string; isDefault: boolean } | null;
  replyByOwn: { deadline: string | null; pricingMode: 'realtime' | 'final_only' } | null;
  replyByFallback: string | null;
}) {
  const maker = useMaker();
  const [scene, setScene] = useState<RsvpStageScene>('form');
  /* 📱 The screen's controls, opened by its tile in the lower third. */
  const [controlsOpen, setControlsOpen] = useState(false);
  /* "Where you are" says the screen on show. */
  const setLtWhere = maker?.setLtWhere;
  useEffect(() => {
    setLtWhere?.(RSVP_STAGE_TILE[scene].label);
  }, [setLtWhere, scene]);
  useEffect(() => () => setLtWhere?.(null), [setLtWhere]);
  /* Each scene's frame is loaded the first time it is shown, then kept. */
  const [opened, setOpened] = useState<ReadonlySet<RsvpStageScene>>(() => new Set(['form']));
  const frames = useRef<Partial<Record<RsvpStageScene, HTMLIFrameElement | null>>>({});
  /* What the panel holds now — sent to a frame that (re)loads after an edit. */
  const latest = useRef<RsvpAskConfig | null>(null);
  /* …starting from the Maker's own copy when this visit's edits are newer than
     the last render (`maker-draft-store.ts`) — a frame then shows them too. */
  if (latest.current === null) {
    const own = draftedCanvasOr(RSVP_DRAFT_TYPE, current as HubSectionCanvas) as RsvpAskConfig;
    if (own !== (current as unknown)) latest.current = own;
  }
  const replyLine = useRef<string | null>(null);

  const post = useCallback(
    (frame: HTMLIFrameElement | null | undefined) => {
      const win = frame?.contentWindow;
      if (!win) return;
      const origin = window.location.origin;
      if (latest.current) for (const m of rsvpPreviewMessages(latest.current, solemn)) win.postMessage(m, origin);
      if (replyLine.current !== null) {
        win.postMessage({ source: RSVP_BRIDGE_SOURCE, t: 'words', key: rsvpWordBridgeKey('reply-by'), text: replyLine.current }, origin);
      }
    },
    [solemn],
  );
  const postAll = useCallback(() => {
    for (const f of Object.values(frames.current)) post(f);
  }, [post]);

  /* 🎉 THE WHEN YES CELEBRATION, PLAYED ON THE PAGE (owner 2026-10-06): a pick
     in Celebration ▾, "Play it again", or opening the When yes scene asks the
     thank-you frame to play the pick once (`when-yes-celebration.tsx`). */
  const serverConfig = useRef(current);
  serverConfig.current = current;
  const celebrate = useCallback((kind?: RsvpCelebration) => {
    const win = frames.current.thanks?.contentWindow;
    if (!win) return;
    const pick = kind ?? readCelebrationKey(latest.current ?? serverConfig.current);
    win.postMessage({ source: RSVP_BRIDGE_SOURCE, t: RSVP_CELEBRATE_MESSAGE, kind: pick }, window.location.origin);
  }, []);
  const sceneNow = useRef<RsvpStageScene>('form');
  const readyPlayed = useRef(new WeakSet<HTMLIFrameElement>());

  /* A word tapped on the canvas: its scene, then its box. */
  const openWordField = useCallback((bridgeKey: string) => {
    const key = bridgeKey.replace(/^rsvp:/, '') as RsvpWordKey | 'reply-by';
    const owner = (Object.keys(RSVP_SCENE_WORDS) as RsvpStageScene[]).find((s) =>
      (RSVP_SCENE_WORDS[s] as readonly string[]).includes(key),
    );
    if (owner) setScene(owner);
    setControlsOpen(true);
    window.setTimeout(() => {
      const box =
        key === 'reply-by'
          ? document.querySelector<HTMLElement>('[data-rsvp-stage-controls] [data-reply-by-field] input')
          : document.querySelector<HTMLElement>(`[data-rsvp-word-field="${key}"] input, [data-rsvp-word-field="${key}"] textarea`);
      box?.focus();
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }, []);

  useEffect(() => {
    const onPreview = (e: Event) => {
      latest.current = (e as CustomEvent<RsvpAskConfig>).detail;
      postAll();
    };
    const onReplyBy = (e: Event) => {
      replyLine.current = (e as CustomEvent<{ line: string }>).detail?.line ?? '';
      postAll();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; t?: string; key?: unknown } | null;
      if (!d || d.source !== RSVP_SITE_SOURCE) return;
      const from = Object.values(frames.current).find((f) => f?.contentWindow === e.source);
      if (!from) return;
      if (d.t === 'rsvpReady') {
        post(from);
        /* The When yes frame plays its pick the FIRST time it is ready — a later
           reload of the same frame (a Maker refresh) does not replay it. */
        if (from === frames.current.thanks && sceneNow.current === 'thanks' && !readyPlayed.current.has(from)) {
          readyPlayed.current.add(from);
          celebrate();
        }
      }
      if (d.t === 'rsvpEdit' && typeof d.key === 'string') openWordField(d.key);
    };
    const onCelebrate = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: unknown }>).detail?.kind;
      if (isRsvpCelebration(kind)) celebrate(kind);
    };
    window.addEventListener(RSVP_PREVIEW_EVENT, onPreview);
    window.addEventListener(RSVP_REPLY_BY_EVENT, onReplyBy);
    window.addEventListener(RSVP_CELEBRATE_EVENT, onCelebrate);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener(RSVP_PREVIEW_EVENT, onPreview);
      window.removeEventListener(RSVP_REPLY_BY_EVENT, onReplyBy);
      window.removeEventListener(RSVP_CELEBRATE_EVENT, onCelebrate);
      window.removeEventListener('message', onMessage);
    };
  }, [post, postAll, openWordField, celebrate]);

  /* Opening the When yes scene plays its pick (a frame already loaded; a new
     one plays on its `rsvpReady`, above). */
  useEffect(() => {
    sceneNow.current = scene;
    if (scene === 'thanks') celebrate();
  }, [scene, celebrate]);

  const pick = (next: RsvpStageScene) => {
    setScene(next);
    setOpened((o) => (o.has(next) ? o : new Set([...o, next])));
  };

  const phone = maker ? maker.device !== 'desktop' : false;
  /* The new Maker is a phone's only (`maker-shell.tsx` `ss`). */
  const stagesRsvp = maker?.stagesStudio === true;
  const sceneMeta = RSVP_STAGE_SCENES.find((s) => s.key === scene)!;

  const page = publicLandingUrl ? (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row" data-rsvp-stage-body="">
      {/* LEFT — the scenes (a list on a wide screen, one picker on a phone). */}
      <nav aria-label="RSVP scenes" className="hidden w-56 shrink-0 flex-col gap-1 border-r border-ink/10 p-3 lg:flex" data-rsvp-stage-scenes="">
        {RSVP_STAGE_SCENES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={scene === s.key}
            data-rsvp-stage-scene={s.key}
            onClick={() => pick(s.key)}
            className={`sn-press flex min-h-11 items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-sn-control ease-sn ${
              scene === s.key ? 'bg-white shadow-sm' : 'hover:bg-ink/5'
            }`}
          >
            <span className="mt-0.5 font-mono text-[11px] text-ink/50">{i + 1}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-ink">{s.label}</span>
              <span className="text-[12px] leading-snug text-ink/60">{s.sub}</span>
            </span>
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* 📱 The three screens are the lower third's tiles; a tile opens its controls there. */}
        {maker?.ltNav ? (
          <IntoLowerThird to={maker.ltNav}>
            {RSVP_STAGE_SCENES.map((s) => (
              <button
                key={s.key}
                type="button"
                data-lt-tile={`rsvp:${s.key}`}
                data-lt-group="rsvp"
                data-rsvp-stage-scene-tile={s.key}
                aria-pressed={scene === s.key}
                onClick={() => {
                  pick(s.key);
                  setControlsOpen(true);
                }}
                className={`${LOWER_THIRD_TILE} ${LOWER_THIRD_TILE_PART} ${scene === s.key ? LOWER_THIRD_TILE_ON : ''}`}
              >
                <span className="flex min-h-0 flex-1 items-center justify-center px-1.5 text-center text-[12.5px] font-semibold leading-tight text-ink">
                  {RSVP_STAGE_TILE[s.key].label}
                </span>
                <span className="block w-full truncate border-t border-ink/10 px-1 py-1.5 text-center text-[11.5px] text-ink/65">
                  {RSVP_STAGE_TILE[s.key].caption}
                </span>
              </button>
            ))}
          </IntoLowerThird>
        ) : null}
        {/* MIDDLE — the guest's page, one frame per scene visited, kept. */}
        <div className="relative flex min-h-0 flex-1 items-stretch justify-center px-2 py-2 lg:px-6 lg:pb-5 lg:pt-4">
          {RSVP_STAGE_SCENES.filter((s) => opened.has(s.key)).map((s) => (
            <iframe
              key={s.key}
              ref={(el) => {
                frames.current[s.key] = el;
              }}
              src={(frameSrc ? frameSrc(s.key) : rsvpStageCanvasSrc(publicLandingUrl, s.key)) ?? undefined}
              title={`${s.label} — as a guest sees it`}
              data-rsvp-stage-frame={s.key}
              onLoad={(e) => post(e.currentTarget)}
              hidden={scene !== s.key}
              className={`min-h-0 w-full flex-1 rounded-md border-0 bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)] ${
                phone ? 'max-w-[430px]' : 'max-w-none'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  ) : (
    <p className="m-auto max-w-sm px-4 text-center text-sm text-ink/70" data-maker-page-no-address="">
      Set your Event Hub address in Event Details to see your RSVP here.
    </p>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col" data-rsvp-stage={scene}>
      <MakerPage
        pageKey="rsvp-page"
        open={controlsOpen}
        onOpenChange={setControlsOpen}
        toolName={RSVP_STAGE_TILE[scene].label}
        page={page}
        controls={
          stagesRsvp ? (
            /* 🧭 THE NEW MAKER'S RSVP STAGE (phone): the screen's controls are its Style › Look, under the same quiet
               bar ("Edit the RSVP · Studio ›") as every part (DECISION_LOG 2026-10-07). */
            <div className="-mx-3 -mb-6 -mt-2 flex min-h-0 flex-1 flex-col">
              <StageStyle
                look={
                  <div className="flex flex-col gap-3 pb-4">
                    <MakerRsvpSettings
                      eventId={eventId}
                      current={current}
                      drafted={drafted}
                      replyBy={replyBy}
                      replyByOwn={replyByOwn}
                      requests={{ count: null, list: null }}
                      scene={scene}
                      solemn={solemn}
                      replyByFallback={replyByFallback}
                      draftAction={draftAction}
                      replyByAction={replyByAction}
                      celebration={celebration ? { ...celebration, storeShell: maker?.storeShell ?? false } : undefined}
                    />
                  </div>
                }
                background={null}
                arrange={null}
              />
            </div>
          ) : (
          <>
            {/* The desktop's title — on a phone the lower third's column names the screen. */}
            <p className="hidden px-1 text-[13px] font-semibold text-ink/70 lg:block" data-rsvp-stage-scene-title="">
              Scene {RSVP_STAGE_SCENES.indexOf(sceneMeta) + 1} · {sceneMeta.label}
            </p>
            <MakerRsvpSettings
              eventId={eventId}
              current={current}
              drafted={drafted}
              replyBy={replyBy}
              replyByOwn={replyByOwn}
              requests={{ count: null, list: null }}
              scene={scene}
              solemn={solemn}
              replyByFallback={replyByFallback}
              draftAction={draftAction}
              replyByAction={replyByAction}
              celebration={celebration ? { ...celebration, storeShell: maker?.storeShell ?? false } : undefined}
            />
          </>
          )
        }
      />
    </div>
  );
}
