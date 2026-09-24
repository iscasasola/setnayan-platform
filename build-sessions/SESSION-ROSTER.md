# Session roster — as at 2026-09-23 ~11:55Z

**A new controller cannot get this from a shell** — it comes from `ListAgents`, so it is written
by hand at handover and **rots immediately**. Run `ListAgents` first and diff.

Address a session by the **exact name** shown. `SendMessage({to: "<name>", message: "..."})`.

| session | area | state at handover |
|---|---|---|
| **PRIORITY BUILD - event hub** | Event Hub | **RANK 0.** Landing #5904, then Event Hub builds 1–2. |
| **Login popup and profile setup flows** | sign-in, open-shop, venue vocabulary | Rank 1 — most done. #5927 landing, then nothing. |
| **Vendor dashboard** | supplier My Shop | Rank 2. 9 commits pushed on `rd/the-shop-says-when-it-could-not-load`, **no PR yet**. 4 plans written. |
| **Event dashboard redesign** | couple dashboard | holds #5913 (public profile poster). |
| **Events button menu** | the rail / nav | #5928 landing. |
| **Event Overview** | overview surface | Rank last — #5874 draft, stale since 09-22, conflicting. |
| **Service card and quotation maker** | quotes | idle, nothing open. |
| **Event Your Team** | the couple's supplier list | idle, nothing open. |
| **Event chatbox between users and vendors** | chat | idle, nothing open. |
| **Papic controller** | Papic | idle, nothing open. |
| **Top nav search box** | search | idle, nothing open. |
| **Wedding march pairing performance** | the march | idle. |
| **Browser review** | live-site verification | idle. Useful: it drives a signed-in browser, which this controller cannot. |
| **WHAT IS LEFT** | the register | idle. |
| **Pause - Canva monogram maker** | monogram | **paused by the owner.** |

## How these sessions behave

They are disciplined and they will push back when you are wrong — **let them.** Today they caught
a briefing of mine that would have stripped a verification badge, a role-group count that was a
grep artefact, and a production risk I was about to relay that the evidence did not support.

**The report format they use:**

```
REDESIGN ▸ <title> · <READY|BLOCKED|NEEDS-OWNER> · branch <…> · <N> commits
FILES:     every non-changelog path touched
PROVED:    the property — sabotage <what broke> went red
COLLISION: the merge-control verdict
```

Ask for it. A build without a watched-red sabotage is a hypothesis.
