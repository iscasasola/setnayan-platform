## 2026-09-15 · fix(invitation): the bottom bar is told who is looking

Owner, on his own wedding page while **signed in**: *"story and join seems
incorrect. is that correct?"* It was not. The bar's last tab read **"Join"** —
the stranger's invitation to add themselves to the guest list — while the owner
ribbon on the same screen read *"YOUR LIVE SITE"*. Two mechanisms, one screen,
one moment, disagreeing about who the reader is.

### The cause was one literal

`site-body.tsx` has exactly two calls to `resolveSiteNav`, and they passed
`{ kind: 'public' }` and `{ kind: 'guest' }` — **never asking**.

🔑 **So the resolver's `isCouple` arm could not be reached from anywhere in the
application.** "Manage" instead of "Join", and the camera unconditionally because
it is their own wedding — written, tested, and dead. Shipped behaviour that no
call site could produce.

The fix is that the page tells the bar what it already knows: `ownerCapability`
is resolved two hundred lines above, for the ribbon.

### ⚠ The vendor arm is still unreachable, and this says so

`{ kind: 'vendor' }` needs `kits`, and nothing on this page resolves them —
`VendorCapability` carries the booking, not the specialisations. Passing
`kits: []` would hand every booked supplier the label **"Tools"** on no evidence.
A supplier still gets the public bar here. That is a **known, stated gap**, it
belongs to the supplier lane, and a test asserts the note survives — an
undocumented gap is indistinguishable from an oversight.

### The guard is on the CALL SITE, not the label

A test asserting "the couple gets Manage" passes against the resolver in
isolation — and **did**, all along. The property that was false is that the page
tells it the truth. So the guard pins the call site, plus a vacuity check that
couple and stranger really do produce different bars (otherwise the fix would be
cosmetic and the file theatre).

**Sabotage-checked**: restoring the literal that shipped turns it red with *"a
signed-in couple is told to Join their own wedding"*.

### Not fixed here: the icon

One slot key (`me`) carries five labels — Me · Manage · Join · and the supplier
kit names — and all five draw a person's face, so a supplier's music desk renders
as a human head. Fixing only "Join" would leave that second occurrence. With the
couple now resolved, the owner's own complaint disappears without touching the
icon map; the glyph remains a separate, smaller defect.

SPEC IMPACT: None — the behaviour was already specified; no call site reached it.
