## 2026-08-24 · feat(guest): a guest can say who they are bringing

W2-A item 9 — the last of the five register items.

The host's own help text promises the +1's name arrives, and the couple's guest
list shows a **"+ TBA"** chip waiting for it. Nothing on the guest side could
send it. No name ⇒ no row ⇒ no QR ⇒ no camera for that person.

### 🔑 The register's causal chain was FALSE, and Rule 0 caught it

Two shipped mechanisms already mint a real row with its own QR: the host's *add
a guest* form, and `/welcome`, where the **+1 names themselves** the first time
they open their invitation. What was missing was the **primary guest's** side of
it. So this is an append to the shipped reply card, not a new screen — and
`/welcome` is deliberately untouched, still the +1's own door.

### 🔑 And the card was not missing a BOX — it was missing a FACT

`plus_one_allowed` was never selected by the guest-side loader and had no slot on
`GuestRow`. The widget was plus-one **blind**: it could not know the guest was
entitled to bring anyone. Threading that column is the actual fix; the box is the
easy half.

### 🔒 The security property, and why it is not optional

The block only **renders** when the host allowed a +1. **A rendered gate is not a
gate** — both fields can be posted by anyone holding the URL. The write therefore
**re-reads `plus_one_allowed` from the database** before creating anything.

Without that read, any guest could mint themselves a **second seat, with its own
QR and its own camera**, at an event whose host allowed them none. Two mutations
exist for exactly this and both go red.

### The rules it shares with the rest of the card

⚖ **A blank box is not a removal** — the same rule the contact boxes follow.
Removing a +1 destroys a real guest row with its own QR; that is the host's
action, not something a guest does by clearing a field. The write is skipped
entirely on an empty submit and contains no delete.

🔑 **Naming the +1 clears `display_name`** — `guestDisplayName` prefers it, so
leaving the `'+ TBA · brought by …'` placeholder would keep it on the seating
chart and in the emcee script. That is the same half-fix `/welcome` shipped with,
corrected in the previous commit. The name is also mirrored onto the primary so
the host's own list chips stop reading "+ TBA".

🖥 **No new client JS.** The block is revealed by the same CSS-only
`:has(input[name="rsvp_status"][value="attending"]:checked)` rule the selfie
block already uses.

📝 **One copy correction:** `lib/help.ts` claimed *"the primary names them on
first scan via the welcome flow"* — wrong in both halves. `/welcome` is reached
by the **+1's own** session, not the primary's. It now describes both routes.

🛡 **6 mutations, all measured, all red** — the entitlement taken from the form ·
the DB re-read removed · a blank box wiping the +1 · the placeholder surviving ·
the box shown to everyone · the loader dropping the column.

✅ typecheck clean · lint exit 0 · **test:unit 9721/9721**.

SPEC IMPACT: closes item 9 of `WHATS_NEXT_Guest_Activation_2026-08-22.md`
§ SECTION 2. All five register items (3, 4, 5, 6, 9) are now closed.
