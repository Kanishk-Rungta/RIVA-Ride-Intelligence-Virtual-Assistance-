// Renders docs/report/report.html to PDF with page-numbered footers, using
// headless Chrome over the DevTools protocol (no extra npm dependency).
// Table-of-contents page numbers are filled into the HTML beforehand
// (see the report's data-toc spans); this script only prints.
//   node scripts/render-report.mjs [chromePath]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const chrome = process.argv[2] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const htmlPath = resolve('docs/report/report.html');
const outPath = resolve('docs/report/RIVA_Case_Study_Report.pdf');
const port = 9333;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'riva-'))}`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });

let target;
for (let i = 0; i < 50 && !target; i++) {
  await new Promise((r) => setTimeout(r, 200));
  target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => undefined);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); waiting.get(m.id)?.(m); });
const cdp = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id, method, params })); });

async function render(url) {
  await cdp('Page.enable');
  await cdp('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 2500));
  const { data } = await cdp('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;text-align:center;font-family:Cambria,serif;font-size:10px;color:#333"><span class="pageNumber"></span></div>',
  });
  return Buffer.from(data, 'base64');
}

writeFileSync(outPath, await render(pathToFileURL(htmlPath).href));
console.log(`Wrote ${outPath}`);
ws.close();
proc.kill();
process.exit(0);
