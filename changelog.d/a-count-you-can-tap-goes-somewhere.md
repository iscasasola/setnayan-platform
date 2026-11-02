## 2026-09-18 · fix(vendor): the dashboard counts take you to what they count

Owner, mid-way through the platform's first end-to-end booking run: *"i cannot
open the new inquiries."* His supplier dashboard read **New inquiries · 1**, he
tapped it, and nothing happened.

```tsx
<EnergyKpi value={inquiries} label="New inquiries" />   // no href, no onClick
<EarnedTile … href="/vendor-dashboard/earnings" />       // the tile beside it links
```

All three headline counts — New inquiries, Open tasks, Upcoming — were
display-only, sitting in a row with a money tile that *does* link. So the one
number telling a supplier somebody is waiting was the one thing on the page that
went nowhere.

🔑 **This file already carried the lesson, 180 lines below the defect:** *"href
and no form: a control that looked pressable and did nothing."* Same disease,
opposite direction — that one looked pressable and was inert; these **are** the
answer to "where do I go next" and offered no way to get there.

- `EnergyKpi` takes an optional `href` and renders as a `Link` when given one —
  whole tile, matching `EarnedTile`, because a three-digit number is a poor tap
  target and the label is the part that says where you are going.
- New inquiries → `/vendor-dashboard/messages` · Open tasks →
  `/vendor-dashboard/clients` · Upcoming → `/vendor-dashboard/calendar`.

**The guard checks three separate things**, because each fails differently: every
KPI has an href; the component actually **branches** on it (the likely
regression is adding the prop and never reading it — "keep the call, discard its
result", which has beaten guards in this repo twice); and each destination has a
real `page.tsx`, since a count that links to a 404 is worse than one that links
nowhere — it looks like it worked.

⚠ **My first version of the guard failed against correct code.** The window
`/<EnergyKpi[\s\S]*?\/>/` ended at the **icon's** self-close — `icon={<Inbox …
/>}` — several lines before the href, so every tile read as dead. Anchored on
the closing `/>` that sits alone on its own line. A window that stops at the
first plausible boundary rather than the right one is this repo's oldest guard
bug and it caught me writing it again.

Sabotage: the original defect fails **2**; a bad destination, a swallowed href,
and the money tile losing its link fail 1 each.

SPEC IMPACT: None.
