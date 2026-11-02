## 2026-08-21 · chore(deps): close the two open high-severity advisories

GitHub had two open high-severity Dependabot alerts, both transitive and both
exactly one patch release behind:

| package | had | needs | advisory |
|---|---|---|---|
| `nanoid` | 3.3.17 | **3.3.18** | custom generators can loop indefinitely when size is zero |
| `js-yaml` | 4.3.0 | **4.3.1** | quadratic CPU consumption in `!!omap` resolution |

Fixed through `pnpm.overrides`, following the convention this repo already
documents in that block: scope the entry to the vulnerable range and bump to the
patched floor **within the same major** (caret), so no parent gets a breaking
bump. The existing `js-yaml@>=4.0.0 <4.2.0` entry is widened to `<4.3.1` rather
than a second entry being stacked beside it.

⚠ **`pnpm update --recursive --latest` was tried first and was wrong twice over.**
It moved **40+ unrelated packages** across three manifests — and it did **not**
move either target, because both are transitive, so updating direct dependencies
cannot reach them. Reverted. The measured result, not the command's success, is
what showed it: the versions in the lockfile were unchanged afterwards.

Verified by re-reading the lockfile, not by the installer's exit status:
`js-yaml@4.3.1` · `nanoid@3.3.18`. The diff is 2 files / 12 insertions and the
only versions that moved in the lock are those two.

9131 unit pass · 0 fail · typecheck 0 errors.

SPEC IMPACT: None.
