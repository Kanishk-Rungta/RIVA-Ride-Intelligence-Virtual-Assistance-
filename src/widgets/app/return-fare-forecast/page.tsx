'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Route, Shell, cap, inr, type Tone } from '../../components/ui';
import { CountUp } from '../../components/charts';
import { FareCurve } from '../../components/fare-curve';

interface Data {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  returnTime: string;
  targetHour?: number;
  hourlyCurve?: Array<{ hour: number; multiplier: number }>;
  demandLevel: 'low' | 'moderate' | 'high' | 'peak';
  currentFare: number | null;
  currentBestOption: { providerName: string; vehicleType: string } | null;
  estimatedFutureFare: number | null;
  forecastMultiplier: number;
  explanation: string;
  disclaimer: string;
}
const DEMAND: Record<string, Tone> = { low: 'green', moderate: 'teal', high: 'amber', peak: 'rose' };

export default function ReturnFareForecast() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  if (!data) return <Loading label="Estimating your ride home…" />;

  const change = data.currentFare && data.estimatedFutureFare ? Math.round(((data.estimatedFutureFare - data.currentFare) / data.currentFare) * 100) : null;
  return (
    <Shell title={`Ride home at ${data.returnTime}`} subtitle="Estimated from time-of-day demand" width={720}>
      <Glass i={1} tone={DEMAND[data.demandLevel]} hero>
        <div className="between">
          <div><div className="small">Likely fare</div><div className="num big"><CountUp value={data.estimatedFutureFare ?? 0} format={inr} /></div>
            <div className="small">{change === null ? '' : `${change > 0 ? '+' : ''}${change}% against ${inr(data.currentFare)} now`}{data.currentBestOption ? ` (${data.currentBestOption.providerName} ${data.currentBestOption.vehicleType})` : ''}</div></div>
          <Pill tone={DEMAND[data.demandLevel]} solid>{cap(data.demandLevel)} demand</Pill>
        </div>
      </Glass>
      <Glass i={2} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>
      {data.hourlyCurve && data.currentFare !== null && data.targetHour !== undefined ? <FareCurve curve={data.hourlyCurve} currentFare={data.currentFare} targetHour={data.targetHour} tone="rose" i={3} /> : null}
      <Glass i={4} tone="slate"><div className="small muted">{data.explanation}</div><div className="faint" style={{ marginTop: 6 }}>{data.disclaimer}</div></Glass>
    </Shell>
  );
}
