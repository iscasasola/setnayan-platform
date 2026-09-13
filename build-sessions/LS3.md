# LS3 — Setnayan's own encoder: the program output reaches YouTube without OBS

**Model:** Opus 5 · **Effort:** high · **Wave:** after LS1 + LS2 merge · **SCOPE FIRST, BUILD SECOND**

Measured against `origin/main` @ `1838a68c6` on 2026-09-02. Re-fetch before you act.

Start a new Claude Code session and paste EVERYTHING below the rule.

---
---

Read the repo's own CLAUDE.md and the corpus CLAUDE.md first, then follow RULE 0: assume what you
are about to build already exists, and locate it before writing anything. On this stream RULE 0 has
now paid SEVEN times — "invite an off-platform supplier", "a supplier can only tap six fixed
messages", "the camera screen says 3 cameras free to test with", the host stranger-copy defect, the
NPC residency rows, the camera-claimer name, and the ENTIRE captured-by-person build were all
reported as missing and ALL already ship.

0. MEASURE AGAINST origin/main, NEVER A LOCAL CHECKOUT. `git fetch` first, then read with
   `git grep <pattern> origin/main -- <path>`. The main checkout on this machine was 2237 commits
   behind while reporting itself as main, and it produced four false findings in one hour —
   including two sessions scoped to build things that already shipped.
   NEVER ANCHOR ON A LINE NUMBER. Grep for a string. Line numbers rot between fetches.

0b. A `git add` THAT STAGES NOTHING REPORTS SUCCESS. This repo's root is an ALLOWLIST: `.gitignore`
   line 18 is `/*`, so EVERY new top-level file or directory is ignored unless a `!/path` line below
   it says otherwise. `git add <new-top-level-path>` then exits 0 having staged nothing, `git status`
   shows nothing, and the work never enters the repo. `.gitignore`'s own header records this
   swallowing a README once already. If you create ANY new top-level path, add its `!/path` line in
   the SAME commit and verify with `git check-ignore -v <path>` before believing it is staged.
   Nested paths (under apps/, supabase/, changelog.d/ …) are unaffected.

0c. A CHECK THAT CANNOT FAIL IS NOT A CHECK. Twice in one day a verification command returned a
   confident FALSE answer because of its own shape, not the repo's state:
     · `for f in $list; do git cat-file -e "ref:$f"; done < <(...)` — a command inside the loop
       consumed the loop's stdin, so every probe failed and reported "97 files absent upstream".
       All 97 were present.
     · `git check-ignore -v X | head -2 || echo "not ignored"` — `||` binds to the PIPELINE, whose
       status is `head`'s zero, so the fallback branch can never run and BOTH outcomes print nothing.
     · `timeout 60 <cmd>` printed `DB_EXIT=127 elapsed=0s` — **`timeout` does not exist on macOS**,
       so the command never ran. 127-in-zero-seconds reads as a fast decisive result if only the exit
       code is printed. 🔑 **PRINT ELAPSED TIME BESIDE EXIT STATUS.** Duration is a cheap, general
       detector for "the command did not run", which no exit code alone can distinguish from "the
       command ran and failed".
   Before believing a verification, ask what output the FAILING case would produce and confirm the
   command can produce it. Prefer an explicit `if cmd; then … else … fi` over `&&`/`||` after a pipe,
   and prefer set arithmetic (`comm`, `sort -u`) over per-item loops that shell out. If a result is
   implausible — everything present, everything absent, silence from both branches — suspect the
   check before the repo.

WORKING RULES — every one has cost this project real work before:

1. Branch, then `git worktree add` IMMEDIATELY — beside the repo, NEVER in /tmp, and branch FROM
   origin/main. A finished, proved change was lost to a /tmp worktree on 2026-08-28.
2. `pnpm install` in the worktree BEFORE running anything. A run in an uninstalled worktree means
   nothing.
3. `git fetch` before branching. origin/main moved 2237 commits ahead of a checkout that still
   called itself main.
4. PUSH THE MOMENT IT TYPECHECKS. Do not batch a session's work into one commit at the end.
5. Typecheck with the exit code printed beside the error count:
   NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json > /tmp/tsc.log 2>&1; \
     echo "TSC_EXIT=$?"; grep -c 'error TS' /tmp/tsc.log
   An EMPTY log is NOT a clean one — tsc exits 134/143/144 on abort and that reads as zero errors.
   Require TSC_EXIT=0 printed beside ERROR_LINES=0; either one alone is a lie. Never run two.
6. Require `# tests` to be NON-ZERO before believing any pass. Zero-tests-zero-failures is
   byte-identical to success and exits 0. A --test glob that matches nothing behaves identically.
7. Mutation-test every assertion you add and PRINT THE OCCURRENCE COUNT before → after. An
   unmeasured sabotage proves nothing. If a well-formed sabotage reports GREEN, suspect the
   sabotage before the guard.
8. Read the live object, never a migration comment or a docblock. A migration comment is not
   evidence; neither is a decision log; neither is this prompt.
9. Add a changelog fragment in changelog.d/ — never edit CHANGELOG.md or STATUS.md directly.
10. Auto-merge is the standing default: `gh pr merge <n> --auto --merge` right after creating it.

AUTONOMY RULES — how this session finishes rather than stalls:

