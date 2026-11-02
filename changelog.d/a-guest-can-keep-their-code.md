## 2026-08-24 · feat(guest): a guest can keep their invitation code

Three screens show a guest their personal invitation QR — the invitation QR card
on the event page, the My QR modal in the hub bar, and the Me panel of the
day-of hub. All three drew it as an inline SVG, so a long-press offered nothing
and a screenshot was the only way to keep it. **The invitation card had been
telling guests "Save this to your phone." the whole time.**

- **New `GET /api/guest/qr`** — hands the signed-in guest their own code as a
  1024px PNG. Authenticated purely by the `setnayan_guest_session` cookie, with
  the same possession check `rotate-qr-actions.ts` uses, so a session minted
  from a rotated (possibly leaked) code cannot fetch the replacement.
  **The route takes no parameters at all** — no guestId, no token, no query. The
  qr_token is a credential; putting one in a path leaks it into history, the
  next hop's `Referer` and every access log between, and an id would invite
  someone to try other ids. With nothing to name, there is no other guest this
  route can be asked about.
- **New `GuestCodeKeepers`** — "Save the code" + "Copy link", mounted on all
  three surfaces. One component, not three hand-built pairs: these screens were
  built at different times and independently ended up with the same gap, so a
  per-surface fix would be three chances to forget one and the fourth surface
  would make four. A failed clipboard write **says so** rather than looking like
  a success.
- **`renderInvitationQrPng`** added next to `renderInvitationQrSvg` in `lib/qr.ts`,
  and the SVG renderer now calls `buildInvitationUrl` instead of spelling the url
  itself. The picture a guest saves and the picture they were shown must encode
  the same link; one builder is the only way that stays true.

**Not gated on a purchase, deliberately.** This is the plain ink-on-cream code
the guest is already being shown for free — saving a picture of your own screen
is not a feature to sell. The paid `CUSTOM_QR_GUEST` branded PNG
(`/api/website/qr/guest/[guestId]`, palette-tinted, ownership-gated) is a
different file and is **untouched**.

**A read failure answers 503, not 401.** Collapsing them would tell a guest
holding a perfectly good code that they are signed out and send them hunting for
a replacement link they do not need.

🛡 **27 tests, 13 mutations, every one measured by occurrence count and every one
red.** Includes the gate's full refusal matrix (no session · rotated token ·
wrong event · missing row · read failure), `Content-Disposition` header
injection via a guest-supplied name (quote, `;`, CRLF), and a byte-equality
check of the PNG against a **hand-spelled** url — so a drift in the url shape
(the `/u/` nesting cutover has already moved it once) fails loudly instead of
shipping a code that signs nobody in.

🪤 **The coverage guard was decoration on its first run and this is why the
counts are printed.** It matched the bare identifier `GuestCodeKeepers`, which
the surviving `import` line satisfies — so deleting the JSX from all three
surfaces left it **green three times**. Re-anchored to `<GuestCodeKeepers`; all
three sabotages now go red, and a newly-added QR surface with no keepers fails
it too (verified with a throwaway component).

Contrast measured in **both** themes, since a light-only check waves through the
dark half: rest `text-ink/70` 5.40 light / 8.93 dark, hover `terracotta-700`
5.02 / 5.17 — all above the 4.5:1 AA floor.

SPEC IMPACT: `WHATS_NEXT_Guest_Activation_2026-08-22.md` § SECTION 2 — gaps 1
("a guest cannot KEEP their QR") and 2 ("the web address under the QR is dead
text") are closed.
