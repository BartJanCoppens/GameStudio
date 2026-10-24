import { Button, ProgressRing } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { GAME, passageOfError } from '../../game/content';
import { useGameContent } from '../../game/useGameContent';
import { Leaderboard } from '../../game/Leaderboard';
import { clock, leaderboardOf, useFinishedRuns } from '../../game/runs';
import { scoreRun } from '../../game/scoring';
import { BackLink, Screen } from '../../shell/ui';
import { card, cardHead, dot, eyebrow } from '../../shell/styles';
import { ThemeScope } from '../../game/theme';
import { headingFont } from '../../game/themeVars';

/** Badge threshold: invoices judged right in one run. */
const BADGE_AT = 10;

export function Results() {
  const { s, go } = useApp();
  const { profile } = useSignedIn();
  const { game, live } = useGameContent();
  const { runs, error } = useFinishedRuns(game.key);
  const content = live.content;
  const tokens = content.design?.tokens;
  const mine = (runs ?? []).filter(r => r.user_id === profile.id);
  const run = s.resultsRunId ? mine.find(r => r.id === s.resultsRunId) ?? mine[0] : mine[0];

  if (!runs) return <ThemeScope tokens={tokens} page><Screen label="Player · Results"><div style={{ color: 'var(--tc-ink-5)' }}>{error ?? 'Loading…'}</div></Screen></ThemeScope>;
  if (!run) {
    return (
      <ThemeScope tokens={tokens} page>
        <Screen label="Player · Results" narrow={860}>
          <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
          <div style={{ ...card, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 18, fontWeight: 600, ...headingFont }}>No finished run yet</div>
            <div style={{ color: 'var(--tc-ink-3)' }}>Play {game.title} once and your score, your answers and the leaderboard appear here.</div>
            <Button variant="primary" size="lg" onClick={() => go('play')}>Play</Button>
          </div>
        </Screen>
      </ThemeScope>
    );
  }

  // The review uses the live game; the totals are the ones stored when the run finished.
  const changed = run.content_version !== live.version;
  const score = scoreRun(content, run.answers);
  const outcomes = new Map(score.results.flatMap(r => r.errors).map(e => [e.error.id, e.outcome]));
  const earned = mine.some(r => (r.invoices_correct ?? 0) >= BADGE_AT);
  const answered = run.answers.length;

  return (
    <ThemeScope tokens={tokens} page>
      <Screen label="Player · Results" narrow={860}>
        <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
        <div style={{ ...card, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <ProgressRing value={(run.invoices_correct ?? 0) / Math.max(1, content.invoices.length)} size={72} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={eyebrow}>{game.title} · {new Date(run.finished_at!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, marginTop: 4, ...headingFont }}>{run.invoices_correct}{changed ? '' : ` of ${content.invoices.length}`} invoices right</div>
            <div style={{ color: 'var(--tc-ink-3)', marginTop: 4 }}>
              {run.errors_found}{changed ? '' : ` of ${content.errors.length}`} errors found · {run.false_flags} false {run.false_flags === 1 ? 'flag' : 'flags'} · {run.points} points · {clock(run.duration_seconds ?? 0)}
              {!changed && answered < content.invoices.length ? ` · time ran out after ${answered} invoices` : ''}
              {changed ? ' · the game has changed since this run' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: earned ? 'var(--tc-green-200)' : 'var(--tc-surface-muted)', border: `1px solid ${earned ? 'var(--tc-green-300)' : 'var(--tc-line)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: earned ? 'var(--tc-green-text)' : 'var(--tc-ink-5)' }}>A</div>
            <div>
              <div style={{ fontWeight: 600 }}>Invoice auditor badge</div>
              <div style={{ fontSize: 12, color: 'var(--tc-ink-5)' }}>{earned ? 'Earned' : `At ${BADGE_AT} invoices right in one run`}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ ...card, flex: '1 1 420px' }}>
            <div style={cardHead}>Leaderboard · best run per player</div>
            <Leaderboard entries={leaderboardOf(runs)} meId={profile.id} />
          </div>
          <div style={{ ...card, flex: '0 1 340px', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>The {content.errors.length} errors{changed ? ' in the current version' : ''}</div>
            {content.errors.map(e => {
              const o = outcomes.get(e.id);
              return (
                <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--tc-line-hair)' }}>
                  <span style={{ ...dot(o === 'found' ? 'var(--tc-green)' : o === 'wrong-rule' ? '#e2672a' : '#d14537'), marginTop: 6 }} title={o === 'found' ? 'Found' : o === 'wrong-rule' ? 'Right place, wrong rule' : 'Missed'} />
                  <div>
                    <div style={{ fontWeight: 500 }}>Invoice {e.invoice} · {e.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--tc-ink-3)' }}>{GAME.source} · {passageOfError(e).loc}</div>
                  </div>
                </div>
              );
            })}
            <Button variant="primary" size="lg" onClick={() => go('play')}>Play again</Button>
          </div>
        </div>
      </Screen>
    </ThemeScope>
  );
}
