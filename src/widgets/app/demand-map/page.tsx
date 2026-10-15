'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Pill, Shell, Stat, cap, type Tone } from '../../components/ui';

type DemandLevel = 'HIGH' | 'MEDIUM' | 'LOW';
interface DestinationDemandData {
  destination: { formattedAddress: string };
  matchedZone: string | null;
  time: string;
  demandLevel: DemandLevel;
  expectedRideAvailability: string;
  expectedWaitingMinutes: number;
  returnProbability: number;
  explanation: string;
}
interface Zone { zoneName: string; distanceFromCurrentKm: number; demandLevel: DemandLevel; demandScore: number; reasoning: string }
interface ZoneSuggestionData { currentLocation: { formattedAddress: string }; time: string; topRecommendation: Zone | null; alternatives: Zone[] }

const TONE: Record<DemandLevel, Tone> = { HIGH: 'green', MEDIUM: 'amber', LOW: 'rose' };

export default function DemandMap() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<DestinationDemandData | ZoneSuggestionData>();
  if (!data) return <Loading label="Reading demand across the city…" />;

  if ('topRecommendation' in data) {
    const zones = [data.topRecommendation, ...data.alternatives].filter(Boolean) as Zone[];
    return (
      <Shell title="Where to head next" subtitle={`From ${data.currentLocation.formattedAddress}, ${data.time}`}>
        {zones.map((z, k) => (
          <Glass key={z.zoneName} i={1 + k} tone={k === 0 ? 'green' : TONE[z.demandLevel]} lift active={k === 0}>
            <div className="between">
              <div>
                <div className="strong">{z.zoneName}</div>
                <div className="faint">{z.distanceFromCurrentKm} km away</div>
              </div>
              <div className="row">{k === 0 ? <Pill tone="green" solid>Best move</Pill> : null}<Pill tone={TONE[z.demandLevel]}>{cap(z.demandLevel)} demand</Pill></div>
            </div>
            <div style={{ margin: '10px 0 6px' }}><Meter value={z.demandScore} max={100} tone={TONE[z.demandLevel]} i={1 + k} /></div>
            <div className="small muted">{z.reasoning}</div>
          </Glass>
        ))}
      </Shell>
    );
  }

  const t = TONE[data.demandLevel];
  return (
    <Shell title={`Demand at ${data.matchedZone ?? data.destination.formattedAddress}`} subtitle={`Estimated for ${data.time}`} width={620}>
      <Glass i={1} tone={t} hero>
        <div className="between"><div><div className="small">Demand right now</div><div className="num big">{cap(data.demandLevel)}</div></div><Pill tone={t} solid>{cap(data.expectedRideAvailability)} rides</Pill></div>
      </Glass>
      <div className="g2">
        <Stat i={2} tone="teal" label="Expected wait" value={`${data.expectedWaitingMinutes} min`} />
        <Stat i={3} tone="violet" label="Return-ride chance" value={`${Math.round(data.returnProbability * 100)}%`} />
      </div>
      <Glass i={4} tone="slate"><div className="small muted">{data.explanation}</div></Glass>
    </Shell>
  );
}
