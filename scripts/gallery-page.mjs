// The RIVA widget gallery page, shared by the local server (scripts/gallery.mjs)
// and the static build (scripts/build-site.mjs). The two differ only in how a
// widget gets into the iframe: the server streams it from /widget/<id>, the
// static build embeds every widget and its example data in the page itself.

/** The navigation: four big categories, each with its views and a hint about what can be tried. */
export const GROUPS = [
  { id: 'rider', icon: '🚖', title: 'Find a ride', blurb: 'Compare quotes, prices and drivers', tone: '#2fd4c4', items: [
    ['ride-comparison', 'Compare rides', 'Drag the budget slider, switch the ranking, and hover a bubble to find it in the list.'],
    ['recommendation', 'Best pick', 'Hover the legend to isolate one ride on the radar; tap to hide rides you do not care about.'],
    ['nearby-drivers-map', 'Drivers nearby', 'Filter by provider, hover a dot, and watch the radar sweep. The second example shows ride requests.'],
    ['fare-forecast', 'Ride later', 'Drag the hour slider or hover the curve to find the cheapest time to travel.'],
    ['return-fare-forecast', 'Ride home', 'Scrub the curve to see how the evening rush changes your fare.'],
  ] },
  { id: 'journey', icon: '🧭', title: 'Plan a journey', blurb: 'Deadlines, stops, pooling, safety', tone: '#9d8cff', items: [
    ['travel-plan', 'Catch a flight', 'Drag the buffer slider and the leave time shifts with it.'],
    ['ride-map', 'Multi-stop', 'Toggle between your order and the optimised one; hover a stop to highlight it.'],
    ['pooling-analysis', 'Share a ride', 'Tap a co-rider, and tighten the detour slider to see who still qualifies.'],
    ['booking-status', 'Track a trip', 'Press Advance trip to move the car along its route.'],
    ['safety-alert', 'SOS (simulated)', 'Watch the alert reach each contact in turn.'],
  ] },
  { id: 'driver', icon: '🛺', title: 'Drive smarter', blurb: 'Offers, demand, earnings, shifts', tone: '#ffb547', items: [
    ['driver-trip-analysis', 'Accept or skip', 'Drag the fare slider to see the break-even point; hover the donut slices.'],
    ['demand-map', 'Demand', 'Scrub the 24-hour curve. The second example is a map of the best zones to move to.'],
    ['driver-summary', 'Earnings', 'Change the hours worked and the gauge updates.'],
    ['shift-plan', 'Plan my shift', 'Hover a zone card or an hour bar to inspect that hour of the plan.'],
  ] },
  { id: 'ai', icon: '🧠', title: 'Inside the AI', blurb: 'How the agents think', tone: '#ff6b84', items: [
    ['agent-trace', 'Agent negotiation', 'Press Play to watch rider, providers and drivers negotiate; hover any arrow to read it.'],
    ['search-comparison', 'Search strategies', 'Pick a strategy and watch it explore the road graph junction by junction.'],
  ] },
];

