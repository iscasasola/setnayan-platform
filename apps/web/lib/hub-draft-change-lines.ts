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
import { WIDGET_CATALOG_BY_TYPE, WIDGET_PHASES, type WidgetType } from '@/lib/invitation-widgets';
import { makerSceneLabel } from '@/lib/maker-scene-list';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { LOOK_SECTION_LABEL } from '@/lib/maker-look-sections';
import { sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import {
  FIXED_STYLE_LABEL,
  canvasLookFacets,
  hubDraftCountedChanges,
  planHubDraftApply,
  printDetailsKeysChanged,
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
import { PASS_CARD_WORDS } from '@/lib/pass-card';

const LOOK = 'Look';
/** The toolbar's Event Details (`MAKER_DETAILS_LABEL`, launch/_components/maker-bar.ts). */
const DETAILS = 'Event Details';

/**
 * Every draftable `events` column → where it lives · what it is. A `Record` over
 * the column type, so a new draftable column cannot ship without a line here
 * (the compiler refuses it) — never a "Something changed".
 */
export const HUB_DRAFT_EVENT_PLACE: Record<HubDraftEventColumn, { place: string; what: string }> = {
  invite_theme: { place: LOOK, what: LOOK_SECTION_LABEL.theme },
  // 🎨 Named with the theme it came from — "Mood Board · Colours from Cyber Neon" (`hubDraftChangePlace`).
  role_palette: { place: 'Mood Board', what: 'Colours' },
  site_art_direction: { place: LOOK, what: 'Candlelight' },
  site_font_key: { place: LOOK, what: LOOK_SECTION_LABEL.font },
  site_bg_color: { place: LOOK, what: LOOK_SECTION_LABEL.colours },
  site_button_color: { place: LOOK, what: LOOK_SECTION_LABEL.buttons },
  site_button_style: { place: LOOK, what: LOOK_SECTION_LABEL.buttons },
  site_magic_traveller: { place: LOOK, what: 'Magic move' },
  site_bg_music_r2_key: { place: 'Music', what: 'Background music' },
  site_bg_music_enabled: { place: 'Music', what: 'On or off' },
  landing_page_hero_image_url: { place: 'Names & date', what: 'Photo' },
  landing_page_hero_video_r2_key: { place: 'Names & date', what: 'Video' },
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
function scenePlace(t: WidgetType): string {
  const name = makerSceneLabel(t) || WIDGET_CATALOG_BY_TYPE[t]?.label || 'A scene';
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

/** One draft item → where · what. Exhaustive over the item kinds and widget fields. */
export function hubDraftChangePlace(item: HubDraftItem, live: HubLiveState): { place: string; what: string } {
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
        if (keys.length === 1 && keys[0] === 'pass_design') return { place: "Guest's ticket", what: PASS_CARD_WORDS.style };
        if (keys.length === 2) return { place: DETAILS, what: `Name style, ${PASS_CARD_WORDS.style}` };
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
      return { place: FIXED_STYLE_LABEL[item.scene], what: 'Style' };
    case 'widget': {
      const place = scenePlace(item.widgetType);
      switch (item.field) {
        case 'main':
          return { place: LOOK, what: LOOK_SECTION_LABEL.background };
        case 'std_lead':
          return { place: 'Save the Date', what: 'Film or photos' };
        case 'mode':
        case 'is_visible':
          return { place, what: 'Shown or hidden' };
        case 'display_order':
        case 'stage_order':
          return { place, what: 'Order' };
        case 'custom':
          return { place, what: 'Words' };
        case 'venue':
          return { place, what: 'Venue' };
        case 'canvas': {
          const row = live.widgets.find((r) => r.widget_id === item.widgetId);
          return { place, what: canvasWhat(row?.config_json, item.value) };
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
  return hubDraftCountedChanges(planHubDraftApply(draft, live, ownsPro)).map(({ item, held }) => ({
    ...hubDraftChangePlace(item, live),
    pro: item.pro,
    held,
  }));
}

