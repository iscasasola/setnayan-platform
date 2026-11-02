## 2026-09-06 · fix(features): the /features sweep finishes

The audit stopped at the first clean grep last time. Finishing the remaining
eight section files found four more false claims — **none of which shared a
single word with the first three**, which is the argument against ever calling
a copy audit done because one vocabulary came back empty.

- `_Communications.tsx` — *"We render every invite at three aspect ratios"*.
  It renders at one. `app/api/website/qr/guest/[guestId]/route.ts` emits a
  single 1024×1024 PNG; there is no story/feed/print variant set. (The print
  sheet at `/dashboard/[eventId]/invitation/print` is real and is kept.)
- `_Communications.tsx` — *"Per-event delivery preferences (per channel, per
  category)"*. There is no preference table and no surface that edits one.
  Which channel a notice takes is a hardcoded per-notice-type allowlist in
  `lib/notifications.ts`, chosen by us, not by the couple.
- `_DayOfApparatus.tsx` — *"Compilation arrives in your gallery the next
  morning"*. Nothing runs overnight: `vercel.json` ships `"crons": []`, the
  render happens in the guest's browser and is closed out by
  `finalizePatiktokRenderJob` on completion. The stub queue-drainer that would
  have batched it was deleted, and a guard exists to keep it deleted.
- `_Compliance.tsx` — *"Your Setnayan software receipts download together"*.
  There is no bundle and no receipts index — `lib/routes.ts` exposes only
  `receipts.detail(receiptId)`, one printable page per receipt.

**The guard had the defect it was built to catch.** Its mutation check restored
all four claims and the run reported exactly ONE: it asserted inside the loop,
so the first throw hid the rest — in a checker whose whole job is finding claims
nobody has looked at. It now collects every violation and reports them together;
re-verified, all four fire.

Checked in this pass and left alone because they are TRUE: the 6-month
originals retention (already pinned by `retention-copy-is-true.test.ts`),
posting a Patiktok compilation to the couple's own TikTok handle, the 4-in-1
Event Hub, the `ai_payment_due` "due within 7 days" notice, RFC 8058 one-click
unsubscribe on guest email, the admin website editor / verification queue /
force-majeure surfaces, and the 24-hour contact window on `/pay`.

SPEC IMPACT: None. Removes claims the corpus never made.
