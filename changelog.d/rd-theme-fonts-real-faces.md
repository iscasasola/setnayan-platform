## 2026-10-04 · feat(themes): the ten missing Google faces — every theme wears its real fonts

Owner, 4 Oct: *"Can you add them for me?"* — the ten spec families #6323 showed
through a stand-in (Lora, Libre Baskerville, Crimson Pro, Josefin Sans, Kaushan
Script, Alex Brush, Parisienne, Cookie, Mrs Saint Delafield, Monoton) are now
committed under `apps/web/app/_fonts/<family>/` from the official google/fonts
repository (pinned commit), by `apps/web/scripts/build-theme-faces.py`, each
with its upstream `OFL.txt`.

- **Reserved Font Names decide the cut.** Eight of the ten reserve their name, so
  — as the repo already does for Cinzel Decorative, Marcellus and the rest — they
  are not subset or instanced: the whole upstream file, WOFF2-compressed and
  nothing else (OFL-FAQ 2.2.1). The script decompresses each result and proves
  every table survived. Lora, Libre Baskerville and Josefin Sans are variable, so
  one file carries every weight. Crimson Pro and Alex Brush reserve nothing and get
  the same latin cut as Cardo (`subset-shipped-fonts.py`'s range).
- Declared in `app/_fonts/choice-faces.ts` with `preload: false`; the theme blocks
  in `globals.css` and `lib/hub-theme-faces.ts` point at them; the stand-in table
  and its fallback path are gone (an unknown family now throws).
- New guard `lib/theme-faces-are-real.test.ts` follows each theme role to the font
  FILE it loads and reads the family from the font's own `name` table, so a
  look-alike fails; also: each file exists and is WOFF2, its OFL sits beside it,
  and none is preloaded.
- ⏳ Not in the Font dropdown yet (named in `hub-fonts-are-loaded.test.ts`
  EXCLUDED): offering them needs a `site_font_key` CHECK migration, and the
  "Most used" count would tie six faces at 2, which a person must break.

SPEC IMPACT: None — the code now wears the families the spec already names.
