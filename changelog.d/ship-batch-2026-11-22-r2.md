## 2026-11-22 · ship(batch-r2): #8094 booked coordinator · #8083 analytics carousel · #8095 admin price formula · #8157 supplier sign-up (app door) · #8151 Your booking

Batch R rebuilt without #8019 (held by the controller, 22 Nov: it still adds the retired Ultra Add-on and Pro prices the
owner's final ladder retires). Merged with merge commits off `origin/main`. Generated files regenerated once.

Migrations, each pinned by the controller's GO to its blob:
- #8094: `20271356585725` (947dcc9d30) · `20271357113669` (e9e9729017) · `20271357741892` (139c833ba6) · `20271358554489` (f7a4f5a1b8) · `20271359080029` (b10ba1b0ab — ship controller: the record guard lets a shop's edit to its own moment in at once, nothing wider)
- #8095: `20271356452488` (4a50c9e3c9)

Exposure surface: unchanged.

SPEC IMPACT: None beyond the rulings already in the corpus (DECISION_LOG 21–22 Nov; edeb9284).
