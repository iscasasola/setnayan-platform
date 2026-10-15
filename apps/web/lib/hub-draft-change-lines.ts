/**
 * apps/web/lib/hub-draft-change-lines.ts
 *
 * 📋 THE APPLY SHEET NAMES EACH CHANGE — owner 2026-10-04 (DECISION_LOG
 * "CHANGING THE EVENT DATE MOVES THE WHOLE SCHEDULE · THE APPLY SHEET NAMES
 * EACH CHANGE"), verbatim: *"Yes"* to listing them. The ✓ Apply sheet said
 * "Ready to apply · 5 changes"; it now says which five, in plain words grouped
 * by where each lives in the Maker — "Look · Buttons", "Invitation · When &
 * where · Venue", "Names & date · Animation", "Event Details · Ceremony time".
 *
 * 🔑 NOT A SECOND LIST. Each line is one entry of `hubDraftCountedChanges`
 * (lib/hub-draft.ts) — the very walk `summarizeHubDraft` counts for the badge —
 * over the very plan Apply runs (`planHubDraftApply`). So the sheet can never
 * name a change the count does not hold, nor miss one it does.
 *
 * Server-side only by USE (the bar's loader and the after-save read call it);
 * pure, no I/O. The client receives the finished strings in
 * `HubDraftSummary.changes`, so none of this reaches the Maker's first-load JS.
 */
