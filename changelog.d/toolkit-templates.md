### Toolkit templates: ready-made payment plans and availability, installed from the Toolkit (stacked on #8243 + #8231)

- The Toolkit's "Forms" chip reads **Templates**. Two template shelves hold real items: **Payment plans** (8) and **Availability** (6). Each tile starts with its coloured kind word.
- **Install** a payment plan: it joins the shop's saved plans (`vendor_pay_plans`) and opens filled in, in the plan editor on its Toolkit page. The editor has name, percent and due for each part, Add a payment, and a total that must add up to 100%. **Remove** has Undo, and cards keep their own payments.
- **Install** an availability template: the card maker's Availability row offers it under "From a template". Picking it sets the style, the order-ahead days and, for "One event a day", the count.
- The Toolkit front splits into **Included** ("Free with every shop.") and **With a plan** (the only priced items, plus the plan line). The masthead counts "N included · M with a plan" from the one Toolkit list.
- Scanner rows show the category's **ready-made mode** with Use it. A card's Pay plan row gains **More in the Toolkit**.
- Templates follow online cards: with no online service card, a template the shop never installed is hidden, and an installed one greys.
- Room layouts are not built. They are listed only once Spaces is live (#8248), and their catalogue rows need a migration.

SPEC IMPACT: None. Builds the approved drawing (specs 24dcf90c) with no new ruling.