const CSS = `
  :root { --ink:#eef0ff; --muted:#a5aad6; --bg:#0a0c1f; --card:rgba(30,33,72,.55); --line:rgba(255,255,255,.1); --accent:#2fd4c4; }
  * { box-sizing:border-box; scrollbar-width:thin; scrollbar-color:rgba(157,140,255,.55) transparent }
  body { margin:0; font-family:Manrope,system-ui,sans-serif; color:var(--ink); background:var(--bg); min-height:100vh; overflow-x:hidden; }
  body::before { content:''; position:fixed; inset:-20%; z-index:-1; pointer-events:none; filter:blur(40px); transition:background .8s ease;
    background: radial-gradient(40% 35% at 15% 20%, color-mix(in srgb, var(--accent) 24%, transparent), transparent 70%), radial-gradient(35% 30% at 85% 15%, rgba(157,140,255,.22), transparent 70%), radial-gradient(40% 35% at 70% 90%, rgba(255,181,71,.12), transparent 70%); }
  .app { display:grid; grid-template-columns: 330px minmax(0,1fr); min-height:100vh; }
  aside { position:sticky; top:0; height:100vh; overflow:auto; padding:28px 20px; display:flex; flex-direction:column; gap:14px; }
  .brand { display:flex; align-items:center; gap:12px; margin-bottom:6px; }
  .logo { width:46px; height:46px; border-radius:15px; background:conic-gradient(from 200deg, #2fd4c4, #9d8cff, #ffb547, #2fd4c4); box-shadow:0 12px 26px -10px #9d8cff; display:grid; place-items:center; color:#0d0f24; font:700 20px Sora; }
  .brand h1 { font:700 24px Sora,system-ui; margin:0; letter-spacing:-.02em; } .brand p { margin:2px 0 0; color:var(--muted); font-size:12.5px; }
  .group { --c:#2fd4c4; display:grid; grid-template-columns:56px 1fr; gap:14px; align-items:center; width:100%; text-align:left; padding:16px; border-radius:22px; cursor:pointer; color:var(--ink); font-family:inherit;
    background:var(--card); border:1px solid var(--line); backdrop-filter:blur(16px) saturate(1.4); -webkit-backdrop-filter:blur(16px) saturate(1.4);
    transition:transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s ease, border-color .35s ease, background .35s ease; }
  .group:hover { transform:translateY(-3px); border-color:color-mix(in srgb, var(--c) 55%, transparent); box-shadow:0 20px 40px -22px var(--c); }
  .group[aria-current="true"] { border-color:var(--c); background:color-mix(in srgb, var(--c) 14%, var(--card)); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent), 0 22px 44px -22px var(--c); }
  .gicon { width:56px; height:56px; border-radius:18px; display:grid; place-items:center; font-size:28px; background:linear-gradient(145deg, color-mix(in srgb, var(--c) 30%, #fff), color-mix(in srgb, var(--c) 70%, #1b1d48)); box-shadow:inset 0 1px 0 rgba(255,255,255,.5), 0 10px 20px -10px var(--c); transition:transform .35s cubic-bezier(.34,1.56,.64,1); }
  .group:hover .gicon, .group[aria-current="true"] .gicon { transform:scale(1.1) rotate(-4deg); }
  .gtitle { font:700 17px Sora,system-ui; letter-spacing:-.01em; } .gblurb { color:var(--muted); font-size:13px; margin-top:2px; line-height:1.35; }
  .gcount { display:inline-block; margin-top:6px; font-size:11.5px; font-weight:800; color:var(--c); }
  .foot { margin-top:auto; color:var(--muted); font-size:12px; line-height:1.5; padding:0 4px; }
  main { padding:30px 36px 60px; min-width:0; }
  .top { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
  .top h2 { font:700 30px Sora,system-ui; letter-spacing:-.02em; margin:0; } .top p { margin:4px 0 0; color:var(--muted); font-size:14.5px; }
  .tools { display:flex; gap:8px; flex-wrap:wrap; }
  .tool { border:1px solid var(--line); background:var(--card); color:var(--ink); border-radius:999px; padding:9px 16px; font:700 13px Manrope; cursor:pointer; backdrop-filter:blur(12px); transition:all .25s ease; }
  .tool:hover { border-color:var(--accent); color:var(--accent); transform:translateY(-1px); } .tool[aria-pressed="true"] { background:var(--accent); border-color:var(--accent); color:#0d0f24; }
  .tabs { display:flex; gap:8px; overflow-x:auto; padding:4px 2px 12px; margin:0 -2px; }
  .tab { flex:0 0 auto; border:1px solid var(--line); background:var(--card); color:var(--ink); border-radius:16px; padding:12px 20px; font:700 15px Manrope; cursor:pointer; backdrop-filter:blur(12px); transition:all .3s cubic-bezier(.2,.8,.2,1); }
  .tab:hover { transform:translateY(-2px); border-color:var(--accent); } .tab[aria-selected="true"] { background:var(--accent); border-color:var(--accent); color:#0d0f24; box-shadow:0 14px 28px -14px var(--accent); }
  .hint { display:flex; gap:12px; align-items:flex-start; padding:14px 18px; margin:2px 0 18px; border-radius:18px; background:color-mix(in srgb, var(--accent) 12%, transparent); border:1px solid color-mix(in srgb, var(--accent) 28%, transparent); font-size:14px; line-height:1.5; max-width:820px; }
  .hint b { color:var(--accent); white-space:nowrap; }
  .examples { display:flex; gap:8px; margin:0 0 16px; flex-wrap:wrap; align-items:center; font-size:13px; color:var(--muted); }
  .stage { position:relative; padding:30px; border-radius:30px; border:1px solid var(--line); overflow:hidden; background-color:color-mix(in srgb, var(--card) 70%, transparent);
    background-image: radial-gradient(color-mix(in srgb, var(--ink) 11%, transparent) 1.2px, transparent 1.2px); background-size:22px 22px; }
  iframe { display:block; width:100%; max-width:780px; margin:0 auto; border:0; background:transparent; opacity:0; transform:translateY(10px); transition:opacity .5s ease, transform .5s cubic-bezier(.16,1,.3,1); }
  iframe.ready { opacity:1; transform:none; }
  @media (max-width: 1000px) {
    .app { grid-template-columns:1fr } aside { position:static; height:auto; flex-direction:row; padding:16px; overflow-x:auto; gap:10px; }
    .brand { display:none } .group { flex:0 0 250px; padding:12px; grid-template-columns:44px 1fr; gap:10px } .gicon { width:44px; height:44px; font-size:22px; border-radius:14px } .gtitle { font-size:15px } .gblurb, .foot { display:none }
    main { padding:18px 16px 40px } .top h2 { font-size:24px } .stage { padding:14px; border-radius:22px }
  }`;

