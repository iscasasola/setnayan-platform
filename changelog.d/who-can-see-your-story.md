## 2026-08-22 · feat(story): who can see your story — only me · your people · everyone

Owner 2026-08-22, closing the story maker. The last of the three pieces.

🚨 **THIS IS A PRIVACY FIX, NOT ONLY A FEATURE — "only me" did not exist.**
The public page decided to render the story from the LIFECYCLE alone
(`plan.body === 'editorial'`) and never read the couple's status, while a story
row is created automatically for every event. So after the day, an **unpublished**
story was already readable by anyone who could open the page. Verified by reading:
`EditorialContent` returned data whenever the loader returned any, and the only
use of `published` was building a share URL.

- **The audience lives INSIDE `status`** (`draft` · `event` · `published`),
  copying `creator-chapters.ts`. Several shipped readers already ask
  `status = 'published'` — the Told shelf, the Library's guest view, Real
  Stories, the social card, the admin counts — so every one of them refuses a
  celebration-only story **without being edited**. Forgetting hides; forgetting
  cannot leak. A separate `story_audience` column would have left all of them
  reading `published` and ignoring the couple's choice. **The OG card is the
  proof: it was never touched and is already correct.**
- **ONE gate, and it closes the DATA.** Three surfaces render the component and
  two more read the same loader; each asking its own version is three chances to
  forget and the next surface makes four — how the Live Photo Wall reached every
  guest's phone. `storyAudienceAdmits()` is asked in `EditorialContent` **before
  `composeCopy`**, and again in `/[slug]/print`, which takes the loader directly
  and would otherwise be the way around the page's gate.
- **The viewer defaults to a STRANGER.** A surface that forgets the prop hides
  the story instead of leaking it.
- **An unreadable stored value fails CLOSED to `draft`** — deliberately the
  opposite of the Live Photo Wall's narrowing, where an unknown value silently
  deleting a ₱2,500 feature was the worse outcome. Here the other side is
  somebody's wedding read by strangers.
- The event site passes the viewer it **already resolved** for its lock screen
  and ribbon (host · seated guest · booked supplier) rather than re-deriving it,
  so the story and the lock cannot disagree.

🚨 **AND IT UNCOVERED A LIVE BUG: opening a sub-editor silently UNPUBLISHED a
published story.** `openPiece` saved with `persist(false)` — "save as a draft" —
and the save path read that boolean as the status. A couple clicking through to
their living hero or their photos had the story quietly taken off their page,
from a press that said "open the next editor" and mentioned nothing about
privacy. It now carries whatever audience they already chose.

⚖ **Save and choose are the same press.** "Save draft / Publish" made privacy a
side effect of which button you reached for, and its `false` meant BOTH "only me"
and "I have simply pressed Save". Each of the three rows saves the whole story
AND sets its audience, and the note under them says what the current choice does
— "only me" states in words that it hides the story **from your own guests**, or
somebody picks it to be safe and shows it to nobody.

📊 **Nothing moves for any existing row.** The migration only ADDS a legal value.
Measured in production first: **5 story rows, 0 published.**

🛡 10 tests · **8 mutations, each verified to land by occurrence count, each red.**
🪤 **Two of those mutations first landed and stayed GREEN — my own guards matched
a symbol instead of the act.** Disabling the gate with `if (false && …)` left the
function name in place, and on the print route a bare `/storyAudienceAdmits/` was
satisfied by the **import line** with the call site deleted. Both now pin the
whole statement, and the helper strips imports as well as comments.

SPEC IMPACT: None — no price, SKU or locked decision moves.
