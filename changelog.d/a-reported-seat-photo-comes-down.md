## 2026-09-11 · fix(takedown): a reported seat photo actually comes down — on the story, the recap, both prints and the share card

Found by the Story's step-8 end-to-end drive. A guest who asks, from the story ("Hide it" → "Ask for this one to come down"), for a photograph of themselves to be taken down files a report whose target is the capture's id — usually a **seat-camera** photograph (`papic_photos`), which is every picture the Story's pages are built from. The moderator's **Hide** updated `papic_guest_captures` only, so it matched no row, the report was stamped *"Content hidden by Setnayan moderator."*, and the photograph stayed up everywhere. The moderation queue also showed no picture for such a report.

- `lib/hide-a-reported-photo.ts` (new) — finds the photograph by id in BOTH capture tables, each look bound to the report's event; keeps an existing `hidden_at`; says which table held it, or `null`; a refused query throws (never reads as "not found").
- `app/admin/user-reports/actions.ts` — Hide and Block write through it; a hidden photo calls `everyCopyIsNowStale`; a Hide that found nothing says *"Nothing hidden — the reported photo was not found in this event."* instead of claiming a hide.
- `app/admin/user-reports/page.tsx` — the queue resolves a seat photograph's thumbnail and hidden state too.
- `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` — the host's own hide/unhide of a seat photo (and of a guest capture) now reaches every cached copy; before, the story's keepsake kept it for 5 minutes and the share card for an hour.
- Guard: `a-withdrawal-reaches-every-copy.test.ts` counts "a capture taken down or put back" as a consent write. Sabotage, measured: dropping the call from the seat-photo hide (2 → 1 calls) → 1 fail; from the moderator's resolve (1 → 0) → 1 fail; removing the seat-photo arm of the helper (1 → 0) → 3 of 6 fail.

SPEC IMPACT: None — makes the shipped S14 "a withdrawal reaches every copy" (`04_Consent_And_Privacy.md` §3) true for the moderator's and the host's hide; no rule changed. Who answers a takedown request (Setnayan's moderator vs the host) is unchanged and not decided here.