const BODY = `
<div class="app">
  <aside>
    <div class="brand"><div class="logo">R</div><div><h1>RIVA</h1><p>Ride Intelligence and Virtual Assistance</p></div></div>
    <div id="groups" style="display:contents"></div>
    <div class="foot">Every widget shows real output from the tool code, rendered as it appears in a chat. Hover, drag and click to try them.</div>
  </aside>
  <main>
    <div class="top"><div><h2 id="title"></h2><p id="desc"></p></div>
      <div class="tools"><button class="tool" id="load" aria-pressed="false">Loading state</button><button class="tool" id="replay">↻ Replay</button></div></div>
    <div class="tabs" id="tabs" role="tablist"></div>
    <div class="hint"><b>Try this</b><span id="hint"></span></div>
    <div class="examples" id="examples"></div>
    <div class="stage"><iframe id="frame" title="Widget preview"></iframe></div>
  </main>
</div>`;

/** The window.openai host that widgets read their tool output from. */
const HOST_STUB = `function hostStub(data) { return '<script>window.openai={toolOutput:' + JSON.stringify(data).replace(/</g, '\\\\u003c') + ',toolInput:{},theme:"dark",displayMode:"inline",maxHeight:4000,widgetState:null,setWidgetState:async function(s){window.openai.widgetState=s},callTool:async function(){return{}},requestDisplayMode:async function(){},sendFollowUpMessage:async function(){},openExternal:function(){}};<\\/script>'; }`;

const LOADERS = {
  server: `function loadWidget(id, example) { frame.src = '/widget/' + id + '?example=' + example; }`,
  static: `${HOST_STUB}
  function loadWidget(id, example) {
    const html = EMBED.html[id];
    const data = example < 0 ? null : (EMBED.data[id][example] ?? EMBED.data[id][0]);
    frame.srcdoc = html.includes('<head>') ? html.replace('<head>', '<head>' + hostStub(data)) : hostStub(data) + html;
  }`,
};

