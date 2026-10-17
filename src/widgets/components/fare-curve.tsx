'use client';

import { useState } from 'react';
import { AreaChart, CountUp, Slider } from './charts';
import { Glass, Pill, inr, type Tone } from './ui';

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? ' AM' : ' PM'}`;
const round5 = (n: number) => Math.round(n / 5) * 5;

/** 24-hour fare curve: the chosen hour is marked, any hour can be inspected, and the cheapest hour is called out. */
export function FareCurve({ curve, currentFare, targetHour, tone = 'amber', i = 2 }: { curve: Array<{ hour: number; multiplier: number }>; currentFare: number; targetHour: number; tone?: Tone; i?: number }) {
  const [sel, setSel] = useState(targetHour);
  const [hover, setHover] = useState<number | null>(null);
  const fares = curve.map((c) => round5(currentFare * c.multiplier));
  const at = hover ?? sel;
  const cheapest = fares.indexOf(Math.min(...fares));
  const saving = fares[targetHour] - fares[cheapest];
  const delta = fares[at] - fares[targetHour];
  return (
    <Glass i={i} tone={tone}>
      <div className="between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="h" style={{ margin: 0 }}>Fare through the day</div>
        <Pill tone="green">Cheapest around {hourLabel(cheapest)}, {inr(fares[cheapest])}</Pill>
      </div>
      <div style={{ margin: '10px 0 4px' }}>
        <AreaChart values={fares} labels={curve.map((c) => hourLabel(c.hour).replace(' ', '').toLowerCase())} format={inr} tone={tone}
          marker={targetHour} markerLabel={`Your ride ${hourLabel(targetHour)}`} active={hover ?? sel} onActive={setHover} ariaLabel="Estimated fare for each hour of the day" yMin={Math.min(...fares) * 0.7} />
      </div>
      <div className="readout tone-amber" style={{ marginBottom: 12 }}>
        <div className="num mid accent"><CountUp value={fares[at]} format={inr} /></div>
        <div className="small">at {hourLabel(at)}{at !== targetHour ? <b style={{ color: delta <= 0 ? 'var(--green)' : 'var(--rose)' }}>{`, ${delta <= 0 ? '' : '+'}${inr(delta).replace('₹-', '-₹')} versus your ride`}</b> : ', your planned time'}</div>
      </div>
      <Slider label="Try another hour" value={sel} min={0} max={23} tone={tone} onChange={setSel} format={hourLabel} />
      {saving > 0 ? <div className="faint" style={{ marginTop: 8 }}>Moving to {hourLabel(cheapest)} would save about {inr(saving)}.</div> : <div className="faint" style={{ marginTop: 8 }}>You have already picked the cheapest time of day.</div>}
    </Glass>
  );
}
