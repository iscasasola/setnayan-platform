## 2026-11-08 · feat(supplier-1build/l1): the frame, the supplier bar and the event side's two moves

THE ONE BUILD, lane L1 (Frame + event side), against prototype v113/v114.

**Foundation (pushed early to `claude/supplier-1build-foundation`).** Category colour tokens `--sn-cat-*` (light + dark) and
Tailwind `cat.*`; one soft hairline `--sn-hair` / `.sn-pin-hair` (no cut line under a pinned row); `--sn-pin-h: 44px`; the
520 ms rise (`--sn-dur-rise`, `--sn-ease-rise`, `lib/rise-motion.ts`); the z-scale `--sn-z-thumb` (25) < `--sn-z-nav` (30) <
`--sn-z-pop` (40) ≤ `--sn-z-modal` (50) with every thumb row and the dock on the tokens (owner ruling, spec §10 #23: page <
thumb row < bottom nav < pop-ups); `CollapsingTop` / `CollapsingTopStack` (attributes + CSS vars, one capture scroll
listener); chrome-away + tab-reselect (`use-chrome-away.ts`); `SnapCarousel` `dots` prop and `advanceMs={0}`; the `portfolio`
settings key (reserved) and "Clients settings".

**Supplier shell.** The bar is **Today · Clients · Shop · Portfolio** (Hub leaves the bar; its pages light Clients; the mood
board library lights Portfolio); registry slots `vendor.sidebar.portfolio` / `vendor.bottom-nav.portfolio` replace the
on-the-day slots; the layout drops the two reads the Hub tab needed. "Customers" → "Clients" in L1's copy. The account sheet's
tiles are **Help · Show me around · Sign out** on every sheet (Your Story's door moves into the help centre; Refer a couple
leaves, owner "NO NEED" — its page stays reachable from Help: an event's sheet opens `/help?refer=<event>` and the help
centre draws "Refer a couple ›" while the programme is on); on the supplier sheet the shop you are in heads a "You are in"
card; "Your collections" leaves the supplier rows. **The sheet's look is the shipped one** (owner 8 Nov: "only the content is
what you change") — Sign out stays the red tile plus the quiet "Sign out of all accounts" line on every sheet; the spec's
"Sign out of…" choice card was not kept. A reserved `client` key joins `SettingsMenu` for the picked client's ⚙.

**Event side (repositioning only).** The bar is **Today · Guests · Suppliers · Memories · Hub** (Home → Today, the word only;
key `home` and the route unchanged). Papic's one card moves to **Memories**, under the keepsake row: `papicCardHref` (renamed
from `papicHomeHref`) → `/dashboard/<id>/memories?papic=open#papic`; the old `/dashboard/<id>?papic=open…` forwards there; the
card's saves land back on Memories (`return_to=memories`); Today draws no card. Copy that named "Home" says "Today".
Guards: `papic-lives-on-home` → `papic-lives-in-memories`, `papic-opens-on-home` → `papic-opens-in-memories` (git mv).

SPEC IMPACT: Corpus DECISION_LOG rows — event tab Home → Today (word only); "THE PAPIC CARD LIVES IN MEMORIES" (supersedes
2026-10-26 "…LIVES ON HOME › TODAY"); supplier bar Today · Clients · Shop · Portfolio; account-sheet tiles Help · Show me
around · Sign out. Applied by the build's corpus pass (THE ONE BUILD spec §9/§10 already records them).
