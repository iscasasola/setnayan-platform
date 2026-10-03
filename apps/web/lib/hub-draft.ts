/**
 * apps/web/lib/hub-draft.ts
 *
 * THE EVENT HUB DRAFT — what it holds, and every decision about it (Maker Phase 2).
 *
 * Owner, 2026-09-24 (DECISION_LOG "EDIT … AS A DRAFT: Apply · Restore · Reset to
 * default"): *"have a button to apply save. so they can restore to last state or
 * reset back to default."* And 2026-09-25 "Try then pay": a free couple may TRY a
 * Pro change in the draft and pays at Apply.
 *
 *   Save    — a changed key goes into the draft; guests still see the live page.
 *   Apply   — the draft's keys are written to the live columns, in a fixed order,
 *             each classified by the ONE look rule (`lib/hub-look-pro.ts`). A
 *             Pro key without Event Hub Pro is REFUSED and STAYS in the draft, so
 *             the couple who tried it can pay and Apply again without redoing it.
 *   Restore — the draft is thrown away; the preview matches the guest link again.
 *   Reset   — the page we wrote, for one stage, written INTO THE DRAFT (so it can
 *             be undone until Apply). It never names a guest-owned table.
 *   Undo    — the draft keeps its last ten states.
 *
 * 🔑 PURE ON PURPOSE. No I/O, no Supabase, no `server-only`: the store
 * (`lib/hub-draft-store.ts`), the action (`website/hub-draft-actions.ts`) and the
 * guest loader overlay all call into this file, and the tests prove the rules
 * here without a database — including that Apply's plan refuses every Pro key
 * for a free couple and applies it for an owning one (a gate that can only
 * answer one way renders exactly like a gate that works).
 *
 * ── WHAT A DRAFT MAY HOLD (and why the list is short) ──────────────────────
 * events  — `rsvp_backdrop`, and (Phase 6) the made-once group: the hero photo,
 *           the reveal and the Logo — each sanitised through the SAME parser its
 *           live writer and the guest render use (see `HUB_DRAFT_EVENT_COLUMNS`). The rule for joining this list is
 *           "the host's preview can SHOW it". (The page colours, face and art
 *           direction are painted by `app/[slug]/layout.tsx`, which cannot see
 *           `?editor=1` — so the host canvas re-wears them from the overlaid row
 *           inside the page; see `HostDraftLook`.) Media columns (hero video, music, gallery) are not
 *           here either: their writers also verify the file is this event's and
 *           was screened, and draft media is the open owner decision D6. The hero
 *           PHOTO is the exception (Phase 6): its live writer checks nothing but
 *           the `r2://` scheme, the draft holds it to the public bucket, and
 *           Apply holds it to THIS event's own uploads (`not_your_photo`).
 *         — and (2026-09-25, "the Maker's live savers go into the draft") the
 *           page's COLOURS AND FACE and the couple's WORDS: the owner edits his
 *           own public page in the Maker, and every "Saves immediately" there
 *           was a half-finished edit a guest could read. See
 *           `HUB_DRAFT_EVENT_COLUMNS` for how the host's preview shows each.
 *         — and (2026-10-01, "wait for apply") the NAMES and the DATE typed in
 *           the Maker (`HUB_DRAFT_FACT_COLUMNS`): the host's preview reads both
 *           off the overlaid row, and Apply re-asks the date's own gates.
 * widgets — per section: `mode` (Auto · Shown · Hidden), `is_visible` (the
 *           navigator's eye — the legacy gate `mode: 'auto'` falls back to),
 *           `display_order`, and the section's whole `canvas` (background, crop,
 *           motion, transition),
 *           sanitised by `sanitizeHubCanvas` — the same function the guest render
 *           reads through. `canvas: null` means "take the canvas off".
 *           The HERO row alone also carries `main` (Maker Phase 10): what is
 *           behind every scene — by default the hero itself, with the adaptive
 *           theme's `tint` measured off its photo, or an opt-in override clip or
 *           photo — stored at `config_json.main`, read through
 *           `sanitizeHubMainGround`. `main: null` = the plain hero, unmeasured.
 *           Every section also carries `stage_order` — its place on each stage
 *           (owner 2026-09-27, every scene drags within its stage) — and the
 *           GALLERY row alone `std_lead`, the Save the Date's Film · Photos pick;
 *           both live in `config_json` and both are free (`lib/stage-scenes.ts`).
 */
