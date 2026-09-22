## 2026-09-22 · fix(day-of): the live photo wall says when it cannot be read

W6 / register LAU-33.

`app/[slug]/_lib/loaders.ts` built the day-of live photo wall inside a `try`
whose failure path was:

```ts
} catch { liveWall = null; }
```

`null` **also** means "this couple does not own LIVE_WALL" and "they turned the
guest mirror off". So an RLS denial, a statement timeout or schema drift rendered
**byte-identically to a deliberate off-state** — the section was simply absent.
The error was not even bound, so there was no log line either: a wall could break
at a wedding and leave no trace anywhere.

🔑 **A LOG LINE NEVER CHANGED A PIXEL.** This follows the precedent set by
`lib/guests-read-is-honest.test.ts` (couple side) and
`app/vendor-dashboard/reads-are-honest.test.ts` (supplier side), and its rule 2
is the one that bites: the measurement has to reach the RENDER. So the change is
in three parts — the loader binds and raises, the value is returned, and
`site-body.tsx` has an arm that draws an honest line at the same anchor id, so
the event-day bar's "Photos" button still lands somewhere that explains itself.

**Why a sibling boolean and not a richer `liveWall`.** Every existing reader
treats it as truthy-or-absent, including `publicAlbumHref`, which routes the
"Photos" button to the inline wall when present and to the album door when not.
Widening that value would move a button on a page nobody asked us to change.

The decision is a pure module, `lib/live-wall-read-state.ts`, so it is EXECUTED
by tests rather than asserted by regex. Two orderings in it are load-bearing and
documented: `off` is checked before `unreadable` (when the mirror is off no read
was attempted, so announcing trouble would cry wolf on the commonest path), and
`unreadable` before `hasData` (a read that failed cannot be trusted to have
produced complete tiles, and half a wall shown as the whole wall is the same lie
in a smaller costume).

⚠ It does not make the wall appear. A failed read is still a failed read. It
stops the failure IMPERSONATING a setting, so a couple whose wall has broken is
told instead of quietly concluding the feature is off.

Proved by sabotage: restoring the bare `catch { liveWall = null }` — the original
defect exactly — turned the loader test red; and deleting the RENDER arm while
leaving the flag computed and returned turned the render test red, which is the
assertion that keeps this from becoming a boolean nobody draws. Restored, 7/7.

SPEC IMPACT: None.
