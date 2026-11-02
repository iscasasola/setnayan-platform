## 2026-09-29 · perf(home): the home board starts every read at once

`/dashboard` (the home board, `app/dashboard/(launcher)/page.tsx`) made about
fifteen database trips one after another — checklists, decisions, shop unread,
inquiries, the admin queues, chapters, stories, people, event types, heroes,
posters — though none needed another's answer. Measured on prod 2026-09-29
while signed in: the top of the page streamed in 0.4-0.5 s (1.3 s cold), then
nothing arrived for 1-2 s, and the page finished at 1.5-3.3 s.

Every read is now started as a promise with its graceful-degrade unchanged,
and all are awaited in one `Promise.all` ("THE ONE WAIT"). `planningPosters`
takes the hero read as a promise and runs its own theme read beside it. The
landing redirects still run first, so a user who is bounced into their one
event makes none of these reads. Nothing on screen changes.

Guarded by `app/dashboard/(launcher)/the-home-reads-at-once.test.ts`: no
statement at the page body's depth between the banner and the one wait may
`await` (sabotaged both ways — a stray awaited read, and the wait turned back
into sequential awaits — each fails it).

SPEC IMPACT: None.
