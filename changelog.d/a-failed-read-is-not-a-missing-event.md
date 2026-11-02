## 2026-08-24 · fix(guest): a failed read is not a missing event

Found by the security re-run on `/api/guest/qr`, and **correctly killed there as
"not a security defect"** — the reviewer was right on that point. It is still a
real correctness defect, so it is fixed here rather than dropped because it
failed the lens it happened to be raised under.

The route's second read discarded its error:

```ts
const { data: event } = await admin.from('events')…
if (!event?.slug) return new NextResponse('Event not found.', { status: 404 });
```

Supabase resolves with `{ data: null, error }` rather than throwing, so a
transient database blip made this answer **404 "Event not found."** to a guest
whose event is perfectly fine — a permanent-sounding refusal for a temporary
condition, on the same button.

⚖ **The inconsistency is the tell: four lines earlier the guests read already
made exactly this distinction**, answering a retryable 503 with "Try again."
precisely so a blip would not read as "you are signed out". The second read did
not get the same treatment, in the same function, written in the same sitting.

🛡 A test now walks **every** table read in the route and requires each to
destructure `error`, plus asserts both retryable branches exist. 3 mutations,
all measured, all red: either read dropping its error, and the 503 downgraded to
a 404.

🪤 **The first cut of that test found only ONE of the two reads** — it anchored
on `= await admin`, and one read is wrapped in a ternary so the text does not
match. It passed while checking half the route. **The only reason that did not
ship as a clean sweep was the `>= 2` count assertion**, which is there for
exactly this. Re-anchored on `.from('…')`.

✅ typecheck clean · **test:unit 9631/9631**.

SPEC IMPACT: None.
