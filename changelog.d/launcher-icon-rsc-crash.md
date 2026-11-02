## 2026-07-14 · fix(launcher): stop /dashboard crashing — don't pass a lucide icon COMPONENT to the client Expandable

Owner report: `/dashboard` (the account launcher) hard-crashed to the global
error boundary ("Something on our end didn't work.", reference/digest
`1570884219`) — deterministically, on every load, for multi-event / console
users (single-event users are redirected straight into their one event and never
render the launcher, which is why it wasn't universal).

Real error (from Sentry, digest `1570884219`):

> Functions cannot be passed directly to Client Components unless you explicitly
> expose it by marking it with "use server". … {$$typeof: …, render: function,
> displayName: …}  at stringify

Root cause: `(launcher)/page.tsx` is a Server Component and rendered
`<Expandable icon={Users}>` / `icon={LayoutGrid}` / `icon={Wand2}` /
`icon={Sparkles}` — passing a **lucide-react icon COMPONENT** (a `forwardRef`
function, shape `{$$typeof, render, displayName}`) as a prop to `Expandable`,
which is a **Client Component** (`'use client'`). lucide-react is not a client
module, so those icons are plain server-side `forwardRef` objects; React can't
serialize a function across the server→client boundary, so it throws at
`stringify` while encoding the client component's props. Three account-section
Expandables → the three identical errors seen per load. (Note: this is a
SERIALIZATION error, not a render error — a React error boundary can't catch it,
so the whole route falls to `app/error.tsx`.)

Fix (surgical, 2 files):
- `(launcher)/_components/expandable.tsx` — `icon` prop changed from
  `ComponentType<{ className?: string }>` to a rendered `ReactNode` element, and
  the header chip now renders `{icon}` instead of `<Icon …/>`. A rendered
  element is plain serializable RSC payload; a component function is not.
  Documented the reason inline so it isn't reverted.
- `(launcher)/page.tsx` — the 4 `<Expandable>` call sites now pass a rendered
  element: `icon={<Users className="h-[18px] w-[18px]" />}` etc. (rendered on the
  server, serialized as normal RSC output). Icon size + `text-mulberry` chip
  colour are unchanged.

Scope verified: `<Expandable>` has exactly 4 call sites, all in `page.tsx`. The
launcher's other icon-taking components (`SpaceCard`, `AccountLinkRow`) are
Server Components, so `icon={Component}` never crosses a boundary — left as-is.
Other client components that declare `icon: ComponentType` (admin nav, hub shell,
sub-nav) live on pages that currently work, i.e. they resolve icons within the
client tree rather than receiving a bare component from a server parent — not the
same bug, left untouched.

Verified: `tsc --noEmit` green.

SPEC IMPACT: None (runtime bug fix; no product/pricing/positioning change).
