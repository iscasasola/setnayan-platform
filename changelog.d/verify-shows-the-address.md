## 2026-08-10 · fix(admin): the verification reviewer can finally see the address they are meant to be checking

Owner, asked how we make sure a shop's address is correct: *"i think, we already created this before?"* — **RULE 0, and he was right.**

**Address verification already ships. It is the document review.** Three of the required uploads state a registered business address, and an admin already reads all three:

| document | what it proves |
|---|---|
| **DTI or SEC registration** | the registered business name and address |
| **BIR Form 2303** | the address the business files taxes from |
| **Mayor's Permit (current year)** | the address the business is licensed to operate at |

That is what makes an address TRUE. Nothing was needed for it — and the map pin added earlier this session does something different and should not be mistaken for it: it makes the address **findable** (coordinates for distance filters and city search) and, with the confirm step, stops a vendor accepting a wrong guess by accident. **Plausibility, not proof — anyone can drop a pin anywhere.**

### The one real gap, and it is small

`/admin/verify` showed the vendor's **city** and never their **`hq_address`**. So a reviewer sat holding a Mayor's Permit naming a complete street address, with only *"Quezon City"* on screen to check it against. The comparison the whole review exists to make was the one thing the screen did not support.

The claimed address now renders directly above the city, in the identity block the reviewer already reads, with a note recording why it is there.

🪤 **Two self-inflicted bugs on the way in, both caught by `tsc`:** an indent-blind replace produced a duplicate object key (TS1117), and only one of the two vendor-mapping sites got the new field — the DEMOTED-vendor fallback path was silently missing it (TS2322). Worth naming because that fallback is the branch nobody looks at, and a missing field there would have shown a blank address for exactly the shops most likely to be under suspicion.

⏭ **Not built, and deliberately so:** no automated comparison between the typed address and the documents. Reading a scanned Mayor's Permit is exactly the judgement a person is for, and the queue is already shaped that way (owner ruling 2026-08-04: judgement queues get a sentence, not a button). This change gives the reviewer the evidence; it does not pretend to make the call for them.

Verified: **7313/7313** unit · all 20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None — the verification contract is unchanged; the reviewer is simply shown a field the record already held.

---

## 2026-08-10 · fix(open-shop): the pin now records an ADDRESS, not just a dot

Owner, correcting the previous entry's direction: *"ok scratch that. we just want them to pin the address so we can verify with their documents when they send it after. just fix the location pinning properly."*

**That sentence is the design.** The pin is a CLAIM; the DTI/SEC registration, the BIR 2303 and the Mayor's Permit are the proof, checked later by a person. Nothing here tries to verify anything — it just has to capture the claim honestly and let the vendor see it before it commits.

Three defects, all in "capture it honestly":

**1 · A tapped pin submitted NO address.** Type-to-search filled the address box; tapping the map or pressing *Use my location* filled the city and the coordinates and left the address **empty**. So the reviewer holding a permit that names a full street had a dot and the word "Quezon City" to check it against — the exact comparison the review exists to make, missing, for anyone who used the map the way a map invites you to use it. The lookup already knows the street; it is now written down.

🔑 **But only into an EMPTY box.** A vendor who typed their address said it in their own words, and those are the words that will match the permit. A geocoder rewriting *"Unit 4B, 12 Banawe"* into *"Barangay 123, Fourth District"* is worse than leaving it blank — it reads as the form correcting them, and it makes the document check disagree with itself. Rule extracted to `lib/pin-address.ts` and mutation-tested, because it lived as a callback inside a `setState` where nothing could break it on purpose.

🪤 **Writing into the box re-triggered the search that produced it** — the pin drifts off the spot the vendor just tapped, for no reason they can see. One-shot `echo` ref.

**2 · The map still relied on an observer firing at the right moment.** All four steps are mounted at once and step 4 is `display:none`, so Leaflet measures 0×0 and keeps believing it. The ResizeObserver fix is correct and stays, but it makes a visible map depend on an observer we have not tested in every browser. There is now an explicit signal — the step says *"I am on screen"* and the map re-measures, over two animation frames because a single one can still land before layout settles.

**3 · The map was 180px tall.** Not enough to place a pin accurately with a thumb. 240px.

⏭ **Deliberately NOT added:** any automatic check that the typed address matches the documents. Reading a scanned Mayor's Permit is what a person is for, and this queue is already shaped that way.

Verified: **7316/7316** unit · 20/20 `lint-*.mjs` · `tsc` clean · the fill rule breaks its test when sabotaged.

SPEC IMPACT: None.
