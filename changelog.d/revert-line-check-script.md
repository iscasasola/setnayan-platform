## 2026-11-21 · chore(ship): revert line-check for every ship batch

`scripts/revert-line-check.sh <batch-ref> <pr>...` — owner rule 21 Nov ("OKAY DO IT"): for every PR entering a batch, every
line main ADDED since that PR's base, in the files the PR touches, must still be in the batch's version of the file. A missing
line is a likely revert → the PR goes FIX-FIRST unless its body names the removal. "Added since the base" means absent from
EVERY `git merge-base --all` of the PR head and the main commit the batch contains, so a stacked PR's own deliberate edits
(e.g. Unichat C/G on top of #8039) are not counted. Generated files, baselines and images are skipped. Prints lines checked
per PR, so a vacuous zero is visible. Proven by sabotage on batches A and B (one deleted main line is reported).

SPEC IMPACT: None (process tool; recorded in specs SHIP-STATE-2026-11-20.md).
