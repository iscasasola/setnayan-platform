/**
 * 🙈 TWO GUEST EXTRAS ARE HIDDEN IN THE APP UNTIL THE OWNER SAYS SO.
 *
 * ⚖ Owner 2026-10-31, DECISION_LOG "SEVEN OWNER ANSWERS" (6): *"hide this for now. it will not be present until we
 * say so. but it is hidden in our app. and when we need it, our documentation should be enough"*.
 *
 *   · "Write a column" — BOTH guest mounts, one constant: under the GUEST camera (`app/papic/guest/page.tsx` →
 *     `CameraColumn` → `GuestColumnCard`) AND in the Event Hub's Recap after the event
 *     (`app/[slug]/_components/site-body.tsx`, the `recapBody` slot). "Hidden in our app" covers the Recap too
 *     (coordinator relaying the decision on PR #7119's open question, 2026-10-31);
 *   · Camera Bridge (pair a DSLR) under the SEAT camera (`app/papic/seat/[token]/page.tsx` → `CameraBridgePanel`).
 *
 * The code is KEPT — nothing is deleted. Each mount asks its constant FIRST, before any env flag
 * (`GUEST_COLUMNS_ENABLED` + the `guest_columns` DPO control; `?bridge=demo` / `NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED`),
 * so no flag, query string or DPO switch can draw either while its constant is `false`.
 * (Host-side column tools — the story editor's Guest Columns panel and `/studio/guest-columns` moderation — are NOT
 * gated here; they stay behind `GUEST_COLUMNS_ENABLED`, default OFF.)
 *
 * Typed `boolean`, not the literal `false`, so TypeScript keeps type-checking the hidden branch: the code stays
 * compiled and correct while it is out of sight.
 *
 * 🔁 TO BRING ONE BACK (only on the owner's word — record the ruling in DECISION_LOG first):
 *   1. Set its constant below to `true`.
 *   2. Update the guard `lib/the-hidden-extras-stay-hidden.test.ts` — it fails on purpose the moment either
 *      constant is `true`; change that assertion to the new ruling (do not delete the mount checks).
 *   3. The extra's OWN gates then apply again, exactly as before it was hidden:
 *        · Write a column — `GUEST_COLUMNS_ENABLED` (server env, default OFF) AND the `guest_columns` DPO control
 *          (`lib/guest-columns-gate.ts`); on the camera, the open-camera branch only; on the Event Hub, the Recap
 *          (post-event, guest-session tree) only. ONE constant brings back BOTH mounts — if the owner wants only one,
 *          split it into two constants first;
 *        · Camera Bridge — `?bridge=demo` on the seat URL, or `NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED` (build-time env).
 *   4. Walk the camera page at 375 px and confirm the extra draws under the camera, not over it; for the column, also
 *      open a past event's Event Hub as a guest and confirm the card sits in the Recap under the story.
 * The same steps are in the corpus: DECISION_LOG rows "AS BUILT — A SELFIE RETAKE ONLY ADDS FROM THE PHOTOS THAT MISSED" and
 * "AS BUILT — WRITE A COLUMN HIDDEN IN THE EVENT HUB RECAP TOO" (both 2026-10-31, PR #7119).
 */

/** "Write a column" — the guest camera AND the Event Hub Recap. `false` = never drawn, whatever the env says. */
export const WRITE_A_COLUMN_SHOWN_IN_APP: boolean = false;

/** Camera Bridge (pair a DSLR) under the seat camera. `false` = never drawn there, whatever `?bridge=` or the env say. */
export const CAMERA_BRIDGE_SHOWN_ON_CAMERA: boolean = false;
