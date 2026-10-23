import { Button, SegmentedControl, StatusChip, Tag } from '../../ds';
import { useApp } from '../../app/useApp';
import { ERRORS, GAME, INVOICES, PASSAGES, RULES, errorsOn, passageOfError, ruleById } from '../../game/content';
import { fieldName } from '../../game/fields';
import { InvoicePaper, type FieldMark } from '../../game/InvoicePaper';
import { BackLink, Screen } from '../../shell/ui';
import { card } from '../../shell/styles';

const panelHead = { padding: '12px 14px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 } as const;

export function Studio() {
  const { s, set, go, toast } = useApp();
  const inv = INVOICES.find(i => i.no === s.studioInvoice) ?? INVOICES[0];
  const errors = errorsOn(inv.no);
  const marks: Record<string, FieldMark> = s.studioView === 'key' ? Object.fromEntries(errors.map(e => [e.fields[0], 'answer' as const])) : {};
  const usedRules = new Set(ERRORS.map(e => e.rule));

  return (
    <Screen label="Creator · Studio" gap={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => go('games')}>← My games</BackLink>
        <span style={{ color: '#d5dacf' }}>·</span>
        <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>{GAME.title}</h1>
        <Tag tone="bundle">{GAME.domain}</Tag>
        <StatusChip status="in-progress" label="Dev · v4 draft" size="xs" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="md" onClick={() => toast('Saved · v4 draft')}>Save</Button>
          <Button variant="dark" size="md" onClick={() => go('workflow')}>Send to test →</Button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr) 300px', gap: 14, alignItems: 'start' }}>
        <nav aria-label="Invoices" style={{ ...card }}>
          <div style={panelHead}>Invoices · {INVOICES.length}<span style={{ fontSize: 12, color: '#8b918a', fontWeight: 400 }}>{ERRORS.length} errors</span></div>
          {INVOICES.map(i => {
            const n = errorsOn(i.no).length, sel = i.no === inv.no;
            return (
              <button
                key={i.no}
                type="button"
                aria-current={sel ? 'true' : undefined}
                onClick={() => set({ studioInvoice: i.no })}
                style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', border: 0, borderTop: '1px solid #eef0ea', background: sel ? '#f6f9ef' : '#fff', boxShadow: sel ? 'inset 3px 0 0 #86BC25' : 'none', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              >
                <span style={{ width: 18, fontSize: 12, color: '#8b918a', fontVariantNumeric: 'tabular-nums' }}>{i.no}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.supplier.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#8b918a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.number} · {i.customer.name}</span>
                </span>
                {n ? <Tag tone="amber">{n} error</Tag> : <Tag tone="muted">Clean</Tag>}
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <SegmentedControl options={[{ value: 'key', label: 'Answer key' }, { value: 'player', label: 'As the player sees it' }]} value={s.studioView} onChange={studioView => set({ studioView })} size="md" />
            <div style={{ fontSize: 12, color: '#5a6058' }}>Invoice {inv.no} of {INVOICES.length} · {ERRORS.length} of {ERRORS.length} errors grounded</div>
          </div>
          <InvoicePaper invoice={inv} marks={marks} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={card}>
            <div style={panelHead}>Grounding · invoice {inv.no}</div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {errors.length ? errors.map(e => {
                const p = passageOfError(e);
                return (
                  <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: '#5a6058' }}>Flag on: {e.fields.map(fieldName).join(' or ')} · rule: {ruleById(e.rule).label}</div>
                    <div style={{ fontSize: 12.5, color: '#5a6058' }}>{e.explanation}</div>
                    <Tag tone="source" style={{ alignSelf: 'flex-start' }}>{GAME.source}</Tag>
                    <div style={{ fontSize: 12, color: '#8b918a' }}>{p.loc}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, borderLeft: '2px solid #86BC25', paddingLeft: 10 }}>“{p.text}”</div>
                  </div>
                );
              }) : <div style={{ fontSize: 12.5, color: '#5a6058' }}>Clean invoice: “no errors” is the right answer. Any flag here costs the player 5 points.</div>}
            </div>
          </div>
          <div style={card}>
            <div style={panelHead}>Content Domain<span style={{ fontSize: 12, color: '#8b918a', fontWeight: 400 }}>{GAME.domain}</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <div style={{ fontWeight: 500 }}>{GAME.source}</div>
              <div style={{ color: '#5a6058' }}>{PASSAGES.length} sections · {new Set(ERRORS.map(e => ruleById(e.rule).passage)).size} used by errors</div>
              <div style={{ color: '#5a6058' }}>{RULES.length} rules in the picker · {RULES.length - usedRules.size} never apply, so players can’t guess by elimination</div>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
