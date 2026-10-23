import { Button, FilterChip, LinkButton, StatusChip, Stepper, Tag, type Status } from '../../ds';
import { COHORT_SIZES, type Cohort } from '../../data/shared';
import { INDIVIDUAL_PLAYERS, STAGES, STAGE_CARDS } from '../../data/creator';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, dot } from '../../shell/styles';

/** Players reached by the current allocation: selected cohorts plus individually added players. */
function useReach() {
  const { s } = useApp();
  return (Object.keys(s.cohorts) as Cohort[]).filter(k => s.cohorts[k]).reduce((a, k) => a + COHORT_SIZES[k], INDIVIDUAL_PLAYERS.length);
}

export function CohortChips() {
  const { s, set } = useApp();
  return (Object.keys(s.cohorts) as Cohort[]).map(k => (
    <FilterChip key={k} selected={s.cohorts[k]} onClick={() => set(prev => ({ cohorts: { ...prev.cohorts, [k]: !prev.cohorts[k] } }))}>
      {k} · {COHORT_SIZES[k]}
    </FilterChip>
  ));
}

export function Workflow() {
  const { s, set, toast, toastProto } = useApp();
  const reach = useReach();
  // stage 1–4 is the current card (Dev → Publish); 5 means v4 is published and every step shows done.
  const published = s.stage >= STAGES.length;

  const advance = () => {
    const n = Math.min(s.stage + 1, STAGES.length);
    set({ stage: n });
    toast(n === STAGES.length ?`Published v4 · allocated to ${reach} players` : `Moved to ${STAGES[n]} · logged 23 Oct`);
  };

  const versions: { v: string; note: string; meta: string; status: Status; label: string }[] = [
    { v: 'v4', note: 'Level 3 edge cases rewritten · retry path added', meta: published ? 'Published 23 Oct' : 'In workflow', status: published ? 'accepted' : 'in-progress', label: published ? 'Live' : STAGES[s.stage] },
    { v: 'v3', note: 'Timer added to level 1', meta: 'Published 2 Sep · 142 players', status: published ? 'na' : 'accepted', label: published ? 'Finishing' : 'Live' },
    { v: 'v2', note: 'Circular 2024/C/12 added to domain', meta: 'Published 14 Jun', status: 'na', label: 'Archived' },
  ];

  return (
    <Screen label="Creator · Workflow & allocation">
      <PageHead eyebrow="VAT rates ladder · v4" title="Workflow and allocation" actions={<Stepper steps={STAGES} current={s.stage} />} />
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STAGE_CARDS.map((c, i) => {
            const idx = i + 1, current = s.stage === idx, done = s.stage > idx;
            return (
              <div key={c.name} style={{ ...card, opacity: s.stage < idx ? 0.55 : 1 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <StatusChip status={done ? 'accepted' : current ? 'in-progress' : 'not-started'} label={done ? 'Done' : current ? 'Current' : 'Next'} size="xs" />
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8b918a' }}>{c.who}</span>
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {c.checks.map(([color, text, note]) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={dot(done ? '#86BC25' : color)} />
                      <span style={{ flex: 1 }}>{text}</span>
                      <span style={{ fontSize: 12, color: '#8b918a' }}>{note}</span>
                    </div>
                  ))}
                  {current ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <Button variant="primary" size="lg" onClick={advance}>{c.cta}</Button>
                      <Button variant="secondary" size="lg" onClick={toastProto}>{c.secondary}</Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <aside style={{ flex: '0 1 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card}>
            <div style={cardHead}>Allocation on publish</div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5a6058', marginBottom: 6 }}>Cohorts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}><CohortChips /></div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5a6058', marginBottom: 6 }}>Individual players</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {INDIVIDUAL_PLAYERS.map(p => <Tag key={p} tone="neutral">{p} ×</Tag>)}
                  <LinkButton size={12} onClick={toastProto} style={{ alignSelf: 'center' }}>+ Add player</LinkButton>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #eef0ea', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#5a6058' }}>Reaches</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{reach} players</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#5a6058' }}>Players mid-game on v3</span>
                <span style={{ fontWeight: 500 }}>finish v3, then v4</span>
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={cardHead}>Versions</div>
            {versions.map((v, i) => (
              <div key={v.v} style={{ padding: '10px 18px', borderTop: i ? '1px solid #eef0ea' : 0, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 600, width: 28, fontVariantNumeric: 'tabular-nums' }}>{v.v}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>{v.note}</div>
                  <div style={{ fontSize: 11.5, color: '#8b918a' }}>{v.meta}</div>
                </div>
                <StatusChip status={v.status} label={v.label} size="xs" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Screen>
  );
}
