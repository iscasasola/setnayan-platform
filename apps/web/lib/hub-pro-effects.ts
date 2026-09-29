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
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import { sanitizeCustomSection } from '@/lib/custom-sections';
import { HUB_ELEMENT_LABEL, type HubElementKey } from '@/lib/element-style';
import { INVITE_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { hubMainGround, isHubMainFollow, sanitizeHubCanvas, type HubMainGround, type HubSectionCanvas } from '@/lib/hub-canvas';
import {
  canvasFacetGrows,
  canvasLookFacets,
  canvasWithoutFacet,
  planHubDraftApply,
  type CanvasFacetGroup,
  type CanvasLookFacet,
  type HubDraftEventColumn,
  type HubDraftItem,
  type HubDraftPatch,
  type HubDraftState,
  type HubLiveState,
} from '@/lib/hub-draft';

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
  | { kind: 'main' };

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
};

/** One `events` column → what, where and where to go. Only Pro columns reach here. */
function eventEffect(
  column: HubDraftEventColumn,
  value: unknown,
): { what: string; where: string; jump: HubProEffectJump | null } {
  switch (column) {
    case 'invite_theme': {
      const id = normalizeThemeId(value);
      return { what: 'Theme', where: id ? INVITE_THEMES[id].name : 'Your theme', jump: { kind: 'tool', key: 'details' } };
    }
    case 'site_font_key':
      return { what: 'Typeface', where: 'Whole Event Hub', jump: { kind: 'row', key: 'colors' } };
    case 'site_art_direction':
      return { what: 'Candlelight', where: 'Whole Event Hub', jump: { kind: 'row', key: 'colors' } };
    case 'site_magic_traveller':
      return { what: 'Magic move', where: 'Whole Event Hub', jump: { kind: 'row', key: 'colors' } };
    case 'site_bg_color':
      return { what: 'Ombré background', where: 'Whole Event Hub', jump: { kind: 'row', key: 'colors' } };
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
      return { what: 'Hero video', where: 'Hero', jump: { kind: 'row', key: 'music' } };
    case 'our_photos':
      return { what: 'Your photos', where: 'Photos you add', jump: { kind: 'row', key: 'gallery' } };
    case 'style_preferences':
      return { what: 'QR look', where: 'Your QR code', jump: { kind: 'tool', key: 'details' } };
    default:
      return { what: 'Pro look', where: 'Event Hub', jump: null };
  }
}

