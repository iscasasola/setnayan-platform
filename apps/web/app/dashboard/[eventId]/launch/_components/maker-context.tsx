'use client';

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { DetailsItemKey } from '@/lib/maker-details-items';
import type { HubElementKey } from '@/lib/element-style';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubFontKey } from '@/lib/hub-fonts';
import type { ElementDraftAction, ElementPalette } from '../../website/editor/_components/element-sheet';

/**
 * THE MAKER'S SHARED STATE — what the toolbar says, the navigator, canvas and
 * inspector read.
 *
 * Two server trees meet in the Maker: the shell (toolbar + the ⋯ sheet, built
 * by `launch/page.tsx`) and the work area (navigator + canvas + inspector,
 * built by `website/editor/page.tsx` with every panel and its OWN bound server
 * action). They cannot pass props to each other — each is a server component
 * handing its own client component plain data — so the one place they meet is
 * this context, provided by `MakerShell` and read by `MakerWork`.
 *
 * 🔑 NOTHING HERE WRITES. Every write is a form posting to an action that
 * already ships; this carries only which stage, which device, which thing is
 * selected, and whether the navigator is open.
 */

/**
 * 'both' = the phone and the desktop render side by side (View ▾ Both, owner
 * 2026-09-28). Offered only at 1024 px and wider (`makerViewOptions`); the
 * `device` in `MakerState` is what the canvas SHOWS (`makerShownDevice`), so a
 * window narrowed under 1024 px falls back to Desktop without losing the pick.
 */
export type MakerDevice = 'desktop' | 'phone' | 'both';

/** What the inspector is showing. `null` = nothing selected, inspector closed. */
export type MakerSelection =
  | { kind: 'scene'; id: string; tab?: MakerSceneTab }
  | { kind: 'tool'; key: 'logo' | 'hero' | 'reveal' | 'love-story' | 'post-event' | 'details' | 'rsvp-page' | 'rsvp-stage' }
  | { kind: 'main' }
  | { kind: 'row'; key: string }
  /** 📖 One of Post Event's written scenes (Maker Phase 8) — by its scene key. */
  | { kind: 'post-event'; scene: string }
  | null;

/** 'transition' is the folded tab (answer 4, "fold it") — an old address opens Animate. */
export type MakerSceneTab = 'format' | 'animate' | 'arrange' | 'content' | 'transition';

