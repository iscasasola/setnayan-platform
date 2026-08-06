## 2026-08-06 · feat(guests): the couple can take back a seat someone claimed with a forwarded link

Owner ruling 2026-08-06: **"the couple has full control of their guests."**

A personal invitation link is a bearer credential — whoever opens it *is* that guest. Forward it to
the family group chat and the first person through can permanently attach that seat to their own
account. Until now there was **no undo anywhere in the product**.

### 🔑 Rotating the QR does NOT unclaim — and that is the real defect

Read from the live `rotate_guest_qr_token` function: it writes `qr_token`,
`qr_token_rotated_at`, `qr_rotation_count` and `updated_at`. **Nothing else.** It never touches
`person_id` (which carries the claim) or `email`.

So there are **two doors to a seat**, revoked by two different things:

| door | how they get in | what revoked it |
|---|---|---|
| the **link** | tap the forwarded URL | rotating the QR |
| the **account** | sign in with the email they attached | **nothing** |

A couple pressing "new QR" reasonably believed they had taken the seat back. They had closed one
door. **Auto-unclaiming on rotation would be wrong** — a guest who loses their phone rotates their
own QR, and that must not evict them from their own seat. The two actions genuinely mean different
things; the bug was that only one of them existed.

### 🔑 Order is the whole thing: ROTATE FIRST, then detach

Detaching without rotating hands the seat **straight back** to whoever still holds the old link —
they open it again and re-claim. That exact bug is already in `DECISION_LOG.md`, from Papic seats:
*"NEVER SEPARATE THE UNCLAIM FROM THE ROTATION — rotation is the PRECONDITION, not the fix."*

So a failed rotation **aborts** the release. There is no path that detaches while leaving the old
QR live. The test asserts the ORDER, not merely that both happen — a release with the steps
reversed would satisfy any test that only checked both ran. **Watched failing:** swapping the two
turns 2 of the 6 red.

### What it does and does not touch

Clears `person_id` and `email` — the two things the claimer took. Keeps their name, reply, meal,
table and photos: the seat is the couple's, the wrongful claim is what goes.

Reuses the existing `rotate_guest_qr_token` RPC (the same one the guest's own self-rotate calls) —
no second mechanism. Authorises the way its sibling delete does: read through the RLS session
client first, admin client only for the write. Ships as a `formAction` on the shared form rather
than a nested `<form>`, which the repo lints against.

Typecheck 0 errors; nested-form lint passes; 19 tests pass across the suites on this path.

SPEC IMPACT: **Yes** — a new owner ruling. `DECISION_LOG.md` row added: the couple has full control
of their guests, and releasing a claim rotates before detaching.