11. DONE MEANS MERGED. After arming auto-merge, poll until the PR reads MERGED. If a required
    check fails, read the failure, fix it, push again. Do NOT hand back a red or open PR and call
    the session complete. If the same check fails twice for the same reason, STOP and escalate.
12. NEVER STALL ON A GATE. If a feature flag's production value is unknown, build behind the
    EXISTING flag, defaulted off, and record the open question in your handback. Do not stop and
    wait for an answer you were not promised.
13. WRITE STATE AS YOU GO. Create the changelog fragment on your FIRST commit, not your last. If
    you are running low on context, commit and push everything already proved, and write the next
    concrete step into the fragment so a fresh session resumes instead of restarting.
14. IF THE DEFECT IS NOT THERE, SAY SO AND STOP. Do not invent adjacent work to justify the
    session. Report what you measured, with the command and its output. That is a complete and
    successful session — two of this program's ten original sessions ended that way.
15. ONE SESSION = ONE BRANCH = ONE PR. If the work genuinely needs a second PR, say so in the
    handback before opening it.
16. HAND BACK IN THIS EXACT FORMAT so the overseer can verify without re-reading everything:

    SESSION: <C-id>
    PR: <#number> <MERGED|OPEN|BLOCKED>
    MEASURED-AGAINST: origin/main @ <sha>   (must be a fetched sha, not a local HEAD)
    TSC_EXIT=<n> ERROR_LINES=<n>
    TESTS: <# run> passed, <# run> total   (must be non-zero)
    MUTATION: <assertion> — before <n> occurrences, after <n>
    PREMISE: <HELD | FALSE — with the command that showed it>
    OWNER QUESTION: <none, or the one thing you could not resolve>
    LEFT UNDONE: <none, or exactly what and why>

---

TASK — LS3: close the last hop. Today the couple runs OBS.

⚠ READ THIS FIRST, IT IS THE MOST LIKELY WAY THIS SESSION GOES WRONG. THE MULTICAM CONTROLLER IS
ALREADY BUILT AND IT WORKS. Phones publish over WebRTC (`app/panood/control/[eventId]/_components/
camera-feeds.tsx`), the controller cuts between channels, SPLIT SCREEN exists (`secondaryStream` +
`splitRatio` in `lib/panood-program-bridge.ts`), the program pop-out renders the composite for
window capture, the watermark/branding decision is resolved server-side, and the YouTube broadcast
is created on a Setnayan pool channel. NOTHING IN THAT LIST NEEDS REBUILDING. RULE 0 applies with
full force: locate each piece and say where it is before you write a line.

THE GAP, precisely: a browser cannot push RTMP (no raw TCP sockets), so something between the
controller and YouTube must. Today that something is OBS, installed and configured by the couple
with a stream key. This is a USABILITY gap, not a capability gap — Live Studio works end to end
right now. Do not describe it as broken.

WHAT WAS ALREADY RULED OUT, with evidence — do not re-litigate without new evidence:
  · CLOUDFLARE STREAM CANNOT DO THIS. Its WHIP/WebRTC path states plainly: "Simulcasting
    (restreaming via RTMP/SRT) is not supported". Stream Live ingests RTMPS/SRT — which a browser
    still cannot speak. Verify at https://developers.cloudflare.com/stream/webrtc-beta/ before
    building on it.

THE RECOMMENDED PATH — the desktop app you already ship.
`src-tauri/tauri.conf.json` exists and `.github/workflows/build-desktop.yml` produces `.dmg` +
`.msi` on push to main. Teach that app to capture the program output and push RTMP itself. No
per-minute cost, no new vendor, no install the operator was not already doing — running a multicam
wedding means being at a laptop regardless. This IS the "native capture app was never built" that
the admin channels page names.

  Scope it honestly before building: capture source, encoder (ffmpeg/GStreamer sidecar vs native),
  bitrate/keyframe settings YouTube requires (H.264 + AAC, 2s keyframe interval, CBR), where the
  stream key comes from and how it is kept out of logs and out of the renderer process, and what
  happens when the push drops mid-ceremony.

THE ALTERNATIVE, if the desktop path is rejected: a media-server relay (browser → WHIP →
LiveKit/mediasoup → ffmpeg → RTMP → YouTube). Zero install, but a recurring per-minute cost on
every wedding and a new production dependency in the path of an unrepeatable day. Price it against
the ₱1,500 event-day before recommending it.

🔑 A FAILURE MUST REACH THE RENDER. This repo's signature defect is a failure that looks identical
to success or to emptiness — an upload that stopped fired no event at all and sat at 0% forever. An
encoder that dies mid-ceremony must say so ON THE CONTROLLER, loudly, not only in a log. Budget for
that; it is not polish.

🚫 DO NOT WEAKEN THE PAYWALL. `decideWatermark` and the Wave 5 free-tier pin (an un-entitled
event's program output is CUT-BLIND, pinned to one camera) are resolved server-side and pushed to
the capture surface precisely so the console and the encoder cannot disagree. A new encoder must
consume that decision, never re-derive it — it would be the easiest surface to leave uncovered.

DELIVERABLE FOR THIS SESSION: a written scope with a recommendation, the real cost of each path,
and the smallest shippable slice — NOT a half-built encoder. Open a PR containing the scope
document if no code is ready. Say plainly what you could not determine.

SPEC IMPACT: likely — 09_Panood § 6 and the Live Studio unified spec both assume an external
encoder. Flag for owner sign-off; do not edit the corpus unilaterally.
