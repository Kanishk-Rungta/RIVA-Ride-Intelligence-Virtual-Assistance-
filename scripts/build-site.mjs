// Builds the widget gallery as static files that need no server:
//   site/index.html     a complete page, for any static host (GitHub Pages, Netlify, a file share)
//   site/embedded.html  the same page without html/head/body tags, for hosts that wrap it themselves
// Every widget and its example data are embedded in the page (about 3 MB).
//   npm run build && npm run site
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { galleryPage, GROUPS } from './gallery-page.mjs';

const OUT = 'src/widgets/out';
if (!existsSync(OUT)) throw new Error('Run `npm run build` first: src/widgets/out is missing.');

const manifest = JSON.parse(readFileSync('src/widgets/widget-manifest.json', 'utf8'));
const html = {};
const data = {};
const meta = {};
for (const w of manifest.widgets) {
  const id = w.uri.slice(1);
  html[id] = readFileSync(`${OUT}/${id}.html`, 'utf8');
  data[id] = w.examples.map((e) => e.data);
  meta[id] = { examples: w.examples.map((e) => e.name) };
}
for (const g of GROUPS) for (const [id] of g.items) if (!html[id]) throw new Error(`No widget named ${id}`);

mkdirSync('site', { recursive: true });
const embed = { html, data };
writeFileSync('site/index.html', galleryPage({ mode: 'static', meta, embed }));
writeFileSync('site/embedded.html', galleryPage({ mode: 'static', meta, embed, fragment: true }));
const kb = (f) => (readFileSync(f).length / 1024 / 1024).toFixed(2);
console.log(`site/index.html ${kb('site/index.html')} MB, site/embedded.html ${kb('site/embedded.html')} MB`);
