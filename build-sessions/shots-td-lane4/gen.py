# Layout harness for lane 4: the REAL wrapper class lists from page.tsx (Now = origin/main, Proposed = this branch),
# with labelled placeholder tiles standing in for each component (no database in a cloud session).
def tile(name, h, note=''):
    return f'<div class="sn-tile" style="min-height:{h}px"><b class="text-[14px] text-ink">{name}</b><div class="mt-1 text-[12px] text-ink/60">{note}</div></div>'
WATCH_ROWS = ''.join(f'<div class="mt-2 text-[12.5px]">• Watch row {i} — Sai noticed something</div>' for i in (1,2,3))
def watch(version):
    if version=='now':
        return ('<details class="lg:hidden"><summary class="sn-eye cursor-pointer list-none">Setnayan AI · The Watch · 3</summary>'+WATCH_ROWS+'</details>'
                '<div class="hidden lg:block"><p class="sn-eye">Setnayan AI · The Watch</p>'+WATCH_ROWS+'</div>')
    return '<details data-watch-fold><summary class="sn-eye cursor-pointer list-none">Setnayan AI · The Watch · 3</summary>'+WATCH_ROWS+'</details>'
def planning(version):
    span = '' if version=='now' else ' lg:col-span-2'
    inner = ('<div class="grid items-start gap-4 lg:grid-cols-2"><div class="sn-tile-dark rounded-2xl p-5" style="min-height:220px"><b>The Big Day focal</b>'
             + watch(version) + '</div><div class="flex flex-col gap-3.5">' + tile('Needs you this week',90) + tile('Guests · Budget · Schedule · Messages',120) + '</div></div>')
    return f'<details class="sn-tile{span}" open><summary class="cursor-pointer list-none text-[13.5px] font-semibold text-ink/70">Planning tools — still here if you need them</summary><div class="mt-4 space-y-6">{inner}</div></details>'
WRAP='contents tab:mx-auto tab:flex tab:w-full tab:max-w-5xl tab:flex-col tab:gap-4 lg:grid lg:grid-cols-2 lg:items-start'
COL='contents tab:flex tab:min-w-0 tab:flex-col tab:gap-4'
def body(state, version):
    if state=='on':
        now=[tile('Today asks',56,'access · date change · event day'),tile('Ready for no signal',120,'offline saving'),tile('DayOfModeGrid',300,'the schedule now · head table · Papic row · live wall'),tile("Who's here",90)]
        doors=[tile('Open the live desk',64,'Announcements, Memory lane and what is happening now.'),tile('Your services',180,'every service keeps its door')]
    else:
        now=[tile('Today asks',56),tile('FinishedEventSummary',360,'the summary leads')]
        doors=[tile("Who's here",90),tile('Your services',180)]
    if version=='now':
        return ''.join(now+doors)+planning(version)
    return f'<div data-home-day="{state}" class="{WRAP}"><div class="{COL}">{"".join(now)}</div><div class="{COL}">{"".join(doors)}</div>{planning(version)}</div>'
def page(state, version):
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="out.css">
<style>.rail{{display:none}} @media(min-width:701px){{.shell{{display:grid;grid-template-columns:72px 1fr}} .rail{{display:block}}}} @media(min-width:1280px){{.shell{{grid-template-columns:240px 1fr}}}}</style></head>
<body class="bg-cream text-ink"><div class="shell"><aside class="rail min-h-screen border-r border-ink/10 bg-ink/5 p-3 text-[11px] text-ink/60">rail</aside>
<main><div class="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8">{body(state,version)}</div></main></div>
<script>if(matchMedia('(min-width: 701px)').matches)document.querySelectorAll('[data-watch-fold]').forEach(d=>d.open=true)</script></body></html>'''
for st in ('on','after'):
    for v in ('now','proposed'):
        open(f'{st}-{v}.html','w').write(page(st,v))
