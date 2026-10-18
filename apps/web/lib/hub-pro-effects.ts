/**
 * apps/web/lib/hub-pro-effects.ts
 *
 * 💎 THE EFFECTS THAT NEED PRO, BY NAME AND PLACE — what the Apply sheet lists.
 *
 * Owner, 2026-09-28, verbatim (on the Animate tab's lock panel): *"they can edit
 * it with pro features. but need to upgrade to pro when clicked on apply and
 * point out the effect chosen that caused them to upgrade to pro"* — DECISION_LOG
 * "A FREE COUPLE MAY USE EVERY PRO FEATURE IN THE MAKER — PRO IS ASKED FOR AT
 * APPLY, NAMING THE EFFECTS THAT NEED IT".
 *
 * ── 🔑 ONE SOURCE OF TRUTH, NOT A SECOND LIST ──────────────────────────────
 * This file decides NOTHING about what is Pro. It takes the refused half of the
 * very plan Apply runs (`planHubDraftApply` in `lib/hub-draft.ts`, asked as a
 * couple WITHOUT Pro) and names each refused item. A refused scene canvas is
 * named facet by facet through `canvasLookFacets` — the same comparison
 * `canvasLookChange` folds into one answer — so a list here can never name a
 * thing the gate lets through, nor miss a thing the gate holds.
 * (`lib/hub-pro-effects.test.ts` holds that: the effects are exactly the refused
 * items, and removing every effect leaves a draft the plan refuses nothing of.)
 *
 * ── REMOVE ────────────────────────────────────────────────────────────────
 * Each effect carries the draft patch that takes it OFF — the drafted value put
 * back to what guests see today, for that effect only (`canvasWithoutFacet` for
 * a scene). The server recomputes the list from the stored draft before it
 * writes one (`hubDraftAction` intent `drop`), so a stale sheet cannot write an
 * old canvas over a newer edit.
 *
 * PURE. No I/O, no server imports — the bar's loader, the one server action and
 * the tests all call it with what they already read.
 */
