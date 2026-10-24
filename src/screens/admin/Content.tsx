import { Button, StatusChip, Table, Tag, type Column } from '../../ds';
import { useApp } from '../../app/useApp';
import { PASSAGES, SOURCE_DOCUMENT, type Passage } from '../../game/content';
import { PageHead, Screen } from '../../shell/ui';
import { card, dot, flush } from '../../shell/styles';

const sectionHead = { padding: '14px 18px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as const;

const DOMAIN = 'Belgian VAT';

const passageColumns: Column<Passage>[] = [
  { key: 'loc', label: 'Section', width: '220px', muted: true },
  { key: 'heading', label: 'Heading', width: '170px', strong: true },
  { key: 'text', label: 'Text', width: 'minmax(280px,2fr)', wrap: true, render: p => <span style={{ fontSize: 12.5, color: '#5a6058' }}>{p.text}</span> },
  { key: 'id', label: 'Id', width: '110px', muted: true },
];

export function Content() {
  const { toastProto } = useApp();
  return (
    <Screen label="Content domains">
      <PageHead
        title="Content"
        lead="Source material games can be grounded in · a creator links passages when designing a game"
        actions={<Button variant="primary" size="lg" onClick={toastProto}>+ New domain</Button>}
      />
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 1 280px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ textAlign: 'left', width: '100%', background: '#f6f9ef', border: '1px solid #86BC25', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={dot('#86BC25')} /><span style={{ fontWeight: 600 }}>{DOMAIN}</span></div>
            <div style={{ fontSize: 12, color: '#5a6058', marginTop: 4 }}>1 document · {PASSAGES.length} sections</div>
          </div>
        </div>
        <div style={{ flex: '1 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', overflow: 'visible' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{DOMAIN}</div>
              <div style={{ fontSize: 12.5, color: '#5a6058', marginTop: 2 }}>Mandatory mentions on Belgian VAT invoices · proof of concept, not reviewed</div>
            </div>
            <StatusChip status="accepted" label="Indexed" size="sm" />
            <Button variant="secondary" size="md" onClick={toastProto}>Reindex</Button>
          </div>
          <div style={card}>
            <div style={sectionHead}>
              <span style={{ fontWeight: 600 }}>Background documents · 1</span>
              <Button variant="secondary" size="sm" onClick={toastProto}>+ Add PDF, Markdown or text</Button>
            </div>
            <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500 }}>{SOURCE_DOCUMENT}</span>
              <Tag tone="neutral">Markdown</Tag>
              <span style={{ fontSize: 12, color: '#8b918a' }}>{PASSAGES.length} sections</span>
            </div>
          </div>
          <div style={card}>
            <div style={sectionHead}><span style={{ fontWeight: 600 }}>Sections of {SOURCE_DOCUMENT}</span></div>
            <Table columns={passageColumns} rows={PASSAGES} rowKey="id" compact style={flush} />
          </div>
          <div style={{ fontSize: 12.5, color: '#5a6058' }}>Games quote these sections by id; players see the heading, the section and the text.</div>
        </div>
      </div>
    </Screen>
  );
}
