## 2026-11-23 · ship(batch-ad): #8201 chat supplier-ready · #8188 the couple's Today · #8192 reveals (latest) · #8209 one comment stripper · #8213 My QRs

Five reviewed PRs, batched from main with merge commits. No migration.

- **#8201**: the chat supplier-ready walk covers a refused send, a locked mic and an expired thread.
- **#8188**: the couple's Today in the website's look (v5 drawing). Reviewed at 375 px, light and dark.
- **#8192**: the reveals' three latest visual commits: the wax seal, the damask, wide screens. The 16 Oct reduced-motion ruling still holds, unchanged since batch AB.
- **#8213**: My QRs, one page for every shop QR code, replacing Promote's QR part. It keeps Shortlist's two picks, the own-link gift and the NFC tap test.
- **#8209**: one comment-stripper change, the fixes of #8147 and #8148 together. It reads a JSX self-close after `}` as code, and treats `${ … }` in a template as code.

Ship controller: generated files regenerated once (admin jobs, port baseline, screens map; the others are unchanged).

SPEC IMPACT: None (each PR's own fragment carries its spec notes)
