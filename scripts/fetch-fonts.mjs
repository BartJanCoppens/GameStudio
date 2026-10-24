// Downloads the latin woff2 files of the design-system fonts into public/fonts/, so games in the sealed-off
// frame get fonts from the app itself (as data: URLs) and never contact Google. Run once; commit the files.
//   node scripts/fetch-fonts.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const FONTS = [
  ['ibm-plex-sans', 'IBM Plex Sans'], ['inter', 'Inter'], ['source-sans-3', 'Source Sans 3'], ['lato', 'Lato'],
  ['nunito-sans', 'Nunito Sans'], ['work-sans', 'Work Sans'], ['dm-sans', 'DM Sans'], ['libre-franklin', 'Libre Franklin'],
  ['space-grotesk', 'Space Grotesk'], ['merriweather', 'Merriweather'], ['source-serif-4', 'Source Serif 4'], ['roboto-slab', 'Roboto Slab'],
];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

mkdirSync('public/fonts', { recursive: true });
for (const [id, family] of FONTS) {
  for (const weight of [400, 600]) {
    // Some families have no 600; the nearest bolder weight stands in.
    let css = '';
    for (const w of weight === 600 ? [600, 700] : [400]) {
      const r = await fetch(`https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@${w}&display=swap`, { headers: { 'User-Agent': UA } });
      if (r.ok) { css = await r.text(); break; }
    }
    const latin = css.split('/* latin */')[1] ?? css;
    const url = latin.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) { console.error(`No woff2 for ${family} ${weight}`); process.exitCode = 1; continue; }
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    writeFileSync(`public/fonts/${id}-${weight}.woff2`, bytes);
    console.log(`${id}-${weight}.woff2 ${Math.round(bytes.length / 1024)} KB`);
  }
}
