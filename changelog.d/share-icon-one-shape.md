## 2026-11-10 · fix(ui): every share button uses the box-with-arrow-up icon

Owner, 10 Nov: "fix all the share buttons to have the same icon. the box with the arrow up". Every control whose
action is sharing now draws lucide `Share`, keeping each file's size and stroke classes. Before, a share action wore
one of four marks: `Share`, `Share2` (the three-dot node), `Send` / `Copy`, or a hand-drawn copy of the box.

- `Share2` → `Share`: profile share, public-page share, QR card Share, story card (recap), Papic "Share my Story",
  Real Stories native share, `/v/[slug]` share, shop cover Share, "Share my page", supplier sheet Share, supplier
  invite Share, the guest invite "more apps" row, the guest-setup one-link Share.
- `Send` → `Share`: crew QR Share, mood board "Share with your supplier" and "Share with suppliers".
- `Copy` → `Share`: the shop cover sheet's "Send to a couple · Share" (it opens the share sheet).
- Hand-drawn svg → `Share`: the guest's "share your schedule" and "send their invite" on the event page.
- Left alone, each reasoned in the guard: the Facebook dual-stream card (Share2 = "a second destination"), the
  admin "Social queue" nav/tab icons, the supplier panel's "Create their link" / "Try again" (make a link, share
  nothing), the in-app "Send to {shop}" message button, Facebook-glyph and Pinterest-glyph buttons, the access-request
  grant toggle, and the supplier's "Share an album link" paste form.
- New guard `apps/web/lib/share-buttons-use-one-icon.test.ts`: Share2 only on the reasoned allow-list; a control
  labelled "Share…" passes `icon={Share}`; the icon before the word "Share" is `<Share`, never a hand-drawn svg.

SPEC IMPACT: None
