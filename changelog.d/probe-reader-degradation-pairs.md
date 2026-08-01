## 2026-08-01 · feat(observability): two more derived pairs — the readers that fail by returning nothing

Same derived shape as `paid-order-activation`: state the pair of facts once, let a query find the gap, instrument nothing.

- **`vendor-calendar-reach`** — a live pool booking should appear in that vendor's calendar read.
- **`guest-list-reach`** — a non-deleted guest row should appear in that event's guest list.

**Why neither is tautological, which is the only question worth asking about a probe like this.** Both compare a reader against a direct count of the same filtered rows, under the same client. That looks like it must always pass. It does not, because both readers swallow their errors:

```
const { data: rows } = await supabase.from('vendor_schedule_pool_bookings')…  // no error check
const bookings = (rows ?? []) as …
```

`fetchVendorPoolBookings` discards the error object entirely. A renamed column, a dropped column, a view/table divergence, an RLS change — all come back as `data: null` and become **an empty calendar with no exception and no log**. The vendor opens their day and sees nothing; the page renders perfectly. That is the phantom-column class this codebase has already shipped once, and `?? []` is what hid it.

`fetchGuestsByEvent` says it out loud. Its header carries a five-pass hotfix history ending in a deliberate decision to *"always graceful-degrade, never crash the page"* — on RLS denial, auth failure, network error or schema drift it returns an **empty guest list** rather than throwing. That is the right call for a page a host is standing in front of, and it makes the failure invisible from inside the product: a host with 39 guests sees a clean empty state and concludes they imported nothing.

**A reader that cannot fail loudly needs something outside it that can.** That is what these two are. Nothing in CI can see this class — a `?? []` fallback typechecks fine and every test stays green.

Both truth counts mirror the readers' own filters exactly (`released_at is null`, `deleted_at is null`); a truth count with a wider filter would fault on healthy data. `Math.min(got, expected)` keeps a reader that somehow returns *more* than exists from masking another event's shortfall.

Coverage is now **6 probes**. Two notes on what that does and does not mean, both already visible on `/admin/app-performance?tab=interconnections`:

- `paid-order-activation` currently has **nothing to check** — prod holds **0 settled orders**. It is correct and inert until the first real purchase, and reports `empty` rather than green.
- These two have live data today: 1 pool booking, 39 guests.

SPEC IMPACT: None — new observability probes, no product behaviour changed.
