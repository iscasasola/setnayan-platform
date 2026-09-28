/**
 * 🖼 A WIDGET'S OWN CARD — ITS TWO LOOKS, WRITTEN ONCE.
 *
 * Owner 2026-09-27 (*"if we set no background it will remove the square
 * frame"*): with "No background" — or any painted ground — a scene's widget
 * draws no card of its own. Whether it does is decided by ONE function,
 * `lib/scene-ground.ts` `sceneWidgetIsBare` (→ `hubBackgroundOwnsBox`); the
 * widgets read it and render `sceneCardClass(look, bare)`.
 *
 * Owner 2026-09-28 (*"yes must be instant"*): on the Maker canvas the card must
 * go the moment "No background" is picked — not after the save's reload
 * (~2–3 s, #6073). So the Maker tells the canvas the SAME `sceneWidgetIsBare`
 * answer for the new canvas, and the bridge swaps the card to the class string
 * the server would render for it (`applySceneCardPreview`). The reload still
 * runs and still decides; because both sides read THESE strings, the swapped
 * card is byte-for-byte what the reload draws (held by
 * `lib/no-background-hides-the-card-at-once.test.ts`). There is no second rule:
 * nothing here decides WHETHER a widget is bare — only what each answer looks
 * like.
 *
 * Deliberately tiny and dependency-free: it ships in the guest page's bundle
 * behind the editor bridge.
 */

type CardLook = { own: string; bare: string; tile?: { own: string; bare: string } };

export const SCENE_CARD_LOOKS = {
  /** The Countdown: a rounded card, and a tile per number — both go with the card. */
  countdown: {
    own: 'rounded-2xl border border-ink/10 bg-veil/40 p-6 text-center sm:p-8',
    bare: 'text-center',
    tile: { own: 'rounded-lg border border-ink/10 bg-paper py-3', bare: 'py-3' },
  },
  /** The generic hideable card, Photo moments, Tier comparison. */
  card: {
    own: 'space-y-4 rounded-xl border border-ink/10 bg-cream p-6',
    bare: 'space-y-4',
  },
} as const satisfies Record<string, CardLook>;

export type SceneCardLook = keyof typeof SCENE_CARD_LOOKS;

/** The widget's card classes for `sceneWidgetIsBare`'s answer. */
export function sceneCardClass(look: SceneCardLook, bare: boolean): string {
  return bare ? SCENE_CARD_LOOKS[look].bare : SCENE_CARD_LOOKS[look].own;
}

/** The Countdown's per-number tile classes for the same answer. */
export function sceneCardTileClass(bare: boolean): string {
  return bare ? SCENE_CARD_LOOKS.countdown.tile.bare : SCENE_CARD_LOOKS.countdown.tile.own;
}

/** Exactly what `applySceneCardPreview` touches. */
export type SceneCardNode = {
  className: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  querySelector(selector: string): SceneCardNode | null;
  querySelectorAll(selector: string): ArrayLike<SceneCardNode>;
};

/**
 * ⚡ THE MAKER CANVAS ONLY. Put the widget's card under `root` (the scene the
 * navigator's marker points at — its frame, or the widget itself) into the
 * look for `bare`, exactly as the server renders it. Returns whether anything
 * changed.
 *
 * It swaps only what it can recognise: the `[data-scene-card]` element whose
 * class string is one of the looks above, and — for the Countdown — the tiles
 * whose class string is that look's tile. Anything else is left alone, and the
 * reload that follows the save (still released by `backgroundPickRedrawsBox`)
 * draws it: never a guess.
 */
export function applySceneCardPreview(root: SceneCardNode, bare: boolean): boolean {
  const card = root.getAttribute('data-scene-card') !== null ? root : root.querySelector('[data-scene-card]');
  if (!card) return false;
  const from = card.getAttribute('data-scene-card') === 'bare' ? 'bare' : 'own';
  const to = bare ? 'bare' : 'own';
  if (from === to) return false;
  const look = (Object.values(SCENE_CARD_LOOKS) as CardLook[]).find((l) => l[from] === card.className);
  if (!look) return false;
  if (look.tile) {
    for (const tile of Array.from(card.querySelectorAll('div'))) {
      if (tile.className === look.tile[from]) tile.className = look.tile[to];
    }
  }
  card.className = look[to];
  card.setAttribute('data-scene-card', to);
  return true;
}
