## 2026-10-28 · feat(frontdoor): the premium pitch — one turning photo, one line, the album, one place, the close

The signed-out home pitch (`app/_components/frontdoor/front-door-anchor.tsx`) is rebuilt from the
owner-approved prototype `prototypes/front-door-pitch-2026-10-28.html`. Owner: *"I don't feel the urge
to be part of it"* → *"I want the cleanest most premium pitch our website can have"* → *"we have so many
events that we can cater"* → *"set na yan"*.

- **Hero** (`front-door-pitch-hero.tsx`, new): a full photo that turns through event types (debut,
  christening, birthday, reunion, company event, wedding) from the shipped `public/event-types/*` set;
  headline "Your *event*, beautifully handled." — the server HTML says "event", the word turns after
  hydration and never under reduced motion. Button **"I-set ang event mo — free"** → `/start`;
  "How it works" → `/features`. Edge to edge on a phone.
- **The album**: "Every photo. Even the ones you never saw." with a sample notice that states NO
  number, and the Papic credits line kept.
- **One place**: three lines — guests, suppliers, one look (prints "can match" the Hub: printing in your
  own look is Pro).
- **The close**: "Set na 'yan. Let's set that." (owner: "let's set that = set na iyan") + **"I-set na natin 'yan"** → `/start`, then
  Privacy Policy · Terms of Service.
- Dropped: the Option-B bullet row and the drawn before/after tiles. The prototype's event-type pill
  row was NOT built (house rule: no pill rows).
- Kept, by guard: "Setnayan" in the one `<h1>` and a "Setnayan is …" sentence (Google OAuth), the Papic
  line with no number, the terracotta `/start` button, both policy links.
- `the-front-door-tells-the-truth.test.ts` test 1 now pins the new approved headline (and still
  requires "in one album").

SPEC IMPACT: `DECISION_LOG.md` — new row recording the 2026-10-28 front-door pitch ruling (supersedes the
2026-10-25 Option-B headline "Plan any event free. Every photo in one album." for the hero `<h1>`).
