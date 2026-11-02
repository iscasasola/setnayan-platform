## 2026-08-08 · design(#4): the vendor calendar says where the work came from

Two extends from § 2.7, the chip recolours — **and seven live legibility defects
the recolour uncovered, five of them older than this change.**

### 1 · Setnayan-brought vs booked-yourself (§ 2.7b)

A day read `Booked` whether Setnayan introduced the client or the vendor booked
them personally. A full month therefore said nothing about **where the work came
from** — the one thing a vendor weighing the platform actually wants to know.

The builder now counts pool bookings separately from the vendor's own
`external_client` blocks, and the cell + legend distinguish them.

🔑 **PURELY ADDITIVE.** No existing field changes meaning and the six-state
precedence is untouched: a day is still `booked` whoever booked it. The split
only says *who*. Five tests hold it, including the spec's named assertion — an
outside client's day reports `consumed = 1, setnayanConsumed = 0` and is still
`booked` — plus a manual closure that consumes nothing at all.

### 2 · "6 booked · 2 held" under the month name (§ 2.7a)

Counted from the days on screen, so a narrowed filter narrows the counts, which
is correct — it describes what you are looking at. Omitted entirely when both are
zero; `0 booked · 0 held` is noise on an empty month.

### 3 · The chip recolours — and the violet that outlived its own retirement

`whitelist` was still painted violet `rgba(139,123,184,…)`, a **retired palette**.
The customers status pill moved off it long ago; this chip was the last live
consumer. Also retired here: two `#fff` labels the palette lock replaced with
cream on 2026-07-13.

### 🪤 THE RECOLOUR PUT THE 4.2:1 BUG STRAIGHT BACK, AND THE GUARD DID NOT SEE IT

Three of the chips I had just written failed AA — `4.25:1`, `4.14:1`, `4.04:1`.
Every one was a **label on a wash of its own colour**, which is precisely the
family swept clean hours earlier.

The contrast guard reported all clear, because it only understood a literal
`background:…, color:…` adjacency and a Tailwind className. **A style OBJECT —
`{ bg, fg }` applied later via `style={{ background: chip.bg, color: chip.fg }}`
— names the same two colours; only the keys differ.**

🔑 **THE PATTERN A GUARD CANNOT SEE IS THE PATTERN PEOPLE WILL USE.** A named
colour map is the natural way to write a six-state chip table, so the most
structured colour code in the repo was the least protected.

The guard now reads those pairs and composites low-alpha fills against the page
(a chip wash is `rgba(gold, .12)` on cream essentially everywhere; skipping alpha
would have left this same table unchecked again). **1,390 pairings**, up from
1,366.

**It immediately found four more, all pre-existing:**

| | |
|---|---|
| a phone-bar badge, pure white on gold | 3.48:1 |
| the vendor's own Locked + Waitlist chips | 4.21:1 · **2.92:1** |
| a locked-QR "Pending" chip | 4.26:1 |
| two service-request chips | 3.77:1 · 3.41:1 |

All fixed by moving each label to the deeper shade of **its own family**, so
nothing changed hue. One new token was needed (`--sn-warning-deep`).

### 🪤 And a phantom CSS variable, caught before it shipped

The recolour reached for `var(--color-link-hex)`. **It has zero definitions** —
that chip would have rendered with **no colour at all**. Same family as the
phantom column, the phantom enum value and the phantom RPC argument: the
declaration is simply declined and the only symptom is an absence.

### 🪤 Two invalid sabotages, both of which looked like guard holes

Putting a **pale gold label on the dark ink cell** "passed" — and should have:
it measures **6.30:1**. Same shape as an earlier white-on-deep-gold false alarm.
A sabotage has to be a pairing that genuinely fails (`#3A382F` on `#2C2A29`,
1.22:1) or the green means nothing. **Verify the sabotage is a sabotage.**

### Verification

- **7,103 unit tests pass**, 0 fail (5 new) · `palette-lock` 8/8
- **all 21 lint guards green** · `tsc` clean
- object-pair path sabotage-tested from a confirmed-green baseline

SPEC IMPACT: None — implements § 2.7, § 2.7a and § 2.7b as written.
