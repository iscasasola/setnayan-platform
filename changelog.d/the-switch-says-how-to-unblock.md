## 2026-08-26 · fix(notifications): the switch says how to unblock, on the device you are holding

Owner: *"there is a block. it needs to launch the notification permission if there
is on that phone/laptop/desktop/ or whichever device it uses."*

**It already launches it — once.** `PushToggle` calls
`Notification.requestPermission()` on a deliberate press. But after a device has
said no, that call resolves to `'denied'` **immediately and shows no dialog, ever
again**, and no code can re-open it. The owner's device was in exactly that state.

What the screen did about it was one sentence — *"Blocked in your browser
settings. Re-enable notifications for this site to turn them on."* True, and not
a way out: he had to ask how. **Telling somebody they are blocked is not
unblocking them.**

**Now:** a blocked device gets numbered steps written for the device in front of
it — Chrome/Edge, Firefox, Safari on Mac, Android, and iPhone (where web push
exists only inside an installed Home Screen app, so the steps say to install it
rather than hunting a permission that cannot exist in Safari). Mac readers also
get the **second, silent gate** named: the site can be allowed while macOS
swallows the notifications anyway, which is the commonest "I allowed it and
nothing happened".

**And the switch now NOTICES when you unblock it.** Permission is resolved on
mount *and watched* — via the Permissions API `change` event where offered, plus
`visibilitychange`/`focus` everywhere else, which is exactly the moment somebody
returns from a settings app. Previously you could follow the steps perfectly,
come back, find the switch still dead, and reasonably conclude it was broken.

**A defect of my own, fixed:** the shared toggle was born on the couple profile
and I mounted it into the admin console (#4853) carrying its copy — so the admin
console promised the operator *"when a vendor messages you or a new inquiry comes
in"*. It now takes an `audience` and each of the three trees is promised what it
actually gets. `ADMIN_NAV`-style default stays `couple`, so nothing else moved.

Guard `lib/push-unblock-steps.test.ts` (10 rules). The guide is a pure function
so it is tested without a browser, and it is a **hint, not a detection** — every
branch falls back to generic steps that are correct everywhere, because a
wrong-but-plausible instruction is worse than a general one.

🪤 **Rule 9 was decoration and only a mutation said so:** it asserted the promise
map existed and had all three keys, and replacing the render's `PROMISE[audience]`
with a hardcoded `PROMISE.vendor` — putting vendor copy back on the admin console,
the exact bug — left it GREEN. **A grep cannot tell a name appearing from a name
being used.** Fixed to assert the render indexes by the prop.

🪤 An existing guard pinned the mount as the literal `<PushToggle />`, so adding a
prop broke it. Updated to pin the MOUNT rather than the absence of props, and to
require the admin mount declare its audience.

Verification: 10 rules · 10 mutations printed by occurrence count before → after,
all RED. 11 lints green.

SPEC IMPACT: None. No schema, no route, no SKU. VAPID keys were already set; this
changes nothing about delivery, only about a person's ability to switch it on.

### 🚨 The vendor card was the worst of the three, and only `tsc` found it

`vendor-dashboard/notifications` imports its **own** 90-line card, not the shared toggle — proved
by the new `audience` prop failing to compile there. That card **cannot enable at all** (it defers
to a banner mounted by the vendor layout), and its blocked branch rendered five words —
*"Blocked in browser settings."* — followed by `: null`. **A dead card, no control, nowhere to go.**
It now shows the same per-device steps.

⛔ **It is deliberately NOT replaced by the shared toggle.** It owns `deactivateAllPushTokens`, a
SERVER-side switch-off across every device the vendor has registered; the shared toggle only
unsubscribes the current browser. **Swapping it would delete that inverse.** Consolidating the two
properly is real work, not a tidy-up — named, not done.

🪤 **And a note of mine claimed that file was "mounted nowhere, 0 import sites".** It came from a
grep whose `--include` flag errored under zsh — the command printed "no matches found" and the
zero was read as a result. **A grep that errored is not a zero result.**