const SCRIPT = (mode, meta, embed) => `
  const GROUPS = ${JSON.stringify(GROUPS)};
  const META = ${JSON.stringify(meta)};
  ${mode === 'static' ? `const EMBED = ${JSON.stringify(embed).replace(/</g, '\\u003c')};` : ''}
  const state = { group: 'rider', widget: 'ride-comparison', example: 0, loading: false };
  let saved = [];
  try { saved = location.hash.slice(1).split('/'); } catch (e) {}
  if (saved[0] && GROUPS.find((g) => g.id === saved[0])) { state.group = saved[0]; state.widget = saved[1] || GROUPS.find((g) => g.id === saved[0]).items[0][0]; }
  const $ = (id) => document.getElementById(id), frame = $('frame');
  const group = () => GROUPS.find((g) => g.id === state.group);
  ${LOADERS[mode]}

  function render() {
    const g = group();
    const item = g.items.find((i) => i[0] === state.widget) || g.items[0];
    state.widget = item[0];
    document.documentElement.style.setProperty('--accent', g.tone);
    $('groups').innerHTML = '';
    GROUPS.forEach((x) => {
      const b = document.createElement('button');
      b.className = 'group'; b.style.setProperty('--c', x.tone); b.setAttribute('aria-current', x.id === state.group);
      b.innerHTML = '<div class="gicon">' + x.icon + '</div><div><div class="gtitle">' + x.title + '</div><div class="gblurb">' + x.blurb + '</div><span class="gcount">' + x.items.length + ' views</span></div>';
      b.onclick = () => { state.group = x.id; state.widget = x.items[0][0]; state.example = 0; state.loading = false; render(); };
      $('groups').appendChild(b);
    });
    $('title').textContent = g.title; $('desc').textContent = g.blurb;
    $('tabs').innerHTML = '';
    g.items.forEach((i) => {
      const b = document.createElement('button');
      b.className = 'tab'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i[0] === state.widget); b.textContent = i[1];
      b.onclick = () => { state.widget = i[0]; state.example = 0; state.loading = false; render(); };
      $('tabs').appendChild(b);
    });
    $('hint').textContent = item[2];
    const ex = META[state.widget].examples;
    $('examples').innerHTML = ex.length > 1 ? 'Example: ' : '';
    if (ex.length > 1) ex.forEach((n, k) => {
      const b = document.createElement('button');
      b.className = 'tool'; b.setAttribute('aria-pressed', k === state.example); b.textContent = n;
      b.onclick = () => { state.example = k; state.loading = false; render(); };
      $('examples').appendChild(b);
    });
    $('load').setAttribute('aria-pressed', state.loading);
    try { history.replaceState(null, '', '#' + state.group + '/' + state.widget); } catch (e) {}
    frame.classList.remove('ready');
    loadWidget(state.widget, state.loading ? -1 : state.example);
  }
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    const measure = () => {
      const el = doc.querySelector('.riva');
      return el ? Math.ceil(el.getBoundingClientRect().bottom + doc.defaultView.scrollY) + 2 : doc.body.offsetHeight;
    };
    const fit = () => { frame.style.height = measure() + 'px'; };
    fit();
    const timer = setInterval(() => { if (frame.contentDocument !== doc) return clearInterval(timer); fit(); }, 250);
    requestAnimationFrame(() => frame.classList.add('ready'));
  });
  $('load').onclick = () => { state.loading = !state.loading; render(); };
  $('replay').onclick = () => render();
  addEventListener('hashchange', () => {
    const [g, w] = location.hash.slice(1).split('/');
    const target = GROUPS.find((x) => x.id === g);
    if (!target || (g === state.group && w === state.widget)) return;
    state.group = g; state.widget = w || target.items[0][0]; state.example = 0; state.loading = false; render();
  });
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,button')) return;
    const items = group().items.map((i) => i[0]); const k = items.indexOf(state.widget);
    if (e.key === 'ArrowRight' && k < items.length - 1) { state.widget = items[k + 1]; state.example = 0; render(); }
    if (e.key === 'ArrowLeft' && k > 0) { state.widget = items[k - 1]; state.example = 0; render(); }
  });
  render();`;

const FONTS = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Sora:wght@600;700&display=swap';

/**
 * mode 'server': a complete document that loads widgets from /widget/<id>.
 * mode 'static': the same page with every widget embedded. `fragment: true`
 * returns it without the html/head/body wrapper, for hosts that add their own.
 */
export function galleryPage({ mode, meta, embed, fragment = false }) {
  const head = `<title>RIVA Studio</title>\n<link rel="stylesheet" href="${FONTS}">\n<style>${CSS}</style>`;
  const body = `${BODY}\n<script>${SCRIPT(mode, meta, embed)}</script>`;
  if (fragment) return `${head}\n${body}\n`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n${head}\n</head><body>\n${body}\n</body></html>`;
}
