## 2026-09-16 · fix(privacy): the setting describes the door, not only the window

All four options on `/dashboard/<eventId>/website/privacy` described who could
**view** the landing page. **None mentioned who could join** — and joining is the
larger consequence: it mints a guest session, adds a row to the couple's guest
list, and, owner 2026-09-16, *"they are issued the event hub with the camera."*

### 🔴 The gate admits far more than the copy implied

`app/[slug]/invite/page.tsx` and `selfJoinAction` each refuse on exactly one
value — `resolveEffectiveVisibility(...) === 'private'`. So **Public, Unlisted
AND "Only guests with a Setnayan account" all leave the join door open.**

The third is the one that was actually misleading. Its blurb said *"Anyone else
— including someone you send the link to — sees the locked screen."* **True of
the page; not true of the door.** A couple who picked it to lock things down
would have believed the opposite, and no screen would have corrected them.

### 🔑 The behaviour is the design — so the copy must not read as a warning

Owner, same day: the general QR and a guest's own QR *"both serve the same
purpose. They can register, etc."* and **"the Custom QR will be worth for a
controlled guest QR."** Open joining is how a relative abroad gets in and how the
crew poster QR works. **The per-guest QR is the tool for a couple who wants a
controlled list — not a lock that the open door defeats.**

So the wording states the behaviour and then **names the remedy**:

- **Public / Unlisted** — say plainly that the link also lets someone join, that
  joining hands them the event hub and a camera, and that they land on the guest
  list to keep or remove.
- **Only guests with a Setnayan account** — *"This locks the page, not the join
  link … Hand out your guests' own QR codes when you want a controlled list, or
  choose Private to close joining altogether."*
- **Private** — gains the property that actually distinguishes it: **the only
  setting that closes the join link.**

### Guarded — including against the gate moving underneath the copy

Four tests. Three read the blurbs; the fourth asserts the **gate's own source**
still refuses exactly `'private'` in both files. 🔑 **Every sentence above is
true only because of that one comparison** — widen or narrow it and the copy
becomes a lie with nothing else to notice.

One assertion is about helpfulness rather than accuracy: the restricted option
must name the **remedy**, not just the consequence. A sentence that raises a
problem and offers no fix leaves a couple stuck; that is now a failing test
rather than a matter of taste.

Sabotage-checked: public blurb reverted → **3/1** · door sentence deleted →
**2/2** · gate widened to also refuse `invited_accounts` → **3/1** · remedy
removed, consequence kept → **3/1** · restored → **4/4**.

⚠ **No behaviour changed.** Whether "Only guests with a Setnayan account" should
also close the join door is a real question and an owner decision; this PR only
stops the screen implying an answer it does not deliver.

SPEC IMPACT: records the owner's access ruling — open joining is deliberate, the
per-guest QR is the control. Row in `DECISION_LOG.md`.
