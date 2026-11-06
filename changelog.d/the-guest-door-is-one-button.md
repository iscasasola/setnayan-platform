## 2026-11-03 · feat(event-hub): the guest door is one button — "Open your invitation"

Owner, 3 Nov (DECISION_LOG "THE GUEST DOOR IS ONE BUTTON"): *"both buttons does the same thing"* · *"just 1 button
please"* · *"yes Open your invitation"* · *"i also saw sign in"* · *"either that or your recommendation, lost QR? Login"*.

- **Signed out:** the first screen shows ONE button, "Open your invitation" (was "Confirm your Booking" with an
  "Upload your QR · Sign in" subtitle, opening onto a second full "Upload your QR" button and a separate "Sign in").
  Pressed, exactly three choices: **Scan QR** (live camera) · **Upload QR** (the phone's picker, its two messages
  unchanged) · **Lost QR? Login** (the shipped sign-in with `next`). Still a `<details>`, so it opens with no script and
  in Messenger's webview; the first-screen fit (`FirstScreenDoor`) is unchanged.
- **Signed in and on the list:** no door (the server already answers with their seat) — under the cover's button, a
  small "Not [first name]? Switch account" opens the same three. Built on the shipped `NotYouSwitch` (`account` mode);
  drawn only for the signed-in account's OWN seat, never on the Maker's canvas.
- **One camera half, not a second copy:** the Find-a-seat scanner's camera lifecycle moved to
  `lib/use-live-qr-scan.ts` (stream before the video, released on unmount, comes back via `useCameraThatComesBack`);
  `seat-scanner.tsx` and the door's Scan QR both use it. A scanned code routes through `uploadedQrTarget`, like an upload.
- "Ask to join" / "Join as a guest" (signed in, not listed) are unchanged.
- Guard: `app/[slug]/_components/the-guest-door-is-one-button.test.ts` (one primary, no subtitle, nothing pressable
  beside the closed door, exactly three choices in order, the switch line's scope, the shared scanner). Golden
  `lib/site-body-fixture-stranger.golden.html` regenerated with `UPDATE_GOLDEN=1`.

SPEC IMPACT: None — implements DECISION_LOG row 2026-11-03 "THE GUEST DOOR IS ONE BUTTON" as written.
