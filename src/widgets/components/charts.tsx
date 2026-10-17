'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Tone } from './ui';

const tone = (t: Tone) => `var(--${t})`;
const idx = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

/* ------------------------------------------------------------------ numbers */

export function useCountUp(target: number, ms = 1000): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function CountUp({ value, format = (n: number) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}

/* ----------------------------------------------------------------- controls */

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, tone: t = 'teal' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format: (v: number) => string; tone?: Tone }) {
  const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className={`slider-row tone-${t}`}>
      <div className="top"><span className="muted">{label}</span><b>{format(value)}</b></div>
      <input className="slider" type="range" min={min} max={max} step={step} value={value} aria-label={label}
        style={{ ['--p' as string]: `${p}%` } as CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/* -------------------------------------------------------------------- donut */

export interface Slice { label: string; value: number; tone: Tone; note?: string }

export function Donut({ slices, size = 168, centerLabel, centerValue, format = (n) => String(Math.round(n)) }: { slices: Slice[]; size?: number; centerLabel: string; centerValue: ReactNode; format?: (n: number) => string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + Math.max(x.value, 0), 0) || 1;
  const r = 15.9155; // circumference 100
  let offset = 0;
  const shown = active === null ? null : slices[active];
  return (
    <div className="row" style={{ gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg className="chart" viewBox="0 0 42 42" width={size} height={size} style={{ width: size, flexShrink: 0 }} role="img" aria-label={`${centerLabel} breakdown`}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--track)" strokeWidth="5" />
        <g transform="rotate(-90 21 21)">
          {slices.map((s, i) => {
            const pct = (Math.max(s.value, 0) / total) * 100;
            const seg = (
              <circle key={s.label} className="seg-sweep" cx="21" cy="21" r={r} fill="none" stroke={tone(s.tone)} strokeWidth={active === i ? 6.4 : 5}
                strokeLinecap="butt" pathLength={100} strokeDashoffset={-offset} opacity={active === null || active === i ? 1 : 0.28}
                style={{ ['--d' as string]: `${Math.max(pct - 0.6, 0)} ${100 - Math.max(pct - 0.6, 0)}`, ['--i' as string]: i, cursor: 'pointer' } as CSSProperties}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />
            );
            offset += pct;
            return seg;
          })}
        </g>
        <text x="21" y="20" textAnchor="middle" style={{ fontSize: 3.1, fill: 'var(--ink-3)' }}>{shown ? shown.label : centerLabel}</text>
        <foreignObject x="6" y="21" width="30" height="10">
          <div style={{ textAlign: 'center', fontFamily: 'Sora, system-ui', fontWeight: 700, fontSize: 5.2, color: shown ? tone(shown.tone) : 'var(--ink)', lineHeight: 1.1 }}>
            {shown ? format(shown.value) : centerValue}
          </div>
        </foreignObject>
      </svg>
      <div className="stack" style={{ gap: 6, minWidth: 150 }}>
        {slices.map((s, i) => (
          <div key={s.label} className="legend" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} style={{ opacity: active === null || active === i ? 1 : 0.45, transition: 'opacity .2s' }}>
            <span className="between" style={{ width: '100%', gap: 14 }}>
              <span className="row" style={{ gap: 7 }}><i style={{ background: tone(s.tone) }} />{s.label}</span>
              <b className="num" style={{ color: 'var(--ink)' }}>{format(s.value)} <span className="faint">{Math.round((Math.max(s.value, 0) / total) * 100)}%</span></b>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- gauge */

export function Gauge({ value, min, max, zones, label, valueLabel, marker, markerLabel }: { value: number; min: number; max: number; zones: Array<{ to: number; tone: Tone }>; label: string; valueLabel: string; marker?: number; markerLabel?: string }) {
  const frac = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const arc = 'M 14 92 A 76 76 0 0 1 166 92';
  let from = min;
  const angle = -90 + frac(value) * 180;
  const point = (v: number, rad: number) => {
    const a = Math.PI * (1 - frac(v));
    return { x: 90 + rad * Math.cos(a), y: 92 - rad * Math.sin(a) };
  };
  return (
    <svg className="chart" viewBox="0 0 180 118" role="img" aria-label={`${label}: ${valueLabel}`} style={{ maxWidth: 300, margin: '0 auto' }}>
      <path d={arc} fill="none" stroke="var(--track)" strokeWidth="13" strokeLinecap="round" />
      {zones.map((z, i) => {
        const a = frac(from) * 100;
        const b = frac(z.to) * 100;
        from = z.to;
        return <path key={i} d={arc} pathLength={100} fill="none" stroke={tone(z.tone)} strokeWidth="13" strokeDasharray={`${Math.max(b - a - 0.8, 0)} 200`} strokeDashoffset={-a} opacity={0.9} />;
      })}
      {marker !== undefined ? (() => {
        const p1 = point(marker, 66);
        const p2 = point(marker, 86);
        return <g><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />{markerLabel ? <text x={point(marker, 97).x} y={point(marker, 97).y + 3} textAnchor="middle">{markerLabel}</text> : null}</g>;
      })() : null}
      <g className="needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: '90px 92px' }}>
        <line x1="90" y1="92" x2="90" y2="30" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="90" cy="92" r="7" fill="var(--ink)" /><circle cx="90" cy="92" r="2.6" fill="var(--base)" />
      </g>
      <text x="90" y="112" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)', fontFamily: 'Sora, system-ui' }}>{valueLabel}</text>
    </svg>
  );
}

/* -------------------------------------------------------------------- radar */

export interface RadarSeries { name: string; values: number[]; tone: Tone }

export function Radar({ axes, series, active, size = 260 }: { axes: string[]; series: RadarSeries[]; active?: number | null; size?: number }) {
  const c = 120;
  const R = 78;
  const at = (i: number, f: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return { x: c + R * f * Math.cos(a), y: c + R * f * Math.sin(a) };
  };
  const poly = (vals: number[]) => vals.map((v, i) => `${at(i, Math.max(0.04, v)).x},${at(i, Math.max(0.04, v)).y}`).join(' ');
  return (
    <svg className="chart" viewBox="0 0 240 240" width={size} style={{ width: size, maxWidth: '100%', margin: '0 auto' }} role="img" aria-label="Radar comparison">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} className="grid" fill="none" points={axes.map((_, i) => `${at(i, f).x},${at(i, f).y}`).join(' ')} />)}
      {axes.map((a, i) => (
        <g key={a}>
          <line className="grid" x1={c} y1={c} x2={at(i, 1).x} y2={at(i, 1).y} />
          <text x={at(i, 1.2).x} y={at(i, 1.2).y + 3} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>{a}</text>
        </g>
      ))}
      {series.map((s, k) => {
        const on = active === null || active === undefined || active === k;
        return (
          <g key={s.name} style={{ transformBox: 'view-box', transformOrigin: `${c}px ${c}px`, animation: `riva-pop 0.8s cubic-bezier(.16,1,.3,1) ${0.25 + k * 0.12}s both`, opacity: on ? 1 : 0.16, transition: 'opacity .25s' }}>
            <polygon points={poly(s.values)} fill={tone(s.tone)} fillOpacity={k === 0 ? 0.3 : 0.12} stroke={tone(s.tone)} strokeWidth={k === 0 ? 2.6 : 1.6} strokeLinejoin="round" />
            {s.values.map((v, i) => <circle key={i} cx={at(i, Math.max(0.04, v)).x} cy={at(i, Math.max(0.04, v)).y} r={k === 0 ? 3.6 : 2.4} fill={tone(s.tone)} stroke="#fff" strokeWidth="1.2" />)}
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- area chart */

export function AreaChart({ values, labels, format, tone: t = 'teal', marker, markerLabel, active, onActive, yMin, ariaLabel }: { values: number[]; labels: string[]; format: (v: number) => string; tone?: Tone; marker?: number; markerLabel?: string; active: number | null; onActive: (i: number | null) => void; yMin?: number; ariaLabel: string }) {
  const W = 480;
  const H = 190;
  const L = 8;
  const B = 24;
  const T = 22;
  const lo = yMin ?? Math.min(...values) * 0.9;
  const hi = Math.max(...values) * 1.08;
  const x = (i: number) => L + (i / (values.length - 1)) * (W - 2 * L);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1)} ${H - B} L${x(0)} ${H - B} Z`;
  const id = `ag-${t}`;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const f = ((e.clientX - r.left) / r.width) * W;
        onActive(Math.max(0, Math.min(values.length - 1, Math.round(((f - L) / (W - 2 * L)) * (values.length - 1)))));
      }}
      onMouseLeave={() => onActive(null)}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tone(t)} stopOpacity="0.5" /><stop offset="1" stopColor={tone(t)} stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} className="grid" x1={L} x2={W - L} y1={T + f * (H - T - B)} y2={T + f * (H - T - B)} />)}
      <path d={area} fill={`url(#${id})`} className="fade-in" />
      <path d={line} pathLength={1} className="draw" fill="none" stroke={tone(t)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 4px 8px ${tone(t)})` }} />
      {labels.map((l, i) => (i % 3 === 0 ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{l}</text> : null))}
      {marker !== undefined ? (
        <g><line x1={x(marker)} x2={x(marker)} y1={T - 6} y2={H - B} stroke="var(--ink)" strokeOpacity="0.55" strokeDasharray="4 4" />
          <circle cx={x(marker)} cy={y(values[marker])} r="6" fill="var(--base)" stroke="var(--ink)" strokeWidth="2.5" />
          {markerLabel ? <text x={Math.min(Math.max(x(marker), 34), W - 34)} y={T - 9} textAnchor="middle" style={{ fill: 'var(--ink)' }}>{markerLabel}</text> : null}</g>
      ) : null}
      {active !== null ? (
        <g><line x1={x(active)} x2={x(active)} y1={T} y2={H - B} stroke={tone(t)} strokeWidth="1.5" />
          <circle cx={x(active)} cy={y(values[active])} r="5.5" fill={tone(t)} stroke="#fff" strokeWidth="2.4" />
          <text x={Math.min(Math.max(x(active), 36), W - 36)} y={y(values[active]) - 12} textAnchor="middle" style={{ fill: 'var(--ink)', fontSize: 12, fontWeight: 800 }}>{format(values[active])}</text></g>
      ) : null}
    </svg>
  );
}

/* --------------------------------------------------------------------- bars */

export function Bars({ items, active, onActive, format, tone: t = 'teal', height = 150 }: { items: Array<{ label: string; value: number }>; active: number | null; onActive: (i: number | null) => void; format: (v: number) => string; tone?: Tone; height?: number }) {
  const W = 480;
  const T = 22;
  const B = 24;
  const max = Math.max(...items.map((i) => i.value), 1);
  const slot = (W - 16) / items.length;
  const bw = Math.min(54, slot * 0.62);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Bar chart" onMouseLeave={() => onActive(null)}>
      <line className="axis" x1="8" x2={W - 8} y1={height - B} y2={height - B} />
      {items.map((it, i) => {
        const h = (it.value / max) * (height - T - B);
        const cx = 8 + slot * i + slot / 2;
        const on = active === null || active === i;
        return (
          <g key={it.label} style={{ cursor: 'pointer', opacity: on ? 1 : 0.35, transition: 'opacity .25s' }} onMouseEnter={() => onActive(i)}>
            <rect x={cx - slot / 2} y={0} width={slot} height={height} fill="transparent" />
            <rect className="bar-up" style={idx(i)} x={cx - bw / 2} y={height - B - h} width={bw} height={Math.max(h, 2)} rx="9" fill={tone(t)} fillOpacity={active === i ? 1 : 0.85} />
            <text x={cx} y={height - B - h - 7} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 800 }}>{format(it.value)}</text>
            <text x={cx} y={height - 7} textAnchor="middle">{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------- utilities */

/** Equirectangular projection of lat/lng points into an svg box, padded and aspect-correct. */
export function projector(points: Array<{ lat: number; lng: number }>, w: number, h: number, pad = 26) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((w - 2 * pad) / Math.max(x1 - x0, 1e-6), (h - 2 * pad) / Math.max(y1 - y0, 1e-6));
  const ox = (w - (x1 - x0) * s) / 2;
  const oy = (h - (y1 - y0) * s) / 2;
  return (p: { lat: number; lng: number }) => ({ x: ox + (p.lng * k - x0) * s, y: h - (oy + (p.lat - y0) * s) });
}