/** The Main background (hero row) → its name. */
function mainWhat(main: HubMainGround | null): string {
  if (!main) return 'Background';
  if (isHubMainFollow(main)) return 'Adaptive theme';
  return main.kind === 'snippet' ? 'Video background' : 'Photo background';
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
    if (item.kind === 'event') {
      const named = eventEffect(item.column, item.value);
      push({
        id: `event:${item.column}`,
        ...named,
        // A Love Story's moments are words and photos in one value — putting the
        // live one back would throw the words away too, so it is never "removed"
        // from here; "Go to" opens the Love Story, where a photo comes off alone.
        remove: item.column === 'love_story' ? null : { events: { [item.column]: live.events[item.column] ?? null } },
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
        what: mainWhat(item.value as HubMainGround | null),
        where: 'Behind every scene',
        jump: { kind: 'main' },
        remove: { widgets: { [item.widgetType]: { main: liveMain } } as HubDraftPatch['widgets'] },
      });
      continue;
    }
    if (item.field === 'mode' || item.field === 'is_visible') {
      /* 🎬 Owner 2026-09-28 (via the controller): *"they can Add. only pay when
         apply is tirggered"* — named "Added scene · <its template>", the name
         the couple picked it by in the 25-template sheet. */
      const template =
        draft.widgets[item.widgetType]?.canvas?.template ?? sanitizeHubCanvas(row?.config_json).template ?? null;
      push({
        id: `show:${item.widgetType}`,
        what: 'Added scene',
        where: template ? SCENE_TEMPLATES[template].name : scene,
        jump: { kind: 'scene', widgetId: item.widgetId, widgetType: item.widgetType, tab: 'content', stages, ...fixedOf(item.widgetType) },
        remove: {
          widgets: {
            [item.widgetType]: { mode: row?.mode ?? 'auto', is_visible: row?.is_visible ?? true },
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
    if (item.field === 'canvas') {
      for (const effect of canvasEffects(item, row?.config_json, scene, stages)) push(effect);
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
  for (const facet of canvasLookFacets(live, drafted)) {
    if (!canvasFacetGrows(facet)) continue;
    const key = facet.element ? `${facet.group}:${facet.element}` : facet.group;
    groups.set(key, [...(groups.get(key) ?? []), facet]);
  }
  const out: HubProEffect[] = [];
  for (const [key, facets] of groups) {
    const first = facets[0]!;
    const name = GROUP_NAME[first.group];
    const what =
      first.group === 'media' && drafted.kind === 'snippet'
        ? 'Video background'
        : first.group === 'slot-media' && facets.some((f) => drafted.slots?.[f.slot ?? -1]?.kind === 'snippet')
          ? 'Clip in the scene'
          : name.what;
    const where = first.element ? `${HUB_ELEMENT_LABEL[first.element]} on the ${scene}` : scene;
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
        ...(first.element ? { element: first.element } : {}),
        stages,
        ...fixedOf(item.widgetType),
      },
      remove: { widgets: { [item.widgetType]: { canvas: without } } as HubDraftPatch['widgets'] },
    });
  }
  return out;
}

function fixedOf(t: WidgetType): { fixed?: string } {
  const f = FIXED_TILE_OF[t];
  return f ? { fixed: f } : {};
}

/** One line per effect — "Font · Names on the Hero". */
export function hubProEffectLine(e: Pick<HubProEffect, 'what' | 'where'>): string {
  return `${e.what} · ${e.where}`;
}

/** What crosses to the client: the effect without its patch (the server recomputes that). */
export type HubProEffectView = Omit<HubProEffect, 'remove'> & { removable: boolean };

export function hubProEffectView(e: HubProEffect): HubProEffectView {
  const { remove, ...rest } = e;
  return { ...rest, removable: remove !== null };
}

/* ── "UNLOCK PRO AND APPLY" — THE RETURN FROM THE PURCHASE ─────────────────
   Owner 2026-09-28, verbatim, naming the Apply sheet's first button: "Unlock
   Pro and Apply". It goes through the ONE purchase page and asks it to come
   back to the Maker with `?apply=1` (`UNLOCK_AND_APPLY_PARAM`). Back in the
   Maker, this decides — once — what happens: */

/** The purchase page's way back asks the Maker to finish the Apply. */
export const UNLOCK_AND_APPLY_PARAM = 'apply';

/**
 * Back from the purchase:
 *   · 'apply' — Pro is now active (the bar names no Pro effect) and the draft
 *     has changes → press Apply for them, no second tap;
 *   · 'sheet' — still no Pro (cancelled, or the payment is under review) → the
 *     sheet again, the draft untouched, NOTHING applied;
 *   · 'none'  — not a return, or nothing left to apply.
 * The server's Apply is still the gate either way (`lookProAllows`): even a
 * wrong 'apply' here could never publish a Pro effect for a couple without Pro.
 */
export function unlockAndApplyOnReturn(input: {
  asked: boolean;
  proEffects: number;
  hasChanges: boolean;
  storeShell: boolean;
}): 'apply' | 'sheet' | 'none' {
  if (!input.asked || input.storeShell || !input.hasChanges) return 'none';
  return input.proEffects > 0 ? 'sheet' : 'apply';
}

/** The purchase page's address from the Apply sheet: it returns to the Maker to finish the Apply. */
export function unlockAndApplyHref(proHref: string): string {
  return `${proHref}${proHref.includes('?') ? '&' : '?'}then=apply`;
}
