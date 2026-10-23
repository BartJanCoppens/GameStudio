import { Fragment } from 'react';
import { Button } from '../../ds';
import { PERMISSIONS, ROLE_CARDS } from '../../data/admin';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';

const headCell = { padding: '10px 18px', background: '#fafbf8', borderBottom: '1px solid #eef0ea', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: '#5a6058' } as const;
const MARK = { 1: { mark: '✓', bg: '#86BC25', border: '#78aa1e', label: 'Granted' }, 2: { mark: '–', bg: '#eef0ec', border: '#d5dacf', label: 'Partial' }, 0: { mark: '', bg: '#fff', border: '#d5dacf', label: 'Not granted' } };

export function Roles() {
  const { toastProto } = useApp();
  return (
    <Screen label="Admin · Roles & permissions">
      <PageHead
        title="Roles and permissions"
        lead="Four roles · a user can hold more than one · game administrator is granted per game"
        actions={<Button variant="secondary" size="lg" onClick={toastProto}>+ New role</Button>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        {ROLE_CARDS.map(r => (
          <div key={r.name} style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span style={{ fontSize: 12, color: '#8b918a', fontVariantNumeric: 'tabular-nums' }}>{r.count} users</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#5a6058', marginTop: 6 }}>{r.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, overflow: 'auto' }}>
        <div role="table" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) repeat(4,130px)', minWidth: 780 }}>
          <div role="columnheader" style={headCell}>Permission</div>
          {ROLE_CARDS.map(r => <div key={r.short} role="columnheader" style={{ ...headCell, padding: '10px 12px', textAlign: 'center' }}>{r.short}</div>)}
          {PERMISSIONS.map(([name, group, cells]) => (
            <Fragment key={name}>
              <div style={{ padding: '10px 18px', borderBottom: '1px solid #eef0ea', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{name}</span>
                <span style={{ fontSize: 11.5, color: '#8b918a' }}>{group}</span>
              </div>
              {cells.map((v, i) => {
                const m = MARK[v];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={toastProto}
                    aria-label={`${name} · ${ROLE_CARDS[i].name} · ${m.label}`}
                    style={{ border: 'none', borderBottom: '1px solid #eef0ea', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', font: 'inherit' }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${m.border}`, background: m.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#10180a' }}>
                      {m.mark}
                    </span>
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </Screen>
  );
}