import { CAMERA_LOOK_LABEL } from '@/lib/camera-look';
import { WIDGET_CATALOG_BY_TYPE, WIDGET_PHASES, type LifecyclePhase, type WidgetType } from '@/lib/invitation-widgets';
import { makerSceneLabel } from '@/lib/maker-scene-list';
import { MAKER_PARTS } from '@/lib/maker-parts';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import { FIXED_PARTS, PART_SHOW_KEY, STAGE_SHOW_KEY, sanitizePartShow, sanitizeStageShow } from '@/lib/stage-scenes';
import { FIXED_PART_LABEL } from '@/lib/guests-see-table';
import { LOOK_PART_LABEL, LOOK_SECTION_LABEL } from '@/lib/maker-look-sections';
import { sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import {
  FIXED_STYLE_LABEL,
  cameraLookOfDraft,
  canvasLookFacets,
  hubDraftCountedChanges,
  planHubDraftApply,
  printDetailsKeysChanged,
  rsvpAskFreePartMoves,
  type CanvasFacetGroup,
  type HubDraftChangeLine,
  type HubDraftEventColumn,
  type HubDraftItem,
  type HubDraftState,
  type HubLiveState,
} from '@/lib/hub-draft';
import { postEventItemLabel } from '@/lib/post-event-draft';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { seededTheme } from '@/lib/theme-colours';
import { sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import { RSVP_CELEBRATION_LABEL, RSVP_CELEBRATION_NAME, readCelebrationKey } from '@/lib/rsvp-celebration';
import { PASS_CARD_WORDS } from '@/lib/pass-card';
import { MARCH_DRAFT_PLACE, marchChangesWord } from '@/lib/march-draft';

const LOOK = 'Look';
/** The toolbar's Event Details (`MAKER_DETAILS_LABEL`, launch/_components/maker-bar.ts). */
const DETAILS = 'Event Details';

/**
 * Every draftable `events` column → where it lives · what it is. A `Record` over
 * the column type, so a new draftable column cannot ship without a line here
 * (the compiler refuses it) — never a "Something changed".
 */
export const HUB_DRAFT_EVENT_PLACE: Record<HubDraftEventColumn, { place: string; what: string }> = {
  invite_theme: { place: LOOK, what: 'Theme' },
  // 🎨 Named with the theme it came from — "Mood Board · Colours from Cyber Neon" (`hubDraftChangePlace`).
  role_palette: { place: 'Mood Board', what: 'Colours' },
  site_art_direction: { place: LOOK, what: 'Candlelight' },
  site_font_key: { place: LOOK, what: LOOK_PART_LABEL.font },
  // 🌈 The page fill is Look › Background's since 2026-10-08 — named for itself, so it never reads as the main background's line.
  site_bg_color: { place: LOOK, what: LOOK_PART_LABEL.page },
  site_button_color: { place: LOOK, what: LOOK_PART_LABEL.buttons },
  site_button_style: { place: LOOK, what: LOOK_PART_LABEL.buttons },
  // 🔤 The Headings · Text · Labels & buttons fonts — Look › Elements (owner 2026-10-08).
  site_roles: { place: LOOK, what: LOOK_PART_LABEL.font },
  site_magic_traveller: { place: LOOK, what: 'Magic move' },
  site_bg_music_r2_key: { place: 'Music', what: 'Background music' },
  site_bg_music_enabled: { place: 'Music', what: 'On or off' },
  landing_page_hero_image_url: { place: 'Names & date', what: 'Photo' },
  // 🎬 The hero video is set in Look › Background since 2026-10-08 (it was under Music).
  landing_page_hero_video_r2_key: { place: LOOK, what: LOOK_PART_LABEL.video },
  rsvp_backdrop: { place: 'RSVP', what: 'Backdrop' },
  rsvp_ask_config: { place: 'RSVP', what: 'What you ask your guests' },
  std_reveal_template: { place: 'Save the Date', what: 'Reveal' },
  std_reveal_effects: { place: 'Save the Date', what: 'Reveal effects' },
  std_background: { place: 'Save the Date', what: 'Film background' },
  reveal_stages: { place: 'Save the Date', what: 'Where the reveal plays' },
  monogram_custom_svg: { place: 'Logo', what: 'Your logo' },
  monogram_studio_config: { place: 'Logo', what: 'Design' },
  our_photos: { place: 'Photos', what: 'Your photos' },
  style_preferences: { place: "Guest's ticket", what: 'QR look' },
  special_message: { place: 'Special message', what: 'Words' },
  what_to_bring: { place: 'What to bring', what: 'Reminders' },
  love_story: { place: 'Love Story', what: 'Chapters' },
  together_since: { place: 'Love Story', what: 'Together since' },
  dress_code_config: { place: 'Dress code', what: 'Colours & rules' },
  photo_moments_config: { place: 'Photo moments', what: 'Camera cues' },
  // The typed facts — each ONE change however many columns carry it.
  display_name: { place: DETAILS, what: 'Names' },
  bride_name: { place: DETAILS, what: 'Names' },
  groom_name: { place: DETAILS, what: 'Names' },
  event_date: { place: DETAILS, what: 'Date' },
  event_date_precision: { place: DETAILS, what: 'Date' },
  print_details: { place: DETAILS, what: 'Name style' },
  pabuya_message: { place: 'E-Gifts', what: 'Thank-you message' },
  guest_list_edit_deadline: { place: 'RSVP', what: 'Reply by' },
  std_film_ceremony_name: { place: DETAILS, what: 'Venues' },
  ceremony_venue_address: { place: DETAILS, what: 'Venues' },
  ceremony_venue_latitude: { place: DETAILS, what: 'Venues' },
  ceremony_venue_longitude: { place: DETAILS, what: 'Venues' },
  std_film_venue_name: { place: DETAILS, what: 'Venues' },
  venue_address: { place: DETAILS, what: 'Venues' },
  venue_latitude: { place: DETAILS, what: 'Venues' },
  venue_longitude: { place: DETAILS, what: 'Venues' },
  std_film_venue_city: { place: DETAILS, what: 'Venues' },
  ceremony_time: { place: DETAILS, what: 'Ceremony time' },
  papic_on: { place: DETAILS, what: 'Photos from guests' },
  gifts_on: { place: DETAILS, what: 'Gifts' },
  logo_wanted: { place: DETAILS, what: 'Logo' },
  cover_photo_wanted: { place: DETAILS, what: 'Event photo' },
  // 🔳 Info › Your Event Hub › QR on/off (owner 2026-10-07).
  qr_shown: { place: 'Info', what: 'Event QR on or off' },
  // 🎨 One of the five main colours, edited in Studio › Look › Elements › Colours (owner 2026-10-07; Elements since 2026-10-08).
  main_colours: { place: LOOK, what: LOOK_PART_LABEL.colours },
};

/** A scene canvas facet group → the word on the sheet. */
const FACET_WORD: Record<CanvasFacetGroup, string> = {
  media: 'Background',
  crop: 'Photo crop',
  layout: 'Layout',
  motion: 'Animation',
  transition: 'Transition',
  font: 'Font',
  'part-motion': 'Animation',
  'slot-media': 'Photos',
  playback: 'Clip playback',
};

/** Where a scene lives: "Invitation · When & where" when it is on one stage, else just its name. */
/* ═══════════════════════════════════════════════════════════════════════════
   🏷 ONE NAME PER THING — the Maker's own word for the part (re-walk 2026-10-11, R02)
   ═══════════════════════════════════════════════════════════════════════════

   The sheet named ONE part three ways: the Title's words and motion were "Names & date" (the cover's row), its Style
   "The title" (`FIXED_STYLE_LABEL`), and the part the Maker calls "Message" was "Special message" (the catalogue).
   The couple reads "You're editing · Invitation › Welcome › TITLE" while they change it — that word is the part's
   label in `MAKER_PARTS`, and it is the one the sheet now uses, wherever the changed thing IS a part:

     · a scene's row            → the part drawn at `w:<type>`           ("Message", "Venue", "Gallery");
     · a part's Style           → the part whose layouts are that scene  ("Title" for `hero_eyebrow`);
     · the cover's canvas       → the part(s) of the cover that changed  ("Title"; "Title, Names") — only when
                                   nothing ELSE of the cover changed; the cover as a whole keeps its row's name.

   No name is invented here: where the Maker has no part for a thing (a scene of their own, the cover as a whole),
   the name it had stands. */

/** The Maker's word for the part drawn at a canvas key (and, on the cover, at one of its elements). */
export function makerPartWordAt(canvas: string, el: string | null = null): string | null {
  for (const part of Object.values(MAKER_PARTS)) if (part.canvas === canvas && (part.el ?? null) === el) return part.label;
  return null;
}
/** The Maker's word for the part whose Style a styled scene is (`hero_eyebrow` → "Title"). */
export function makerPartWordOfStyle(scene: string): string | null {
  for (const part of Object.values(MAKER_PARTS)) if (part.layouts.kind === 'scene' && part.layouts.type === scene) return part.label;
  return null;
}

/** The cover's parts a drafted canvas changes — null when something that is NOT one part's own changed too. */
function coverPartsChanged(liveConfig: unknown, next: unknown): string[] | null {
  const live = sanitizeHubCanvas(liveConfig) as Record<string, unknown>;
  const drafted = ((next as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const key of new Set([...Object.keys(live), ...Object.keys(drafted)])) if (key !== 'elements' && !same(live[key], drafted[key])) return null;
  const was = (live.elements ?? {}) as Record<string, unknown>;
  const now = (drafted.elements ?? {}) as Record<string, unknown>;
  const words: string[] = [];
  for (const el of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (same(was[el], now[el])) continue;
    const word = makerPartWordAt('f:hero', el);
    if (!word) return null;
    if (!words.includes(word)) words.push(word);
  }
  return words.length > 0 && words.length <= 2 ? words : null;
}

function scenePlace(t: WidgetType): string {
  const name = makerPartWordAt(`w:${t}`) || makerSceneLabel(t) || WIDGET_CATALOG_BY_TYPE[t]?.label || 'A scene';
  const stages = WIDGET_PHASES[t] ?? [];
  return stages.length === 1 ? `${PUBLIC_STAGE_LABELS[stages[0]!]} · ${name}` : name;
}

/** What changed in a scene's look: its facets' words ("Font, Animation"), else "Look". */
function canvasWhat(liveConfig: unknown, next: unknown): string {
  const live = sanitizeHubCanvas(liveConfig);
  const drafted = (next as HubSectionCanvas | null) ?? {};
  const words: string[] = [];
  for (const f of canvasLookFacets(live, drafted)) {
    if (f.change === 'none') continue;
    const w = FACET_WORD[f.group];
    if (!words.includes(w)) words.push(w);
  }
  return words.length === 0 ? 'Look' : words.slice(0, 2).join(', ');
}

/**
 * 👁 What a per-stage choice changed, stage by stage, in the stages' own order,
 * in the "What guests see" sheet's own phrases: "Added to Save the Date",
 * "Hidden on The Day", and "Back to our pick on Post Event" for a choice taken back. `next` is the whole merged key Apply writes.
 */
export function stageShowWhat(liveConfig: unknown, next: unknown): string {
  const was = sanitizeStageShow(isPlainObjectValue(liveConfig) ? liveConfig[STAGE_SHOW_KEY] : null) ?? {};
  const now = sanitizeStageShow(next) ?? {};
  const words: string[] = [];
  for (const st of PUBLIC_STAGE_ORDER) {
    const a = was[st] ?? null;
    const b = now[st] ?? null;
    if (a === b) continue;
    words.push(b === true ? `Added to ${PUBLIC_STAGE_LABELS[st]}` : b === false ? `Hidden on ${PUBLIC_STAGE_LABELS[st]}` : `Back to our pick on ${PUBLIC_STAGE_LABELS[st]}`);
  }
  return words.length > 0 ? words.join(', ') : 'Shown or hidden';
}

/**
 * 👁 The same, for the parts that are not scenes (`config_json.part_show` on the hero row): each part that moved, by
 * its name in the table — "E-Gifts · Hidden on The Day". `next` is the whole merged key Apply writes.
 */
export function partShowWhat(liveConfig: unknown, next: unknown): string {
  const was = sanitizePartShow(isPlainObjectValue(liveConfig) ? liveConfig[PART_SHOW_KEY] : null) ?? {};
  const now = sanitizePartShow(next) ?? {};
  const words: string[] = [];
  for (const part of FIXED_PARTS) {
    const moved = stageShowWhat({ [STAGE_SHOW_KEY]: was[part] ?? null }, now[part] ?? null);
    if (moved !== 'Shown or hidden') words.push(`${FIXED_PART_LABEL[part]} · ${moved}`);
  }
  return words.length > 0 ? words.join(' · ') : 'Shown or hidden';
}

/** One draft item → where · what. Exhaustive over the item kinds and widget fields. */
export function hubDraftChangePlace(item: HubDraftItem, live: HubLiveState, stage?: LifecyclePhase): { place: string; what: string } {
  switch (item.kind) {
    case 'event': {
      /* 🎨 A theme's colours placed on an empty Mood Board (owner 2026-10-05)
         say which theme they came from — "Mood Board · Colours from Cyber Neon". */
      if (item.column === 'role_palette') {
        const from = seededTheme(item.value);
        return { place: 'Mood Board', what: from ? `Colours from ${INVITE_THEMES[from].name}` : 'Colours' };
      }
      /* 🎫 The drafted print settings say WHICH one moved — the ticket style is
         the Guest's ticket's, the name style Event Details'. */
      if (item.column === 'print_details') {
        const keys = printDetailsKeysChanged(live.events.print_details, item.value);
        if (keys.length === 1 && keys[0] === 'opening_line') return { place: 'Prints', what: 'Opening line' };
        if (keys.length === 1 && keys[0] === 'pass_design') return { place: "Guest's ticket", what: PASS_CARD_WORDS.style };
        if (keys.length >= 2) {
          const words = { name_style: 'Name style', pass_design: PASS_CARD_WORDS.style, opening_line: 'Opening line' } as const;
          return { place: DETAILS, what: keys.map((k) => words[k]).join(', ') };
        }
      }
      /* 🎛 The camera's look (owner 2026-10-07) — "Camera · Look · Your brand", not the QR. */
      if (item.column === 'style_preferences') {
        const cam = cameraLookOfDraft(item.value);
        const qrMoved = isPlainObjectValue(item.value) && 'qr' in item.value;
        if (cam && cam !== cameraLookOfDraft(live.events.style_preferences ?? null) && !qrMoved) return { place: 'Camera', what: `Look · ${CAMERA_LOOK_LABEL[cam]}` };
        /* 🧱 A fixed block's look (`lib/block-looks.ts`) — "Event Hub · How a block looks", not the QR. */
        if (!qrMoved && isPlainObjectValue(item.value) && 'block_looks' in item.value) return { place: 'Event Hub', what: 'How a block looks' };
      }
      /* 🎉 The When yes celebration is NAMED at Apply (owner 2026-10-06):
         "RSVP · When they say yes · Confetti" — with the RSVP's other edits beside it
         when they moved too. */
      if (item.column === 'rsvp_ask_config') {
        const liveConfig = live.events.rsvp_ask_config ?? null;
        const to = readCelebrationKey(sanitizeRsvpAskConfig(item.value));
        if (to !== readCelebrationKey(sanitizeRsvpAskConfig(liveConfig))) {
          const pick = `${RSVP_CELEBRATION_LABEL} · ${RSVP_CELEBRATION_NAME[to]}`;
          return { place: 'RSVP', what: rsvpAskFreePartMoves(liveConfig, item.value) ? `${HUB_DRAFT_EVENT_PLACE.rsvp_ask_config.what}, ${pick}` : pick };
        }
      }
      return HUB_DRAFT_EVENT_PLACE[item.column];
    }
    case 'editorial': {
      // "Post Event · which scenes show" → Post Event · Which scenes show.
      const [place, ...rest] = postEventItemLabel(item.item).split(' · ');
      const what = rest.join(' · ');
      return { place: place || 'Post Event', what: what ? what[0]!.toUpperCase() + what.slice(1) : 'Your story' };
    }
    case 'fixed-style':
      return { place: makerPartWordOfStyle(item.scene) ?? FIXED_STYLE_LABEL[item.scene], what: 'Style' };
    /* 🚶 The Wedding March's drafted moves, ONE line (owner 2026-10-06, "Wait for
       apply"): "Wedding March · 3 changes" — one per drop the couple made. */
    case 'march':
      return { place: MARCH_DRAFT_PLACE, what: marchChangesWord(item.value.length) };
    case 'widget': {
      const place = scenePlace(item.widgetType);
      switch (item.field) {
        case 'main':
          return { place: LOOK, what: LOOK_SECTION_LABEL.background };
        case 'music':
          return { place: 'Music', what: 'Music button' };
        case 'std_lead':
          return { place: 'Save the Date', what: 'Film or photos' };
        case 'photos_heading':
          return { place, what: 'Heading' };
        case 'mode':
        case 'is_visible':
          return { place, what: 'Shown or hidden' };
        case 'stage_show': {
          /* 👁 Per stage (owner 2026-10-10, "WHAT GUESTS SEE"): the line names each
             stage that moved and which way — "Hidden on The Day". */
          const row = live.widgets.find((r) => r.widget_id === item.widgetId);
          return { place, what: stageShowWhat(row?.config_json, item.value) };
        }
        case 'part_show': {
          const row = live.widgets.find((r) => r.widget_id === item.widgetId);
          return { place: 'What guests see', what: partShowWhat(row?.config_json, item.value) };
        }
        case 'display_order':
          return { place, what: 'Order' };
        case 'stage_order':
          /* ↕ A stage's order is ONE line, named for the stage ("Invitation · Order") — never one per scene. */
          return { place: stage ? PUBLIC_STAGE_LABELS[stage] : place, what: 'Order' };
        case 'custom':
          return { place, what: 'Words' };
        case 'venue':
          return { place, what: 'Venue' };
        case 'removed':
          return { place, what: 'Deleted for good' };
        case 'canvas': {
          const row = live.widgets.find((r) => r.widget_id === item.widgetId);
          /* 🏷 The cover: named for the part of it that changed (the Title, the Names…) — see "ONE NAME PER THING". */
          const parts = item.widgetType === 'hero' ? coverPartsChanged(row?.config_json, item.value) : null;
          return { place: parts ? parts.join(', ') : place, what: canvasWhat(row?.config_json, item.value) };
        }
      }
    }
  }
}

/**
 * Every change Apply would publish (or hold), named — exactly
 * `summarizeHubDraft(...).changeCount` lines, in the same order.
 */
export function hubDraftChangeLines(draft: HubDraftState | null, live: HubLiveState, ownsPro: boolean): HubDraftChangeLine[] {
  if (!draft) return [];
  return hubDraftCountedChanges(planHubDraftApply(draft, live, ownsPro)).map(({ item, held, stage }) => ({
    ...hubDraftChangePlace(item, live, stage),
    pro: item.pro,
    held,
  }));
}

function isPlainObjectValue(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}