import { WIDGET_PHASES, type LifecyclePhase, type WidgetType } from '@/lib/invitation-widgets';
import { MAKER_TOOL_EDITOR_NAME, makerSceneLabel, type MakerFixedKey } from '@/lib/maker-scene-list';
import { PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import { STAGE_SHOW_KEY, configWithStageShow } from '@/lib/stage-scenes';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import { sceneStyleSet, sceneStyleTypeOfWidget } from '@/lib/scene-styles';
import { sanitizeCustomSection } from '@/lib/custom-sections';
import { PALETTE_LOOKS } from '@/lib/palette-looks';
import { makerPartWordAt, makerPartWordOfStyle } from '@/lib/hub-draft-change-lines';
import { CAMERA_LOOK_LABEL } from '@/lib/camera-look';
import { celebrationDraftIsPro } from '@/lib/rsvp-celebration';
import { DOS_LOOKS } from '@/lib/dress-code-looks';
import { HUB_ELEMENT_LABEL, HUB_EL_REVEAL_LABEL, hubElementEffectNames, type HubElementKey } from '@/lib/element-style';
import { INVITE_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { ART_KIT_IS_PRO, ART_KIT_ORNAMENTS } from '@/lib/art-kit-pro';
import { ACCENT_NONE, ACCENT_SCENES, ACCENT_SCENE_LABEL, SCENE_ACCENTS_PREF_KEY, accentsTurnOn, resolvedAccent, sceneAccentsFromPreferences, type SceneAccents } from '@/lib/art-kit-accents';
import { HUB_DURING_LABEL, hubMainGround, isHubMainChoice, isHubMainFollow, isHubMainLoop, sanitizeHubCanvas, type HubMainGround, type HubSectionCanvas } from '@/lib/hub-canvas';
import {
  canvasFacetGrows,
  canvasLookFacets,
  canvasWithoutFacet,
  draftVenueChoices,
  FIXED_STYLE_LABEL,
  heldStageShow,
  blockMotionsGrowing,
  mainEffectChange,
  mainGroundChange,
  withoutEffect,
  cameraLookOfDraft,
  rsvpLookGrowing,
  stylePreferencesProParts,
  planHubDraftApply,
  venueBagNewDrawings,
  rsvpAskFreePart,
  rsvpAskFreePartMoves,
  type CanvasFacetGroup,
  type CanvasLookFacet,
  type HubDraftEventColumn,
  type HubDraftItem,
  type HubDraftPatch,
  type HubDraftState,
  type HubDraftVenueChoices,
  type HubLiveState,
} from '@/lib/hub-draft';
import { sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import { RSVP_CELEBRATION_LABEL, RSVP_CELEBRATION_NAME, readCelebrationKey } from '@/lib/rsvp-celebration';
import { HUB_ELEMENT_PRO_FIELDS } from '@/lib/hub-look-pro';
import { postEventArrangementOf, sceneLooksFreePart, type PostEventSceneLooks } from '@/lib/post-event-draft';
import { POST_EVENT_SCENE_TYPE_LABEL, postEventSceneTypeOf } from '@/lib/post-event-styles';
import { postEventPreset } from '@/lib/post-event-presets';
import { STORY_PRO_EXTRA_LABEL, storyProExtrasOf } from '@/lib/story-pro-extras';
import { hubProEffectLine, UNLOCK_AND_APPLY_PARAM, unlockAndApplyHref, unlockAndApplyOnReturn, type HubProEffectView } from '@/lib/hub-pro-effect-view';

/** Where "Go to" takes the couple in the Maker (a `MakerSelection`, plus a part). */
export type HubProEffectJump =
  | {
      kind: 'scene';
      widgetId: string;
      widgetType: WidgetType;
      /** The inspector tab that holds the control. */
      tab: 'format' | 'animate' | 'content';
      /** The part whose own font or motion it is — the Part sheet opens on it. */
      element?: HubElementKey;
      /** The stages the scene appears on — the Maker moves to the first if it is elsewhere. */
      stages: readonly LifecyclePhase[];
      /**
       * An always-on scene is a FIXED tile in the navigator (`lib/maker-scene-list.ts`),
       * selected as its own panel `f:<fixed>` — never as a scene by id.
       */
      fixed?: string;
    }
  | { kind: 'row'; key: string }
  | { kind: 'tool'; key: 'hero' | 'reveal' | 'love-story' | 'details' | 'logo' }
  /** 🎨 The toolbar's Look — background, font, colours and buttons (`lib/maker-look-sections.ts`). */
  | { kind: 'look' };

export type HubProEffect = {
  /** Stable within one draft: what `drop` names. */
  id: string;
  /** What it is — "Font", "Animation", "Photo background", "Theme". */
  what: string;
  /** Where it is — "Names on the Hero", "Schedule", "Velvet". */
  where: string;
  jump: HubProEffectJump | null;
  /** The patch that takes it off the draft, or null when it cannot be taken off alone. */
  remove: HubDraftPatch | null;
};

/* ── NAMES ───────────────────────────────────────────────────────────────── */

/**
 * The name the couple knows a scene by: the navigator's, except the hero, which
 * the Maker opens as "Hero" (its editor's name) — the owner's own words for it
 * ("Font · Names on the Hero").
 */
const sectionLabel = (t: WidgetType): string => (t === 'hero' ? MAKER_TOOL_EDITOR_NAME.hero : makerSceneLabel(t));

/** The always-on sections and the fixed tile each is in the navigator (`maker-scene-list.ts`). */
const FIXED_TILE_OF: Partial<Record<WidgetType, MakerFixedKey>> = {
  hero: 'hero',
  greeting: 'greeting',
  qr_card: 'pass',
  rsvp: 'rsvp',
};

/** A scene canvas facet group → the word the sheet shows, and the tab that holds it. */
const GROUP_NAME: Record<CanvasFacetGroup, { what: string; tab: 'format' | 'animate' | 'content' }> = {
  media: { what: 'Photo background', tab: 'format' },
  crop: { what: 'Photo crop', tab: 'format' },
  layout: { what: 'Layout', tab: 'format' },
  motion: { what: 'Animation', tab: 'animate' },
  transition: { what: 'Transition', tab: 'animate' },
  font: { what: 'Font', tab: 'format' },
  'part-motion': { what: 'Animation', tab: 'animate' },
  'slot-media': { what: 'Photo in the scene', tab: 'content' },
  playback: { what: 'Clip playback', tab: 'content' },
  /* 💎 The scene's Pro look, named by the look ("Look · Two-lane timeline" is said by `where`). */
  look: { what: 'Look', tab: 'format' },
  /* 💎 A part's own Style (2026-10-16) — named by what moved: "Colour · Size". */
  'part-style': { what: 'Style', tab: 'format' },
};

/** 💎 A part's Style field → the word the Maker's own control says (Style's row and the part sheet). */
const PART_STYLE_WORD: Readonly<Record<string, string>> = {
  font: 'Font',
  color: 'Colour',
  size: 'Size',
  weight: 'Weight',
  italic: 'Italic',
  underline: 'Underline',
  align: 'Alignment',
  width: 'Width',
  leading: 'Line spacing',
  tracking: 'Letter spacing',
  runs: 'Letters',
};

/** The words for a set of part-style facets, in the Maker's order, each once. */
function partStyleWhat(facets: readonly CanvasLookFacet[]): string {
  const fields = new Set(facets.map((f) => f.key.split(':')[2] ?? ''));
  const words = Object.keys(PART_STYLE_WORD).filter((k) => fields.has(k)).map((k) => PART_STYLE_WORD[k]!);
  return words.length > 0 ? words.join(' · ') : 'Style';
}

/** One `events` column → what, where and where to go. Only Pro columns reach here. */
function eventEffect(
  column: HubDraftEventColumn,
  value: unknown,
  accents: SceneAccents = {},
): { what: string; where: string; jump: HubProEffectJump | null } {
  switch (column) {
    case 'invite_theme': {
      const id = normalizeThemeId(value);
      /* 🕯 A look that brings an art kit says so while its Decorations are on and Pro (owner 2026-10-16: "Name it
         'Decorations' in the Apply sheet's Pro lines") — one line, the theme's, since paying for the theme is what
         brings them: "Theme · Vintage, with its Decorations". */
      const withKit =
        id !== null &&
        ART_KIT_IS_PRO &&
        ART_KIT_ORNAMENTS.includes(INVITE_THEMES[id].ornament) &&
        ACCENT_SCENES.some((sc) => resolvedAccent(sc, accents, id) !== ACCENT_NONE);
      return { what: 'Theme', where: id ? `${INVITE_THEMES[id].name}${withKit ? ', with its Decorations' : ''}` : 'Your theme', jump: { kind: 'look' } };
    }
    case 'site_font_key':
      return { what: 'Typeface', where: 'Whole Event Hub', jump: { kind: 'look' } };
    case 'site_art_direction':
      return { what: 'Candlelight', where: 'Whole Event Hub', jump: { kind: 'look' } };
    case 'site_magic_traveller':
      /* ✈ The cover Logo's Action (Look restudy row 9) — named and jumped to where it now lives. */
      return { what: 'Travels to the bar', where: 'Logo', jump: { kind: 'tool', key: 'hero' } };
    case 'site_bg_color':
      return { what: 'Ombré background', where: 'Whole Event Hub', jump: { kind: 'look' } };
    case 'rsvp_backdrop':
      return { what: 'Moving backdrop', where: 'Invitation', jump: { kind: 'row', key: 'backdrop' } };
    case 'landing_page_hero_image_url':
      return { what: 'Your photo', where: 'Hero', jump: { kind: 'tool', key: 'hero' } };
    case 'std_reveal_template':
      return { what: 'Reveal', where: 'Save the Date', jump: { kind: 'tool', key: 'reveal' } };
    case 'std_reveal_effects':
      return { what: 'Reveal effects', where: 'Save the Date', jump: { kind: 'tool', key: 'reveal' } };
    case 'love_story':
      return { what: 'Photos or chapters', where: 'Love Story', jump: { kind: 'tool', key: 'love-story' } };
    // 💎 The last three Pro tools (owner 2026-09-29, "yes to all 3").
    case 'site_bg_music_r2_key':
      return { what: 'Background music', where: 'Whole Event Hub', jump: { kind: 'row', key: 'music' } };
    case 'landing_page_hero_video_r2_key':
      /* 🎬 Set in Look › Background since 2026-10-08 (it was under Music). */
      return { what: 'Hero video', where: 'Hero', jump: { kind: 'look' } };
    case 'our_photos':
      return { what: 'Your photos', where: 'Photos you add', jump: { kind: 'row', key: 'gallery' } };
    case 'style_preferences':
      return { what: 'QR look', where: 'Your QR code', jump: { kind: 'tool', key: 'details' } };
    // 🎉 The When yes celebration (owner 2026-10-06) — named by the pick.
    case 'rsvp_ask_config':
      return {
        what: `${RSVP_CELEBRATION_LABEL} · ${RSVP_CELEBRATION_NAME[readCelebrationKey(sanitizeRsvpAskConfig(value))]}`,
        where: 'RSVP · When yes',
        jump: null,
      };
    default:
      return { what: 'Pro look', where: 'Event Hub', jump: null };
  }
}

/**
 * 🎉 A held RSVP config → its line: the When yes celebration by its pick, and — 💎 since 2026-10-16 — a reply line's
 * Style or a line's / card's Build in, named by the Maker's own words ("Style", "Animation").
 */
function rsvpEffect(live: unknown, value: unknown): { what: string; where: string; jump: HubProEffectJump | null } {
  const words: string[] = [];
  if (celebrationDraftIsPro(live, value)) words.push(`${RSVP_CELEBRATION_LABEL} · ${RSVP_CELEBRATION_NAME[readCelebrationKey(sanitizeRsvpAskConfig(value))]}`);
  const growing = rsvpLookGrowing(live, value);
  if (growing.some((k) => /\|[cfsl]$/.test(k))) words.push('Style');
  if (growing.some((k) => /\|[iv]$/.test(k))) words.push('Animation');
  return { what: words.join(' · ') || RSVP_CELEBRATION_LABEL, where: celebrationDraftIsPro(live, value) ? 'RSVP · When yes' : 'RSVP', jump: null };
}

/** The Main background (hero row) → its name. */
function mainWhat(main: HubMainGround | null): string {
  if (isHubMainLoop(main)) return 'Moving background';
  if (!main || isHubMainChoice(main)) return 'Background';
  if (isHubMainFollow(main)) return 'Adaptive theme';
  return main.kind === 'snippet' ? 'Video background' : 'Photo background';
}

/**
 * ✨ The Main background's line: its name, and "Effect" when the effect on it is new or changed (owner 2026-10-16: every
 * effect is Pro) — "Effect" alone when that is all that changed, "Photo background · Effect" when both did. The word,
 * not the effect's own name: the names live with the engine (`lib/ambient-effects.ts`), which the Maker's first load
 * does not carry (the Animate line says "Animation" for the same reason).
 */
function mainLineWhat(live: HubMainGround | null, next: HubMainGround | null): string {
  const fx = mainEffectChange(live, next);
  if (fx !== 'add' && fx !== 'change') return mainWhat(next);
  const bare = (m: HubMainGround | null) => (m ? withoutEffect(m) : m);
  const rest = mainGroundChange(bare(live), bare(next));
  return rest === 'add' || rest === 'change' ? `${mainWhat(next)} · Effect` : 'Effect';
}

/* ── THE LIST ────────────────────────────────────────────────────────────── */

/**
 * Every Pro effect this draft holds that a couple WITHOUT Event Hub Pro could
 * not Apply, by name and place, in the order Apply meets them.
 *
 * `ownsPro` is the caller's measured entitlement (as the viewer is shown it —
 * the bar's `asViewed` read): an owning couple gets `[]`, because nothing is
 * refused.
 */
export function hubDraftProEffects(draft: HubDraftState, live: HubLiveState, ownsPro: boolean): HubProEffect[] {
  const { refused } = planHubDraftApply(draft, live, ownsPro);
  const out: HubProEffect[] = [];
  const seen = new Set<string>();
  const push = (e: HubProEffect) => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push(e);
  };

  for (const item of refused) {
    if (item.kind === 'editorial') {
      const f = item.item.field;
      if (f === 'chapterOverrides' || f === 'customColumns' || f === 'reviews') {
        /* 💎 A story extra tried free in the story workroom — named by what the
           couple wrote; "Remove" puts back what guests read today. */
        push({
          id: `story:${f}`,
          what: STORY_PRO_EXTRA_LABEL[f],
          where: 'Post Event · your story',
          jump: null,
          remove: { editorial: { [f]: storyProExtrasOf(live.editorial ?? null)[f] } as HubDraftPatch['editorial'] },
        });
        continue;
      }
      for (const effect of postEventEffects(f === 'sceneLooks' ? item.item.value : null, live)) push(effect);
      continue;
    }
    // 🎨 A fixed part's style card (💎 Pro since 2026-10-16 unless it is the theme's own) — named by the card, where the
    // Maker names the part; "Remove" puts back the card guests see today.
    if (item.kind === 'fixed-style') {
      push({
        id: `fixed-style:${item.scene}`,
        what: sceneStyleSet(item.scene)?.styles.find((st) => st.id === item.value)?.name ?? 'Look',
        where: makerPartWordOfStyle(item.scene) ?? FIXED_STYLE_LABEL[item.scene],
        jump: null,
        remove: { fixedStyles: { [item.scene]: live.fixedStyles?.[item.scene] ?? null } },
      });
      continue;
    }
    // 🚶 …and so is every Wedding March move.
    if (item.kind === 'march') continue;
    if (item.kind === 'event') {
      const liveAccents = sceneAccentsFromPreferences(live.events.style_preferences ?? null);
      const draftAccents = { ...liveAccents, ...sceneAccentsFromPreferences(draft.events.style_preferences ?? null) };
      /* 🕯 A scene's accent turned on is named for what it is (owner 2026-10-16: "Name it 'Decorations'"), with the
         scenes it dresses — the same rule that refused it (`accentsTurnOn`). */
      const turned =
        item.column === 'style_preferences' && item.value && typeof item.value === 'object' && SCENE_ACCENTS_PREF_KEY in item.value
          ? accentsTurnOn(liveAccents, sceneAccentsFromPreferences(item.value))
          : [];
      /* 💎 Every Pro part of the blob, by the same rule that held it (`stylePreferencesProParts`, 2026-10-16): the QR,
         the Decorations, a camera look that is not Classic, a block's new motion. */
      const parts = item.column === 'style_preferences' ? stylePreferencesProParts(live.events.style_preferences ?? null, item.value) : [];
      const prefWhat = (): string => {
        const words: string[] = [];
        if (parts.includes('accents')) words.push('Decorations');
        if (parts.includes('qr')) words.push('QR look');
        if (parts.includes('camera')) {
          const cam = cameraLookOfDraft(item.value);
          words.push(cam ? `Camera look · ${CAMERA_LOOK_LABEL[cam]}` : 'Camera look');
        }
        if (parts.includes('blocks')) words.push('Animation');
        return words.length <= 2 ? words.join(' and ') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
      };
      const named =
        turned.length > 0
          ? {
              what: prefWhat(),
              where: turned.map((sc) => ACCENT_SCENE_LABEL[sc]).join(', '),
              jump: null,
            }
          : parts.length > 0 && !(parts.length === 1 && parts[0] === 'qr')
            ? {
                what: prefWhat(),
                where: parts.includes('blocks')
                  ? blockMotionsGrowing(live.events.style_preferences ?? null, item.value).map((b) => makerPartWordAt(`f:${b}`) ?? b).join(', ')
                  : 'Camera',
                jump: null,
              }
            : item.column === 'rsvp_ask_config'
              ? rsvpEffect(live.events.rsvp_ask_config ?? null, item.value)
              : eventEffect(item.column, item.value, draftAccents);
      push({
        id: `event:${item.column}`,
        ...named,
        // A Love Story's moments are words and photos in one value — putting the
        // live one back would throw the words away too, so it is never "removed"
        // from here; "Go to" opens the Love Story, where a photo comes off alone.
        remove:
          item.column === 'love_story'
            ? null
            : item.column === 'rsvp_ask_config'
              ? /* 🎉 Taking the celebration off keeps the RSVP's drafted words and
                   switches — or, when nothing else was drafted, puts back live. */
                {
                  events: {
                    rsvp_ask_config: rsvpAskFreePartMoves(live.events.rsvp_ask_config ?? null, item.value)
                      ? rsvpAskFreePart(live.events.rsvp_ask_config ?? null, item.value)
                      : (live.events.rsvp_ask_config ?? null),
                  },
                }
              : { events: { [item.column]: live.events[item.column] ?? null } },
      });
      continue;
    }
    const row = live.widgets.find((r) => r.widget_id === item.widgetId);
    const scene = sectionLabel(item.widgetType);
    const stages = PUBLIC_STAGE_ORDER.filter((st) => (WIDGET_PHASES[item.widgetType] ?? []).includes(st));
    if (item.field === 'main') {
      const liveMain = row ? hubMainGround(row.config_json) : null;
      push({
        id: 'main',
        what: mainLineWhat(liveMain, item.value as HubMainGround | null),
        where: 'Behind every scene',
        jump: { kind: 'look' },
        remove: { widgets: { [item.widgetType]: { main: liveMain } } as HubDraftPatch['widgets'] },
      });
      continue;
    }
    if (item.field === 'mode' || item.field === 'is_visible' || item.field === 'stage_show') {
      /* 🎬 Owner 2026-09-28 (via the controller): *"they can Add. only pay when
         apply is tirggered"* — named "Added scene · <its template>", the name
         the couple picked it by in the 25-template sheet. */
      const template =
        draft.widgets[item.widgetType]?.canvas?.template ?? sanitizeHubCanvas(row?.config_json).template ?? null;
      /* 🎞 A Post Event preset is named by the preset the couple picked it by
         ("Post Event scene · The Toast"), not by the template under it. */
      const preset = postEventPreset(
        draft.widgets[item.widgetType]?.canvas?.postEventPreset ?? sanitizeHubCanvas(row?.config_json).postEventPreset,
      );
      push({
        id: `show:${item.widgetType}`,
        what: preset ? 'Post Event scene' : 'Added scene',
        where: preset ? preset.name : template ? SCENE_TEMPLATES[template].name : scene,
        // A preset lives on Post Event only (`widgetsGuestsMeet`) — Go to lands there.
        jump: { kind: 'scene', widgetId: item.widgetId, widgetType: item.widgetType, tab: 'content', stages: preset ? ['editorial'] : stages, ...fixedOf(item.widgetType) },
        remove: {
          widgets: {
            [item.widgetType]: {
              mode: row?.mode ?? 'auto',
              is_visible: row?.is_visible ?? true,
              /* 👁 A scene shown stage by stage goes back stage by stage: each to
                 what is live. Only when the draft holds such a choice. */
              ...(draft.widgets[item.widgetType]?.stage_show
                ? { stage_show: heldStageShow(configWithStageShow(row?.config_json, {})[STAGE_SHOW_KEY]) }
                : {}),
            },
          } as HubDraftPatch['widgets'],
        },
      });
      continue;
    }
    if (item.field === 'custom') {
      // ✍ Words in a scene of their own that is empty live — the words go back
      // to what guests see (nothing), never anything else of the scene.
      const liveWords = sanitizeCustomSection(row?.config_json);
      push({
        id: `words:${item.widgetType}`,
        what: 'Words',
        where: scene,
        jump: { kind: 'scene', widgetId: item.widgetId, widgetType: item.widgetType, tab: 'content', stages, ...fixedOf(item.widgetType) },
        remove: {
          widgets: {
            [item.widgetType]: { custom: liveWords.title || liveWords.body ? liveWords : null },
          } as HubDraftPatch['widgets'],
        },
      });
      continue;
    }
    if (item.field === 'venue') {
      /* ⛪ "Our drawing ◆" on a venue card (owner 2026-10-16) — one effect per
         card whose drawing the draft turns on. "Remove" takes the drawing off
         that card only, keeping its drafted photo and source; with nothing else
         drafted on the card it says "no photo" (`ownPhoto: null`), which reads
         exactly as a card with no choice (`venuePhotoFor`). */
      const liveCfg = row?.config_json;
      const liveBag = draftVenueChoices(liveCfg && typeof liveCfg === 'object' && !Array.isArray(liveCfg) ? (liveCfg as Record<string, unknown>).venue : null);
      const nextBag = item.value as HubDraftVenueChoices;
      for (const slot of venueBagNewDrawings(liveBag, nextBag)) {
        const { drawing: _drawing, ...rest } = nextBag[slot] ?? {};
        void _drawing;
        push({
          id: `venue-drawing:${slot}`,
          what: 'Our drawing',
          where: slot === 'ceremony' ? 'Ceremony venue' : 'Venue',
          jump: { kind: 'tool', key: 'details' },
          remove: {
            widgets: {
              [item.widgetType]: { venue: { [slot]: Object.keys(rest).length ? rest : { ownPhoto: null } } },
            } as HubDraftPatch['widgets'],
          },
        });
      }
      continue;
    }
    if (item.field === 'canvas') {
      for (const effect of canvasEffects(item, row?.config_json, scene, stages)) push(effect);
    }
  }
  return out;
}

/**
 * 📖 A refused Post Event look (`sceneLooks`) → one effect per scene part whose
 * OWN font or animation is new — the only Pro in a Post Event scene (show/hide,
 * order, styles and words are free). Asked the same way the plan asks it:
 * `sceneLooksFreePart` is what Apply writes for a couple without Pro, so a part
 * whose free write differs from its drafted one is exactly what the plan holds.
 * "Remove" puts that one field back to what guests see today, for that part
 * only; "Go to" opens the scene's tile (`p:<scene>`) in the navigator.
 */
function postEventEffects(drafted: PostEventSceneLooks | null, live: HubLiveState): HubProEffect[] {
  if (!drafted) return [];
  const liveLooks = postEventArrangementOf(live.editorial ?? null).sceneLooks;
  const out: HubProEffect[] = [];
  for (const [key, look] of Object.entries(drafted)) {
    const freeLook = sceneLooksFreePart(liveLooks, { [key]: look })[key];
    const type = postEventSceneTypeOf(key);
    const where = (type && POST_EVENT_SCENE_TYPE_LABEL[type]) || 'Post Event';
    /* 💎 The scene's style card (2026-10-16) — named by the card. "Remove" puts back the style guests see today. */
    if (look.style && look.style !== freeLook?.style) {
      const liveStyle = liveLooks[key]?.style;
      const { style: _s, ...without } = look;
      void _s;
      out.push({
        id: `pe:${key}:style`,
        what: sceneStyleSet(type)?.styles.find((st) => st.id === look.style)?.name ?? 'Look',
        where,
        jump: { kind: 'row', key: `p:${key === 'chapters' ? 'ch-1' : key}` },
        remove: { editorial: { sceneLooks: { ...drafted, [key]: liveStyle ? { ...without, style: liveStyle } : without } as PostEventSceneLooks } },
      });
    }
    for (const [part, style] of Object.entries(look.elements ?? {}) as Array<[HubElementKey, Record<string, unknown>]>) {
      const free = (freeLook?.elements?.[part] ?? {}) as Record<string, unknown>;
      for (const field of HUB_ELEMENT_PRO_FIELDS) {
        if (JSON.stringify(style[field]) === JSON.stringify(free[field])) continue;
        const backed: Record<string, unknown> = { ...style };
        if (free[field] === undefined) delete backed[field];
        else backed[field] = free[field];
        out.push({
          id: `pe:${key}:${part}:${field}`,
          /* 💎 Its motion, or — since 2026-10-16 — its Style, named by the Maker's own word ("Colour"). */
          what: field === 'motion' ? 'Animation' : (PART_STYLE_WORD[field] ?? 'Style'),
          where: `${HUB_ELEMENT_LABEL[part]} on ${where}`,
          jump: { kind: 'row', key: `p:${key === 'chapters' ? 'ch-1' : key}` },
          remove: {
            editorial: {
              sceneLooks: { ...drafted, [key]: { ...look, elements: { ...look.elements, [part]: backed } } } as PostEventSceneLooks,
            },
          },
        });
      }
    }
  }
  return out;
}

/** A refused scene canvas → one effect per Pro facet group (per part, for a part's own). */
function canvasEffects(
  item: Extract<HubDraftItem, { kind: 'widget' }>,
  liveConfig: unknown,
  scene: string,
  stages: readonly LifecyclePhase[],
): HubProEffect[] {
  const live = sanitizeHubCanvas(liveConfig);
  const drafted = (item.value as HubSectionCanvas | null) ?? {};
  const groups = new Map<string, CanvasLookFacet[]>();
  for (const facet of canvasLookFacets(live, drafted, item.widgetType)) {
    if (!canvasFacetGrows(facet)) continue;
    /* 💎 A scene's Style row colours and sizes EVERY word it draws (label · heading · words — `part-look.ts`), so one
       pick is one line for the scene; a cover part (and the closing) is its own words, one line each. */
    const perScene = facet.group === 'part-style' && item.widgetType !== 'hero';
    const key = facet.element && !perScene ? `${facet.group}:${facet.element}` : facet.group;
    groups.set(key, [...(groups.get(key) ?? []), facet]);
  }
  const out: HubProEffect[] = [];
  for (const [key, facets] of groups) {
    const first = facets[0]!;
    const name = GROUP_NAME[first.group];
    const what =
      first.group === 'part-style'
        ? partStyleWhat(facets)
        : first.group === 'look'
        ? /* 💎 The Pro look by its own name — "Two-lane timeline" — and the Dress code's palette / Do's & Don'ts looks by theirs. */
          lookNames(drafted, facets, item.widgetType) || name.what
        : first.group === 'media' && drafted.kind === 'snippet'
        ? 'Video background'
        : first.group === 'slot-media' && facets.some((f) => drafted.slots?.[f.slot ?? -1]?.kind === 'snippet')
          ? 'Clip in the scene'
          : /* ✨ A part's new effects are named as themselves — Shimmer, and the six (Word by word · Spread · Glow · Develop ·
               Curtain · Light leak), owner 2026-10-16: "all animate, effects, styles, accents are pro". */
            first.group === 'part-motion' && first.element && hubElementEffectNames(drafted.elements?.[first.element]?.motion).length > 0
            ? hubElementEffectNames(drafted.elements?.[first.element]?.motion).join(' · ')
            : /* ✨ …and a scene's own on its pictures — Develop · Curtain · Light leak (owner 2026-10-17). */
              first.group === 'motion' && sceneEffectNames(drafted, facets).length > 0
              ? sceneEffectNames(drafted, facets).join(' · ')
              : name.what;
    /* 🕯 The closing's line is stored on the hero row but is no part of the cover — named, and reached, as itself. */
    const closing = first.element === 'closing';
    const where = closing ? HUB_ELEMENT_LABEL.closing : first.element && !(first.group === 'part-style' && item.widgetType !== 'hero') ? `${HUB_ELEMENT_LABEL[first.element]} on the ${scene}` : scene;
    let without = drafted;
    for (const f of facets) without = canvasWithoutFacet(live, without, f);
    out.push({
      id: `canvas:${item.widgetType}:${key}`,
      what,
      where,
      jump: {
        kind: 'scene',
        widgetId: item.widgetId,
        widgetType: item.widgetType,
        tab: name.tab,
        ...(first.element && !(first.group === 'part-style' && item.widgetType !== 'hero') ? { element: first.element } : {}),
        stages,
        ...(closing ? { fixed: 'closing' } : fixedOf(item.widgetType)),
      },
      remove: { widgets: { [item.widgetType]: { canvas: without } } as HubDraftPatch['widgets'] },
    });
  }
  return out;
}

/** 💎 The style cards a scene's 'look' facets name — its scene look, its palette look, its Do's & Don'ts look. */
function lookNames(drafted: HubSectionCanvas, facets: readonly CanvasLookFacet[], widgetType: WidgetType): string {
  const keys = new Set(facets.map((f) => f.key));
  const out: string[] = [];
  if (keys.has('style')) {
    const n = sceneStyleSet(sceneStyleTypeOfWidget(widgetType))?.styles.find((st) => st.id === drafted.style)?.name;
    if (n) out.push(n);
  }
  if (keys.has('palette')) {
    const n = PALETTE_LOOKS.find((l) => l.id === drafted.palette)?.name;
    if (n) out.push(n);
  }
  if (keys.has('dos')) {
    const n = DOS_LOOKS.find((l) => l.id === drafted.dos)?.name;
    if (n) out.push(n);
  }
  return out.join(' · ');
}

/** ✨ The new effects a scene's own motion facets carry, by their own names (only where that facet is what changed). */
function sceneEffectNames(drafted: HubSectionCanvas, facets: readonly CanvasLookFacet[]): string[] {
  const keys = new Set(facets.map((f) => f.key));
  const out: string[] = [];
  if (keys.has('reveal') && drafted.reveal) out.push(HUB_EL_REVEAL_LABEL[drafted.reveal]);
  if (keys.has('during') && drafted.during === 'leak') out.push(HUB_DURING_LABEL.leak);
  return out;
}

function fixedOf(t: WidgetType): { fixed?: string } {
  const f = FIXED_TILE_OF[t];
  return f ? { fixed: f } : {};
}

export function hubProEffectView(e: HubProEffect): HubProEffectView {
  const { remove, ...rest } = e;
  return { ...rest, removable: remove !== null };
}

/* The client's half (the effect's line, the view type, the Unlock-and-Apply
   return) lives in `lib/hub-pro-effect-view.ts` — see its docblock. */
export { hubProEffectLine, UNLOCK_AND_APPLY_PARAM, unlockAndApplyHref, unlockAndApplyOnReturn, type HubProEffectView };
