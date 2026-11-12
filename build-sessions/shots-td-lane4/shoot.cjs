const { chromium } = require('playwright');
const { PNG } = (()=>{try{return require('pngjs')}catch{return {}}})();
(async () => {
  const b = await chromium.launch();
  for (const st of ['on','after']) for (const w of [390,768,1280]) for (const v of ['now','proposed']) {
    const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
    await p.goto('file://' + __dirname + `/${st}-${v}.html`);
    await p.screenshot({ path: `${__dirname}/raw-${st}-${w}-${v}.png`, fullPage: true });
    await p.close();
  }
  await b.close();
})();
