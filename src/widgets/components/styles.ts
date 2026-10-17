/**
 * RIVA widget design system — "Night over Coimbatore" (dark only).
 *
 * Frosted-glass panels over a slowly drifting night-sky gradient. Colour
 * carries meaning, never decoration: teal = route / go, amber = money,
 * violet = agents and reasoning, rose = refusal / risk, green = done / good.
 * One orchestrated entrance per widget (panels rise in sequence); hover
 * lifts and lights a panel in its own accent; everything respects
 * prefers-reduced-motion.
 */
export const RIVA_CSS = `
.riva {
  --ink: #eef0ff;
  --ink-2: #b6bade;
  --ink-3: #8a8fb8;
  --base: #0d0f24;
  --on-accent: #0d0f24;
  --glass: rgba(30, 33, 72, 0.52);
  --glass-hi: rgba(42, 46, 96, 0.72);
  --edge: rgba(255, 255, 255, 0.12);
  --edge-dim: rgba(255, 255, 255, 0.07);
  --track: rgba(255, 255, 255, 0.10);
  --shadow: 0 1px 0 rgba(255,255,255,0.10) inset, 0 20px 40px -22px rgba(0, 0, 0, 0.8), 0 4px 12px -4px rgba(0, 0, 0, 0.5);
  --teal: #2fd4c4;
  --amber: #ffb547;
  --violet: #9d8cff;
  --rose: #ff6b84;
  --green: #3ed58c;
  --slate: #a5aad6;
  --accent: var(--teal);
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  max-width: 700px;
  padding: 18px;
  border-radius: 28px;
  overflow: hidden;
  color: var(--ink);
  font-family: 'Manrope', 'Segoe UI', system-ui, sans-serif;
  font-size: 13.5px;
  line-height: 1.45;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(47, 212, 196, 0.22), transparent 55%),
    radial-gradient(90% 80% at 100% 10%, rgba(157, 140, 255, 0.24), transparent 60%),
    radial-gradient(110% 90% at 80% 110%, rgba(255, 181, 71, 0.16), transparent 60%),
    var(--base);
  background-size: 140% 140%, 140% 140%, 140% 140%, auto;
  animation: riva-drift 22s ease-in-out infinite alternate;
}
.riva *, .riva *::before, .riva *::after { box-sizing: border-box; }
@keyframes riva-drift {
  from { background-position: 0% 0%, 100% 0%, 80% 100%, 0 0; }
  to   { background-position: 30% 20%, 70% 30%, 50% 70%, 0 0; }
}

/* ---------- header ---------- */
.riva-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 2px 4px 14px; }
.riva-title { font-family: 'Sora', 'Manrope', system-ui, sans-serif; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.riva-sub { color: var(--ink-2); font-size: 12.5px; margin-top: 3px; }
.riva-brand { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--ink-3); white-space: nowrap; padding-top: 3px; }
.riva-brand i { width: 8px; height: 8px; border-radius: 50%; background: conic-gradient(var(--teal), var(--violet), var(--amber), var(--teal)); box-shadow: 0 0 10px var(--teal); }

/* ---------- glass panel ---------- */
.glass {
  --accent: var(--teal);
  position: relative;
  background: var(--glass);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  backdrop-filter: blur(18px) saturate(1.5);
  border: 1px solid var(--edge);
  border-radius: 20px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease;
}
.glass.tight { padding: 10px 12px; border-radius: 16px; }
.glass.lift { cursor: pointer; }
.glass.lift:hover, .glass.lift:focus-visible, .glass.active {
  transform: translateY(-3px);
  background: var(--glass-hi);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent), 0 22px 44px -20px color-mix(in srgb, var(--accent) 60%, transparent), 0 4px 10px -4px rgba(31, 34, 92, 0.15);
  outline: none;
}
.glass.lift:active { transform: translateY(-1px) scale(0.995); }
.glass.hero { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 46%, #0d0f24), color-mix(in srgb, var(--accent) 20%, #0d0f24)); color: #fff; border-color: color-mix(in srgb, var(--accent) 60%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent), 0 24px 50px -26px var(--accent); }
.glass.hero .muted, .glass.hero .faint { color: rgba(255,255,255,0.8); }
.glass.hero::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(80% 120% at 100% 0%, rgba(255,255,255,0.28), transparent 60%); pointer-events: none; }

.tone-teal { --accent: var(--teal); } .tone-amber { --accent: var(--amber); } .tone-violet { --accent: var(--violet); }
.tone-rose { --accent: var(--rose); } .tone-green { --accent: var(--green); } .tone-slate { --accent: var(--slate); }

/* ---------- entrance ---------- */
.rise { opacity: 0; animation: riva-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: calc(var(--i, 0) * 75ms + 60ms); }
@keyframes riva-rise { from { opacity: 0; transform: translateY(12px) scale(0.985); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }

/* ---------- layout ---------- */
.stack { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; align-items: center; gap: 10px; }
.between { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.g3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.g4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.split { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px; align-items: start; }
@media (max-width: 560px) { .g2, .split { grid-template-columns: 1fr; } .g3, .g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .riva { padding: 14px; border-radius: 22px; } }

/* ---------- type ---------- */
.num { font-family: 'Sora', 'Manrope', system-ui, sans-serif; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.big { font-size: 26px; font-weight: 700; line-height: 1.1; }
.mid { font-size: 18px; font-weight: 700; line-height: 1.15; }
.strong { font-weight: 700; }
.muted { color: var(--ink-2); }
.faint { color: var(--ink-3); font-size: 12px; }
.small { font-size: 12px; }
.accent { color: var(--accent); }
.h { font-family: 'Sora', 'Manrope', system-ui, sans-serif; font-weight: 700; font-size: 13.5px; margin-bottom: 8px; }

/* ---------- stat ---------- */
.stat .label { color: var(--ink-2); font-size: 12px; }
.stat .value { font-family: 'Sora', system-ui, sans-serif; font-weight: 700; font-size: 20px; letter-spacing: -0.02em; color: var(--accent); margin-top: 2px; font-variant-numeric: tabular-nums; }
.stat .sub { color: var(--ink-3); font-size: 11.5px; margin-top: 1px; }

/* ---------- pills ---------- */
.pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); white-space: nowrap; }
.pill.solid { color: var(--on-accent); background: var(--accent); border-color: transparent; box-shadow: 0 6px 14px -8px var(--accent); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }

/* ---------- meter ---------- */
.meter { height: 8px; border-radius: 99px; background: var(--track); overflow: hidden; }
.meter > i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 70%, #fff), var(--accent)); transform-origin: left; animation: riva-grow 1s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--i, 0) * 75ms + 250ms); }
@keyframes riva-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* ---------- provider mark ---------- */
.mark { width: 38px; height: 38px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0; font-size: 18px; box-shadow: 0 6px 14px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35); }
.mark.uber { background: linear-gradient(145deg, #5a5e82, #2a2c4a); }
.mark.ola { background: linear-gradient(145deg, #d7ec5b, #a4c21b); }
.mark.rapido { background: linear-gradient(145deg, #ffe066, #f5b700); }

/* ---------- route line ---------- */
.route { display: grid; grid-template-columns: 14px 1fr; column-gap: 10px; row-gap: 2px; }
.route .dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; border: 3px solid var(--teal); background: var(--base); }
.route .dot.end { border-color: var(--rose); }
.route .line { width: 2px; margin: 0 auto; min-height: 12px; background: repeating-linear-gradient(to bottom, var(--ink-3) 0 4px, transparent 4px 8px); opacity: 0.6; }

/* ---------- notes ---------- */
.note { display: flex; gap: 8px; align-items: flex-start; padding: 9px 12px; border-radius: 14px; font-size: 12px; color: var(--ink-2); background: color-mix(in srgb, var(--accent) 10%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent); }
.note b { color: var(--accent); }

/* ---------- timeline ---------- */
.steps { display: flex; flex-direction: column; }
.step { display: grid; grid-template-columns: 22px 1fr; gap: 10px; position: relative; padding-bottom: 12px; }
.step:not(:last-child)::before { content: ''; position: absolute; left: 10px; top: 20px; bottom: -2px; width: 2px; background: var(--track); }
.step .bullet { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: var(--on-accent); background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); }
.step.todo .bullet { background: var(--track); color: var(--ink-3); box-shadow: none; }
.step.now .bullet { animation: riva-pulse 1.8s ease-in-out infinite; }
@keyframes riva-pulse { 0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); } 50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--accent) 6%, transparent); } }

/* ---------- loading ---------- */
.loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 22px 8px 6px; }
.loading svg { width: 220px; height: 54px; overflow: visible; }
.loading .road { stroke: var(--ink-3); stroke-width: 3; stroke-dasharray: 6 8; fill: none; opacity: 0.45; animation: riva-dash 1.2s linear infinite; }
.loading .trail { stroke: var(--teal); stroke-width: 3.5; fill: none; stroke-linecap: round; stroke-dasharray: 60 400; animation: riva-trail 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite; filter: drop-shadow(0 0 6px var(--teal)); }
@keyframes riva-dash { to { stroke-dashoffset: -28; } }
@keyframes riva-trail { from { stroke-dashoffset: 60; } to { stroke-dashoffset: -340; } }
.skeleton { height: 54px; border-radius: 16px; background: linear-gradient(100deg, var(--glass) 30%, var(--glass-hi) 50%, var(--glass) 70%); background-size: 300% 100%; animation: riva-shimmer 1.6s ease-in-out infinite; border: 1px solid var(--edge); }
.skeleton:nth-child(2) { animation-delay: 0.15s; } .skeleton:nth-child(3) { animation-delay: 0.3s; }
@keyframes riva-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* ---------- misc ---------- */
.divider { height: 1px; background: var(--edge-dim); margin: 10px 0; }
.kv { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; font-size: 12.5px; }
.kv > :nth-child(odd) { color: var(--ink-2); }
.kv > :nth-child(even) { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.link { color: var(--violet); font-weight: 700; font-size: 12.5px; cursor: pointer; background: none; border: 0; padding: 6px; border-radius: 10px; }
.link:hover { background: color-mix(in srgb, var(--violet) 12%, transparent); }
svg text { font-family: 'Manrope', system-ui, sans-serif; }

/* ---------- controls ---------- */
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: var(--track); max-width: 100%; overflow-x: auto; }
.seg button { border: 0; background: none; color: var(--ink-2); font: 700 12.5px 'Manrope', system-ui, sans-serif; padding: 7px 14px; border-radius: 999px; cursor: pointer; white-space: nowrap; transition: background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease; }
.seg button:hover { color: var(--ink); }
.seg button[aria-checked='true'] { background: var(--glass-hi); color: var(--accent); box-shadow: 0 6px 14px -8px rgba(31, 34, 92, 0.5), 0 1px 0 rgba(255,255,255,0.8) inset; }
.seg button:focus-visible, .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); font: 700 12.5px 'Manrope', system-ui, sans-serif; padding: 7px 14px; border-radius: 999px; cursor: pointer; transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease; }
.btn:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--accent) 22%, transparent); box-shadow: 0 8px 18px -10px var(--accent); }
.btn:active { transform: scale(0.97); }
.slider-row { display: grid; gap: 7px; }
.slider-row .top { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; }
.slider-row .top b { font-family: 'Sora', system-ui, sans-serif; color: var(--accent); font-size: 14px; font-variant-numeric: tabular-nums; }
input[type='range'].slider { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 99px; outline: none; cursor: pointer; background: linear-gradient(90deg, var(--accent) var(--p, 50%), var(--track) var(--p, 50%)); }
input[type='range'].slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 4px solid var(--accent); box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--accent) 70%, transparent); transition: transform 0.15s ease; }
input[type='range'].slider::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 4px solid var(--accent); }
input[type='range'].slider:hover::-webkit-slider-thumb { transform: scale(1.15); }
input[type='range'].slider:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }

/* ---------- charts ---------- */
.chart { width: 100%; display: block; overflow: visible; }
.chart text { fill: var(--ink-3); font-size: 10.5px; font-weight: 600; }
.chart .grid { stroke: var(--ink-3); stroke-opacity: 0.22; stroke-dasharray: 3 5; }
.chart .axis { stroke: var(--ink-3); stroke-opacity: 0.5; }
.draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: riva-draw 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards; }
@keyframes riva-draw { to { stroke-dashoffset: 0; } }
.fade-in { opacity: 0; animation: riva-fade 0.8s ease 0.6s forwards; }
@keyframes riva-fade { to { opacity: 1; } }
.pop { transform-box: fill-box; transform-origin: center; opacity: 0; animation: riva-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; animation-delay: calc(var(--i, 0) * 45ms + 300ms); }
@keyframes riva-pop { from { opacity: 0; transform: scale(0.2); } to { opacity: 1; transform: none; } }
.bar-up { transform-box: fill-box; transform-origin: 50% 100%; animation: riva-barup 0.9s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--i, 0) * 70ms + 300ms); }
@keyframes riva-barup { from { transform: scaleY(0); } to { transform: none; } }
.seg-sweep { animation: riva-sweep 1.1s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--i, 0) * 120ms + 250ms); transition: opacity 0.25s ease, stroke-width 0.25s ease; }
@keyframes riva-sweep { from { stroke-dasharray: 0 100; } to { stroke-dasharray: var(--d); } }
.needle { transform-box: view-box; animation: riva-needle 1.4s cubic-bezier(0.34, 1.3, 0.64, 1) 0.4s both; transition: transform 0.45s cubic-bezier(0.34, 1.3, 0.64, 1); }
@keyframes riva-needle { from { transform: rotate(-90deg); } }
.hit { cursor: pointer; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease, filter 0.25s ease; transform-box: fill-box; transform-origin: center; }
.hit:hover, .hit.on { transform: scale(1.25); filter: drop-shadow(0 4px 8px rgba(31, 34, 92, 0.35)); }
.dim { opacity: 0.22; }
.readout { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 8px 12px; border-radius: 14px; background: color-mix(in srgb, var(--accent) 9%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent); font-size: 12.5px; transition: background 0.25s ease, border-color 0.25s ease; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 12px; color: var(--ink-2); }
.legend button { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: inherit; font: 600 12px 'Manrope', system-ui, sans-serif; padding: 3px 6px; border-radius: 8px; cursor: pointer; }
.legend button:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); }
.legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; background: var(--accent); }
.sweep { transform-box: view-box; transform-origin: 50% 50%; animation: riva-spin 4s linear infinite; }
@keyframes riva-spin { to { transform: rotate(360deg); } }
.ping { transform-box: fill-box; transform-origin: center; animation: riva-ping 2.4s ease-out infinite; animation-delay: calc(var(--i, 0) * 0.8s); }
@keyframes riva-ping { from { opacity: 0.7; transform: scale(0.3); } to { opacity: 0; transform: scale(1.6); } }
.tick { opacity: 0; animation: riva-fade 0.5s ease forwards; animation-delay: calc(var(--i, 0) * 450ms + 700ms); }
.big-ring { font-family: 'Sora', system-ui, sans-serif; font-weight: 700; }
@keyframes riva-drive { 0% { left: 0; } 100% { left: calc(100% - 30px); } }
.car { transition: transform 1.1s cubic-bezier(0.65, 0, 0.35, 1); }
.avatar { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; color: #fff; background: linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #1b1d48)); box-shadow: 0 8px 16px -8px var(--accent), inset 0 1px 0 rgba(255,255,255,.4); flex-shrink: 0; }

@media (prefers-reduced-motion: reduce) {
  .riva, .rise, .meter > i, .loading .road, .loading .trail, .skeleton, .step.now .bullet, .draw, .fade-in, .pop, .bar-up, .seg-sweep, .needle, .sweep, .ping, .tick { animation: none !important; opacity: 1; stroke-dashoffset: 0; }
  .seg-sweep { stroke-dasharray: var(--d); }
  .riva *, .riva *::before, .riva *::after { transition: none !important; }
}
`;
