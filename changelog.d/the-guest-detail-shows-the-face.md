## 2026-08-19 · fix(guests): the guest detail shows the guest

**SPEC IMPACT:** None.

The last of the guest-photo trace. This screen read **no photo at all** — every
guest showed initials, **including one whose selfie was sitting in the very row
the component was already handed**.

It is the guest screen where a face matters most: the couple opens it to work out
who somebody is.

**Not a broken image, so nothing gave it away.** Just a face that never appeared —
the quietest of the four defects in this trace, and the only one with no glyph to
notice.

### Wired at BOTH mounts, because one would have been half a fix

The desktop **inspector** and the mobile **sheet** render the same body. The
inspector reads the page's resolved map directly; the sheet opens from a client
store that carries only the row, so the map is handed to its host instead.

⚠ The resolver had to move **above** the inspector block — it was declared below
the code that now reads it, which `tsc` caught immediately.

The prop is named `photoDisplayUrl` and its docblock says never to pass
`guest.photo_url`: that column holds an `r2://` **reference**, and a raw one in an
`<img>` is the exact defect the three sibling screens shipped with. Null falls
back to initials, so a miss is safe.

🛡 `the-detail-shows-the-face.test.ts` — 3 assertions, 4 sabotages measured by
occurrence count (1→0 each), all RED: the photo never renders · the initials
fallback removed · the inspector unwired · the sheet unwired.

Verified: `tsc` clean · 8721/8725 (4 pre-existing missing-module failures) ·
lost-controls ✅ 402 routes.
