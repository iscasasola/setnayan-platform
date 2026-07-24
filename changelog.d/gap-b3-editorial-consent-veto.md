## 2026-07-24 · fix(privacy): apply the RA 10173 photo-consent veto to the editorial recap (gap B3)

Gap audit 2026-07-23 · Batch B3. The post-wedding Editorial ("newspaper front
page") is an ANONYMOUS public surface. Its Papic image reads gated only on
`moderation_state='clean'` (the NSFW screen) + `hidden_at` — **NOT** on guest
photo consent. So a guest who opted OUT of photos (`guests.photo_consent=FALSE`)
could still have their tagged seat capture surface on the public recap, unlike
the Live Photo Wall / pool gallery, which already withhold it (the canonical G2
veto in migration `20261112000545` `wall_visible_photos`).

New `editorial/consent-veto.ts` resolves, ONCE per load, the set of
`papic_photos` ids whose tagged guests include anyone who opted out — the SAME
veto the Live Wall enforces — and every public image read now excludes it:
gallery · clips · "As the Day Unfolded" timeline (both builders) · curated hero ·
essay spread · Kwento wish anchors. Consent WINS over the couple's curation (a
vetoed capture never leads the recap even if hand-picked as the hero), and it's
withheld from the couple's chapter EDITOR too (curating a moment that can't
publish would be a footgun).

Fails CLOSED: if the veto can't be resolved (a transient DB error), ALL papic
captures are withheld and the recap degrades to the couple's manual `our_photos`
uploads (which carry no guest tags). The aggregate "By the Numbers" counts are
left as-is (a headcount exposes no individual). Guest disposable-camera captures
were already removed from the recap (B2) and keep their own opt-in gate.

Tested: `consent-veto.test.ts` (5 cases — empty/hit/failed-on-either-read) ·
tsc/lint clean.

⚠ OWNER/DPO NOTE: this closes a live consent leak on a public page. The fix
matches existing owner-shipped Live Wall behavior, so it's not a new policy —
but flagging it because it's RA 10173 material and changes what the public recap
shows for events with opted-out guests.

SPEC IMPACT: None — brings the Editorial in line with the platform's existing
photo-consent veto; no new policy.
