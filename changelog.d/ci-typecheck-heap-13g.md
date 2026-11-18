## 2026-11-19 · fix(ci): typecheck's heap ceiling 10240 → 13312 MB

Between 17:59 and 19:56 UTC on 18 Nov the CI `typecheck` job died with "JavaScript heap out of memory" (exit 134) on
#8001, #7976, #7988, #8000 and #7993, while #7986, #7981 and #7997 passed the same hour — the joined tree sits at
the 10 GB edge, so it fails at random. GitHub's ubuntu-latest runner has 16 GB; 13 GB leaves headroom for the OS.
Not a type error: the logs show no `error TS`.

SPEC IMPACT: None.
