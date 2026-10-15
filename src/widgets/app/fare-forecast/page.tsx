'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Route, Shell, Stat, cap, inr, type Tone } from '../../components/ui';

interface FareForecastData {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  targetTimeLabel: string;
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
  const data = getToolOutput<FareForecastData>();
  if (!data) return <Loading label="Forecasting the fare for later…" />;

  return (
    <Shell title={`Fare at ${data.targetTimeLabel}`} subtitle="Estimated from time-of-day demand">
      <Glass i={1} tone="amber" hero>
        <div className="between">
          <div><div className="small">Expected range</div><div className="num big">{inr(data.forecastFareLow)} to {inr(data.forecastFareHigh)}</div></div>
          <Pill tone={AVAIL[data.expectedAvailability]} solid>{cap(data.expectedAvailability)} rides</Pill>
        </div>
      </Glass>
      <div className="split">
        <Glass i={2} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>
        <div className="g2">
          <Stat i={3} tone="teal" label="Fare now" value={inr(data.currentFare)} />
          <Stat i={4} tone="violet" label="Demand" value={`${data.demandMultiplier}×`} />
        </div>
      </div>
      <Glass i={5} tone="slate"><div className="small muted">{data.reason}</div><div className="faint" style={{ marginTop: 6 }}>{data.disclaimer}</div></Glass>
    </Shell>
  );
}
