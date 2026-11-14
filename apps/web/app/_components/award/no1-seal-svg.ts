/**
 * 🥇 THE No. 1 SEAL — "No. 1 Supplier of the Year", an order-of-merit star (owner-approved prototype
 * `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v39.html`, `no1Svg` + `SEALS.no1`): gold and
 * platinum rays tipped with diamonds, a laurel, a pearl rim, a bezel set with 24 diamonds, an onyx face with the raised
 * 1, a crown, and a black ribbon "OF THE YEAR · {year}". `anim` adds the live light (gem twinkles, a glint sweep).
 *
 * ⚠ AN OPTION ONLY. What earns it is an OPEN owner question (build map "NOT in this build": partner seal + Top 10
 * medal qualification rules · No. 1 art) — nothing in the public page or the dashboard may offer it until he rules.
 *
 * PURE: a string of SVG. Lettering is set in Cinzel (`--font-cinzel`, declared by the root layout).
 */

// prettier-ignore
export function no1SealSvg({ anim = true, size = 300, year, uid = 'n1_' }: { anim?: boolean; size?: number; year: string | number; uid?: string }): string {

  const u=uid,P=Math.PI/180,f=(n:number)=>n.toFixed(2),cx=150,cy=150;
  const st=(a:string[])=>a.map((c,i)=>`<stop offset="${(i/(a.length-1)).toFixed(3)}" stop-color="${c}"/>`).join('');
  let d=`<linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1">${st(['#fff7d6','#f3d27a','#c8952f','#fff1c0','#a8781f','#f7dc8e','#7a5410'])}</linearGradient>
<linearGradient id="${u}g2" x1="0" y1="1" x2="1" y2="0">${st(['#6b4706','#d9a93f','#fff4cc','#c8952f','#5c3d08'])}</linearGradient>
<radialGradient id="${u}on" cx=".38" cy=".3" r=".9">${st(['#3a3f4a','#14161c','#050608'])}</radialGradient>
<radialGradient id="${u}aur" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".55"/><stop offset=".55" stop-color="#ffcf66" stop-opacity=".18"/><stop offset="1" stop-color="#ffcf66" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}dia" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#e8f6ff"/><stop offset=".7" stop-color="#9fc4e0"/><stop offset="1" stop-color="#5c7c98"/></radialGradient>
<radialGradient id="${u}rb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#e8f6ff"/><stop offset=".7" stop-color="#9fc4e0"/><stop offset="1" stop-color="#5c7c98"/></radialGradient>
<linearGradient id="${u}pt" x1="0" y1="0" x2="1" y2="1">${st(['#ffffff','#cfd6de','#8a96a3','#f4f7fa','#6c7784','#e3e8ee'])}</linearGradient>
<radialGradient id="${u}sa" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#e8f6ff"/><stop offset=".7" stop-color="#9fc4e0"/><stop offset="1" stop-color="#5c7c98"/></radialGradient>
<radialGradient id="${u}em" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#e8f6ff"/><stop offset=".7" stop-color="#9fc4e0"/><stop offset="1" stop-color="#5c7c98"/></radialGradient>
<radialGradient id="${u}pe" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f1ece2"/><stop offset="1" stop-color="#b9ae9a"/></radialGradient>
<radialGradient id="${u}vel" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#3a3f4a"/><stop offset=".7" stop-color="#121418"/><stop offset="1" stop-color="#030304"/></radialGradient>
<radialGradient id="${u}fl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff6d0" stop-opacity=".8"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></radialGradient>
<linearGradient id="${u}rib" x1="0" y1="0" x2="0" y2="1">${st(['#2a2a30','#0b0b0e','#1e1e24'])}</linearGradient>
<linearGradient id="${u}gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="${u}sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
<filter id="${u}bl"><feGaussianBlur stdDeviation="1.2"/></filter>
<clipPath id="${u}fc"><circle cx="${cx}" cy="${cy}" r="44"/></clipPath>`;
  let s=`<circle cx="${cx}" cy="${cy}" r="148" fill="url(#${u}aur)"/>`;
  // ribbon tails behind: black grosgrain with gold edges, swallow-tail ends
  const tail=(sx:number)=>`<path d="M${150+sx*18},196 L${150+sx*52},284 L${150+sx*40},272 L${150+sx*30},290 L${150+sx*2},206Z" fill="url(#${u}rib)" stroke="#d9a93f" stroke-width="1.6"/><path d="M${150+sx*14},204 L${150+sx*42},276" stroke="#d9a93f" stroke-width="1.2" opacity=".8"/>`;
  s+=`<g filter="url(#${u}sh)">${tail(-1)}${tail(1)}</g>`;
  // the star: 8 long faceted rays + 8 short ones between, each split into a lit and a shaded facet
  const ray=(a:number,R:number,w:number)=>{const t:[number,number]=[cx+R*Math.cos(a*P),cy+R*Math.sin(a*P)];const l:[number,number]=[cx+w*Math.cos((a-90)*P),cy+w*Math.sin((a-90)*P)];const r:[number,number]=[cx+w*Math.cos((a+90)*P),cy+w*Math.sin((a+90)*P)];
    return `<path d="M${f(cx)},${f(cy)} L${f(l[0])},${f(l[1])} L${f(t[0])},${f(t[1])}Z" fill="url(#${u}g)"/><path d="M${f(cx)},${f(cy)} L${f(r[0])},${f(r[1])} L${f(t[0])},${f(t[1])}Z" fill="url(#${u}g2)"/>`};
  let fine='';for(let i=0;i<48;i++){const a=(-90+i*7.5)*P;fine+=`<path d="M${cx},${cy} L${f(cx+142*Math.cos(a))},${f(cy+142*Math.sin(a))}"/>`}
  s+=`<g stroke="#ffe6a0" stroke-width=".7" opacity=".35" filter="url(#${u}bl)">${fine}</g>`;
  const rayF=(a:number,R:number,w:number,g1:string,g2:string)=>ray(a,R,w).replace(`url(#${u}g)`,g1).replace(`url(#${u}g2)`,g2);
  let pl='';for(let i=0;i<8;i++)pl+=rayF(-90+22.5+i*45,118,12,`url(#${u}pt)`,'#7d8894');
  let gd='';for(let i=0;i<8;i++)gd+=ray(-90+i*45,140,16);
  s+=`<g filter="url(#${u}sh)"><g stroke="#3d4650" stroke-width=".5" stroke-linejoin="round">${pl}</g><g stroke="#4a3206" stroke-width=".5" stroke-linejoin="round">${gd}</g></g>`;
  // ray tips: big diamonds on gold rays, diamonds on every ray (owner 15 Nov: all diamonds)
  for(let i=0;i<8;i++){const a=(-90+i*45)*P,x=cx+128*Math.cos(a),y=cy+128*Math.sin(a);if(i===0)continue;s+=`<circle cx="${f(x)}" cy="${f(y)}" r="4.6" fill="#5c3d08"/><circle cx="${f(x)}" cy="${f(y)}" r="3.9" fill="url(#${u}dia)"/><circle cx="${f(x-1.3)}" cy="${f(y-1.4)}" r="1.2" fill="#fff"/>`}
  for(let i=0;i<8;i++){const a=(-67.5+i*45)*P,x=cx+104*Math.cos(a),y=cy+104*Math.sin(a);s+=`<circle cx="${f(x)}" cy="${f(y)}" r="3.6" fill="#3d4650"/><circle cx="${f(x)}" cy="${f(y)}" r="3" fill="url(#${u}${i%2?'sa':'rb'})"/><circle cx="${f(x-1)}" cy="${f(y-1.1)}" r=".9" fill="#fff"/>`}
  // laurel wreath of gold leaves around the bezel, open at the top for the crown
  const leaf=(a:number,side:number)=>{const r=78,x=cx+r*Math.cos(a*P),y=cy+r*Math.sin(a*P),rot=a+(side>0?60:120);return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="8.5" ry="3.4" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" fill="url(#${u}g)" stroke="#5c3d08" stroke-width=".5"/>`};
  let lau='';for(let k=0;k<9;k++){lau+=leaf(100+k*17,1)+leaf(80-k*17,-1)}
  s+=`<g filter="url(#${u}sh)">${lau}</g>`;
  // pearl rim
  s+=`<circle cx="${cx}" cy="${cy}" r="70" fill="#3a2705"/>`;for(let i=0;i<40;i++){const a=i*9*P;s+=`<circle cx="${f(cx+69.2*Math.cos(a))}" cy="${f(cy+69.2*Math.sin(a))}" r="2.6" fill="url(#${u}pe)" stroke="#8a7a5c" stroke-width=".3"/>`}
  // bezel: polished gold ring set with 24 diamonds
  s+=`<circle cx="${cx}" cy="${cy}" r="66.4" fill="#3a2705"/><circle cx="${cx}" cy="${cy}" r="64.5" fill="url(#${u}g)"/><circle cx="${cx}" cy="${cy}" r="56" fill="url(#${u}g2)"/>`;
  let gems='';for(let i=0;i<24;i++){const a=(i*15-90)*P,x=cx+60.2*Math.cos(a),y=cy+60.2*Math.sin(a);
    gems+=`<circle cx="${f(x)}" cy="${f(y)}" r="3.7" fill="#5c3d08"/><circle cx="${f(x)}" cy="${f(y)}" r="3.1" fill="url(#${u}dia)"/><path d="M${f(x-1.6)},${f(y)} L${f(x)},${f(y-1.6)} L${f(x+1.6)},${f(y)} L${f(x)},${f(y+1.6)}Z" fill="#fff" opacity=".55"/>`+
      (anim?`<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${(i/24*.8).toFixed(3)};${(i/24*.8+.03).toFixed(3)};${(i/24*.8+.07).toFixed(3)};1" dur="4.2s" repeatCount="indefinite"/></circle>`:'');}
  s+=gems;
  // onyx face with a gold sunburst engraved, the raised 1, and words
  s+=`<circle cx="${cx}" cy="${cy}" r="47" fill="url(#${u}g)"/><circle cx="${cx}" cy="${cy}" r="44.5" fill="url(#${u}on)"/>
<g clip-path="url(#${u}fc)"><g stroke="#d9a93f" stroke-width=".35" opacity=".28">${Array.from({length:48},(_,i)=>{const a=i*7.5*P;return `<path d="M${cx},${cy} L${f(cx+60*Math.cos(a))},${f(cy+60*Math.sin(a))}"/>`}).join('')}</g>
<ellipse cx="${cx-8}" cy="${cy-26}" rx="40" ry="18" fill="#fff" opacity=".1"/></g>`;
  const T=(t:string,y:number,fs:number,ls:number,extra='')=>`<text x="${cx}" y="${y}" text-anchor="middle" style="font-family:var(--font-cinzel),'Cinzel',Georgia,serif;font-weight:700;font-size:${fs}px;letter-spacing:${ls}px" ${extra}>${t}</text>`;
  s+=`<path id="${u}arc" d="M${cx-34},${cy} A34,34 0 0 1 ${cx+34},${cy}" fill="none"/>
<text style="font-family:var(--font-cinzel),'Cinzel',Georgia,serif;font-weight:700;font-size:7px;letter-spacing:2.2px" fill="#f3d27a"><textPath href="#${u}arc" startOffset="50%" text-anchor="middle">SETNAYAN</textPath></text>`;
  s+=T('1',cy+19,54,0,`fill="#000" opacity=".6" transform="translate(1.4 2.4)"`)+T('1',cy+19,54,0,`fill="url(#${u}g)" stroke="#5c3d08" stroke-width=".9"`)+T('1',cy+19,54,0,`fill="none" stroke="#fffbe6" stroke-width=".5" opacity=".7" transform="translate(-.5 -.7)"`);
  s+=T('NO.',cy-12,8,1.5,`fill="#f3d27a" x="${cx-22}"`).replace(`x="${cx}" y`,'y')+T('SUPPLIER',cy+33,6.4,2,`fill="#f3d27a"`);
  // crown on top: gold band, five points with rubies, a big diamond at the centre
  const pearls=(pts:Array<[number,number]>)=>pts.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.1" fill="url(#${u}pe)" stroke="#8a7a5c" stroke-width=".3"/>`).join('');
  const cr=`<g transform="translate(150 66)" filter="url(#${u}sh)">
<path d="M-27,6 C-28,-14 -14,-30 0,-30 C14,-30 28,-14 27,6Z" fill="url(#${u}vel)"/>
<path d="M-27,6 C-30,-18 -16,-34 0,-34 C16,-34 30,-18 27,6" fill="none" stroke="url(#${u}g)" stroke-width="5" stroke-linecap="round"/>
<path d="M0,6 L0,-34" stroke="url(#${u}g)" stroke-width="5"/>
${pearls([[-26,-6],[-24,-16],[-18,-25],[-9,-31],[9,-31],[18,-25],[24,-16],[26,-6],[0,-26],[0,-17],[0,-8]])}
<circle cx="0" cy="-41" r="6.5" fill="url(#${u}g)" stroke="#4a3206" stroke-width=".8"/><path d="M-6.5,-41 H6.5" stroke="#4a3206" stroke-width=".7"/>
<path d="M0,-47 V-60 M-5,-55 H5" stroke="url(#${u}g)" stroke-width="3.2" stroke-linecap="round"/><path d="M0,-47 V-60 M-5,-55 H5" stroke="#4a3206" stroke-width=".5" fill="none" opacity=".6"/>
<rect x="-33" y="2" width="66" height="14" rx="3" fill="url(#${u}g2)" stroke="#4a3206" stroke-width="1"/>
<path d="M-33,4 H33" stroke="#fffbe6" stroke-width=".7" opacity=".7"/>
${([[-25,'rb'],[-12.5,'em'],[0,'dia'],[12.5,'sa'],[25,'rb']] as Array<[number,string]>).map(([x,g])=>`<ellipse cx="${x}" cy="9" rx="${g==='dia'?4.6:3.6}" ry="${g==='dia'?4.6:3.2}" fill="url(#${u}${g})" stroke="#4a3206" stroke-width=".6"/><circle cx="${x-1.1}" cy="7.8" r=".9" fill="#fff"/>`).join('')}
${pearls([[-31,-1],[-18.75,-1],[-6.25,-1],[6.25,-1],[18.75,-1],[31,-1]])}</g>`;
  s+=cr;
  // ribbon banner across the bottom
  s+=`<g filter="url(#${u}sh)"><path d="M78,206 Q150,224 222,206 L226,226 Q150,244 74,226Z" fill="url(#${u}rib)" stroke="#d9a93f" stroke-width="1.6"/>
<path d="M80,210 Q150,228 220,210" fill="none" stroke="#d9a93f" stroke-width=".6" opacity=".7"/><path d="M76,222 Q150,240 224,222" fill="none" stroke="#d9a93f" stroke-width=".6" opacity=".7"/></g>
<path id="${u}rarc" d="M80,219 Q150,237 220,219" fill="none"/><text style="font-family:var(--font-cinzel),'Cinzel',Georgia,serif;font-weight:700;font-size:7.6px;letter-spacing:1.6px" fill="#f3d27a"><textPath href="#${u}rarc" startOffset="50%" text-anchor="middle">OF THE YEAR · ${year}</textPath></text>`;
  const fl=(x:number,y:number,r:number)=>`<g transform="translate(${x} ${y})"><circle r="${r*.9}" fill="url(#${u}fl)"/><path d="M0,-${r} L${r*.12},0 L0,${r} L-${r*.12},0Z M-${r},0 L0,${r*.12} L${r},0 L0,-${r*.12}Z" fill="#fff"/></g>`;
  s+=fl(150,10,13)+fl(236,64,9)+fl(62,236,8)+fl(118,62,6)+fl(194,190,7);
  // live: a glint sweeps the star and the crown
  if(anim)s+=`<g style="mix-blend-mode:overlay" opacity=".9"><rect x="-60" y="0" width="40" height="300" fill="url(#${u}gl)" transform="skewX(-20)"><animate attributeName="x" values="-80;-80;380;380" keyTimes="0;.45;.75;1" dur="5s" repeatCount="indefinite"/></rect></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${size}" height="${size}"><defs>${d}</defs>${s}</svg>`;
}

/**
 * The seal as the prototype mounts it. `'card'` (`SEALS.no1`): drawn at 200, viewBox trimmed to the art. `'arch'`
 * (v41 `openSealPlaque`): 372×414 with viewBox "17 0 266 296", so on the plaque (`<SealPlaque mountKind="no1">`) it
 * fills the velvet arch and its ray tips touch the gold rim.
 */
export function no1Seal(year: string | number, fit: 'card' | 'arch' = 'card', uid?: string): string {
  const svg = no1SealSvg({ anim: true, size: 200, year, uid });
  return fit === 'arch'
    ? svg.replace('viewBox="0 0 300 300"', 'viewBox="17 0 266 296"').replace('width="200"', 'width="372"').replace('height="200"', 'height="414"')
    : svg.replace('viewBox="0 0 300 300"', 'viewBox="14 0 272 296"');
}
