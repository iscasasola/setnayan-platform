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
