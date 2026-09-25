/**
 * apps/web/lib/scene-writes.ts — WHAT ONE SCENE EDIT DOES TO THE STORED CANVAS.
 *
 * The pure half of `saveCustomSection`'s scene intents (`template` · `slot` ·
 * `video`) and `addCustomSection`'s template pick, so a unit test can hold the
 * rules without a database. A `'use server'` module may export only async
 * functions, which is why this lives beside it rather than in it.
 *
 * Every function takes a SANITIZED canvas and returns the next one, which the
 * action runs through `sanitizeHubCanvas` once more on the way to the row — the
 * same one fence on the way in and on the way out.
 */
import { HUB_CANVAS_MOTION_KEYS } from '@/lib/hub-look-pro';
import {
  HUB_SLOT_HEAD_MAX,
  HUB_SLOT_TEXT_MAX,
  hubMediaRef,
  type HubSceneSlot,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';
import { SCENE_MAX_SLOTS, sceneTemplateDefaults, type SceneTemplateId } from '@/lib/scene-templates';

/**
 * PICK (OR CHANGE TO) A TEMPLATE.
 *
 * `withMotion` = the event owns Event Hub Pro. Then the template's default
 * motion and transition REPLACE whatever motion the scene had — the owner's
 * "every scene template comes with a default effect", and choosing a template
 * again is also how "Reset to template default" happens. Without Pro only the
 * template changes; the scene keeps what it had (a free couple may always keep
 * or take off a look, never put one on).
 *
 * 🔑 THE SLOTS STAY. A couple who tries Grid of four and goes back to Three
 * mosaic gets their three photos back — the "Words only keeps the photo"
 * rule the arrangements already follow. Slots past the new template's count are
 * kept, not drawn.
 */
export function applySceneTemplate(
  canvas: HubSectionCanvas,
  id: SceneTemplateId,
  withMotion: boolean,
): HubSectionCanvas {
  const next: Record<string, unknown> = { ...canvas };
  if (withMotion) for (const k of HUB_CANVAS_MOTION_KEYS) delete next[k];
  // The arrangement belongs to the pre-template layout; a template places its own pictures.
  delete next.arrangement;
  // A free-placement layout was made for the OLD template's slots; it does not carry over.
  delete next.free;
  return { ...(next as HubSectionCanvas), ...sceneTemplateDefaults(id, withMotion) };
}

export type SlotPatch = {
  /** `undefined` = leave it; `''` = take the picture off; a ref = put it up. */
  media?: string;
  kind?: 'photo' | 'snippet';
  /** `undefined` = leave the words; a string (possibly empty) = set them. */
  head?: string;
  text?: string;
};

export type SlotWrite =
  | { ok: true; canvas: HubSectionCanvas; putsMediaUp: boolean }
  | { ok: false; reason: 'bad_slot' | 'too_long' | 'not_your_photo' };

/**
 * FILL (OR EMPTY) ONE SLOT.
 *
 * ⛔ OVER THE LIMIT IS REFUSED, NEVER CUT — the custom-section rule, said at the
 * door while the couple is still there to be told.
 * 🔒 A PICTURE MUST BE ONE OF THEIRS (`ownRefs`: their hero, their gallery,
 * their hero clip), held to the public bucket by `hubMediaRef` first — the
 * background's fence, reused, never a second one.
 * `putsMediaUp` tells the action whether this write needs Event Hub Pro
 * (putting media into a scene is Pro; taking it off never is).
 */
export function applySceneSlot(
  canvas: HubSectionCanvas,
  index: number,
  patch: SlotPatch,
  ownRefs: ReadonlySet<string>,
): SlotWrite {
  if (!Number.isInteger(index) || index < 0 || index >= SCENE_MAX_SLOTS) return { ok: false, reason: 'bad_slot' };
  const slots: HubSceneSlot[] = [...(canvas.slots ?? [])];
  while (slots.length <= index) slots.push({});
  const slot: HubSceneSlot = { ...slots[index] };
  let putsMediaUp = false;

  if (patch.media !== undefined) {
    if (patch.media === '') {
      delete slot.media;
      delete slot.kind;
    } else {
      const ref = hubMediaRef(patch.media);
      if (!ref || !ownRefs.has(ref)) return { ok: false, reason: 'not_your_photo' };
      putsMediaUp = ref !== slot.media || (patch.kind === 'snippet') !== (slot.kind === 'snippet');
      slot.media = ref;
      if (patch.kind === 'snippet') slot.kind = 'snippet';
      else delete slot.kind;
    }
  }
  const norm = (v: string) => v.replace(/\r\n?/g, '\n').trim();
  if (patch.head !== undefined) {
    const head = norm(patch.head);
    if (head.length > HUB_SLOT_HEAD_MAX) return { ok: false, reason: 'too_long' };
    if (head) slot.head = head;
    else delete slot.head;
  }
  if (patch.text !== undefined) {
    const text = norm(patch.text);
    if (text.length > HUB_SLOT_TEXT_MAX) return { ok: false, reason: 'too_long' };
    if (text) slot.text = text;
    else delete slot.text;
  }
  slots[index] = slot;
  // Trailing empty slots carry nothing; trim them so the stored list is honest.
  while (slots.length > 0 && Object.keys(slots[slots.length - 1]!).length === 0) slots.pop();
  const next: HubSectionCanvas = { ...canvas };
  if (slots.length > 0) next.slots = slots;
  else delete next.slots;
  return { ok: true, canvas: next, putsMediaUp };
}

/**
 * HOW THE SCENE'S CLIP PLAYS. Loop is the default and stored as an absence;
 * `open` only means something beside a tap. Returns whether the write puts a
 * non-default choice UP (Pro) — going back to Loop never needs it.
 */
export function applySceneVideo(
  canvas: HubSectionCanvas,
  play: unknown,
  open: unknown,
): { canvas: HubSectionCanvas; putsUp: boolean } | null {
  if (play !== 'loop' && play !== 'tap') return null;
  const next: HubSectionCanvas = { ...canvas };
  if (play === 'loop') {
    delete next.video;
    return { canvas: next, putsUp: false };
  }
  next.video = open === 'inplace' ? { play: 'tap', open: 'inplace' } : { play: 'tap' };
  return { canvas: next, putsUp: true };
}
