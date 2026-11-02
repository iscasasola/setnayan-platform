## 2026-08-01 · fix(papic): the Pool card promised a QR that does not exist, and hid the ones that do

Owner: *"i cannot find the qr for the papic services."* Two separate faults sat
behind that, and the second is worse than the first.

**① A promise with nothing behind it.** The Pool card — and the onboarding
services card — said:

> "One shared pot for the whole event. **Every guest who scans your QR** shoots
> from it, on any phone, with nothing to install."

That reads as ONE QR the couple prints and anyone scans. **No such QR exists.**
Every Papic QR in the product is a per-SEAT claim link: single use, and the first
scanner takes it — demonstrated accidentally the same day, when a test claim
consumed a seat and the next visitor got *"This seat's already taken."*

The genuine many-camera path is the **guest list**: each guest's own invite QR
becomes their camera (`syncGuestCameras`). So an event with no guest list has
three single-use links and nothing else, which is exactly what the owner was
looking at. Both surfaces now say what is true — every camera draws from the
pool, from each guest's own QR to the links you hand out.

⚠ The sentence was written in the same session that built the Pool buy path. A
promise invented alongside a feature is the easiest kind to leave unbacked,
because nothing downstream contradicts it.

**② The real QRs were unfindable.** They live at `/studio/papic/crew` (a QR per
camera, plus printable cards) — reached from a small text link tucked into the
header of the *off-guest-list* tile, two sections down. The QR **is** the whole
mechanic of Papic, so it now has its own block at the top of "Your cameras",
with a "Show the QR codes" button, a "Print cards" link, and the counts resolved
server-side (`N of M still to hand out`) rather than making the couple open a
page to find out.

## Still to come — the poster QR (owner: "B now and A next")

One URL, unlimited scanners, each getting an anonymous session and a camera on
the shared pool. All the machinery now exists — anon sessions, `papic_claim_seat`,
pool metering. It is queued behind one decision the owner must set: an open QR
plus a shared pool means a single scanner can drain it, so it needs a bound
(rate limit · per-event camera cap · host approval).

Until then the copy no longer promises it.

SPEC IMPACT: None — copy + one surfacing change. The poster QR will need a
DECISION_LOG row when its abuse bound is set.