export type MakerState = {
  eventId: string;
  stage: LifecyclePhase;
  setStage: (stage: LifecyclePhase) => void;
  device: MakerDevice;
  navOpen: boolean;
  selection: MakerSelection;
  select: (next: MakerSelection) => void;
  /** Is the ⋯ sheet open? The work area portals the address rows into it. */
  moreOpen: boolean;
  /** A new value on every server render — the canvas reloads on it, so a save
   *  (which redirects back here) is seen on the page at once. */
  renderStamp: string;
  /** App-store shell: Pro-only controls are HIDDEN, not locked, and no price. */
  storeShell: boolean;
  /**
   * VIEW AS (moved from the ⋯ sheet's old stage, owner 2026-09-25): the guest
   * page as one role sees it, or null for the host's own editing preview. The
   * canvas iframe loads this instead of `?editor=1` while it is set.
   */
  viewAsHref: string | null;
  /** ＋ Add a scene, as the work area registered it — see `MakerAddScene` below. */
  addScene: MakerAddScene | null;
  setAddScene: (next: MakerAddScene | null) => void;
  /**
   * 🧭 The item Details is on (or will open on) — Details reports it as the
   * couple moves, and a door elsewhere in the Maker (an old Hero or Reveal
   * button, `select({ kind: 'tool', key: 'hero' })`) sets it before Details
   * opens. Null until Details has said. Optional: a harness may leave it out.
   */
  detailsItem?: DetailsItemKey | null;
  setDetailsItem?: (key: DetailsItemKey) => void;
  /**
   * 📱 How many times a door (Look · Event Details · Prints) has opened Details —
   * on a phone each press opens the item's editor as a bottom sheet (owner
   * 2026-10-02, frame G: "Look and Details open as bottom sheets over the
   * preview"); opened any other way, the page shows clean. Optional.
   */
  detailsDoor?: number;
  /** 🎨 The Look pages the work area moved into Details — see `MakerLookPages`. */
  lookPages?: MakerLookPages | null;
  setLookPages?: (next: MakerLookPages | null) => void;
  /**
   * ✍ TAP A FACT, EDIT IT ON THE RIGHT (Details part 2b): the Details items'
   * OWN editors, built once by the launch page (`detailsFactEditors`) and handed
   * to both Details and the stage — so a fact tapped on a stage opens the SAME
   * component its Details item shows, never a copy. Empty outside the Maker.
   */
  factEditors?: Partial<Record<DetailsItemKey, ReactNode>>;
  /**
   * ⚡ The instant scrapbook (`love-story-live.tsx`, its own lazy chunk — see
   * `maker-shell.tsx`). Handed down HERE rather than imported by the Love Story
   * page or Details, so the only route that can load it is the Maker's (a route
   * that can load a chunk adds what it lacks to the webpack runtime every page
   * downloads).
   */
  liveLoveStoryBook?: ComponentType<Record<string, unknown>>;
  /** ⚡ …and its words panel (Details' Love Story editor, and a stage's tapped story). */
  liveStoryPanel?: ComponentType<Record<string, unknown>>;
  /**
   * 📄 PAGE ▾ IN THE TOOLBAR (the Maker in 4, 2026-10-02). The work area knows
   * the stage's pages and which scenes sit under each (`makerGuestPages`), so it
   * REPORTS them here — the page it shows included — and the toolbar's Page ▾
   * draws from that. A pick ASKS (`pageJump`); the work area answers once that
   * stage's canvas is up, and clears it.
   */
  guestPages?: MakerGuestPagesReport | null;
  setGuestPages?: (next: MakerGuestPagesReport | null) => void;
  pageJump?: MakerPageJump | null;
  clearPageJump?: () => void;
  /** 👁 The bar's Preview menu — drawn by the draft bar between Undo and Apply (`hub-draft-bar.tsx`). */
  previewMenu?: ReactNode;
  /** ↺ Restore, as the draft bar registers it — Page ▾ › Restore runs it. */
  draft?: MakerDraftDoor | null;
  setDraft?: (next: MakerDraftDoor | null) => void;
};

/** What the work area reports about the stage it shows (see `MakerState.guestPages`). */
export type MakerGuestPagesReport = {
  stage: LifecyclePhase;
  /** This event draws a story at all (a birthday has no "Our Love Story" page). */
  hasStory: boolean;
  /** The page the canvas and the scenes column show. */
  shown: string | null;
  pages: ReadonlyArray<{ key: string; label: string; empty?: boolean }>;
};

/** A Page ▾ pick waiting for its stage (see `MakerState.pageJump`). `sameStage`: no new canvas to wait for. */
export type MakerPageJump = { stage: LifecyclePhase; key: string; n: number; sameStage: boolean };

/** ↺ The draft bar's Restore, as it registered it — Page ▾ › Restore runs it (see `MakerState.draft`). */
export type MakerDraftDoor = { canRestore: boolean; restore: () => void };

/**
 * 🎨 THE LOOK PAGES THAT MOVED INTO DETAILS (Details part 3, owner 2026-09-28
 * "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS"). Logo, Hero and Reveal
 * are built by the WORK AREA's server page (`website/editor/page.tsx`
 * `madeOnce`), with every read and bound action they always had; Details is
 * built by the launch page. The two trees meet only here, so the work area
 * REGISTERS the three — the same nodes, moved whole, never a second build —
 * and Details draws them (`details-look-pages.tsx`).
 */
