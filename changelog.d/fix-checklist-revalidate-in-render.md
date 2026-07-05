## 2026-07-05 · fix(dashboard/checklist): move revalidatePath out of render

`ensureChecklistSeeded` (in `apps/web/app/dashboard/[eventId]/checklist-actions.ts`)
called `revalidatePath('/dashboard/${eventId}')` synchronously while it ran during
the render of the checklist page (`EventChecklistPage`) and the home checklist card
(`ChecklistAsync`). Next.js does not support `revalidatePath` during render —
"Route ... used revalidatePath during render which is unsupported." It was caught
and graceful-degraded, but was a real bug (Sentry JAVASCRIPT-NEXTJS-B, 9 occurrences
since 2026-06-18).

Wrapped the call in `after(() => revalidatePath(...))` from `next/server` so the
cache invalidation runs after the response is sent, outside the render pass. The
callers already re-read the checklist rows in the same render (after the seed +
auto-complete), so the current surface reflects the changes without any revalidate;
the deferred revalidate only busts the sibling cached home-dashboard surfaces. What
gets seeded and the displayed checklist content are unchanged.

SPEC IMPACT: None.
