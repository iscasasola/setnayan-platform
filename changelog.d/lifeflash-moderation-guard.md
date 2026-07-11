## 2026-07-11 · test(life-flash): source-guard so the moderation gate can't be silently removed

Follow-up to #3088 (the Life-Flash safety fix). The `moderation_state='clean'` filter on `fetchMomentGraph`'s two papic media queries is the only thing keeping nsfw_blocked / unscreened / RA-10173 consent_withheld / faceblock_withheld media out of the fullscreen auto-playing flash — but it lives at the Supabase query layer, which the pure `assembleMomentGraph` tests (and the `?fixtures=1` path) can't reach (raw rows carry no `moderation_state`; the couple RLS gates only on membership). So there was no automated protection against someone deleting it.

- `lib/life-story-moment-graph.test.ts`: adds a SAFETY-GUARD test that reads the module source and asserts BOTH the `papic_photos` and `papic_guest_captures` queries in `fetchMomentGraph` still carry `.eq('moderation_state','clean')` before the query's `.limit(` (bounded regex, so it can't false-pass off another query's gate). Verified as a real guard: it FAILS on a negative control where the filter is removed, and passes as-is.

SPEC IMPACT: None (test-only; no runtime/schema/pricing change).