export type MakerLookPages = {
  /** The Logo studio — canvas and panel, its own split. */
  logo: ReactNode | null;
  /** The Hero's controls: Designs 1–4, its parts, the photo. */
  hero: ReactNode | null;
  /**
   * 🎨 LOOK › BACKGROUND · FONT · COLOURS (owner 2026-10-02, tracker f40 —
   * `lib/maker-look-sections.ts`): the rows the work area always built — the
   * Main background ("Behind every scene"), the one font dropdown, the page and
   * button colours — and the Dress code scene's palette look. Drawn by Look
   * (`details-look-pages.tsx` `LookPanel`) under the theme. Optional: a
   * harness may leave it out, and Look then says it is opening.
   */
  look?: {
    background: ReactNode | null;
    font: ReactNode | null;
    colours: ReactNode | null;
    palette: ReactNode | null;
    /** 🔘 Look › Buttons — Shape · Fill · Colour (owner 2026-10-04). */
    buttons?: ReactNode | null;
  } | null;
  /** The Reveal's settings: play it, its fine-tune, where it plays (the RIGHT column). */
  reveal: ReactNode | null;
  /** The Reveal's openings — its pieces, listed in Details' NAVIGATOR. */
  revealOptions: ReactNode | null;
  /**
   * The Hero's parts and what edits one — the SAME per-part editing a tap on
   * the hero scene opens (`element-sheet.tsx`, its one draft door); null when
   * per-part editing is not offered.
   */
  heroParts: {
    keys: readonly HubElementKey[];
    canvases: Record<string, HubSectionCanvas>;
    palette: ElementPalette;
    draftAction: ElementDraftAction;
    ownsPro: boolean;
  } | null;
  /** Where the reveal plays (drafted over live) — its page previews the first. */
  revealStages: readonly LifecyclePhase[];
  /**
   * 🔤 Every face this Event Hub renders now (`hubFontsInUse`, over the draft
   * over live the canvas draws) — each font dropdown marks them "In use"
   * (`font-pick.tsx`, owner 2026-09-29: "actively used").
   */
  fontsInUse?: readonly HubFontKey[];
  /** The guest page's address (`/<slug>`), or null before there is one. */
  publicLandingUrl: string | null;
};

export const MakerContext = createContext<MakerState | null>(null);

export function useMaker(): MakerState | null {
  return useContext(MakerContext);
}

/** The element id the ⋯ sheet keeps for the work area's address rows. */
export const MAKER_MORE_ROWS_ID = 'maker-more-rows';

/**
 * ＋ ADD A SCENE — what the toolbar's ＋ (and, on a phone, the More ▾ row) does.
 * Only the work area knows whether a scene may be added here — the templates,
 * Pro, the six, the stage, the store shell — so it REGISTERS the answer
 * (`setAddScene`) and the shell draws the button from it. `ready` opens the
 * work area's own template sheet (the same one as the navigator's "+ Add a
 * scene"); `refused` says why (all six in use); null = no button (the store
 * shell, a stage without scenes of their own). The shell draws it only on a
 * STAGE, never on a page (`makerAddShowsOn`). A client registration only — the write is still the tile's form,
 * posting to `addCustomSection`.
 */
export type MakerAddScene =
  /** `tried`: the couple has no Event Hub Pro — the scene is tried free and Apply asks (◆ PRO, 2026-09-28). */
  | { kind: 'ready'; open: () => void; tried?: boolean }
  /** Why a scene cannot be added here (all six in use). Never a Pro refusal any
   *  more — a couple without Pro adds and pays at Apply (owner 2026-09-28). */
  | { kind: 'refused'; note: string };

/**
 * 💎 "Go to" from the Apply sheet (owner 2026-09-28): after the scene is
 * selected, open ONE part's own sheet on it — the part whose font or motion is
 * the Pro effect. `detail` = `{ key, widgetType, el }` (an `ElementTarget`
 * without a range); the work area (`editor-shell.tsx`) answers.
 */
export const MAKER_OPEN_PART_EVENT = 'maker:open-part';
