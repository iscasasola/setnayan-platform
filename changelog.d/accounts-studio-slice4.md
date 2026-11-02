## 2026-07-04 · feat(admin): Accounts Studio slice 4 (final) — Demo vendors tab

- Wires the Demo vendors LIST/overview as the 5th and final tab in /admin/accounts (byte-identical body → _surfaces/demo-vendors-surface.tsx). Legacy /admin/demo-vendors redirects in. inquiries + inquiries/[threadId] stay standalone (their actions live at inquiries/actions.ts — untouched). Sidebar 'demo-vendors' item → ?tab=demo-vendors (matchPrefix '/admin/demo-vendors'). The Accounts menu is now fully consolidated into one tabbed studio. Stacks on slices 1–3.

SPEC IMPACT: None.
