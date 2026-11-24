# Re-walk fixes on live 307925d: Now and Proposed

**Fault 3: "No guest count yet" in the quote maker, at 375 px** (`/vendor-dashboard/clients/<id>?tab=quote`)
- `3-no-guest-count-375-now.png`: live. "On their list" is set at figure size (18 px serif) and wraps onto 2 lines (56 px tall). "Billed" wraps onto 2 lines (40 px).
- `3-no-guest-count-375-proposed.png`: this PR's classes applied to the live DOM in my own tab (a preview, not a build). Both rows are 14 px on 1 line (20 px tall), with 0 px overflow in the row and the page.

**Fault 5: the door's open-shop links** (measured with curl, signed out, 3 runs)
- `supplier.setnayan.com/open-shop` (the relative link on the door, followed through its 308): 0.87–1.14 s.
- `www.setnayan.com/open-shop` (the absolute link this PR draws): 0.57–0.81 s.
- The hop costs 0.12–0.44 s per tap.
- There is no shot because the change is the link's address, not how it looks.
