import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Banner, Button, ChatBubble } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { DEFAULT_TOKENS } from '../../../supabase/functions/_shared/design.ts';
import type { GameContent } from '../../game/content';
import { GameFrame, MockupFrame } from '../../game/GameFrame';
import { startRun } from '../../game/runs';
import { useBuilder } from '../../game/studio/useBuilder';
import { useArchitect } from '../../game/studio/useArchitect';
import { useGameContent } from '../../game/useGameContent';
import { BackLink, Screen } from '../../shell/ui';
import { card } from '../../shell/styles';
import { LookDialog } from './LookDialog';
import { CodePanel } from './studio/CodePanel';
import { FullScreen } from './studio/FullScreen';
import { ConceptCard } from './studio/ConceptCard';
import { PhaseBar } from './studio/PhaseBar';
import { QuestionCard } from './studio/QuestionCard';
import { TestPublish } from './studio/TestPublish';
import type { GameMeta } from '../../game/games';

const MESSAGE_MAX = 2000;

/** "Thinking… 0:07": the AI is working, and for how long. */
export function Elapsed({ since, label }: { since: number; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <div role="status" style={{ fontSize: 12.5, color: 'var(--tc-ink-3)' }}>{label} {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</div>;
}

/** The chat folded away: a slim rail that opens it again. */
function ChatRail({ onShow, busy }: { onShow: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onShow}
      aria-label="Show chat"
      title="Show chat"
      style={{ ...card, width: 44, minHeight: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer', font: 'inherit', color: 'var(--tc-ink-3)', position: 'sticky', top: 78 }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>»</span>
      <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>Design with AI</span>
      {busy ? <span title="The AI is working" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--tc-amber)' }} /> : null}
    </button>
  );
}

function Conversation({ content, architect, builder, onHide }: { content: GameContent; architect: ReturnType<typeof useArchitect>; builder: ReturnType<typeof useBuilder>; onHide: () => void }) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const [changeSince, setChangeSince] = useState(0);
  const busy = architect.busy ?? (builder.changing ? 'changing' : null);
  const since = builder.changing ? changeSince : architect.since;
  const error = content.phase === 'ready' ? builder.changeError : architect.error;
  const last = content.brief[content.brief.length - 1];
  const asking = content.phase === 'questions' && last?.role === 'ai' && !last.declined && !!last.choices?.length;
  // A question on screen means the call that asked it is done; its busy state may lag a moment behind.
  const blocked = !!busy && !asking;
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [content.brief.length, busy]);

  const send = (t: string) => {
    const msg = t.trim();
    if (!msg || blocked) return;
    setText('');
    if (content.phase === 'ready') { setChangeSince(Date.now()); builder.change(msg).catch(() => {}); } else void architect.send(msg);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } };
  const open = content.phase !== 'code';

  return (
    <section aria-label="Conversation" style={{ ...card, display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 170px)', minHeight: 520, position: 'sticky', top: 78 }}>
      <div style={{ padding: '8px 10px 8px 14px', borderBottom: '1px solid var(--tc-line-hair)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }}>Design with AI</span>
        <Button variant="secondary" size="sm" aria-label="Hide chat" title="Hide chat" onClick={onHide}>«</Button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {content.brief.map((t, i) => {
          if (t === last && asking) return <QuestionCard key={i} turn={t} disabled={blocked} onAnswer={send} />;
          if (t.declined) return <div key={i} role="status" aria-label="Declined"><Banner tone="warning">{t.text}</Banner></div>;
          return <ChatBubble key={i} role={t.role === 'creator' ? 'user' : 'assistant'}>{t.text}</ChatBubble>;
        })}
        {busy ? <Elapsed since={since} label={busy === 'designing' ? 'Designing your game…' : busy === 'changing' ? 'Changing the game…' : 'Thinking…'} /> : null}
        {error ? (
          <Banner tone="warning" actions={content.phase === 'ready' ? undefined : <Button variant="secondary" size="sm" onClick={architect.retry}>Try again</Button>}>{error}</Banner>
        ) : null}
        <div ref={end} />
      </div>
      {open ? (
        <div style={{ borderTop: '1px solid var(--tc-line-hair)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            aria-label="Message the AI about this game"
            value={text}
            onChange={e => setText(e.target.value.slice(0, MESSAGE_MAX))}
            onKeyDown={onKey}
            placeholder={content.phase === 'questions' ? 'Type an answer or anything you want…' : 'Ask for a change: “make it harder”, “darker colours”…'}
            disabled={!!busy}
            rows={3}
            style={{ resize: 'none', border: '1px solid var(--tc-line)', borderRadius: 6, padding: '8px 10px', font: 'inherit', fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {content.phase === 'questions' && content.brief.some(t => t.role === 'ai' && !t.declined) ? (
              <Button variant="secondary" size="sm" onClick={() => void architect.proposeNow()} disabled={!!busy}>Propose now</Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={() => send(text)} disabled={!!busy || !text.trim()}>Send</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TestPlay({ gameKey, content }: { gameKey: string; content: GameContent }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setError(null);
    setResult(null);
    try { setRunId((await startRun(gameKey, 0, true)).id); } catch (e) { setError(e instanceof Error ? e.message : 'Could not start a test'); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant={runId ? 'secondary' : 'primary'} size="lg" onClick={() => void start()}>{runId ? 'Restart test' : 'Play test'}</Button>
        <span style={{ fontSize: 12.5, color: 'var(--tc-ink-4)' }}>{result ?? 'Test plays never reach leaderboards or goals.'}</span>
      </div>
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <FullScreen label="Game preview">
        {full => <GameFrame key={runId ?? 'preview'} gameKey={gameKey} content={content} runId={runId} test height={full ? '100%' : 560} onFinished={score => setResult(score === null ? 'Test finished.' : `Test finished · score ${score}`)} />}
      </FullScreen>
    </div>
  );
}

function Stage({ game, content, draftUpdatedAt, architect, builder, onLook }: { game: GameMeta; content: GameContent; draftUpdatedAt: string | null; architect: ReturnType<typeof useArchitect>; builder: ReturnType<typeof useBuilder>; onLook: () => void }) {
  const gameKey = game.key;
  if (content.phase === 'questions') {
    const idea = content.brief.find(t => t.role === 'creator')?.text;
    return (
      <div style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--tc-ink-4)' }}>Your idea</div>
        <div style={{ fontSize: 18, lineHeight: 1.4 }}>{idea ?? '—'}</div>
        <div style={{ color: 'var(--tc-ink-3)' }}>Answer the AI’s questions on the left. It then proposes a game here: the concept and a picture of the main screen.</div>
      </div>
    );
  }
  if (!content.concept) return null;
  if (content.phase === 'design') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 14, alignItems: 'start' }}>
          <ConceptCard concept={content.concept} />
          {content.mockup ? (
            <FullScreen label="Main screen · mock-up">
              {full => <MockupFrame html={content.mockup!} height={full ? '100%' : 460} />}
            </FullScreen>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="lg" onClick={onLook} disabled={!!architect.busy}>Change look</Button>
          <Button variant="primary" size="lg" onClick={() => void architect.approveDesign()} disabled={!!architect.busy}>Approve design · build it</Button>
        </div>
      </div>
    );
  }
  if (content.phase === 'code') return <CodePanel steps={builder.steps} live={builder.live} onRetry={builder.retry} />;
  if (builder.live) return <CodePanel steps={builder.steps} live={builder.live} onRetry={builder.retry} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TestPublish game={game} content={content} draftUpdatedAt={draftUpdatedAt} onUndo={builder.undo} />
      <TestPlay gameKey={gameKey} content={content} />
    </div>
  );
}

export function Studio() {
  const { s, set, go } = useApp();
  const { profile } = useSignedIn();
  const { game, draft, loading } = useGameContent();
  const architect = useArchitect();
  const builder = useBuilder();
  const [choosingLook, setChoosingLook] = useState(false);

  if (!game) {
    return (
      <Screen label="Creator · Studio">
        <Banner tone="info">{loading ? 'Loading…' : 'Start a game from My games.'}</Banner>
        <div><Button variant="primary" size="lg" onClick={() => go('games')}>My games</Button></div>
      </Screen>
    );
  }
  if (!draft && loading) return <Screen label="Creator · Studio"><div style={{ color: 'var(--tc-ink-5)' }}>Loading…</div></Screen>;
  if (!draft) {
    return (
      <Screen label="Creator · Studio">
        <Banner tone="info">Only the creator of {game.title} can edit it. Open one of your games from My games.</Banner>
      </Screen>
    );
  }
  const content = draft.content;

  return (
    <Screen label="Creator · Studio" gap={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => go('games')}>← My games</BackLink>
        <span style={{ color: 'var(--tc-line)' }}>·</span>
        <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>{content.concept?.title ?? game.title}</h1>
        <div style={{ marginLeft: 'auto' }}><PhaseBar phase={content.phase} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `${s.studioChatOpen ? 'minmax(300px,360px)' : '44px'} minmax(0,1fr)`, gap: 14, alignItems: 'start' }}>
        {s.studioChatOpen
          ? <Conversation content={content} architect={architect} builder={builder} onHide={() => set({ studioChatOpen: false })} />
          : <ChatRail onShow={() => set({ studioChatOpen: true })} busy={!!architect.busy || builder.changing} />}
        <Stage game={game} content={content} draftUpdatedAt={draft.updatedAt} architect={architect} builder={builder} onLook={() => setChoosingLook(true)} />
      </div>
      {choosingLook && content.concept ? (
        <LookDialog
          gameKey={game.key}
          gameTitle={content.concept.title}
          current={{ id: null, name: content.concept.look.name, tokens: content.concept.look.tokens }}
          userId={profile.id}
          onClose={() => setChoosingLook(false)}
          onApply={async design => {
            await architect.setLook(design ? { name: design.name, tokens: design.tokens } : { name: 'TaxConnect', tokens: DEFAULT_TOKENS });
            setChoosingLook(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