import {
  sanitizeFixedSceneStylesDraft,
  stylePreferencesWithDraftedStyles,
  type FixedSceneStyles,
  type FixedSceneStylesDraft,
  type FixedStyleScene,
} from '@/lib/fixed-scene-styles';
import {
  WIDGET_PHASES,
  WIDGET_TYPES,
  isWidgetType,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from '@/lib/invitation-widgets';
import {
  customSectionHasContent,
  isCustomSectionType,
  readCustomSectionInput,
  sanitizeCustomSection,
  type CustomSectionContent,
} from '@/lib/custom-sections';
import {
  STAGE_ORDER_KEY,
  configWithStageOrder,
  configWithStdLead,
  sanitizeStageOrder,
  sanitizeStdLead,
  storedStdLead,
  type StdLead,
} from '@/lib/stage-scenes';
import {
  HUB_MAIN_GROUND_KEY,
  hubMainGround,
  isHubMainFollow,
  isHubMainOwn,
  sanitizeHubCanvas,
  sanitizeHubMainGround,
  type HubMainGround,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';
import { HUB_ELEMENT_KEYS, type HubElementKey, type HubElementRun, type HubElementStyle } from '@/lib/element-style';
import {
  HUB_CANVAS_LOOK_KEYS,
  HUB_ELEMENT_PRO_FIELDS,
  HUB_LOOK_EVENT_COLUMNS,
  combineChanges,
  galleryChange,
  lookWriteAllowed,
  refChange,
  type LookChange,
} from '@/lib/hub-look-pro';
import { parseRsvpBackdropConfig } from '@/lib/spatial-backdrop';
import { siteMediaServeRef, siteMediaServeRefs } from '@/lib/site-media-ref';
import { QR_STYLE_PREF_KEY, qrStyleFromPreferences, sanitizeQrStyle } from '@/lib/qr-look';
import {
  classifyPostEventDraft,
  postEventItemLabel,
  sanitizePostEventDraft,
  sceneLooksChange,
  sceneLooksFreePart,
  postEventArrangementOf,
  type PostEventApplyItem,
  type PostEventDraft,
} from '@/lib/post-event-draft';
import { REVEAL_TEMPLATE_IDS } from '@/lib/reveal-config-pure';
import { REVEAL_NONE, revealTemplateWriteAllowed } from '@/lib/reveal-access';
import { sanitizeStudioConfig, sanitizeStudioSvg } from '@/lib/monogram-studio-shared';
import { resolveRevealStages, sanitizeRevealStages } from '@/lib/reveal-stages';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { sanitizeHubFontKey } from '@/lib/hub-fonts';
import { sanitizeMagicTraveller } from '@/lib/magic-move';
import { OMBRE_IS_PRO, encodeSiteBackground, isOmbreValue, parseSiteBackground } from '@/lib/ombre';
import { MOMENT_MAX, momentCapRefusal, readMoment, resolveMoments, type LoveStoryMoment } from '@/lib/love-story-moments';
import { sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import { resolveReturnTo } from '@/lib/editor-return';
import type { HubProEffectView } from '@/lib/hub-pro-effects';
import { INVITE_THEMES, isInviteThemeId, normalizeThemeId } from '@/lib/invite-themes';
import { cleanDisplayName, cleanPersonName } from '@/lib/typed-names';
import { NAME_STYLES, nameStyleOfPrintDetails } from '@/lib/name-style';
import type { DateClash } from '@/lib/date-fits-booked';

/** The form field that sends an existing Event Hub writer's save to the draft. */
export const HUB_DRAFT_FIELD = 'draft';

/** How many earlier states Undo can walk back through — at most; see the byte budget. */
export const HUB_DRAFT_HISTORY_LIMIT = 10;

/**
 * 📏 THE ROW'S HARD CAP — `event_site_drafts_draft_json_check` in
 * `20271246169682_event_site_drafts.sql`: `octet_length(draft_json::text) <=
 * 200000`. A write over it is refused by Postgres, and every save after it
 * failed too (prod, 2026-09-27, the owner's own wedding).
 */
export const HUB_DRAFT_DB_BYTE_CAP = 200_000;

/**
 * 📏 THE BUDGET A DRAFT IS HELD UNDER, safely below the cap. Undo's history is
 * capped by COUNT (`HUB_DRAFT_HISTORY_LIMIT`), but every entry is a FULL state —
 * with a traced Logo that is ~24 KB a save (the studio layers plus the composed
 * SVG), so 7 Logo edits filled 168 KB of history and the next save hit the cap.
 * The oldest states are dropped until the whole draft fits this budget. The
 * 20 KB of headroom covers what `hubDraftBytes` cannot see exactly (Postgres
 * prints some numbers longer than JavaScript does).
 */
export const HUB_DRAFT_BYTE_BUDGET = 180_000;

/** What a couple reads when the draft itself — with no Undo history at all — will not fit. */
export const HUB_DRAFT_TOO_LARGE_MESSAGE = 'Your Event Hub is too large to save — remove a layer or an image.';

/** What a couple reads when a draft save failed for any other reason. Nothing they drafted is lost. */
export const HUB_DRAFT_SAVE_FAILED_MESSAGE = 'Something went wrong. Please try again — your draft is kept.';

/** Why a draft save did not land — carried back to the Maker as `?draft_error=`. */
export type HubDraftSaveFailure = 'too_large' | 'failed';

export function hubDraftSaveFailureText(v: unknown): string | null {
  return v === 'too_large' ? HUB_DRAFT_TOO_LARGE_MESSAGE : v === 'failed' ? HUB_DRAFT_SAVE_FAILED_MESSAGE : null;
}

/** Thrown by the store when a draft would not fit even with its history emptied. Nothing is written. */
export class HubDraftTooLargeError extends Error {
  readonly reason = 'too_large' as const;
  readonly bytes: number;
  constructor(bytes: number) {
    // A log line, never shown to a couple (they read HUB_DRAFT_TOO_LARGE_MESSAGE); the size rides on `.bytes`.
    super('The Event Hub draft is over its byte budget even with no Undo history.');
    this.name = 'HubDraftTooLargeError';
    this.bytes = bytes;
  }
}

/**
 * The bytes Postgres will count for `octet_length(value::jsonb::text)`: UTF-8
 * bytes — never `string.length`, which counts UTF-16 units — of the JSON, plus
 * the one space jsonb's text form prints after every `:` and `,`
 * (`{"a": 1, "b": 2}`). One pass over `JSON.stringify`, no allocation.
 */
export function hubDraftBytes(value: unknown): number {
  const s = JSON.stringify(value);
  if (s === undefined) return 0;
  let bytes = 0;
  let inString = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (inString) {
      if (c === 0x5c) {
        bytes += 2; // a backslash escape is two ASCII bytes (\uXXXX's four digits are counted as they come)
        i += 1;
        continue;
      }
      if (c === 0x22) inString = false;
    } else if (c === 0x22) {
      inString = true;
    } else if (c === 0x3a || c === 0x2c) {
      bytes += 1; // jsonb::text prints ": " and ", "
    }
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      bytes += 4; // a surrogate pair is one 4-byte code point
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Drop the OLDEST Undo states until the whole draft fits `HUB_DRAFT_BYTE_BUDGET`.
 * The current state is never touched. Returns the same object when it already
 * fits. A draft that does not fit even with no history is returned with none —
 * the store then refuses to write it (`HubDraftTooLargeError`).
 */
export function fitHubDraftHistory(draft: HubDraft): HubDraft {
  const base = hubDraftBytes({ ...draft, history: [] });
  const sizes = draft.history.map(hubDraftBytes);
  // `[a, b, c]` adds each entry plus ", " (2 bytes) between neighbours.
  let total = base + sizes.reduce((a, b) => a + b, 0) + 2 * Math.max(0, sizes.length - 1);
  let drop = 0;
  while (drop < sizes.length && total > HUB_DRAFT_BYTE_BUDGET) {
    total -= sizes[drop]! + (sizes.length - drop > 1 ? 2 : 0);
    drop += 1;
  }
  return drop === 0 ? draft : { ...draft, history: draft.history.slice(drop) };
}

/**
 * The draft exactly as it may be written: fitted to the budget, or REFUSED —
 * `HubDraftTooLargeError` when the current state alone is over it. The store's
 * one write door (`writeHubDraft`) calls this before it touches the row, so an
 * oversized draft is never sent to Postgres to be refused there.
 */
export function hubDraftForWrite(draft: HubDraft): HubDraft {
  const fitted = fitHubDraftHistory(draft);
  const bytes = hubDraftBytes(fitted);
  if (bytes > HUB_DRAFT_BYTE_BUDGET) throw new HubDraftTooLargeError(bytes);
  return fitted;
}

/** Why a draft write failed, as the one word the Maker reads back (`?draft_error=`). */
export function hubDraftSaveFailure(e: unknown): HubDraftSaveFailure {
  return e instanceof HubDraftTooLargeError ? 'too_large' : 'failed';
}

/**
 * Where a form's draft save that did NOT land sends the couple: the form's own
 * `return_to` (validated by `resolveReturnTo`, else `fallback`) with
 * `draft_error=<reason>` on it — read by the Maker toolbar (`launch/page.tsx` →
 * `HubDraftDock` → `HubDraftToolbar`), which puts it into words.
 */
export function hubDraftBounceHref(formData: FormData, fallback: string, reason: HubDraftSaveFailure): string {
  const to = resolveReturnTo(formData, fallback);
  return `${to}${to.includes('?') ? '&' : '?'}draft_error=${reason}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE SHAPE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The `events` columns a draft may hold. See the file note for why only these.
 *
 * 🧩 MAKER PHASE 6 — THE MADE-ONCE GROUP joins, each because the host's preview
 * CAN show it (`app/[slug]/page.tsx` overlays the draft on the event row BEFORE
 * `loadMedia` and the reveal mount read it):
 *   · `landing_page_hero_image_url` — the ONE hero (`lib/event-hero.ts`). Pro to
 *     add or change (it is in `HUB_LOOK_EVENT_COLUMNS`); removing is free.
 *   · `std_reveal_template` — the reveal. "No reveal" is free; every opening is
 *     Pro (`revealTemplateWriteAllowed`, owner 2026-09-24 "all reveal is paid").
 *   · `monogram_custom_svg` + `monogram_studio_config` — the Logo, autosaved
 *     from the studio so a design is never lost by leaving (owner 2026-09-25,
 *     FINAL_PLAN_INPUTS 29). Letters, frame and ink are free.
 *   · `reveal_stages` — WHERE the reveal plays (owner 2026-09-25, "they can pick
 *     where the want to keep it"): Save the Date · Invitation · On the Day,
 *     sanitised by `sanitizeRevealStages`. Free to choose — the opening itself is
 *     the Pro part. The host's preview reads it off the overlaid event row.
 *   · `std_reveal_effects` — the reveal's FINE-TUNING from the Maker's Reveal
 *     page (owner 2026-09-25: *"pick a reveal and see the effects, fine tune it
 *     to your liking"*): butterflies, falling petals, the veil's and the petals'
 *     colours — `resolveRevealEffects`, the guest render's own parser. Changing
 *     any of them is Pro at Apply (`revealEffectsWriteAllowed`, the Save-the-Date
 *     studio's own rule); the film's `music` switch is not the Maker's and Apply
 *     keeps the live one (`hub-draft-actions.ts`).
 */
/**
 * The Colors panel's five columns — `updateSiteColors`, all of it — and the
 * THEME (owner 2026-09-28, "THE THEME PICKER MOVES INTO THE MAKER'S DETAILS"):
 * `invite_theme`, picked on the Maker's Details page (`maker-theme-picker.tsx`)
 * and drafted like every other Maker edit, with Undo. The host canvas re-wears
 * the look from the overlaid row whenever the draft holds any of these, so a
 * picked theme is seen on the canvas before Apply.
 *
 * ⚠ `invite_theme` HAS NO SESSION UPDATE GRANT (20271219583821: its only writer
 * goes through the admin client after the host check and the Pro re-check), so
 * Apply writes it on its own, through that same shape — never inside the
 * session `events` UPDATE, which would refuse the whole patch.
 */
export const HUB_DRAFT_LOOK_COLUMNS = [
  'site_bg_color',
  'site_button_color',
  'site_art_direction',
  'site_font_key',
  'site_magic_traveller',
  'invite_theme',
] as const;

/**
 * The words the Maker edits: Text (special message · what to bring), Our story
 * + Our Love Story's moments (`love_story`, and `together_since`, which
 * `updateOurStory` dual-stores beside it), Dress code and Camera cues.
 */
export const HUB_DRAFT_WORDS_COLUMNS = [
  'special_message',
  'what_to_bring',
  'love_story',
  'together_since',
  'dress_code_config',
  'photo_moments_config',
] as const;

/**
 * 💎 TRY-THEN-PAY REACHES THE LAST THREE PRO TOOLS (owner 2026-09-29, verbatim:
 * *"yes to all 3, do the follow-up"* — DECISION_LOG "TRY-THEN-PAY REACHES THE
 * LAST THREE PRO TOOLS…"). Each used to save LIVE and send a couple without
 * Pro to the buy page; now each is drafted, drawn on the host's canvas and
 * named on the Apply sheet, and Apply writes it only with Event Hub Pro:
 *
 *   · background music + the hero video (`updateSiteChrome`) —
 *     `site_bg_music_r2_key` · `site_bg_music_enabled` ·
 *     `landing_page_hero_video_r2_key`;
 *   · the couple's own gallery (`updateOurPhotos`) — `our_photos`;
 *   · the QR's look (`updateQrStyle`) — `style_preferences`, drafted as
 *     `{ qr }` ONLY: the blob's other keys (onboarding answers) are never
 *     drafted, never overlaid away and never written by Apply, which MERGES
 *     the drafted `qr` into the live blob (`hub-draft-actions.ts`).
 */
export const HUB_DRAFT_MEDIA_COLUMNS = [
  'site_bg_music_r2_key',
  'site_bg_music_enabled',
  'landing_page_hero_video_r2_key',
  'our_photos',
  'style_preferences',
] as const;

/** The gallery's size — `updateOurPhotos`' own cap. */
export const HUB_DRAFT_GALLERY_MAX = 24;

/**
 * ✍ THE NAMES AND THE DATE TYPED IN THE MAKER (owner 2026-10-01, verbatim
 * *"wait for apply"* — DECISION_LOG "ELEVEN OWNER ANSWERS" #1). Typed on the
 * hero (tap-to-type, the `names` part) or in Details › Your event, each is a
 * DRAFT until Apply like every Maker edit. They join because the host's
 * preview CAN show them (`app/[slug]/page.tsx` overlays the whole drafted row
 * before the masthead reads `display_name` and `event_date`):
 *
 *   · `display_name` — the page's names: the hero, every print and every pass;
 *   · `bride_name` · `groom_name` — the two people's "First Last", drafted by
 *     Details' Names editor through `coupleNameColumns` (lib/typed-names.ts),
 *     the composition `updateEventMatchCriteria` writes live;
 *   · `event_date` · `event_date_precision` — `updateEventDate`'s two columns.
 *     Apply re-asks that writer's gates (`eventDateRefusal`, lib/events.ts):
 *     never a past date, and a booked supplier's date never moves — a refused
 *     date STAYS in the draft, said by name.
 *
 * Never Pro. Each is also a fact other screens read (Home, the dashboard, a
 * supplier's calendar) — and those keep reading the LIVE row until Apply, which
 * is the point. The list stays narrow: venues, the programme's times, the
 * march and the people are NOT here (each has its own writer and its own rule).
 *
 * 🔤 …and (2026-10-01, "in event hub maker will only take effect when pressed
 * apply") the NAME STYLE — Full · Middle initial · Surname first — picked in the
 * names' Wording ▾ or Details' Name style ▾:
 *
 *   · `print_details` — the event's settings JSON (`lib/print-pieces.ts`), but
 *     the draft holds ONE KEY of it: `{ name_style }`, and nothing else. The
 *     blob's other keys (the opening line, the menu, the pass card look, the
 *     poster photo) are the prints' own and are never drafted, never overlaid
 *     away and never written by Apply, which MERGES the drafted style into the
 *     blob as it stands at write time (`hub-draft-actions.ts`) — the same
 *     posture as `style_preferences` drafted as `{ qr }` only.
 */
export const HUB_DRAFT_FACT_COLUMNS = [
  'display_name',
  'bride_name',
  'groom_name',
  'event_date',
  'event_date_precision',
  'print_details',
] as const;

/**
 * 📍 THE VENUES TYPED IN THE MAKER (owner 2026-10-01, DECISION_LOG "THE MAKER'S
 * VENUES GET A REAL PIN AND A PICKED CITY" + "NOTHING TAKES EFFECT UNTIL
 * APPLY"; design approved 2026-10-04): Details › Venues' "Enter your own" —
 * each venue's typed name, street address and map pin, and the ONE city or
 * area per event (the reception's, a closed pick from the onboarding list —
 * `hubDraftAction` refuses a name that is not on it). The columns
 * `saveAllStdContent` wrote live until now, plus the ceremony's own pin
 * (20271263730696). The reception's pin IS `venue_latitude/longitude`, the
 * event's distance + coverage anchor, so Apply refreshes it. Never Pro.
 */
export const HUB_DRAFT_VENUE_COLUMNS = [
  'std_film_ceremony_name',
  'ceremony_venue_address',
  'ceremony_venue_latitude',
  'ceremony_venue_longitude',
  'std_film_venue_name',
  'venue_address',
  'venue_latitude',
  'venue_longitude',
  'std_film_venue_city',
] as const;

/**
 * 🕒 THE CEREMONY TIME, typed under the Date (owner 2026-10-04, "YES TO ALL").
 * NOT an `events` column: it is the Ceremony schedule block's start, `HH:MM` on
 * the venue's wall clock — the very block the invitation prints
 * (`ceremonyBlock` · `blockTime`, lib/print-pieces.ts). Apply creates that block
 * on the event's day if there is none, else moves its time
 * (`placeCeremonyBlock`, lib/ceremony-time.server.ts); the live value is read
 * from the block (`readHubLiveState`). It never reaches an `events` UPDATE.
 */
export const HUB_DRAFT_CEREMONY_TIME = 'ceremony_time' as const;

/**
 * 🗂 THE ONBOARDING'S LAST ANSWERS (owner 2026-10-02, DECISION_LOG "EVERY ANSWER
 * ABOUT AN EVENT LIVES IN EVENT DETAILS ("YOUR INFO") — ONE HOME, MAPPED"):
 * Photos from guests · Gifts · Do you want a logo? · Event photo — each its
 * own boolean column (`lib/event-answers.ts`), changed in Your info and, like
 * every Maker edit, a DRAFT until Apply. Never Pro: an answer is not a look.
 * Apply writes them through the session UPDATE (each column holds an UPDATE
 * grant for `authenticated`, migration 20271260666366), and turning Papic ON
 * arms its free grants there (`hub-draft-actions.ts`).
 */
export const HUB_DRAFT_ANSWER_COLUMNS = ['papic_on', 'gifts_on', 'logo_wanted', 'cover_photo_wanted'] as const;

/** The one key of `print_details` a draft may hold. */
export const HUB_DRAFT_PRINT_DETAILS_KEY = 'name_style';

/**
 * Apply counts a fact ONCE however many columns carry it (the prototype, frame
 * B: *"Apply counts it once"*) — the names are three columns, the date two.
 */
export const HUB_DRAFT_FACT_GROUP: Readonly<
  Record<(typeof HUB_DRAFT_FACT_COLUMNS)[number] | (typeof HUB_DRAFT_VENUE_COLUMNS)[number] | typeof HUB_DRAFT_CEREMONY_TIME, HubDraftFact>
> = {
  display_name: 'names',
  bride_name: 'names',
  groom_name: 'names',
  event_date: 'date',
  event_date_precision: 'date',
  print_details: 'name-style',
  // 📍 The venues are ONE change however many of their nine columns moved.
  ...(Object.fromEntries(HUB_DRAFT_VENUE_COLUMNS.map((c) => [c, 'venues'])) as Record<(typeof HUB_DRAFT_VENUE_COLUMNS)[number], 'venues'>),
  ceremony_time: 'ceremony-time',
};

/** The typed facts a draft counts once each: the names, the date, the name style, the venues, the ceremony time. */
export type HubDraftFact = 'names' | 'date' | 'name-style' | 'venues' | 'ceremony-time';

export const HUB_DRAFT_EVENT_COLUMNS = [
  'rsvp_backdrop',
  'landing_page_hero_image_url',
  'std_reveal_template',
  'monogram_custom_svg',
  'monogram_studio_config',
  // ⚙ WHAT DO YOU WANT TO ASK YOUR GUESTS? (owner 2026-09-25) — which of the
  // RSVP form's own questions this couple still asks. A fact about the day,
  // never Pro (HUB_WORDS_EVENT_COLUMNS) — see lib/rsvp-ask.ts for the shape.
  'rsvp_ask_config',
  'reveal_stages',
  'std_reveal_effects',
  // 🎨 THE COLOURS AND FACE (the Maker's Colors panel · `updateSiteColors`).
  // Painted by `app/[slug]/layout.tsx`, which cannot see `?editor=1` — so the
  // host canvas re-wears the look from the OVERLAID row inside the page
  // (`HostDraftLook`, `app/[slug]/page.tsx`). The background colour is free;
  // the other four are Pro (`HUB_LOOK_EVENT_COLUMNS`), tried here, paid at Apply.
  ...HUB_DRAFT_LOOK_COLUMNS,
  // ✍ THE COUPLE'S WORDS (`HUB_WORDS_EVENT_COLUMNS` — never gated, except the
  // Love Story's moment cap, which Apply re-asks). The guest page reads every
  // one of them from the event row the host canvas already overlays.
  ...HUB_DRAFT_WORDS_COLUMNS,
  // 💎 THE LAST THREE PRO TOOLS, TRIED FREE (owner 2026-09-29: "yes to all 3").
  ...HUB_DRAFT_MEDIA_COLUMNS,
  // ✍ THE NAMES AND THE DATE TYPED IN THE MAKER (owner 2026-10-01: "wait for apply").
  ...HUB_DRAFT_FACT_COLUMNS,
  // 🗂 THE ONBOARDING'S LAST ANSWERS, CHANGED IN YOUR INFO (owner 2026-10-02).
  ...HUB_DRAFT_ANSWER_COLUMNS,
  // 📍 THE VENUES AND 🕒 THE CEREMONY TIME TYPED IN THE MAKER (owner 2026-10-04).
  ...HUB_DRAFT_VENUE_COLUMNS,
  HUB_DRAFT_CEREMONY_TIME,
] as const;

/** The draft's `events` keys that ARE `events` columns — what a live read selects. */
export const HUB_DRAFT_EVENT_READ_COLUMNS = HUB_DRAFT_EVENT_COLUMNS.filter((c) => c !== HUB_DRAFT_CEREMONY_TIME);

/** The largest logo a draft accepts — `saveStudioAction`'s own cap. */
export const HUB_DRAFT_LOGO_MAX_BYTES = 400_000;
export type HubDraftEventColumn = (typeof HUB_DRAFT_EVENT_COLUMNS)[number];

export function isHubDraftEventColumn(v: unknown): v is HubDraftEventColumn {
  return typeof v === 'string' && (HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(v);
}

export const HUB_SECTION_MODES = ['auto', 'shown', 'hidden'] as const;
export type HubSectionMode = (typeof HUB_SECTION_MODES)[number];

export type HubDraftEvents = Partial<Record<HubDraftEventColumn, unknown>>;

export type HubDraftWidget = {
  mode?: HubSectionMode;
  /** The eye (`toggleWidgetVisibility`). Never Pro — show and hide are the page we write. */
  is_visible?: boolean;
  display_order?: number;
  /** The section's whole canvas, or `null` to take it off. */
  canvas?: HubSectionCanvas | null;
  /**
   * HERO ROW ONLY — the Main background (Maker Phase 10), or `null` to go back
   * to the theme's own. Replaced whole, like the canvas. Dropped on any other
   * section: the page has one Main background, and a second home for it would
   * be a second source of truth.
   */
  main?: HubMainGround | null;
  /**
   * ↕ This section's place on each stage (owner 2026-09-27, "EVERY SCENE DRAGS
   * WITHIN ITS STAGE"), kept at `config_json.stage_order` (`lib/stage-scenes.ts`).
   * Merged stage by stage; `null` for a stage = back to the stage's default.
   * Never Pro — arranging is the page we write.
   */
  stage_order?: Partial<Record<LifecyclePhase, number | null>>;
  /**
   * 🎞 `our_photos` ROW ONLY — what leads the Save the Date, Film or Photos
   * (same ruling), kept at `config_json.std_lead`; `null` = back to the
   * default. Dropped on any other section: one home for one choice. Never Pro.
   */
  std_lead?: StdLead | null;
  /**
   * ✍ A SCENE OF THEIR OWN — its heading and words (`config_json.custom`),
   * `custom_*` rows ONLY. Drafted from the Maker when the scene has nothing in
   * it live (owner 2026-09-29, "yes to all 3": an empty scene of their own takes
   * new words into the draft instead of a live save that demands Pro). Starting
   * to fill an EMPTY scene is Pro at Apply (`customSectionWriteAllowed`'s own
   * line); editing words a scene already has is free.
   */
  custom?: CustomSectionContent | null;
  /**
   * 🏛 `venue_map` ROW ONLY — each venue card's source and photo
   * (`config_json.venue`, lib/event-venues.ts `VenueChoice`), drafted with the
   * venues' words and pins (owner 2026-10-04). Merged slot by slot. Apply
   * re-reads it through `readVenueChoices` (this event's own photos only).
   */
  venue?: HubDraftVenueChoices;
};

/** The Venue scene's per-card choices as the draft holds them (shape only — the event is checked at Apply). */
export type HubDraftVenueChoice = { source?: 'supplier' | 'own'; supplierPhoto?: string | null; ownPhoto?: string | null };
export type HubDraftVenueChoices = Partial<Record<'ceremony' | 'reception', HubDraftVenueChoice>>;

/** A stored or posted `config_json.venue` bag → its shape, refs `r2://` only (the event is checked at Apply). */
export function draftVenueChoices(raw: unknown): HubDraftVenueChoices {
  const out: HubDraftVenueChoices = {};
  if (!isPlainObject(raw)) return out;
  const ref = (v: unknown) => (typeof v === 'string' && v.startsWith('r2://') && v.length <= 512 && !v.includes('..') ? v : undefined);
  for (const key of ['ceremony', 'reception'] as const) {
    const r = raw[key];
    if (!isPlainObject(r)) continue;
    const c: HubDraftVenueChoice = {};
    if (r.source === 'supplier' || r.source === 'own') c.source = r.source;
    if (r.supplierPhoto === null || ref(r.supplierPhoto)) c.supplierPhoto = (r.supplierPhoto as string | null);
    if (r.ownPhoto === null || ref(r.ownPhoto)) c.ownPhoto = (r.ownPhoto as string | null);
    if (Object.keys(c).length) out[key] = c;
  }
  return out;
}

export type HubDraftState = {
  events: HubDraftEvents;
  widgets: Partial<Record<WidgetType, HubDraftWidget>>;
  /**
   * 📖 POST EVENT'S SCENES (owner 2026-09-25 "POST EVENT IS MANY SMALL SCENES",
   * 2026-09-29 "EVERY STYLE OF EVERY SCENE SHIPS") — a drafted copy of the
   * story's own keys on `event_editorial.draft_json` (`sections`,
   * `sectionOrder`, `sceneLooks`), each present only when the couple changed
   * it in the Maker. Not a second source: Apply writes them back into the
   * story's row (`lib/post-event-draft.ts`). Absent = nothing drafted.
   */
  editorial?: PostEventDraft;
  /**
   * 🎨 THE FIVE FIXED PARTS' STYLE PICKS (owner 2026-09-29, "EVERY SCENE … AT
   * LEAST THREE PREMADE STYLES") — the entourage, Find your seat, each guest's
   * own photos, the announcements and the live hub have no section row, so
   * their pick is drafted here and Apply writes it into
   * `events.style_preferences.scene_styles` (`lib/fixed-scene-styles.ts`).
   * `null` = back to the default. Never Pro. Absent = nothing drafted.
   */
  fixedStyles?: FixedSceneStylesDraft;
};

export type HubDraft = HubDraftState & {
  v: 1;
  /** Earlier states, newest LAST. Undo pops. */
  history: HubDraftState[];
};

export function emptyHubDraft(): HubDraft {
  return { v: 1, events: {}, widgets: {}, history: [] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SANITISING — every read and every write goes through here
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * One draft value for one column, through the SAME parser that column's live
 * writer uses. `undefined` = unusable, drop the key. `null` = clear the column.
 */
export function sanitizeHubDraftEventValue(
  column: HubDraftEventColumn,
  raw: unknown,
): unknown | undefined {
  // A page is never nameless, a date always says how precise it is, and a
  // ceremony time is moved, never erased, from here.
  if (raw === null) return column === 'display_name' || column === 'event_date_precision' || column === 'ceremony_time' ? undefined : null;
  switch (column) {
    case 'rsvp_backdrop':
      return parseRsvpBackdropConfig(raw) ?? undefined;
    case 'landing_page_hero_image_url': {
      // `uploadHeroPhoto`'s own rule (an `r2://` ref) AND the guest render's
      // (`siteMediaServeRef`: the one public bucket) — a private ref never lands.
      if (typeof raw !== 'string' || !raw.startsWith('r2://')) return undefined;
      return siteMediaServeRef(raw) === raw ? raw : undefined;
    }
    case 'std_reveal_template':
      return raw === REVEAL_NONE || (typeof raw === 'string' && (REVEAL_TEMPLATE_IDS as readonly string[]).includes(raw))
        ? raw
        : undefined;
    case 'monogram_custom_svg':
      if (typeof raw !== 'string' || raw.length > HUB_DRAFT_LOGO_MAX_BYTES) return undefined;
      return sanitizeStudioSvg(raw) ?? undefined;
    case 'monogram_studio_config':
      return sanitizeStudioConfig(raw) ?? undefined;
    case 'reveal_stages':
      return sanitizeRevealStages(raw);
    case 'std_reveal_effects':
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? resolveRevealEffects(raw) : undefined;
    // 🎨 `updateSiteColors`' own parses — a malformed value is dropped, never repaired.
    case 'site_bg_color': {
      // 🌈 Plain hex OR an encoded ombré (`lib/ombre.ts`) — the ONE reader of
      // the column's two shapes, so the draft holds exactly what the live
      // writer would have written.
      const bg = parseSiteBackground(raw);
      return bg ? encodeSiteBackground(bg) : undefined;
    }
    case 'site_button_color':
      return typeof raw === 'string' && HEX6.test(raw.trim()) ? raw.trim().toLowerCase() : undefined;
    case 'site_art_direction':
      return raw === 'candlelight' || raw === 'daylight' ? raw : undefined;
    case 'site_font_key':
      return sanitizeHubFontKey(raw) ?? undefined;
    case 'site_magic_traveller':
      return sanitizeMagicTraveller(raw) ?? undefined;
    // 🎨 The theme — only a live id of a SHIPPED theme (`setInviteTheme`'s old
    // rule: `isInviteThemeId` + `ready`). A retired alias is never written.
    case 'invite_theme':
      return isInviteThemeId(raw) && INVITE_THEMES[raw].ready ? raw : undefined;
    // ✍ Words: the writers' own caps (trimmed; '' is "clear" → null).
    case 'special_message':
    case 'what_to_bring':
      return draftText(raw, HUB_DRAFT_TEXT_MAX);
    case 'together_since':
      return draftText(raw, 120);
    case 'love_story':
      return sanitizeDraftLoveStory(raw);
    case 'dress_code_config':
    case 'photo_moments_config':
      // The guest render parses both through its own readers; the draft only
      // holds them to a plain object of a sane size (the live writer is the
      // one the host could already call with the same shape).
      return isPlainObject(raw) && JSON.stringify(raw).length <= HUB_DRAFT_CONFIG_MAX_CHARS ? raw : undefined;
    // 💎 The last three Pro tools — each through its live writer's own rule.
    case 'site_bg_music_r2_key':
    case 'landing_page_hero_video_r2_key': {
      // An `r2://` ref in the ONE public bucket (`siteMediaServeRef`) — which
      // event's folder it sits in is asked at Apply, where the event is known.
      if (typeof raw !== 'string' || !raw.startsWith('r2://')) return undefined;
      return siteMediaServeRef(raw) === raw ? raw : undefined;
    }
    case 'site_bg_music_enabled':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'our_photos': {
      if (!Array.isArray(raw)) return undefined;
      const refs = raw.filter((r): r is string => typeof r === 'string' && r.startsWith('r2://') && siteMediaServeRef(r) === r);
      return [...new Set(refs)].slice(0, HUB_DRAFT_GALLERY_MAX);
    }
    case 'style_preferences': {
      // ONLY the QR's look — never another key of the blob.
      if (!isPlainObject(raw)) return undefined;
      return { [QR_STYLE_PREF_KEY]: sanitizeQrStyle(raw[QR_STYLE_PREF_KEY]) };
    }
    // 🗂 An answer is a yes or a no (null = back to "not asked"); anything else is dropped.
    case 'papic_on':
    case 'gifts_on':
    case 'logo_wanted':
    case 'cover_photo_wanted':
      return typeof raw === 'boolean' ? raw : undefined;
    // ⚙ WHAT DO YOU WANT TO ASK YOUR GUESTS? — through the SAME sanitizer the
    // guest render and `submitRsvp` read: unknown keys and non-boolean values
    // are dropped rather than repaired, exactly like every config above.
    case 'rsvp_ask_config':
      return isPlainObject(raw) ? sanitizeRsvpAskConfig(raw) : undefined;
    // ✍ The names and the date — through the writers' own rules
    // (`lib/typed-names.ts`; `updateEventDate`'s YYYY-MM-DD and its three
    // precisions). Whether a date may be WRITTEN (past, a booked supplier) is
    // Apply's question, asked against live — never dropped here, so a draft
    // that ages past its date is said at Apply, not silently lost.
    // 📍 The venues — `saveAllStdContent`'s own bounds (trimmed; '' clears).
    case 'std_film_ceremony_name':
    case 'std_film_venue_name':
      return draftText(raw, 160);
    case 'ceremony_venue_address':
    case 'venue_address':
      return draftText(raw, 300);
    case 'std_film_venue_city':
      return draftText(raw, 80);
    case 'ceremony_venue_latitude':
    case 'venue_latitude':
      return draftCoord(raw, 90);
    case 'ceremony_venue_longitude':
    case 'venue_longitude':
      return draftCoord(raw, 180);
    // 🕒 A wall-clock HH:MM; there is no "clear" (null was dropped above).
    case 'ceremony_time':
      return typeof raw === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : undefined;
    case 'display_name':
      return cleanDisplayName(raw) ?? undefined;
    case 'bride_name':
    case 'groom_name':
      return cleanPersonName(raw);
    case 'event_date':
      return isCalendarDay(raw) ? raw : undefined;
    case 'event_date_precision':
      return raw === 'year' || raw === 'month' || raw === 'day' ? raw : undefined;
    // 🔤 The Name style — ONLY that key of `print_details`, and only one of the
    // three styles (`NAME_STYLES`); anything else is dropped, never repaired.
    case 'print_details': {
      if (!isPlainObject(raw)) return undefined;
      const style = raw[HUB_DRAFT_PRINT_DETAILS_KEY];
      return typeof style === 'string' && (NAME_STYLES as readonly string[]).includes(style)
        ? { [HUB_DRAFT_PRINT_DETAILS_KEY]: style }
        : undefined;
    }
  }
}

/** A map coordinate within ±`max`, to the column's 7 decimals. */
function draftCoord(raw: unknown, max: number): number | undefined {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1e7) / 1e7 : undefined;
}

/** A real day written YYYY-MM-DD (never "2027-02-30"). */
function isCalendarDay(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [y, m, d] = raw.split('-').map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** `updateSpecialMessage` / `updateWhatToBring` cap each at 600 characters. */
export const HUB_DRAFT_TEXT_MAX = 600;

/** The largest words blob (dress code, camera cues, the Love Story) a draft holds. */
export const HUB_DRAFT_CONFIG_MAX_CHARS = 200_000;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function draftText(raw: unknown, max: number): string | null | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * `events.love_story` for the draft: a plain object, its moments (when it has
 * them) each through `readMoment` — the fence every guest read already passes
 * (public-bucket photo refs, capped lines) — and no more than `MOMENT_MAX`.
 */
function sanitizeDraftLoveStory(raw: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(raw) || JSON.stringify(raw).length > HUB_DRAFT_CONFIG_MAX_CHARS) return undefined;
  if (!('moments' in raw)) return raw;
  const list = Array.isArray(raw.moments) ? raw.moments : [];
  const moments = list
    .map((m) => readMoment(m))
    .filter((m): m is LoveStoryMoment => m !== null)
    .slice(0, MOMENT_MAX);
  return { ...raw, moments };
}

function sanitizeWidget(raw: unknown, type: WidgetType): HubDraftWidget | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: HubDraftWidget = {};
  if (typeof src.mode === 'string' && (HUB_SECTION_MODES as readonly string[]).includes(src.mode)) {
    out.mode = src.mode as HubSectionMode;
  }
  if (typeof src.is_visible === 'boolean') out.is_visible = src.is_visible;
  if (
    typeof src.display_order === 'number' &&
    Number.isInteger(src.display_order) &&
    src.display_order >= 0 &&
    src.display_order <= 10_000
  ) {
    out.display_order = src.display_order;
  }
  if (src.canvas === null) out.canvas = null;
  else if (src.canvas && typeof src.canvas === 'object' && !Array.isArray(src.canvas)) {
    // `sanitizeHubCanvas` reads either `{canvas:{…}}` or the canvas itself; a
    // stored draft canvas is always the bare canvas, so hand it the bare one.
    out.canvas = sanitizeHubCanvas({ canvas: src.canvas });
  }
  if (type === 'hero' && 'main' in src) {
    if (src.main === null) out.main = null;
    else {
      const main = sanitizeHubMainGround(src.main);
      if (main) out.main = main;
    }
  }
  const places = sanitizeStageOrder(src.stage_order);
  if (places) out.stage_order = places;
  if (isCustomSectionType(type) && 'custom' in src) {
    if (src.custom === null) out.custom = null;
    else if (isPlainObject(src.custom)) {
      const words = readCustomSectionInput(src.custom.title, src.custom.body);
      if (words.ok) out.custom = words.value;
    }
  }
  if (type === 'venue_map' && isPlainObject(src.venue)) {
    const venue = draftVenueChoices(src.venue);
    if (Object.keys(venue).length) out.venue = venue;
  }
  if (type === 'our_photos' && 'std_lead' in src) {
    if (src.std_lead === null) out.std_lead = null;
    else {
      const lead = sanitizeStdLead(src.std_lead);
      if (lead) out.std_lead = lead;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeState(raw: unknown): HubDraftState {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const events: HubDraftEvents = {};
  const rawEvents = src.events && typeof src.events === 'object' && !Array.isArray(src.events)
    ? (src.events as Record<string, unknown>)
    : {};
  for (const col of HUB_DRAFT_EVENT_COLUMNS) {
    if (!(col in rawEvents)) continue;
    const v = sanitizeHubDraftEventValue(col, rawEvents[col]);
    if (v !== undefined) events[col] = v;
  }
  const widgets: HubDraftState['widgets'] = {};
  const rawWidgets = src.widgets && typeof src.widgets === 'object' && !Array.isArray(src.widgets)
    ? (src.widgets as Record<string, unknown>)
    : {};
  for (const [type, value] of Object.entries(rawWidgets)) {
    if (!isWidgetType(type)) continue;
    const w = sanitizeWidget(value, type);
    if (w) widgets[type] = w;
  }
  // 📖 Post Event's scenes — through the story's own readers (`post-event-draft.ts`).
  const editorial = sanitizePostEventDraft(src.editorial);
  // 🎨 The fixed parts' style picks — through their own reader.
  const fixedStyles = sanitizeFixedSceneStylesDraft(src.fixedStyles);
  return {
    events,
    widgets,
    ...(editorial ? { editorial } : {}),
    ...(fixedStyles ? { fixedStyles } : {}),
  };
}

/** Anything → a well-formed draft. Unknown keys and unusable values are dropped. */
export function sanitizeHubDraft(raw: unknown): HubDraft {
  const state = sanitizeState(raw);
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const history = Array.isArray(src.history)
    ? src.history.slice(-HUB_DRAFT_HISTORY_LIMIT).map(sanitizeState)
    : [];
  return fitHubDraftHistory({ v: 1, ...state, history });
}

/** Does the draft differ from nothing? (Whether it differs from LIVE is `planHubDraftApply`.) */
export function hubDraftHasChanges(d: HubDraftState): boolean {
  return (
    Object.keys(d.events).length > 0 ||
    Object.keys(d.widgets).length > 0 ||
    Object.keys(d.editorial ?? {}).length > 0 ||
    Object.keys(d.fixedStyles ?? {}).length > 0
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SAVE · UNDO
   ═══════════════════════════════════════════════════════════════════════════ */

/** A patch as a writer sends it — the same shape as a state, every part optional. */
export type HubDraftPatch = {
  events?: HubDraftEvents;
  widgets?: Partial<Record<WidgetType, HubDraftWidget>>;
  /** 📖 Post Event: the story keys this save changes, each replaced whole. */
  editorial?: PostEventDraft;
  /** 🎨 The fixed parts' style picks this save changes, part by part. */
  fixedStyles?: FixedSceneStylesDraft;
};

const stateOf = (d: HubDraftState): HubDraftState => ({
  events: { ...d.events },
  widgets: Object.fromEntries(
    Object.entries(d.widgets).map(([k, v]) => [k, { ...v }]),
  ) as HubDraftState['widgets'],
  ...(d.editorial ? { editorial: { ...d.editorial } } : {}),
  ...(d.fixedStyles ? { fixedStyles: { ...d.fixedStyles } } : {}),
});

/**
 * Merge one save into the draft. The state before it goes onto the history so
 * Undo can take it back. A widget's fields merge one by one (a mode save does not
 * forget a canvas already drafted); its canvas is replaced whole, because the
 * writer that sends it has already merged the canvas it read.
 */
export function mergeHubDraft(current: HubDraft, patch: HubDraftPatch): HubDraft {
  const clean = sanitizeState(patch);
  const next = stateOf(current);
  for (const [col, v] of Object.entries(clean.events)) next.events[col as HubDraftEventColumn] = v;
  for (const [type, w] of Object.entries(clean.widgets)) {
    const prev = next.widgets[type as WidgetType] ?? {};
    next.widgets[type as WidgetType] = {
      ...prev,
      ...w,
      // ↕ Places merge STAGE BY STAGE — a drag on one stage never forgets another's.
      ...(w.stage_order ? { stage_order: { ...(prev.stage_order ?? {}), ...w.stage_order } } : {}),
      // 🏛 …and venue cards card by card.
      ...(w.venue ? { venue: { ...(prev.venue ?? {}), ...w.venue } } : {}),
    };
  }
  // 📖 Post Event: each story key the save carries replaces the drafted one whole
  // (the Maker computes it from live-with-the-draft, so it already holds the rest).
  if (clean.editorial) next.editorial = { ...(next.editorial ?? {}), ...clean.editorial };
  // 🎨 A pick for one fixed part never forgets another's.
  if (clean.fixedStyles) next.fixedStyles = { ...(next.fixedStyles ?? {}), ...clean.fixedStyles };
  const history = [...current.history, stateOf(current)].slice(-HUB_DRAFT_HISTORY_LIMIT);
  return fitHubDraftHistory({ v: 1, ...next, history });
}

/** Step back one save. With nothing to go back to, the draft is returned as is. */
export function undoHubDraft(current: HubDraft): HubDraft {
  if (current.history.length === 0) return current;
  const history = current.history.slice(0, -1);
  const prev = current.history[current.history.length - 1]!;
  return { v: 1, ...stateOf(prev), history };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE HOST'S PREVIEW — the draft laid over the live rows
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The live event row with the draft's columns on top. A NEW object: the row the
 * guest loaders hand around is a `cache()`d value other readers share, so it is
 * never mutated.
 */
export function overlayHubDraftEvent<T extends Record<string, unknown>>(
  row: T,
  draft: HubDraftState | null,
): T {
  if (!draft) return row;
  const picks = draft.fixedStyles && Object.keys(draft.fixedStyles).length > 0 ? draft.fixedStyles : null;
  if (Object.keys(draft.events).length === 0 && !picks) return row;
  const out: Record<string, unknown> = { ...row, ...draft.events };
  /* 🔳 The drafted QR look is laid INTO the live blob — the blob's other keys
     (onboarding answers the page may read) are never overlaid away. */
  if ('style_preferences' in draft.events) {
    const live = row.style_preferences && typeof row.style_preferences === 'object' ? (row.style_preferences as Record<string, unknown>) : {};
    out.style_preferences = { ...live, ...(draft.events.style_preferences as Record<string, unknown>) };
  }
  // 🎨 The fixed parts' drafted picks ride on `style_preferences` too, every
  // other key of it kept — the host's canvas then draws the part in the picked style.
  if (picks) out.style_preferences = stylePreferencesWithDraftedStyles(out.style_preferences, picks);
  /* 🔤 The drafted Name style is laid INTO the live settings blob, every other
     key of it kept (the prints' words, menu, pass card look). */
  if ('print_details' in draft.events) {
    const live = row.print_details && typeof row.print_details === 'object' && !Array.isArray(row.print_details) ? (row.print_details as Record<string, unknown>) : {};
    out.print_details = { ...live, ...(draft.events.print_details as Record<string, unknown>) };
  }
  return out as T;
}

function configWithCanvas(config: unknown, canvas: HubSectionCanvas | null): Record<string, unknown> {
  const base =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};
  if (canvas === null) delete base.canvas;
  else base.canvas = canvas;
  return base;
}

/** `config_json` with a scene of their own's words set or taken off; every sibling key kept. */
export function configWithCustom(config: unknown, custom: CustomSectionContent | null): Record<string, unknown> {
  const base =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};
  if (custom === null) delete base.custom;
  else base.custom = custom;
  return base;
}

/** `config_json` with the Main background set or taken off; every sibling key kept. */
export function configWithMainGround(config: unknown, main: HubMainGround | null): Record<string, unknown> {
  const base =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};
  if (main === null) delete base[HUB_MAIN_GROUND_KEY];
  else base[HUB_MAIN_GROUND_KEY] = main;
  return base;
}

/** `config_json` with the drafted venue cards laid over its `venue` bag, card by card. */
export function configWithVenue(config: unknown, venue: HubDraftVenueChoices): Record<string, unknown> {
  const base = isPlainObject(config) ? { ...config } : {};
  base.venue = { ...draftVenueChoices(base.venue), ...venue };
  return base;
}

/** The live widget rows with the draft's mode / order / canvas on top (new objects). */
export function overlayHubDraftWidgets(
  rows: readonly InvitationWidgetRow[],
  draft: HubDraftState | null,
): InvitationWidgetRow[] {
  if (!draft || Object.keys(draft.widgets).length === 0) return [...rows];
  return rows.map((row) => {
    const w = draft.widgets[row.widget_type];
    if (!w) return row;
    let config: unknown = row.config_json;
    if (w.canvas !== undefined) config = configWithCanvas(config, w.canvas);
    if (w.main !== undefined && row.widget_type === 'hero') config = configWithMainGround(config, w.main);
    if (w.stage_order !== undefined) config = configWithStageOrder(config, w.stage_order);
    if (w.std_lead !== undefined && row.widget_type === 'our_photos') config = configWithStdLead(config, w.std_lead);
    if (w.custom !== undefined && isCustomSectionType(row.widget_type)) config = configWithCustom(config, w.custom);
    if (w.venue !== undefined && row.widget_type === 'venue_map') config = configWithVenue(config, w.venue);
    return {
      ...row,
      ...(w.mode !== undefined && !row.is_always_on ? { mode: w.mode } : {}),
      ...(w.is_visible !== undefined && !row.is_always_on ? { is_visible: w.is_visible } : {}),
      ...(w.display_order !== undefined && !row.is_always_on ? { display_order: w.display_order } : {}),
      ...(config !== row.config_json ? { config_json: config as InvitationWidgetRow['config_json'] } : {}),
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY — classify every key against LIVE, in a fixed order
   ═══════════════════════════════════════════════════════════════════════════ */

/** What the live page holds, as Apply reads it just before writing. */
export type HubLiveState = {
  events: Partial<Record<HubDraftEventColumn, unknown>>;
  widgets: ReadonlyArray<
    Pick<InvitationWidgetRow, 'widget_id' | 'widget_type' | 'is_always_on' | 'display_order' | 'config_json' | 'mode'> &
      // Optional so a live read from before the eye was draftable still types;
      // absent reads as visible, the column's own default.
      Partial<Pick<InvitationWidgetRow, 'is_visible'>>
  >;
  /**
   * 📖 The live story's `event_editorial.draft_json` — what Post Event's drafted
   * keys are compared against. Absent reads as a story with the default
   * arrangement (every scene shown, the default order, every style recommended).
   */
  editorial?: unknown;
  /** 🎨 The fixed parts' live picks (`events.style_preferences.scene_styles`). Absent reads as none. */
  fixedStyles?: FixedSceneStyles;
};

export type HubDraftItem =
  | {
      kind: 'event';
      column: HubDraftEventColumn;
      value: unknown;
      change: LookChange;
      /** Would this write need Event Hub Pro for a couple without it? */
      pro: boolean;
    }
  | {
      kind: 'widget';
      widgetType: WidgetType;
      widgetId: string;
      field: 'mode' | 'is_visible' | 'display_order' | 'canvas' | 'main' | 'stage_order' | 'std_lead' | 'custom' | 'venue';
      value: unknown;
      change: LookChange;
      pro: boolean;
      /**
       * Set only on the FREE PART of a held scene (`canvasFreePart`) — the same
       * scene is also in `refused`, holding the whole drafted canvas. Apply
       * never reports or re-drafts this one: if it cannot be written, the
       * held item already says so and keeps everything.
       */
      freePart?: true;
    }
  | {
      /** 📖 One of Post Event's drafted story keys (`lib/post-event-draft.ts`). */
      kind: 'editorial';
      item: PostEventApplyItem;
      /**
       * `item.value`, carried at the top too — every item in a plan has a
       * `value`, so a reader that only filters (`.find(i => i.kind === … && …)`,
       * which does not narrow the union) still reads one shape.
       */
      value: unknown;
      change: LookChange;
      /** Only a part's own font or animation — show/hide, order, styles and words are free. */
      pro: boolean;
      /** The free part of a held look — reported and kept by its refused twin. */
      freePart?: true;
    }
  | {
      /** 🎨 One fixed part's style pick (`lib/fixed-scene-styles.ts`). Free. */
      kind: 'fixed-style';
      scene: FixedStyleScene;
      /** The id to store, or null = back to the default. */
      value: string | null;
      change: LookChange;
      pro: false;
      freePart?: undefined;
    };

const asText = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v);

/** One `events` column: what the draft's value does to what is live. */
export function eventColumnChange(column: HubDraftEventColumn, live: unknown, next: unknown): LookChange {
  switch (column) {
    case 'rsvp_backdrop': {
      // Classified exactly as `saveRsvpBackdrop` classifies it: theme/intensity.
      const key = (v: unknown) => {
        const c = parseRsvpBackdropConfig(v);
        return c ? `${c.theme}/${c.intensity}` : null;
      };
      return refChange(key(live), key(next));
    }
    case 'landing_page_hero_image_url':
      // Exactly as `uploadHeroPhoto` classifies it (`refChange` on the ref).
      return refChange(siteMediaServeRef(live), siteMediaServeRef(next));
    case 'std_reveal_template':
      // 'none' is a real choice (No reveal), distinct from null (the house
      // default for a Pro couple) — so both are compared as written.
      return refChange(typeof live === 'string' ? live : null, typeof next === 'string' ? next : null);
    case 'monogram_custom_svg':
    case 'monogram_studio_config':
      return refChange(asText(live), asText(next));
    case 'reveal_stages': {
      // Compared as the page reads it: NULL (never chosen) and an explicit
      // Save-the-Date-only are the same page, so choosing that is not a change.
      const key = (v: unknown) => (v === null || v === undefined ? null : resolveRevealStages(v).join(','));
      const l = key(live) ?? resolveRevealStages(null).join(',');
      const n = key(next) ?? resolveRevealStages(null).join(',');
      return l === n ? refChange('same', 'same') : refChange(l, n);
    }
    case 'std_reveal_effects': {
      // Only what the reveal shows — the film's `music` is not the Maker's.
      const key = (v: unknown) => {
        const { music: _music, ...reveal } = resolveRevealEffects(v);
        return JSON.stringify(reveal);
      };
      return key(live) === key(next) ? refChange('same', 'same') : refChange('live', 'drafted');
    }
    case 'papic_on':
    case 'gifts_on': {
      // On until someone says No: never answered and Yes are the same event.
      const on = (v: unknown) => (v === false ? 'off' : 'on');
      return on(live) === on(next) ? refChange('same', 'same') : refChange(on(live), on(next));
    }
    case 'logo_wanted':
    case 'cover_photo_wanted': {
      const said = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : null);
      return refChange(said(live), said(next));
    }
    case 'site_art_direction': {
      // Exactly as `siteLookChange` reads it: only Candlelight is a choice;
      // Daylight and "never chosen" are the same page.
      const candle = (v: unknown) => (v === 'candlelight' ? 'candlelight' : null);
      return refChange(candle(live), candle(next));
    }
    case 'site_bg_color':
    case 'site_button_color': {
      const hex = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v.toLowerCase() : null);
      return refChange(hex(live), hex(next));
    }
    case 'our_photos':
      // Exactly as `updateOurPhotos` classifies it (`galleryChange`): taking
      // photos out in order is a removal; a new one or a reorder is a change.
      return galleryChange(siteMediaServeRefs(live), siteMediaServeRefs(next));
    case 'site_bg_music_r2_key':
    case 'landing_page_hero_video_r2_key':
      return refChange(siteMediaServeRef(live), siteMediaServeRef(next));
    case 'site_bg_music_enabled':
      return refChange(live === true ? 'on' : null, next === true ? 'on' : null);
    case 'style_preferences': {
      // Only the QR's look is compared; the blob's other keys are not the Maker's.
      const qr = (v: unknown) => {
        const s = qrStyleFromPreferences(v);
        return Object.keys(s).length > 0 ? JSON.stringify(s) : null;
      };
      return refChange(qr(live), qr(next));
    }
    case 'ceremony_venue_latitude':
    case 'ceremony_venue_longitude':
    case 'venue_latitude':
    case 'venue_longitude': {
      // As the NUMERIC(10,7) column holds it — "14.5541000" and 14.5541 are one pin.
      const at = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v).toFixed(7));
      return refChange(at(live), at(next));
    }
    case 'print_details': {
      // Only the Name style is compared — and as the prints read it: absent is Full.
      const style = (v: unknown) => nameStyleOfPrintDetails(v);
      return style(live) === style(next) ? refChange('same', 'same') : refChange(style(live), style(next));
    }
    case 'invite_theme': {
      // Compared as guests meet it: never chosen and Classic are the same page,
      // and a retired id is its alias (`capiz` is Vintage).
      const theme = (v: unknown) => normalizeThemeId(v) ?? 'house';
      return theme(live) === theme(next) ? refChange('same', 'same') : refChange(theme(live), theme(next));
    }
    default: {
      // The face, the magic move and every words column: compared as written,
      // with '' read as unset (an empty text column renders nothing).
      const norm = (v: unknown) => {
        const t = asText(v);
        return t === '' ? null : t;
      };
      return refChange(norm(live), norm(next));
    }
  }
}

/**
 * Does THIS drafted value need Event Hub Pro to Apply? The one rule per column:
 * a look column (`HUB_LOOK_EVENT_COLUMNS`) when it adds or changes; the reveal
 * when the value is an opening (never "No reveal" or clearing it — both free);
 * the Logo never (its animation is gated where it plays, not where it is saved).
 */
export function eventItemIsPro(
  column: HubDraftEventColumn,
  value: unknown,
  change: LookChange,
  live: unknown = null,
): boolean {
  if (change !== 'add' && change !== 'change') return false;
  if (column === 'std_reveal_template') {
    return !revealTemplateWriteAllowed(typeof value === 'string' ? value : null, false);
  }
  // A changed reveal effect is Pro — `revealEffectsWriteAllowed`'s rule; the
  // classification above already ignores the film's music switch.
  if (column === 'std_reveal_effects') return true;
  if (column === 'love_story') {
    // 💌 THE ONE MOMENT RULE (`momentCapRefusal`), asked of live → drafted as
    // if the couple did not own Pro: more than five stories, or any photo the
    // live story did not already hold, is Pro. Words alone never are.
    return (
      momentCapRefusal({ before: resolveMoments(live), after: resolveMoments(value), ownsPro: false }) !== null
    );
  }
  // 🎵 Switching the couple's EXISTING song on or off is free (`updateSiteChrome`);
  // only a new or different song is Pro — that is `site_bg_music_r2_key`.
  if (column === 'site_bg_music_enabled') return false;
  // 🔳 The QR's shape · pattern · colour are Event Hub Pro (`updateQrStyle`);
  // going back to the plain code is a removal, which is free.
  if (column === 'style_preferences') return true;
  if (column === 'invite_theme') {
    // 🎨 The free themes (Classic, Modern, Cyber Neon — `tier: 'free'`, owner
    // 2026-09-29) are free; every other theme is Event Hub Pro (owner 2026-09-28,
    // "WHAT IS FREE VS PRO … REDRAWN": "only when you start adding themes will
    // it be pro"). Going back to Classic is always free.
    const id = normalizeThemeId(value);
    return id !== null && INVITE_THEMES[id].tier === 'pro';
  }
  if (column === 'site_bg_color') {
    // 🌈 A plain colour is free (owner 2026-09-24). An OMBRÉ is free too unless
    // the one switch in `lib/ombre.ts` says otherwise — then it is tried here
    // and paid at Apply, like every other look.
    return OMBRE_IS_PRO && isOmbreValue(value);
  }
  return eventColumnIsPro(column);
}

/**
 * Is this column the page's LOOK (Pro to add or change)? Read from the one list
 * in `lib/hub-look-pro.ts`, so a free column (a colour) could never be classed
 * Pro here, nor a Pro one free.
 */
export function eventColumnIsPro(column: HubDraftEventColumn): boolean {
  return (HUB_LOOK_EVENT_COLUMNS as readonly string[]).includes(column);
}

/**
 * 💎 ONE FACET OF A SCENE'S LOOK — the unit every Pro question about a canvas is
 * asked in (owner 2026-09-28, verbatim: *"they can edit it with pro features.
 * but need to upgrade to pro when clicked on apply and point out the effect
 * chosen that caused them to upgrade to pro"*).
 *
 * `canvasLookFacets` is THE comparison: `canvasLookChange` (is this canvas Pro
 * at Apply?), `canvasFreePart` (what of it goes live without Pro?) and the
 * Apply sheet's named list (`lib/hub-pro-effects.ts` — WHICH effects need Pro,
 * and where) all read it, so the list a couple is shown can never name a thing
 * the gate lets through, nor miss one the gate holds.
 *
 *   key    — what it compares, and what `canvasWithoutFacet` puts back.
 *   group  — how the Apply sheet names it ("Font", "Animation", "Photo
 *            background" …). Several keys can share one group on one scene
 *            (every motion key is "Animation"); the sheet lists the group once.
 */
export type CanvasFacetGroup =
  | 'media'
  | 'crop'
  | 'layout'
  | 'motion'
  | 'transition'
  | 'font'
  | 'part-motion'
  | 'slot-media'
  | 'playback';

export type CanvasLookFacet = {
  key: string;
  group: CanvasFacetGroup;
  /** The part it belongs to — font and part-motion only. */
  element?: HubElementKey;
  /** The template slot it belongs to — slot-media only. */
  slot?: number;
  change: LookChange;
};

/** The scalar canvas look keys and the group each is named by. */
const CANVAS_KEY_GROUP: Record<string, CanvasFacetGroup> = {
  focal: 'crop',
  zoom: 'crop',
  arrangement: 'layout',
  transition: 'transition',
  autoSpeed: 'transition',
};

/** A part's Pro field → the group it is named by. */
const ELEMENT_FIELD_GROUP: Record<(typeof HUB_ELEMENT_PRO_FIELDS)[number], CanvasFacetGroup> = {
  font: 'font',
  motion: 'part-motion',
};

/**
 * Every look facet of a section's canvas, live → drafted, each with its own
 * change. Media behind the section (photo or snippet), and media in a template
 * scene's slots, is classified like any other ref; a COLOUR is never an input,
 * so a colour background stays free in every direction; every other look key
 * (crop, arrangement, motion, transition) adds, changes or removes.
 */
export function canvasLookFacets(live: HubSectionCanvas, next: HubSectionCanvas): CanvasLookFacet[] {
  const out: CanvasLookFacet[] = [
    { key: 'media', group: 'media', change: refChange(canvasMediaRef(live), canvasMediaRef(next)) },
  ];
  for (const k of HUB_CANVAS_LOOK_KEYS) {
    if (k === 'media' || k === 'elements') continue;
    out.push({ key: k, group: CANVAS_KEY_GROUP[k] ?? 'motion', change: refChange(asText(live[k]), asText(next[k])) });
  }
  /* 🔤 ONE ELEMENT'S OWN LOOK (`lib/element-style.ts`) — compared FIELD BY
     FIELD, so taking one override off stays a free removal even while another
     element keeps its own.
     💎 REDRAWN 2026-09-28 (owner: *"free to change design, change text, size,
     color, background color, only when you start adding themes will it be
     pro. adding media for background."*): ONLY the part's own FONT and its own
     MOTION are inputs now (`HUB_ELEMENT_PRO_FIELDS`), and inside a text run
     only its font. Colour, size, weight, B · I · U, alignment and spacing are
     `HUB_ELEMENT_FREE_FIELDS` — never an input, so no direction of them can
     make a canvas Pro. */
  for (const element of HUB_ELEMENT_KEYS) {
    for (const field of HUB_ELEMENT_PRO_FIELDS) {
      out.push({
        key: `el:${element}:${field}`,
        group: ELEMENT_FIELD_GROUP[field],
        element,
        change: refChange(asText(live.elements?.[element]?.[field]), asText(next.elements?.[element]?.[field])),
      });
    }
    out.push({
      key: `el:${element}:runs`,
      group: 'font',
      element,
      change: refChange(runFonts(live.elements?.[element]), runFonts(next.elements?.[element])),
    });
  }
  /* 🎬 A TEMPLATE SCENE'S PICTURES AND CLIP PLAYBACK (Maker Phase 5) — the same
     line `saveCustomSection` draws live (`lib/scene-writes.ts`): putting a
     picture or a clip into a slot, or swapping it, is Pro; taking one off is
     not; any non-default playback (tap to play) is Pro, back to Loop is not.
     The template pick and a slot's WORDS are free, so they are not inputs.
     Without these lines a free couple could draft a slot photo and Apply it —
     the gate would see no look key change at all. */
  const slotCount = Math.max(live.slots?.length ?? 0, next.slots?.length ?? 0);
  for (let i = 0; i < slotCount; i += 1) {
    out.push({ key: `slot:${i}`, group: 'slot-media', slot: i, change: refChange(slotMediaRef(live, i), slotMediaRef(next, i)) });
  }
  out.push({ key: 'video', group: 'playback', change: refChange(asText(live.video), asText(next.video)) });
  return out;
}

/** A section's canvas, live → drafted, as ONE change: the most demanding facet. */
export function canvasLookChange(live: HubSectionCanvas, next: HubSectionCanvas): LookChange {
  return combineChanges(...canvasLookFacets(live, next).map((f) => f.change));
}

/** The media behind a scene, as one comparable ref — null for any colour ground. */
function canvasMediaRef(c: HubSectionCanvas): string | null {
  return c.kind !== 'color' && c.media ? `${c.kind ?? 'photo'}:${c.media}` : null;
}

/** One template slot's picture or clip, as one comparable ref. */
function slotMediaRef(c: HubSectionCanvas, i: number): string | null {
  const s = c.slots?.[i];
  return s?.media ? `${s.kind ?? 'photo'}:${s.media}` : null;
}

/** The Pro half of a part's text runs — which letters wear which FONT — or null. */
function runFonts(style: HubElementStyle | undefined): string | null {
  const runs = (style?.runs ?? []).filter((r) => r.font).map((r) => [r.start, r.end, r.font]);
  return runs.length > 0 ? JSON.stringify({ of: style?.of ?? null, runs }) : null;
}

const grows = (c: LookChange) => c === 'add' || c === 'change';

/** Does this facet need Event Hub Pro to go live (it adds or changes a look)? */
export function canvasFacetGrows(f: CanvasLookFacet): boolean {
  return grows(f.change);
}

/** The background's own keys — they travel together, so a media ground is put back whole. */
const CANVAS_GROUND_KEYS = ['media', 'kind', 'color', 'opacity', 'own', 'shape', 'mediaMotion', 'poster'] as const;

/**
 * `next` with ONE facet put back to what is live — every other key, and every
 * other facet, exactly as drafted. What "remove this effect" writes into the
 * draft from the Apply sheet, and the step `canvasFreePart` repeats for every
 * Pro facet. Its input is always a canvas the sanitizer already accepted, and
 * its output is sanitized again.
 */
export function canvasWithoutFacet(
  live: HubSectionCanvas,
  next: HubSectionCanvas,
  facet: Pick<CanvasLookFacet, 'key'>,
): HubSectionCanvas {
  const out = { ...next } as Record<string, unknown>;
  const liveRec = live as Record<string, unknown>;
  const put = (k: string, v: unknown) => {
    if (v === undefined) delete out[k];
    else out[k] = v;
  };
  const key = facet.key;
  if (key === 'media') {
    for (const k of CANVAS_GROUND_KEYS) put(k, liveRec[k]);
  } else if (key === 'video') {
    put('video', live.video);
  } else if (key.startsWith('slot:')) {
    const i = Number(key.slice('slot:'.length));
    if (next.slots && Number.isInteger(i) && i >= 0 && i < next.slots.length) {
      out.slots = next.slots.map((slot, j) => {
        if (j !== i) return slot;
        const { media: _m, kind: _k, ...words } = slot;
        const was = live.slots?.[i];
        return was?.media ? { ...words, media: was.media, ...(was.kind ? { kind: was.kind } : {}) } : words;
      });
    }
  } else if (key.startsWith('el:')) {
    const [, element, field] = key.split(':') as [string, HubElementKey, string];
    const style = next.elements?.[element];
    if (style) {
      const was = live.elements?.[element];
      const el: Record<string, unknown> = { ...style };
      if (field === 'runs') {
        if (style.runs) {
          const liveFont = (r: { start: number; end: number }) =>
            was?.of === style.of ? was?.runs?.find((w) => w.start === r.start && w.end === r.end)?.font : undefined;
          const withoutFont = (r: HubElementRun): HubElementRun => {
            const { font: _font, ...rest } = r;
            return rest;
          };
          let runs: HubElementRun[] = style.runs.map((r) => {
            const f = liveFont(r);
            return f ? { ...withoutFont(r), font: f } : withoutFont(r);
          });
          // Put back exactly, or not at all: a partial font set would still be a change.
          if (runFonts({ ...style, runs }) !== runFonts(was)) runs = runs.map(withoutFont);
          runs = runs.filter((r) => 'font' in r || 'color' in r || 'size' in r);
          if (runs.length > 0) el.runs = runs;
          else {
            delete el.runs;
            delete el.of;
          }
        }
      } else if ((HUB_ELEMENT_PRO_FIELDS as readonly string[]).includes(field)) {
        const f = field as (typeof HUB_ELEMENT_PRO_FIELDS)[number];
        if (was?.[f] === undefined) delete el[f];
        else el[f] = was[f];
      }
      const elements: Record<string, HubElementStyle> = { ...(next.elements as Record<string, HubElementStyle>) };
      if (Object.keys(el).length > 0) elements[element] = el as HubElementStyle;
      else delete elements[element];
      put('elements', Object.keys(elements).length > 0 ? elements : undefined);
    }
  } else if ((HUB_CANVAS_LOOK_KEYS as readonly string[]).includes(key)) {
    put(key, liveRec[key]);
  }
  return sanitizeHubCanvas({ canvas: out });
}

/**
 * 💎 THE FREE PART OF A DRAFTED CANVAS — `next` with every Pro addition or
 * change put back to what is live, and every free edit kept.
 *
 * Why it exists (owner 2026-09-28, the free-vs-Pro redraw): a scene's canvas is
 * ONE draft item, so before this a free couple who drafted a free colour AND a
 * Pro font on the same part had BOTH held at Apply — the colour we tell them is
 * free never reached their guests. Apply now writes this, and the full drafted
 * canvas stays in the draft holding only its Pro half (`planHubDraftApply`).
 *
 * It is `canvasWithoutFacet` for every facet that grows — the same step the
 * Apply sheet's "remove this effect" takes for one.
 *
 * 🔒 FAIL-CLOSED. Built from the same comparisons `canvasLookChange` makes, and
 * then CHECKED against it: if the result would still add or change a look, the
 * live canvas comes back unchanged — nothing Pro can leak through this door.
 */
export function canvasFreePart(live: HubSectionCanvas, next: HubSectionCanvas): HubSectionCanvas {
  let free = sanitizeHubCanvas({ canvas: next });
  for (const facet of canvasLookFacets(live, next)) {
    if (grows(facet.change)) free = canvasWithoutFacet(live, free, facet);
  }
  return grows(canvasLookChange(live, free)) ? live : free;
}

const liveCanvasOf = (config: unknown): HubSectionCanvas => sanitizeHubCanvas(config);

/** The Post Event preset a scene was seeded from, or null (`lib/post-event-presets.ts`). */
export function presetSceneOf(canvas: HubSectionCanvas): string | null {
  return canvas.postEventPreset ?? null;
}

/**
 * The Main background, live → drafted (Maker Phase 10). All of it is LOOK — the
 * owner's "making media a background is pro", and "Adaptive theme is for PRO":
 * putting their own clip or photo up, swapping it, or changing how the theme
 * follows it (the `tint` toggle) adds or changes; going back to the hero (or
 * the theme's own) removes, which is free.
 *
 * FOLLOWING THE HERO (the default, owner 2026-09-25 item 6) carries no media of
 * its own — the hero photo is gated where the hero is written — so only its
 * measured frame and toggle are compared: the adaptive tint, which is Pro.
 */
export function mainGroundChange(live: HubMainGround | null, next: HubMainGround | null): LookChange {
  /* 🖼 "The theme's background" and "None — just the colour" carry no media
     and no tint: going to either is a removal (free), never an addition. */
  const ref = (m: HubMainGround | null) => (isHubMainOwn(m) ? `${m.kind}:${m.media}` : null);
  const poster = (m: HubMainGround | null) => (isHubMainOwn(m) ? (m.poster ?? null) : null);
  const tint = (m: HubMainGround | null) =>
    isHubMainFollow(m) ? asText({ of: m.of, ...m.tint }) : isHubMainOwn(m) ? asText(m.tint ?? null) : null;
  const motion = (m: HubMainGround | null) => (isHubMainOwn(m) ? (m.motion ?? null) : null);
  if (!next) return combineChanges(refChange(ref(live), null), refChange(tint(live), null), refChange(motion(live), null));
  return combineChanges(
    refChange(ref(live), ref(next)),
    refChange(poster(live), poster(next)),
    refChange(tint(live), tint(next)),
    refChange(motion(live), motion(next)),
  );
}

/**
 * Could one of the couple's own scenes be in front of guests — live (`{}`), or
 * with a draft laid over it? The guest page has TWO readers
 * (`widgetShouldRender` reads the eye; `openBrowseSectionVisible` lets a
 * `shown` mode win over it), so "on" is on under EITHER — fail-closed: a state
 * one reader would draw counts as shown.
 */
function ownSceneOn(
  row: HubLiveState['widgets'][number],
  w: Pick<HubDraftWidget, 'mode' | 'is_visible'>,
): boolean {
  const visible = (w.is_visible ?? row.is_visible ?? true) !== false;
  const mode = w.mode ?? row.mode ?? 'auto';
  return visible || mode === 'shown';
}

/**
 * Every key in the draft that differs from live, in THE fixed order Apply writes
 * them: the `events` columns in `HUB_DRAFT_EVENT_COLUMNS` order, then each
 * section in `WIDGET_TYPES` order — mode, then visibility, then order, then canvas. A key equal to
 * what is live is not an item (Apply writes nothing for it).
 *
 * A drafted section with no live row (a custom section that was deleted) is
 * returned in `orphans`, never silently dropped.
 */
export function classifyHubDraft(
  draft: HubDraftState,
  live: HubLiveState,
): { items: HubDraftItem[]; orphans: WidgetType[] } {
  const items: HubDraftItem[] = [];
  for (const column of HUB_DRAFT_EVENT_COLUMNS) {
    if (!(column in draft.events)) continue;
    const value = draft.events[column];
    const change = eventColumnChange(column, live.events[column] ?? null, value);
    // 'none' = what guests see would not change (the classifier compares the
    // same normalised key the render reads), so there is nothing to write.
    if (change === 'none') continue;
    items.push({
      kind: 'event',
      column,
      value,
      change,
      pro: eventItemIsPro(column, value, change, live.events[column] ?? null),
    });
  }
  const orphans: WidgetType[] = [];
  for (const type of WIDGET_TYPES) {
    const w = draft.widgets[type];
    if (!w) continue;
    const row = live.widgets.find((r) => r.widget_type === type);
    if (!row) {
      orphans.push(type);
      continue;
    }
    /* 🎬 A SCENE OF THEIR OWN, SHOWN FOR THE FIRST TIME, IS PRO — AT APPLY
       (owner 2026-09-28, *"they can edit it with pro features. but need to
       upgrade to pro when clicked on apply"*). "+ Add a scene" now works for a
       free couple in the Maker: the row is inserted HIDDEN (`ADDED_SCENE_LIVE`)
       and the draft says shown, so the gate moved from the door to here. Only a
       couple's OWN scene that guests do not see today is asked — putting it in
       front of guests is adding a look (`lookWriteAllowed`'s 'add'); taking one
       off, and every shipped section's show / hide, stay free. */
    const showsOwnScene = isCustomSectionType(type) && !row.is_always_on && !ownSceneOn(row, {}) && ownSceneOn(row, w);
    if (w.mode !== undefined && !row.is_always_on && w.mode !== (row.mode ?? 'auto')) {
      items.push({
        kind: 'widget',
        widgetType: type,
        widgetId: row.widget_id,
        field: 'mode',
        value: w.mode,
        change: showsOwnScene && w.mode === 'shown' ? 'add' : 'change',
        pro: showsOwnScene && w.mode === 'shown',
      });
    }
    if (w.is_visible !== undefined && !row.is_always_on && w.is_visible !== (row.is_visible ?? true)) {
      items.push({
        kind: 'widget',
        widgetType: type,
        widgetId: row.widget_id,
        field: 'is_visible',
        value: w.is_visible,
        change: showsOwnScene && w.is_visible === true ? 'add' : 'change',
        pro: showsOwnScene && w.is_visible === true,
      });
    }
    if (w.display_order !== undefined && !row.is_always_on && w.display_order !== row.display_order) {
      items.push({ kind: 'widget', widgetType: type, widgetId: row.widget_id, field: 'display_order', value: w.display_order, change: 'change', pro: false });
    }
    /* ↕ The stage places and 🎞 the Save the Date's pick: each compared as the
       page reads it (the merged `config_json` key), never Pro. The value written
       is the WHOLE merged key, so Apply sets it exactly as the preview showed. */
    if (w.stage_order !== undefined) {
      const liveKey = configWithStageOrder(row.config_json, {})[STAGE_ORDER_KEY] ?? null;
      const nextKey = configWithStageOrder(row.config_json, w.stage_order)[STAGE_ORDER_KEY] ?? null;
      if (JSON.stringify(liveKey) !== JSON.stringify(nextKey)) {
        items.push({ kind: 'widget', widgetType: type, widgetId: row.widget_id, field: 'stage_order', value: nextKey, change: 'change', pro: false });
      }
    }
    if (w.std_lead !== undefined && type === 'our_photos') {
      const liveLead = storedStdLead([row]);
      if ((w.std_lead ?? null) !== liveLead) {
        items.push({ kind: 'widget', widgetType: type, widgetId: row.widget_id, field: 'std_lead', value: w.std_lead ?? null, change: 'change', pro: false });
      }
    }
    if (w.main !== undefined && type === 'hero') {
      const liveMain = hubMainGround(row.config_json);
      const nextMain = w.main;
      if (JSON.stringify(liveMain) !== JSON.stringify(nextMain)) {
        const change = mainGroundChange(liveMain, nextMain);
        items.push({
          kind: 'widget',
          widgetType: type,
          widgetId: row.widget_id,
          field: 'main',
          value: nextMain,
          change,
          pro: change === 'add' || change === 'change',
        });
      }
    }
    /* ✍ A scene of their own's words. Free to change words it already has;
       starting to fill a scene that is EMPTY live is Pro — the same line
       `customSectionWriteAllowed` draws live (a hand-crafted draft is still
       held at Apply). The value written is the words; Apply merges them into
       the live `config_json`, every sibling key kept. */
    if (w.custom !== undefined && isCustomSectionType(type)) {
      const liveWords = sanitizeCustomSection(row.config_json);
      const nextWords = w.custom ?? { title: '', body: '' };
      if (liveWords.title !== nextWords.title || liveWords.body !== nextWords.body) {
        const fills =
          !customSectionHasContent(row.config_json) && customSectionHasContent(configWithCustom(row.config_json, w.custom));
        items.push({
          kind: 'widget',
          widgetType: type,
          widgetId: row.widget_id,
          field: 'custom',
          value: w.custom,
          change: fills ? 'add' : 'change',
          pro: fills,
        });
      }
    }
    /* 🏛 The venue cards' source and photo — compared as the page reads the
       bag; the value written is the WHOLE merged bag. Never Pro. */
    if (w.venue !== undefined && type === 'venue_map') {
      const liveBag = draftVenueChoices(isPlainObject(row.config_json) ? row.config_json.venue : null);
      const nextBag = configWithVenue(row.config_json, w.venue).venue;
      if (JSON.stringify(liveBag) !== JSON.stringify(nextBag)) {
        items.push({ kind: 'widget', widgetType: type, widgetId: row.widget_id, field: 'venue', value: nextBag, change: 'change', pro: false });
      }
    }
    if (w.canvas !== undefined) {
      const liveCanvas = liveCanvasOf(row.config_json);
      const nextCanvas = w.canvas ?? {};
      if (JSON.stringify(liveCanvas) !== JSON.stringify(nextCanvas)) {
        const change = canvasLookChange(liveCanvas, nextCanvas);
        items.push({
          kind: 'widget',
          widgetType: type,
          widgetId: row.widget_id,
          field: 'canvas',
          value: w.canvas,
          change,
          pro: change === 'add' || change === 'change',
        });
      }
    }
  }
  // 📖 Post Event's scenes, last — after every section, in the story's own
  // order: which show, their order, then their looks.
  if (draft.editorial) {
    for (const item of classifyPostEventDraft(draft.editorial, live.editorial ?? null)) {
      items.push({ kind: 'editorial', item, value: item.value, change: item.change, pro: item.pro });
    }
  }
  // 🎨 The fixed parts' style picks, last — each compared with what is live.
  for (const [scene, value] of Object.entries(draft.fixedStyles ?? {}) as Array<[FixedStyleScene, string | null]>) {
    const liveId = live.fixedStyles?.[scene] ?? null;
    if ((value ?? null) !== liveId) items.push({ kind: 'fixed-style', scene, value: value ?? null, change: 'change', pro: false });
  }
  return { items, orphans };
}

export type HubDraftApplyPlan = {
  /** Written, in this order. */
  apply: HubDraftItem[];
  /** Refused: Pro keys for a couple without Event Hub Pro. They stay in the draft. */
  refused: HubDraftItem[];
  /** The draft that remains after the apply (the refused keys only). */
  remaining: HubDraftState;
  orphans: WidgetType[];
};

/**
 * THE GATE, as a plan. `ownsPro` is measured by the caller (admin-client SKU
 * read, `lookProAllows`); this decides with the one rule, `lookWriteAllowed`.
 * Nothing here can let a Pro key through for a couple who does not own Pro.
 */
export function planHubDraftApply(
  draft: HubDraftState,
  live: HubLiveState,
  ownsPro: boolean,
): HubDraftApplyPlan {
  const { items, orphans } = classifyHubDraft(draft, live);
  const apply: HubDraftItem[] = [];
  const refused: HubDraftItem[] = [];
  for (const item of items) {
    const allowed = item.pro ? lookWriteAllowed(ownsPro, item.change) : true;
    (allowed ? apply : refused).push(item);
    /* 💎 A HELD SCENE STILL GETS ITS FREE EDITS (the 2026-09-28 redraw). The
       canvas is one item, so a colour drafted beside a Pro font would otherwise
       be held with it. Its free part is written now; the whole drafted canvas
       stays in the draft (below), where it now differs from live only by Pro. */
    if (!allowed && item.kind === 'widget' && item.field === 'canvas') {
      const row = live.widgets.find((r) => r.widget_type === item.widgetType);
      const liveCanvas = liveCanvasOf(row?.config_json);
      const free = canvasFreePart(liveCanvas, (item.value as HubSectionCanvas | null) ?? {});
      if (JSON.stringify(free) !== JSON.stringify(liveCanvas)) {
        apply.push({ ...item, value: free, change: canvasLookChange(liveCanvas, free), pro: false, freePart: true });
      }
    }
    /* 💎 …and a held Post Event look gets its free edits the same way — its
       style, its words, a colour beside a Pro font (`sceneLooksFreePart`). */
    if (!allowed && item.kind === 'editorial' && item.item.field === 'sceneLooks') {
      const liveLooks = postEventArrangementOf(live.editorial ?? null).sceneLooks;
      const free = sceneLooksFreePart(liveLooks, item.item.value);
      if (JSON.stringify(free) !== JSON.stringify(liveLooks)) {
        const change = sceneLooksChange(liveLooks, free);
        apply.push({
          kind: 'editorial',
          item: { field: 'sceneLooks', value: free, change, pro: false, freePart: true },
          value: free,
          change,
          pro: false,
          freePart: true,
        });
      }
    }
  }
  const remaining: HubDraftState = { events: {}, widgets: {} };
  for (const item of refused) {
    if (item.kind === 'event') remaining.events[item.column] = item.value;
    else if (item.kind === 'editorial') {
      // A held look keeps the WHOLE drafted map, so the next Apply (after Pro)
      // finds it — and finds its free part already live.
      if (item.item.field === 'sceneLooks') remaining.editorial = { ...(remaining.editorial ?? {}), sceneLooks: item.item.value };
      // 💎 A held story extra (moments, columns, wishes) stays drafted whole.
      else if (item.item.field === 'chapterOverrides' || item.item.field === 'customColumns' || item.item.field === 'reviews') {
        remaining.editorial = { ...(remaining.editorial ?? {}), [item.item.field]: item.item.value };
      }
    } else if (item.kind === 'fixed-style') {
      // Never refused (a style pick is free) — kept for completeness.
      remaining.fixedStyles = { ...(remaining.fixedStyles ?? {}), [item.scene]: item.value };
    } else {
      const w = (remaining.widgets[item.widgetType] ??= {});
      if (item.field === 'canvas') w.canvas = item.value as HubSectionCanvas | null;
      else if (item.field === 'main') w.main = item.value as HubMainGround | null;
      // A held scene of their own stays SHOWN in the draft, so the couple still sees it.
      else if (item.field === 'mode') w.mode = item.value as HubSectionMode;
      else if (item.field === 'is_visible') w.is_visible = item.value as boolean;
      else if (item.field === 'custom') w.custom = item.value as CustomSectionContent | null;
    }
  }
  return { apply, refused, remaining, orphans };
}

/**
 * The tables an Apply of these items writes. `event_editorial` only for Post
 * Event's own drafted keys — Reset never produces one (`hubResetPatch` names
 * no story key, and `HUB_RESET_NEVER_TOUCHES` promises "your Post Event story").
 */
export function hubDraftWriteTables(
  items: readonly HubDraftItem[],
): Array<'events' | 'invitation_widgets' | 'event_editorial'> {
  const out = new Set<'events' | 'invitation_widgets' | 'event_editorial'>();
  // 🎨 A fixed part's style pick is a key of `events.style_preferences`.
  for (const i of items) out.add(i.kind === 'event' || i.kind === 'fixed-style' ? 'events' : i.kind === 'editorial' ? 'event_editorial' : 'invitation_widgets');
  return [...out];
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESET — the page we wrote, for one stage, into the draft
   ═══════════════════════════════════════════════════════════════════════════ */

/** The four stages (`PUBLIC_STAGE_ORDER`'s phases), or the whole Event Hub. */
export const HUB_RESET_SCOPES = ['save_the_date', 'rsvp', 'event', 'editorial', 'all'] as const;
export type HubResetScope = (typeof HUB_RESET_SCOPES)[number];

export function isHubResetScope(v: unknown): v is HubResetScope {
  return typeof v === 'string' && (HUB_RESET_SCOPES as readonly string[]).includes(v);
}

/**
 * The order every event is seeded with (migration
 * `20270919679722_invitation_widget_seed_16_reconcile.sql`: hero = 1 … our_love_story
 * = 16), which is `WIDGET_TYPES`' own order for the sixteen shipped sections.
 */
export function seededDisplayOrder(type: WidgetType): number | null {
  if (isCustomSectionType(type)) return null;
  const i = (WIDGET_TYPES as readonly string[]).indexOf(type);
  return i >= 0 ? i + 1 : null;
}

/** The `events` columns Reset 'all' clears. The made-once group is never here. */
export const HUB_RESET_EVENT_COLUMNS: readonly HubDraftEventColumn[] = ['rsvp_backdrop'];

/** Stage-specific `events` look columns. Site-wide ones reset only with 'all'. */
const STAGE_EVENT_COLUMNS: Record<Exclude<HubResetScope, 'all'>, HubDraftEventColumn[]> = {
  save_the_date: [],
  rsvp: ['rsvp_backdrop'],
  event: [],
  editorial: [],
};

/**
 * What Reset never touches — shown in its confirm, and asserted by the tests on
 * the PLAN (the tables it would write), not on this prose.
 */
export const HUB_RESET_NEVER_TOUCHES = [
  'your guest list and their replies',
  'your schedule',
  'your photos and galleries',
  'orders and payments',
  'your Post Event story',
  'your Event Hub address and who can view it',
  'sections you wrote yourself',
] as const;

/**
 * The page we wrote for one stage, as a draft patch: every shipped section that
 * appears in that stage goes back to Auto, its seeded place and no canvas; the
 * stage's own look column is cleared. The couple's own sections (custom_1..6) are
 * their words and are left exactly as they are. Always-on sections keep their
 * fixed place — only their canvas is reset.
 */
export function hubResetPatch(scope: HubResetScope): HubDraftPatch {
  const widgets: HubDraftPatch['widgets'] = {};
  for (const type of WIDGET_TYPES) {
    if (isCustomSectionType(type)) continue;
    if (scope !== 'all' && !WIDGET_PHASES[type].includes(scope as LifecyclePhase)) continue;
    const order = seededDisplayOrder(type);
    widgets[type] = { mode: 'auto', canvas: null, ...(order !== null ? { display_order: order } : {}) };
  }
  // 'all' resets the stage LOOK columns only — never the hero photo, the reveal
  // or the Logo: those are the couple's own made-once choices ("your photos",
  // HUB_RESET_NEVER_TOUCHES), and Reset is "the page we wrote", not an eraser.
  const columns = scope === 'all' ? [...HUB_RESET_EVENT_COLUMNS] : STAGE_EVENT_COLUMNS[scope];
  const events: HubDraftEvents = {};
  for (const c of columns) events[c] = null;
  return { events, widgets };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE BAR'S SUMMARY
   ═══════════════════════════════════════════════════════════════════════════ */

export type HubDraftSummary = {
  /** A draft row exists and differs from live. */
  hasChanges: boolean;
  /** Keys that differ from live. */
  changeCount: number;
  /** Of those, how many need Event Hub Pro to Apply (0 for an owning couple). */
  proCount: number;
  canUndo: boolean;
};

export function summarizeHubDraft(draft: HubDraft | null, live: HubLiveState, ownsPro: boolean): HubDraftSummary {
  if (!draft) return { hasChanges: false, changeCount: 0, proCount: 0, canUndo: false };
  const plan = planHubDraftApply(draft, live, ownsPro);
  // A held scene's free part is the same scene as its refused twin — one change.
  // ✍ …and the names (three columns) or the date (two) are ONE change each.
  const facts = new Set<string>();
  let changeCount = 0;
  for (const i of [...plan.apply.filter((i) => !(i.kind !== 'event' && i.freePart)), ...plan.refused]) {
    const fact = i.kind === 'event' ? hubDraftFactOf(i.column) : i.kind === 'widget' && i.field === 'venue' ? 'venues' : null;
    if (fact && facts.has(fact)) continue;
    if (fact) facts.add(fact);
    changeCount += 1;
  }
  return {
    hasChanges: changeCount > 0,
    changeCount,
    proCount: plan.refused.length,
    canUndo: draft.history.length > 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE ONE ACTION'S VOCABULARY (types only — a 'use server' file exports only
   async functions, so its shapes live here)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `drop` (owner 2026-09-28, the Apply sheet): take ONE named Pro effect off the
 * draft (`lib/hub-pro-effects.ts`), recomputed from the stored draft — the
 * sheet sends only the effect's id.
 */
/**
 * `date_change` — THE CLASHING-DATE FLOW's couple side (owner 2026-10-01): the
 * one confirm "Ask them to move or unlock?" and Home's withdraw · keep waiting ·
 * drop that supplier (`action`, `lib/date-change.ts`). It rides this action
 * rather than a new export (the server-action budget); it never writes the
 * live page — the date goes live only through `apply`.
 */
export const HUB_DRAFT_INTENTS = ['save', 'apply', 'restore', 'reset', 'undo', 'drop', 'date_change'] as const;
export type HubDraftIntent = (typeof HUB_DRAFT_INTENTS)[number];

export function isHubDraftIntent(v: unknown): v is HubDraftIntent {
  return typeof v === 'string' && (HUB_DRAFT_INTENTS as readonly string[]).includes(v);
}

/** Why Apply held a key back. */
export type HubDraftRefusal =
  | 'needs_pro'
  | 'apply_on_the_web'
  | 'not_your_photo'
  | 'empty_section'
  | 'missing_section'
  /** 🗓 A drafted date that has already gone by (`eventDateRefusal` → `in_past`). */
  | 'date_in_past'
  /** 🗓 A drafted date a booked supplier holds (`eventDateRefusal` → `locked` · `widens`). */
  | 'date_locked'
  /** 🕒 A ceremony time with no day to stand on (the event's date is not a single day). */
  | 'needs_a_day';

export type HubDraftActionResult =
  | {
      ok: true;
      intent: HubDraftIntent;
      /** Keys written to the live page (apply only). */
      applied: number;
      /** Keys held back, each with a sentence-ready label and a reason (apply only). */
      held: Array<{ label: string; reason: HubDraftRefusal }>;
      /**
       * ⚡ The Apply bar as it stands after this save — only when the save asked
       * for it (`HUB_DRAFT_BAR_FIELD`, `lib/maker-refresh.ts`). A pick the bridge drew owes the Maker no
       * render (`lib/maker-refresh.ts`), so the toolbar's count comes from here.
       */
      bar?: HubDraftBarLive;
      /** `date_change` only: what happened, in words ("Asked. Your date stays as it is…"). */
      message?: string;
    }
  | {
      ok: false;
      intent: HubDraftIntent | null;
      error: string;
      /**
       * 🗓 A day or month a BOOKED supplier cannot do was refused at the pick
       * (`lib/date-clash.server.ts`): each supplier that clashes, and where to
       * ask them to move or unlock. `error` is the plain reason.
       */
      clash?: DateClash[];
    };

/**
 * What the toolbar re-reads after a save (`hubDraftBarAfterSave`): the count for
 * a couple WITHOUT Pro and for one WITH it — the save never asks which this
 * viewer is (the view switch must never reach a server action), the toolbar
 * picks with the render's own answer — plus the Pro effects and their price
 * for the couple without it.
 */
export type HubDraftBarLive = {
  free: HubDraftSummary;
  owned: HubDraftSummary;
  proEffects: HubProEffectView[];
  priceLabel: string | null;
};

/**
 * 📣 WHAT AN ACTION SAYS BACK — in the toolbar's own status line, never by
 * opening a box. Owner, live phone test 2026-10-02: the draft panel ("Reset
 * Save the Date…") opened by itself after Apply, would not close, and came back
 * after the next Apply. The panel now opens ONLY from ⋯ › "Reset this stage…";
 * an outcome worth reading is said beside Apply instead — an error, a key Apply
 * held back, Reset's note — so nothing is ever silent and nothing pops up.
 * (Replaces `hubDraftPanelStaysOpen`, which opened the panel on these.)
 */
export type HubDraftOutcome =
  | { kind: 'error'; text: string }
  | { kind: 'live' }
  | { kind: 'held'; held: ReadonlyArray<{ label: string; reason: HubDraftRefusal }> }
  | { kind: 'reset' }
  | null;

export function hubDraftOutcome(result: HubDraftActionResult | null): HubDraftOutcome {
  if (!result) return null;
  if (!result.ok) return { kind: 'error', text: result.error };
  if (result.intent === 'reset') return { kind: 'reset' };
  if (result.intent !== 'apply') return null;
  return result.held.length > 0 ? { kind: 'held', held: result.held } : { kind: 'live' };
}

/** Which typed fact (the names, the date, the name style, the venues, the ceremony time) an `events` key carries — null for every other column. */
export function hubDraftFactOf(column: HubDraftEventColumn): HubDraftFact | null {
  return (HUB_DRAFT_FACT_GROUP as Partial<Record<string, HubDraftFact>>)[column] ?? null;
}

/** A sentence-ready name for each draftable `events` column. */
export const HUB_DRAFT_EVENT_LABEL: Record<HubDraftEventColumn, string> = {
  rsvp_backdrop: 'The RSVP backdrop',
  landing_page_hero_image_url: 'Your hero photo',
  std_reveal_template: 'Your reveal',
  monogram_custom_svg: 'Your logo',
  monogram_studio_config: 'Your logo design',
  reveal_stages: 'Where your reveal plays',
  std_reveal_effects: 'Your reveal’s effects',
  site_bg_color: 'Your background colour',
  site_button_color: 'Your button colour',
  site_art_direction: 'Candlelight',
  site_font_key: 'Your typeface',
  site_magic_traveller: 'Magic move',
  invite_theme: 'Your theme',
  site_bg_music_r2_key: 'Your background music',
  site_bg_music_enabled: 'Background music on or off',
  landing_page_hero_video_r2_key: 'Your hero video',
  our_photos: 'Your photos',
  style_preferences: 'Your QR code',
  special_message: 'Your special message',
  what_to_bring: 'Your reminders',
  love_story: 'Your Love Story',
  together_since: 'Together since',
  dress_code_config: 'Your dress code',
  photo_moments_config: 'Your camera cues',
  rsvp_ask_config: 'What you ask your guests',
  // The names and the date are ONE change each, however many columns carry them.
  display_name: 'Your names',
  bride_name: 'Your names',
  groom_name: 'Your names',
  event_date: 'Your date',
  event_date_precision: 'Your date',
  print_details: 'Your name style',
  // The venues are ONE change however many columns carry them.
  std_film_ceremony_name: 'Your venues',
  ceremony_venue_address: 'Your venues',
  ceremony_venue_latitude: 'Your venues',
  ceremony_venue_longitude: 'Your venues',
  std_film_venue_name: 'Your venues',
  venue_address: 'Your venues',
  venue_latitude: 'Your venues',
  venue_longitude: 'Your venues',
  std_film_venue_city: 'Your venues',
  ceremony_time: 'Your ceremony time',
  papic_on: 'Photos from guests',
  gifts_on: 'Gifts',
  logo_wanted: 'Do you want a logo',
  cover_photo_wanted: 'Your event photo',
};

/** A sentence-ready name for each fixed part whose style is drafted. */
export const FIXED_STYLE_LABEL: Record<FixedStyleScene, string> = {
  entourage: 'The entourage',
  find_your_seat: 'Find your seat',
  photos_of_you: "Each guest's own photos",
  announcements: 'Announcements',
  live_hub: 'The live hub',
};

/** A sentence-ready name for one draft key. */
export function hubDraftItemLabel(item: HubDraftItem, sectionLabel: (t: WidgetType) => string): string {
  if (item.kind === 'event') return HUB_DRAFT_EVENT_LABEL[item.column];
  if (item.kind === 'editorial') return postEventItemLabel(item.item);
  if (item.kind === 'fixed-style') return `${FIXED_STYLE_LABEL[item.scene]} · its style`;
  if (item.field === 'main') return 'Behind every scene';
  if (item.field === 'std_lead') return 'Save the Date · Film or Photos';
  if (item.field === 'custom') return `${sectionLabel(item.widgetType)} · its words`;
  if (item.field === 'venue') return 'Your venues';
  const what =
    item.field === 'mode' || item.field === 'is_visible'
      ? 'shown or hidden'
      : item.field === 'display_order' || item.field === 'stage_order'
        ? 'its place'
        : 'how it looks';
  return `${sectionLabel(item.widgetType)} · ${what}`;
}
