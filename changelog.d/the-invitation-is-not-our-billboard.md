## 2026-08-24 · fix(share): a shared invitation names Setnayan once, not three times

**H-3 (= the former AP-4) · W3-D**, and delegated call #7 of 2026-08-23: *"our
wordmark on a shared card → ONCE, not three times. It is the couple's
invitation, not our billboard."*

Measured: `monogramCardTree` named us three times, all unconditional —
`SETNAYAN · INVITATION` at the top, the wordmark in the footer, and
`www.setnayan.com` beneath it. The header keeps the useful half of its label
(`INVITATION`), the url line goes, and the wordmark stays. **Three → one.**

**It is the card that actually ships.** Production holds 5 editorials, 0
published, 0 with a hero photo — so the photo variant and the branded Real-Story
variant are both unreachable, and this monogram card is what every real share of
every real invitation renders today.

The share surface already prints our name anyway (`openGraph.siteName`), so three
more times inside the image bought no reach — it only crowded out the couple.

### ⛔ The photo half is deliberately NOT built, and the reason is security

There is a tempting source: `events.std_media.posterKey`, the poster frame of the
save-the-date film, which one production event really has. It is **the couple's
own object**. SEC-6 exists precisely so guests are served a **sealed, screened
copy** at `events/{id}/std-screened/…` — a spine hardened over three rounds after
a real attack in which a crafted key earned a genuine `approved` verdict while
resolving to a foreign origin. Feeding the unsealed poster to a public,
unauthenticated share-card route walks straight back into that.

The sanctioned photo path — a PUBLISHED editorial hero, via the stable streaming
route — already ships and is already correct (it prefers `heroStableUrl` over a
presign, so a crawler cache cannot pin a dying signed URL). It simply has no data
yet. Both facts are now pinned by tests.

8 mutations, all measured; all red. Two of them exposed my own assertions:
one matched `initials` at its *declaration* rather than where it is rendered, so
gutting the render stayed green.

SPEC IMPACT: None — no price, SKU, schema or locked decision. The Real-Story
showcase cards are untouched; only the couple's own invitation card changed.
