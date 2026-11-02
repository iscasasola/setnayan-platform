## 2026-08-05 · feat(admin): see — and clear — leftover vendor ID documents

Vendors upload a government ID, a permit, a BIR form and a bank proof to prove
who they are. When one is replaced by a newer upload, or an application is
abandoned halfway, the old file stays in storage and **nothing anywhere in the
app could see it, let alone remove it**. The existing media screen only reaches
the website's own pictures — logos, backgrounds, onboarding art.

There is now a screen for them, at **Admin → ID documents**, sitting next to the
verification queue rather than with the website pictures. A passport photo is not
a logo, and mixing the two would mean one careless click on the wrong page.

Every file is checked against every vendor record and lands in one of three
groups: **In use** (a vendor record still points at it — no delete button),
**Left over** (nothing does), or **Not sure** (an unfamiliar file name — listed
so you can see it, never deletable, because if we cannot say whose it is we do
not remove it).

Deleting is one file at a time, after a confirmation that names the file and
says plainly that it is someone's identity document and cannot be recovered.

**If the check for what's in use cannot run, the delete buttons do not appear at
all** and the page says so. A failed lookup returns "nothing is in use", which
looks exactly like "everything is safe to delete" — and acting on that would
erase a live ID.

⚠ Checked against the live database while building this: **no verification
document is currently referenced by anything at all.** Whatever is in that
storage area is leftover by definition.

SPEC IMPACT: None.
