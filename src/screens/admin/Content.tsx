import { Button, StatusChip, Table, type Column } from '../../ds';
import { DOMAINS, type DomainFile, type DomainKey } from '../../data/shared';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';
import { card, dot, flush } from '../../shell/styles';

const fileColumns = (nameLabel: string, versionLabel: string, itemsLabel: string): Column<DomainFile>[] => [
  { key: 'name', label: nameLabel, width: 'minmax(180px,1.2fr)', strong: true },
  { key: 'version', label: versionLabel, width: '80px', muted: true },
  { key: 'items', label: itemsLabel, width: 'minmax(140px,1fr)', muted: true },
  { key: 'status', label: 'Status', width: '130px', render: r => <StatusChip status={r.st} label={r.status} size="xs" /> },
  { key: 'used', label: 'Used by', width: '90px', muted: true },
];
const bundleColumns = fileColumns('Bundle', 'Version', 'Contents');
const docColumns = fileColumns('Document', 'Type', 'Size');

const sectionHead = { padding: '14px 18px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as const;

export function Content() {
  const { s, set, toastProto } = useApp();
  const dom = DOMAINS[s.domain];
  return (
    <Screen label="Admin · Content domains">
      <PageHead
        title="Content"
        lead="Content Domains group OKF bundles and background documents · a game is grounded in exactly one domain"
        actions={<Button variant="primary" size="lg" onClick={toastProto}>+ New domain</Button>}
      />
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(Object.keys(DOMAINS) as DomainKey[]).map(k => {
            const d = DOMAINS[k], sel = s.domain === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={sel}
                onClick={() => set({ domain: k })}
                style={{ textAlign: 'left', width: '100%', background: sel ? '#f6f9ef' : '#fff', border: `1px solid ${sel ? '#86BC25' : '#e1e5dc'}`, borderRadius: 6, padding: '12px 14px', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={dot(d.dot)} /><span style={{ fontWeight: 600 }}>{d.name}</span></div>
                <div style={{ fontSize: 12, color: '#5a6058', marginTop: 4 }}>{d.meta}</div>
              </button>
            );
          })}
        </div>
        <div style={{ flex: '1 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{dom.name}</div>
              <div style={{ fontSize: 12.5, color: '#5a6058', marginTop: 2 }}>{dom.desc}</div>
            </div>
            <StatusChip status={dom.status} label={dom.statusLabel} size="sm" />
            <Button variant="secondary" size="md" onClick={toastProto}>Reindex</Button>
          </div>
          <div style={card}>
            <div style={sectionHead}>
              <span style={{ fontWeight: 600 }}>OKF bundles · {dom.bundleCount}</span>
              <Button variant="dark" size="sm" onClick={toastProto}>+ Upload OKF bundle</Button>
            </div>
            <Table columns={bundleColumns} rows={dom.bundles} rowKey="name" compact style={flush} />
          </div>
          <div style={card}>
            <div style={sectionHead}>
              <span style={{ fontWeight: 600 }}>Background documents · {dom.docCount}</span>
              <Button variant="secondary" size="sm" onClick={toastProto}>+ Add PDF, Markdown or text</Button>
            </div>
            <Table columns={docColumns} rows={dom.docs} rowKey="name" compact style={flush} />
          </div>
          <div style={{ fontSize: 12.5, color: '#5a6058' }}>Used by {dom.games} · changing a bundle marks those games “source changed” in the creator’s workflow.</div>
        </div>
      </div>
    </Screen>
  );
}
