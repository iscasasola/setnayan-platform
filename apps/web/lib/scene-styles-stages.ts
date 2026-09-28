/**
 * apps/web/lib/scene-styles-stages.ts
 *
 * THE SAVE THE DATE · INVITATION · THE DAY SCENE STYLES — this file is theirs.
 *
 * Owner, 2026-09-29 ("EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE
 * STYLES"): *"we want at least 3 choices for each scene that are premade. even
 * the countdown and other scenes"*. Designs: `prototypes/every_scene_three_
 * styles_2026-09-29.html`. Put each section's styles here as `SceneStyleSet`s
 * (`lib/scene-styles.ts` merges this list with Post Event's own): the type is
 * the row's scene type (`sceneStyleTypeOfWidget` — a row is its own type except
 * `our_photos`, which is `gallery`), each style's `stages` are where its
 * renderer draws it, and the first drawn on a stage is its default unless
 * `defaults` names another.
 *
 * 🔑 A STYLE THAT SHARES A NAME WITH POST EVENT'S KEEPS POST EVENT'S ID —
 * `schedule`: `one-per-screen` · `clock-face`; `gallery`: `grid` · `mosaic` ·
 * `film-strip` — list it here with this file's `stages` and the registry makes
 * it ONE style drawn on both, so the couple's one pick carries across stages.
 *
 * Empty until that build lands: nothing is offered that is not drawn.
 */
import type { SceneStyleSet } from '@/lib/scene-styles';

export const STAGE_SCENE_STYLE_SETS: readonly SceneStyleSet[] = [];
