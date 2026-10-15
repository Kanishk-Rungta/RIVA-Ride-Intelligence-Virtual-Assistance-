'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '@nitrostack/widgets';
import { RIVA_CSS } from './styles';

const FONTS = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap';

/** Each widget is bundled as its own page (the app layout is not used), so the frame carries the design system with it. */
const DesignSystem = () => (
  <>
    <link rel="stylesheet" href={FONTS} />
    <style dangerouslySetInnerHTML={{ __html: RIVA_CSS }} />
  </>
);

export type Tone = 'teal' | 'amber' | 'violet' | 'rose' | 'green' | 'slate';

const VEHICLE_ICON: Record<string, string> = { bike: '🏍️', auto: '🛺', mini: '🚗', sedan: '🚙', suv: '🚐' };

export const inr = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);
export const vehicleIcon = (v: string) => VEHICLE_ICON[v] ?? '🚘';
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ') : s);
const delay = (i?: number): CSSProperties | undefined => (i === undefined ? undefined : ({ ['--i' as string]: i } as CSSProperties));

/** Outer frame: themed night-sky background, title block, staggered content. */
export function Shell({ title, subtitle, children, width }: { title: string; subtitle?: ReactNode; children: ReactNode; width?: number }) {
  const theme = useTheme();
  return (
    <div className="riva" data-theme={theme === 'dark' ? 'dark' : 'light'} style={width ? { maxWidth: width } : undefined}>
      <DesignSystem />
      <div className="riva-head rise" style={delay(0)}>
        <div>
          <h1 className="riva-title">{title}</h1>
          {subtitle ? <div className="riva-sub">{subtitle}</div> : null}
        </div>
        <span className="riva-brand"><i />RIVA</span>
      </div>
      <div className="stack">{children}</div>
    </div>
  );
}

export function Glass({
  children, i, tone, lift, active, hero, tight, className = '', style, onClick, title,
}: {
  children: ReactNode; i?: number; tone?: Tone; lift?: boolean; active?: boolean; hero?: boolean; tight?: boolean;
  className?: string; style?: CSSProperties; onClick?: () => void; title?: string;
}) {
  const cls = ['glass', i !== undefined && 'rise', tone && `tone-${tone}`, lift && 'lift', active && 'active', hero && 'hero', tight && 'tight', className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ ...delay(i), ...style }} onClick={onClick} title={title} tabIndex={lift ? 0 : undefined}
      onKeyDown={lift && onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'teal', i }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; i?: number }) {
  return (
    <Glass i={i} tone={tone} lift tight className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </Glass>
  );
}

export const Pill = ({ tone = 'teal', solid, children }: { tone?: Tone; solid?: boolean; children: ReactNode }) => (
  <span className={`pill tone-${tone}${solid ? ' solid' : ''}`}>{children}</span>
);

export const Meter = ({ value, max, tone = 'teal', i }: { value: number; max: number; tone?: Tone; i?: number }) => (
  <div className={`meter tone-${tone}`} style={delay(i)}>
    <i style={{ width: `${Math.max(2, Math.min(100, (value / Math.max(max, 1e-9)) * 100))}%` }} />
  </div>
);

export const Mark = ({ provider, vehicle }: { provider: string; vehicle: string }) => (
  <div className={`mark ${provider}`} aria-label={`${provider} ${vehicle}`}>{vehicleIcon(vehicle)}</div>
);

export function Route({ from, to, middle }: { from: string; to: string; middle?: ReactNode }) {
  return (
    <div className="route">
      <span className="dot" /><span className="strong">{from}</span>
      <span className="line" /><span className="faint">{middle}</span>
      <span className="dot end" /><span className="strong">{to}</span>
    </div>
  );
}

export const Note = ({ tone = 'amber', icon = '⚠', children }: { tone?: Tone; icon?: string; children: ReactNode }) => (
  <div className={`note tone-${tone}`}><span aria-hidden>{icon}</span><span>{children}</span></div>
);

/** Loading state: a car tracing a dashed road, then shimmering placeholder panels. */
export function Loading({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <div className="riva" data-theme={theme === 'dark' ? 'dark' : 'light'} role="status" aria-live="polite">
      <DesignSystem />
      <div className="loading">
        <svg viewBox="0 0 220 54" aria-hidden>
          <path className="road" d="M6 44 C 50 44, 60 10, 110 10 S 170 44, 214 44" />
          <path className="trail" d="M6 44 C 50 44, 60 10, 110 10 S 170 44, 214 44" />
          <circle r="7" fill="var(--teal)" stroke="#fff" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 0 6px var(--teal))' }}>
            <animateMotion dur="2.4s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.65 0 0.35 1" path="M6 44 C 50 44, 60 10, 110 10 S 170 44, 214 44" />
          </circle>
        </svg>
        <div className="muted strong">{label}</div>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        <div className="skeleton" /><div className="skeleton" /><div className="skeleton" style={{ height: 34 }} />
      </div>
    </div>
  );
}
