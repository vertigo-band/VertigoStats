const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const svg = fs.readFileSync("public/icon.svg", "utf8");
  const b = await chromium.launch();
  for (const size of [192, 512]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: `public/icon-${size}.png` });
  }
  await b.close();
})();
