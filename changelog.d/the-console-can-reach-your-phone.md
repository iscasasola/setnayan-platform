## 2026-08-26 · feat(admin): the console can reach your phone

Every screen in this admin assumes the owner **opens** it. Nothing made him.

Measured 2026-08-26: `push_subscriptions` in prod holds **0 rows**, and the only two push
toggles in the whole product live on the **couple profile** and the **vendor notifications**
page — **nothing under `/admin` at all**. So the person running Setnayan had no control
anywhere to turn on phone alerts for admin work.

🔑 **The loop was demonstrably open.** The first real sale (`S89O-BSTY3J0STT`, ₱2,499,
2026-08-25) correctly emitted *"New order awaiting reconciliation"* to every admin — and it
was **still unread the next day**. The in-app fan-out and the email allowlist were both
already right; the missing piece was a way to be told without looking.

**One component, not a third copy.** The couple's 169-line toggle is the only working
implementation — the vendor's 90-line one is a stub whose own docblock says so and whose
"Enable" path merely raises a banner. It is promoted out of the customer profile's private
`_components` into `app/_components/`, because three trees now share it. One import site
changed; the private path is gone so nothing can drift back to it.

⚖ **Safe to ship before the keys are confirmed.** The toggle asks for browser permission
only when it is flipped ON (Apple 4.2 — never on paint, never on login), and where push
cannot work (no VAPID key, no service worker, iOS Safari outside an installed PWA) it
renders a quiet "not available" note instead of a dead switch.
⏭ **OWNER ACTION, not code:** confirm `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
in Vercel. They are **not readable from a session**, and `lib/web-push.ts` gates entirely on
them — it warns and continues rather than failing loudly, so their absence looks like
silence, not an error.

Guard: `app/admin/the-console-can-reach-your-phone.test.ts` — 3 assertions: the admin mounts
it, the couple imports the SAME module and the private copy is gone, and the toggle still
prompts only on a deliberate press and still degrades quietly.

SPEC IMPACT: None — no rule, price or behaviour changes; a control is added where one was
missing.

### The port-controls baseline is regenerated, and audited before trusting it

Moving the file made `lint-port-no-lost-controls` report that
`/dashboard/(account)/profile` *"no longer shows `<ArrayBuffer>`"* and *"`<Status>`"* —
TypeScript **type names** the scanner had harvested as blocks from the file that moved, not
controls anybody can press. The switch itself is still on that page; only its import path
changed.

🔑 **A BASELINE IS A BILL, NOT A RUBBER STAMP** — so the regeneration was diffed before it
was accepted, not after:

```
routes       405 → 405     (none lost, none gained)
actions      586 → 586     (unchanged)
destinations 869 → 872     (three GAINED — the admin's new switch)
absorbed:    the moved file path, and the blocks 'ArrayBuffer' + 'Status'
```

**No route lost a destination or an action.** Nothing a person can do was removed.

🪤 **And the reason CI caught this and I did not:** on this branch I ran `tsc` and the unit
suite but **not the lints**. `lint` in CI is a family of ~24 scripts, and the suite passing
says nothing about them.
