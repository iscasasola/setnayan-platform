## 2026-08-24 · fix(dashboard): a failed count is not a count of zero

Third pass, and this one was invisible to the guard the first two shipped. That
guard matched one destructure — `const { data … }`. A **count** is the same
defect wearing a different one:

```ts
const { count } = await supabase.from(…).select('id', { count: 'exact', head: true });
const n = count ?? 0;          // a refusal, rendered as a real zero
```

`?? 0` is the purest form of the class, because the zero it invents cannot be
told apart from a measured one.

What it was doing:

- **Papic** — **"0 cameras ready"** to a couple whose guests all hold one. Worse,
  the page compared that invented zero against what it expected and, finding a
  gap, ran a camera self-heal. Nothing was duplicated (that routine re-reads the
  seats itself), but **a write triggered by a read that failed is a write nobody
  asked for**, and it no longer happens.
- **The Patiktok booth** — the daily render soft cap counted today's renders and
  an unread count read as *"nothing rendered yet"*, so **the cap could never
  fire**. A cap that fails open is not a cap.
- **The booth's face pre-fill** — an unread consent count read as "nobody
  consented". It still fails closed, which is right, but now knowingly.
- **The keepsake magazine's guest count was already honest** — `?? null` passes a
  refusal through and the builder omits the line rather than printing *"0 guests"*
  into a wedding album. Left exactly as it was; only the trace was missing.

The guard grows a fifth rule for the `{ count }` shape, with its own bill (empty
— all 10 count reads in this tree are bound) and its own **floor**, because this
rule is the one most likely to quietly stop matching, and an empty sweep looks
exactly like a clean result.

SPEC IMPACT: None.
