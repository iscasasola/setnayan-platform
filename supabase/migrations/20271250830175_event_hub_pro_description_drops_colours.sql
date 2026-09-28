-- event_hub_pro_description_drops_colours
-- Created via `pnpm migration:new`.
--
-- THE PRICING PAGE STOPS SELLING COLOURS — copy only.
--
-- Owner, 2026-09-28 (DECISION_LOG "WHAT IS FREE VS PRO IN THE EVENT HUB MAKER —
-- REDRAWN"), verbatim: "free to change design, change text, size, color,
-- background color, only when you start adding themes will it be pro. adding
-- media for background." PR #6075 (`rd/free-vs-pro-redraw`) made colours free
-- in the Maker, the Apply gate and the guest page, and redrew the Pro list
-- (`lib/website-pro-items.ts`): "Background color" and "Button color" out,
-- "Photo and video backgrounds" in. Its AS BUILT row names this migration as
-- the one thing it left open: the `COUPLE_WEBSITE_PRO` description — the text
-- the PUBLIC pricing page renders — still said "your own colours for the page
-- and its buttons" (last set by 20271220364681).
--
-- The new text names what Event Hub Pro still unlocks, in the Pro list's own
-- words: the cinematic reveal, the Save-the-Date video, background music, the
-- photo gallery, photo and video backgrounds, the Pro themes (invite link
-- included), fonts and animation (still Pro per the same row), the animated
-- logo and the logo on every QR code — plus the Setnayan mark taken off, and
-- "The cinematic reveal comes only with this." kept byte for byte. It names no
-- COUNT of themes on purpose (20271220364681's reason: a number rots).
-- "Editorial editing" is NOT named: it is free for every couple
-- (`NOT_SOLD_ON`), and this product may not be sold on it.
--
-- ⚖ COPY ONLY. The price, `is_active`, the ownership aliases and every gate are
-- untouched. `updated_at` is set by the table's own BEFORE UPDATE trigger
-- (20260713000000). Idempotent: re-applying changes nothing, and the
-- `IS DISTINCT FROM` keeps a re-run from touching the row at all.
BEGIN;

UPDATE public.platform_retail_catalog_v2
SET description =
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, a Save-the-Date video, background music, your own '
      'photo gallery, your own photo or video behind any scene or the whole '
      'page, the Pro themes for your Event Hub and your invite link, your own '
      'fonts and animation, an animated logo, and your logo on every QR code — '
      'plus the Setnayan mark taken off everywhere your guests see it: the page, '
      'the printable version, your story and the recap. The cinematic reveal '
      'comes only with this.'
WHERE service_code = 'COUPLE_WEBSITE_PRO'
  AND description IS DISTINCT FROM
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, a Save-the-Date video, background music, your own '
      'photo gallery, your own photo or video behind any scene or the whole '
      'page, the Pro themes for your Event Hub and your invite link, your own '
      'fonts and animation, an animated logo, and your logo on every QR code — '
      'plus the Setnayan mark taken off everywhere your guests see it: the page, '
      'the printable version, your story and the recap. The cinematic reveal '
      'comes only with this.';

COMMIT;
