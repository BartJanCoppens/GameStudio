import { Button } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { useGoal } from '../../game/goal';
import { Leaderboard } from '../../game/Leaderboard';
import { clock, leaderboardOf, useFinishedRuns } from '../../game/runs';
import { ThemeScope } from '../../game/theme';
import { headingFont } from '../../game/themeVars';
import { useGameContent } from '../../game/useGameContent';
import { BackLink, Screen } from '../../shell/ui';
import { card, cardHead, eyebrow } from '../../shell/styles';

export function Results() {
  const { s, go } = useApp();
  const { profile } = useSignedIn();
  const { game, live } = useGameContent();
  const { runs, error } = useFinishedRuns(game?.key);
  const { total } = useGoal(live?.content.concept?.mode === 'common_goal' ? game?.key : undefined);
  const concept = live?.content.concept;
  const mine = (runs ?? []).filter(r => r.user_id === profile.id);
  const run = (s.resultsRunId ? mine.find(r => r.id === s.resultsRunId) : null) ?? mine[0];

  return (
    <ThemeScope tokens={concept?.look.tokens} page>
      <Screen label="Player · Results" narrow={860}>
        <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
        {!runs ? <div style={{ color: 'var(--tc-ink-5)' }}>{error ?? 'Loading…'}</div> : null}
        {runs && !run ? (
          <div style={{ ...card, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 18, fontWeight: 600, ...headingFont }}>No finished game yet</div>
            <div style={{ color: 'var(--tc-ink-3)' }}>Play {concept?.title ?? 'it'} once and your score and the leaderboard appear here.</div>
            <Button variant="primary" size="lg" onClick={() => go('play')}>Play</Button>
          </div>
        ) : null}
        {run ? (
          <div style={{ ...card, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={eyebrow}>{concept?.title ?? game?.title} · {new Date(run.finished_at!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, marginTop: 4, ...headingFont }}>Your score: {run.score}</div>
              <div style={{ color: 'var(--tc-ink-3)', marginTop: 4 }}>{clock(run.duration_seconds ?? 0)} · {mine.length} {mine.length === 1 ? 'game' : 'games'} played</div>
            </div>
            <Button variant="primary" size="lg" onClick={() => go('play')}>Play again</Button>
          </div>
        ) : null}
        {concept?.mode === 'common_goal' && concept.goal ? (
          <div style={{ ...card, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Together: {concept.goal.description}</div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={concept.goal.target} aria-valuenow={total ?? 0} style={{ height: 10, borderRadius: 5, background: 'var(--tc-surface-muted)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, ((total ?? 0) / concept.goal.target) * 100)}%`, background: 'var(--tc-green)' }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--tc-ink-3)' }}>{total ?? 0} of {concept.goal.target} {concept.goal.unit}</div>
          </div>
        ) : null}
        {concept?.leaderboard && runs ? (
          <div style={card}>
            <div style={cardHead}>Leaderboard · best game per player</div>
            <Leaderboard entries={leaderboardOf(runs)} meId={profile.id} />
          </div>
        ) : null}
      </Screen>
    </ThemeScope>
  );
}
