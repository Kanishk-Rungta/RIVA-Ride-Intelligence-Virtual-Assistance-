'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Route, Shell, cap, inr, type Tone } from '../../components/ui';
import { CountUp } from '../../components/charts';
import { FareCurve } from '../../components/fare-curve';

interface Data {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  targetTimeLabel: string;
  targetHour?: number;
  hourlyCurve?: Array<{ hour: number; multiplier: number }>;
  currentFare: number | null;
  forecastFareLow: number | null;
  forecastFareHigh: number | null;
  demandMultiplier: number;
  expectedAvailability: 'PLENTY' | 'MODERATE' | 'SCARCE';
  reason: string;
  disclaimer: string;
}
const AVAIL: Record<string, Tone> = { PLENTY: 'green', MODERATE: 'amber', SCARCE: 'rose' };

export default function FareForecast() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  if (!data) return <Loading label="Forecasting the fare for later…" />;

  return (
    <Shell title={`Fare at ${data.targetTimeLabel}`} subtitle="Estimated from time-of-day demand" width={720}>
      <Glass i={1} tone="amber" hero>
        <div className="between">
          <div><div className="small">Expected range</div><div className="num big"><CountUp value={data.forecastFareLow ?? 0} format={inr} /> to <CountUp value={data.forecastFareHigh ?? 0} format={inr} /></div></div>
          <div style={{ textAlign: 'right' }}><Pill tone={AVAIL[data.expectedAvailability]} solid>{cap(data.expectedAvailability)} rides</Pill><div className="small" style={{ marginTop: 6 }}>Demand ×{data.demandMultiplier}, fare now {inr(data.currentFare)}</div></div>
        </div>
      </Glass>
      <Glass i={2} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>
      {data.hourlyCurve && data.currentFare !== null && data.targetHour !== undefined ? <FareCurve curve={data.hourlyCurve} currentFare={data.currentFare} targetHour={data.targetHour} i={3} /> : null}
      <Glass i={4} tone="slate"><div className="small muted">{data.reason}</div><div className="faint" style={{ marginTop: 6 }}>{data.disclaimer}</div></Glass>
    </Shell>
  );
}
