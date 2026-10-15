/**
 * RIVA widget design system — "Dusk over Coimbatore".
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
  --ink: #161833;
  --ink-2: #4b4f72;
  --ink-3: #7a7e9e;
  --base: #e9edf8;
  --glass: rgba(255, 255, 255, 0.58);
  --glass-hi: rgba(255, 255, 255, 0.82);
  --edge: rgba(255, 255, 255, 0.75);
  --edge-dim: rgba(22, 24, 51, 0.08);
  --track: rgba(22, 24, 51, 0.08);
  --shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(22,24,51,0.04) inset, 0 18px 36px -22px rgba(31, 34, 92, 0.45), 0 4px 10px -4px rgba(31, 34, 92, 0.12);
  --teal: #0d9e93;
  --amber: #e08a12;
  --violet: #6a55e8;
  --rose: #e0445f;
  --green: #1c9b5e;
  --slate: #5b6185;
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
    radial-gradient(120% 90% at 0% 0%, rgba(13, 158, 147, 0.30), transparent 55%),
    radial-gradient(90% 80% at 100% 10%, rgba(106, 85, 232, 0.28), transparent 60%),
    radial-gradient(110% 90% at 80% 110%, rgba(240, 160, 50, 0.30), transparent 60%),
    var(--base);
  background-size: 140% 140%, 140% 140%, 140% 140%, auto;
  animation: riva-drift 22s ease-in-out infinite alternate;
}
.riva[data-theme='dark'] {
  --ink: #eef0ff;
  --ink-2: #b6bade;
  --ink-3: #8a8fb8;
  --base: #0d0f24;
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
.glass.hero { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 88%, #fff 0%), color-mix(in srgb, var(--accent) 70%, #1b1d48)); color: #fff; border-color: rgba(255,255,255,0.35); }
.glass.hero .muted, .glass.hero .faint { color: rgba(255,255,255,0.82); }
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
.pill.solid { color: #fff; background: var(--accent); border-color: transparent; box-shadow: 0 6px 14px -8px var(--accent); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }

/* ---------- meter ---------- */
.meter { height: 8px; border-radius: 99px; background: var(--track); overflow: hidden; }
.meter > i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 70%, #fff), var(--accent)); transform-origin: left; animation: riva-grow 1s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--i, 0) * 75ms + 250ms); }
@keyframes riva-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* ---------- provider mark ---------- */
.mark { width: 38px; height: 38px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0; font-size: 18px; box-shadow: 0 6px 14px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35); }
.mark.uber { background: linear-gradient(145deg, #2a2a33, #050507); }
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
.step .bullet { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #fff; background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); }
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

@media (prefers-reduced-motion: reduce) {
  .riva, .rise, .meter > i, .loading .road, .loading .trail, .skeleton, .step.now .bullet { animation: none !important; opacity: 1; }
  .glass { transition: none; }
}
`;
