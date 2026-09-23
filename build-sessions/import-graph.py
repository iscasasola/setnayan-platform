#!/usr/bin/env python3
"""
import-graph.py — resolve apps/web's import graph on a git ref, and answer:
"which candidate CHANGES a module another candidate READS?"

WHY THIS EXISTS. `git merge-tree` answers "will these two conflict?". It cannot answer "will these
two both be correct afterwards?". The dangerous case is a CLEAN merge that still breaks something:
candidate A edits a shared module, candidate B never opens that file but imports it, in another
route, owned by another session. Nothing on either pull request says so.

The worked example: apps/web/lib/chat-box-tools.ts (the COUPLE's chat panels) imports
VENDOR_THREAD_TOOLS from apps/web/lib/vendor-thread-tools.ts (the SUPPLIER's registry) and derives
COUPLE_THREAD_PANELS from it. Editing the supplier registry silently changes the couple's chat box.

⚠ AN ALIAS-ONLY GREP IS NOT ENOUGH, and that is not a hypothetical — the first version of this check
grepped for "@/lib/vendor-thread-tools" and MISSED this exact edge, because chat-box-tools.ts spells
it './vendor-thread-tools'. Measured on origin/main: that module is imported 4× by alias and 5×
relatively, and apps/web/lib alone holds 2,433 relative imports. So specifiers are RESOLVED here,
not pattern-matched.

STDIN: one candidate per stanza —   KEY<TAB>label\n  then one path per line, blank line ends it.
ARGV:  --ref origin/main
STDOUT: markdown rows for the coupling table, or nothing.
"""
import subprocess, sys, os, re, collections

ref = "origin/main"
if "--ref" in sys.argv:
    ref = sys.argv[sys.argv.index("--ref") + 1]

ROOT = "apps/web/"
SPEC = re.compile(r"""(?:from|import)\s*\(?\s*['"]([^'"]+)['"]""")


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout


# ---- every source file on the ref -------------------------------------------------------------
files = [f for f in sh("git", "ls-tree", "-r", "--name-only", ref, ROOT).splitlines()
         if f.endswith((".ts", ".tsx")) and not f.endswith(".d.ts")]
fileset = set(files)


def resolve(importer, spec):
    """A specifier as written -> the repo path it means, or None."""
    if spec.startswith("@/"):
        base = ROOT + spec[2:]
    elif spec.startswith("."):
        base = os.path.normpath(os.path.join(os.path.dirname(importer), spec))
    else:
        return None  # a package, not ours
    for cand in (base, base + ".ts", base + ".tsx",
                 base + "/index.ts", base + "/index.tsx"):
        if cand in fileset:
            return cand
    return None


# ---- one pass over the tree: importers[module] = {files that import it} -----------------------
# `git grep` on a ref prints "<ref>:<path>:<line>"; strip the ref prefix.
importers = collections.defaultdict(set)
# ⚠ `[[:space:]]`, NOT `\s`. `git grep -E` is POSIX ERE: it does not know `\s` (nor `\b`), and it
# does not complain — it matches NOTHING and exits quietly. That silent zero is exactly how the
# first version of this file "found no coupling" on a tree with 29,832 import lines.
GREP_RE = r"""(from|import\()[[:space:]]*['"][^'"]+['"]"""
raw = sh("git", "grep", "--no-color", "-n", "-E", GREP_RE, ref, "--", ROOT)
if not raw.strip():
    print("import-graph: the import scan matched NOTHING — refusing to report 'no coupling' "
          "from a broken scan.", file=sys.stderr)
    sys.exit(2)
pref = ref + ":"
for line in raw.splitlines():
    if not line.startswith(pref):
        continue
    rest = line[len(pref):]
    path, _, text = rest.partition(":")
    path2, _, text = text.partition(":")  # strip line number
    if not path.endswith((".ts", ".tsx")):
        continue
    for spec in SPEC.findall(text):
        tgt = resolve(path, spec)
        if tgt and tgt != path:
            importers[tgt].add(path)

# ---- candidates from stdin --------------------------------------------------------------------
cands, key, label, paths = [], None, None, []
for line in sys.stdin.read().splitlines():
    if key is None:
        if not line.strip():
            continue
        key, _, label = line.partition("\t")
        paths = []
    elif line.strip() == "":
        cands.append((key, label, paths)); key = None
    else:
        paths.append(line.strip())
if key is not None:
    cands.append((key, label, paths))


def interesting(p):
    return (p.startswith(ROOT) and p.endswith((".ts", ".tsx"))
            and not p.endswith((".test.ts", ".test.tsx", ".d.ts")))


rows = []
for ai, (akey, _, apaths) in enumerate(cands):
    for f in apaths:
        if not interesting(f):
            continue
        readers = importers.get(f, set())
        if not readers:
            continue
        for bi, (bkey, _, bpaths) in enumerate(cands):
            if ai == bi:
                continue
            via = sorted(readers & set(bpaths))
            if via:
                rows.append((akey, f, via, bkey))

if rows:
    print("| A changes | B reads it through | B |")
    print("|---|---|---|")
    seen = set()
    for akey, f, via, bkey in rows:
        sig = (akey, f, bkey)
        if sig in seen:
            continue
        seen.add(sig)
        vs = " ".join("`%s`" % v for v in via)
        print("| %s → `%s` | %s | %s |" % (akey, f, vs, bkey))
else:
    print("No candidate changes a module another candidate imports.")

# A self-test the caller can run: --selftest asserts the known real edge resolves.
if "--selftest" in sys.argv:
    a = ROOT + "lib/vendor-thread-tools.ts"
    b = ROOT + "lib/chat-box-tools.ts"
    ok = b in importers.get(a, set())
    print("\nSELFTEST known edge %s <- %s : %s" % (a, b, "FOUND" if ok else "*** MISSING ***"),
          file=sys.stderr)
    sys.exit(0 if ok else 3)
