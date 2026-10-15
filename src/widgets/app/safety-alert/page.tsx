'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Note, Pill, Shell } from '../../components/ui';

interface SosAlertData {
  timestamp: number;
  currentLocation: { formattedAddress: string };
  bookingId: string | null;
  contactsNotified: string[];
  locationShared: boolean;
  tripDetailsShared: boolean;
  message: string;
  disclaimer: string;
}

export default function SafetyAlert() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<SosAlertData>();
  if (!data) return <Loading label="Sending your alert…" />;

  return (
    <Shell title="Emergency alert sent" subtitle={`Simulation, ${new Date(data.timestamp).toLocaleTimeString()}`} width={600}>
      <Glass i={1} tone="rose" hero>
        <div className="small">Call 112 if you are in danger</div>
        <div className="mid" style={{ marginTop: 2 }}>{data.message}</div>
      </Glass>
      <div className="g2">
        <Glass i={2} tone="teal" lift>
          <div className="h">Shared</div>
          <div className="chips">
            <Pill tone={data.locationShared ? 'green' : 'slate'}>{data.locationShared ? '✓' : '✕'} Location</Pill>
            <Pill tone={data.tripDetailsShared ? 'green' : 'slate'}>{data.tripDetailsShared ? '✓' : '✕'} Trip details</Pill>
          </div>
          <div className="faint" style={{ marginTop: 8 }}>{data.currentLocation.formattedAddress}</div>
        </Glass>
        <Glass i={3} tone="violet" lift>
          <div className="h">Notified</div>
          <div className="stack" style={{ gap: 4 }}>{data.contactsNotified.map((c) => <div key={c} className="small">• {c}</div>)}</div>
        </Glass>
      </div>
      <div className="rise" style={{ ['--i' as string]: 4 }}><Note tone="rose" icon="!">{data.disclaimer}</Note></div>
    </Shell>
  );
}
