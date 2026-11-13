// Client-safe sibling of hero-monogram-data.ts (which re-exports it): the column list is a plain string, and a client
// file that needs it must not pull the server-only entitlements chain along.

/** Reusable SELECT column list for any page that resolves the hero monogram. */
export const HERO_MONOGRAM_COLUMNS =
  /* ⛔ `role_palette` DELIBERATELY NOT HERE. Adding it made `lint:dup-rule`
   * fail on 14 hand-typed selects across 8 files: every narrow read that
   * reproduces part of this list was suddenly "dropping a canonical column".
   * Those reads are deliberate and pre-existing — lengthening the canonical
   * list is what broke them, not the reads themselves. And role_palette is a
   * PALETTE column, not a monogram one; it does not belong in the monogram's
   * canonical list just because one feature wants it.
   * The ink is passed instead — see the `ink` option on resolveEventMonogram. */
  'display_name, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, monogram_motion_key, monogram_studio_config';
