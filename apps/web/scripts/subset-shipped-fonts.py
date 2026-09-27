#!/usr/bin/env python3
"""subset-shipped-fonts.py — latin .woff2 cuts of fonts the repo ALREADY ships.

WHY: the Maker's Font dropdown offers every family we ship (owner 2026-09-27:
"remember to use all our fonts on the dropdown"). Three of them existed only as
full .ttf files kept for other jobs (OG cards in lib/social/fonts, the Monogram
Studio in public/monogram-studio/fonts): Cardo, Pinyon Script, Poppins. A guest's
phone should not pull a 400 KB .ttf for a heading, so this cuts the same latin
range Google serves (plus the peso sign) into .woff2 under app/_fonts, which
app/_fonts/choice-faces.ts loads with preload:false.

NO NETWORK. Every source is a file already in the repo. (Faces fetched from
Google go through scripts/fetch-brand-fonts.mjs instead.)

⛔ ONLY FACES WITHOUT A RESERVED FONT NAME. OFL §3: a Modified Version — and a
subset is one — may not keep a Reserved Font Name. Cinzel Decorative, Gilda
Display, Marcellus, Playfair Display SC, Herr Von Muellerhoff and Mr De Haviland
all reserve their names, so choice-faces.ts serves their committed .ttf
UNMODIFIED instead. The script refuses any source whose copyright or licence
string mentions a reserved name.

Needs fontTools + brotli (`pip install fonttools brotli`). Run from apps/web:
    python3 scripts/subset-shipped-fonts.py
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(WEB, 'app', '_fonts')
LATIN = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,'
         'U+0329,U+2000-206F,U+20AC,U+20B1,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')

JOBS = [
    ('lib/social/fonts/Cardo-Regular.ttf', 'cardo', 'cardo-400.woff2'),
    ('public/monogram-studio/fonts/Cardo-Italic.ttf', 'cardo', 'cardo-400-italic.woff2'),
    ('lib/social/fonts/Cardo-Bold.ttf', 'cardo', 'cardo-700.woff2'),
    ('public/monogram-studio/fonts/PinyonScript-Regular.ttf', 'pinyon-script', 'pinyon-script-400.woff2'),
    ('lib/social/fonts/Poppins-Regular.ttf', 'poppins', 'poppins-400.woff2'),
    ('lib/social/fonts/Poppins-Medium.ttf', 'poppins', 'poppins-500.woff2'),
    ('lib/social/fonts/Poppins-Bold.ttf', 'poppins', 'poppins-700.woff2'),
]

# The OFL body, from a licence file already committed (after its copyright line).
_body = open(os.path.join(OUT, 'prata', 'OFL.txt'), encoding='utf8').read()
OFL_BODY = _body[_body.index('This Font Software is licensed'):]


def main() -> int:
    copyrights: dict[str, list[str]] = {}
    for src, family_dir, name in JOBS:
        src_path = os.path.join(WEB, src)
        font = TTFont(src_path)
        notice = (font['name'].getDebugName(0) or '') + (font['name'].getDebugName(13) or '')
        if 'Reserved' in notice:
            print(f'refusing {src}: it has a Reserved Font Name (OFL §3) — serve the .ttf unmodified', file=sys.stderr)
            return 1
        if 'fvar' in font:
            print(f'refusing {src}: a variable font needs an instance first', file=sys.stderr)
            return 1
        copyright_line = font['name'].getDebugName(0) or ''
        copyrights.setdefault(family_dir, [])
        if copyright_line and copyright_line not in copyrights[family_dir]:
            copyrights[family_dir].append(copyright_line)
        os.makedirs(os.path.join(OUT, family_dir), exist_ok=True)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']  # keep ligatures, kerning, swashes
        opts.name_IDs = ['*']  # keep the copyright AND licence records
        opts.name_languages = ['*']
        opts.notdef_outline = True
        subsetter = subset.Subsetter(options=opts)
        subsetter.populate(unicodes=subset.parse_unicodes(LATIN))
        subsetter.subset(font)
        out_path = os.path.join(OUT, family_dir, name)
        subset.save_font(font, out_path, opts)
        print(f'{os.path.getsize(src_path):>8} -> {os.path.getsize(out_path):>7}  app/_fonts/{family_dir}/{name}')
    for family_dir, lines in copyrights.items():
        with open(os.path.join(OUT, family_dir, 'OFL.txt'), 'w', encoding='utf8') as fh:
            fh.write('\n'.join(lines) + '\n\n' + OFL_BODY)
    return 0


if __name__ == '__main__':
    sys.exit(main())
