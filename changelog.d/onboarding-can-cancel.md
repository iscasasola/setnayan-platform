## 2026-10-26 · fix(onboarding): the first screen of every flow has a way out

Owner, verbatim: *"i noticed event onboarding doesn't have a cancel. so when they misclick that event type. they can cancel"*.

- **Wedding** (`onboarding/wedding/_components/onboarding-shell.tsx`): the first screen's top-left control is now **✕** (44px, aria-label "Cancel — pick a different event") in the same slot as the later screens' **‹**, going back to `/dashboard/create-event`. The brand lock-up does not move between screen 1 and screen 2 (measured: x=66 on both).
- **The real bug underneath:** the shell keyed "first screen" on the screen id `'welcome'`, which is in `REMOVED_SCREENS` and never in the approved list, so it was never active. The "‹" on the actual first screen (`w_names`) called `go(-1)`, which clamps at 0, so the button did nothing. The hardware/browser Back re-armed its sentinel forever. On production (2026-10-26), pressing Back twice on "Who's getting married?" left the visitor on `/onboarding/wedding` both times. "First screen" is now `stepClamped === 0`, so Back leaves from there too (measured locally: Back from the first screen returns to the previous page).
- **Every other type** (`onboarding/[type]/_components/generic-onboarding.tsx`): step 0 draws the same ✕ in the header. Before, the bottom Back was invisible on step 0, and the "What do you need?" first screen hides that row entirely. Later screens keep their Back.
- **Get-together** (`onboarding/simple/page.tsx`): unchanged. It already opens with "‹ Back" to the picker.
- One home for the destination and the words: `app/onboarding/_shared/onboarding-exit.ts`. A signed-out visitor (from a marketing page, not from the picker, which is behind sign-in) goes to `/` rather than being bounced to `/login`.
- Nothing is created by leaving: each flow commits only at its final button. The browser-side draft is left as it is.
- Guard: `app/onboarding/first-screen-can-cancel.test.ts`, checked per component.

SPEC IMPACT: None. No corpus file specifies the onboarding top chrome. It follows the existing house rule that a first screen's top-left "<" becomes an exit icon.
