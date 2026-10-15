'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Route, Shell, Stat, cap, inr, type Tone } from '../../components/ui';

interface ForecastData {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  returnTime: string;
  demandLevel: 'low' | 'moderate' | 'high' | 'peak';
  currentFare: number | null;
  currentBestOption: { providerName: string; vehicleType: string; fare: number; pickupEtaMinutes: number } | null;
  estimatedFutureFare: number | null;
  forecastMultiplier: number;
  explanation: string;
  disclaimer: string;
}

const DEMAND: Record<string, Tone> = { low: 'green', moderate: 'teal', high: 'amber', peak: 'rose' };

export default function ReturnFareForecast() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<ForecastData>();
  if (!data) return <Loading label="Estimating your ride home…" />;

  const change = data.currentFare && data.estimatedFutureFare ? Math.round(((data.estimatedFutureFare - data.currentFare) / data.currentFare) * 100) : null;
  return (
    <Shell title={`Return trip at ${data.returnTime}`} subtitle="Estimated from time-of-day demand">
      <Glass i={1} tone={DEMAND[data.demandLevel]} hero>
        <div className="between">
          <div><div className="small">Likely fare</div><div className="num big">{inr(data.estimatedFutureFare)}</div></div>
          <Pill tone={DEMAND[data.demandLevel]} solid>{cap(data.demandLevel)} demand</Pill>
        </div>
      </Glass>
      <div className="split">
        <Glass i={2} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>
        <div className="g2">
          <Stat i={3} tone="teal" label="Fare now" value={inr(data.currentFare)} sub={data.currentBestOption ? `${data.currentBestOption.providerName} ${data.currentBestOption.vehicleType}` : undefined} />
          <Stat i={4} tone={change !== null && change > 0 ? 'rose' : 'green'} label="Change" value={change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`} sub={`×${data.forecastMultiplier}`} />
        </div>
      </div>
      <Glass i={5} tone="slate"><div className="small muted">{data.explanation}</div><div className="faint" style={{ marginTop: 6 }}>{data.disclaimer}</div></Glass>
    </Shell>
  );
}
