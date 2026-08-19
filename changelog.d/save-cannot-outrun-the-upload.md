## 2026-08-19 · fix(upload): the upload said "Uploaded" and meant nothing about the account

### The one the owner actually hit — measured on his own row

He chose a photo, saw a **green tick and the word "Uploaded"**, and left. Then:
*"once we uploaded it, the logo on the upper right did not change."*

**Nothing was broken.** Read from prod: the file is in R2, and the form's hidden
input carried `r2://setnayan-media/profile-photo/…` correctly. But
`users.profile_photo_url` was **NULL** and his `updated_at` was **2026-07-13 — five
weeks old**, which proves the UPDATE never ran at all.

The value only reaches the row when the **parent form** is submitted, and on
`/dashboard/profile` that button sits roughly **3,000px down a 4,744px page**.

🔑 **A GREEN TICK SAYING "UPLOADED" IS A CLAIM ABOUT THE FILE, READ AS A CLAIM
ABOUT THE ACCOUNT.** The widget was telling the truth about the wrong subject.

A **seeded** item came out of the database, so for it "Saved" is true. An item
uploaded in this session has not been saved, and now says
**"Not saved yet — press Save below."** The two were already distinguishable —
seeds carry an `id` of `seed-<ref>` — so this needed no new state, only an honest
sentence. Scoped to widgets that actually feed a form (`name` present).

---

## Also in this PR · Save could delete the photo it was saving, and say "Saved."

**SPEC IMPACT:** None — a defect fix on every upload field in the app.

Found while tracing the profile photo end to end after the owner asked whether
the account icon can become a real picture. **The upload itself works fine.** What
did not work is what happens if you press Save one second too early.

### The defect

`FileUpload` mirrors its value into the parent form through hidden inputs built
from `items` — **finished** uploads. An upload still in `inFlight` has no input.

And in single-file mode the dropzone only opens once `items` is empty, so
replacing a photo is **necessarily** remove-then-add. Submit in that gap and the
form posts **nothing** for the field.

On `/dashboard/profile` that reaches `nullIfBlank(null)` → NULL written →
`redirect('?saved=1')` → the screen says **"Saved."**

**The person has lost the old photo AND the new one. One click, both losses, with
a cheerful confirmation.** Reachable **by construction**, not by bad luck — which
is why prod holding zero photos is not reassurance. It is the reason nobody has
hit it yet, and the window to fix it in.

### The fix

While an upload is in flight, the enclosing form refuses to submit. It lives in
`FileUpload` rather than on each page's Save button because **every consumer has
the same gap**, and because the parents are server components whose buttons cannot
see this state.

**On the CAPTURE phase, deliberately.** A bubble-phase listener runs after React
has already handed the server action its (empty) FormData.

🔑 **AND IT REFUSES OUT LOUD** — *"Still uploading — give it a second, then
save."* A guard that blocks in silence is indistinguishable from one that passed:
the person presses Save, sees nothing happen, and presses it again. The notice
clears itself when the upload lands, so it never becomes a false alarm that gets
ignored.

🛡 4 assertions. **Sabotages measured by occurrence count**: bubble-instead-of-
capture (2→0) · unannounced notice (1→0) · notice never clears (1→0) · listener
never removed (1→0) — all RED.

🪤 **The first cut of the notice assertion was decoration.** It matched
`role="alert"` **anywhere in the file** — and this file has **two**. Deleting the
one on the upload notice left the other, the mutation landed **2→1**, and the test
stayed **GREEN**. Re-anchored to the notice's own text. *An unmeasured mutation
proves nothing, and a measured one still needs the count read.*

⏭ **NAMED, NOT FIXED — three more found in the same trace, each its own change:**
1. A **failed read of the user row wipes the whole profile form** on the next save
   — `profile/page.tsx` logs and falls through with no early return, so every
   default blanks, while the single UPDATE writes all eight columns unconditionally.
2. **Three guest-photo surfaces put a raw `r2://` ref in an `<img>`** — the check-in
   desk, the souvenir desk and the Patiktok booth tag sheet. Guaranteed to fail for
   an RSVP selfie, which *replaces* the Gmail avatar. Both files even carry an
   eslint-disable comment for "arbitrary R2 hosts": the authors believed a ref
   would render.
3. **Client and server validation disagree** — the browser enforces 2 MB and three
   image types; the server accepts GIF/HEIC/AVIF/PDF at 10 MB, and there is **no
   NSFW screen on a profile photo** (`nsfw-screen.ts` is wired into ~23 other files
   and neither this path nor the upload route is one).
