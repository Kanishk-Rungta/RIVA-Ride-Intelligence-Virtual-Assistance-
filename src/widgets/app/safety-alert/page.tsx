'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Note, Pill, Shell } from '../../components/ui';

interface Data {
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
  const data = getToolOutput<Data>();
  if (!data) return <Loading label="Sending your alert…" />;

  return (
    <Shell title="Emergency alert sent" subtitle={`Simulation, ${new Date(data.timestamp).toLocaleTimeString()}`} width={660}>
      <Glass i={1} tone="rose" hero>
        <div className="between">
          <div><div className="small">If you are in danger, call 112</div><div className="mid" style={{ marginTop: 2 }}>{data.message}</div></div>
        </div>
      </Glass>
      <div className="split">
        <Glass i={2} tone="rose">
          <svg className="chart" viewBox="0 0 240 190" role="img" aria-label="Location shared" style={{ maxWidth: 260, margin: '0 auto' }}>
            {[0, 1, 2].map((k) => <circle key={k} cx="120" cy="92" r="46" fill="none" stroke="var(--rose)" strokeWidth="2.5" className="ping" style={{ ['--i' as string]: k } as React.CSSProperties} />)}
            <circle cx="120" cy="92" r="34" fill="var(--rose)" fillOpacity="0.12" />
            <path d="M120 58c-14 0-25 11-25 25 0 19 25 42 25 42s25-23 25-42c0-14-11-25-25-25z" fill="var(--rose)" stroke="#fff" strokeWidth="3" />
            <circle cx="120" cy="83" r="9" fill="#fff" />
            <text x="120" y="160" textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 800, fontSize: 12 }}>{data.currentLocation.formattedAddress.split(',')[0]}</text>
            <text x="120" y="177" textAnchor="middle">Location shared live</text>
          </svg>
        </Glass>
        <div className="stack">
          <Glass i={3} tone="violet">
            <div className="h">Contacts notified</div>
            <div className="stack" style={{ gap: 9 }}>
              {data.contactsNotified.map((c, k) => (
                <div key={c} className="between"><div className="row"><div className="avatar" style={{ ['--accent' as string]: 'var(--violet)' } as React.CSSProperties}>{c[0]}</div><span className="strong">{c}</span></div><span className="tick pill tone-green" style={{ ['--i' as string]: k } as React.CSSProperties}>✓ Delivered</span></div>
              ))}
            </div>
          </Glass>
          <Glass i={4} tone="teal">
            <div className="h">What was shared</div>
            <div className="chips"><Pill tone={data.locationShared ? 'green' : 'slate'}>{data.locationShared ? '✓' : '✕'} Location</Pill><Pill tone={data.tripDetailsShared ? 'green' : 'slate'}>{data.tripDetailsShared ? '✓' : '✕'} Trip details</Pill></div>
          </Glass>
        </div>
      </div>
      <div className="rise" style={{ ['--i' as string]: 5 }}><Note tone="rose" icon="!">{data.disclaimer}</Note></div>
    </Shell>
  );
}
