## 2026-09-19 · fix(papic): the guest camera says "couldn't check" instead of "not turned on", and every refusal has a way out (AREA-PAPIC)

`/papic/guest` is the page every guest lands on during the celebration. The invitation's Camera button, the day-of bar and the personal-QR bridge all go there. It asked the two-state `eventPapicGuestActive`, which turns "we could not find out" into false. So when the pool read failed, a guest at the reception was told guest cameras "haven't been turned on", which is a decision nobody made. The pool applies on all 10 production events, so that sentence was only ever reachable through a failed read. The page now asks `eventPapicGuestAccess`, the same three-state gate `/papic/me/[token]` and `/papic/decorate` already use, and says "We couldn't check just now" for `unknown`. The permission is unchanged: anything but `on` still gets no camera.

Three of the page's four refusals closed themselves and had no button. The not-open-yet, closed, blocked and couldn't-check screens now offer "Back to the invitation" when the guest came from one. The closed screen says "Your photos are still in your gallery", and it now links to that gallery (`/papic/me/<token>`).

Guard: `app/papic/the-guest-camera-says-what-it-knows.test.ts`. No page under `app/papic` may call the two-state gate. `/papic/guest` must refuse anything but `on` and word `unknown` separately. No `DoorShell` on the page may close itself. Sabotage-proven: the page as it is on origin/main fails 3 of 3, `=== 'off'` fails the wording test, and a self-closing blocked screen fails the way-out test.

SPEC IMPACT: None
