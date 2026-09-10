-- THE PRICING PAGE NAMES THE INVITE THEME — copy only.
--
-- Owner, 2026-09-10: the invite link's four styled themes "will be the Event
-- Hub Pro service" (DECISION_LOG 2026-09-10). 20271219583821 made the first of
-- them real — Capiz, gated on COUPLE_WEBSITE_PRO on the guest-facing invite
-- doors. That is a new thing a non-buyer is refused, so under the owner's
-- 2026-08-28 ruling ("say what it includes") the product must now SAY it:
-- `says-what-it-includes.test.ts` fails until every claim surface names it.
--
-- This row's description is what the PUBLIC pricing page renders. The text
-- below is 20271179454449's, byte for byte, with ONE clause inserted — "and a
-- Pro theme for your invite link that opens on your own photo". It names no
-- count of themes on purpose: one ships today, three more follow their fonts.
--
-- ⚖ COPY ONLY. The price, the ownership aliases and every gate are untouched.
BEGIN;

UPDATE public.platform_retail_catalog_v2
SET description =
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, background music and a video across the top, your '
      'own photo gallery, your own colours for the page and its buttons, and a '
      'Pro theme for your invite link that opens on your own photo — plus the '
      'Setnayan mark taken off everywhere your guests see it: the page, the '
      'printable version, your story and the recap. The cinematic reveal comes '
      'only with this.',
    updated_at = NOW()
WHERE service_code = 'COUPLE_WEBSITE_PRO';

COMMIT;
