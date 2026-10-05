/**
 * THE MAKER'S ONE SELECTION — what a tap on a scene selects, from either side.
 *
 * Owner, 2026-09-27: *"i still cannot edit. the editing body page is not
 * working at all."* A tap on a scene — a tile in the navigator OR the scene on
 * the canvas — must select the SAME thing, so the navigator's highlight follows
 * the canvas and the other way round, and both open that scene's panel beside
 * the page. The two sides used to map taps separately and had drifted: tapping
 * the names and date on the canvas opened the Hero WORKSPACE, which replaces
 * the whole stage with another page — so "tap to edit" took the couple away
 * from the thing they tapped.
 *
 * 🔑 A FIXED SCENE SELECTS ITS OWN PANEL (`{ kind: 'row', key: 'f:<fixed>' }`),
 * never a made-once page. The panel says what the scene is and offers its
 * workspace as a button when it has one, or says in one line where its content
 * comes from (`MAKER_FIXED_SOURCE`). Nothing tapped opens a blank panel.
 *
 * Pure — the shell and the tests both read it. Types only from the context.
 */
import type { MakerSelection } from '@/app/dashboard/[eventId]/launch/_components/maker-context';
import {
  MAKER_FIXED_LABEL,
  MAKER_FIXED_SOURCE,
  MAKER_FIXED_TOOL,
  type MakerFixedKey,
  type MakerTile,
} from '@/lib/maker-scene-list';

export type SelectableScene = { id: string; type: string };

const FIXED_KEYS = Object.keys(MAKER_FIXED_LABEL) as MakerFixedKey[];

/** The fixed scene a `f:<fixed>` key names, or null. */
export function fixedOfKey(key: string): MakerFixedKey | null {
  if (!key.startsWith('f:')) return null;
  const k = key.slice(2) as MakerFixedKey;
  return FIXED_KEYS.includes(k) ? k : null;
}

/** A tile tapped in the navigator → the one selection. */
export function selectionForTile(tile: MakerTile): NonNullable<MakerSelection> {
  if (tile.kind === 'scene') return { kind: 'scene', id: tile.widgetId };
  if (tile.kind === 'post-event') return { kind: 'post-event', scene: tile.scene };
  return { kind: 'row', key: tile.key };
}

/** A section tapped on the canvas (its marker key) → the SAME selection, or null. */
export function selectionForCanvasKey(key: string, scenes: readonly SelectableScene[]): MakerSelection {
  if (key.startsWith('w:')) {
    const scene = scenes.find((s) => s.type === key.slice(2));
    return scene ? { kind: 'scene', id: scene.id } : null;
  }
  if (key.startsWith('p:')) return { kind: 'post-event', scene: key.slice(2) };
  const fixed = fixedOfKey(key);
  return fixed ? { kind: 'row', key: `f:${fixed}` } : null;
}

/**
 * ＋ ADD A SCENE SHOWS ONLY ON A STAGE (owner 2026-09-28, on the Logo page:
 * *"cannot see the scenes. and it should only show on stages."*). A stage is
 * what the canvas is showing — Save the Date · Invitation · The Day · Post
 * Event — with a scene, a row or nothing selected; every PAGE (Logo · Hero ·
 * Reveal · Love Story · Post Event's page · Prints · Details · RSVP) is a
 * `tool` selection, which replaces the stage, so a scene added there could
 * not be seen. The toolbar ＋ and the phone's More ▾ row both ask this.
 */
export function makerAddShowsOn(selection: MakerSelection): boolean {
  return selection?.kind !== 'tool';
}

/** The canvas key of what is selected — what the canvas scrolls to. */
export function canvasKeyOfSelection(selection: MakerSelection, scenes: readonly SelectableScene[]): string | null {
  if (!selection) return null;
  if (selection.kind === 'scene') {
    const s = scenes.find((x) => x.id === selection.id);
    return s ? `w:${s.type}` : null;
  }
  if (selection.kind === 'row' && fixedOfKey(selection.key)) return selection.key;
  if (selection.kind === 'tool') {
    const fixed = FIXED_KEYS.find((k) => MAKER_FIXED_TOOL[k] === selection.key);
    return fixed ? `f:${fixed}` : null;
  }
  return null;
}

/** Is this tile the selected one? (A workspace opened for a fixed scene counts too.) */
export function tileIsSelected(tile: MakerTile, selection: MakerSelection): boolean {
  if (!selection) return false;
  if (tile.kind === 'scene') return selection.kind === 'scene' && selection.id === tile.widgetId;
  if (tile.kind === 'post-event') return selection.kind === 'post-event' && selection.scene === tile.scene;
  if (selection.kind === 'row') return selection.key === tile.key;
  return selection.kind === 'tool' && MAKER_FIXED_TOOL[tile.fixed] === selection.key;
}

/**
 * ✋ SCENES EDITED IN PLACE — owner 2026-10-05, on the Names & date sheet's
 * "This scene is made in the Hero editor" + "Open Hero editor": no go-elsewhere
 * button and no "Hero" word. Its words are typed on the page and its parts
 * styled from the page (a tap on the part, or the sheet's one Part ▾), so its
 * panel carries no line — only its Style and its parts.
 */
export const MAKER_FIXED_IN_PLACE: readonly MakerFixedKey[] = ['hero'];

/**
 * 🎫 THE GUEST'S TICKET SHOWS ITSELF (owner 2026-10-05, *"isn't this the digital
 * pass? … where is the customization"*): its sheet draws the real ticket and ONE
 * Ticket style ▾ — no sentence, no "Open your guest list →".
 */
export const MAKER_FIXED_TICKET: MakerFixedKey = 'pass';

/**
 * What a fixed scene's panel says — never empty. `tool` is the editor it is made
 * in, drawn IN the panel (owner 2026-10-05, *"each scene and setting must be
 * there and not links. editing should be on the actual tool thirds"*): no
 * "Open … editor" button any more. `source` is where its content comes from
 * when it has none to edit here — said, never linked.
 */
export function fixedScenePanel(fixed: MakerFixedKey): {
  label: string;
  line: string;
  tool: 'hero' | 'reveal' | 'post-event' | 'love-story' | 'rsvp-page' | null;
  source: (typeof MAKER_FIXED_SOURCE)[MakerFixedKey] | null;
} {
  return {
    label: MAKER_FIXED_LABEL[fixed].label,
    line: MAKER_FIXED_IN_PLACE.includes(fixed) ? '' : MAKER_FIXED_LABEL[fixed].why,
    tool: MAKER_FIXED_TOOL[fixed] ?? null,
    source: MAKER_FIXED_SOURCE[fixed] ?? null,
  };
}
