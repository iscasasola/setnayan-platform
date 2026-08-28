-- ═══════════════════════════════════════════════════════════════════════════
-- ONE OPTION IN "TEACH IT THIS INSTEAD" COULD NEVER BE SAVED.
--
-- The learned-phrases screen offers 86 destinations. Exactly one of them — "My
-- account", /dashboard/profile — was refused by THIS TABLE the instant an admin
-- pressed Save, and the only feedback was a raw database error in a red box.
-- Nothing on screen could tell them that option never could have worked.
--
-- ── TWO RULES CONTRADICTED EACH OTHER, AND THE APP'S IS THE RIGHT ONE ───────
-- `isKnownAdminHref` (lib/admin-map/ask-the-admin.ts) DELIBERATELY accepts that
-- href; its own docblock says "the /admin prefix was not the right question",
-- because "My account" is a curated menu destination that lives outside /admin
-- on purpose — the admin doorway has no other path to changing a password or
-- signing out other devices. This CHECK said the opposite.
--
-- THE APP VALIDATOR IS MADE AUTHORITATIVE. Measured reasons, not preference:
--
-- 1. THIS CHECK IS NOT A SECURITY BOUNDARY. Read out of production: the table
--    has RLS enabled with ZERO policies and ZERO grants to `anon` or
--    `authenticated` — not at table level, not at column level. No browser can
--    reach it. Both writers are service-role server actions behind an admin
--    gate, and BOTH already run `isKnownAdminHref` before writing.
--
-- 2. AS AN INTEGRITY RULE IT WAS BOTH TOO LOOSE AND TOO TIGHT. It admitted
--    '/admin/does-not-exist' — a dead link, the exact thing this table must not
--    learn — while refusing a real, reachable, curated page. The membership
--    test in the app is strictly stronger in the direction that matters: it
--    asks whether the address is one the console actually offers.
--
-- 3. THE CONTRADICTION WAS LIVE ON BOTH WRITERS, AND ONE FAILED SILENTLY. The
--    AI learner (`rememberPhrase`) only LOGS a failed write, so when the model
--    correctly answered "My account" the phrase was never remembered and every
--    repeat of that phrasing paid for another model call, forever. The teach
--    door at least showed the admin an error; this one showed nobody anything.
--
-- ── WHAT THE CHECK SAYS NOW, AND WHY THIS SHAPE ────────────────────────────
-- The floor the constraint was actually reaching for is "a learned phrase must
-- never navigate an admin off Setnayan". That is what is stated now: a
-- site-relative path, and NOT a protocol-relative one. '//evil.example' and
-- '/\evil.example' both leave the site in a browser while starting with a
-- slash, so the second character must be neither '/' nor '\'.
--
-- Deliberately NOT an allow-list of the non-/admin destinations. There is one
-- today; a list would be a bill to keep paying, and this repo has already
-- learned that a deny/allow-list drifts (the slug word list sat 15 words stale
-- and would have minted a shop one of our own pages, permanently). This rule
-- never needs editing when a curated destination is added.
--
-- Idempotent: drop-then-add, so a re-run lands the same constraint.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.admin_search_phrases
  DROP CONSTRAINT IF EXISTS admin_search_phrases_href_chk;

ALTER TABLE public.admin_search_phrases
  ADD CONSTRAINT admin_search_phrases_href_chk
  CHECK (href ~ '^/[^/\\]');

COMMENT ON CONSTRAINT admin_search_phrases_href_chk ON public.admin_search_phrases IS
  'A learned phrase must point INSIDE Setnayan: a site-relative path, never a '
  'protocol-relative one (//host or /\host both leave the site). Whether the '
  'address is a page this admin actually HAS is decided by isKnownAdminHref in '
  'lib/admin-map/ask-the-admin.ts, which both writers run — that check is the '
  'authoritative rule and is strictly stronger than a prefix. This constraint '
  'was ''/admin%'' until 2026-08-27, which refused the curated "My account" '
  'destination while still admitting any made-up /admin address.';
