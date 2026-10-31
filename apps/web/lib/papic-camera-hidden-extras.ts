/**
 * 🙈 TWO CAMERA EXTRAS ARE HIDDEN UNTIL THE OWNER SAYS SO.
 *
 * ⚖ Owner 2026-10-31, DECISION_LOG "SEVEN OWNER ANSWERS" (6): *"hide this for now. it will not be present until we
 * say so. but it is hidden in our app. and when we need it, our documentation should be enough"*.
 *
 *   · "Write a column" under the GUEST camera (`app/papic/guest/page.tsx` → `CameraColumn` → `GuestColumnCard`);
 *   · Camera Bridge (pair a DSLR) under the SEAT camera (`app/papic/seat/[token]/page.tsx` → `CameraBridgePanel`).
 *
 * The code is KEPT — nothing is deleted. Each camera page asks its constant FIRST, before any env flag
 * (`GUEST_COLUMNS_ENABLED` + the `guest_columns` DPO control; `?bridge=demo` / `NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED`),
 * so no flag, query string or DPO switch can draw either while its constant is `false`.
 *
 * Typed `boolean`, not the literal `false`, so TypeScript keeps type-checking the hidden branch: the code stays
 * compiled and correct while it is out of sight.
 *
 * 🔁 TO BRING ONE BACK (only on the owner's word — record the ruling in DECISION_LOG first):
 *   1. Set its constant below to `true`.
 *   2. Update the guard `lib/the-hidden-camera-extras-stay-hidden.test.ts` — it fails on purpose the moment either
 *      constant is `true`; change that assertion to the new ruling (do not delete the mount checks).
 *   3. The extra's OWN gates then apply again, exactly as before it was hidden:
 *        · Write a column — `GUEST_COLUMNS_ENABLED` (server env, default OFF) AND the `guest_columns` DPO control
 *          (`lib/guest-columns-gate.ts`), and the open-camera branch only;
 *        · Camera Bridge — `?bridge=demo` on the seat URL, or `NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED` (build-time env).
 *   4. Walk the camera page at 375 px and confirm the extra draws under the camera, not over it.
 * The same steps are in the corpus, DECISION_LOG "AS BUILT — WRITE A COLUMN AND CAMERA BRIDGE HIDDEN" (2026-10-31).
 */

/** "Write a column" under the guest camera. `false` = never drawn there, whatever the env says. */
export const WRITE_A_COLUMN_SHOWN_ON_CAMERA: boolean = false;

/** Camera Bridge (pair a DSLR) under the seat camera. `false` = never drawn there, whatever `?bridge=` or the env say. */
export const CAMERA_BRIDGE_SHOWN_ON_CAMERA: boolean = false;
