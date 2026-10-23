import { Button, ProgressRing } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { ERRORS, GAME, INVOICES, passageOfError } from '../../game/content';
import { Leaderboard } from '../../game/Leaderboard';
import { clock, leaderboardOf, useFinishedRuns } from '../../game/runs';
import { scoreRun } from '../../game/scoring';
import { BackLink, Screen } from '../../shell/ui';
import { card, cardHead, dot, eyebrow } from '../../shell/styles';

/** Badge threshold: invoices judged right in one run. */
const BADGE_AT = 10;

export function Results() {
  const { s, go } = useApp();
  const { profile } = useSignedIn();
  const { runs, error } = useFinishedRuns();
  const mine = (runs ?? []).filter(r => r.user_id === profile.id);
  const run = s.resultsRunId ? mine.find(r => r.id === s.resultsRunId) ?? mine[0] : mine[0];

  if (!runs) return <Screen label="Player · Results"><div style={{ color: '#8b918a' }}>{error ?? 'Loading…'}</div></Screen>;
  if (!run) {
    return (
      <Screen label="Player · Results" narrow={860}>
        <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
        <div style={{ ...card, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>No finished run yet</div>
          <div style={{ color: '#5a6058' }}>Play {GAME.title} once and your score, your answers and the leaderboard appear here.</div>
          <Button variant="primary" size="lg" onClick={() => go('play')}>Play</Button>
        </div>
      </Screen>
    );
  }

  const score = scoreRun(run.answers);
  const outcomes = new Map(score.results.flatMap(r => r.errors).map(e => [e.error.id, e.outcome]));
  const earned = mine.some(r => (r.invoices_correct ?? 0) >= BADGE_AT);
  const answered = run.answers.length;

  return (
    <Screen label="Player · Results" narrow={860}>
      <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
      <div style={{ ...card, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <ProgressRing value={(run.invoices_correct ?? 0) / INVOICES.length} size={72} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={eyebrow}>{GAME.title} · {new Date(run.finished_at!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, marginTop: 4 }}>{run.invoices_correct} of {INVOICES.length} invoices right</div>
          <div style={{ color: '#5a6058', marginTop: 4 }}>
            {run.errors_found} of {ERRORS.length} errors found · {run.false_flags} false {run.false_flags === 1 ? 'flag' : 'flags'} · {run.points} points · {clock(run.duration_seconds ?? 0)}
            {answered < INVOICES.length ? ` · time ran out after ${answered} invoices` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: earned ? '#eef7dc' : '#eef0ec', border: `1px solid ${earned ? '#c9e39a' : '#d5dacf'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: earned ? '#3f6a0a' : '#8b918a' }}>A</div>
          <div>
            <div style={{ fontWeight: 600 }}>Invoice auditor badge</div>
            <div style={{ fontSize: 12, color: '#8b918a' }}>{earned ? 'Earned' : `At ${BADGE_AT} of ${INVOICES.length} invoices right`}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...card, flex: '1 1 420px' }}>
          <div style={cardHead}>Leaderboard · best run per player</div>
          <Leaderboard entries={leaderboardOf(runs)} meId={profile.id} />
        </div>
        <div style={{ ...card, flex: '0 1 340px', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>The {ERRORS.length} errors</div>
          {ERRORS.map(e => {
            const o = outcomes.get(e.id);
            return (
              <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #eef0ea' }}>
                <span style={{ ...dot(o === 'found' ? '#86BC25' : o === 'wrong-rule' ? '#e2672a' : '#d14537'), marginTop: 6 }} title={o === 'found' ? 'Found' : o === 'wrong-rule' ? 'Right place, wrong rule' : 'Missed'} />
                <div>
                  <div style={{ fontWeight: 500 }}>Invoice {e.invoice} · {e.title}</div>
                  <div style={{ fontSize: 12, color: '#5a6058' }}>{GAME.source} · {passageOfError(e).loc}</div>
                </div>
              </div>
            );
          })}
          <Button variant="primary" size="lg" onClick={() => go('play')}>Play again</Button>
        </div>
      </div>
    </Screen>
  );
}
