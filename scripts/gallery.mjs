// Local walkthrough of every RIVA widget, rendered with the example data from
// widget-manifest.json: the same output the MCP tools return. Each widget runs
// in its own iframe with a stubbed window.openai host, so hover, drag, click and
// animations behave as they do inside a chat client.
//   npm run build     (once, to produce src/widgets/out)
//   npm run gallery   -> http://localhost:4321
// For a copy that needs no server, see scripts/build-site.mjs (npm run site).
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { galleryPage } from './gallery-page.mjs';

const PORT = Number(process.env.PORT ?? 4321);
const OUT = 'src/widgets/out';
const manifest = JSON.parse(readFileSync('src/widgets/widget-manifest.json', 'utf8'));
const widgets = manifest.widgets.map((w) => ({ id: w.uri.slice(1), examples: w.examples }));
const meta = Object.fromEntries(widgets.map((w) => [w.id, { examples: w.examples.map((e) => e.name) }]));
const page = galleryPage({ mode: 'server', meta });

function widgetPage(id, exampleIndex) {
  const file = join(OUT, `${id}.html`);
  if (!existsSync(file)) return null;
  const w = widgets.find((x) => x.id === id);
  const data = exampleIndex < 0 ? null : (w?.examples[exampleIndex] ?? w?.examples[0])?.data ?? null;
  const host = `<script>window.openai={toolOutput:${JSON.stringify(data).replace(/</g, '\\u003c')},toolInput:{},theme:"dark",displayMode:"inline",maxHeight:4000,widgetState:null,setWidgetState:async(s)=>{window.openai.widgetState=s},callTool:async()=>({}),requestDisplayMode:async()=>{},sendFollowUpMessage:async()=>{},openExternal:()=>{}};</script>`;
  const html = readFileSync(file, 'utf8');
  return html.includes('<head>') ? html.replace('<head>', `<head>${host}`) : host + html;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  const match = url.pathname.match(/^\/widget\/([a-z-]+)$/);
  if (match) {
    const html = widgetPage(match[1], Number(url.searchParams.get('example') ?? 0));
    if (html) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found. Run `npm run build` first if src/widgets/out is missing.');
}).listen(PORT, () => console.log(`RIVA widget gallery on http://localhost:${PORT}`));
