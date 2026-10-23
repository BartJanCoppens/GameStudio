import { Button, StatusChip, Tag } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { ERRORS, GAME, INVOICES } from '../../game/content';
import { useFinishedRuns } from '../../game/runs';
import { PageHead, Screen } from '../../shell/ui';

export function Library() {
  const { s, go, set } = useApp();
  const { profile } = useSignedIn();
  const { runs } = useFinishedRuns();
  const mine = (runs ?? []).filter(r => r.user_id === profile.id);
  const best = mine.reduce<number | null>((b, r) => Math.max(b ?? 0, r.invoices_correct ?? 0), null);
  const status = s.run
    ? { st: 'in-progress' as const, label: `In progress · invoice ${s.run.index + 1} of 12` }
    : best !== null
      ? { st: 'accepted' as const, label: `Completed · best ${best}/12` }
      : { st: 'not-started' as const, label: 'Not started' };

  return (
    <Screen label="Player · Library">
      <PageHead title="Your games" lead={`1 assigned to you · ${mine.length ? `played ${mine.length} ${mine.length === 1 ? 'time' : 'times'}` : 'not played yet'}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Tag tone="neutral">{GAME.type}</Tag>
              <Tag tone="muted">Browser · large screen</Tag>
            </div>
            <StatusChip status={status.st} label={status.label} size="xs" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{GAME.title}</div>
            <div style={{ color: '#5a6058', marginTop: 4 }}>{INVOICES.length} invoices, {ERRORS.length} mistakes against the Belgian mandatory invoice mentions. Find them all and name the rule each one breaks.</div>
          </div>
          <div style={{ fontSize: 12, color: '#8b918a' }}>{GAME.minutes} min · leaderboard · feedback citing the source</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #eef0ea' }}>
            <Tag tone="bundle">{GAME.domain}</Tag>
            <div style={{ display: 'flex', gap: 6 }}>
              {mine.length ? <Button variant="secondary" size="md" onClick={() => { set({ resultsRunId: null }); go('results'); }}>Results</Button> : null}
              <Button variant="primary" size="md" onClick={() => go('play')}>{s.run ? 'Continue' : mine.length ? 'Play again' : 'Play'}</Button>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
