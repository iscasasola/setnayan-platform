## 2026-09-30 · fix(guest): the invitation's words say what is true — guest text audit

- **Program:** "Your time" is said once, only when the guest's clock differs from the venue's; "Up next" only on the event's own day; the raw "Custom" kicker and a kicker that repeats the title are hidden; "The programme" → "The program".
- **Hero time:** never unlabeled — the first moment's own title ("Guests arrive 2:30 PM"), else "Starts 2:30 PM".
- **Get inside:** names only what opens ("Upload your QR · Sign in"); no "Scan · Tap NFC".
- **Sign-in:** when `next` opens an event, the card speaks to a guest (no "Welcome back", no "couples and vendors"); placeholder `you@email.com`.
- **Security:** `/login?error=` can no longer write the banner — `loginErrorFromParam` maps it to a fixed set of our own sentences; anything else is the generic one (a crafted link could put a phishing line inside our card).
- **Entourage:** beside ONE name, "Father / Mother / Parent of the Bride/Groom" (from the typed title), never "Parents of…". US spelling on guest pages: Maid/Matron of Honor, colors, program, recognize, favorite.
- **Love story:** drawn once (the scene OR the prose — the "Our Love Story" tab's anchor moves onto the scene when it is the one drawn); never fills the "met" year with the proposal year; never lowercases a first word that may be a name.
- **E-Gifts:** one term on every door and the page; the page names only the methods the couple set up (no "handle").
- **RSVP:** the sheet's top control says "Close"; the heading is "Your reply"; reply-by uses the event date's formatter; "Open your invitation".
- **Failures:** a blurry QR photo gets its own message; "Add name" shows the real reason (`seatNameFailure`, `lib/seat-name-words.ts`) — never "check your connection" for a save the server refused; selfie consent no longer says "in my settings" to a guest with no account.
- **Suppliers who made this day:** only after the day, and "supplier", never "vendor".
- **No roadmap:** removed "Shutter ships with the Setnayan native app (Phase 2)".
- **No casual greetings on guest pages** (DECISION_LOG 2026-09-30): removed "Welcome, {first}", "See you on the 18th, {first}!", "{first}, your camera's ready", "Before you start shooting, {name}", "That's all N photos, {name}!"; the +1 Welcome page shows the formal name. The couple's own copied invite message (`lib/guest-invite-message.ts`) is untouched — owner-approved wording in the couple's voice (controller, 2026-09-30).
- **Guest menu is the four** (owner 2026-09-30, "RSVP does not have 4 tabs under"): the Invitation bar is always Welcome · Details · Our Love Story · Me — the RSVP tab that replaced Me until a guest replied is gone (`resolveSiteNav`, `STAGE_BAR.rsvp`, the `replied` / `destinations.rsvp` inputs, the RSVP icon). The Maker's Page ▾ reads the same resolver, so it lists the four.

Guards: `app/[slug]/_lib/the-guest-text-is-honest.test.ts`, `lib/the-sign-in-card-says-only-our-words.test.ts`.

SPEC IMPACT: None — copy and honesty fixes under existing owner rulings (DECISION_LOG 2026-09-30 "no casual greetings"; "supplier" / "Event Hub" vocabulary).
